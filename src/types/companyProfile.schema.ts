import { z } from "zod";

const ConfidenceSchema = z.enum(["high", "medium", "low"]);

const CapabilityTypeSchema = z.enum([
  "core",
  "supporting",
  "workflow",
  "integration",
  "publishing",
  "analysis",
  "other",
]);

const EvidenceBackedValueSchema = z
  .object({
    value: z.string(),
    confidence: ConfidenceSchema,
    evidence: z.array(z.string()),
  })
  .strict();

const DescribedAudienceSchema = z
  .object({
    value: z.string(),
    description: z.string(),
    confidence: ConfidenceSchema,
    evidence: z.array(z.string()),
  })
  .strict();

const SourcePageSchema = z
  .object({
    url: z.string(),
    title: z.string(),
  })
  .strict();

export const CompanyProfileSchema = z
  .object({
    schema_version: z.string(),
    website_url: z.string(),
    generated_at: z.string(),
    source_pages: z.array(SourcePageSchema),
    company_identity: z
      .object({
        company_name: EvidenceBackedValueSchema,
        domain: z.string(),
        one_sentence_description: EvidenceBackedValueSchema,
        product_category: EvidenceBackedValueSchema,
        business_model: EvidenceBackedValueSchema,
        stage_or_maturity: EvidenceBackedValueSchema,
      })
      .strict(),
    icp_and_audience: z
      .object({
        primary_icp: DescribedAudienceSchema,
        secondary_audiences: z.array(DescribedAudienceSchema),
        audience_notes: EvidenceBackedValueSchema,
      })
      .strict(),
    buyer_pains: z.array(
      z
        .object({
          pain: z.string(),
          description: z.string(),
          audience_segment: z.string(),
          confidence: ConfidenceSchema,
          evidence: z.array(z.string()),
        })
        .strict(),
    ),
    product_capabilities: z.array(
      z
        .object({
          capability: z.string(),
          description: z.string(),
          capability_type: CapabilityTypeSchema,
          confidence: ConfidenceSchema,
          evidence: z.array(z.string()),
        })
        .strict(),
    ),
    differentiation_and_positioning: z
      .object({
        positioning_summary: EvidenceBackedValueSchema,
        primary_differentiators: z.array(
          z
            .object({
              differentiator: z.string(),
              description: z.string(),
              confidence: ConfidenceSchema,
              evidence: z.array(z.string()),
            })
            .strict(),
        ),
        category_point_of_view: EvidenceBackedValueSchema,
        positioning_notes: EvidenceBackedValueSchema,
      })
      .strict(),
    brand_voice_and_communication_style: z
      .object({
        tone: z
          .object({
            values: z.array(z.string()),
            confidence: ConfidenceSchema,
            evidence: z.array(z.string()),
          })
          .strict(),
        writing_style: EvidenceBackedValueSchema,
        common_phrases: z.array(
          z
            .object({
              phrase: z.string(),
              context: z.string(),
              evidence: z.array(z.string()),
            })
            .strict(),
        ),
        messaging_patterns: z.array(
          z
            .object({
              pattern: z.string(),
              description: z.string(),
              evidence: z.array(z.string()),
            })
            .strict(),
        ),
      })
      .strict(),
    profile_quality: z
      .object({
        overall_confidence: ConfidenceSchema,
        missing_information: z.array(z.string()),
        potential_risks: z.array(z.string()),
        notes: z.string(),
      })
      .strict(),
  })
  .strict();

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;
