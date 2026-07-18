import { getRequiredEnvVar } from "../config/env.js";
import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import {
  KeywordMetricsSchema,
  type KeywordMetrics,
} from "../types/keywordMetrics.schema.js";
import {
  SeedKeywordsSchema,
  type SeedKeywords,
} from "../types/seedKeywords.schema.js";

const DATAFORSEO_KEYWORD_IDEAS_URL =
  "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live";
const DATAFORSEO_KEYWORD_IDEAS_ENDPOINT =
  "/v3/dataforseo_labs/google/keyword_ideas/live";
const LOCATION_CODE = 2840;
const LANGUAGE_CODE = "en";
const LIMIT_PER_TASK = 100;
const MINIMUM_SEARCH_VOLUME = 1;
const DATAFORSEO_KEYWORD_IDEAS_FILTERS = [
  ["keyword_info.search_volume", ">", 0],
  "and",
  ["keyword_properties.is_another_language", "=", false],
  "and",
  ["keyword_properties.words_count", ">=", 2],
  "and",
  ["serp_info.serp_item_types", "has_not", "local_pack"],
  "and",
  [
    "keyword",
    "not_regex",
    "(^|\\s)(near me|nearby|in my area|open now|opening hours|directions)(\\s|$)",
  ],
  "and",
  ["search_intent_info.main_intent", "<>", "navigational"],
] as const;
const DATAFORSEO_KEYWORD_IDEAS_ORDER_BY = [
  "relevance,desc",
  "keyword_info.search_volume,desc",
] as const;

type Territory = "problem_demand" | "solution_demand";
type SearchIntent =
  | "informational"
  | "navigational"
  | "commercial"
  | "transactional";
type PaidCompetitionLevel = "LOW" | "MEDIUM" | "HIGH";

type DataForSeoResponse = {
  status_code: number;
  status_message: string;
  cost: number;
  task: DataForSeoTask;
};

type DataForSeoTask = {
  id: string;
  tag: Territory;
  status_code: number;
  status_message: string;
  cost: number;
  result: DataForSeoResult[];
};

type DataForSeoResult = {
  total_count: number | null;
  items: DataForSeoItem[];
};

type DataForSeoItem = {
  keyword: string;
  keyword_info: {
    search_volume: number | null;
    monthly_searches: Array<{
      year: number | null;
      month: number | null;
      search_volume: number | null;
    }>;
    search_volume_trend: {
      monthly: number | null;
      quarterly: number | null;
      yearly: number | null;
    } | null;
    cpc: number | null;
    competition: number | null;
    competition_level: string | null;
  } | null;
  keyword_properties: {
    core_keyword: string | null;
    detected_language: string | null;
    keyword_difficulty: number | null;
  } | null;
  search_intent_info: {
    main_intent: string | null;
    foreign_intent: string[];
  } | null;
  avg_backlinks_info: {
    backlinks: number | null;
    referring_domains: number | null;
    main_domain_rank: number | null;
  } | null;
};

type DataForSeoMonthlySearch = NonNullable<
  DataForSeoItem["keyword_info"]
>["monthly_searches"][number];

