import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { generateSeedKeywords } from "../steps/generateSeedKeywords.js";
import type { CompanyProfile } from "./companyProfile.schema.js";
import {
  DISCOVERY_GROUP_IDS,
  SeedKeywordsSchema,
  type DiscoveryGroupId,
  type SeedKeywords,
} from "./seedKeywords.schema.js";

test("SeedKeywordsSchema requires four canonical groups, six seeds each, and twenty-four total", () => {
  const parsed = SeedKeywordsSchema.parse(buildSeedArtifact());

  assert.deepEqual(
    parsed.demand_groups.map((group) => group.group_id),
    DISCOVERY_GROUP_IDS,
  );
  assert.deepEqual(
    parsed.demand_groups.map((group) => group.seed_keywords.length),
    [6, 6, 6, 6],
  );
  assert.equal(
    parsed.demand_groups.flatMap((group) => group.seed_keywords).length,
    24,
  );
});

test("SeedKeywordsSchema rejects missing, duplicate, or reordered groups", () => {
  const missing = buildSeedArtifact();
  missing.demand_groups.pop();
  assert.throws(() => SeedKeywordsSchema.parse(missing));

  const duplicate = buildSeedArtifact();
  duplicate.demand_groups[1] = structuredClone(duplicate.demand_groups[0]);
  assert.throws(() => SeedKeywordsSchema.parse(duplicate));

  const reordered = buildSeedArtifact();
  [reordered.demand_groups[0], reordered.demand_groups[1]] = [
    reordered.demand_groups[1],
    reordered.demand_groups[0],
  ];
  assert.throws(() => SeedKeywordsSchema.parse(reordered));
});

test("SeedKeywordsSchema rejects incorrectly sized groups", () => {
  const tooFew = buildSeedArtifact();
  tooFew.demand_groups[0].seed_keywords.pop();
  assert.throws(() => SeedKeywordsSchema.parse(tooFew));

  const tooMany = buildSeedArtifact();
  tooMany.demand_groups[1].seed_keywords.push(
    structuredClone(tooMany.demand_groups[1].seed_keywords[0]),
  );
  assert.throws(() => SeedKeywordsSchema.parse(tooMany));
});

test("SeedKeywordsSchema rejects normalized global duplicates", () => {
  const artifact = buildSeedArtifact();
  artifact.demand_groups[3].seed_keywords[2].keyword =
    `  ${artifact.demand_groups[0].seed_keywords[0].keyword.toUpperCase()}  `;

  assert.throws(
    () => SeedKeywordsSchema.parse(artifact),
    /globally unique after trimming and lowercasing/,
  );
});

test("SeedKeywordsSchema rejects singular/plural, word-order, and superficial modifier duplicates", () => {
  for (const duplicate of [
    "core problem workflows",
    "problem workflow core",
    "core problem workflow software",
  ]) {
    const artifact = buildSeedArtifact();
    artifact.demand_groups[0].seed_keywords[0].keyword =
      "core problem workflow";
    artifact.demand_groups[3].seed_keywords[2].keyword = duplicate;
    assert.throws(() => SeedKeywordsSchema.parse(artifact), /superficial-modifier/);
  }
});

test("generate-seed-keywords prompt has one frontmatter block and requires twenty-four seeds", () => {
  const prompt = readFileSync(
    new URL("../prompts/generate-seed-keywords.md", import.meta.url),
    "utf8",
  );

  assert.equal(prompt.match(/^---$/gm)?.length, 2);
  assert.match(prompt, /prompt_version: 0\.5\.0/);
  assert.match(prompt, /exactly six seeds per group/i);
  assert.match(prompt, /exactly twenty-four seeds total/i);
});

test("seed generation retries once with duplicate-specific feedback after schema rejection", async () => {
  const runtimeInputs: string[] = [];
  const invalidArtifact = buildSeedArtifact();
  invalidArtifact.demand_groups[3].seed_keywords[2].keyword =
    invalidArtifact.demand_groups[0].seed_keywords[0].keyword;

  const result = await generateSeedKeywords(
    { website_url: "https://example.com" } as CompanyProfile,
    "run_retry_test",
    {
      runner: async (runtimeInput) => {
        runtimeInputs.push(runtimeInput);

        return runtimeInputs.length === 1
          ? (invalidArtifact as unknown as SeedKeywords)
          : SeedKeywordsSchema.parse(buildSeedArtifact());
      },
    },
  );

  assert.equal(runtimeInputs.length, 2);
  assert.match(runtimeInputs[0], /<generation_attempt>1<\/generation_attempt>/);
  assert.doesNotMatch(runtimeInputs[0], /<retry_feedback>/);
  assert.match(runtimeInputs[1], /<generation_attempt>2<\/generation_attempt>/);
  assert.match(runtimeInputs[1], /<retry_feedback>/);
  assert.match(runtimeInputs[1], /superficial-modifier duplicates/i);
  assert.equal(
    result.demand_groups.flatMap((group) => group.seed_keywords).length,
    24,
  );
});

test("seed generation stops after the second invalid structured response", async () => {
  let attempts = 0;
  const invalidArtifact = buildSeedArtifact();
  invalidArtifact.demand_groups[3].seed_keywords[2].keyword =
    invalidArtifact.demand_groups[0].seed_keywords[0].keyword;

  await assert.rejects(
    generateSeedKeywords(
      { website_url: "https://example.com" } as CompanyProfile,
      "run_retry_limit_test",
      {
        runner: async () => {
          attempts += 1;
          return invalidArtifact as unknown as SeedKeywords;
        },
      },
    ),
    /globally unique after trimming and lowercasing/,
  );
  assert.equal(attempts, 2);
});

function buildSeedArtifact() {
  return {
    schema_version: "2.1.0" as const,
    run_id: "run_test",
    generated_at: "2026-07-24T00:00:00.000Z",
    source_artifacts: ["company-profile.json" as const],
    status: "complete" as const,
    warnings: [],
    website_url: "https://example.com",
    source_profile: {
      company_name: "Example",
      product_category: "Example software",
      primary_icp: "Example buyers",
    },
    demand_groups: DISCOVERY_GROUP_IDS.map((groupId) => buildGroup(groupId)),
    generation_quality: {
      overall_confidence: "medium" as const,
      missing_information: [],
      potential_risks: [],
      notes: "Test fixture.",
    },
  };
}

function buildGroup(groupId: DiscoveryGroupId) {
  return {
    group_id: groupId,
    group_name: `${groupId} group`,
    group_summary: `${groupId} summary.`,
    market_topic: `${groupId} market`,
    primary_icp: "Example buyers",
    product_connection: "Supported by the company profile.",
    evidence: [
      {
        source_field: "company_identity.product_category.value",
        evidence_text: "Example software",
        reasoning: "The evidence supports this group.",
      },
    ],
    seed_keywords: Array.from({ length: 6 }, (_, index) => ({
      seed_id: `${groupId}_seed_${index + 1}`,
      keyword: `${groupId.replaceAll("_", " ")} angle ${index + 1}`,
      seed_role: `discovery_angle_${index + 1}`,
      selection_reasoning: "Distinct discovery angle.",
      confidence: "medium" as const,
    })),
  };
}
