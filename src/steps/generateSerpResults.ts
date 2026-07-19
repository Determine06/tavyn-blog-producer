import { getRequiredEnvVar } from "../config/env.js";
import { logInfo, logStep, logSuccess, logWarn } from "../lib/logger.js";
import {
  QueryRecommendationsSchema,
  type QueryRecommendations,
} from "../types/queryRecommendations.schema.js";
import {
  SerpResultsSchema,
  type SerpResults,
} from "../types/serpResults.schema.js";

const SERPER_ENDPOINT = "https://google.serper.dev/search";
const COUNTRY_CODE = "us";
const LANGUAGE_CODE = "en";
const REQUESTED_RESULTS_PER_QUERY = 10;
const TRUNCATED_ERROR_BODY_LENGTH = 500;

type Recommendation =
  QueryRecommendations["territory_recommendations"][number]["recommendations"][number];

type SerperOrganicResult = {
  position?: unknown;
  title?: unknown;
  link?: unknown;
  snippet?: unknown;
  date?: unknown;
};

type SerperResponse = {
  organic?: unknown;
  credits?: unknown;
};

export async function generateSerpResults(
  queryRecommendations: QueryRecommendations,
  runId: string,
): Promise<SerpResults> {
  logStep("Starting Serper organic SERP collection");

  const validatedQueryRecommendations =
    QueryRecommendationsSchema.parse(queryRecommendations);
  const recommendations = validatedQueryRecommendations.territory_recommendations
    .flatMap((territoryRecommendation) =>
      territoryRecommendation.recommendations.map((recommendation) => ({
        recommendation_id: recommendation.recommendation_id,
        query_id: recommendation.query_id,
        territory: recommendation.territory,
        query: recommendation.query,
      })),
    );

  logInfo(`Recommended query count: ${recommendations.length}`);

  const apiKey = getRequiredEnvVar("SERPER_API_KEY");
  const querySerps = await Promise.all(
    recommendations.map((recommendation) =>
      requestSerperOrganicResults(recommendation, apiKey),
    ),
  );
  const totalOrganicResults = querySerps.reduce(
    (total, querySerp) => total + querySerp.organic_results.length,
    0,
  );
  const queriesWithFewerThanTenResults = querySerps
    .filter(
      (querySerp) =>
        querySerp.organic_results.length < REQUESTED_RESULTS_PER_QUERY,
    )
    .map((querySerp) => querySerp.query_id);
  const warnings = querySerps.flatMap((querySerp) => {
    if (querySerp.organic_results.length >= REQUESTED_RESULTS_PER_QUERY) {
      return [];
    }

    return [
      `${querySerp.query_id} returned ${querySerp.organic_results.length} organic results instead of ${REQUESTED_RESULTS_PER_QUERY}.`,
    ];
  });
  const credits = querySerps.map((querySerp) => querySerp.provider_credits_used);
  const allCreditsReported = credits.every(
    (credit): credit is number => credit !== null,
  );
  const totalCreditsUsed = allCreditsReported
    ? credits.reduce<number>((total, credit) => total + credit, 0)
    : null;

  const serpResults = SerpResultsSchema.parse({
    schema_version: "1.0.0",
    run_id: runId,
    generated_at: new Date().toISOString(),
    source_artifacts: ["query-recommendations.json"],
    status: "complete",
    warnings,
    website_url: validatedQueryRecommendations.website_url,
    provider: {
      name: "serper",
      endpoint: SERPER_ENDPOINT,
      search_engine: "google",
      country_code: COUNTRY_CODE,
      language_code: LANGUAGE_CODE,
      requested_results_per_query: REQUESTED_RESULTS_PER_QUERY,
      http_requests_made: querySerps.length,
      total_credits_used: totalCreditsUsed,
    },
    query_serps: querySerps,
    summary: {
      recommended_queries_received: querySerps.length,
      serp_requests_completed: querySerps.length,
      total_organic_results: totalOrganicResults,
      queries_with_fewer_than_ten_results: queriesWithFewerThanTenResults,
    },
  });

  logInfo(`Total HTTP requests: ${serpResults.provider.http_requests_made}`);
  logInfo(`Total organic results: ${serpResults.summary.total_organic_results}`);
  logInfo(
    `Queries with fewer than ten results: ${serpResults.summary.queries_with_fewer_than_ten_results.length}`,
  );

  if (serpResults.provider.total_credits_used === null) {
    logInfo("Total reported Serper credits: not reported");
  } else {
    logInfo(
      `Total reported Serper credits: ${serpResults.provider.total_credits_used}`,
    );
  }

  logSuccess("Serper organic SERP collection completed");

  return serpResults;
}

