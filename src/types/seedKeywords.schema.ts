import { z } from "zod";

const NonEmptyStringSchema = z.string().min(1);
const ConfidenceSchema = z.enum(["high", "medium", "low"]);
const TerritoryIdSchema = z.enum(["problem_demand", "solution_demand"]);
const SEEDS_PER_TERRITORY = 15;

const SourceProfileSchema = z
  .object({
    company_name: NonEmptyStringSchema,
    product_category: NonEmptyStringSchema,
    primary_icp: NonEmptyStringSchema,
  })
  .strict();

const EvidenceSchema = z
  .object({
    source_field: NonEmptyStringSchema,
    evidence_text: NonEmptyStringSchema,
    reasoning: NonEmptyStringSchema,
  })
  .strict();

const SeedKeywordSchema = z
  .object({
    seed_id: NonEmptyStringSchema,
    keyword: NonEmptyStringSchema,
    seed_role: NonEmptyStringSchema,
    selection_reasoning: NonEmptyStringSchema,
    confidence: ConfidenceSchema,
  })
  .strict();

const DemandTerritorySchema = z
  .object({
    territory_id: TerritoryIdSchema,
    territory_name: NonEmptyStringSchema,
    territory_summary: NonEmptyStringSchema,
    market_topic: NonEmptyStringSchema,
    primary_icp: NonEmptyStringSchema,
    product_connection: NonEmptyStringSchema,
    evidence: z.array(EvidenceSchema).min(1),
    seed_keywords: z.array(SeedKeywordSchema).length(SEEDS_PER_TERRITORY),
  })
  .strict();

const GenerationQualitySchema = z
  .object({
    overall_confidence: ConfidenceSchema,
    missing_information: z.array(NonEmptyStringSchema),
    potential_risks: z.array(NonEmptyStringSchema),
    notes: NonEmptyStringSchema,
  })
  .strict();

export const SeedKeywordsSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    run_id: NonEmptyStringSchema,
    generated_at: z.string().datetime(),
    source_artifacts: z.array(z.literal("company-profile.json")).length(1),
    status: z.enum(["complete", "partial"]),
    warnings: z.array(NonEmptyStringSchema),
    website_url: NonEmptyStringSchema,
    source_profile: SourceProfileSchema,
    demand_territories: z.array(DemandTerritorySchema).length(2),
    generation_quality: GenerationQualitySchema,
  })
  .strict();

export type SeedKeywords = z.infer<typeof SeedKeywordsSchema>;
