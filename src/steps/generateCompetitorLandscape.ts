import { getRequiredEnvVar } from "../config/env.js";
import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import {
  ConfirmedQueriesSchema,
  type ConfirmedQueries,
} from "../types/confirmedQueries.schema.js";
import {
  CompetitorLandscapeSchema,
  type CompetitorLandscape,
} from "../types/competitorLandscape.schema.js";

const DATAFORSEO_SERP_COMPETITORS_URL =
  "https://api.dataforseo.com/v3/dataforseo_labs/google/serp_competitors/live";
const DATAFORSEO_SERP_COMPETITORS_ENDPOINT =
  "/v3/dataforseo_labs/google/serp_competitors/live";
const LOCATION_CODE = 2840;
const LANGUAGE_CODE = "en";
const INCLUDE_SUBDOMAINS = true;
const ITEM_TYPES = ["organic"] as const;
const COMPETITOR_LIMIT = 50;
const ORDER_BY = ["rating,desc"] as const;
const PROVIDER_KEYWORD_LIMIT = 200;
const TASK_TAG = "competitor_landscape";
const ESTIMATED_TRAFFIC_DEFINITION =
  "Estimated traffic from the analyzed query set, not total domain-wide organic traffic.";

type ConfirmedQuery = ConfirmedQueries["confirmed_queries"][number];

type NormalizedQueryEntry = {
  normalizedQuery: string;
  records: ConfirmedQuery[];
};

type DataForSeoResponse = {
  cost: number;
  task: DataForSeoTask;
};

type DataForSeoTask = {
  id: string;
  status_code: number;
  status_message: string;
  result: DataForSeoResult;
};

type DataForSeoResult = {
  total_count: number;
  items_count: number;
  items: DataForSeoItem[];
};

type DataForSeoItem = {
  domain: string;
  avg_position: number | null;
  median_position: number | null;
  rating: number | null;
  etv: number | null;
  keywords_count: number;
  visibility: number | null;
  relevant_serp_items: number | null;
  keywords_positions: Record<string, unknown>;
};

type CompetitorInput = {
  item: DataForSeoItem;
  normalizedDomain: string;
};

