import { z } from "zod";

const NonEmptyStringSchema = z.string().min(1);
const ConfidenceSchema = z.enum(["high", "medium", "low"]);
const TerritoryIdSchema = z.enum(["problem_demand", "solution_demand"]);
const ProblemSeedRoleSchema = z.enum([
  "core_problem",
  "icp_qualified_problem",
  "process_or_outcome",
  "market_synonym",
]);
const SolutionSeedRoleSchema = z.enum([
  "core_solution_category",
  "icp_qualified_solution",
  "solution_approach",
  "commercial_category",
]);
const SeedRoleSchema = z.union([ProblemSeedRoleSchema, SolutionSeedRoleSchema]);

const requiredProblemRoles = ProblemSeedRoleSchema.options;
const requiredSolutionRoles = SolutionSeedRoleSchema.options;
const problemRoles = new Set<string>(requiredProblemRoles);
const solutionRoles = new Set<string>(requiredSolutionRoles);

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
    seed_role: SeedRoleSchema,
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
    seed_keywords: z.array(SeedKeywordSchema).length(6),
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
  .strict()
  .superRefine((artifact, context) => {
    const territories = artifact.demand_territories;

    if (territories.length !== 2) {
      context.addIssue({
        code: "custom",
        message: `Exactly two demand territories are required; found ${territories.length}.`,
        path: ["demand_territories"],
      });
    }

    if (territories[0]?.territory_id !== "problem_demand") {
      context.addIssue({
        code: "custom",
        message:
          "The first demand territory must be problem_demand.",
        path: ["demand_territories", 0, "territory_id"],
      });
    }

    if (territories[1]?.territory_id !== "solution_demand") {
      context.addIssue({
        code: "custom",
        message:
          "The second demand territory must be solution_demand.",
        path: ["demand_territories", 1, "territory_id"],
      });
    }

    const seeds = territories.flatMap((territory) => territory.seed_keywords);

    if (seeds.length !== 12) {
      context.addIssue({
        code: "custom",
        message: `Exactly 12 total seed keywords are required; found ${seeds.length}.`,
        path: ["demand_territories"],
      });
    }

    const seedIds = seeds.map((seed) => seed.seed_id);

    if (new Set(seedIds).size !== seedIds.length) {
      context.addIssue({
        code: "custom",
        message: "All 12 seed_id values must be globally unique.",
        path: ["demand_territories"],
      });
    }

    const normalizedKeywords = seeds.map((seed) =>
      seed.keyword.trim().toLowerCase(),
    );

    if (new Set(normalizedKeywords).size !== normalizedKeywords.length) {
      context.addIssue({
        code: "custom",
        message:
          "All 12 keyword strings must be globally unique after trimming whitespace and converting to lowercase.",
        path: ["demand_territories"],
      });
    }

    for (const [territoryIndex, territory] of territories.entries()) {
      const territoryPath = ["demand_territories", territoryIndex];

      if (territory.seed_keywords.length !== 6) {
        context.addIssue({
          code: "custom",
          message: `${territory.territory_id} must contain exactly six seed keywords.`,
          path: [...territoryPath, "seed_keywords"],
        });
      }

      if (territory.territory_id === "problem_demand") {
        validateTerritoryRoles({
          roles: territory.seed_keywords.map((seed) => seed.seed_role),
          allowedRoles: problemRoles,
          requiredRoles: requiredProblemRoles,
          territoryId: "problem_demand",
          path: territoryPath,
          context,
        });
      }

      if (territory.territory_id === "solution_demand") {
        validateTerritoryRoles({
          roles: territory.seed_keywords.map((seed) => seed.seed_role),
          allowedRoles: solutionRoles,
          requiredRoles: requiredSolutionRoles,
          territoryId: "solution_demand",
          path: territoryPath,
          context,
        });
      }
    }
  });

function validateTerritoryRoles({
  roles,
  allowedRoles,
  requiredRoles,
  territoryId,
  path,
  context,
}: {
  roles: string[];
  allowedRoles: Set<string>;
  requiredRoles: readonly string[];
  territoryId: "problem_demand" | "solution_demand";
  path: Array<string | number>;
  context: z.RefinementCtx;
}): void {
  for (const role of roles) {
    if (!allowedRoles.has(role)) {
      context.addIssue({
        code: "custom",
        message: `${territoryId} seeds cannot use seed_role ${role}.`,
        path: [...path, "seed_keywords"],
      });
    }
  }

  for (const requiredRole of requiredRoles) {
    if (!roles.includes(requiredRole)) {
      context.addIssue({
        code: "custom",
        message: `${territoryId} must include at least one seed with role ${requiredRole}.`,
        path: [...path, "seed_keywords"],
      });
    }
  }
}

export type SeedKeywords = z.infer<typeof SeedKeywordsSchema>;
