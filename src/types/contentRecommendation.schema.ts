import { z } from "zod";

const NonEmptyStringSchema = z.string().min(1);

const TerritorySchema = z.enum(["problem_demand", "solution_demand"]);
const DominantIntentSchema = z.enum([
  "informational",
  "commercial",
  "transactional",
  "mixed",
  "unknown",
]);
const DominantPageTypeSchema = z.enum([
  "guide",
  "template",
  "listicle",
  "comparison",
  "category_page",
  "product_page",
  "feature_page",
  "tool",
  "app_listing",
  "community_discussion",
  "video",
  "mixed",
  "unknown",
]);
const SerpConsistencySchema = z.enum([
  "high",
  "medium",
  "low",
  "insufficient",
]);
const RecommendedPageTypeSchema = z.enum([
  "guide",
  "template_guide",
  "listicle",
  "comparison_page",
  "category_guide",
  "product_page",
  "feature_page",
  "interactive_tool",
  "undetermined",
]);
const ConfidenceSchema = z.enum(["high", "medium", "low"]);

const SerpAnalysisSchema = z
  .object({
    dominant_intent: DominantIntentSchema,
    dominant_page_type: DominantPageTypeSchema,
    serp_consistency: SerpConsistencySchema,
    summary: NonEmptyStringSchema,
    recurring_concepts: z.array(NonEmptyStringSchema).max(5),
  })
  .strict();

const EditorialRecommendationSchema = z
  .object({
    recommended_title: NonEmptyStringSchema,
    recommended_page_type: RecommendedPageTypeSchema,
    content_angle: NonEmptyStringSchema,
    product_connection: NonEmptyStringSchema,
    confidence: ConfidenceSchema,
    warnings: z.array(NonEmptyStringSchema),
  })
  .strict();

const ContentRecommendationDecisionAnalysisSchema = z
  .object({
    recommendation_id: NonEmptyStringSchema,
    query_id: NonEmptyStringSchema,
    territory: TerritorySchema,
    query: NonEmptyStringSchema,
    serp_analysis: SerpAnalysisSchema,
    editorial_recommendation: EditorialRecommendationSchema,
  })
  .strict();

export const ContentRecommendationDecisionSchema = z
  .object({
    analyses: z.array(ContentRecommendationDecisionAnalysisSchema).max(4),
  })
  .strict()
  .superRefine((decision, context) => {
    const recommendationIds = new Set<string>();
    const queryIds = new Set<string>();

    for (const [index, analysis] of decision.analyses.entries()) {
      if (recommendationIds.has(analysis.recommendation_id)) {
        context.addIssue({
          code: "custom",
          message: `recommendation_id must be globally unique; found duplicate ${analysis.recommendation_id}.`,
          path: ["analyses", index, "recommendation_id"],
        });
      }

      recommendationIds.add(analysis.recommendation_id);

      if (queryIds.has(analysis.query_id)) {
        context.addIssue({
          code: "custom",
          message: `query_id must be globally unique; found duplicate ${analysis.query_id}.`,
          path: ["analyses", index, "query_id"],
        });
      }

      queryIds.add(analysis.query_id);
    }
  });

const SourceProfileSchema = z
  .object({
    company_name: NonEmptyStringSchema,
    product_category: NonEmptyStringSchema,
    primary_icp: NonEmptyStringSchema,
  })
  .strict();

const ContentRecommendationItemSchema = z
  .object({
    recommendation_id: NonEmptyStringSchema,
    recommendation_rank: z.number().int().min(1).max(2),
    query_id: NonEmptyStringSchema,
    territory: TerritorySchema,
    primary_query: NonEmptyStringSchema,
    serp_analysis: SerpAnalysisSchema,
    editorial_recommendation: EditorialRecommendationSchema,
  })
  .strict();

const SummarySchema = z
  .object({
    recommendations_received: z.number().int().min(0).max(4),
    recommendations_analyzed: z.number().int().min(0).max(4),
    problem_demand_count: z.number().int().min(0).max(2),
    solution_demand_count: z.number().int().min(0).max(2),
    high_confidence_count: z.number().int().min(0).max(4),
    medium_confidence_count: z.number().int().min(0).max(4),
    low_confidence_count: z.number().int().min(0).max(4),
    mixed_intent_count: z.number().int().min(0).max(4),
    insufficient_serp_count: z.number().int().min(0).max(4),
  })
  .strict();

