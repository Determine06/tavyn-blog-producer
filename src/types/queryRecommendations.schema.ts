import { z } from "zod";

import { QueryMetricsSchema } from "./keywordMetrics.schema.js";
import { OpportunityMetricsSchema } from "./opportunityScoring.schema.js";

const NonEmptyStringSchema = z.string().min(1);
const TerritorySchema = z.enum(["problem_demand", "solution_demand"]);
const ConfidenceSchema = z.enum(["high", "medium", "low"]);
const SEEDS_PER_TERRITORY = 15;

const QueryRecommendationDecisionQuerySchema = z
  .object({
    query_id: NonEmptyStringSchema,
    territory: TerritorySchema,
    query: NonEmptyStringSchema,
    selection_reasoning: NonEmptyStringSchema,
    content_angle: NonEmptyStringSchema,
    product_connection: NonEmptyStringSchema,
    confidence: ConfidenceSchema,
  })
  .strict();

const QueryRecommendationTerritoryDecisionSchema = z
  .object({
    territory: TerritorySchema,
    assessment: NonEmptyStringSchema,
    selected_queries: z.array(QueryRecommendationDecisionQuerySchema).max(2),
  })
  .strict();

export const QueryRecommendationDecisionSchema = z
  .object({
    territory_decisions: z
      .array(QueryRecommendationTerritoryDecisionSchema)
      .length(2),
  })
  .strict()
  .superRefine((decision, context) => {
    const [problemDecision, solutionDecision] = decision.territory_decisions;

    if (problemDecision?.territory !== "problem_demand") {
      context.addIssue({
        code: "custom",
        message: "The first territory decision must be problem_demand.",
        path: ["territory_decisions", 0, "territory"],
      });
    }

    if (solutionDecision?.territory !== "solution_demand") {
      context.addIssue({
        code: "custom",
        message: "The second territory decision must be solution_demand.",
        path: ["territory_decisions", 1, "territory"],
      });
    }

    const seenQueryIds = new Set<string>();
    let totalSelected = 0;

    for (const [
      decisionIndex,
      territoryDecision,
    ] of decision.territory_decisions.entries()) {
      totalSelected += territoryDecision.selected_queries.length;

      for (const [
        queryIndex,
        selectedQuery,
      ] of territoryDecision.selected_queries.entries()) {
        if (selectedQuery.territory !== territoryDecision.territory) {
          context.addIssue({
            code: "custom",
            message: "Selected query territory must match parent territory.",
            path: [
              "territory_decisions",
              decisionIndex,
              "selected_queries",
              queryIndex,
              "territory",
            ],
          });
        }

        if (seenQueryIds.has(selectedQuery.query_id)) {
          context.addIssue({
            code: "custom",
            message: `query_id must be globally unique; found duplicate ${selectedQuery.query_id}.`,
            path: [
              "territory_decisions",
              decisionIndex,
              "selected_queries",
              queryIndex,
              "query_id",
            ],
          });
        }

        seenQueryIds.add(selectedQuery.query_id);
      }
    }

    if (problemDecision?.selected_queries.length !== 1) {
      context.addIssue({
        code: "custom",
        message: "problem_demand must select exactly one query.",
        path: ["territory_decisions", 0, "selected_queries"],
      });
    }

    if (solutionDecision?.selected_queries.length !== 2) {
      context.addIssue({
        code: "custom",
        message: "solution_demand must select exactly two queries.",
        path: ["territory_decisions", 1, "selected_queries"],
      });
    }

    if (totalSelected !== 3) {
      context.addIssue({
        code: "custom",
        message: "Exactly three queries must be selected.",
        path: ["territory_decisions"],
      });
    }
  });

const SourceProfileSchema = z
  .object({
    company_name: z.string(),
    product_category: z.string(),
    primary_icp: z.string(),
  })
  .strict();

