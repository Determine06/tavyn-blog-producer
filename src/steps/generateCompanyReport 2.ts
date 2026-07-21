import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import {
  CompanyProfileSchema,
  type CompanyProfile,
} from "../types/companyProfile.schema.js";
import {
  CompanyReportSchema,
  type CompanyReport,
} from "../types/companyReport.schema.js";
import {
  CompetitorLandscapeSchema,
  type CompetitorLandscape,
} from "../types/competitorLandscape.schema.js";
import {
  ConfirmedQueriesSchema,
  type ConfirmedQueries,
} from "../types/confirmedQueries.schema.js";
import {
  ContentRecommendationSchema,
  type ContentRecommendation,
} from "../types/contentRecommendation.schema.js";
import {
  KeywordMetricsSchema,
  type KeywordMetrics,
} from "../types/keywordMetrics.schema.js";
import {
  QueryOpportunitiesSchema,
  type QueryOpportunities,
} from "../types/queryOpportunities.schema.js";
import {
  QueryRecommendationsSchema,
  type QueryRecommendations,
} from "../types/queryRecommendations.schema.js";
import {
  SerpResultsSchema,
  type SerpResults,
} from "../types/serpResults.schema.js";

type ConfirmedQuery = ConfirmedQueries["confirmed_queries"][number];
type OpportunityQuery =
  QueryOpportunities["territory_rankings"][number]["queries"][number];
type QueryRecommendation =
  QueryRecommendations["territory_recommendations"][number]["recommendations"][number];
type QuerySerp = SerpResults["query_serps"][number];
type ContentRecommendationItem =
  ContentRecommendation["content_recommendations"][number];

