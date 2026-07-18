import { z } from "zod";

type Intent = "informational" | "commercial" | "transactional" | "navigational";
type Territory = "problem_demand" | "solution_demand";
type Confidence = "high" | "medium" | "low";
type DataStatus = "available" | "no_data";
type PaidCompetitionLevel = "LOW" | "MEDIUM" | "HIGH";

type KeywordMetricQuery = {
  query: string;
  normalized_query: string;
  query_type: string;
  generation_reasoning: string;
  data_status: DataStatus;
  provider_keyword: string | null;
  metrics: KeywordProviderMetrics | null;
};

type KeywordProviderMetrics = {
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
  main_intent: Intent | null;
  foreign_intents: Intent[];
  search_intent_updated_at: string | null;
  cpc_usd: number | null;
  paid_competition: number | null;
  paid_competition_level: PaidCompetitionLevel | null;
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

type KeywordMetricFamily = {
  family_id: string;
  territory: Territory;
  family_name: string;
  search_intent: Intent;
  buyer_stage: string;
  likely_page_type: string;
  product_relevance: Confidence;
  queries: KeywordMetricQuery[];
};

type KeywordMetricsValue = {
  schema_version: "1.0.0";
  run_id: string;
  generated_at: string;
  source_artifacts: ["query-candidates.json"];
  status: "complete";
  warnings: string[];
  website_url: string;
  market: {
    location_code: number;
    location_name: string;
    language_code: string;
  };
  provider: {
    name: "dataforseo";
    endpoint: "/v3/dataforseo_labs/google/keyword_overview/live";
    task_id: string;
    status_code: number;
    status_message: string;
    cost_usd: number;
  };
  query_families: KeywordMetricFamily[];
  summary: {
    submitted_queries: number;
    returned_queries: number;
    no_data_queries: number;
    positive_volume_queries: number;
    zero_volume_queries: number;
    null_volume_queries: number;
    families_with_positive_volume: number;
    provider_cost_usd: number;
  };
};

const intentValues = [
  "informational",
  "commercial",
  "transactional",
  "navigational",
] as const;
const territoryValues = ["problem_demand", "solution_demand"] as const;
const confidenceValues = ["high", "medium", "low"] as const;
const dataStatusValues = ["available", "no_data"] as const;
const paidCompetitionLevelValues = ["LOW", "MEDIUM", "HIGH"] as const;

export const KeywordMetricsSchema = z
  .unknown()
  .superRefine((value, context) => {
    validateKeywordMetrics(value, (message, path) => {
      context.addIssue({
        code: "custom",
        message,
        path,
      });
    });
  }) as z.ZodType<KeywordMetricsValue>;

function validateKeywordMetrics(
  value: unknown,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (!isStrictRecord(value, rootKeys)) {
    addIssue("Keyword metrics root must be a strict object.", []);
    return;
  }

  checkLiteral(value.schema_version, "1.0.0", ["schema_version"], addIssue);
  checkNonEmptyString(value.run_id, ["run_id"], addIssue);
  checkNonEmptyString(value.generated_at, ["generated_at"], addIssue);
  checkLiteralArray(
    value.source_artifacts,
    "query-candidates.json",
    ["source_artifacts"],
    addIssue,
  );
  checkLiteral(value.status, "complete", ["status"], addIssue);
  checkStringArray(value.warnings, ["warnings"], addIssue);
  checkNonEmptyString(value.website_url, ["website_url"], addIssue);
  validateMarket(value.market, addIssue);
  validateProvider(value.provider, addIssue);

  if (
    isRecordRoot(value.provider) &&
    isRecordRoot(value.summary) &&
    value.summary.provider_cost_usd !== value.provider.cost_usd
  ) {
    addIssue("summary.provider_cost_usd must equal provider.cost_usd.", [
      "summary",
      "provider_cost_usd",
    ]);
  }

  if (!Array.isArray(value.query_families)) {
    addIssue("query_families must be an array.", ["query_families"]);
    return;
  }

  if (value.query_families.length !== 6) {
    addIssue(
      `Exactly six query families are required; found ${value.query_families.length}.`,
      ["query_families"],
    );
  }

  for (const [familyIndex, family] of value.query_families.entries()) {
    validateFamily(family, familyIndex, addIssue);
  }

  const families = value.query_families.filter(isFamily);
  const queries = families.flatMap((family) => family.queries);

  if (queries.length !== 60) {
    addIssue(
      `Exactly 60 total queries are required; found ${queries.length}.`,
      ["query_families"],
    );
  }

  const normalizedQueries = queries.map((query) => query.normalized_query);

  if (new Set(normalizedQueries).size !== normalizedQueries.length) {
    addIssue("All 60 normalized query strings must be unique.", [
      "query_families",
    ]);
  }

  validateSummary(value.summary, families, addIssue);
}

const rootKeys = [
  "schema_version",
  "run_id",
  "generated_at",
  "source_artifacts",
  "status",
  "warnings",
  "website_url",
  "market",
  "provider",
  "query_families",
  "summary",
];

function validateMarket(
  value: unknown,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (!isStrictRecord(value, ["location_code", "location_name", "language_code"])) {
    addIssue("market must be a strict object.", ["market"]);
    return;
  }

  checkInteger(value.location_code, ["market", "location_code"], addIssue);
  checkNonEmptyString(value.location_name, ["market", "location_name"], addIssue);
  checkNonEmptyString(value.language_code, ["market", "language_code"], addIssue);
}

function validateProvider(
  value: unknown,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (
    !isStrictRecord(value, [
      "name",
      "endpoint",
      "task_id",
      "status_code",
      "status_message",
      "cost_usd",
    ])
  ) {
    addIssue("provider must be a strict object.", ["provider"]);
    return;
  }

  checkLiteral(value.name, "dataforseo", ["provider", "name"], addIssue);
  checkLiteral(
    value.endpoint,
    "/v3/dataforseo_labs/google/keyword_overview/live",
    ["provider", "endpoint"],
    addIssue,
  );
  checkNonEmptyString(value.task_id, ["provider", "task_id"], addIssue);
  checkInteger(value.status_code, ["provider", "status_code"], addIssue);
  checkNonEmptyString(
    value.status_message,
    ["provider", "status_message"],
    addIssue,
  );
  checkNumberMin(value.cost_usd, 0, ["provider", "cost_usd"], addIssue);
}

function validateFamily(
  value: unknown,
  familyIndex: number,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  const familyPath = ["query_families", familyIndex];

  if (
    !isStrictRecord(value, [
      "family_id",
      "territory",
      "family_name",
      "search_intent",
      "buyer_stage",
      "likely_page_type",
      "product_relevance",
      "queries",
    ])
  ) {
    addIssue("Keyword metric family must be a strict object.", familyPath);
    return;
  }

  checkNonEmptyString(value.family_id, [...familyPath, "family_id"], addIssue);
  checkEnum(value.territory, territoryValues, [...familyPath, "territory"], addIssue);
  checkNonEmptyString(
    value.family_name,
    [...familyPath, "family_name"],
    addIssue,
  );
  checkEnum(
    value.search_intent,
    intentValues,
    [...familyPath, "search_intent"],
    addIssue,
  );
  checkNonEmptyString(
    value.buyer_stage,
    [...familyPath, "buyer_stage"],
    addIssue,
  );
  checkNonEmptyString(
    value.likely_page_type,
    [...familyPath, "likely_page_type"],
    addIssue,
  );
  checkEnum(
    value.product_relevance,
    confidenceValues,
    [...familyPath, "product_relevance"],
    addIssue,
  );

  if (!Array.isArray(value.queries)) {
    addIssue("queries must be an array.", [...familyPath, "queries"]);
    return;
  }

  if (value.queries.length !== 10) {
    addIssue(
      `Each family must contain exactly 10 queries; found ${value.queries.length}.`,
      [...familyPath, "queries"],
    );
  }

  for (const [queryIndex, query] of value.queries.entries()) {
    validateQuery(query, familyIndex, queryIndex, addIssue);
  }
}

function validateQuery(
  value: unknown,
  familyIndex: number,
  queryIndex: number,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  const queryPath = ["query_families", familyIndex, "queries", queryIndex];

  if (
    !isStrictRecord(value, [
      "query",
      "normalized_query",
      "query_type",
      "generation_reasoning",
      "data_status",
      "provider_keyword",
      "metrics",
    ])
  ) {
    addIssue("Keyword metric query must be a strict object.", queryPath);
    return;
  }

  checkNonEmptyString(value.query, [...queryPath, "query"], addIssue);
  checkNonEmptyString(
    value.normalized_query,
    [...queryPath, "normalized_query"],
    addIssue,
  );
  checkNonEmptyString(value.query_type, [...queryPath, "query_type"], addIssue);
  checkNonEmptyString(
    value.generation_reasoning,
    [...queryPath, "generation_reasoning"],
    addIssue,
  );
  checkEnum(value.data_status, dataStatusValues, [...queryPath, "data_status"], addIssue);

  if (value.data_status === "available") {
    if (typeof value.provider_keyword !== "string") {
      addIssue("Available rows must include provider_keyword.", [
        ...queryPath,
        "provider_keyword",
      ]);
    }

    validateMetrics(value.metrics, queryPath, addIssue);
  }

  if (value.data_status === "no_data") {
    if (value.provider_keyword !== null || value.metrics !== null) {
      addIssue(
        "No-data rows must have null provider_keyword and metrics.",
        queryPath,
      );
    }
  }
}

function validateMetrics(
  value: unknown,
  queryPath: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  const metricsPath = [...queryPath, "metrics"];

  if (
    !isStrictRecord(value, [
      "keyword_data_updated_at",
      "search_volume",
      "monthly_searches",
      "search_volume_trend",
      "keyword_difficulty",
      "main_intent",
      "foreign_intents",
      "search_intent_updated_at",
      "cpc_usd",
      "paid_competition",
      "paid_competition_level",
      "core_keyword",
      "detected_language",
      "is_another_language",
      "avg_backlinks_info",
    ])
  ) {
    addIssue("Available rows must include strict metrics.", metricsPath);
    return;
  }

  checkStringOrNull(
    value.keyword_data_updated_at,
    [...metricsPath, "keyword_data_updated_at"],
    addIssue,
  );
  checkIntegerOrNullMin(
    value.search_volume,
    0,
    [...metricsPath, "search_volume"],
    addIssue,
  );
  validateMonthlySearches(value.monthly_searches, metricsPath, addIssue);
  validateTrendOrNull(value.search_volume_trend, metricsPath, addIssue);
  checkIntegerOrNullRange(
    value.keyword_difficulty,
    0,
    100,
    [...metricsPath, "keyword_difficulty"],
    addIssue,
  );
  checkEnumOrNull(value.main_intent, intentValues, [...metricsPath, "main_intent"], addIssue);
  checkEnumArray(value.foreign_intents, intentValues, [...metricsPath, "foreign_intents"], addIssue);
  checkStringOrNull(
    value.search_intent_updated_at,
    [...metricsPath, "search_intent_updated_at"],
    addIssue,
  );
  checkNumberOrNull(value.cpc_usd, [...metricsPath, "cpc_usd"], addIssue);
  checkNumberOrNullRange(
    value.paid_competition,
    0,
    1,
    [...metricsPath, "paid_competition"],
    addIssue,
  );
  checkEnumOrNull(
    value.paid_competition_level,
    paidCompetitionLevelValues,
    [...metricsPath, "paid_competition_level"],
    addIssue,
  );
  checkStringOrNull(value.core_keyword, [...metricsPath, "core_keyword"], addIssue);
  checkStringOrNull(
    value.detected_language,
    [...metricsPath, "detected_language"],
    addIssue,
  );
  checkBooleanOrNull(
    value.is_another_language,
    [...metricsPath, "is_another_language"],
    addIssue,
  );
  validateBacklinksOrNull(value.avg_backlinks_info, metricsPath, addIssue);
}

function validateMonthlySearches(
  value: unknown,
  metricsPath: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (!Array.isArray(value)) {
    addIssue("monthly_searches must be an array.", [
      ...metricsPath,
      "monthly_searches",
    ]);
    return;
  }

  for (const [index, item] of value.entries()) {
    const path = [...metricsPath, "monthly_searches", index];

    if (!isStrictRecord(item, ["year", "month", "search_volume"])) {
      addIssue("monthly_searches items must be strict objects.", path);
      continue;
    }

    checkInteger(item.year, [...path, "year"], addIssue);
    checkIntegerRange(item.month, 1, 12, [...path, "month"], addIssue);
    checkIntegerOrNullMin(
      item.search_volume,
      0,
      [...path, "search_volume"],
      addIssue,
    );
  }
}

function validateTrendOrNull(
  value: unknown,
  metricsPath: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  const path = [...metricsPath, "search_volume_trend"];

  if (value === null) {
    return;
  }

  if (!isStrictRecord(value, ["monthly", "quarterly", "yearly"])) {
    addIssue("search_volume_trend must be null or a strict object.", path);
    return;
  }

  checkNumberOrNull(value.monthly, [...path, "monthly"], addIssue);
  checkNumberOrNull(value.quarterly, [...path, "quarterly"], addIssue);
  checkNumberOrNull(value.yearly, [...path, "yearly"], addIssue);
}

function validateBacklinksOrNull(
  value: unknown,
  metricsPath: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  const path = [...metricsPath, "avg_backlinks_info"];

  if (value === null) {
    return;
  }

  if (
    !isStrictRecord(value, [
      "backlinks",
      "dofollow",
      "referring_pages",
      "referring_domains",
      "referring_main_domains",
      "rank",
      "main_domain_rank",
      "last_updated_at",
    ])
  ) {
    addIssue("avg_backlinks_info must be null or a strict object.", path);
    return;
  }

  for (const key of [
    "backlinks",
    "dofollow",
    "referring_pages",
    "referring_domains",
    "referring_main_domains",
    "rank",
    "main_domain_rank",
  ]) {
    checkNumberOrNull(value[key], [...path, key], addIssue);
  }

  checkStringOrNull(value.last_updated_at, [...path, "last_updated_at"], addIssue);
}

function validateSummary(
  value: unknown,
  families: KeywordMetricFamily[],
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (
    !isStrictRecord(value, [
      "submitted_queries",
      "returned_queries",
      "no_data_queries",
      "positive_volume_queries",
      "zero_volume_queries",
      "null_volume_queries",
      "families_with_positive_volume",
      "provider_cost_usd",
    ])
  ) {
    addIssue("summary must be a strict object.", ["summary"]);
    return;
  }

  const queries = families.flatMap((family) => family.queries);
  const returnedQueries = queries.filter(
    (query) => query.data_status === "available",
  );
  const expected = {
    submitted_queries: queries.length,
    returned_queries: returnedQueries.length,
    no_data_queries: queries.filter((query) => query.data_status === "no_data")
      .length,
    positive_volume_queries: returnedQueries.filter(
      (query) => getSearchVolume(query) !== null && getSearchVolume(query)! > 0,
    ).length,
    zero_volume_queries: returnedQueries.filter(
      (query) => getSearchVolume(query) === 0,
    ).length,
    null_volume_queries: returnedQueries.filter(
      (query) => getSearchVolume(query) === null,
    ).length,
    families_with_positive_volume: families.filter((family) =>
      family.queries.some(
        (query) => getSearchVolume(query) !== null && getSearchVolume(query)! > 0,
      ),
    ).length,
    provider_cost_usd: isRecordRoot(value)
      ? (value.provider_cost_usd as unknown)
      : null,
  };

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = value[key];

    if (actualValue !== expectedValue) {
      addIssue(`Summary ${key} must be ${expectedValue}; found ${actualValue}.`, [
        "summary",
        key,
      ]);
    }
  }
}

