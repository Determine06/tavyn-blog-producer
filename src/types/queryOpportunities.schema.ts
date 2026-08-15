import { z } from "zod";

import { QueryMetricsSchema } from "./keywordMetrics.schema.js";
import {
  OpportunityMetricsSchema,
  OpportunityScoringMethodSchema,
} from "./opportunityScoring.schema.js";

const NonEmptyStringSchema = z.string().min(1);
const TerritorySchema = z.enum(["problem_demand", "solution_demand"]);
const SEEDS_PER_DISCOVERY_GROUP = 6;

const OpportunityQuerySchema = z
  .object({
    rank: z.number().int().min(1).max(10),
    query_id: NonEmptyStringSchema,
    territory: TerritorySchema,
    query: NonEmptyStringSchema,
    validation_reasoning: NonEmptyStringSchema,
    source_seed_keywords: z
      .array(NonEmptyStringSchema)
      .length(SEEDS_PER_DISCOVERY_GROUP),
    discovery_rank: z.number().int().positive(),
    core_keyword: z.string().nullable(),
    detected_language: z.string().nullable(),
    metrics: QueryMetricsSchema,
    opportunity_metrics: OpportunityMetricsSchema,
  })
  .strict();

const AuthoritativeScoredQuerySchema = z
  .object({
    query_id: NonEmptyStringSchema,
    territory: TerritorySchema,
    opportunity_metrics: OpportunityMetricsSchema,
  })
  .strict();

const TerritoryRankingSchema = z
  .object({
    territory: TerritorySchema,
    confirmed_query_count: z.number().int().min(0),
    territory_p95_search_volume: z.number().int().min(0),
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
    total_queries_scored: z.number().int().min(0),
    problem_queries_scored: z.number().int().min(0),
    solution_queries_scored: z.number().int().min(0),
    missing_keyword_difficulty_scored: z.number().int().min(0),
    missing_keyword_difficulty_selected: z.number().int().min(0),
  })
  .strict();

export const QueryOpportunitiesSchema = z
  .object({
    schema_version: z.literal("2.1.0"),
    run_id: NonEmptyStringSchema,
    generated_at: z.string().datetime(),
    source_artifacts: z.tuple([z.literal("confirmed-queries.json")]),
    status: z.literal("complete"),
    warnings: z.array(NonEmptyStringSchema),
    website_url: NonEmptyStringSchema,
    scoring_method: OpportunityScoringMethodSchema,
    all_scored_queries: z.array(AuthoritativeScoredQuerySchema),
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

    const scoredQueriesById = new Map<
      string,
      z.infer<typeof AuthoritativeScoredQuerySchema>
    >();

    for (const [queryIndex, query] of artifact.all_scored_queries.entries()) {
      if (scoredQueriesById.has(query.query_id)) {
        context.addIssue({
          code: "custom",
          message: `all_scored_queries query_id must be unique; found duplicate ${query.query_id}.`,
          path: ["all_scored_queries", queryIndex, "query_id"],
        });
      }

      scoredQueriesById.set(query.query_id, query);
      const ranking =
        query.territory === "problem_demand"
          ? problemRanking
          : solutionRanking;

      if (
        ranking !== undefined &&
        query.opportunity_metrics.territory_p95_search_volume !==
          ranking.territory_p95_search_volume
      ) {
        context.addIssue({
          code: "custom",
          message:
            "all_scored_queries opportunity_metrics.territory_p95_search_volume must match its territory ranking benchmark.",
          path: [
            "all_scored_queries",
            queryIndex,
            "opportunity_metrics",
            "territory_p95_search_volume",
          ],
        });
      }
    }

    const problemQueriesScored = artifact.all_scored_queries.filter(
      (query) => query.territory === "problem_demand",
    ).length;
    const solutionQueriesScored = artifact.all_scored_queries.filter(
      (query) => query.territory === "solution_demand",
    ).length;

    if (
      problemRanking !== undefined &&
      problemRanking.confirmed_query_count !== problemQueriesScored
    ) {
      context.addIssue({
        code: "custom",
        message:
          "problem_demand confirmed_query_count must equal its exhaustive scored-query count.",
        path: ["territory_rankings", 0, "confirmed_query_count"],
      });
    }

    if (
      solutionRanking !== undefined &&
      solutionRanking.confirmed_query_count !== solutionQueriesScored
    ) {
      context.addIssue({
        code: "custom",
        message:
          "solution_demand confirmed_query_count must equal its exhaustive scored-query count.",
        path: ["territory_rankings", 1, "confirmed_query_count"],
      });
    }

    const seenRankedQueryIds = new Set<string>();

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

        if (
          query.opportunity_metrics.territory_p95_search_volume !==
          ranking.territory_p95_search_volume
        ) {
          context.addIssue({
            code: "custom",
            message:
              "opportunity_metrics.territory_p95_search_volume must match the parent territory ranking benchmark.",
            path: [
              "territory_rankings",
              rankingIndex,
              "queries",
              queryIndex,
              "opportunity_metrics",
              "territory_p95_search_volume",
            ],
          });
        }

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

        if (seenRankedQueryIds.has(query.query_id)) {
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

        seenRankedQueryIds.add(query.query_id);
        const authoritativeQuery = scoredQueriesById.get(query.query_id);

        if (authoritativeQuery === undefined) {
          context.addIssue({
            code: "custom",
            message: `Ranked query ${query.query_id} must exist in all_scored_queries.`,
            path: [
              "territory_rankings",
              rankingIndex,
              "queries",
              queryIndex,
              "query_id",
            ],
          });
        } else if (
          authoritativeQuery.territory !== query.territory ||
          !opportunityMetricsEqual(
            authoritativeQuery.opportunity_metrics,
            query.opportunity_metrics,
          )
        ) {
          context.addIssue({
            code: "custom",
            message: `Ranked query ${query.query_id} must match its authoritative scored-query territory and metrics.`,
            path: [
              "territory_rankings",
              rankingIndex,
              "queries",
              queryIndex,
              "opportunity_metrics",
            ],
          });
        }
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
    const missingKeywordDifficultyScored =
      artifact.all_scored_queries.filter(
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
      total_queries_scored: artifact.all_scored_queries.length,
      problem_queries_scored: problemQueriesScored,
      solution_queries_scored: solutionQueriesScored,
      missing_keyword_difficulty_scored: missingKeywordDifficultyScored,
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

function opportunityMetricsEqual(
  first: z.infer<typeof OpportunityMetricsSchema>,
  second: z.infer<typeof OpportunityMetricsSchema>,
): boolean {
  return (
    first.search_volume_used === second.search_volume_used &&
    first.territory_p95_search_volume ===
      second.territory_p95_search_volume &&
    first.demand_score === second.demand_score &&
    first.keyword_difficulty_original ===
      second.keyword_difficulty_original &&
    first.keyword_difficulty_used === second.keyword_difficulty_used &&
    first.keyword_difficulty_was_imputed ===
      second.keyword_difficulty_was_imputed &&
    first.attainability_score === second.attainability_score &&
    first.opportunity_score === second.opportunity_score
  );
}

export type QueryOpportunities = z.infer<typeof QueryOpportunitiesSchema>;