export function generateCompanyReport(
  companyProfile: CompanyProfile,
  keywordMetrics: KeywordMetrics,
  confirmedQueries: ConfirmedQueries,
  queryOpportunities: QueryOpportunities,
  queryRecommendations: QueryRecommendations,
  serpResults: SerpResults,
  contentRecommendation: ContentRecommendation,
  competitorLandscape: CompetitorLandscape,
  runId: string,
): CompanyReport {
  logStep("Starting deterministic company report assembly");

  const validatedCompanyProfile = CompanyProfileSchema.parse(companyProfile);
  const validatedKeywordMetrics = KeywordMetricsSchema.parse(keywordMetrics);
  const validatedConfirmedQueries =
    ConfirmedQueriesSchema.parse(confirmedQueries);
  const validatedQueryOpportunities =
    QueryOpportunitiesSchema.parse(queryOpportunities);
  const validatedQueryRecommendations =
    QueryRecommendationsSchema.parse(queryRecommendations);
  const validatedSerpResults = SerpResultsSchema.parse(serpResults);
  const validatedContentRecommendation =
    ContentRecommendationSchema.parse(contentRecommendation);
  const validatedCompetitorLandscape =
    CompetitorLandscapeSchema.parse(competitorLandscape);

  validateArtifactCompatibility(
    validatedCompanyProfile,
    validatedKeywordMetrics,
    validatedConfirmedQueries,
    validatedQueryOpportunities,
    validatedQueryRecommendations,
    validatedSerpResults,
    validatedContentRecommendation,
    validatedCompetitorLandscape,
  );

  const generatedAt = new Date().toISOString();
  const companyName =
    validatedCompanyProfile.company_identity.company_name.value;
  const report = CompanyReportSchema.parse({
    schema_version: "1.0.0",
    report_id: `report_${runId}`,
    report_slug: `${slugify(companyName)}-seo-analysis`,
    run_id: runId,
    generated_at: generatedAt,
    status: "complete",
    warnings: uniqueOrdered([
      ...validatedKeywordMetrics.warnings,
      ...validatedConfirmedQueries.warnings,
      ...validatedQueryOpportunities.warnings,
      ...validatedQueryRecommendations.warnings,
      ...validatedSerpResults.warnings,
      ...validatedContentRecommendation.warnings,
      ...validatedCompetitorLandscape.warnings,
    ]),
    website_url: validatedCompanyProfile.website_url,
    search_market: {
      search_engine: validatedSerpResults.provider.search_engine,
      country: "United States",
      location_code: validatedKeywordMetrics.request_config.location_code,
      language_name: "English",
      language_code: validatedKeywordMetrics.request_config.language_code,
      device: "desktop",
    },
    company: {
      name: companyName,
      domain: normalizeDomain(
        validatedCompanyProfile.company_identity.domain,
      ),
      product_summary:
        validatedCompanyProfile.company_identity.one_sentence_description.value,
      product_category:
        validatedCompanyProfile.company_identity.product_category.value,
      product_angle:
        validatedCompanyProfile.differentiation_and_positioning
          .positioning_summary.value,
      primary_icp: {
        name: validatedCompanyProfile.icp_and_audience.primary_icp.value,
        description:
          validatedCompanyProfile.icp_and_audience.primary_icp.description,
      },
      primary_differentiators:
        validatedCompanyProfile.differentiation_and_positioning.primary_differentiators.map(
          (differentiator) => ({
            title: differentiator.differentiator,
            description: differentiator.description,
          }),
        ),
      category_point_of_view:
        validatedCompanyProfile.differentiation_and_positioning
          .category_point_of_view.value,
    },
    analysis_coverage: {
      queries_discovered:
        validatedKeywordMetrics.summary.total_queries_received,
      queries_evaluated:
        validatedConfirmedQueries.summary.total_queries_evaluated,
      queries_validated:
        validatedConfirmedQueries.summary.total_queries_confirmed,
      queries_rejected:
        validatedConfirmedQueries.summary.total_queries_evaluated -
        validatedConfirmedQueries.summary.total_queries_confirmed,
      problem_queries_validated:
        validatedConfirmedQueries.summary.problem_queries_confirmed,
      solution_queries_validated:
        validatedConfirmedQueries.summary.solution_queries_confirmed,
      competitor_queries_analyzed:
        validatedCompetitorLandscape.scope.unique_queries_submitted,
      competitor_domains_found:
        validatedCompetitorLandscape.summary.total_domains_found,
      content_opportunities_scored:
        validatedQueryOpportunities.summary.total_queries_selected,
      content_recommendations_selected:
        validatedContentRecommendation.content_recommendations.length,
      live_serps_analyzed:
        validatedSerpResults.summary.serp_requests_completed,
      ranking_pages_analyzed:
        validatedSerpResults.summary.total_organic_results,
    },
    validated_queries: buildValidatedQueries(validatedConfirmedQueries),
    competitor_landscape: {
      scope: {
        provider: validatedCompetitorLandscape.provider.name,
        based_on: validatedCompetitorLandscape.scope.based_on,
        query_count:
          validatedCompetitorLandscape.scope.unique_queries_submitted,
        include_subdomains:
          validatedCompetitorLandscape.request_config.include_subdomains,
        item_types: validatedCompetitorLandscape.request_config.item_types,
        generated_at: validatedCompetitorLandscape.generated_at,
        provider_cost_usd:
          validatedCompetitorLandscape.provider.total_cost_usd,
        estimated_traffic_definition:
          validatedCompetitorLandscape.scope.estimated_traffic_definition,
      },
      summary: {
        total_domains_found:
          validatedCompetitorLandscape.summary.total_domains_found,
        competitors_included:
          validatedCompetitorLandscape.competitors.length,
        target_domain_excluded:
          validatedCompetitorLandscape.summary.target_domain_excluded,
      },
      competitors: validatedCompetitorLandscape.competitors,
    },
    content_plan: buildContentPlan(
      validatedConfirmedQueries,
      validatedQueryOpportunities,
      validatedQueryRecommendations,
      validatedSerpResults,
      validatedContentRecommendation,
    ),
  });

  logInfo(`Report ID: ${report.report_id}`);
  logInfo(`Report slug: ${report.report_slug}`);
  logInfo(`Company name: ${report.company.name}`);
  logInfo(`Validated query count: ${report.validated_queries.summary.total}`);
  logInfo(
    `Competitor count: ${report.competitor_landscape.summary.competitors_included}`,
  );
  logInfo(
    `Content-plan item count: ${report.content_plan.summary.selected_count}`,
  );
  logInfo(`Live SERP count: ${report.analysis_coverage.live_serps_analyzed}`);
  logInfo(
    `Ranking-page count: ${report.analysis_coverage.ranking_pages_analyzed}`,
  );
  logInfo(`Warning count: ${report.warnings.length}`);
  logSuccess("Deterministic company report assembly completed");

  return report;
}