const SelectionPolicySchema = z
  .object({
    problem_demand_target: z.literal(1),
    solution_demand_target: z.literal(2),
    total_target: z.literal(3),
    require_exact_total: z.literal(true),
    prefer_product_specific_solution: z.literal(true),
    product_specific_fallback: z.literal("best_distinct_solution_demand"),
  })
  .strict();

const QueryRecommendationSchema = z
  .object({
    recommendation_id: NonEmptyStringSchema,
    recommendation_rank: z.number().int().min(1).max(2),
    query_id: NonEmptyStringSchema,
    territory: TerritorySchema,
    query: NonEmptyStringSchema,
    selection_reasoning: NonEmptyStringSchema,
    content_angle: NonEmptyStringSchema,
    product_connection: NonEmptyStringSchema,
    confidence: ConfidenceSchema,
    opportunity_rank: z.number().int().min(1).max(10),
    validation_reasoning: NonEmptyStringSchema,
    source_seed_keywords: z
      .array(NonEmptyStringSchema)
      .length(SEEDS_PER_TERRITORY),
    discovery_rank: z.number().int().positive(),
    core_keyword: z.string().nullable(),
    detected_language: z.string().nullable(),
    metrics: QueryMetricsSchema,
    opportunity_metrics: OpportunityMetricsSchema,
  })
  .strict();

const TerritoryRecommendationsSchema = z
  .object({
    territory: TerritorySchema,
    candidates_available: z.number().int().min(0),
    target_recommendations: z.number().int().min(1).max(2),
    recommendations_selected: z.number().int().min(1).max(2),
    assessment: NonEmptyStringSchema,
    recommendations: z.array(QueryRecommendationSchema).min(1).max(2),
  })
  .strict();

const SummarySchema = z
  .object({
    total_candidates_considered: z.number().int().min(0),
    problem_candidates_considered: z.number().int().min(0),
    solution_candidates_considered: z.number().int().min(0),
    target_recommendations: z.literal(3),
    problem_recommendations_selected: z.literal(1),
    solution_recommendations_selected: z.literal(2),
    total_recommendations_selected: z.literal(3),
    target_fulfilled: z.literal(true),
  })
  .strict();