function isFamily(value: unknown): value is KeywordMetricFamily {
  return (
    isRecordRoot(value) &&
    typeof value.family_id === "string" &&
    Array.isArray(value.queries)
  );
}

function getSearchVolume(query: KeywordMetricQuery): number | null {
  return query.metrics?.search_volume ?? null;
}

function isStrictRecord(
  value: unknown,
  keys: string[],
): value is Record<string, unknown> {
  return (
    isRecordRoot(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => key in value)
  );
}

function isRecordRoot(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkLiteral(
  value: unknown,
  expected: string,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (value !== expected) {
    addIssue(`Expected ${path.join(".")} to be ${expected}.`, path);
  }
}

function checkLiteralArray(
  value: unknown,
  expected: string,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (!Array.isArray(value) || value.length !== 1 || value[0] !== expected) {
    addIssue(`Expected ${path.join(".")} to contain only ${expected}.`, path);
  }
}

function checkStringArray(
  value: unknown,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    addIssue(`Expected ${path.join(".")} to be a string array.`, path);
  }
}

function checkNonEmptyString(
  value: unknown,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (typeof value !== "string" || value.length === 0) {
    addIssue(`Expected ${path.join(".")} to be a non-empty string.`, path);
  }
}

function checkStringOrNull(
  value: unknown,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (typeof value !== "string" && value !== null) {
    addIssue(`Expected ${path.join(".")} to be a string or null.`, path);
  }
}

