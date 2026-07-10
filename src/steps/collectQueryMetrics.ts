import { getRequiredEnvVar } from "../config/env.js";
import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import {
  QueryAnalysisSchema,
  type QueryAnalysis,
} from "../types/queryMetrics.schema.js";
import type { SerpData } from "../types/serpData.schema.js";

type DataForSeoResponse<T> = {
  tasks?: Array<{
    result?: Array<T | { items?: T[] | null }> | null;
  }>;
};

type KeywordMetricResult = {
  keyword?: string;
  search_volume?: unknown;
  cpc?: unknown;
};

type AuthorityMetricResult = {
  target?: string;
  rank?: unknown;
};

type QueryMetricMaps = {
  keywordMetricsByQuery: Map<
    string,
    {
      searchVolume: number | null;
      cpc: number | null;
    }
  >;
  authorityRankByTarget: Map<string, number>;
};

export async function collectQueryMetrics(
  serpData: SerpData,
): Promise<QueryAnalysis[]> {
  logStep("Starting query metrics collection");

  const keywordQueries = serpData.api_batches.keyword_metrics.queries;
  const authorityTargets = serpData.api_batches.authority_metrics.targets;

  logInfo(`Keyword metric query count: ${keywordQueries.length}`);
  logInfo(`Authority metric target count: ${authorityTargets.length}`);

  const { keywordMetricsByQuery, authorityRankByTarget } =
    await fetchQueryMetricMaps({
      keywordQueries,
      authorityTargets,
    });

  const queryAnalyses = serpData.queries.map((serpQuery) => {
    const keywordMetrics = keywordMetricsByQuery.get(serpQuery.query);
    const authorityScores = serpQuery.serp.top_results
      .map((result) => authorityRankByTarget.get(result.authority_target))
      .filter((score): score is number => score !== undefined);

    return QueryAnalysisSchema.parse({
      query: serpQuery.query,
      source_page: {
        cluster_name: serpQuery.cluster_name,
        page_title: serpQuery.page_title,
        page_role: serpQuery.page_role,
      },
      metrics: {
        search_volume: keywordMetrics?.searchVolume ?? null,
        cpc: keywordMetrics?.cpc ?? null,
        avg_authority: average(authorityScores),
        median_authority: median(authorityScores),
        lowest_authority:
          authorityScores.length > 0
            ? roundOneDecimal(Math.min(...authorityScores))
            : null,
      },
      serp_shape: {
        top_3_dominant_page_type: "unknown",
        top_5_dominant_page_type: "unknown",
        serp_features: {
          people_also_ask_present: false,
          related_searches_present: false,
          video_result_present: false,
          forum_result_present: false,
          docs_result_present: false,
          homepage_result_present: false,
          mixed_page_types: false,
        },
      },
      llm_analysis: {
        standalone_page_fit: {
          value: "unknown",
          confidence: "medium",
          reasoning: "",
        },
        angle_to_win: {
          value: "",
          confidence: "medium",
          reasoning: "",
        },
        query_fit: {
          recommendation: "needs_review",
          confidence: "medium",
          reasoning: "",
        },
      },
      notes: {
        serp_evidence: "",
        risk: "",
      },
    });
  });

  logSuccess("Query metrics collection completed");
  logInfo(`Query analyses processed: ${queryAnalyses.length}`);
  logInfo(`Keyword metrics found: ${keywordMetricsByQuery.size}`);
  logInfo(`Authority targets found: ${authorityRankByTarget.size}`);

  return queryAnalyses;
}

async function fetchQueryMetricMaps({
  keywordQueries,
  authorityTargets,
}: {
  keywordQueries: string[];
  authorityTargets: string[];
}): Promise<QueryMetricMaps> {
  const [keywordResults, authorityResults] = await Promise.all([
    fetchKeywordMetrics(keywordQueries),
    fetchAuthorityMetrics(authorityTargets),
  ]);

  logInfo(`Keyword metric result rows: ${keywordResults.length}`);
  logInfo(`Authority metric result rows: ${authorityResults.length}`);

  const keywordMetricsByQuery = new Map<
    string,
    {
      searchVolume: number | null;
      cpc: number | null;
    }
  >();

  for (const item of keywordResults) {
    if (!item.keyword) {
      continue;
    }

    keywordMetricsByQuery.set(item.keyword, {
      searchVolume: toNumberOrZero(item.search_volume),
      cpc: toNumberOrZero(item.cpc),
    });
  }

  const authorityRankByTarget = new Map<string, number>();

  for (const item of authorityResults) {
    const rank = toNumberOrNull(item.rank);

    if (!item.target || rank === null) {
      continue;
    }

    authorityRankByTarget.set(item.target, rank);
  }

  return {
    keywordMetricsByQuery,
    authorityRankByTarget,
  };
}

async function fetchKeywordMetrics(
  keywords: string[],
): Promise<KeywordMetricResult[]> {
  if (keywords.length === 0) {
    return [];
  }

  logStep("Fetching DataForSEO keyword metrics");

  const response = await postDataForSeo<KeywordMetricResult>(
    "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
    [
      {
        location_code: 2840,
        language_code: "en",
        search_partners: false,
        keywords,
      },
    ],
  );

  return extractDataForSeoResults(response);
}

async function fetchAuthorityMetrics(
  targets: string[],
): Promise<AuthorityMetricResult[]> {
  if (targets.length === 0) {
    return [];
  }

  logStep("Fetching DataForSEO authority metrics");

  const response = await postDataForSeo<AuthorityMetricResult>(
    "https://api.dataforseo.com/v3/backlinks/bulk_ranks/live",
    [
      {
        targets,
        rank_scale: "one_hundred",
      },
    ],
  );

  return extractDataForSeoResults(response);
}

async function postDataForSeo<T>(
  url: string,
  body: unknown,
): Promise<DataForSeoResponse<T>> {
  const login = getRequiredEnvVar("DATAFORSEO_LOGIN");
  const password = getRequiredEnvVar("DATAFORSEO_PASSWORD");
  const authorization = Buffer.from(`${login}:${password}`).toString("base64");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `DataForSEO returned ${response.status}: ${await response.text()}`,
    );
  }

  return (await response.json()) as DataForSeoResponse<T>;
}

function extractDataForSeoResults<T>(response: DataForSeoResponse<T>): T[] {
  return (response.tasks ?? []).flatMap((task) =>
    (task.result ?? []).flatMap((result) => {
      if (hasItems<T>(result)) {
        return result.items ?? [];
      }

      return [result];
    }),
  );
}

function hasItems<T>(value: T | { items?: T[] | null }): value is {
  items?: T[] | null;
} {
  return typeof value === "object" && value !== null && "items" in value;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function toNumberOrZero(value: unknown): number {
  return toNumberOrNull(value) ?? 0;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return roundOneDecimal(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return roundOneDecimal(sortedValues[midpoint]);
  }

  return roundOneDecimal(
    (sortedValues[midpoint - 1] + sortedValues[midpoint]) / 2,
  );
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