export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length === 0) {
    throw new Error(`Cannot slugify empty value from "${value}".`);
  }

  return slug;
}

function validateArtifactCompatibility(
  companyProfile: CompanyProfile,
  keywordMetrics: KeywordMetrics,
  confirmedQueries: ConfirmedQueries,
  queryOpportunities: QueryOpportunities,
  queryRecommendations: QueryRecommendations,
  serpResults: SerpResults,
  contentRecommendation: ContentRecommendation,
  competitorLandscape: CompetitorLandscape,
): void {
  const websiteUrls = [
    companyProfile.website_url,
    keywordMetrics.website_url,
    confirmedQueries.website_url,
    queryOpportunities.website_url,
    queryRecommendations.website_url,
    serpResults.website_url,
    contentRecommendation.website_url,
    competitorLandscape.website_url,
  ].map((websiteUrl) => new URL(websiteUrl).toString());
  const firstWebsiteUrl = websiteUrls[0];

  if (websiteUrls.some((websiteUrl) => websiteUrl !== firstWebsiteUrl)) {
    throw new Error(
      `Cannot generate company report because website_url values differ: ${websiteUrls.join(", ")}.`,
    );
  }

  if (keywordMetrics.request_config.location_code !== 2840) {
    throw new Error(
      `Cannot generate company report because keyword metrics location_code is ${keywordMetrics.request_config.location_code}, expected 2840.`,
    );
  }

  if (competitorLandscape.request_config.location_code !== 2840) {
    throw new Error(
      `Cannot generate company report because competitor landscape location_code is ${competitorLandscape.request_config.location_code}, expected 2840.`,
    );
  }

  if (keywordMetrics.request_config.language_code !== "en") {
    throw new Error(
      `Cannot generate company report because keyword metrics language_code is ${keywordMetrics.request_config.language_code}, expected en.`,
    );
  }

  if (competitorLandscape.request_config.language_code !== "en") {
    throw new Error(
      `Cannot generate company report because competitor landscape language_code is ${competitorLandscape.request_config.language_code}, expected en.`,
    );
  }

  if (serpResults.provider.language_code !== "en") {
    throw new Error(
      `Cannot generate company report because Serper language_code is ${serpResults.provider.language_code}, expected en.`,
    );
  }

  if (serpResults.provider.country_code !== "us") {
    throw new Error(
      `Cannot generate company report because Serper country_code is ${serpResults.provider.country_code}, expected us.`,
    );
  }
}

