import { getRequiredEnvVar } from "../config/env.js";
import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import {
  KeywordMetricsSchema,
  type KeywordMetrics,
} from "../types/keywordMetrics.schema.js";
import {
  QueryCandidatesSchema,
  type QueryCandidates,
} from "../types/queryCandidates.schema.js";

const DATAFORSEO_KEYWORD_OVERVIEW_URL =
  "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live";
const DATAFORSEO_KEYWORD_OVERVIEW_ENDPOINT =
  "/v3/dataforseo_labs/google/keyword_overview/live";

type Market = {
  locationCode: number;
  locationName: string;
  languageCode: string;
};

type DataForSeoKeywordOverviewResponse = {
  status_code: number;
  status_message: string;
  tasks: DataForSeoTask[];
};

type DataForSeoTask = {
  id: string;
  status_code: number;
  status_message: string;
  cost: number;
  result: DataForSeoResult[];
};

type DataForSeoResult = {
  items: DataForSeoKeywordOverviewItem[];
};

type DataForSeoKeywordOverviewItem = {
  keyword: string;
  keyword_info: DataForSeoKeywordInfo | null;
  keyword_properties: DataForSeoKeywordProperties | null;
  search_intent_info: DataForSeoSearchIntentInfo | null;
  avg_backlinks_info: DataForSeoAvgBacklinksInfo | null;
};

type DataForSeoKeywordInfo = {
  last_updated_time: string | null;
  search_volume: number | null;
  monthly_searches: DataForSeoMonthlySearch[];
  search_volume_trend: DataForSeoSearchVolumeTrend | null;
  cpc: number | null;
  competition: number | null;
  competition_level: string | null;
};

type DataForSeoMonthlySearch = {
  year: number | null;
  month: number | null;
  search_volume: number | null;
};

type DataForSeoSearchVolumeTrend = {
  monthly: number | null;
  quarterly: number | null;
  yearly: number | null;
};

type DataForSeoKeywordProperties = {
  keyword_difficulty: number | null;
  core_keyword: string | null;
  detected_language: string | null;
  is_another_language: boolean | null;
};

type DataForSeoSearchIntentInfo = {
  main_intent: string | null;
  foreign_intent: string[];
  last_updated_time: string | null;
};

type DataForSeoAvgBacklinksInfo = {
  backlinks: number | null;
  dofollow: number | null;
  referring_pages: number | null;
  referring_domains: number | null;
  referring_main_domains: number | null;
  rank: number | null;
  main_domain_rank: number | null;
  last_updated_time: string | null;
};

type KeywordMetricQueryDraft = {
  query: string;
  normalized_query: string;
  query_type: string;
  generation_reasoning: string;
  data_status: "available" | "no_data";
  provider_keyword: string | null;
  metrics: KeywordProviderMetricsDraft | null;
};

type KeywordMetricFamilyDraft = {
  family_id: string;
  territory: "problem_demand" | "solution_demand";
  family_name: string;
  search_intent: "informational" | "commercial" | "transactional";
  buyer_stage: string;
  likely_page_type: string;
  product_relevance: "high" | "medium" | "low";
  queries: KeywordMetricQueryDraft[];
};

type KeywordProviderMetricsDraft = {
  keyword_data_updated_at: string | null;
  search_volume: number | null;
  monthly_searches: Array<{
    year: number;
    month: number;
    search_volume: number | null;
  }>;
  search_volume_trend: {
    monthly: number | null;
    quarterly: number | null;
    yearly: number | null;
  } | null;
  keyword_difficulty: number | null;
  main_intent:
    | "informational"
    | "commercial"
    | "transactional"
    | "navigational"
    | null;
  foreign_intents: Array<
    "informational" | "commercial" | "transactional" | "navigational"
  >;
  search_intent_updated_at: string | null;
  cpc_usd: number | null;
  paid_competition: number | null;
  paid_competition_level: "LOW" | "MEDIUM" | "HIGH" | null;
  core_keyword: string | null;
  detected_language: string | null;
  is_another_language: boolean | null;
  avg_backlinks_info: {
    backlinks: number | null;
    dofollow: number | null;
    referring_pages: number | null;
    referring_domains: number | null;
    referring_main_domains: number | null;
    rank: number | null;
    main_domain_rank: number | null;
    last_updated_at: string | null;
  } | null;
};

