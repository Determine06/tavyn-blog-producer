import { env } from "../config/env.js";
import { logError, logInfo, logStep, logSuccess } from "../lib/logger.js";
import type { TopicalClusterCandidates } from "../types/topicalClusterCandidates.schema.js";
import { SerpDataSchema, type SerpData } from "../types/serpData.schema.js";

type QuerySource = {
  query: string;
  clusterId: string;
  clusterName: string;
  pageId: string;
  pageRole: "pillar" | "subpage";
  pageTitle: string;
  expectedIntent: "informational" | "commercial" | "transactional" | "navigational";
  expectedFunnelStage: "top" | "middle" | "bottom";
};

type SerperOrganicResult = {
  position?: number;
  title?: string;
  link?: string;
  snippet?: string;
};

type SerperPeopleAlsoAskResult = {
  question?: string;
};

type SerperRelatedSearchResult = {
  query?: string;
};

type SerperResponse = {
  organic?: SerperOrganicResult[];
  peopleAlsoAsk?: SerperPeopleAlsoAskResult[];
  relatedSearches?: Array<string | SerperRelatedSearchResult>;
};

type NormalizedSerp = {
  fetchedAt: string;
  topResults: SerpData["queries"][number]["serp"]["top_results"];
  peopleAlsoAsk: SerpData["queries"][number]["serp"]["people_also_ask"];
  relatedSearches: string[];
  missingSerp: boolean;
  organicResultsMissing: boolean;
  notes: string;
};

const COMMON_TWO_PART_PUBLIC_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "com.br",
  "com.mx",
  "co.jp",
  "co.in",
]);

export async function collectSerpData(
  topicalClusters: TopicalClusterCandidates,
): Promise<SerpData> {
  logStep("Starting SERP data collection");

  const querySources = extractQuerySources(topicalClusters);
  const uniqueQueries = [...new Set(querySources.map((source) => source.query))];
  const serpByQuery = new Map<string, NormalizedSerp>();

  logInfo(`SERP query source count: ${querySources.length}`);
  logInfo(`Unique SERP query count: ${uniqueQueries.length}`);

  for (const query of uniqueQueries) {
    try {
      logStep(`Fetching Serper results for query: ${query}`);
      const serperResponse = await fetchSerperResults(query);
      serpByQuery.set(query, normalizeSerperResponse(serperResponse));
    } catch (error) {
      logError(`Serper request failed for query: ${query}`, error);
      serpByQuery.set(query, buildFailedSerp(error));
    }
  }

  const queries = querySources.map((source, index) => {
    const serp = serpByQuery.get(source.query) ?? buildFailedSerp();
    const topResultsSummary = serp.topResults.map(
      ({ position, title, root_domain, url_path, result_type_hint, snippet }) => ({
        position,
        title,
        root_domain,
        url_path,
        result_type_hint,
        snippet,
      }),
    );

    return {
      query_id: `query-${index + 1}`,
      cluster_id: source.clusterId,
      cluster_name: source.clusterName,
      page_id: source.pageId,
      page_role: source.pageRole,
      page_title: source.pageTitle,
      query: source.query,
      expected_intent_from_cluster: source.expectedIntent,
      expected_funnel_stage_from_cluster: source.expectedFunnelStage,
      serp: {
        fetched_at: serp.fetchedAt,
        cache_status: "fresh" as const,
        organic_result_count: serp.topResults.length,
        top_results: serp.topResults,
        people_also_ask: serp.peopleAlsoAsk,
        related_searches: serp.relatedSearches,
      },
      serp_llm_input: {
        top_results_summary: topResultsSummary,
        paa_questions: serp.peopleAlsoAsk.map((item) => item.question),
        related_searches: serp.relatedSearches,
      },
      metric_extraction: {
        keyword_metric_query: source.query,
        root_domains_for_authority: [
          ...new Set(
            serp.topResults
              .map((result) => result.authority_target)
              .filter((target) => target.length > 0),
          ),
        ],
      },
      quality_control: {
        missing_serp: serp.missingSerp,
        organic_results_missing: serp.organicResultsMissing,
        notes: serp.notes,
      },
    };
  });
  const authorityTargets = [
    ...new Set(
      queries.flatMap((query) => query.metric_extraction.root_domains_for_authority),
    ),
  ];

  const serpData = SerpDataSchema.parse({
    schema_version: "1.0.0",
    website_url: topicalClusters.website_url,
    generated_at: new Date().toISOString(),
    serp_provider: "serper",
    search_settings: {
      search_engine: "google",
      location_code: 2840,
      language_code: "en",
      country: "us",
      result_count_requested: 10,
    },
    source_clusters: {
      schema_version: topicalClusters.schema_version,
      generated_at: topicalClusters.generated_at,
      cluster_count: topicalClusters.topical_clusters.length,
      query_count: uniqueQueries.length,
    },
    queries,
    api_batches: {
      keyword_metrics: {
        provider: "dataforseo",
        endpoint: "keywords_data.google_ads.search_volume.live",
        queries: uniqueQueries,
      },
      authority_metrics: {
        provider: "dataforseo",
        endpoint: "backlinks.bulk_ranks.live",
        targets: authorityTargets,
        rank_scale: "one_hundred",
      },
    },
  });

  logSuccess("SERP data collection completed");
  logInfo(`SERP data query entries: ${serpData.queries.length}`);
  logInfo(`SERP data unique queries: ${serpData.source_clusters.query_count}`);

  return serpData;
}

