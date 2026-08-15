import assert from "node:assert/strict";
import test from "node:test";

import { OPPORTUNITY_SCORING_METHOD } from "../lib/opportunityScoring.js";
import {
  ConfirmedQueriesSchema,
  type ConfirmedQueries,
} from "../types/confirmedQueries.schema.js";
import { QueryOpportunitiesSchema } from "../types/queryOpportunities.schema.js";
import { generateQueryOpportunities } from "./generateQueryOpportunities.js";

test("generated opportunities use separate territory P95 benchmarks and canonical fields", async () => {
  const result = await generateQueryOpportunities(
    buildConfirmedQueries(),
    "run_scoring_contract",
  );
  const problemRanking = result.territory_rankings[0];
  const solutionRanking = result.territory_rankings[1];
  const problemSharedVolume = findSelectedQuery(
    problemRanking.queries,
    "problem_demand_shared_volume",
  );
  const solutionSharedVolume = findSelectedQuery(
    solutionRanking.queries,
    "solution_demand_shared_volume",
  );
  const aboveP95 = findSelectedQuery(
    problemRanking.queries,
    "problem_demand_above_p95",
  );
  const allScoredById = new Map(
    result.all_scored_queries.map((query) => [query.query_id, query]),
  );

  assert.equal(result.schema_version, "2.1.0");
  assert.equal(result.all_scored_queries.length, 42);
  assert.equal(allScoredById.size, 42);
  assert.equal(result.summary.total_queries_scored, 42);
  assert.equal(result.summary.problem_queries_scored, 21);
  assert.equal(result.summary.solution_queries_scored, 21);
  assert.equal(result.summary.missing_keyword_difficulty_scored, 2);
  assert.equal(problemRanking.queries.length, 10);
  assert.equal(solutionRanking.queries.length, 10);
  assert.deepEqual(
    problemRanking.queries.map((query) => query.query_id),
    [
      "problem_demand_above_p95",
      "problem_demand_shared_volume",
      "problem_demand_p95",
      "problem_demand_filler_18",
      "problem_demand_filler_17",
      "problem_demand_filler_16",
      "problem_demand_filler_15",
      "problem_demand_filler_14",
      "problem_demand_filler_13",
      "problem_demand_filler_12",
    ],
  );
  assert.deepEqual(
    solutionRanking.queries.map((query) => query.query_id),
    [
      "solution_demand_above_p95",
      "solution_demand_shared_volume",
      "solution_demand_p95",
      "solution_demand_filler_18",
      "solution_demand_filler_17",
      "solution_demand_filler_16",
      "solution_demand_filler_15",
      "solution_demand_filler_14",
      "solution_demand_filler_13",
      "solution_demand_filler_12",
    ],
  );
  assert.ok(allScoredById.has("problem_demand_filler_1"));
  assert.equal(
    problemRanking.queries.some(
      (query) => query.query_id === "problem_demand_filler_1",
    ),
    false,
  );

  for (const rankedQuery of [
    ...problemRanking.queries,
    ...solutionRanking.queries,
  ]) {
    assert.deepEqual(
      rankedQuery.opportunity_metrics,
      allScoredById.get(rankedQuery.query_id)?.opportunity_metrics,
    );
  }

  assert.equal(problemRanking.territory_p95_search_volume, 12_100);
  assert.equal(solutionRanking.territory_p95_search_volume, 4_300);
  assert.equal(
    problemSharedVolume.opportunity_metrics.search_volume_used,
    solutionSharedVolume.opportunity_metrics.search_volume_used,
  );
  assert.ok(
    problemSharedVolume.opportunity_metrics.demand_score <
      solutionSharedVolume.opportunity_metrics.demand_score,
  );
  assert.equal(
    problemSharedVolume.opportunity_metrics.territory_p95_search_volume,
    12_100,
  );
  assert.equal(
    solutionSharedVolume.opportunity_metrics.territory_p95_search_volume,
    4_300,
  );

  assert.equal(aboveP95.metrics.search_volume, 301_000);
  assert.equal(
    aboveP95.opportunity_metrics.territory_p95_search_volume,
    12_100,
  );
  assert.ok(
    aboveP95.opportunity_metrics.search_volume_used >
      aboveP95.opportunity_metrics.territory_p95_search_volume,
  );
  assert.equal(aboveP95.opportunity_metrics.demand_score, 1);
  const authoritativeAboveP95 = allScoredById.get(
    "problem_demand_above_p95",
  );

  assert.ok(authoritativeAboveP95);
  assert.ok(
    authoritativeAboveP95.opportunity_metrics.search_volume_used >
      authoritativeAboveP95.opportunity_metrics
        .territory_p95_search_volume,
  );
  const imputedQuery = allScoredById.get("problem_demand_filler_1");

  assert.ok(imputedQuery);
  assert.equal(imputedQuery.opportunity_metrics.keyword_difficulty_used, 50);
  assert.equal(
    imputedQuery.opportunity_metrics.keyword_difficulty_was_imputed,
    true,
  );
  assert.equal(imputedQuery.opportunity_metrics.attainability_score, 0.5);
  assert.equal(QueryOpportunitiesSchema.safeParse(result).success, true);

  assert.deepEqual(
    Object.keys(aboveP95.opportunity_metrics).sort(),
    [
      "attainability_score",
      "demand_score",
      "keyword_difficulty_original",
      "keyword_difficulty_used",
      "keyword_difficulty_was_imputed",
      "opportunity_score",
      "search_volume_used",
      "territory_p95_search_volume",
    ].sort(),
  );
  assert.deepEqual(Object.keys(problemRanking).sort(), [
    "confirmed_query_count",
    "queries",
    "selected_query_count",
    "territory",
    "territory_p95_search_volume",
  ]);
});