function buildValidatedQueries(confirmedQueries: ConfirmedQueries) {
  const queries = confirmedQueries.confirmed_queries.map((query) => ({
    query_id: query.query_id,
    query: query.query,
    territory: query.territory,
    validation_reasoning: query.validation_reasoning,
    source_seed_keywords: query.source_seed_keywords,
    discovery_rank: query.discovery_rank,
    core_keyword: query.core_keyword,
    detected_language: query.detected_language,
    metrics: query.metrics,
  }));
  const searchVolumes = queries
    .map((query) => query.metrics.search_volume)
    .filter((value): value is number => value !== null);
  const keywordDifficulties = queries
    .map((query) => query.metrics.keyword_difficulty)
    .filter((value): value is number => value !== null);
  const cpcs = queries
    .map((query) => query.metrics.cpc)
    .filter((value): value is number => value !== null);

  return {
    summary: {
      total: queries.length,
      problem_demand: queries.filter(
        (query) => query.territory === "problem_demand",
      ).length,
      solution_demand: queries.filter(
        (query) => query.territory === "solution_demand",
      ).length,
      queries_with_search_volume: searchVolumes.length,
      combined_monthly_search_volume: searchVolumes.reduce(
        (total, value) => total + value,
        0,
      ),
      average_monthly_search_volume: average(searchVolumes),
      median_monthly_search_volume: median(searchVolumes),
      average_keyword_difficulty: average(keywordDifficulties),
      median_keyword_difficulty: median(keywordDifficulties),
      average_cpc: average(cpcs),
    },
    queries,
  };
}

function buildContentPlan(
  confirmedQueries: ConfirmedQueries,
  queryOpportunities: QueryOpportunities,
  queryRecommendations: QueryRecommendations,
  serpResults: SerpResults,
  contentRecommendation: ContentRecommendation,
) {
  const confirmedQueriesById = buildConfirmedQueriesById(confirmedQueries);
  const opportunitiesById = buildOpportunitiesById(queryOpportunities);
  const recommendationsById =
    buildRecommendationsById(queryRecommendations);
  const serpsByRecommendationId = buildSerpsByRecommendationId(serpResults);
  const items = contentRecommendation.content_recommendations.map(
    (contentItem) => {
      const confirmedQuery = requireMapValue(
        confirmedQueriesById,
        contentItem.query_id,
        `confirmed query ${contentItem.query_id}`,
      );
      const opportunity = requireMapValue(
        opportunitiesById,
        contentItem.query_id,
        `query opportunity ${contentItem.query_id}`,
      );
      const recommendation = requireMapValue(
        recommendationsById,
        contentItem.recommendation_id,
        `query recommendation ${contentItem.recommendation_id}`,
      );
      const querySerp = requireMapValue(
        serpsByRecommendationId,
        contentItem.recommendation_id,
        `SERP result ${contentItem.recommendation_id}`,
      );

      validateContentPlanJoins(
        contentItem,
        confirmedQuery,
        opportunity,
        recommendation,
        querySerp,
      );

      return {
        recommendation_id: contentItem.recommendation_id,
        recommendation_rank: contentItem.recommendation_rank,
        query_id: contentItem.query_id,
        territory: contentItem.territory,
        primary_query: contentItem.primary_query,
        selection_reasoning: recommendation.selection_reasoning,
        content_angle:
          contentItem.editorial_recommendation.content_angle,
        product_connection:
          contentItem.editorial_recommendation.product_connection,
        confidence: contentItem.editorial_recommendation.confidence,
        source_seed_keywords: confirmedQuery.source_seed_keywords,
        discovery_rank: confirmedQuery.discovery_rank,
        core_keyword: confirmedQuery.core_keyword,
        detected_language: confirmedQuery.detected_language,
        query_metrics: confirmedQuery.metrics,
        opportunity_metrics: opportunity.opportunity_metrics,
        serp_results: {
          provider: serpResults.provider.name,
          searched_at: querySerp.requested_at,
          results_received: querySerp.organic_results_received,
          ranking_pages: querySerp.organic_results.map((result) => ({
            position: result.position,
            title: result.title,
            url: result.url,
            domain: result.domain,
            snippet: result.snippet,
            published_date: result.date,
          })),
        },
      };
    },
  );

  return {
    summary: {
      selected_count: items.length,
      problem_demand_count: items.filter(
        (item) => item.territory === "problem_demand",
      ).length,
      solution_demand_count: items.filter(
        (item) => item.territory === "solution_demand",
      ).length,
    },
    items,
  };
}