export async function generateCompetitorLandscape(
  confirmedQueries: ConfirmedQueries,
  runId: string,
): Promise<CompetitorLandscape> {
  logStep("Starting DataForSEO competitor landscape collection");

  const validatedConfirmedQueries =
    ConfirmedQueriesSchema.parse(confirmedQueries);
  const targetDomain = getTargetDomain(validatedConfirmedQueries.website_url);

  if (validatedConfirmedQueries.confirmed_queries.length === 0) {
    throw new Error(
      "Cannot generate competitor landscape because confirmed_queries is empty.",
    );
  }

  const queryPreparation = prepareQueries(
    validatedConfirmedQueries.confirmed_queries,
  );

  if (queryPreparation.uniqueQueries.length > PROVIDER_KEYWORD_LIMIT) {
    throw new Error(
      `Cannot generate competitor landscape because ${queryPreparation.uniqueQueries.length} unique confirmed queries exceeds the DataForSEO limit of ${PROVIDER_KEYWORD_LIMIT}.`,
    );
  }

  logInfo(
    `Confirmed queries received: ${validatedConfirmedQueries.confirmed_queries.length}`,
  );
  logInfo(`Unique queries submitted: ${queryPreparation.uniqueQueries.length}`);
  logInfo(
    `Duplicate query strings removed: ${queryPreparation.duplicateQueriesRemoved}`,
  );
  logInfo("DataForSEO HTTP requests made: 1");
  logInfo("DataForSEO tasks submitted: 1");

  const targetDomainExclusionFilter = buildTargetDomainRegex(targetDomain);
  const response = await fetchCompetitorLandscape(
    queryPreparation.uniqueQueries.map((entry) => entry.normalizedQuery),
    targetDomainExclusionFilter,
  );
  const warnings: string[] = [];

  if (queryPreparation.duplicateQueriesRemoved > 0) {
    warnings.push(
      `${queryPreparation.duplicateQueriesRemoved} duplicate confirmed query string${queryPreparation.duplicateQueriesRemoved === 1 ? "" : "s"} removed before provider submission.`,
    );
  }

  if (response.task.result.items_count < COMPETITOR_LIMIT) {
    warnings.push(
      `DataForSEO returned ${response.task.result.items_count} competitor domain${response.task.result.items_count === 1 ? "" : "s"} instead of ${COMPETITOR_LIMIT}.`,
    );
  }

  const unmatchedProviderKeys = new Set<string>();
  const competitors = normalizeCompetitors(
    response.task.result.items,
    targetDomain,
    queryPreparation.normalizedQueryEntries,
    validatedConfirmedQueries.confirmed_queries,
    unmatchedProviderKeys,
  );

  for (const unmatchedProviderKey of unmatchedProviderKeys) {
    warnings.push(
      `DataForSEO returned an unmatched keyword-position key: ${unmatchedProviderKey}.`,
    );
  }

  const targetDomainExcluded = competitors.every(
    (competitor) =>
      competitor.domain !== targetDomain &&
      !competitor.domain.endsWith(`.${targetDomain}`),
  );

  const competitorLandscape = CompetitorLandscapeSchema.parse({
    schema_version: "1.0.0",
    run_id: runId,
    generated_at: new Date().toISOString(),
    source_artifacts: ["confirmed-queries.json"],
    status: "complete",
    warnings,
    website_url: validatedConfirmedQueries.website_url,
    target_domain: targetDomain,
    provider: {
      name: "dataforseo",
      endpoint: DATAFORSEO_SERP_COMPETITORS_ENDPOINT,
      http_requests_made: 1,
      tasks_submitted: 1,
      task_id: response.task.id,
      task_status_code: response.task.status_code,
      task_status_message: response.task.status_message,
      total_cost_usd: response.cost,
    },
    request_config: {
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      include_subdomains: INCLUDE_SUBDOMAINS,
      item_types: ITEM_TYPES,
      limit: COMPETITOR_LIMIT,
      order_by: ORDER_BY,
      target_domain_exclusion_filter: targetDomainExclusionFilter,
    },
    scope: {
      based_on: "all_validated_queries",
      confirmed_queries_received:
        validatedConfirmedQueries.confirmed_queries.length,
      unique_queries_submitted: queryPreparation.uniqueQueries.length,
      duplicate_queries_removed: queryPreparation.duplicateQueriesRemoved,
      provider_keyword_limit: PROVIDER_KEYWORD_LIMIT,
      estimated_traffic_definition: ESTIMATED_TRAFFIC_DEFINITION,
    },
    summary: {
      total_domains_found: response.task.result.total_count,
      domains_received: response.task.result.items_count,
      competitors_included: competitors.length,
      target_domain_excluded: targetDomainExcluded,
    },
    competitors,
  });

  logInfo(
    `Total domains found: ${competitorLandscape.summary.total_domains_found}`,
  );
  logInfo(`Domains received: ${competitorLandscape.summary.domains_received}`);
  logInfo(
    `Competitors retained: ${competitorLandscape.summary.competitors_included}`,
  );
  logInfo(`Provider cost: ${competitorLandscape.provider.total_cost_usd}`);
  logInfo(`Unmatched keyword-position key count: ${unmatchedProviderKeys.size}`);
  logSuccess("DataForSEO competitor landscape collection completed");

  return competitorLandscape;
}

function getTargetDomain(websiteUrl: string): string {
  return new URL(websiteUrl).hostname
    .replace(/^www\./, "")
    .toLowerCase();
}

function prepareQueries(confirmedQueries: ConfirmedQuery[]) {
  const normalizedQueryEntries = new Map<string, NormalizedQueryEntry>();

  for (const confirmedQuery of confirmedQueries) {
    const normalizedQuery = normalizeQuery(confirmedQuery.query);
    const existingEntry = normalizedQueryEntries.get(normalizedQuery);

    if (existingEntry === undefined) {
      normalizedQueryEntries.set(normalizedQuery, {
        normalizedQuery,
        records: [confirmedQuery],
      });
    } else {
      existingEntry.records.push(confirmedQuery);
    }
  }

  const uniqueQueries = [...normalizedQueryEntries.values()];

  return {
    normalizedQueryEntries,
    uniqueQueries,
    duplicateQueriesRemoved: confirmedQueries.length - uniqueQueries.length,
  };
}

