import assert from "node:assert/strict";
import test from "node:test";

import {
  DISCOVERY_GROUP_IDS,
  type DiscoveryGroupId,
  type SeedKeywords,
} from "../types/seedKeywords.schema.js";

type MockKeywordItem =
  | string
  | {
      keyword: string;
      searchVolume?: number | null;
      omitKeywordInfo?: boolean;
    };
type MockResponseConfig = Record<DiscoveryGroupId, MockKeywordItem[]>;

test("DataForSEO task construction preserves configuration and provides 1,000 total capacity", async () => {
  const {
    buildKeywordIdeasTask,
    CANDIDATES_PER_DISCOVERY_GROUP,
    MAX_TOTAL_CANDIDATES,
  } = await importKeywordMetricsModule();
  const seeds = buildSeeds("core_problem_demand");
  const task = buildKeywordIdeasTask("core_problem_demand", seeds);

  assert.deepEqual(task.keywords, seeds);
  assert.equal(task.limit, 250);
  assert.equal(task.tag, "core_problem_demand");
  assert.equal(CANDIDATES_PER_DISCOVERY_GROUP * 4, 1_000);
  assert.equal(MAX_TOTAL_CANDIDATES, 1_000);
  assert.equal(task.location_code, 2840);
  assert.equal(task.language_code, "en");
  assert.equal(task.closely_variants, true);
  assert.equal(task.ignore_synonyms, false);
  assert.equal(task.include_serp_info, true);
  assert.equal(task.include_clickstream_data, false);
  assert.ok(
    JSON.stringify(task.filters).includes(
      JSON.stringify(["keyword_info.search_volume", ">", 10]),
    ),
  );
  assert.deepEqual(task.order_by, [
    "relevance,desc",
    "keyword_info.search_volume,desc",
  ]);
});

test("generateKeywordMetrics makes exactly four correctly tagged group requests", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();
  const fetchCalls: Array<{ body: string }> = [];

  await withMockedFetch(fetchCalls, buildResponseConfig(), async () => {
    const artifact = await generateKeywordMetrics(buildSeedKeywords(), "run_test");
    const tasks = fetchCalls.map((call) => JSON.parse(call.body)[0]);

    assert.equal(fetchCalls.length, 4);
    assert.deepEqual(
      tasks.map((task) => task.keywords),
      DISCOVERY_GROUP_IDS.map(buildSeeds),
    );
    assert.deepEqual(
      tasks.map((task) => task.tag),
      DISCOVERY_GROUP_IDS,
    );
    assert.deepEqual(
      tasks.map((task) => task.limit),
      [250, 250, 250, 250],
    );
    assert.equal(artifact.provider.http_requests_made, 4);
    assert.equal(artifact.provider.tasks_submitted, 4);
    assert.equal(artifact.provider.total_cost_usd, 0.04);
    assert.equal(artifact.request_config.limit_per_task, 250);
    assert.deepEqual(
      artifact.query_sets.flatMap((set) =>
        set.discovery_tasks.map((task) => task.task_result.task_id),
      ),
      DISCOVERY_GROUP_IDS.map((group) => `${group}-task`),
    );
  });
});

test("core and adjacent results merge deterministically with deduped queries and regenerated ranks", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();
  const fetchCalls: Array<{ body: string }> = [];
  const config = buildResponseConfig({
    core_problem_demand: ["core first", "shared problem", "core last"],
    adjacent_problem_demand: [
      "adjacent first",
      "  SHARED PROBLEM  ",
      "adjacent last",
    ],
    core_solution_demand: ["core solution"],
    adjacent_solution_demand: ["adjacent solution"],
  });

  await withMockedFetch(fetchCalls, config, async () => {
    const artifact = await generateKeywordMetrics(buildSeedKeywords(), "run_test");
    const [problemSet, solutionSet] = artifact.query_sets;

    assert.equal(problemSet.territory, "problem_demand");
    assert.deepEqual(
      problemSet.queries.map((query) => query.query),
      ["core first", "shared problem", "core last", "adjacent first", "adjacent last"],
    );
    assert.deepEqual(
      problemSet.queries.map((query) => query.discovery_rank),
      [1, 2, 3, 4, 5],
    );
    assert.deepEqual(
      problemSet.queries.map((query) => query.discovery_group),
      [
        "core_problem_demand",
        "core_problem_demand",
        "core_problem_demand",
        "adjacent_problem_demand",
        "adjacent_problem_demand",
      ],
    );
    assert.deepEqual(
      problemSet.queries[3].source_seed_keywords,
      buildSeeds("adjacent_problem_demand"),
    );
    assert.deepEqual(
      problemSet.discovery_tasks.map((task) => task.task_result.queries_retained),
      [3, 2],
    );
    assert.equal(solutionSet.territory, "solution_demand");
    assert.deepEqual(
      solutionSet.queries.map((query) => query.query),
      ["core solution", "adjacent solution"],
    );
  });
});

test("defensive response filtering accepts 11 and excludes search volumes 10, below 10, null, and missing", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();
  const fetchCalls: Array<{ body: string }> = [];
  const config = buildResponseConfig({
    core_problem_demand: [
      { keyword: "volume 11", searchVolume: 11 },
      { keyword: "volume 10", searchVolume: 10 },
      { keyword: "volume 9", searchVolume: 9 },
      { keyword: "volume null", searchVolume: null },
      { keyword: "missing keyword info", omitKeywordInfo: true },
    ],
  });

  await withMockedFetch(fetchCalls, config, async () => {
    const artifact = await generateKeywordMetrics(buildSeedKeywords(), "run_test");

    assert.deepEqual(
      artifact.query_sets[0].queries.map((query) => query.query),
      ["volume 11"],
    );
  });
});

