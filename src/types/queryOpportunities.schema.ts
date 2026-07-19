import { z } from "zod";

import { QueryMetricsSchema } from "./keywordMetrics.schema.js";

const NonEmptyStringSchema = z.string().min(1);
const TerritorySchema = z.enum(["problem_demand", "solution_demand"]);

const ScoringMethodSchema = z
  .object({
    name: z.literal("search_demand_times_organic_attainability"),
    version: z.literal("1.1.0"),
    missing_keyword_difficulty_default: z.literal(50),
    volume_normalization: z.literal("log1p_relative_to_territory_max"),
    combination_method: z.literal("multiplicative"),
    formula: z.literal("100 * volume_score * difficulty_score"),
  })
  .strict();

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

const OpportunityQuerySchema = z
  .object({
    rank: z.number().int().min(1).max(10),
    query_id: NonEmptyStringSchema,
    territory: TerritorySchema,
    query: NonEmptyStringSchema,
    validation_reasoning: NonEmptyStringSchema,
    source_seed_keywords: z.array(NonEmptyStringSchema).length(6),
    discovery_rank: z.number().int().positive(),
    core_keyword: z.string().nullable(),
    detected_language: z.string().nullable(),
    metrics: QueryMetricsSchema,
    opportunity_metrics: OpportunityMetricsSchema,
  })
  .strict();

const TerritoryRankingSchema = z
  .object({
    territory: TerritorySchema,
    confirmed_query_count: z.number().int().min(0),
    maximum_search_volume: z.number().int().min(0),
    selected_query_count: z.number().int().min(0).max(10),
    queries: z.array(OpportunityQuerySchema).max(10),
  })
  .strict();

const SummarySchema = z
  .object({
    confirmed_queries_considered: z.number().int().min(0),
    problem_queries_considered: z.number().int().min(0),
    solution_queries_considered: z.number().int().min(0),
    problem_queries_selected: z.number().int().min(0),
    solution_queries_selected: z.number().int().min(0),
    total_queries_selected: z.number().int().min(0),
    missing_keyword_difficulty_selected: z.number().int().min(0),
  })
  .strict();

export const QueryOpportunitiesSchema = z
  .object({
    schema_version: z.literal("1.2.0"),
    run_id: NonEmptyStringSchema,
    generated_at: z.string().datetime(),
    source_artifacts: z.tuple([z.literal("confirmed-queries.json")]),
    status: z.literal("complete"),
    warnings: z.array(NonEmptyStringSchema),
    website_url: NonEmptyStringSchema,
    scoring_method: ScoringMethodSchema,
    territory_rankings: z.array(TerritoryRankingSchema).length(2),
    summary: SummarySchema,
  })
  .strict()
  .superRefine((artifact, context) => {
    const [problemRanking, solutionRanking] = artifact.territory_rankings;

    if (problemRanking?.territory !== "problem_demand") {
      context.addIssue({
        code: "custom",
        message: "The first territory ranking must be problem_demand.",
        path: ["territory_rankings", 0, "territory"],
      });
    }

    if (solutionRanking?.territory !== "solution_demand") {
      context.addIssue({
        code: "custom",
        message: "The second territory ranking must be solution_demand.",
        path: ["territory_rankings", 1, "territory"],
      });
    }

    const seenQueryIds = new Set<string>();

    for (const [rankingIndex, ranking] of artifact.territory_rankings.entries()) {
      if (ranking.selected_query_count !== ranking.queries.length) {
        context.addIssue({
          code: "custom",
          message: "selected_query_count must equal queries.length.",
          path: ["territory_rankings", rankingIndex, "selected_query_count"],
        });
      }

      const expectedSelectedQueryCount = Math.min(
        10,
        ranking.confirmed_query_count,
      );

      if (ranking.selected_query_count !== expectedSelectedQueryCount) {
        context.addIssue({
          code: "custom",
          message:
            "selected_query_count must equal Math.min(10, confirmed_query_count).",
          path: ["territory_rankings", rankingIndex, "selected_query_count"],
        });
      }

      for (const [queryIndex, query] of ranking.queries.entries()) {
        const expectedRank = queryIndex + 1;

        if (query.rank !== expectedRank) {
          context.addIssue({
            code: "custom",
            message: `Query rank must be ${expectedRank}.`,
            path: ["territory_rankings", rankingIndex, "queries", queryIndex, "rank"],
          });
        }

        if (query.territory !== ranking.territory) {
          context.addIssue({
            code: "custom",
            message: "Selected query territory must match parent territory.",
            path: [
              "territory_rankings",
              rankingIndex,
              "queries",
              queryIndex,
              "territory",
            ],
          });
        }

        if (seenQueryIds.has(query.query_id)) {
          context.addIssue({
            code: "custom",
            message: `query_id must be globally unique; found duplicate ${query.query_id}.`,
            path: [
              "territory_rankings",
              rankingIndex,
              "queries",
              queryIndex,
              "query_id",
            ],
          });
        }

        seenQueryIds.add(query.query_id);
      }
    }

    const problemQueriesConsidered =
      problemRanking?.confirmed_query_count ?? 0;
    const solutionQueriesConsidered =
      solutionRanking?.confirmed_query_count ?? 0;
    const problemQueriesSelected = problemRanking?.queries.length ?? 0;
    const solutionQueriesSelected = solutionRanking?.queries.length ?? 0;
    const allSelectedQueries = artifact.territory_rankings.flatMap(
      (ranking) => ranking.queries,
    );
    const missingKeywordDifficultySelected = allSelectedQueries.filter(
      (query) => query.opportunity_metrics.keyword_difficulty_was_imputed,
    ).length;

    const expectedSummary = {
      confirmed_queries_considered:
        problemQueriesConsidered + solutionQueriesConsidered,
      problem_queries_considered: problemQueriesConsidered,
      solution_queries_considered: solutionQueriesConsidered,
      problem_queries_selected: problemQueriesSelected,
      solution_queries_selected: solutionQueriesSelected,
      total_queries_selected: problemQueriesSelected + solutionQueriesSelected,
      missing_keyword_difficulty_selected: missingKeywordDifficultySelected,
    };

    for (const [key, expectedValue] of Object.entries(expectedSummary)) {
      const actualValue =
        artifact.summary[key as keyof typeof artifact.summary];

      if (actualValue !== expectedValue) {
        context.addIssue({
          code: "custom",
          message: `summary.${key} must equal ${expectedValue}; found ${actualValue}.`,
          path: ["summary", key],
        });
      }
    }
  });

export type QueryOpportunities = z.infer<typeof QueryOpportunitiesSchema>;