test("exhaustive scored-query schema rejects missing duplicate and incomplete records", async () => {
  const result = await generateQueryOpportunities(
    buildConfirmedQueries(),
    "run_scoring_schema",
  );
  const missingRecord = structuredClone(result);

  missingRecord.all_scored_queries.pop();
  assert.equal(QueryOpportunitiesSchema.safeParse(missingRecord).success, false);

  const duplicateRecord = structuredClone(result);
  duplicateRecord.all_scored_queries[1] = structuredClone(
    duplicateRecord.all_scored_queries[0],
  );
  assert.equal(
    QueryOpportunitiesSchema.safeParse(duplicateRecord).success,
    false,
  );

  const incompleteRecord = structuredClone(result) as unknown as {
    all_scored_queries: Array<{
      opportunity_metrics: Record<string, unknown>;
    }>;
  };
  delete incompleteRecord.all_scored_queries[0].opportunity_metrics
    .opportunity_score;
  assert.equal(
    QueryOpportunitiesSchema.safeParse(incompleteRecord).success,
    false,
  );
});

test("runtime metadata is canonical and multiplicative metadata is rejected", async () => {
  const result = await generateQueryOpportunities(
    buildConfirmedQueries(),
    "run_scoring_metadata",
  );

  assert.deepEqual(result.scoring_method, OPPORTUNITY_SCORING_METHOD);
  assert.equal(result.scoring_method.combination_method, "weighted_additive");
  assert.deepEqual(result.scoring_method.weights, {
    demand_score: 0.7,
    attainability_score: 0.3,
  });
  assert.equal(
    result.scoring_method.formula,
    "100 * (0.70 * demand_score + 0.30 * attainability_score)",
  );

  const staleMetadata = {
    ...result,
    scoring_method: {
      name: "search_demand_times_organic_attainability",
      version: "1.1.0",
      missing_keyword_difficulty_default: 50,
      volume_normalization: "log1p_relative_to_territory_max",
      combination_method: "multiplicative",
      formula: "100 * volume_score * difficulty_score",
    },
  };

  assert.equal(QueryOpportunitiesSchema.safeParse(staleMetadata).success, false);
});

type SelectedQuery = Awaited<
  ReturnType<typeof generateQueryOpportunities>
>["territory_rankings"][number]["queries"][number];