function checkBooleanOrNull(
  value: unknown,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (typeof value !== "boolean" && value !== null) {
    addIssue(`Expected ${path.join(".")} to be a boolean or null.`, path);
  }
}

function checkEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (typeof value !== "string" || !allowed.includes(value)) {
    addIssue(`Expected ${path.join(".")} to be one of ${allowed.join(", ")}.`, path);
  }
}

function checkEnumOrNull<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (value !== null) {
    checkEnum(value, allowed, path, addIssue);
  }
}

function checkEnumArray<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (!Array.isArray(value)) {
    addIssue(`Expected ${path.join(".")} to be an array.`, path);
    return;
  }

  for (const [index, item] of value.entries()) {
    checkEnum(item, allowed, [...path, index], addIssue);
  }
}

function checkInteger(
  value: unknown,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    addIssue(`Expected ${path.join(".")} to be an integer.`, path);
  }
}

function checkIntegerRange(
  value: unknown,
  min: number,
  max: number,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    addIssue(`Expected ${path.join(".")} to be an integer from ${min} to ${max}.`, path);
  }
}

function checkIntegerOrNullMin(
  value: unknown,
  min: number,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (
    value !== null &&
    (typeof value !== "number" || !Number.isInteger(value) || value < min)
  ) {
    addIssue(`Expected ${path.join(".")} to be null or an integer >= ${min}.`, path);
  }
}

function checkIntegerOrNullRange(
  value: unknown,
  min: number,
  max: number,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (value !== null) {
    checkIntegerRange(value, min, max, path, addIssue);
  }
}

function checkNumberMin(
  value: unknown,
  min: number,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (typeof value !== "number" || value < min) {
    addIssue(`Expected ${path.join(".")} to be a number >= ${min}.`, path);
  }
}

function checkNumberOrNull(
  value: unknown,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (typeof value !== "number" && value !== null) {
    addIssue(`Expected ${path.join(".")} to be a number or null.`, path);
  }
}

function checkNumberOrNullRange(
  value: unknown,
  min: number,
  max: number,
  path: Array<string | number>,
  addIssue: (message: string, path: Array<string | number>) => void,
): void {
  if (
    value !== null &&
    (typeof value !== "number" || value < min || value > max)
  ) {
    addIssue(`Expected ${path.join(".")} to be null or a number from ${min} to ${max}.`, path);
  }
}

export type KeywordMetrics = z.infer<typeof KeywordMetricsSchema>;
