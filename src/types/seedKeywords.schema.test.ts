import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SeedKeywordsSchema } from "./seedKeywords.schema.js";

const problemRoles = [
  "core_problem",
  "icp_qualified_problem",
  "process_or_outcome",
  "market_synonym",
] as const;
const solutionRoles = [
  "core_solution_category",
  "icp_qualified_solution",
  "solution_approach",
  "commercial_category",
] as const;

test("SeedKeywordsSchema accepts six problem seeds and six solution seeds", () => {
  const parsed = SeedKeywordsSchema.parse(buildSeedArtifact());

  assert.equal(parsed.demand_territories[0].seed_keywords.length, 6);
  assert.equal(parsed.demand_territories[1].seed_keywords.length, 6);
  assert.equal(
    parsed.demand_territories.flatMap((territory) => territory.seed_keywords)
      .length,
    12,
  );
});

test("SeedKeywordsSchema rejects five or seven seeds in either territory", () => {
  assert.throws(() =>
    SeedKeywordsSchema.parse(buildSeedArtifact({ problemCount: 5 })),
  );
  assert.throws(() =>
    SeedKeywordsSchema.parse(buildSeedArtifact({ solutionCount: 7 })),
  );
});

test("SeedKeywordsSchema rejects artifacts containing anything other than 12 total seeds", () => {
  assert.throws(() =>
    SeedKeywordsSchema.parse(
      buildSeedArtifact({ problemCount: 6, solutionCount: 5 }),
    ),
  );
});

test("SeedKeywordsSchema rejects duplicate normalized seed strings", () => {
  const artifact = buildSeedArtifact();
  artifact.demand_territories[1].seed_keywords[0].keyword =
    " Problem Keyword 01 ";

  assert.throws(() => SeedKeywordsSchema.parse(artifact));
});

test("SeedKeywordsSchema rejects incorrect territory order", () => {
  const artifact = buildSeedArtifact();
  artifact.demand_territories.reverse();

  assert.throws(() => SeedKeywordsSchema.parse(artifact));
});

test("SeedKeywordsSchema requires main's allowed role coverage per territory", () => {
  const missingProblemRole = buildSeedArtifact();
  missingProblemRole.demand_territories[0].seed_keywords =
    missingProblemRole.demand_territories[0].seed_keywords.map((seed) => ({
      ...seed,
      seed_role: "core_problem",
    }));

  const missingSolutionRole = buildSeedArtifact();
  missingSolutionRole.demand_territories[1].seed_keywords =
    missingSolutionRole.demand_territories[1].seed_keywords.map((seed) => ({
      ...seed,
      seed_role: "commercial_category",
    }));

  assert.throws(() => SeedKeywordsSchema.parse(missingProblemRole));
  assert.throws(() => SeedKeywordsSchema.parse(missingSolutionRole));
});

test("generate-seed-keywords prompt requires six per territory and no active 12-per-territory or 24-total contract", () => {
  const prompt = readFileSync(
    new URL("../prompts/generate-seed-keywords.md", import.meta.url),
    "utf8",
  );

  assert.match(prompt, /exactly six seed keywords for each territory/i);
  assert.match(prompt, /exactly twelve seed keywords in total/i);
  assert.doesNotMatch(prompt, /12 seed keywords for each territory/i);
  assert.doesNotMatch(prompt, /24 seed keywords in total/i);
});

function buildSeedArtifact({
  problemCount = 6,
  solutionCount = 6,
}: {
  problemCount?: number;
  solutionCount?: number;
} = {}) {
  return {
    schema_version: "1.0.0",
    run_id: "run_test",
    generated_at: "2026-07-24T00:00:00.000Z",
    source_artifacts: ["company-profile.json"],
    status: "complete",
    warnings: [],
    website_url: "https://example.com",
    source_profile: {
      company_name: "Example",
      product_category: "Example software",
      primary_icp: "Example buyers",
    },
    demand_territories: [
      {
        territory_id: "problem_demand",
        territory_name: "Problem demand",
        territory_summary: "Problem territory summary.",
        market_topic: "Example problem market",
        primary_icp: "Example buyers",
        product_connection: "The product addresses the problem.",
        evidence: [
          {
            source_field: "buyer_pains[0].pain",
            evidence_text: "Example pain",
            reasoning: "The pain supports the territory.",
          },
        ],
        seed_keywords: Array.from({ length: problemCount }, (_, index) => ({
          seed_id: `problem_seed_${String(index + 1).padStart(2, "0")}`,
          keyword: `problem keyword ${String(index + 1).padStart(2, "0")}`,
          seed_role: problemRoles[index % problemRoles.length],
          selection_reasoning: "Distinct problem discovery angle.",
          confidence: "medium",
        })),
      },
      {
        territory_id: "solution_demand",
        territory_name: "Solution demand",
        territory_summary: "Solution territory summary.",
        market_topic: "Example solution market",
        primary_icp: "Example buyers",
        product_connection: "The product belongs in the solution category.",
        evidence: [
          {
            source_field: "company_identity.product_category.value",
            evidence_text: "Example software",
            reasoning: "The category supports the territory.",
          },
        ],
        seed_keywords: Array.from({ length: solutionCount }, (_, index) => ({
          seed_id: `solution_seed_${String(index + 1).padStart(2, "0")}`,
          keyword: `solution keyword ${String(index + 1).padStart(2, "0")}`,
          seed_role: solutionRoles[index % solutionRoles.length],
          selection_reasoning: "Distinct solution discovery angle.",
          confidence: "medium",
        })),
      },
    ],
    generation_quality: {
      overall_confidence: "medium",
      missing_information: [],
      potential_risks: [],
      notes: "Test fixture.",
    },
  };
}
