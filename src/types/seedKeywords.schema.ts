import { z } from "zod";

const NonEmptyStringSchema = z.string().trim().min(1);
const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export const DISCOVERY_GROUP_IDS = [
  "core_problem_demand",
  "adjacent_problem_demand",
  "core_solution_demand",
  "adjacent_solution_demand",
] as const;
const DiscoveryGroupIdSchema = z.enum(DISCOVERY_GROUP_IDS);
const SEEDS_PER_GROUP = 6;

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

const DemandGroupSchema = z
  .object({
    group_id: DiscoveryGroupIdSchema,
    group_name: NonEmptyStringSchema,
    group_summary: NonEmptyStringSchema,
    market_topic: NonEmptyStringSchema,
    primary_icp: NonEmptyStringSchema,
    product_connection: NonEmptyStringSchema,
    evidence: z.array(EvidenceSchema).min(1),
    seed_keywords: z.array(SeedKeywordSchema).length(SEEDS_PER_GROUP),
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
    schema_version: z.literal("2.1.0"),
    run_id: NonEmptyStringSchema,
    generated_at: z.string().datetime(),
    source_artifacts: z.array(z.literal("company-profile.json")).length(1),
    status: z.enum(["complete", "partial"]),
    warnings: z.array(NonEmptyStringSchema),
    website_url: NonEmptyStringSchema,
    source_profile: SourceProfileSchema,
    demand_groups: z.array(DemandGroupSchema).length(DISCOVERY_GROUP_IDS.length),
    generation_quality: GenerationQualitySchema,
  })
  .strict()
  .superRefine((artifact, context) => {
    for (const [index, expectedGroupId] of DISCOVERY_GROUP_IDS.entries()) {
      const group = artifact.demand_groups[index];

      if (group?.group_id !== expectedGroupId) {
        context.addIssue({
          code: "custom",
          message: `Demand group ${index + 1} must be ${expectedGroupId}.`,
          path: ["demand_groups", index, "group_id"],
        });
      }
    }

    const allSeeds = artifact.demand_groups.flatMap((group) =>
      group.seed_keywords.map((seed) => seed.keyword),
    );
    reportDuplicateSeeds(
      allSeeds,
      normalizeSeed,
      "Seed keywords must be globally unique after trimming and lowercasing.",
      context,
    );
    reportDuplicateSeeds(
      allSeeds,
      normalizeSeedVariant,
      "Seed keywords must not be singular/plural, word-order, or superficial-modifier duplicates.",
      context,
    );
  });

function reportDuplicateSeeds(
  seeds: string[],
  createKey: (seed: string) => string,
  message: string,
  context: z.RefinementCtx,
): void {
  const firstIndexByKey = new Map<string, number>();

  for (const [index, seed] of seeds.entries()) {
    const key = createKey(seed);

    if (firstIndexByKey.has(key)) {
      context.addIssue({
        code: "custom",
        message,
        path: ["demand_groups", Math.floor(index / SEEDS_PER_GROUP), "seed_keywords", index % SEEDS_PER_GROUP, "keyword"],
      });
      continue;
    }

    firstIndexByKey.set(key, index);
  }
}

function normalizeSeed(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeSeedVariant(value: string): string {
  const superficialModifiers = new Set([
    "ai",
    "app",
    "apps",
    "platform",
    "platforms",
    "software",
    "solution",
    "solutions",
    "tool",
    "tools",
  ]);

  return normalizeSeed(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0 && !superficialModifiers.has(token))
    .map(singularizeToken)
    .sort()
    .join(" ");
}

function singularizeToken(token: string): string {
  if (token.endsWith("ies") && token.length > 3) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("ses") && token.length > 3) {
    return token.slice(0, -2);
  }

  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) {
    return token.slice(0, -1);
  }

  return token;
}

export type SeedKeywords = z.infer<typeof SeedKeywordsSchema>;
export type DiscoveryGroupId = (typeof DISCOVERY_GROUP_IDS)[number];