const DEFAULT_MARKET: Market = {
  locationCode: 2840,
  locationName: "United States",
  languageCode: "en",
};

export async function generateKeywordMetrics(
  queryCandidates: QueryCandidates,
  runId: string,
  market: Market = DEFAULT_MARKET,
): Promise<KeywordMetrics> {
  logStep("Starting keyword metrics generation");

  const validatedQueryCandidates = QueryCandidatesSchema.parse(queryCandidates);
  const generatedAt = new Date().toISOString();
  const flattenedQueries = validatedQueryCandidates.query_families.flatMap(
    (family) =>
      family.query_candidates.map((candidate) => ({
        family,
        candidate,
        normalizedQuery: normalizeQuery(candidate.query),
      })),
  );

  if (flattenedQueries.length !== 60) {
    throw new Error(
      `Keyword metrics generation requires exactly 60 queries; found ${flattenedQueries.length}.`,
    );
  }

  const normalizedQueries = flattenedQueries.map(
    (query) => query.normalizedQuery,
  );

  logInfo(`Keyword overview submitted query count: ${normalizedQueries.length}`);
  logInfo(
    `Keyword overview market: ${market.locationName}, ${market.languageCode}`,
  );

  const providerResponse = await fetchKeywordOverview({
    keywords: normalizedQueries,
    market,
    runId,
  });
  const task = providerResponse.tasks[0];
  const providerItems = task.result[0].items;
  const providerItemsByQuery = mapProviderItemsByNormalizedQuery(providerItems);
  const warnings: string[] = [];

  const omittedQueryCount = normalizedQueries.filter(
    (query) => !providerItemsByQuery.has(query),
  ).length;

  if (omittedQueryCount > 0) {
    warnings.push(
      `DataForSEO omitted ${omittedQueryCount} submitted queries from the keyword overview response.`,
    );
  }

  const queryFamilies: KeywordMetricFamilyDraft[] =
    validatedQueryCandidates.query_families.map(
    (family) => ({
      family_id: family.family_id,
      territory: family.territory,
      family_name: family.family_name,
      search_intent: family.search_intent,
      buyer_stage: family.buyer_stage,
      likely_page_type: family.likely_page_type,
      product_relevance: family.product_relevance,
      queries: family.query_candidates.map((candidate) => {
        const normalizedQuery = normalizeQuery(candidate.query);
        const providerItem = providerItemsByQuery.get(normalizedQuery);

        if (providerItem === undefined) {
          return {
            query: candidate.query,
            normalized_query: normalizedQuery,
            query_type: candidate.query_type,
            generation_reasoning: candidate.reasoning,
            data_status: "no_data" as const,
            provider_keyword: null,
            metrics: null,
          };
        }

        return {
          query: candidate.query,
          normalized_query: normalizedQuery,
          query_type: candidate.query_type,
          generation_reasoning: candidate.reasoning,
          data_status: "available" as const,
          provider_keyword: providerItem.keyword,
          metrics: mapProviderMetrics(providerItem),
        };
      }),
    }),
    );
  const allMetricQueries = queryFamilies.flatMap((family) => family.queries);
  const returnedQueries = allMetricQueries.filter(
    (query) => query.data_status === "available",
  );
  const noDataQueries = allMetricQueries.filter(
    (query) => query.data_status === "no_data",
  );
  const positiveVolumeQueries = returnedQueries.filter(
    (query) => getSearchVolume(query) !== null && getSearchVolume(query)! > 0,
  );
  const zeroVolumeQueries = returnedQueries.filter(
    (query) => getSearchVolume(query) === 0,
  );
  const nullVolumeQueries = returnedQueries.filter(
    (query) => getSearchVolume(query) === null,
  );
  const familiesWithPositiveVolume = queryFamilies.filter((family) =>
    family.queries.some(
      (query) => getSearchVolume(query) !== null && getSearchVolume(query)! > 0,
    ),
  );

  const keywordMetricsInput: unknown = {
    schema_version: "1.0.0",
    run_id: runId,
    generated_at: generatedAt,
    source_artifacts: ["query-candidates.json"],
    status: "complete",
    warnings,
    website_url: validatedQueryCandidates.website_url,
    market: {
      location_code: market.locationCode,
      location_name: market.locationName,
      language_code: market.languageCode,
    },
    provider: {
      name: "dataforseo",
      endpoint: DATAFORSEO_KEYWORD_OVERVIEW_ENDPOINT,
      task_id: task.id,
      status_code: task.status_code,
      status_message: task.status_message,
      cost_usd: task.cost,
    },
    query_families: queryFamilies,
    summary: {
      submitted_queries: allMetricQueries.length,
      returned_queries: returnedQueries.length,
      no_data_queries: noDataQueries.length,
      positive_volume_queries: positiveVolumeQueries.length,
      zero_volume_queries: zeroVolumeQueries.length,
      null_volume_queries: nullVolumeQueries.length,
      families_with_positive_volume: familiesWithPositiveVolume.length,
      provider_cost_usd: task.cost,
    },
  };

  const keywordMetrics = KeywordMetricsSchema.parse(keywordMetricsInput);

  logSuccess("Keyword metrics generation completed");
  logInfo(`Keyword metrics returned queries: ${returnedQueries.length}`);
  logInfo(`Keyword metrics no-data queries: ${noDataQueries.length}`);
  logInfo(
    `Keyword metrics positive-volume queries: ${positiveVolumeQueries.length}`,
  );
  logInfo(`Keyword metrics provider cost: ${task.cost}`);

  return keywordMetrics;
}