function validateContentPlanJoins(
  contentItem: ContentRecommendationItem,
  confirmedQuery: ConfirmedQuery,
  opportunity: OpportunityQuery,
  recommendation: QueryRecommendation,
  querySerp: QuerySerp,
): void {
  const comparisons = [
    ["confirmed query_id", confirmedQuery.query_id, contentItem.query_id],
    ["opportunity query_id", opportunity.query_id, contentItem.query_id],
    ["recommendation query_id", recommendation.query_id, contentItem.query_id],
    ["SERP query_id", querySerp.query_id, contentItem.query_id],
    [
      "recommendation_id",
      recommendation.recommendation_id,
      contentItem.recommendation_id,
    ],
    ["SERP recommendation_id", querySerp.recommendation_id, contentItem.recommendation_id],
    ["confirmed territory", confirmedQuery.territory, contentItem.territory],
    ["opportunity territory", opportunity.territory, contentItem.territory],
    ["recommendation territory", recommendation.territory, contentItem.territory],
    ["SERP territory", querySerp.territory, contentItem.territory],
    ["confirmed query", confirmedQuery.query, contentItem.primary_query],
    ["opportunity query", opportunity.query, contentItem.primary_query],
    ["recommendation query", recommendation.query, contentItem.primary_query],
    ["SERP query", querySerp.query, contentItem.primary_query],
  ];

  for (const [label, actual, expected] of comparisons) {
    if (actual !== expected) {
      throw new Error(
        `Cannot generate company report because ${label} mismatch for ${contentItem.recommendation_id}: ${actual} !== ${expected}.`,
      );
    }
  }
}

function buildConfirmedQueriesById(
  confirmedQueries: ConfirmedQueries,
): Map<string, ConfirmedQuery> {
  return buildUniqueMap(
    confirmedQueries.confirmed_queries,
    (query) => query.query_id,
    "confirmed query",
  );
}

function buildOpportunitiesById(
  queryOpportunities: QueryOpportunities,
): Map<string, OpportunityQuery> {
  return buildUniqueMap(
    queryOpportunities.territory_rankings.flatMap((ranking) => ranking.queries),
    (query) => query.query_id,
    "query opportunity",
  );
}

function buildRecommendationsById(
  queryRecommendations: QueryRecommendations,
): Map<string, QueryRecommendation> {
  return buildUniqueMap(
    queryRecommendations.territory_recommendations.flatMap(
      (territory) => territory.recommendations,
    ),
    (recommendation) => recommendation.recommendation_id,
    "query recommendation",
  );
}

function buildSerpsByRecommendationId(
  serpResults: SerpResults,
): Map<string, QuerySerp> {
  return buildUniqueMap(
    serpResults.query_serps,
    (querySerp) => querySerp.recommendation_id,
    "SERP result",
  );
}

function buildUniqueMap<T>(
  values: T[],
  getKey: (value: T) => string,
  label: string,
): Map<string, T> {
  const map = new Map<string, T>();

  for (const value of values) {
    const key = getKey(value);

    if (map.has(key)) {
      throw new Error(
        `Cannot generate company report because ${label} key ${key} appears more than once.`,
      );
    }

    map.set(key, value);
  }

  return map;
}

function requireMapValue<T>(map: Map<string, T>, key: string, label: string): T {
  const value = map.get(key);

  if (value === undefined) {
    throw new Error(`Cannot generate company report because missing ${label}.`);
  }

  return value;
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, "");
}

function uniqueOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      uniqueValues.push(value);
    }
  }

  return uniqueValues;
}

function average(values: number[]): number | null {
  return values.length === 0
    ? null
    : roundToTwoDecimals(
        values.reduce((total, value) => total + value, 0) / values.length,
      );
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((first, second) => first - second);
  const midpoint = Math.floor(sortedValues.length / 2);
  const medianValue =
    sortedValues.length % 2 === 0
      ? ((sortedValues[midpoint - 1] ?? 0) + (sortedValues[midpoint] ?? 0)) / 2
      : sortedValues[midpoint] ?? 0;

  return roundToTwoDecimals(medianValue);
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