export async function generateKeywordMetrics(
  seedKeywords: SeedKeywords,
  runId: string,
): Promise<KeywordMetrics> {
  logStep("Starting keyword metrics generation");

  const validatedSeedKeywords = SeedKeywordsSchema.parse(seedKeywords);
  const problemSeeds = getTerritorySeeds(
    validatedSeedKeywords,
    "problem_demand",
  );
  const solutionSeeds = getTerritorySeeds(
    validatedSeedKeywords,
    "solution_demand",
  );

  logInfo(`Problem seed count: ${problemSeeds.length}`);
  logInfo(`Solution seed count: ${solutionSeeds.length}`);
  logInfo("DataForSEO HTTP requests made: 2");
  logInfo("DataForSEO tasks submitted: 2");

  const [problemResponse, solutionResponse] = await Promise.all([
    fetchKeywordIdeasForTerritory("problem_demand", problemSeeds),
    fetchKeywordIdeasForTerritory("solution_demand", solutionSeeds),
  ]);
  const problemTask = problemResponse.task;
  const solutionTask = solutionResponse.task;
  const problemQuerySet = buildQuerySet("problem_demand", problemSeeds, problemTask);
  const solutionQuerySet = buildQuerySet(
    "solution_demand",
    solutionSeeds,
    solutionTask,
  );
  const querySets = [problemQuerySet, solutionQuerySet];
  const allQueries = querySets.flatMap((querySet) => querySet.queries);
  const problemNormalized = new Set(
    problemQuerySet.queries.map((query) => normalize(query.query)),
  );
  const solutionNormalized = new Set(
    solutionQuerySet.queries.map((query) => normalize(query.query)),
  );
  const crossTerritoryDuplicateCount = [...problemNormalized].filter((query) =>
    solutionNormalized.has(query),
  ).length;
  const missingSearchVolumeCount = allQueries.filter(
    (query) => query.metrics.search_volume === null,
  ).length;
  const missingKeywordDifficultyCount = allQueries.filter(
    (query) => query.metrics.keyword_difficulty === null,
  ).length;
  const missingSearchIntentCount = allQueries.filter(
    (query) => query.metrics.search_intent.main === null,
  ).length;
  const missingAverageTop10Count = allQueries.filter(
    (query) => query.metrics.average_top_10 === null,
  ).length;
  const totalCost = problemResponse.cost + solutionResponse.cost;
  const keywordMetrics = KeywordMetricsSchema.parse({
    schema_version: "1.0.0",
    run_id: runId,
    generated_at: new Date().toISOString(),
    source_artifacts: ["seed-keywords.json"],
    status: "complete",
    warnings: [],
    website_url: validatedSeedKeywords.website_url,
    provider: {
      name: "dataforseo",
      endpoint: DATAFORSEO_KEYWORD_IDEAS_ENDPOINT,
      http_requests_made: 2,
      tasks_submitted: 2,
      total_cost_usd: totalCost,
    },
    request_config: {
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      limit_per_task: LIMIT_PER_TASK,
      closely_variants: true,
      ignore_synonyms: false,
      include_serp_info: true,
      include_clickstream_data: false,
      filters: DATAFORSEO_KEYWORD_IDEAS_FILTERS,
      order_by: DATAFORSEO_KEYWORD_IDEAS_ORDER_BY,
      minimum_search_volume: MINIMUM_SEARCH_VOLUME,
    },
    query_sets: querySets,
    summary: {
      problem_queries_received: problemQuerySet.queries.length,
      solution_queries_received: solutionQuerySet.queries.length,
      total_queries_received: allQueries.length,
      unique_queries_received: new Set(
        allQueries.map((query) => normalize(query.query)),
      ).size,
      queries_returned_in_both_sets: crossTerritoryDuplicateCount,
      missing_search_volume_count: missingSearchVolumeCount,
      missing_keyword_difficulty_count: missingKeywordDifficultyCount,
      missing_search_intent_count: missingSearchIntentCount,
      missing_average_top_10_count: missingAverageTop10Count,
    },
  });

  logSuccess("Keyword metrics generation completed");
  logInfo(`Problem queries received: ${problemQuerySet.queries.length}`);
  logInfo(`Solution queries received: ${solutionQuerySet.queries.length}`);
  logInfo(`Total unique queries: ${keywordMetrics.summary.unique_queries_received}`);
  logInfo(
    `Cross-territory duplicate count: ${crossTerritoryDuplicateCount}`,
  );
  logInfo(`Missing search volume count: ${missingSearchVolumeCount}`);
  logInfo(
    `Missing keyword difficulty count: ${missingKeywordDifficultyCount}`,
  );
  logInfo(`Missing search intent count: ${missingSearchIntentCount}`);
  logInfo(`Missing average top 10 count: ${missingAverageTop10Count}`);
  logInfo(`Total DataForSEO cost: ${totalCost}`);

  return keywordMetrics;
}

function getTerritorySeeds(
  seedKeywords: SeedKeywords,
  territory: Territory,
): string[] {
  const demandTerritory = seedKeywords.demand_territories.find(
    (item) => item.territory_id === territory,
  );

  if (demandTerritory === undefined) {
    throw new Error(`Seed keywords artifact is missing ${territory}.`);
  }

  if (demandTerritory.seed_keywords.length !== 6) {
    throw new Error(
      `${territory} must contain exactly six seed keywords; found ${demandTerritory.seed_keywords.length}.`,
    );
  }

  return demandTerritory.seed_keywords.map((seed) => seed.keyword);
}