async function fetchKeywordOverview({
  keywords,
  market,
  runId,
}: {
  keywords: string[];
  market: Market;
  runId: string;
}): Promise<DataForSeoKeywordOverviewResponse> {
  logStep("Fetching DataForSEO keyword overview");

  const login = getRequiredEnvVar("DATAFORSEO_LOGIN");
  const password = getRequiredEnvVar("DATAFORSEO_PASSWORD");
  const authorization = Buffer.from(`${login}:${password}`).toString("base64");
  const response = await fetch(DATAFORSEO_KEYWORD_OVERVIEW_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        keywords,
        location_code: market.locationCode,
        language_code: market.languageCode,
        include_serp_info: false,
        include_clickstream_data: false,
        tag: runId,
      },
    ]),
  });

  if (!response.ok) {
    throw new Error(
      `DataForSEO keyword overview returned HTTP ${response.status}: ${await response.text()}`,
    );
  }

  return parseDataForSeoResponse(await response.json());
}

function parseDataForSeoResponse(
  value: unknown,
): DataForSeoKeywordOverviewResponse {
  const root = requireRecord(value, "DataForSEO response root");
  const statusCode = requireNumber(root.status_code, "root status_code");
  const statusMessage = requireString(root.status_message, "root status_message");

  if (statusCode !== 20000) {
    throw new Error(
      `DataForSEO keyword overview root status ${statusCode}: ${statusMessage}`,
    );
  }

  const tasks = requireArray(root.tasks, "root tasks");

  if (tasks.length !== 1) {
    throw new Error(
      `DataForSEO keyword overview expected exactly one task; found ${tasks.length}.`,
    );
  }

  const task = parseTask(tasks[0]);

  if (task.status_code !== 20000) {
    throw new Error(
      `DataForSEO keyword overview task status ${task.status_code}: ${task.status_message}`,
    );
  }

  if (task.result.length === 0) {
    throw new Error("DataForSEO keyword overview task did not include result.");
  }

  return {
    status_code: statusCode,
    status_message: statusMessage,
    tasks: [task],
  };
}

function parseTask(value: unknown): DataForSeoTask {
  const task = requireRecord(value, "DataForSEO task");
  const result = requireArray(task.result, "task result");

  if (result.length === 0) {
    throw new Error("DataForSEO keyword overview task result is empty.");
  }

  return {
    id: requireString(task.id, "task id"),
    status_code: requireNumber(task.status_code, "task status_code"),
    status_message: requireString(task.status_message, "task status_message"),
    cost: requireNumber(task.cost, "task cost"),
    result: [parseResult(result[0])],
  };
}