async function fetchCompetitorLandscape(
  keywords: string[],
  targetDomainExclusionFilter: string,
): Promise<DataForSeoResponse> {
  const login = getRequiredEnvVar("DATAFORSEO_LOGIN");
  const password = getRequiredEnvVar("DATAFORSEO_PASSWORD");
  const authorization = Buffer.from(`${login}:${password}`).toString("base64");
  const response = await fetch(DATAFORSEO_SERP_COMPETITORS_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        keywords,
        location_code: LOCATION_CODE,
        language_code: LANGUAGE_CODE,
        include_subdomains: INCLUDE_SUBDOMAINS,
        item_types: ITEM_TYPES,
        limit: COMPETITOR_LIMIT,
        order_by: ORDER_BY,
        filters: ["domain", "not_regex", targetDomainExclusionFilter],
        tag: TASK_TAG,
      },
    ]),
  });

  if (!response.ok) {
    throw new Error(
      `DataForSEO SERP competitors returned HTTP ${response.status}: ${await response.text()}`,
    );
  }

  return parseDataForSeoResponse(await response.json());
}

function parseDataForSeoResponse(value: unknown): DataForSeoResponse {
  const root = requireRecord(value, "DataForSEO response root");
  const statusCode = requireNumber(root.status_code, "root status_code");
  const statusMessage = requireString(root.status_message, "root status_message");

  if (statusCode !== 20000) {
    throw new Error(
      `DataForSEO SERP competitors root status ${statusCode}: ${statusMessage}`,
    );
  }

  const tasks = requireArray(root.tasks, "root tasks");

  if (tasks.length !== 1) {
    throw new Error(
      `DataForSEO SERP competitors expected exactly one task; found ${tasks.length}.`,
    );
  }

  return {
    cost: requireNumber(root.cost, "root cost"),
    task: parseTask(tasks[0]),
  };
}

function parseTask(value: unknown): DataForSeoTask {
  const task = requireRecord(value, "DataForSEO task");
  const taskData = requireRecord(task.data, "task data");
  const tag = requireString(taskData.tag, "task data tag");
  const statusCode = requireNumber(task.status_code, "task status_code");
  const statusMessage = requireString(task.status_message, "task status_message");

  if (tag !== TASK_TAG) {
    throw new Error(
      `DataForSEO SERP competitors expected task tag ${TASK_TAG}; received ${tag}.`,
    );
  }

  if (statusCode !== 20000) {
    throw new Error(
      `DataForSEO SERP competitors task status ${statusCode}: ${statusMessage}`,
    );
  }

  const results = requireArray(task.result, "task result");

  if (results.length !== 1) {
    throw new Error(
      `DataForSEO SERP competitors expected exactly one result; found ${results.length}.`,
    );
  }

  return {
    id: requireString(task.id, "task id"),
    status_code: statusCode,
    status_message: statusMessage,
    result: parseResult(results[0]),
  };
}

function parseResult(value: unknown): DataForSeoResult {
  const result = requireRecord(value, "DataForSEO result");

  return {
    total_count: requireInteger(result.total_count, "result total_count"),
    items_count: requireInteger(result.items_count, "result items_count"),
    items: requireArray(result.items, "result items").map((item) =>
      parseItem(item),
    ),
  };
}

function parseItem(value: unknown): DataForSeoItem {
  const item = requireRecord(value, "DataForSEO item");

  return {
    domain: requireString(item.domain, "item domain"),
    avg_position: getPositiveNumberOrNull(
      item.avg_position,
      "item avg_position",
    ),
    median_position: getPositiveNumberOrNull(
      item.median_position,
      "item median_position",
    ),
    rating: getNonNegativeNumberOrNull(item.rating, "item rating"),
    etv: getNonNegativeNumberOrNull(item.etv, "item etv"),
    keywords_count: requireNonNegativeInteger(
      item.keywords_count,
      "item keywords_count",
    ),
    visibility: getNonNegativeNumberOrNull(
      item.visibility,
      "item visibility",
    ),
    relevant_serp_items: getNonNegativeNumberOrNull(
      item.relevant_serp_items,
      "item relevant_serp_items",
    ),
    keywords_positions: requireRecord(
      item.keywords_positions,
      "item keywords_positions",
    ),
  };
}

