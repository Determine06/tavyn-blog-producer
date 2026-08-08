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

test("SeedKeywordsSchema accepts fifteen problem seeds and fifteen solution seeds", () => {
  const parsed = SeedKeywordsSchema.parse(buildSeedArtifact());

  assert.equal(parsed.demand_territories[0].seed_keywords.length, 15);
  assert.equal(parsed.demand_territories[1].seed_keywords.length, 15);
  assert.equal(
    parsed.demand_territories.flatMap((territory) => territory.seed_keywords)
      .length,
    30,
  );
});

test("SeedKeywordsSchema rejects fewer or more than fifteen seeds in either territory", () => {
  assert.throws(() =>
    SeedKeywordsSchema.parse(buildSeedArtifact({ problemCount: 14 })),
  );
  assert.throws(() =>
    SeedKeywordsSchema.parse(buildSeedArtifact({ solutionCount: 16 })),
  );
});

test("SeedKeywordsSchema allows duplicate keywords territory order and arbitrary non-empty roles", () => {
  const artifact = buildSeedArtifact();
  artifact.demand_territories[1].seed_keywords[0].keyword =
    " Problem Keyword 01 ";
  artifact.demand_territories[0].seed_keywords[0].seed_role =
    "model_generated_problem_role";
  artifact.demand_territories[1].seed_keywords[0].seed_role =
    "model_generated_solution_role";
  artifact.demand_territories.reverse();

  assert.deepEqual(SeedKeywordsSchema.parse(artifact), artifact);
});

test("generate-seed-keywords prompt requires thirty total seeds", () => {
  const prompt = readFileSync(
    new URL("../prompts/generate-seed-keywords.md", import.meta.url),
    "utf8",
  );

  assert.match(prompt, /exactly fifteen seed keywords for each territory/i);
  assert.match(prompt, /exactly thirty seed keywords in total/i);
});

function buildSeedArtifact({
  problemCount = 15,
  solutionCount = 15,
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
