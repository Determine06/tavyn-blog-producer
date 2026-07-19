import { z } from "zod";

import { QueryMetricsSchema } from "./keywordMetrics.schema.js";

const NonEmptyStringSchema = z.string().min(1);
const TerritorySchema = z.enum(["problem_demand", "solution_demand"]);
const ConfidenceSchema = z.enum(["high", "medium", "low"]);
const SelectionStatusSchema = z.enum(["fulfilled", "limited", "none"]);

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

    if (totalSelected > 4) {
      context.addIssue({
        code: "custom",
        message: "No more than four queries may be selected.",
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
    maximum_total_recommendations: z.literal(4),
    target_per_territory: z.literal(2),
    minimum_per_nonempty_territory: z.literal(1),
    maximum_per_territory: z.literal(2),
    allow_fewer_than_target: z.literal(true),
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
    source_seed_keywords: z.array(NonEmptyStringSchema).length(6),
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
    target_recommendations: z.literal(2),
    recommendations_selected: z.number().int().min(0).max(2),
    selection_status: SelectionStatusSchema,
    assessment: NonEmptyStringSchema,
    recommendations: z.array(QueryRecommendationSchema).max(2),
  })
  .strict();

const SummarySchema = z
  .object({
    total_candidates_considered: z.number().int().min(0),
    problem_candidates_considered: z.number().int().min(0),
    solution_candidates_considered: z.number().int().min(0),
    target_recommendations: z.literal(4),
    problem_recommendations_selected: z.number().int().min(0).max(2),
    solution_recommendations_selected: z.number().int().min(0).max(2),
    total_recommendations_selected: z.number().int().min(0).max(4),
    target_fulfilled: z.boolean(),
    insufficient_opportunity_territories: z.array(TerritorySchema),
  })
  .strict();

export const QueryRecommendationsSchema = z
  .object({
    schema_version: z.literal("1.1.0"),
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
      const expectedStatus =
        selectedCount === 2
          ? "fulfilled"
          : selectedCount === 1
            ? "limited"
            : "none";

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

      if (territoryRecommendation.selection_status !== expectedStatus) {
        context.addIssue({
          code: "custom",
          message: `selection_status must be ${expectedStatus}.`,
          path: [
            "territory_recommendations",
            territoryIndex,
            "selection_status",
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

      if (
        territoryRecommendation.candidates_available > 0 &&
        territoryRecommendation.recommendations_selected < 1
      ) {
        context.addIssue({
          code: "custom",
          message:
            "A territory with candidates must select at least one recommendation.",
          path: [
            "territory_recommendations",
            territoryIndex,
            "recommendations_selected",
          ],
        });
      }

      if (
        territoryRecommendation.candidates_available === 0 &&
        territoryRecommendation.recommendations_selected !== 0
      ) {
        context.addIssue({
          code: "custom",
          message:
            "A territory with zero candidates must select zero recommendations.",
          path: [
            "territory_recommendations",
            territoryIndex,
            "recommendations_selected",
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
    const insufficientTerritories = artifact.territory_recommendations
      .filter((territory) => territory.recommendations.length < 2)
      .map((territory) => territory.territory);
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
      target_fulfilled: totalSelected === 4,
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

    if (
      artifact.summary.insufficient_opportunity_territories.length !==
        insufficientTerritories.length ||
      artifact.summary.insufficient_opportunity_territories.some(
        (territory, index) => territory !== insufficientTerritories[index],
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "summary.insufficient_opportunity_territories must contain exactly the territories with fewer than two recommendations.",
        path: ["summary", "insufficient_opportunity_territories"],
      });
    }
  });

export type QueryRecommendationDecision = z.infer<
  typeof QueryRecommendationDecisionSchema
>;
export type QueryRecommendations = z.infer<typeof QueryRecommendationsSchema>;
