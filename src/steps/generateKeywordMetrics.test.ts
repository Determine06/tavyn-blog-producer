import assert from "node:assert/strict";
import test from "node:test";

import type { SeedKeywords } from "../types/seedKeywords.schema.js";

type Territory = "problem_demand" | "solution_demand";
type MockKeywordItem =
  | string
  | {
      keyword: string;
      searchVolume?: number | null;
      omitKeywordInfo?: boolean;
    };
type MockResponseConfig = Record<Territory, MockKeywordItem[]>;

test("DataForSEO request construction uses fifteen seeds, limit 500, search volume > 50, and relevance-first ordering", async () => {
  const { buildKeywordIdeasTask } = await importKeywordMetricsModule();
  const seeds = buildSeeds("problem");

  const task = buildKeywordIdeasTask("problem_demand", seeds);

  assert.deepEqual(task.keywords, seeds);
  assert.equal(task.limit, 500);
  assert.equal(task.tag, "problem_demand");
  assert.ok(
    JSON.stringify(task.filters).includes(
      JSON.stringify(["keyword_info.search_volume", ">", 50]),
    ),
  );
  assert.deepEqual(task.order_by, [
    "relevance,desc",
    "keyword_info.search_volume,desc",
  ]);
});

test("generateKeywordMetrics makes exactly two territory-level DataForSEO calls", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();
  const fetchCalls: Array<{ body: string }> = [];

  await withMockedFetch(
    fetchCalls,
    {
      problem_demand: ["problem query 1", "problem query 2"],
      solution_demand: ["solution query 1"],
    },
    async () => {
      const artifact = await generateKeywordMetrics(
        buildSeedKeywords(),
        "run_test",
      );
      const tasks = fetchCalls.map((call) => JSON.parse(call.body)[0]);

      assert.equal(fetchCalls.length, 2);
      assert.deepEqual(tasks[0].keywords, buildSeeds("problem"));
      assert.deepEqual(tasks[1].keywords, buildSeeds("solution"));
      assert.deepEqual(
        tasks.map((task) => task.limit),
        [500, 500],
      );
      assert.deepEqual(
        tasks.map((task) => task.tag),
        ["problem_demand", "solution_demand"],
      );
      assert.deepEqual(
        tasks.map((task) => task.order_by),
        [
          ["relevance,desc", "keyword_info.search_volume,desc"],
          ["relevance,desc", "keyword_info.search_volume,desc"],
        ],
      );
      assert.equal(artifact.provider.http_requests_made, 2);
      assert.equal(artifact.provider.tasks_submitted, 2);
      assert.equal(artifact.request_config.limit_per_task, 500);
      assert.equal(artifact.summary.problem_queries_received, 2);
      assert.equal(artifact.summary.solution_queries_received, 1);
      assert.equal(artifact.status, "complete");
    },
  );
});

test("defensive response filtering excludes search volumes 50, below 50, null, and missing", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();
  const fetchCalls: Array<{ body: string }> = [];

  await withMockedFetch(
    fetchCalls,
    {
      problem_demand: [
        { keyword: "volume 51", searchVolume: 51 },
        { keyword: "volume 50", searchVolume: 50 },
        { keyword: "volume 49", searchVolume: 49 },
        { keyword: "volume null", searchVolume: null },
        { keyword: "missing keyword info", omitKeywordInfo: true },
      ],
      solution_demand: [{ keyword: "solution volume 51", searchVolume: 51 }],
    },
    async () => {
      const artifact = await generateKeywordMetrics(
        buildSeedKeywords(),
        "run_test",
      );

      assert.deepEqual(
        artifact.query_sets[0].queries.map((query) => query.query),
        ["volume 51"],
      );
      assert.deepEqual(
        artifact.query_sets[1].queries.map((query) => query.query),
        ["solution volume 51"],
      );
      assert.equal(artifact.query_sets[0].territory, "problem_demand");
      assert.equal(artifact.query_sets[1].territory, "solution_demand");
    },
  );
});

test("fewer than 500 results is accepted normally", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();
  const fetchCalls: Array<{ body: string }> = [];

  await withMockedFetch(
    fetchCalls,
    {
      problem_demand: ["problem query"],
      solution_demand: [],
    },
    async () => {
      const artifact = await generateKeywordMetrics(
        buildSeedKeywords(),
        "run_test",
      );

      assert.equal(artifact.summary.problem_queries_received, 1);
      assert.equal(artifact.summary.solution_queries_received, 0);
      assert.equal(artifact.summary.total_queries_received, 1);
      assert.equal(artifact.status, "complete");
    },
  );
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

      assert.deepEqual(
        artifact.query_sets[0].queries.map((query) => query.query),
        ["duplicate query", "unique query"],
      );
      assert.equal(artifact.query_sets[0].task_result.items_received, 2);
    },
  );
});

test("DataForSEO root-level errors are surfaced", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();

  await withRawMockedFetch(
    {
      status_code: 40000,
      status_message: "Root failure",
      tasks: [],
    },
    async () => {
      await assert.rejects(
        () => generateKeywordMetrics(buildSeedKeywords(), "run_test"),
        /root status 40000: Root failure/,
      );
    },
  );
});

test("DataForSEO task-level errors are surfaced", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();

  await withRawMockedFetch(
    {
      status_code: 20000,
      status_message: "Ok.",
      cost: 0,
      tasks: [
        {
          id: "problem-task",
          status_code: 40000,
          status_message: "Task failure",
          cost: 0,
          data: { tag: "problem_demand" },
          result: [],
        },
      ],
    },
    async () => {
      await assert.rejects(
        () => generateKeywordMetrics(buildSeedKeywords(), "run_test"),
        /task status 40000: Task failure/,
      );
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
  responseConfig: MockResponseConfig,
  run: () => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_url, init) => {
    const body = String(init?.body ?? "");
    fetchCalls.push({ body });
    const [request] = JSON.parse(body) as Array<{ tag: Territory }>;

    return {
      ok: true,
      json: async () =>
        buildDataForSeoResponse(request.tag, responseConfig[request.tag]),
    } as Response;
  }) as typeof fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withRawMockedFetch(
  responseBody: unknown,
  run: () => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: true,
      json: async () => responseBody,
    }) as Response) as typeof fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function buildDataForSeoResponse(
  territory: Territory,
  items: MockKeywordItem[],
) {
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
            total_count: items.length,
            items: items.map((item) => buildDataForSeoItem(item)),
          },
        ],
      },
    ],
  };
}

function buildDataForSeoItem(item: MockKeywordItem) {
  const keyword = typeof item === "string" ? item : item.keyword;
  const searchVolume =
    typeof item === "string"
      ? 100
      : Object.hasOwn(item, "searchVolume")
        ? item.searchVolume
        : 100;

  return {
    keyword,
    keyword_info:
      typeof item === "object" && item.omitKeywordInfo
        ? null
        : {
            search_volume: searchVolume,
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
      buildTerritory("problem_demand", buildSeeds("problem"), [
        "core_problem",
        "icp_qualified_problem",
        "process_or_outcome",
        "market_synonym",
        "core_problem",
        "process_or_outcome",
      ]),
      buildTerritory("solution_demand", buildSeeds("solution"), [
        "core_solution_category",
        "icp_qualified_solution",
        "solution_approach",
        "commercial_category",
        "core_solution_category",
        "commercial_category",
      ]),
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
  roles: string[],
): SeedKeywords["demand_territories"][number] {
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
  return Array.from({ length: 15 }, (_, index) => `${prefix} seed ${index + 1}`);
}
