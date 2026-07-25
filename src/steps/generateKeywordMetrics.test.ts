import assert from "node:assert/strict";
import test from "node:test";

import {
  PROBLEM_SEED_ROLE_SEQUENCE,
  SEEDS_PER_TERRITORY,
  SOLUTION_SEED_ROLE_SEQUENCE,
  type SeedKeywords,
} from "../types/seedKeywords.schema.js";

type Territory = "problem_demand" | "solution_demand";

test("DataForSEO request construction uses 12 seeds and limit 500 per request", async () => {
  const {
    buildKeywordIdeasTask,
    CANDIDATES_PER_TERRITORY,
  } = await importKeywordMetricsModule();
  const seeds = buildSeeds("problem");

  const task = buildKeywordIdeasTask("problem_demand", seeds);

  assert.equal(task.keywords.length, SEEDS_PER_TERRITORY);
  assert.equal(task.limit, CANDIDATES_PER_TERRITORY);
  assert.equal(task.tag, "problem_demand");
});

test("mocked complete DataForSEO responses produce 500 candidates per territory", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();
  const fetchCalls: Array<{ body: string }> = [];

  await withMockedFetch(fetchCalls, { problem_demand: 500, solution_demand: 500 }, async () => {
    const artifact = await generateKeywordMetrics(buildSeedKeywords(), "run_test");

    assert.equal(fetchCalls.length, 2);
    assert.deepEqual(
      fetchCalls.map((call) => JSON.parse(call.body)[0].keywords.length).sort(),
      [SEEDS_PER_TERRITORY, SEEDS_PER_TERRITORY],
    );
    assert.deepEqual(
      fetchCalls.map((call) => JSON.parse(call.body)[0].limit).sort(),
      [500, 500],
    );
    assert.equal(artifact.provider.http_requests_made, 2);
    assert.equal(artifact.provider.tasks_submitted, 2);
    assert.equal(artifact.request_config.limit_per_task, 500);
    assert.equal(artifact.summary.problem_queries_received, 500);
    assert.equal(artifact.summary.solution_queries_received, 500);
    assert.equal(artifact.summary.total_queries_received, 1000);
    assert.equal(artifact.status, "complete");
    assert.deepEqual(artifact.warnings, []);
  });
});

test("mocked short DataForSEO response preserves real counts and returns partial", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();
  const fetchCalls: Array<{ body: string }> = [];

  await withMockedFetch(fetchCalls, { problem_demand: 3, solution_demand: 2 }, async () => {
    const artifact = await generateKeywordMetrics(buildSeedKeywords(), "run_test");

    assert.equal(artifact.summary.problem_queries_received, 3);
    assert.equal(artifact.summary.solution_queries_received, 2);
    assert.equal(artifact.summary.total_queries_received, 5);
    assert.equal(artifact.status, "partial");
    assert.match(artifact.warnings[0], /Expected maximum: 1000/);
    assert.match(artifact.warnings[0], /actual total received: 5/);
    assert.match(artifact.warnings[0], /problem-demand count: 3/);
    assert.match(artifact.warnings[0], /solution-demand count: 2/);
  });
});

test("duplicate provider results are removed within each territory", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();
  const fetchCalls: Array<{ body: string }> = [];

  await withMockedFetch(
    fetchCalls,
    {
      problem_demand: ["duplicate query", "duplicate query", "unique query"],
      solution_demand: [],
    },
    async () => {
      const artifact = await generateKeywordMetrics(
        buildSeedKeywords(),
        "run_test",
      );

      assert.equal(artifact.query_sets[0].queries.length, 2);
      assert.deepEqual(
        artifact.query_sets[0].queries.map((query) => query.query),
        ["duplicate query", "unique query"],
      );
      assert.equal(artifact.query_sets[0].task_result.items_received, 2);
    },
  );
});

async function importKeywordMetricsModule() {
  process.env.OPENAI_API_KEY = "test";
  process.env.FIRECRAWL_API_KEY = "test";
  process.env.SERPER_API_KEY = "test";
  process.env.DATAFORSEO_LOGIN = "test";
  process.env.DATAFORSEO_PASSWORD = "test";

  return import("./generateKeywordMetrics.js");
}

async function withMockedFetch(
  fetchCalls: Array<{ body: string }>,
  responseConfig: Record<Territory, number | string[]>,
  run: () => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_url, init) => {
    const body = String(init?.body ?? "");
    fetchCalls.push({ body });
    const [request] = JSON.parse(body) as Array<{ tag: Territory }>;
    const config = responseConfig[request.tag];
    const keywords =
      typeof config === "number"
        ? Array.from({ length: config }, (_, index) =>
            `${request.tag} query ${index + 1}`,
          )
        : config;

    return {
      ok: true,
      json: async () => buildDataForSeoResponse(request.tag, keywords),
    } as Response;
  }) as typeof fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function buildDataForSeoResponse(territory: Territory, keywords: string[]) {
  return {
    status_code: 20000,
    status_message: "Ok.",
    cost: 0.01,
    tasks: [
      {
        id: `${territory}-task`,
        status_code: 20000,
        status_message: "Ok.",
        cost: 0.01,
        data: {
          tag: territory,
        },
        result: [
          {
            total_count: keywords.length,
            items: keywords.map((keyword) => ({
              keyword,
              keyword_info: {
                search_volume: 100,
                monthly_searches: [],
                search_volume_trend: null,
                cpc: 1,
                competition: 0.5,
                competition_level: "MEDIUM",
              },
              keyword_properties: {
                core_keyword: keyword,
                detected_language: "en",
                keyword_difficulty: 20,
              },
              search_intent_info: {
                main_intent: "informational",
                foreign_intent: [],
              },
              avg_backlinks_info: null,
            })),
          },
        ],
      },
    ],
  };
}

function buildSeedKeywords(): SeedKeywords {
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
      buildTerritory("problem_demand", buildSeeds("problem")),
      buildTerritory("solution_demand", buildSeeds("solution")),
    ],
    generation_quality: {
      overall_confidence: "medium",
      missing_information: [],
      potential_risks: [],
      notes: "Test fixture.",
    },
  };
}

function buildTerritory(
  territory: Territory,
  seeds: string[],
): SeedKeywords["demand_territories"][number] {
  const roles =
    territory === "problem_demand"
      ? PROBLEM_SEED_ROLE_SEQUENCE
      : SOLUTION_SEED_ROLE_SEQUENCE;

  return {
    territory_id: territory,
    territory_name: `${territory} territory`,
    territory_summary: `${territory} summary.`,
    market_topic: `${territory} market`,
    primary_icp: "Example buyers",
    product_connection: "Supported by the company profile.",
    evidence: [
      {
        source_field: "company_identity.product_category.value",
        evidence_text: "Example software",
        reasoning: "The evidence supports this territory.",
      },
    ],
    seed_keywords: seeds.map((keyword, index) => ({
      seed_id: `${territory}_seed_${String(index + 1).padStart(2, "0")}`,
      keyword,
      seed_role: roles[index % roles.length],
      selection_reasoning: "Distinct discovery angle.",
      confidence: "medium",
    })),
  };
}

function buildSeeds(prefix: string): string[] {
  return Array.from(
    { length: SEEDS_PER_TERRITORY },
    (_, index) => `${prefix} seed ${index + 1}`,
  );
}
