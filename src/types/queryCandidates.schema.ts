import { z } from "zod";

const NonEmptyStringSchema = z.string().min(1);

const FamilyIdSchema = z.enum([
  "problem_01",
  "problem_02",
  "problem_03",
  "solution_01",
  "solution_02",
  "solution_03",
]);

const TerritorySchema = z.enum(["problem_demand", "solution_demand"]);
const SearchIntentSchema = z.enum([
  "informational",
  "commercial",
  "transactional",
]);
const BuyerStageSchema = z.enum([
  "problem_aware",
  "solution_aware",
  "vendor_aware",
]);
const LikelyPageTypeSchema = z.enum([
  "guide",
  "workflow",
  "problem_article",
  "template",
  "category_page",
  "use_case_page",
  "comparison",
  "alternatives",
  "tool",
  "landing_page",
]);
const ConfidenceSchema = z.enum(["high", "medium", "low"]);
const QueryTypeSchema = z.enum([
  "core",
  "problem",
  "how_to",
  "template",
  "comparison",
  "tool",
  "buyer_question",
  "alternative_phrase",
]);

const RequiredFamilyIds = FamilyIdSchema.options;
const ProblemFamilyIds = new Set<string>([
  "problem_01",
  "problem_02",
  "problem_03",
]);
const SolutionFamilyIds = new Set<string>([
  "solution_01",
  "solution_02",
  "solution_03",
]);

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

const QueryCandidateSchema = z
  .object({
    query: NonEmptyStringSchema,
    query_type: QueryTypeSchema,
    reasoning: NonEmptyStringSchema,
  })
  .strict();

const QueryFamilySchema = z
  .object({
    family_id: FamilyIdSchema,
    territory: TerritorySchema,
    family_name: NonEmptyStringSchema,
    family_summary: NonEmptyStringSchema,
    search_intent: SearchIntentSchema,
    buyer_stage: BuyerStageSchema,
    likely_page_type: LikelyPageTypeSchema,
    product_relevance: ConfidenceSchema,
    evidence: z.array(EvidenceSchema).min(1).max(2),
    query_candidates: z.array(QueryCandidateSchema).length(10),
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

export const QueryCandidatesSchema = z
  .object({
    schema_version: NonEmptyStringSchema,
    run_id: NonEmptyStringSchema,
    generated_at: NonEmptyStringSchema,
    source_artifacts: z.array(z.literal("company-profile.json")).length(1),
    status: z.enum(["complete", "partial"]),
    warnings: z.array(NonEmptyStringSchema),
    website_url: NonEmptyStringSchema,
    source_profile: SourceProfileSchema,
    query_families: z.array(QueryFamilySchema).length(6),
    generation_quality: GenerationQualitySchema,
  })
  .strict()
  .superRefine((artifact, context) => {
    const familyIdCounts = new Map<string, number>();

    for (const family of artifact.query_families) {
      familyIdCounts.set(
        family.family_id,
        (familyIdCounts.get(family.family_id) ?? 0) + 1,
      );
    }

    for (const familyId of RequiredFamilyIds) {
      const count = familyIdCounts.get(familyId) ?? 0;

      if (count !== 1) {
        context.addIssue({
          code: "custom",
          message: `Family ID ${familyId} must appear exactly once; found ${count}.`,
          path: ["query_families"],
        });
      }
    }

    for (const family of artifact.query_families) {
      if (
        ProblemFamilyIds.has(family.family_id) &&
        family.territory !== "problem_demand"
      ) {
        context.addIssue({
          code: "custom",
          message: `${family.family_id} must use territory problem_demand.`,
          path: ["query_families"],
        });
      }

      if (
        SolutionFamilyIds.has(family.family_id) &&
        family.territory !== "solution_demand"
      ) {
        context.addIssue({
          code: "custom",
          message: `${family.family_id} must use territory solution_demand.`,
          path: ["query_families"],
        });
      }
    }

    const problemDemandCount = artifact.query_families.filter(
      (family) => family.territory === "problem_demand",
    ).length;
    const solutionDemandCount = artifact.query_families.filter(
      (family) => family.territory === "solution_demand",
    ).length;

    if (problemDemandCount !== 3) {
      context.addIssue({
        code: "custom",
        message: `Exactly three families must use problem_demand; found ${problemDemandCount}.`,
        path: ["query_families"],
      });
    }

    if (solutionDemandCount !== 3) {
      context.addIssue({
        code: "custom",
        message: `Exactly three families must use solution_demand; found ${solutionDemandCount}.`,
        path: ["query_families"],
      });
    }

    const normalizedQueries = artifact.query_families.flatMap((family) =>
      family.query_candidates.map((candidate) =>
        candidate.query.trim().toLowerCase(),
      ),
    );
    const uniqueQueryCount = new Set(normalizedQueries).size;

    if (uniqueQueryCount !== normalizedQueries.length) {
      context.addIssue({
        code: "custom",
        message:
          "All sixty query strings must be unique after trimming whitespace and converting to lowercase.",
        path: ["query_families"],
      });
    }
  });

export type QueryCandidates = z.infer<typeof QueryCandidatesSchema>;
