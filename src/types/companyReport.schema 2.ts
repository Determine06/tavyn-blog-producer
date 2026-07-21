import { z } from "zod";

import { QueryMetricsSchema } from "./keywordMetrics.schema.js";

const NonEmptyStringSchema = z.string().min(1);
const TerritorySchema = z.enum(["problem_demand", "solution_demand"]);
const ConfidenceSchema = z.enum(["high", "medium", "low"]);

const OpportunityMetricsSchema = z
  .object({
    search_volume_used: z.number().int().min(0),
    maximum_territory_search_volume: z.number().int().min(0),
    volume_score: z.number().min(0).max(1),
    keyword_difficulty_original: z.number().int().min(0).max(100).nullable(),
    keyword_difficulty_used: z.number().int().min(0).max(100),
    keyword_difficulty_was_imputed: z.boolean(),
    difficulty_score: z.number().min(0).max(1),
    opportunity_score: z.number().min(0).max(100),
  })
  .strict();

const SearchMarketSchema = z
  .object({
    search_engine: z.literal("google"),
    country: z.literal("United States"),
    location_code: z.literal(2840),
    language_name: z.literal("English"),
    language_code: z.literal("en"),
    device: z.literal("desktop"),
  })
  .strict();

const CompanySchema = z
  .object({
    name: NonEmptyStringSchema,
    domain: NonEmptyStringSchema,
    product_summary: NonEmptyStringSchema,
    product_category: NonEmptyStringSchema,
    product_angle: NonEmptyStringSchema,
    primary_icp: z
      .object({
        name: NonEmptyStringSchema,
        description: NonEmptyStringSchema,
      })
      .strict(),
    primary_differentiators: z.array(
      z
        .object({
          title: NonEmptyStringSchema,
          description: NonEmptyStringSchema,
        })
        .strict(),
    ),
    category_point_of_view: NonEmptyStringSchema,
  })
  .strict();

const AnalysisCoverageSchema = z
  .object({
    queries_discovered: z.number().int().min(0),
    queries_evaluated: z.number().int().min(0),
    queries_validated: z.number().int().min(0),
    queries_rejected: z.number().int().min(0),
    problem_queries_validated: z.number().int().min(0),
    solution_queries_validated: z.number().int().min(0),
    competitor_queries_analyzed: z.number().int().positive(),
    competitor_domains_found: z.number().int().min(0),
    content_opportunities_scored: z.number().int().min(0),
    content_recommendations_selected: z.number().int().min(0).max(4),
    live_serps_analyzed: z.number().int().min(0),
    ranking_pages_analyzed: z.number().int().min(0),
  })
  .strict();

const ValidatedQuerySchema = z
  .object({
    query_id: NonEmptyStringSchema,
    query: NonEmptyStringSchema,
    territory: TerritorySchema,
    validation_reasoning: NonEmptyStringSchema,
    source_seed_keywords: z.array(NonEmptyStringSchema).length(6),
    discovery_rank: z.number().int().positive(),
    core_keyword: z.string().nullable(),
    detected_language: z.string().nullable(),
    metrics: QueryMetricsSchema,
  })
  .strict();

const ValidatedQueriesSchema = z
  .object({
    summary: z
      .object({
        total: z.number().int().min(0),
        problem_demand: z.number().int().min(0),
        solution_demand: z.number().int().min(0),
        queries_with_search_volume: z.number().int().min(0),
        combined_monthly_search_volume: z.number().int().min(0),
        average_monthly_search_volume: z.number().min(0).nullable(),
        median_monthly_search_volume: z.number().min(0).nullable(),
        average_keyword_difficulty: z.number().min(0).max(100).nullable(),
        median_keyword_difficulty: z.number().min(0).max(100).nullable(),
        average_cpc: z.number().min(0).nullable(),
      })
      .strict(),
    queries: z.array(ValidatedQuerySchema),
  })
  .strict();

const CompetitorQueryPositionsSchema = z
  .object({
    query_id: NonEmptyStringSchema,
    query: NonEmptyStringSchema,
    positions: z.array(z.number().int().positive()).min(1),
  })
  .strict();