export const ContentRecommendationSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    run_id: NonEmptyStringSchema,
    generated_at: z.string().datetime(),
    source_artifacts: z
      .array(
        z.enum([
          "company-profile.json",
          "query-recommendations.json",
          "serp-results.json",
        ]),
      )
      .length(3),
    status: z.literal("complete"),
    warnings: z.array(NonEmptyStringSchema),
    website_url: NonEmptyStringSchema,
    source_profile: SourceProfileSchema,
    content_recommendations: z.array(ContentRecommendationItemSchema).max(4),
    summary: SummarySchema,
  })
  .strict()
  .superRefine((artifact, context) => {
    const expectedSourceArtifacts = [
      "company-profile.json",
      "query-recommendations.json",
      "serp-results.json",
    ];

    if (
      artifact.source_artifacts.length !== expectedSourceArtifacts.length ||
      artifact.source_artifacts.some(
        (sourceArtifact, index) =>
          sourceArtifact !== expectedSourceArtifacts[index],
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "source_artifacts must be exactly [\"company-profile.json\", \"query-recommendations.json\", \"serp-results.json\"].",
        path: ["source_artifacts"],
      });
    }

    const recommendationIds = new Set<string>();
    const queryIds = new Set<string>();

    for (const [
      index,
      recommendation,
    ] of artifact.content_recommendations.entries()) {
      if (recommendationIds.has(recommendation.recommendation_id)) {
        context.addIssue({
          code: "custom",
          message: `recommendation_id must be globally unique; found duplicate ${recommendation.recommendation_id}.`,
          path: ["content_recommendations", index, "recommendation_id"],
        });
      }

      recommendationIds.add(recommendation.recommendation_id);

      if (queryIds.has(recommendation.query_id)) {
        context.addIssue({
          code: "custom",
          message: `query_id must be globally unique; found duplicate ${recommendation.query_id}.`,
          path: ["content_recommendations", index, "query_id"],
        });
      }

      queryIds.add(recommendation.query_id);

      if (
        recommendation.recommendation_rank < 1 ||
        recommendation.recommendation_rank > 2
      ) {
        context.addIssue({
          code: "custom",
          message: "recommendation_rank must be between 1 and 2.",
          path: ["content_recommendations", index, "recommendation_rank"],
        });
      }
    }

    const problemDemandCount = artifact.content_recommendations.filter(
      (recommendation) => recommendation.territory === "problem_demand",
    ).length;
    const solutionDemandCount = artifact.content_recommendations.filter(
      (recommendation) => recommendation.territory === "solution_demand",
    ).length;
    const highConfidenceCount = artifact.content_recommendations.filter(
      (recommendation) =>
        recommendation.editorial_recommendation.confidence === "high",
    ).length;
    const mediumConfidenceCount = artifact.content_recommendations.filter(
      (recommendation) =>
        recommendation.editorial_recommendation.confidence === "medium",
    ).length;
    const lowConfidenceCount = artifact.content_recommendations.filter(
      (recommendation) =>
        recommendation.editorial_recommendation.confidence === "low",
    ).length;
    const mixedIntentCount = artifact.content_recommendations.filter(
      (recommendation) =>
        recommendation.serp_analysis.dominant_intent === "mixed",
    ).length;
    const insufficientSerpCount = artifact.content_recommendations.filter(
      (recommendation) =>
        recommendation.serp_analysis.serp_consistency === "insufficient",
    ).length;
    const expectedSummary = {
      recommendations_received: artifact.content_recommendations.length,
      recommendations_analyzed: artifact.content_recommendations.length,
      problem_demand_count: problemDemandCount,
      solution_demand_count: solutionDemandCount,
      high_confidence_count: highConfidenceCount,
      medium_confidence_count: mediumConfidenceCount,
      low_confidence_count: lowConfidenceCount,
      mixed_intent_count: mixedIntentCount,
      insufficient_serp_count: insufficientSerpCount,
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

export type ContentRecommendationDecision = z.infer<
  typeof ContentRecommendationDecisionSchema
>;
export type ContentRecommendation = z.infer<
  typeof ContentRecommendationSchema
>;
