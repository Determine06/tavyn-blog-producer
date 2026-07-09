import { z } from "zod";

const SearchIntentSchema = z.enum([
  "informational",
  "commercial",
  "transactional",
  "navigational",
]);
const FunnelStageSchema = z.enum(["top", "middle", "bottom"]);
const PageRoleSchema = z.enum(["pillar", "subpage"]);
const CacheStatusSchema = z.enum(["fresh", "cached"]);
const AuthorityTargetTypeSchema = z.literal("root_domain");
const ResultTypeHintSchema = z.enum([
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
  "unknown",
]);

const TopResultSchema = z
  .object({
    position: z.number(),
    title: z.string(),
    url: z.string(),
    host: z.string(),
    root_domain: z.string(),
    authority_target: z.string(),
    authority_target_type: AuthorityTargetTypeSchema,
    result_type_hint: ResultTypeHintSchema,
    url_path: z.string(),
    snippet: z.string(),
  })
  .strict();

const TopResultSummarySchema = z
  .object({
    position: z.number(),
    title: z.string(),
    root_domain: z.string(),
    url_path: z.string(),
    result_type_hint: ResultTypeHintSchema,
    snippet: z.string(),
  })
  .strict();

export const SerpDataSchema = z
  .object({
    schema_version: z.string(),
    website_url: z.string(),
    generated_at: z.string(),
    serp_provider: z.literal("serper"),
    search_settings: z
      .object({
        search_engine: z.literal("google"),
        location_code: z.number(),
        language_code: z.string(),
        country: z.string(),
        result_count_requested: z.number(),
      })
      .strict(),
    source_clusters: z
      .object({
        schema_version: z.string(),
        generated_at: z.string(),
        cluster_count: z.number(),
        query_count: z.number(),
      })
      .strict(),
    queries: z.array(
      z
        .object({
          query_id: z.string(),
          cluster_id: z.string(),
          cluster_name: z.string(),
          page_id: z.string(),
          page_role: PageRoleSchema,
          page_title: z.string(),
          query: z.string(),
          expected_intent_from_cluster: SearchIntentSchema,
          expected_funnel_stage_from_cluster: FunnelStageSchema,
          serp: z
            .object({
              fetched_at: z.string(),
              cache_status: CacheStatusSchema,
              organic_result_count: z.number(),
              top_results: z.array(TopResultSchema),
              people_also_ask: z.array(
                z
                  .object({
                    question: z.string(),
                  })
                  .strict(),
              ),
              related_searches: z.array(z.string()),
            })
            .strict(),
          serp_llm_input: z
            .object({
              top_results_summary: z.array(TopResultSummarySchema),
              paa_questions: z.array(z.string()),
              related_searches: z.array(z.string()),
            })
            .strict(),
          metric_extraction: z
            .object({
              keyword_metric_query: z.string(),
              root_domains_for_authority: z.array(z.string()),
            })
            .strict(),
          quality_control: z
            .object({
              missing_serp: z.boolean(),
              organic_results_missing: z.boolean(),
              notes: z.string(),
            })
            .strict(),
        })
        .strict(),
    ),
    api_batches: z
      .object({
        keyword_metrics: z
          .object({
            provider: z.literal("dataforseo"),
            endpoint: z.literal("keywords_data.google_ads.search_volume.live"),
            queries: z.array(z.string()),
          })
          .strict(),
        authority_metrics: z
          .object({
            provider: z.literal("dataforseo"),
            endpoint: z.literal("backlinks.bulk_ranks.live"),
            targets: z.array(z.string()),
            rank_scale: z.literal("one_hundred"),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export type SerpData = z.infer<typeof SerpDataSchema>;