const CompetitorSchema = z
  .object({
    competitor_id: NonEmptyStringSchema,
    rank: z.number().int().positive(),
    domain: NonEmptyStringSchema,
    average_position: z.number().positive().nullable(),
    median_position: z.number().positive().nullable(),
    visibility_rating: z.number().min(0).nullable(),
    visibility_index: z.number().min(0).nullable(),
    estimated_traffic_from_analyzed_queries: z.number().min(0).nullable(),
    keywords_ranked_count: z.number().int().min(0),
    query_coverage_percentage: z.number().min(0).max(100),
    relevant_serp_items: z.number().min(0).nullable(),
    query_positions: z.array(CompetitorQueryPositionsSchema),
  })
  .strict();

const CompetitorLandscapeSchema = z
  .object({
    scope: z
      .object({
        provider: z.literal("dataforseo"),
        based_on: z.literal("all_validated_queries"),
        query_count: z.number().int().positive(),
        include_subdomains: z.boolean(),
        item_types: z.tuple([z.literal("organic")]),
        generated_at: z.string().datetime(),
        provider_cost_usd: z.number().min(0),
        estimated_traffic_definition: NonEmptyStringSchema,
      })
      .strict(),
    summary: z
      .object({
        total_domains_found: z.number().int().min(0),
        competitors_included: z.number().int().min(0),
        target_domain_excluded: z.literal(true),
      })
      .strict(),
    competitors: z.array(CompetitorSchema),
  })
  .strict();

const RankingPageSchema = z
  .object({
    position: z.number().int().positive(),
    title: NonEmptyStringSchema,
    url: z.string().url(),
    domain: NonEmptyStringSchema,
    snippet: z.string().nullable(),
    published_date: z.string().nullable(),
  })
  .strict();

const ContentPlanItemSchema = z
  .object({
    recommendation_id: NonEmptyStringSchema,
    recommendation_rank: z.number().int().min(1).max(2),
    query_id: NonEmptyStringSchema,
    territory: TerritorySchema,
    primary_query: NonEmptyStringSchema,
    selection_reasoning: NonEmptyStringSchema,
    content_angle: NonEmptyStringSchema,
    product_connection: NonEmptyStringSchema,
    confidence: ConfidenceSchema,
    source_seed_keywords: z.array(NonEmptyStringSchema).length(6),
    discovery_rank: z.number().int().positive(),
    core_keyword: z.string().nullable(),
    detected_language: z.string().nullable(),
    query_metrics: QueryMetricsSchema,
    opportunity_metrics: OpportunityMetricsSchema,
    serp_results: z
      .object({
        provider: z.literal("serper"),
        searched_at: z.string().datetime(),
        results_received: z.number().int().min(0).max(10),
        ranking_pages: z.array(RankingPageSchema).max(10),
      })
      .strict(),
  })
  .strict();

const ContentPlanSchema = z
  .object({
    summary: z
      .object({
        selected_count: z.number().int().min(2).max(4),
        problem_demand_count: z.number().int().min(0).max(2),
        solution_demand_count: z.number().int().min(0).max(2),
      })
      .strict(),
    items: z.array(ContentPlanItemSchema).min(2).max(4),
  })
  .strict();

const CompanyReportBaseSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    report_id: NonEmptyStringSchema,
    report_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    run_id: NonEmptyStringSchema,
    generated_at: z.string().datetime(),
    status: z.enum(["complete", "partial"]),
    warnings: z.array(NonEmptyStringSchema),
    website_url: z.string().url(),
    search_market: SearchMarketSchema,
    company: CompanySchema,
    analysis_coverage: AnalysisCoverageSchema,
    validated_queries: ValidatedQueriesSchema,
    competitor_landscape: CompetitorLandscapeSchema,
    content_plan: ContentPlanSchema,
  })
  .strict();

type CompanyReportForValidation = z.infer<typeof CompanyReportBaseSchema>;

export const CompanyReportSchema = CompanyReportBaseSchema.superRefine(
  (report, context) => {
    validateValidatedQueries(report, context);
    validateCompetitorLandscape(report, context);
    validateContentPlan(report, context);
    validateAnalysisCoverage(report, context);
  },
);

