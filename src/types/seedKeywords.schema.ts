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

export const SEEDS_PER_TERRITORY = 12;
export const TOTAL_SEED_COUNT = SEEDS_PER_TERRITORY * 2;
export const PROBLEM_SEED_ROLE_SEQUENCE = [
  "core_problem",
  "core_problem",
  "icp_qualified_problem",
  "icp_qualified_problem",
  "process_or_outcome",
  "process_or_outcome",
  "process_or_outcome",
  "process_or_outcome",
  "process_or_outcome",
  "process_or_outcome",
  "process_or_outcome",
  "market_synonym",
] as const;
export const SOLUTION_SEED_ROLE_SEQUENCE = [
  "core_solution_category",
  "core_solution_category",
  "icp_qualified_solution",
  "icp_qualified_solution",
  "solution_approach",
  "solution_approach",
  "solution_approach",
  "commercial_category",
  "commercial_category",
  "commercial_category",
  "commercial_category",
  "commercial_category",
] as const;
export const PROBLEM_SEED_ROLE_COUNTS = {
  core_problem: 2,
  icp_qualified_problem: 2,
  process_or_outcome: 7,
  market_synonym: 1,
} as const;
export const SOLUTION_SEED_ROLE_COUNTS = {
  core_solution_category: 2,
  icp_qualified_solution: 2,
  solution_approach: 3,
  commercial_category: 5,
} as const;

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

    if (seeds.length !== TOTAL_SEED_COUNT) {
      context.addIssue({
        code: "custom",
        message: `Exactly ${TOTAL_SEED_COUNT} total seed keywords are required; found ${seeds.length}.`,
        path: ["demand_territories"],
      });
    }

    const seedIds = seeds.map((seed) => seed.seed_id);

    if (new Set(seedIds).size !== seedIds.length) {
      context.addIssue({
        code: "custom",
        message: `All ${TOTAL_SEED_COUNT} seed_id values must be globally unique.`,
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
          `All ${TOTAL_SEED_COUNT} keyword strings must be globally unique after trimming whitespace and converting to lowercase.`,
        path: ["demand_territories"],
      });
    }

    for (const [territoryIndex, territory] of territories.entries()) {
      const territoryPath = ["demand_territories", territoryIndex];

      if (territory.seed_keywords.length !== SEEDS_PER_TERRITORY) {
        context.addIssue({
          code: "custom",
          message: `${territory.territory_id} must contain exactly ${SEEDS_PER_TERRITORY} seed keywords.`,
          path: [...territoryPath, "seed_keywords"],
        });
      }

      if (territory.territory_id === "problem_demand") {
        validateTerritoryRoleSequence({
          roles: territory.seed_keywords.map((seed) => seed.seed_role),
          allowedRoles: problemRoles,
          requiredSequence: PROBLEM_SEED_ROLE_SEQUENCE,
          requiredCounts: PROBLEM_SEED_ROLE_COUNTS,
          territoryId: "problem_demand",
          path: territoryPath,
          context,
        });
      }

      if (territory.territory_id === "solution_demand") {
        validateTerritoryRoleSequence({
          roles: territory.seed_keywords.map((seed) => seed.seed_role),
          allowedRoles: solutionRoles,
          requiredSequence: SOLUTION_SEED_ROLE_SEQUENCE,
          requiredCounts: SOLUTION_SEED_ROLE_COUNTS,
          territoryId: "solution_demand",
          path: territoryPath,
          context,
        });
      }
    }
  });

function validateTerritoryRoleSequence({
  roles,
  allowedRoles,
  requiredSequence,
  requiredCounts,
  territoryId,
  path,
  context,
}: {
  roles: string[];
  allowedRoles: Set<string>;
  requiredSequence: readonly string[];
  requiredCounts: Readonly<Record<string, number>>;
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

  for (const [index, requiredRole] of requiredSequence.entries()) {
    if (roles[index] !== requiredRole) {
      context.addIssue({
        code: "custom",
        message: `${territoryId} seed ${index + 1} must use seed_role ${requiredRole}; found ${roles[index] ?? "missing"}.`,
        path: [...path, "seed_keywords", index, "seed_role"],
      });
    }
  }

  for (const [requiredRole, requiredCount] of Object.entries(requiredCounts)) {
    const actualCount = roles.filter((role) => role === requiredRole).length;

    if (actualCount !== requiredCount) {
      context.addIssue({
        code: "custom",
        message: `${territoryId} must include exactly ${requiredCount} seeds with role ${requiredRole}; found ${actualCount}.`,
        path: [...path, "seed_keywords"],
      });
    }
  }
}

export type SeedKeywords = z.infer<typeof SeedKeywordsSchema>;
