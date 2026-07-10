import { z } from "zod";

const PageRoleSchema = z.enum(["pillar", "subpage"]);
const PageTypeSchema = z.enum([
  "blog_post",
  "landing_page",
  "comparison_page",
  "directory",
  "forum_or_ugc",
  "video",
  "docs",
  "template",
  "tool",
  "homepage",
  "mixed",
  "unknown",
]);
const StandalonePageFitSchema = z.enum([
  "strong",
  "medium",
  "weak",
  "poor",
  "unknown",
]);
const QueryFitRecommendationSchema = z.enum([
  "keep",
  "merge",
  "reject",
  "needs_review",
]);
const ConfidenceSchema = z.enum(["low", "medium", "high"]);
const NullableMetricSchema = z.number().nullable();

export const QueryAnalysisSchema = z
  .object({
    query: z.string(),
    source_page: z
      .object({
        cluster_name: z.string(),
        page_title: z.string(),
        page_role: PageRoleSchema,
      })
      .strict(),
    metrics: z
      .object({
        search_volume: NullableMetricSchema,
        cpc: NullableMetricSchema,
        avg_authority: NullableMetricSchema,
        median_authority: NullableMetricSchema,
        lowest_authority: NullableMetricSchema,
      })
      .strict(),
    serp_shape: z
      .object({
        top_3_dominant_page_type: PageTypeSchema,
        top_5_dominant_page_type: PageTypeSchema,
        serp_features: z
          .object({
            people_also_ask_present: z.boolean(),
            related_searches_present: z.boolean(),
            video_result_present: z.boolean(),
            forum_result_present: z.boolean(),
            docs_result_present: z.boolean(),
            homepage_result_present: z.boolean(),
            mixed_page_types: z.boolean(),
          })
          .strict(),
      })
      .strict(),
    llm_analysis: z
      .object({
        standalone_page_fit: z
          .object({
            value: StandalonePageFitSchema,
            confidence: ConfidenceSchema,
            reasoning: z.string(),
          })
          .strict(),
        angle_to_win: z
          .object({
            value: z.string(),
            confidence: ConfidenceSchema,
            reasoning: z.string(),
          })
          .strict(),
        query_fit: z
          .object({
            recommendation: QueryFitRecommendationSchema,
            confidence: ConfidenceSchema,
            reasoning: z.string(),
          })
          .strict(),
      })
      .strict(),
    notes: z
      .object({
        serp_evidence: z.string(),
        risk: z.string(),
      })
      .strict(),
  })
  .strict();

export type QueryAnalysis = z.infer<typeof QueryAnalysisSchema>;