function validateValidatedQueries(
  report: CompanyReportForValidation,
  context: z.RefinementCtx,
): void {
  const queries = report.validated_queries.queries;
  const problemDemand = queries.filter(
    (query) => query.territory === "problem_demand",
  ).length;
  const solutionDemand = queries.filter(
    (query) => query.territory === "solution_demand",
  ).length;
  const searchVolumes = queries
    .map((query) => query.metrics.search_volume)
    .filter((value): value is number => value !== null);
  const keywordDifficulties = queries
    .map((query) => query.metrics.keyword_difficulty)
    .filter((value): value is number => value !== null);
  const cpcs = queries
    .map((query) => query.metrics.cpc)
    .filter((value): value is number => value !== null);
  const expected = {
    total: queries.length,
    problem_demand: problemDemand,
    solution_demand: solutionDemand,
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
  };

  if (
    problemDemand + solutionDemand !==
    report.validated_queries.summary.total
  ) {
    context.addIssue({
      code: "custom",
      message:
        "validated_queries.problem_demand plus solution_demand must equal total.",
      path: ["validated_queries"],
    });
  }

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue =
      report.validated_queries.summary[key as keyof typeof expected];

    if (actualValue !== expectedValue) {
      context.addIssue({
        code: "custom",
        message: `validated_queries.${key} must equal ${expectedValue}; found ${actualValue}.`,
        path: ["validated_queries", "summary", key],
      });
    }
  }

  const queryIds = new Set<string>();

  for (const [index, query] of queries.entries()) {
    if (queryIds.has(query.query_id)) {
      context.addIssue({
        code: "custom",
        message: `query_id must be unique; found duplicate ${query.query_id}.`,
        path: ["validated_queries", "queries", index, "query_id"],
      });
    }

    queryIds.add(query.query_id);
  }
}

function validateCompetitorLandscape(
  report: CompanyReportForValidation,
  context: z.RefinementCtx,
): void {
  const competitors = report.competitor_landscape.competitors;
  const validQueryIds = new Set(
    report.validated_queries.queries.map((query) => query.query_id),
  );

  if (
    report.competitor_landscape.summary.competitors_included !==
    competitors.length
  ) {
    context.addIssue({
      code: "custom",
      message:
        "competitor_landscape.summary.competitors_included must equal competitors.length.",
      path: ["competitor_landscape", "summary", "competitors_included"],
    });
  }

  const competitorIds = new Set<string>();
  const domains = new Set<string>();

  for (const [index, competitor] of competitors.entries()) {
    const expectedRank = index + 1;

    if (competitor.rank !== expectedRank) {
      context.addIssue({
        code: "custom",
        message: `competitor ranks must be contiguous beginning at 1; expected ${expectedRank}.`,
        path: ["competitor_landscape", "competitors", index, "rank"],
      });
    }

    if (competitorIds.has(competitor.competitor_id)) {
      context.addIssue({
        code: "custom",
        message: `competitor_id must be unique; found duplicate ${competitor.competitor_id}.`,
        path: ["competitor_landscape", "competitors", index, "competitor_id"],
      });
    }

    competitorIds.add(competitor.competitor_id);

    if (domains.has(competitor.domain)) {
      context.addIssue({
        code: "custom",
        message: `domain must be unique; found duplicate ${competitor.domain}.`,
        path: ["competitor_landscape", "competitors", index, "domain"],
      });
    }

    domains.add(competitor.domain);

    for (const [
      queryPositionIndex,
      queryPosition,
    ] of competitor.query_positions.entries()) {
      if (!validQueryIds.has(queryPosition.query_id)) {
        context.addIssue({
          code: "custom",
          message: `competitor query_positions query_id ${queryPosition.query_id} must exist in validated_queries.queries.`,
          path: [
            "competitor_landscape",
            "competitors",
            index,
            "query_positions",
            queryPositionIndex,
            "query_id",
          ],
        });
      }
    }
  }
}