export const QueryRecommendationsSchema = z
  .object({
    schema_version: z.literal("2.0.0"),
    run_id: NonEmptyStringSchema,
    generated_at: z.string().datetime(),
    source_artifacts: z
      .array(z.enum(["company-profile.json", "query-opportunities.json"]))
      .length(2),
    status: z.literal("complete"),
    warnings: z.array(NonEmptyStringSchema),
    website_url: NonEmptyStringSchema,
    source_profile: SourceProfileSchema,
    selection_policy: SelectionPolicySchema,
    territory_recommendations: z
      .array(TerritoryRecommendationsSchema)
      .length(2),
    summary: SummarySchema,
  })
  .strict()
  .superRefine((artifact, context) => {
    if (
      artifact.source_artifacts[0] !== "company-profile.json" ||
      artifact.source_artifacts[1] !== "query-opportunities.json"
    ) {
      context.addIssue({
        code: "custom",
        message:
          "source_artifacts must be exactly [\"company-profile.json\", \"query-opportunities.json\"].",
        path: ["source_artifacts"],
      });
    }

    const [problemRecommendations, solutionRecommendations] =
      artifact.territory_recommendations;

    if (problemRecommendations?.territory !== "problem_demand") {
      context.addIssue({
        code: "custom",
        message: "The first territory recommendations must be problem_demand.",
        path: ["territory_recommendations", 0, "territory"],
      });
    }

    if (solutionRecommendations?.territory !== "solution_demand") {
      context.addIssue({
        code: "custom",
        message: "The second territory recommendations must be solution_demand.",
        path: ["territory_recommendations", 1, "territory"],
      });
    }

    const seenQueryIds = new Set<string>();

    for (const [
      territoryIndex,
      territoryRecommendation,
    ] of artifact.territory_recommendations.entries()) {
      const selectedCount = territoryRecommendation.recommendations.length;
      const expectedTarget =
        territoryRecommendation.territory === "problem_demand" ? 1 : 2;

      if (territoryRecommendation.recommendations_selected !== selectedCount) {
        context.addIssue({
          code: "custom",
          message: "recommendations_selected must equal recommendations.length.",
          path: [
            "territory_recommendations",
            territoryIndex,
            "recommendations_selected",
          ],
        });
      }

      if (territoryRecommendation.target_recommendations !== expectedTarget) {
        context.addIssue({
          code: "custom",
          message: `target_recommendations must be ${expectedTarget}.`,
          path: [
            "territory_recommendations",
            territoryIndex,
            "target_recommendations",
          ],
        });
      }

      if (
        territoryRecommendation.recommendations.length !== expectedTarget
      ) {
        context.addIssue({
          code: "custom",
          message: `${territoryRecommendation.territory} must contain exactly ${expectedTarget} recommendation${expectedTarget === 1 ? "" : "s"}.`,
          path: [
            "territory_recommendations",
            territoryIndex,
            "recommendations",
          ],
        });
      }

      if (
        territoryRecommendation.candidates_available <
        territoryRecommendation.recommendations_selected
      ) {
        context.addIssue({
          code: "custom",
          message:
            "candidates_available cannot be less than recommendations_selected.",
          path: [
            "territory_recommendations",
            territoryIndex,
            "candidates_available",
          ],
        });
      }

      for (const [
        recommendationIndex,
        recommendation,
      ] of territoryRecommendation.recommendations.entries()) {
        const expectedRank = recommendationIndex + 1;
        const expectedRecommendationId = `${territoryRecommendation.territory}_recommendation_${String(expectedRank).padStart(2, "0")}`;

        if (recommendation.recommendation_rank !== expectedRank) {
          context.addIssue({
            code: "custom",
            message: `recommendation_rank must be ${expectedRank}.`,
            path: [
              "territory_recommendations",
              territoryIndex,
              "recommendations",
              recommendationIndex,
              "recommendation_rank",
            ],
          });
        }

        if (recommendation.recommendation_id !== expectedRecommendationId) {
          context.addIssue({
            code: "custom",
            message: `recommendation_id must be ${expectedRecommendationId}.`,
            path: [
              "territory_recommendations",
              territoryIndex,
              "recommendations",
              recommendationIndex,
              "recommendation_id",
            ],
          });
        }

        if (recommendation.territory !== territoryRecommendation.territory) {
          context.addIssue({
            code: "custom",
            message: "Recommendation territory must match parent territory.",
            path: [
              "territory_recommendations",
              territoryIndex,
              "recommendations",
              recommendationIndex,
              "territory",
            ],
          });
        }

        if (seenQueryIds.has(recommendation.query_id)) {
          context.addIssue({
            code: "custom",
            message: `query_id must be globally unique; found duplicate ${recommendation.query_id}.`,
            path: [
              "territory_recommendations",
              territoryIndex,
              "recommendations",
              recommendationIndex,
              "query_id",
            ],
          });
        }

        seenQueryIds.add(recommendation.query_id);
      }
    }

    const problemSelected = problemRecommendations?.recommendations.length ?? 0;
    const solutionSelected = solutionRecommendations?.recommendations.length ?? 0;
    const totalSelected = problemSelected + solutionSelected;
    const expectedSummary = {
      total_candidates_considered:
        (problemRecommendations?.candidates_available ?? 0) +
        (solutionRecommendations?.candidates_available ?? 0),
      problem_candidates_considered:
        problemRecommendations?.candidates_available ?? 0,
      solution_candidates_considered:
        solutionRecommendations?.candidates_available ?? 0,
      problem_recommendations_selected: problemSelected,
      solution_recommendations_selected: solutionSelected,
      total_recommendations_selected: totalSelected,
      target_fulfilled: true,
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

export type QueryRecommendationDecision = z.infer<
  typeof QueryRecommendationDecisionSchema
>;
export type QueryRecommendations = z.infer<typeof QueryRecommendationsSchema>;