test("fewer than 1,000 results is accepted normally", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();
  const fetchCalls: Array<{ body: string }> = [];

  await withMockedFetch(
    fetchCalls,
    buildResponseConfig({ core_problem_demand: ["problem query"] }),
    async () => {
      const artifact = await generateKeywordMetrics(buildSeedKeywords(), "run_test");

      assert.equal(artifact.summary.problem_queries_received, 1);
      assert.equal(artifact.summary.solution_queries_received, 0);
      assert.equal(artifact.summary.total_queries_received, 1);
      assert.equal(artifact.status, "complete");
      assert.equal(fetchCalls.length, 4);
    },
  );
});

test("provider overflow is capped at 250 per group, 500 per territory, and 1,000 total", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();
  const fetchCalls: Array<{ body: string }> = [];
  const config = buildResponseConfig(
    Object.fromEntries(
      DISCOVERY_GROUP_IDS.map((group) => [
        group,
        Array.from(
          { length: 251 },
          (_, index) => `${group} candidate ${index + 1}`,
        ),
      ]),
    ) as MockResponseConfig,
  );

  await withMockedFetch(fetchCalls, config, async () => {
    const artifact = await generateKeywordMetrics(buildSeedKeywords(), "run_test");

    assert.deepEqual(
      artifact.query_sets.map((querySet) => querySet.queries.length),
      [500, 500],
    );
    assert.deepEqual(
      artifact.query_sets.flatMap((querySet) =>
        querySet.discovery_tasks.map(
          (task) => task.task_result.items_received,
        ),
      ),
      [250, 250, 250, 250],
    );
    assert.equal(artifact.summary.total_queries_received, 1_000);
  });
});

test("duplicate provider results within a discovery group are removed", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();
  const fetchCalls: Array<{ body: string }> = [];

  await withMockedFetch(
    fetchCalls,
    buildResponseConfig({
      core_problem_demand: ["duplicate query", "duplicate query", "unique query"],
    }),
    async () => {
      const artifact = await generateKeywordMetrics(buildSeedKeywords(), "run_test");
      const problemSet = artifact.query_sets[0];

      assert.deepEqual(
        problemSet.queries.map((query) => query.query),
        ["duplicate query", "unique query"],
      );
      assert.equal(problemSet.discovery_tasks[0].task_result.items_received, 3);
      assert.equal(problemSet.discovery_tasks[0].task_result.queries_retained, 2);
    },
  );
});

test("DataForSEO root-level errors are surfaced without fallback expansion", async () => {
  const { generateKeywordMetrics } = await importKeywordMetricsModule();

  await withRawMockedFetch(
    () => ({ status_code: 40000, status_message: "Root failure", tasks: [] }),
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
    (group) => ({
      status_code: 20000,
      status_message: "Ok.",
      cost: 0,
      tasks: [
        {
          id: `${group}-task`,
          status_code: group === "core_problem_demand" ? 40000 : 20000,
          status_message: group === "core_problem_demand" ? "Task failure" : "Ok.",
          cost: 0,
          data: { tag: group },
          result: [{ total_count: 0, items: [] }],
        },
      ],
    }),
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
    const [request] = JSON.parse(body) as Array<{ tag: DiscoveryGroupId }>;

    return {
      ok: true,
      json: async () => buildDataForSeoResponse(request.tag, responseConfig[request.tag]),
    } as Response;
  }) as typeof fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withRawMockedFetch(
  buildResponse: (group: DiscoveryGroupId) => unknown,
  run: () => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_url, init) => {
    const [request] = JSON.parse(String(init?.body ?? "")) as Array<{
      tag: DiscoveryGroupId;
    }>;
    return {
      ok: true,
      json: async () => buildResponse(request.tag),
    } as Response;
  }) as typeof fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function buildResponseConfig(
  overrides: Partial<MockResponseConfig> = {},
): MockResponseConfig {
  return Object.fromEntries(
    DISCOVERY_GROUP_IDS.map((group) => [group, overrides[group] ?? []]),
  ) as MockResponseConfig;
}

function buildDataForSeoResponse(group: DiscoveryGroupId, items: MockKeywordItem[]) {
  return {
    status_code: 20000,
    status_message: "Ok.",
    cost: 0.01,
    tasks: [
      {
        id: `${group}-task`,
        status_code: 20000,
        status_message: "Ok.",
        cost: 0.01,
        data: { tag: group },
        result: [
          {
            total_count: items.length,
            items: items.map(buildDataForSeoItem),
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
    schema_version: "2.1.0",
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
    demand_groups: DISCOVERY_GROUP_IDS.map((groupId) => ({
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
      seed_keywords: buildSeeds(groupId).map((keyword, index) => ({
        seed_id: `${groupId}_seed_${index + 1}`,
        keyword,
        seed_role: `discovery_angle_${index + 1}`,
        selection_reasoning: "Distinct discovery angle.",
        confidence: "medium",
      })),
    })),
    generation_quality: {
      overall_confidence: "medium",
      missing_information: [],
      potential_risks: [],
      notes: "Test fixture.",
    },
  };
}

function buildSeeds(group: DiscoveryGroupId): string[] {
  return Array.from(
    { length: 6 },
    (_, index) => `${group.replaceAll("_", " ")} seed ${index + 1}`,
  );
}