function parseResult(value: unknown): DataForSeoResult {
  const result = requireRecord(value, "DataForSEO result");
  const items = requireArray(result.items, "result items");

  return {
    items: items.map((item) => parseKeywordOverviewItem(item)),
  };
}

function parseKeywordOverviewItem(
  value: unknown,
): DataForSeoKeywordOverviewItem {
  const item = requireRecord(value, "DataForSEO result item");
  const keyword = requireString(item.keyword, "item keyword");

  if (normalizeQuery(keyword).length === 0) {
    throw new Error("DataForSEO returned an item with an empty keyword.");
  }

  return {
    keyword,
    keyword_info: getOptionalRecord(item.keyword_info, "keyword_info", (record) => ({
      last_updated_time: getStringOrNull(record.last_updated_time),
      search_volume: getNumberOrNull(record.search_volume),
      monthly_searches: getArrayOrEmpty(record.monthly_searches).map(
        (monthlySearch) => parseMonthlySearch(monthlySearch),
      ),
      search_volume_trend: getOptionalRecord(
        record.search_volume_trend,
        "search_volume_trend",
        (trend) => ({
          monthly: getNumberOrNull(trend.monthly),
          quarterly: getNumberOrNull(trend.quarterly),
          yearly: getNumberOrNull(trend.yearly),
        }),
      ),
      cpc: getNumberOrNull(record.cpc),
      competition: getNumberOrNull(record.competition),
      competition_level: getStringOrNull(record.competition_level),
    })),
    keyword_properties: getOptionalRecord(
      item.keyword_properties,
      "keyword_properties",
      (record) => ({
        keyword_difficulty: getNumberOrNull(record.keyword_difficulty),
        core_keyword: getStringOrNull(record.core_keyword),
        detected_language: getStringOrNull(record.detected_language),
        is_another_language: getBooleanOrNull(record.is_another_language),
      }),
    ),
    search_intent_info: getOptionalRecord(
      item.search_intent_info,
      "search_intent_info",
      (record) => ({
        main_intent: getStringOrNull(record.main_intent),
        foreign_intent: getArrayOrEmpty(record.foreign_intent)
          .map((intent) => getStringOrNull(intent))
          .filter((intent): intent is string => intent !== null),
        last_updated_time: getStringOrNull(record.last_updated_time),
      }),
    ),
    avg_backlinks_info: getOptionalRecord(
      item.avg_backlinks_info,
      "avg_backlinks_info",
      (record) => ({
        backlinks: getNumberOrNull(record.backlinks),
        dofollow: getNumberOrNull(record.dofollow),
        referring_pages: getNumberOrNull(record.referring_pages),
        referring_domains: getNumberOrNull(record.referring_domains),
        referring_main_domains: getNumberOrNull(
          record.referring_main_domains,
        ),
        rank: getNumberOrNull(record.rank),
        main_domain_rank: getNumberOrNull(record.main_domain_rank),
        last_updated_time: getStringOrNull(record.last_updated_time),
      }),
    ),
  };
}

function parseMonthlySearch(value: unknown): DataForSeoMonthlySearch {
  const monthlySearch = requireRecord(value, "monthly_searches item");

  return {
    year: getNumberOrNull(monthlySearch.year),
    month: getNumberOrNull(monthlySearch.month),
    search_volume: getNumberOrNull(monthlySearch.search_volume),
  };
}

function mapProviderItemsByNormalizedQuery(
  items: DataForSeoKeywordOverviewItem[],
): Map<string, DataForSeoKeywordOverviewItem> {
  const itemsByQuery = new Map<string, DataForSeoKeywordOverviewItem>();

  for (const item of items) {
    const normalizedQuery = normalizeQuery(item.keyword);

    if (itemsByQuery.has(normalizedQuery)) {
      throw new Error(
        `DataForSEO returned duplicate keyword overview rows for ${normalizedQuery}.`,
      );
    }

    itemsByQuery.set(normalizedQuery, item);
  }

  return itemsByQuery;
}