function normalizeCompetitors(
  items: DataForSeoItem[],
  targetDomain: string,
  normalizedQueryEntries: Map<string, NormalizedQueryEntry>,
  confirmedQueries: ConfirmedQuery[],
  unmatchedProviderKeys: Set<string>,
): CompetitorLandscape["competitors"] {
  const competitors: CompetitorInput[] = [];
  const seenDomains = new Set<string>();

  for (const item of items) {
    const normalizedDomain = normalizeDomain(item.domain);

    if (
      normalizedDomain === targetDomain ||
      normalizedDomain.endsWith(`.${targetDomain}`) ||
      seenDomains.has(normalizedDomain)
    ) {
      continue;
    }

    seenDomains.add(normalizedDomain);
    competitors.push({ item, normalizedDomain });

    if (competitors.length === COMPETITOR_LIMIT) {
      break;
    }
  }

  return competitors.map(({ item, normalizedDomain }, index) => ({
    competitor_id: `competitor_${normalizedDomain.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    rank: index + 1,
    domain: normalizedDomain,
    average_position: item.avg_position,
    median_position: item.median_position,
    visibility_rating: item.rating,
    visibility_index: item.visibility,
    estimated_traffic_from_analyzed_queries: item.etv,
    keywords_ranked_count: item.keywords_count,
    query_coverage_percentage: roundToTwoDecimals(
      (item.keywords_count / normalizedQueryEntries.size) * 100,
    ),
    relevant_serp_items: item.relevant_serp_items,
    query_positions: normalizeQueryPositions(
      item.keywords_positions,
      normalizedQueryEntries,
      confirmedQueries,
      unmatchedProviderKeys,
    ),
  }));
}

function normalizeQueryPositions(
  keywordsPositions: Record<string, unknown>,
  normalizedQueryEntries: Map<string, NormalizedQueryEntry>,
  confirmedQueries: ConfirmedQuery[],
  unmatchedProviderKeys: Set<string>,
): CompetitorLandscape["competitors"][number]["query_positions"] {
  const queryPositionsById = new Map<
    string,
    CompetitorLandscape["competitors"][number]["query_positions"][number]
  >();

  for (const [providerKey, providerPositions] of Object.entries(
    keywordsPositions,
  )) {
    const normalizedProviderKey = normalizeQuery(providerKey);
    const matchedEntry = normalizedQueryEntries.get(normalizedProviderKey);

    if (matchedEntry === undefined) {
      unmatchedProviderKeys.add(providerKey);
      continue;
    }

    const positions = normalizePositions(providerPositions);

    if (positions.length === 0) {
      continue;
    }

    for (const confirmedQuery of matchedEntry.records) {
      queryPositionsById.set(confirmedQuery.query_id, {
        query_id: confirmedQuery.query_id,
        query: confirmedQuery.query,
        positions,
      });
    }
  }

  return confirmedQueries
    .map((confirmedQuery) => queryPositionsById.get(confirmedQuery.query_id))
    .filter(
      (
        queryPositions,
      ): queryPositions is CompetitorLandscape["competitors"][number]["query_positions"][number] =>
        queryPositions !== undefined,
    );
}

function normalizePositions(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new Error(
      "DataForSEO SERP competitors keywords_positions value must be an array.",
    );
  }

  const positions = value.map((position) =>
    requirePositiveInteger(position, "keywords_positions position"),
  );

  return [...new Set(positions)].sort((first, second) => first - second);
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

function buildTargetDomainRegex(targetDomain: string): string {
  return `(^|\\.)${escapeRegex(targetDomain)}$`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
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

  return value.trim();
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected ${label} to be a finite number.`);
  }

  return value;
}

function requireInteger(value: unknown, label: string): number {
  const number = requireNumber(value, label);

  if (!Number.isInteger(number)) {
    throw new Error(`Expected ${label} to be an integer.`);
  }

  return number;
}

function requirePositiveInteger(value: unknown, label: string): number {
  const number = requireInteger(value, label);

  if (number <= 0) {
    throw new Error(`Expected ${label} to be a positive integer.`);
  }

  return number;
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  const number = requireInteger(value, label);

  if (number < 0) {
    throw new Error(`Expected ${label} to be a non-negative integer.`);
  }

  return number;
}

function getPositiveNumberOrNull(value: unknown, label: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const number = requireNumber(value, label);

  if (number <= 0) {
    throw new Error(`Expected ${label} to be positive or null.`);
  }

  return number;
}

function getNonNegativeNumberOrNull(
  value: unknown,
  label: string,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const number = requireNumber(value, label);

  if (number < 0) {
    throw new Error(`Expected ${label} to be non-negative or null.`);
  }

  return number;
}