async function requestSerperOrganicResults(
  recommendation: Pick<
    Recommendation,
    "recommendation_id" | "query_id" | "territory" | "query"
  >,
  apiKey: string,
): Promise<SerpResults["query_serps"][number]> {
  const requestedAt = new Date().toISOString();

  logInfo(`Requesting Serper results for query ID: ${recommendation.query_id}`);

  const response = await fetch(SERPER_ENDPOINT, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: recommendation.query,
      gl: COUNTRY_CODE,
      hl: LANGUAGE_CODE,
      num: REQUESTED_RESULTS_PER_QUERY,
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text();

    throw new Error(
      `Serper request failed for query_id ${recommendation.query_id}: HTTP ${response.status} ${response.statusText}; response body: ${truncate(responseBody)}`,
    );
  }

  const responseJson = (await response.json()) as SerperResponse;
  const organicResults = normalizeOrganicResults(
    recommendation.query_id,
    responseJson.organic,
  );
  const providerCreditsUsed = normalizeCredits(responseJson.credits);

  logInfo(
    `Organic results received for ${recommendation.query_id}: ${organicResults.length}`,
  );

  if (organicResults.length < REQUESTED_RESULTS_PER_QUERY) {
    logWarn(
      `${recommendation.query_id} returned ${organicResults.length} organic results instead of ${REQUESTED_RESULTS_PER_QUERY}.`,
    );
  }

  return {
    recommendation_id: recommendation.recommendation_id,
    query_id: recommendation.query_id,
    territory: recommendation.territory,
    query: recommendation.query,
    requested_at: requestedAt,
    provider_credits_used: providerCreditsUsed,
    organic_results_received: organicResults.length,
    organic_results: organicResults,
  };
}

function normalizeOrganicResults(
  queryId: string,
  organic: unknown,
): SerpResults["query_serps"][number]["organic_results"] {
  if (!Array.isArray(organic)) {
    return [];
  }

  return organic
    .slice(0, REQUESTED_RESULTS_PER_QUERY)
    .map((result, index) => normalizeOrganicResult(queryId, result, index))
    .sort((first, second) => first.position - second.position);
}

function normalizeOrganicResult(
  queryId: string,
  result: unknown,
  index: number,
): SerpResults["query_serps"][number]["organic_results"][number] {
  const organicResult = result as SerperOrganicResult;
  const title =
    typeof organicResult.title === "string" ? organicResult.title.trim() : "";
  const link =
    typeof organicResult.link === "string" ? organicResult.link.trim() : "";

  if (title.length === 0) {
    throw new Error(
      `Serper organic result for query_id ${queryId} is missing a usable title.`,
    );
  }

  if (link.length === 0) {
    throw new Error(
      `Serper organic result for query_id ${queryId} is missing a usable link.`,
    );
  }

  return {
    position: normalizePosition(organicResult.position, index),
    title,
    url: link,
    domain: deriveDomain(queryId, link),
    snippet:
      typeof organicResult.snippet === "string" ? organicResult.snippet : null,
    date: typeof organicResult.date === "string" ? organicResult.date : null,
  };
}

function normalizePosition(position: unknown, index: number): number {
  return typeof position === "number" &&
    Number.isInteger(position) &&
    position > 0
    ? position
    : index + 1;
}

function deriveDomain(queryId: string, link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    throw new Error(
      `Serper organic result for query_id ${queryId} has an unusable link: ${link}.`,
    );
  }
}

function normalizeCredits(credits: unknown): number | null {
  return typeof credits === "number" && Number.isFinite(credits) && credits >= 0
    ? credits
    : null;
}

function truncate(value: string): string {
  return value.length > TRUNCATED_ERROR_BODY_LENGTH
    ? `${value.slice(0, TRUNCATED_ERROR_BODY_LENGTH)}...`
    : value;
}