function findSelectedQuery(
  queries: SelectedQuery[],
  queryId: string,
): SelectedQuery {
  const query = queries.find((candidate) => candidate.query_id === queryId);

  assert.ok(query, `Expected ${queryId} to be selected.`);

  return query;
}

function buildConfirmedQueries(): ConfirmedQueries {
  const problemQueries = buildTerritoryQueries(
    "problem_demand",
    12_100,
    301_000,
  );
  const solutionQueries = buildTerritoryQueries(
    "solution_demand",
    4_300,
    5_000,
  );
  const confirmedQueries = [...problemQueries, ...solutionQueries];

  return ConfirmedQueriesSchema.parse({
    schema_version: "1.1.0",
    run_id: "run_confirmed_queries",
    generated_at: "2026-08-08T00:00:00.000Z",
    source_artifacts: [
      "query-validations.json",
      "keyword_metrics.json",
    ],
    status: "complete",
    warnings: [],
    website_url: "https://example.com/",
    source_profile: {
      company_name: "Example Co",
      product_category: "Example category",
      primary_icp: "Example ICP",
    },
    confirmed_queries: confirmedQueries,
    summary: {
      total_queries_evaluated: confirmedQueries.length,
      total_queries_confirmed: confirmedQueries.length,
      total_queries_rejected: 0,
      problem_queries_confirmed: problemQueries.length,
      solution_queries_confirmed: solutionQueries.length,
      direct_queries_confirmed: confirmedQueries.length,
      adjacent_queries_confirmed: 0,
      irrelevant_queries_rejected: 0,
    },
  });
}

function buildTerritoryQueries(
  territory: "problem_demand" | "solution_demand",
  p95SearchVolume: number,
  aboveP95SearchVolume: number,
) {
  const sharedVolumeQuery = buildConfirmedQuery({
    territory,
    suffix: "shared_volume",
    discoveryRank: 1,
    searchVolume: 1_000,
    keywordDifficulty: 0,
  });
  const fillerQueries = Array.from({ length: 18 }, (_, index) =>
    buildConfirmedQuery({
      territory,
      suffix: `filler_${index + 1}`,
      discoveryRank: index + 2,
      searchVolume: index === 0 ? 0 : index + 1,
      keywordDifficulty: index === 0 ? null : 100,
    }),
  );
  const p95Query = buildConfirmedQuery({
    territory,
    suffix: "p95",
    discoveryRank: 20,
    searchVolume: p95SearchVolume,
    keywordDifficulty: 100,
  });
  const aboveP95Query = buildConfirmedQuery({
    territory,
    suffix: "above_p95",
    discoveryRank: 21,
    searchVolume: aboveP95SearchVolume,
    keywordDifficulty: 0,
  });

  return [
    sharedVolumeQuery,
    ...fillerQueries,
    p95Query,
    aboveP95Query,
  ];
}

function buildConfirmedQuery(options: {
  territory: "problem_demand" | "solution_demand";
  suffix: string;
  discoveryRank: number;
  searchVolume: number;
  keywordDifficulty: number | null;
}) {
  return {
    query_id: `${options.territory}_${options.suffix}`,
    territory: options.territory,
    query: `${options.territory} ${options.suffix}`,
    validation_reasoning: "Deterministic scoring fixture.",
    relevance_scope: "direct" as const,
    discovery_group:
      options.territory === "problem_demand"
        ? ("core_problem_demand" as const)
        : ("core_solution_demand" as const),
    source_seed_keywords: Array.from(
      { length: 6 },
      (_, index) => `${options.territory} seed ${index + 1}`,
    ),
    discovery_rank: options.discoveryRank,
    core_keyword: options.suffix,
    detected_language: "en",
    metrics: {
      search_volume: options.searchVolume,
      monthly_searches: [],
      search_volume_trend: null,
      cpc: null,
      paid_competition: null,
      paid_competition_level: null,
      keyword_difficulty: options.keywordDifficulty,
      search_intent: {
        main: "informational" as const,
        secondary: [],
      },
      average_top_10: null,
    },
  };
}