async function fetchKeywordIdeasForTerritory(
  territory: Territory,
  seeds: string[],
): Promise<DataForSeoResponse> {
  if (seeds.length !== 6) {
    throw new Error(
      `${territory} keyword ideas request requires exactly six seeds; found ${seeds.length}.`,
    );
  }

  logStep(`Fetching DataForSEO keyword ideas for ${territory}`);

  const login = getRequiredEnvVar("DATAFORSEO_LOGIN");
  const password = getRequiredEnvVar("DATAFORSEO_PASSWORD");
  const authorization = Buffer.from(`${login}:${password}`).toString("base64");
  const response = await fetch(DATAFORSEO_KEYWORD_IDEAS_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([buildKeywordIdeasTask(territory, seeds)]),
  });

  if (!response.ok) {
    throw new Error(
      `DataForSEO keyword ideas for ${territory} returned HTTP ${response.status}: ${await response.text()}`,
    );
  }

  return parseDataForSeoResponse(await response.json(), territory);
}

function buildKeywordIdeasTask(territory: Territory, keywords: string[]) {
  return {
    keywords,
    location_code: LOCATION_CODE,
    language_code: LANGUAGE_CODE,
    closely_variants: true,
    ignore_synonyms: false,
    include_serp_info: true,
    include_clickstream_data: false,
    limit: LIMIT_PER_TASK,
    filters: DATAFORSEO_KEYWORD_IDEAS_FILTERS,
    order_by: DATAFORSEO_KEYWORD_IDEAS_ORDER_BY,
    tag: territory,
  };
}

function parseDataForSeoResponse(
  value: unknown,
  requestedTerritory: Territory,
): DataForSeoResponse {
  const root = requireRecord(value, "DataForSEO response root");
  const statusCode = requireNumber(root.status_code, "root status_code");
  const statusMessage = requireString(root.status_message, "root status_message");

  if (statusCode !== 20000) {
    throw new Error(
      `DataForSEO keyword ideas ${requestedTerritory} root status ${statusCode}: ${statusMessage}`,
    );
  }

  const tasks = requireArray(root.tasks, "root tasks");

  if (tasks.length !== 1) {
    throw new Error(
      `DataForSEO keyword ideas ${requestedTerritory} expected exactly one task; found ${tasks.length}.`,
    );
  }

  const task = parseTask(tasks[0], requestedTerritory);

  return {
    status_code: statusCode,
    status_message: statusMessage,
    cost: getNumberOrNull(root.cost) ?? 0,
    task,
  };
}

function parseTask(
  value: unknown,
  requestedTerritory: Territory,
): DataForSeoTask {
  const task = requireRecord(value, "DataForSEO task");
  const taskData = getOptionalRecord(task.data, "task data", (record) => record);
  const tag = requireTerritory(taskData?.tag, "task data tag");
  const statusCode = requireNumber(task.status_code, "task status_code");
  const statusMessage = requireString(task.status_message, "task status_message");

  if (tag !== requestedTerritory) {
    throw new Error(
      `DataForSEO keyword ideas expected ${requestedTerritory} task tag; received ${tag}.`,
    );
  }

  if (statusCode !== 20000) {
    throw new Error(
      `DataForSEO keyword ideas ${tag} task status ${statusCode}: ${statusMessage}`,
    );
  }

  return {
    id: requireString(task.id, "task id"),
    tag,
    status_code: statusCode,
    status_message: statusMessage,
    cost: requireNumber(task.cost, "task cost"),
    result: parseTaskResults(task.result),
  };
}

function parseTaskResults(value: unknown): DataForSeoResult[] {
  const results = requireArray(value, "task result");

  if (results.length === 0) {
    throw new Error("DataForSEO keyword ideas task did not include result.");
  }

  return [parseResult(results[0])];
}

function parseResult(value: unknown): DataForSeoResult {
  const result = requireRecord(value, "DataForSEO result");

  return {
    total_count: getNumberOrNull(result.total_count),
    items: getArrayOrEmpty(result.items).map((item) => parseItem(item)),
  };
}