function validateContentPlan(
  report: CompanyReportForValidation,
  context: z.RefinementCtx,
): void {
  const items = report.content_plan.items;
  const problemDemand = items.filter(
    (item) => item.territory === "problem_demand",
  ).length;
  const solutionDemand = items.filter(
    (item) => item.territory === "solution_demand",
  ).length;
  const validQueryIds = new Set(
    report.validated_queries.queries.map((query) => query.query_id),
  );

  if (report.content_plan.summary.selected_count !== items.length) {
    context.addIssue({
      code: "custom",
      message: "content_plan.selected_count must equal items.length.",
      path: ["content_plan", "summary", "selected_count"],
    });
  }

  if (report.content_plan.summary.problem_demand_count !== problemDemand) {
    context.addIssue({
      code: "custom",
      message:
        "content_plan.problem_demand_count must match actual item territories.",
      path: ["content_plan", "summary", "problem_demand_count"],
    });
  }

  if (report.content_plan.summary.solution_demand_count !== solutionDemand) {
    context.addIssue({
      code: "custom",
      message:
        "content_plan.solution_demand_count must match actual item territories.",
      path: ["content_plan", "summary", "solution_demand_count"],
    });
  }

  const recommendationIds = new Set<string>();
  const queryIds = new Set<string>();

  for (const [index, item] of items.entries()) {
    if (!validQueryIds.has(item.query_id)) {
      context.addIssue({
        code: "custom",
        message: `content-plan query_id ${item.query_id} must exist in validated_queries.queries.`,
        path: ["content_plan", "items", index, "query_id"],
      });
    }

    if (recommendationIds.has(item.recommendation_id)) {
      context.addIssue({
        code: "custom",
        message: `recommendation_id must be unique; found duplicate ${item.recommendation_id}.`,
        path: ["content_plan", "items", index, "recommendation_id"],
      });
    }

    recommendationIds.add(item.recommendation_id);

    if (queryIds.has(item.query_id)) {
      context.addIssue({
        code: "custom",
        message: `query_id must be unique in content_plan; found duplicate ${item.query_id}.`,
        path: ["content_plan", "items", index, "query_id"],
      });
    }

    queryIds.add(item.query_id);

    if (
      item.serp_results.results_received !==
      item.serp_results.ranking_pages.length
    ) {
      context.addIssue({
        code: "custom",
        message:
          "serp_results.results_received must equal ranking_pages.length.",
        path: ["content_plan", "items", index, "serp_results"],
      });
    }

    const positions = new Set<number>();

    for (const [
      pageIndex,
      rankingPage,
    ] of item.serp_results.ranking_pages.entries()) {
      if (positions.has(rankingPage.position)) {
        context.addIssue({
          code: "custom",
          message: `ranking-page positions must be unique; found duplicate ${rankingPage.position}.`,
          path: [
            "content_plan",
            "items",
            index,
            "serp_results",
            "ranking_pages",
            pageIndex,
            "position",
          ],
        });
      }

      positions.add(rankingPage.position);
    }
  }
}

function validateAnalysisCoverage(
  report: CompanyReportForValidation,
  context: z.RefinementCtx,
): void {
  const expected = {
    queries_validated: report.validated_queries.summary.total,
    queries_rejected:
      report.analysis_coverage.queries_evaluated -
      report.analysis_coverage.queries_validated,
    problem_queries_validated:
      report.validated_queries.summary.problem_demand,
    solution_queries_validated:
      report.validated_queries.summary.solution_demand,
    competitor_queries_analyzed:
      report.competitor_landscape.scope.query_count,
    competitor_domains_found:
      report.competitor_landscape.summary.total_domains_found,
    content_recommendations_selected: report.content_plan.items.length,
    live_serps_analyzed: report.content_plan.items.length,
    ranking_pages_analyzed: report.content_plan.items.reduce(
      (total, item) => total + item.serp_results.ranking_pages.length,
      0,
    ),
  };

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue =
      report.analysis_coverage[key as keyof typeof expected];

    if (actualValue !== expectedValue) {
      context.addIssue({
        code: "custom",
        message: `analysis_coverage.${key} must equal ${expectedValue}; found ${actualValue}.`,
        path: ["analysis_coverage", key],
      });
    }
  }
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

export type CompanyReport = z.infer<typeof CompanyReportSchema>;
