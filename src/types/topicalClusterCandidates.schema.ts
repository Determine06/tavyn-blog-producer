import { z } from "zod";

const ConfidenceSchema = z.enum(["high", "medium", "low"]);
const SearchIntentSchema = z.enum([
  "informational",
  "commercial",
  "transactional",
  "navigational",
]);
const FunnelStageSchema = z.enum(["top", "middle", "bottom"]);

const EvidenceSchema = z
  .object({
    source_field: z.string(),
    evidence_text: z.string(),
    reasoning: z.string(),
  })
  .strict();

const ClusterPageSchema = z
  .object({
    page_title: z.string(),
    primary_query: z.string(),
    search_intent: SearchIntentSchema,
    funnel_stage: FunnelStageSchema,
    reader_problem: z.string(),
    page_angle: z.string(),
    connection_to_product: z.string(),
    confidence: ConfidenceSchema,
    evidence: z.array(EvidenceSchema),
  })
  .strict();

const PillarPageSchema = z
  .object({
    page_title: z.string(),
    primary_query: z.string(),
    search_intent: SearchIntentSchema,
    funnel_stage: FunnelStageSchema,
    page_angle: z.string(),
    reader_problem: z.string(),
    connection_to_product: z.string(),
    confidence: ConfidenceSchema,
    evidence: z.array(EvidenceSchema),
  })
  .strict();

export const TopicalClusterCandidatesSchema = z
  .object({
    schema_version: z.string(),
    website_url: z.string(),
    generated_at: z.string(),
    source_profile: z
      .object({
        schema_version: z.string(),
        generated_at: z.string(),
        company_name: z.string(),
        product_category: z.string(),
        primary_icp: z.string(),
      })
      .strict(),
    topical_clusters: z.array(
      z
        .object({
          cluster_name: z.string(),
          cluster_summary: z.string(),
          topical_authority_thesis: z.string(),
          target_audience: z.string(),
          primary_buyer_pain: z.string(),
          related_product_capabilities: z.array(z.string()),
          positioning_connection: z.string(),
          confidence: ConfidenceSchema,
          evidence: z.array(EvidenceSchema),
          pillar_page: PillarPageSchema,
          subpages: z.array(ClusterPageSchema),
          risks_or_assumptions: z.array(z.string()),
        })
        .strict(),
    ),
    generation_quality: z
      .object({
        overall_confidence: ConfidenceSchema,
        missing_information: z.array(z.string()),
        potential_risks: z.array(z.string()),
        notes: z.string(),
      })
      .strict(),
  })
  .strict();

export type TopicalClusterCandidates = z.infer<
  typeof TopicalClusterCandidatesSchema
>;