function mapProviderMetrics(
  item: DataForSeoKeywordOverviewItem,
): KeywordProviderMetricsDraft {
  return {
    keyword_data_updated_at: item.keyword_info?.last_updated_time ?? null,
    search_volume: toIntegerOrNull(item.keyword_info?.search_volume ?? null),
    monthly_searches: (item.keyword_info?.monthly_searches ?? [])
      .map((monthlySearch) => ({
        year: toIntegerOrNull(monthlySearch.year),
        month: toIntegerOrNull(monthlySearch.month),
        search_volume: toIntegerOrNull(monthlySearch.search_volume),
      }))
      .filter(
        (
          monthlySearch,
        ): monthlySearch is {
          year: number;
          month: number;
          search_volume: number | null;
        } => monthlySearch.year !== null && monthlySearch.month !== null,
      ),
    search_volume_trend:
      item.keyword_info?.search_volume_trend === null ||
      item.keyword_info?.search_volume_trend === undefined
        ? null
        : {
            monthly: item.keyword_info.search_volume_trend.monthly,
            quarterly: item.keyword_info.search_volume_trend.quarterly,
            yearly: item.keyword_info.search_volume_trend.yearly,
          },
    keyword_difficulty: toIntegerOrNull(
      item.keyword_properties?.keyword_difficulty ?? null,
    ),
    main_intent: toIntentOrNull(item.search_intent_info?.main_intent ?? null),
    foreign_intents: (item.search_intent_info?.foreign_intent ?? [])
      .map((intent) => toIntentOrNull(intent))
      .filter((intent): intent is NonNullable<ReturnType<typeof toIntentOrNull>> =>
        intent !== null,
      ),
    search_intent_updated_at:
      item.search_intent_info?.last_updated_time ?? null,
    cpc_usd: item.keyword_info?.cpc ?? null,
    paid_competition: item.keyword_info?.competition ?? null,
    paid_competition_level: toPaidCompetitionLevelOrNull(
      item.keyword_info?.competition_level ?? null,
    ),
    core_keyword: item.keyword_properties?.core_keyword ?? null,
    detected_language: item.keyword_properties?.detected_language ?? null,
    is_another_language: item.keyword_properties?.is_another_language ?? null,
    avg_backlinks_info:
      item.avg_backlinks_info === null
        ? null
        : {
            backlinks: item.avg_backlinks_info.backlinks,
            dofollow: item.avg_backlinks_info.dofollow,
            referring_pages: item.avg_backlinks_info.referring_pages,
            referring_domains: item.avg_backlinks_info.referring_domains,
            referring_main_domains:
              item.avg_backlinks_info.referring_main_domains,
            rank: item.avg_backlinks_info.rank,
            main_domain_rank: item.avg_backlinks_info.main_domain_rank,
            last_updated_at: item.avg_backlinks_info.last_updated_time,
          },
  };
}

function getSearchVolume(query: {
  metrics: { search_volume: number | null } | null;
}): number | null {
  return query.metrics?.search_volume ?? null;
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function requireRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an array.`);
  }

  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Expected ${label} to be a non-empty string.`);
  }

  return value;
}

function requireNumber(value: unknown, label: string): number {
  const numberValue = getNumberOrNull(value);

  if (numberValue === null) {
    throw new Error(`Expected ${label} to be a number.`);
  }

  return numberValue;
}

function getOptionalRecord<T>(
  value: unknown,
  label: string,
  mapper: (value: Record<string, unknown>) => T,
): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  return mapper(requireRecord(value, label));
}

function getArrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function getBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toIntegerOrNull(value: number | null): number | null {
  return value === null ? null : Math.trunc(value);
}

function toIntentOrNull(value: string | null) {
  if (
    value === "informational" ||
    value === "commercial" ||
    value === "transactional" ||
    value === "navigational"
  ) {
    return value;
  }

  return null;
}

function toPaidCompetitionLevelOrNull(value: string | null) {
  if (value === "LOW" || value === "MEDIUM" || value === "HIGH") {
    return value;
  }

  return null;
}
