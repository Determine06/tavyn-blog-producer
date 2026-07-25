import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PROBLEM_SEED_ROLE_SEQUENCE,
  SEEDS_PER_TERRITORY,
  SeedKeywordsSchema,
  SOLUTION_SEED_ROLE_SEQUENCE,
  TOTAL_SEED_COUNT,
} from "./seedKeywords.schema.js";

test("SeedKeywordsSchema accepts 12 problem seeds and 12 solution seeds", () => {
  const artifact = buildSeedArtifact();

  const parsed = SeedKeywordsSchema.parse(artifact);

  assert.equal(
    parsed.demand_territories[0].seed_keywords.length,
    SEEDS_PER_TERRITORY,
  );
  assert.equal(
    parsed.demand_territories[1].seed_keywords.length,
    SEEDS_PER_TERRITORY,
  );
  assert.equal(
    parsed.demand_territories.flatMap((territory) => territory.seed_keywords)
      .length,
    TOTAL_SEED_COUNT,
  );
});

test("SeedKeywordsSchema rejects 11 or 13 seeds in either territory", () => {
  const tooFewProblem = buildSeedArtifact({ problemCount: 11 });
  const tooManySolution = buildSeedArtifact({ solutionCount: 13 });

  assert.throws(() => SeedKeywordsSchema.parse(tooFewProblem));
  assert.throws(() => SeedKeywordsSchema.parse(tooManySolution));
});

test("SeedKeywordsSchema rejects duplicate normalized seed strings", () => {
  const artifact = buildSeedArtifact();
  artifact.demand_territories[1].seed_keywords[0].keyword =
    " Problem Keyword 01 ";

  assert.throws(() => SeedKeywordsSchema.parse(artifact));
});

test("SeedKeywordsSchema rejects artifacts containing anything other than 24 total seeds", () => {
  const artifact = buildSeedArtifact({
    problemCount: SEEDS_PER_TERRITORY,
    solutionCount: SEEDS_PER_TERRITORY - 1,
  });

  assert.throws(() => SeedKeywordsSchema.parse(artifact));
});

test("SeedKeywordsSchema rejects incorrect role counts", () => {
  const artifact = buildSeedArtifact();
  artifact.demand_territories[0].seed_keywords[11].seed_role =
    "process_or_outcome";

  assert.throws(() => SeedKeywordsSchema.parse(artifact));
});

test("SeedKeywordsSchema rejects incorrect territory order", () => {
  const artifact = buildSeedArtifact();
  artifact.demand_territories.reverse();

  assert.throws(() => SeedKeywordsSchema.parse(artifact));
});

test("SeedKeywordsSchema preserves territory order and output structure", () => {
  const parsed = SeedKeywordsSchema.parse(buildSeedArtifact());

  assert.deepEqual(
    parsed.demand_territories.map((territory) => territory.territory_id),
    ["problem_demand", "solution_demand"],
  );
  assert.deepEqual(
    parsed.demand_territories[0].seed_keywords.map((seed) => seed.seed_role),
    [...PROBLEM_SEED_ROLE_SEQUENCE],
  );
  assert.deepEqual(
    parsed.demand_territories[1].seed_keywords.map((seed) => seed.seed_role),
    [...SOLUTION_SEED_ROLE_SEQUENCE],
  );
});

test("generate-seed-keywords prompt contains no active 15-per-territory or 30-total requirements", () => {
  const prompt = readFileSync(
    new URL("../prompts/generate-seed-keywords.md", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(prompt, /15 seed keywords/i);
  assert.doesNotMatch(prompt, /30 seed keywords/i);
  assert.doesNotMatch(prompt, /P1[3-5]/);
  assert.doesNotMatch(prompt, /S1[3-5]/);
});

function buildSeedArtifact({
  problemCount = SEEDS_PER_TERRITORY,
  solutionCount = SEEDS_PER_TERRITORY,
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
          seed_role:
            PROBLEM_SEED_ROLE_SEQUENCE[
              index % PROBLEM_SEED_ROLE_SEQUENCE.length
            ],
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
          seed_role:
            SOLUTION_SEED_ROLE_SEQUENCE[
              index % SOLUTION_SEED_ROLE_SEQUENCE.length
            ],
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
