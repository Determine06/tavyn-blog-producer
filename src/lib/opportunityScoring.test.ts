import assert from "node:assert/strict";
import test from "node:test";

import {
  MISSING_KEYWORD_DIFFICULTY_DEFAULT,
  OPPORTUNITY_SCORING_METHOD,
  calculateOpportunityScore,
  calculateTerritoryP95SearchVolume,
} from "./opportunityScoring.js";

test("weighted-additive opportunity scoring preserves all score boundaries", () => {
  const cases = [
    {
      name: "demand 1 and attainability 1",
      query: buildQuery(100, 0),
      territoryP95SearchVolume: 100,
      demandScore: 1,
      attainabilityScore: 1,
      opportunityScore: 100,
    },
    {
      name: "demand 1 and attainability 0",
      query: buildQuery(100, 100),
      territoryP95SearchVolume: 100,
      demandScore: 1,
      attainabilityScore: 0,
      opportunityScore: 70,
    },
    {
      name: "demand 0 and attainability 1",
      query: buildQuery(0, 0),
      territoryP95SearchVolume: 100,
      demandScore: 0,
      attainabilityScore: 1,
      opportunityScore: 30,
    },
    {
      name: "demand 0 and attainability 0",
      query: buildQuery(0, 100),
      territoryP95SearchVolume: 100,
      demandScore: 0,
      attainabilityScore: 0,
      opportunityScore: 0,
    },
  ];

  for (const scoringCase of cases) {
    const result = calculateOpportunityScore(
      scoringCase.query,
      scoringCase.territoryP95SearchVolume,
    );

    assert.equal(result.demandScore, scoringCase.demandScore, scoringCase.name);
    assert.equal(
      result.attainabilityScore,
      scoringCase.attainabilityScore,
      scoringCase.name,
    );
    assert.equal(
      result.opportunityScore,
      scoringCase.opportunityScore,
      scoringCase.name,
    );
  }
});

test("worked demand and attainability example produces 69.8", () => {
  const result = calculateOpportunityScore(buildQuery(5_400, 60), 33_100);

  assert.equal(roundTo(result.demandScore, 4), 0.8258);
  assert.equal(result.attainabilityScore, 0.4);
  assert.equal(result.opportunityScore, 69.8);
});

test("search volume above territory P95 caps demand at 1", () => {
  const result = calculateOpportunityScore(
    buildQuery(301_000, 100),
    12_100,
  );

  assert.equal(result.searchVolumeUsed, 301_000);
  assert.equal(result.territoryP95SearchVolume, 12_100);
  assert.equal(result.demandScore, 1);
  assert.equal(result.opportunityScore, 70);
});

test("missing keyword difficulty uses 50 and produces attainability 0.5", () => {
  const result = calculateOpportunityScore(buildQuery(0, null), 100);

  assert.equal(result.keywordDifficultyOriginal, null);
  assert.equal(
    result.keywordDifficultyUsed,
    MISSING_KEYWORD_DIFFICULTY_DEFAULT,
  );
  assert.equal(result.keywordDifficultyWasImputed, true);
  assert.equal(result.attainabilityScore, 0.5);
  assert.equal(result.opportunityScore, 15);
});

test("territory P95 uses the nearest-rank observation and ignores missing volumes", () => {
  const queries = Array.from({ length: 20 }, (_, index) =>
    buildQuery(index + 1, 50),
  );

  queries.push(buildQuery(null, 50));

  assert.equal(calculateTerritoryP95SearchVolume(queries), 19);
  assert.equal(calculateTerritoryP95SearchVolume([buildQuery(null, 50)]), 0);
});

test("scoring metadata exactly describes the weighted-additive calculation", () => {
  assert.deepEqual(OPPORTUNITY_SCORING_METHOD, {
    name: "relative_search_demand_plus_organic_attainability",
    version: "2.0.0",
    missing_keyword_difficulty_default: 50,
    combination_method: "weighted_additive",
    formula: "100 * (0.70 * demand_score + 0.30 * attainability_score)",
    weights: {
      demand_score: 0.7,
      attainability_score: 0.3,
    },
    demand_normalization: {
      method: "log1p_territory_p95_capped",
      territory_specific: true,
      cap: 1,
    },
    score_scope: "within_territory_relative_priority",
  });
});

function buildQuery(
  searchVolume: number | null,
  keywordDifficulty: number | null,
) {
  return {
    metrics: {
      search_volume: searchVolume,
      keyword_difficulty: keywordDifficulty,
    },
  };
}

function roundTo(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;

  return Math.round(value * factor) / factor;
}