function parseItem(value: unknown): DataForSeoItem {
  const item = requireRecord(value, "DataForSEO item");

  return {
    keyword: requireString(item.keyword, "item keyword").trim(),
    keyword_info: getOptionalRecord(item.keyword_info, "keyword_info", (record) => ({
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
        core_keyword: getStringOrNull(record.core_keyword),
        detected_language: getStringOrNull(record.detected_language),
        keyword_difficulty: getNumberOrNull(record.keyword_difficulty),
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
      }),
    ),
    avg_backlinks_info: getOptionalRecord(
      item.avg_backlinks_info,
      "avg_backlinks_info",
      (record) => ({
        backlinks: getNumberOrNull(record.backlinks),
        referring_domains: getNumberOrNull(record.referring_domains),
        main_domain_rank: getNumberOrNull(record.main_domain_rank),
      }),
    ),
  };
}

function parseMonthlySearch(value: unknown) {
  const monthlySearch = requireRecord(value, "monthly_searches item");

  return {
    year: getNumberOrNull(monthlySearch.year),
    month: getNumberOrNull(monthlySearch.month),
    search_volume: getNumberOrNull(monthlySearch.search_volume),
  };
}

function buildQuerySet(
  territory: Territory,
  seeds: string[],
  task: DataForSeoTask,
) {
  const result = task.result[0];
  const dedupedItems = dedupeItemsWithinTerritory(result.items);
  const queries = dedupedItems.map((item, index) => ({
    query: item.keyword,
    discovery_rank: index + 1,
    core_keyword: item.keyword_properties?.core_keyword ?? null,
    detected_language: item.keyword_properties?.detected_language ?? null,
    metrics: {
      search_volume: toIntegerOrNull(item.keyword_info?.search_volume ?? null),
      monthly_searches: normalizeMonthlySearches(
        item.keyword_info?.monthly_searches ?? [],
      ),
      search_volume_trend: item.keyword_info?.search_volume_trend ?? null,
      cpc: item.keyword_info?.cpc ?? null,
      paid_competition: item.keyword_info?.competition ?? null,
      paid_competition_level: toPaidCompetitionLevelOrNull(
        item.keyword_info?.competition_level ?? null,
      ),
      keyword_difficulty: toIntegerOrNull(
        item.keyword_properties?.keyword_difficulty ?? null,
      ),
      search_intent: {
        main: toSearchIntentOrNull(
          item.search_intent_info?.main_intent ?? null,
        ),
        secondary: (item.search_intent_info?.foreign_intent ?? [])
          .map((intent) => toSearchIntentOrNull(intent))
          .filter((intent): intent is SearchIntent => intent !== null),
      },
      average_top_10:
        item.avg_backlinks_info === null
          ? null
          : {
              backlinks: item.avg_backlinks_info.backlinks,
              referring_domains: item.avg_backlinks_info.referring_domains,
              main_domain_rank: item.avg_backlinks_info.main_domain_rank,
            },
    },
  }));

  return {
    territory,
    task_tag: territory,
    seeds_used: seeds,
    task_result: {
      task_id: task.id,
      status_code: task.status_code,
      status_message: task.status_message,
      cost_usd: task.cost,
      total_available_results: toIntegerOrNull(result.total_count) ?? 0,
      items_received: queries.length,
    },
    queries,
  };
}

function dedupeItemsWithinTerritory(items: DataForSeoItem[]): DataForSeoItem[] {
  const seenQueries = new Set<string>();
  const dedupedItems: DataForSeoItem[] = [];

  for (const item of items) {
    const normalizedQuery = normalize(item.keyword);

    if (seenQueries.has(normalizedQuery)) {
      continue;
    }

    seenQueries.add(normalizedQuery);
    dedupedItems.push(item);
  }

  return dedupedItems;
}

function normalizeMonthlySearches(
  monthlySearches: DataForSeoMonthlySearch[],
) {
  return monthlySearches
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
    )
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .slice(0, 12);
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
  if (typeof value !== "string" || value.trim().length === 0) {
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

function requireTerritory(value: unknown, label: string): Territory {
  if (value === "problem_demand" || value === "solution_demand") {
    return value;
  }

  throw new Error(`Expected ${label} to be a known demand territory.`);
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

function toIntegerOrNull(value: number | null): number | null {
  return value === null ? null : Math.trunc(value);
}

function toSearchIntentOrNull(value: string | null): SearchIntent | null {
  if (
    value === "informational" ||
    value === "navigational" ||
    value === "commercial" ||
    value === "transactional"
  ) {
    return value;
  }

  return null;
}

function toPaidCompetitionLevelOrNull(
  value: string | null,
): PaidCompetitionLevel | null {
  if (value === "LOW" || value === "MEDIUM" || value === "HIGH") {
    return value;
  }

  return null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