function extractQuerySources(
  topicalClusters: TopicalClusterCandidates,
): QuerySource[] {
  return topicalClusters.topical_clusters.flatMap((cluster, clusterIndex) => {
    const clusterId = `cluster-${clusterIndex + 1}`;
    const pillar: QuerySource = {
      query: cluster.pillar_page.primary_query,
      clusterId,
      clusterName: cluster.cluster_name,
      pageId: `${clusterId}-pillar`,
      pageRole: "pillar",
      pageTitle: cluster.pillar_page.page_title,
      expectedIntent: cluster.pillar_page.search_intent,
      expectedFunnelStage: cluster.pillar_page.funnel_stage,
    };
    const subpages: QuerySource[] = cluster.subpages.map(
      (subpage, subpageIndex) => ({
        query: subpage.primary_query,
        clusterId,
        clusterName: cluster.cluster_name,
        pageId: `${clusterId}-subpage-${subpageIndex + 1}`,
        pageRole: "subpage",
        pageTitle: subpage.page_title,
        expectedIntent: subpage.search_intent,
        expectedFunnelStage: subpage.funnel_stage,
      }),
    );

    return [pillar, ...subpages];
  });
}

async function fetchSerperResults(query: string): Promise<SerperResponse> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": env.SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      gl: "us",
      hl: "en",
      num: 10,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Serper returned ${response.status}: ${await response.text()}`,
    );
  }

  return (await response.json()) as SerperResponse;
}

function normalizeSerperResponse(response: SerperResponse): NormalizedSerp {
  const topResults = (response.organic ?? []).slice(0, 10).map((result) => {
    const parsedUrl = parseUrlParts(result.link ?? "");
    const title = result.title ?? "";

    return {
      position: result.position ?? 0,
      title,
      url: result.link ?? "",
      host: parsedUrl.host,
      root_domain: parsedUrl.rootDomain,
      authority_target: parsedUrl.rootDomain,
      authority_target_type: "root_domain" as const,
      result_type_hint: inferResultTypeHint({
        title,
        host: parsedUrl.host,
        urlPath: parsedUrl.urlPath,
      }),
      url_path: parsedUrl.urlPath,
      snippet: result.snippet ?? "",
    };
  });
  const peopleAlsoAsk = (response.peopleAlsoAsk ?? [])
    .map((item) => item.question ?? "")
    .filter((question) => question.length > 0)
    .map((question) => ({ question }));
  const relatedSearches = (response.relatedSearches ?? [])
    .map((item) => (typeof item === "string" ? item : item.query ?? ""))
    .filter((query) => query.length > 0);

  return {
    fetchedAt: new Date().toISOString(),
    topResults,
    peopleAlsoAsk,
    relatedSearches,
    missingSerp: false,
    organicResultsMissing: topResults.length === 0,
    notes:
      topResults.length === 0
        ? "Serper response did not include organic results."
        : "",
  };
}

function buildFailedSerp(error?: unknown): NormalizedSerp {
  return {
    fetchedAt: new Date().toISOString(),
    topResults: [],
    peopleAlsoAsk: [],
    relatedSearches: [],
    missingSerp: true,
    organicResultsMissing: true,
    notes:
      error instanceof Error
        ? `Serper request failed: ${error.message}`
        : "Serper request failed.",
  };
}

function parseUrlParts(url: string): {
  host: string;
  rootDomain: string;
  urlPath: string;
} {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, "");

    return {
      host,
      rootDomain: getRootDomain(host),
      urlPath: parsedUrl.pathname,
    };
  } catch {
    return {
      host: "",
      rootDomain: "",
      urlPath: "",
    };
  }
}

function getRootDomain(host: string): string {
  const parts = host.split(".").filter((part) => part.length > 0);
  if (parts.length <= 2) {
    return host;
  }

  const lastTwoParts = parts.slice(-2).join(".");
  if (COMMON_TWO_PART_PUBLIC_SUFFIXES.has(lastTwoParts)) {
    return parts.slice(-3).join(".");
  }

  return lastTwoParts;
}

function hasClearWord(value: string, words: string[]): boolean {
  const normalizedValue = value.toLowerCase();

  return words.some((word) => new RegExp(`\\b${word}\\b`).test(normalizedValue));
}

function hasClearPathSegment(urlPath: string, segments: string[]): boolean {
  const normalizedSegments = urlPath.toLowerCase().split("/").filter(Boolean);

  return normalizedSegments.some((segment) => segments.includes(segment));
}

function inferResultTypeHint({
  title,
  host,
  urlPath,
}: {
  title: string;
  host: string;
  urlPath: string;
}): SerpData["queries"][number]["serp"]["top_results"][number]["result_type_hint"] {
  const haystack = `${title} ${host} ${urlPath}`.toLowerCase();
  const titleAndPath = `${title} ${urlPath}`.toLowerCase();

  if (
    host.startsWith("talk.") ||
    host.startsWith("community.") ||
    host.startsWith("forum.") ||
    host.includes("reddit.com") ||
    host.includes("quora.com") ||
    host.includes("stackoverflow.com") ||
    host.includes("stackexchange.com") ||
    host.includes("facebook.com") ||
    urlPath.includes("/r/") ||
    urlPath.includes("/questions/") ||
    urlPath.includes("/t/") ||
    urlPath.includes("/thread/") ||
    urlPath.includes("/forum/") ||
    urlPath.includes("/forums/") ||
    urlPath.includes("/community/") ||
    urlPath.includes("/groups/")
  ) {
    return "forum_or_ugc";
  }

  if (
    host.includes("youtube.com") ||
    host.includes("youtu.be") ||
    urlPath.includes("/video") ||
    urlPath.includes("/videos")
  ) {
    return "video";
  }

  if (
    host.startsWith("docs.") ||
    urlPath.includes("/docs/") ||
    urlPath.includes("/documentation/") ||
    urlPath.includes("/help/") ||
    urlPath.includes("/support/")
  ) {
    return "docs";
  }

  if (
    urlPath.includes("/blog/") ||
    urlPath.includes("/blogs/") ||
    urlPath.includes("/article/") ||
    urlPath.includes("/articles/")
  ) {
    return "blog_post";
  }

  if (
    haystack.includes("template") ||
    haystack.includes("templates") ||
    haystack.includes("checklist")
  ) {
    return "template";
  }

  if (
    hasClearWord(titleAndPath, [
      "tool",
      "tools",
      "calculator",
      "calculators",
      "generator",
      "generators",
    ]) ||
    hasClearPathSegment(urlPath, [
      "tool",
      "tools",
      "calculator",
      "calculators",
      "generator",
      "generators",
    ])
  ) {
    return "tool";
  }

  if (
    haystack.includes(" vs ") ||
    haystack.includes("alternatives") ||
    haystack.includes("compare") ||
    haystack.includes("comparison")
  ) {
    return "comparison_page";
  }

  if (
    urlPath.includes("/resources/articles/") ||
    urlPath.includes("/learn/") ||
    urlPath.includes("/guide/") ||
    haystack.includes("blog") ||
    haystack.includes("blogging")
  ) {
    return "blog_post";
  }

  if (urlPath === "" || urlPath === "/") {
    return "homepage";
  }

  return "unknown";
}
