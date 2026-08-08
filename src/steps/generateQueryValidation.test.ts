import assert from "node:assert/strict";
import test from "node:test";

import type { CompanyProfile } from "../types/companyProfile.schema.js";
import type { KeywordMetrics } from "../types/keywordMetrics.schema.js";
import { QueryValidationSchema } from "../types/queryValidation.schema.js";
import {
  generateConfirmedQueries,
  generateQueryValidation,
  QUERY_VALIDATION_BATCH_SIZE,
  QUERY_VALIDATION_MAX_CONCURRENCY,
} from "./generateQueryValidation.js";

type BatchCall = {
  batchNumber: number;
  totalBatches: number;
  queries: Array<{
    query_id: string;
    territory: "problem_demand" | "solution_demand";
    query: string;
  }>;
  runtimeInput: string;
};
type QueryFixture = {
  query: string;
  core_keyword?: string | null;
};

test("1,000 queries create four concurrent 250-query validation calls", async () => {
  const calls: BatchCall[] = [];
  const resolvers: Array<() => void> = [];
  let active = 0;
  let maxObservedConcurrency = 0;
  let allFourStartedBeforeAnyResolved = false;
  let resolvedCount = 0;

  const promise = generateQueryValidation(
    buildCompanyProfile(),
    buildKeywordMetrics(500, 500),
    "run_test",
    {
      generatedAt: "2026-07-25T00:00:00.000Z",
      batchRunner: async (call) => {
        calls.push(call);
        active += 1;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, active);

        if (calls.length === 4 && resolvedCount === 0) {
          allFourStartedBeforeAnyResolved = true;
        }

        await new Promise<void>((resolve) => {
          resolvers.push(resolve);
        });

        active -= 1;
        resolvedCount += 1;

        return buildBatchResponse(call.queries);
      },
    },
  );

  await waitFor(() => calls.length === 4);

  assert.equal(calls.length, 4);
  assert.deepEqual(
    calls.map((call) => call.queries.length),
    [250, 250, 250, 250],
  );
  assert.equal(allFourStartedBeforeAnyResolved, true);
  assert.equal(maxObservedConcurrency, QUERY_VALIDATION_MAX_CONCURRENCY);

  for (const resolve of resolvers) {
    resolve();
  }

  const artifact = await promise;

  assert.equal(artifact.query_validations.length, 1000);
  assert.equal(calls[0].queries[0].query_id, "problem_demand_001");
  assert.equal(calls[3].queries[249].query_id, "solution_demand_500");
});

test("fewer queries create ordered batches with a preserved partial final batch", async () => {
  const calls: BatchCall[] = [];

  const artifact = await generateQueryValidation(
    buildCompanyProfile(),
    buildKeywordMetrics(300, 26),
    "run_test",
    {
      generatedAt: "2026-07-25T00:00:00.000Z",
      batchRunner: async (call) => {
        calls.push(call);
        return buildBatchResponse(call.queries);
      },
    },
  );

  assert.deepEqual(
    calls.map((call) => call.queries.length),
    [QUERY_VALIDATION_BATCH_SIZE, 76],
  );
  assert.equal(calls[0].batchNumber, 1);
  assert.equal(calls[1].batchNumber, 2);
  assert.equal(calls[1].totalBatches, 2);
  assert.equal(artifact.query_validations.length, 326);
  assert.equal(artifact.query_validations[250].query_id, "problem_demand_251");
});

test("compact model responses restore full artifact fields in canonical order", async () => {
  const artifact = await generateQueryValidation(
    buildCompanyProfile(),
    buildKeywordMetrics(2, 2),
    "run_test",
    {
      generatedAt: "2026-07-25T00:00:00.000Z",
      batchRunner: async (call) => ({
        query_validations: call.queries.map((query, index) => ({
          query_id: query.query_id,
          verdict: index % 2 === 0 ? "valid" : "invalid",
          reasoning: `Decision for ${query.query_id}.`,
        })),
      }),
    },
  );

  assert.deepEqual(Object.keys(artifact.query_validations[0]).sort(), [
    "query",
    "query_id",
    "reasoning",
    "territory",
    "verdict",
  ]);
  assert.deepEqual(
    artifact.query_validations.map((validation) => ({
      query_id: validation.query_id,
      territory: validation.territory,
      query: validation.query,
    })),
    [
      {
        query_id: "problem_demand_001",
        territory: "problem_demand",
        query: "problem query 1",
      },
      {
        query_id: "problem_demand_002",
        territory: "problem_demand",
        query: "problem query 2",
      },
      {
        query_id: "solution_demand_001",
        territory: "solution_demand",
        query: "solution query 1",
      },
      {
        query_id: "solution_demand_002",
        territory: "solution_demand",
        query: "solution query 2",
      },
    ],
  );
  assert.equal(QueryValidationSchema.parse(artifact), artifact);
});

test("hyphen and whitespace variants produce one representative LLM input", async () => {
  const calls: BatchCall[] = [];
  const artifact = await generateQueryValidation(
    buildCompanyProfile(),
    buildKeywordMetricsFromQueries(
      [
        { query: "cloud-based help desk software" },
        { query: "cloud based help desk software" },
        { query: "customer feedback software" },
      ],
      [],
    ),
    "run_test",
    {
      generatedAt: "2026-07-25T00:00:00.000Z",
      batchRunner: async (call) => {
        calls.push(call);
        return buildBatchResponse(call.queries);
      },
    },
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(
    calls[0].queries.map((query) => query.query_id),
    ["problem_demand_001", "problem_demand_003"],
  );
  assert.deepEqual(
    artifact.query_validations.map((validation) => ({
      query_id: validation.query_id,
      query: validation.query,
      verdict: validation.verdict,
    })),
    [
      {
        query_id: "problem_demand_001",
        query: "cloud-based help desk software",
        verdict: "valid",
      },
      {
        query_id: "problem_demand_002",
        query: "cloud based help desk software",
        verdict: "invalid",
      },
      {
        query_id: "problem_demand_003",
        query: "customer feedback software",
        verdict: "valid",
      },
    ],
  );
  assert.match(
    artifact.query_validations[1].reasoning,
    /normalized duplicate of "cloud-based help desk software"/,
  );
});

test("core_keyword is ignored when determining duplicate equivalence", async () => {
  const calls: BatchCall[] = [];
  const artifact = await generateQueryValidation(
    buildCompanyProfile(),
    buildKeywordMetricsFromQueries(
      [
        { query: "dynamic workflows", core_keyword: "shared core keyword" },
        { query: "dynamic workflow", core_keyword: "shared core keyword" },
        { query: "workflow orchestration" },
      ],
      [],
    ),
    "run_test",
    {
      generatedAt: "2026-07-25T00:00:00.000Z",
      batchRunner: async (call) => {
        calls.push(call);
        return buildBatchResponse(call.queries);
      },
    },
  );

  assert.deepEqual(
    calls[0].queries.map((query) => ({
      query_id: query.query_id,
      query: query.query,
    })),
    [
      { query_id: "problem_demand_001", query: "dynamic workflows" },
      { query_id: "problem_demand_002", query: "dynamic workflow" },
      { query_id: "problem_demand_003", query: "workflow orchestration" },
    ],
  );
  assert.deepEqual(
    artifact.query_validations.map((validation) => validation.query_id),
    ["problem_demand_001", "problem_demand_002", "problem_demand_003"],
  );
  assert.deepEqual(
    artifact.query_validations.map((validation) => validation.verdict),
    ["valid", "valid", "valid"],
  );
});

test("missing empty or misleading core_keyword cannot change duplicate equivalence", async () => {
  const calls: BatchCall[] = [];
  const artifact = await generateQueryValidation(
    buildCompanyProfile(),
    buildKeywordMetricsFromQueries(
      [
        { query: "cloud-based help desk software", core_keyword: "" },
        {
          query: "Cloud based   help desk software",
          core_keyword: "unrelated provider core",
        },
        { query: "research & development tools", core_keyword: null },
        {
          query: "research and development tools",
          core_keyword: "different provider core",
        },
      ],
      [],
    ),
    "run_test",
    {
      generatedAt: "2026-07-25T00:00:00.000Z",
      batchRunner: async (call) => {
        calls.push(call);
        return buildBatchResponse(call.queries);
      },
    },
  );

  assert.deepEqual(
    calls[0].queries.map((query) => query.query_id),
    ["problem_demand_001", "problem_demand_003"],
  );
  assert.deepEqual(
    artifact.query_validations.map((validation) => validation.verdict),
    ["valid", "invalid", "valid", "invalid"],
  );
  assert.match(
    artifact.query_validations[1].reasoning,
    /normalized duplicate of "cloud-based help desk software"/,
  );
  assert.match(
    artifact.query_validations[3].reasoning,
    /normalized duplicate of "research & development tools"/,
  );
});

test("mechanical normalization deduplicates only exact normalized query-string equivalents", async () => {
  const calls: BatchCall[] = [];
  const artifact = await generateQueryValidation(
    buildCompanyProfile(),
    buildKeywordMetricsFromQueries(
      [
        { query: "Customer’s workflow" },
        { query: "customer's workflow" },
        { query: "customers workflow" },
        { query: "client, onboarding!" },
        { query: "client onboarding" },
        { query: "ｐｒｏｄｕｃｔ feedback" },
        { query: "product feedback" },
        { query: "roadmap–planning" },
        { query: "roadmap planning" },
      ],
      [],
    ),
    "run_test",
    {
      generatedAt: "2026-07-25T00:00:00.000Z",
      batchRunner: async (call) => {
        calls.push(call);
        return buildBatchResponse(call.queries);
      },
    },
  );

  assert.deepEqual(
    calls[0].queries.map((query) => query.query_id),
    [
      "problem_demand_001",
      "problem_demand_004",
      "problem_demand_006",
      "problem_demand_008",
    ],
  );
  assert.deepEqual(
    artifact.query_validations.map((validation) => validation.verdict),
    [
      "valid",
      "invalid",
      "invalid",
      "valid",
      "invalid",
      "valid",
      "invalid",
      "valid",
      "invalid",
    ],
  );
});

test("plus and hash remain meaningful in normalization keys", async () => {
  const calls: BatchCall[] = [];

  await generateQueryValidation(
    buildCompanyProfile(),
    buildKeywordMetricsFromQueries(
      [{ query: "C" }, { query: "C++" }, { query: "C#" }],
      [],
    ),
    "run_test",
    {
      generatedAt: "2026-07-25T00:00:00.000Z",
      batchRunner: async (call) => {
        calls.push(call);
        return buildBatchResponse(call.queries);
      },
    },
  );

  assert.deepEqual(
    calls[0].queries.map((query) => query.query_id),
    ["problem_demand_001", "problem_demand_002", "problem_demand_003"],
  );
});

test("distinct phrases are not merged by stemming semantics or token reordering", async () => {
  const calls: BatchCall[] = [];

  await generateQueryValidation(
    buildCompanyProfile(),
    buildKeywordMetricsFromQueries(
      [
        { query: "product management software" },
        { query: "production management software" },
        { query: "wedding planner proposal" },
        { query: "wedding proposal planner" },
        { query: "workflow engine software" },
        { query: "engineering workflow software" },
        { query: "product workflow" },
        { query: "production workflows" },
        { query: "product marketing definition" },
        { query: "product market definition" },
        { query: "invoice template" },
        { query: "invoice templates" },
      ],
      [],
    ),
    "run_test",
    {
      generatedAt: "2026-07-25T00:00:00.000Z",
      batchRunner: async (call) => {
        calls.push(call);
        return buildBatchResponse(call.queries);
      },
    },
  );

  assert.deepEqual(
    calls[0].queries.map((query) => query.query_id),
    Array.from(
      { length: 12 },
      (_, index) => `problem_demand_${String(index + 1).padStart(3, "0")}`,
    ),
  );
});

test("duplicate validations cannot enter confirmed queries", async () => {
  const keywordMetrics = buildKeywordMetricsFromQueries(
    [
      { query: "cloud-based help desk software" },
      { query: "cloud based help desk software" },
    ],
    [],
  );
  const validation = await generateQueryValidation(
    buildCompanyProfile(),
    keywordMetrics,
    "run_test",
    {
      generatedAt: "2026-07-25T00:00:00.000Z",
      batchRunner: async (call) => buildBatchResponse(call.queries),
    },
  );
  const confirmedQueries = generateConfirmedQueries(validation, keywordMetrics);

  assert.deepEqual(
    confirmedQueries.confirmed_queries.map((query) => query.query_id),
    ["problem_demand_001"],
  );
});

test("identical normalized queries in different territories are preserved once per territory", async () => {
  const calls: BatchCall[] = [];

  await generateQueryValidation(
    buildCompanyProfile(),
    buildKeywordMetricsFromQueries(
      [{ query: "workflow automation" }],
      [{ query: "workflow-automation" }],
    ),
    "run_test",
    {
      generatedAt: "2026-07-25T00:00:00.000Z",
      batchRunner: async (call) => {
        calls.push(call);
        return buildBatchResponse(call.queries);
      },
    },
  );

  assert.deepEqual(
    calls[0].queries.map((query) => query.query_id),
    ["problem_demand_001", "solution_demand_001"],
  );
});

test("meaningfully different queries are not merged", async () => {
  const calls: BatchCall[] = [];

  await generateQueryValidation(
    buildCompanyProfile(),
    buildKeywordMetricsFromQueries(
      [
        { query: "C++ workflow automation" },
        { query: "C# workflow automation" },
        { query: "help desk software" },
        { query: "helpdesk software" },
      ],
      [],
    ),
    "run_test",
    {
      generatedAt: "2026-07-25T00:00:00.000Z",
      batchRunner: async (call) => {
        calls.push(call);
        return buildBatchResponse(call.queries);
      },
    },
  );

  assert.deepEqual(
    calls[0].queries.map((query) => query.query_id),
    [
      "problem_demand_001",
      "problem_demand_002",
      "problem_demand_003",
      "problem_demand_004",
    ],
  );
});

test("250-query batching and max concurrency use representative count", async () => {
  const calls: BatchCall[] = [];
  const resolvers: Array<() => void> = [];
  let active = 0;
  let maxObservedConcurrency = 0;
  const duplicatePairs = Array.from({ length: 10 }, (_, index) => [
    { query: `duplicate-topic-${index + 1}` },
    { query: `duplicate topic ${index + 1}` },
  ]).flat();
  const uniqueQueries = Array.from({ length: 980 }, (_, index) => ({
    query: `unique topic ${index + 1}`,
  }));

  const promise = generateQueryValidation(
    buildCompanyProfile(),
    buildKeywordMetricsFromQueries([...duplicatePairs, ...uniqueQueries], []),
    "run_test",
    {
      generatedAt: "2026-07-25T00:00:00.000Z",
      batchRunner: async (call) => {
        calls.push(call);
        active += 1;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, active);

        await new Promise<void>((resolve) => {
          resolvers.push(resolve);
        });

        active -= 1;

        return buildBatchResponse(call.queries);
      },
    },
  );

  await waitFor(() => calls.length === 4);

  assert.deepEqual(
    calls.map((call) => call.queries.length),
    [250, 250, 250, 240],
  );
  assert.equal(maxObservedConcurrency, QUERY_VALIDATION_MAX_CONCURRENCY);

  for (const resolve of resolvers) {
    resolve();
  }

  const artifact = await promise;

  assert.equal(artifact.query_validations.length, 1000);
  assert.equal(
    artifact.query_validations.filter(
      (validation) =>
        validation.verdict === "invalid" &&
        validation.reasoning.includes("normalized duplicate"),
    ).length,
    10,
  );
});

test("duplicate IDs within a batch fail", async () => {
  await assert.rejects(
    () =>
      generateQueryValidation(
        buildCompanyProfile(),
        buildKeywordMetrics(2, 0),
        "run_test",
        {
          batchRunner: async (call) => ({
            query_validations: [
              {
                query_id: call.queries[0].query_id,
                verdict: "valid",
                reasoning: "First decision.",
              },
              {
                query_id: call.queries[0].query_id,
                verdict: "invalid",
                reasoning: "Duplicate decision.",
              },
            ],
          }),
        },
      ),
    /duplicate problem_demand_001/,
  );
});

test("duplicate IDs across batches fail", async () => {
  await assert.rejects(
    () =>
      generateQueryValidation(
        buildCompanyProfile(),
        buildKeywordMetrics(251, 0),
        "run_test",
        {
          batchRunner: async (call) => ({
            query_validations: call.queries.map((query, index) => ({
              query_id:
                call.batchNumber === 2 && index === 0
                  ? "problem_demand_001"
                  : query.query_id,
              verdict: "valid",
              reasoning: `Decision for ${query.query_id}.`,
            })),
          }),
        },
      ),
    /batch 2 returned duplicate query_id problem_demand_001 across batches/,
  );
});

test("unknown IDs fail", async () => {
  await assert.rejects(
    () =>
      generateQueryValidation(
        buildCompanyProfile(),
        buildKeywordMetrics(1, 0),
        "run_test",
        {
          batchRunner: async () => ({
            query_validations: [
              {
                query_id: "unknown_001",
                verdict: "valid",
                reasoning: "Unknown decision.",
              },
            ],
          }),
        },
      ),
    /unknown query_id unknown_001/,
  );
});

test("missing IDs fail", async () => {
  await assert.rejects(
    () =>
      generateQueryValidation(
        buildCompanyProfile(),
        buildKeywordMetrics(2, 0),
        "run_test",
        {
          batchRunner: async (call) => ({
            query_validations: [call.queries[0]].map((query) => ({
              query_id: query.query_id,
              verdict: "valid",
              reasoning: "Only one decision.",
            })),
          }),
        },
      ),
    /returned 1 validations for 2 input queries/,
  );
});

test("missing batch response is retried once before completing", async () => {
  let attempts = 0;

  const artifact = await generateQueryValidation(
    buildCompanyProfile(),
    buildKeywordMetrics(2, 0),
    "run_test",
    {
      batchRunner: async (call) => {
        attempts += 1;

        if (attempts === 1) {
          return {
            query_validations: [call.queries[0]].map((query) => ({
              query_id: query.query_id,
              verdict: "valid",
              reasoning: "Only one decision.",
            })),
          };
        }

        return buildBatchResponse(call.queries);
      },
    },
  );

  assert.equal(attempts, 2);
  assert.deepEqual(
    artifact.query_validations.map((validation) => validation.query_id),
    ["problem_demand_001", "problem_demand_002"],
  );
});

test("reordered IDs within a batch fail", async () => {
  await assert.rejects(
    () =>
      generateQueryValidation(
        buildCompanyProfile(),
        buildKeywordMetrics(2, 0),
        "run_test",
        {
          batchRunner: async (call) => ({
            query_validations: [...call.queries].reverse().map((query) => ({
              query_id: query.query_id,
              verdict: "valid",
              reasoning: `Decision for ${query.query_id}.`,
            })),
          }),
        },
      ),
    /out of order at index 0/,
  );
});

test("one failed batch rejects the stage and returns no partial artifact", async () => {
  let artifact:
    | Awaited<ReturnType<typeof generateQueryValidation>>
    | undefined;

  await assert.rejects(
    async () => {
      artifact = await generateQueryValidation(
        buildCompanyProfile(),
        buildKeywordMetrics(251, 0),
        "run_test",
        {
          batchRunner: async (call) => {
            if (call.batchNumber === 2) {
              throw new Error("Batch failed.");
            }

            return buildBatchResponse(call.queries);
          },
        },
      );
    },
    /Batch failed/,
  );
  assert.equal(artifact, undefined);
});

function buildBatchResponse(queries: BatchCall["queries"]) {
  return {
    query_validations: queries.map((query) => ({
      query_id: query.query_id,
      verdict: "valid" as const,
      reasoning: `The query ${query.query_id} is topically relevant.`,
    })),
  };
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempts = 0; attempts < 100; attempts += 1) {
    if (condition()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error("Timed out waiting for condition.");
}

function buildCompanyProfile(): CompanyProfile {
  return {
    website_url: "https://example.com",
    company_identity: {
      company_name: { value: "Example", confidence: "high", evidence: [] },
      product_category: {
        value: "Example software",
        confidence: "high",
        evidence: [],
      },
    },
    icp_and_audience: {
      primary_icp: {
        value: "Example buyers",
        confidence: "high",
        evidence: [],
      },
    },
  } as unknown as CompanyProfile;
}

function buildKeywordMetrics(
  problemCount: number,
  solutionCount: number,
): KeywordMetrics {
  return buildKeywordMetricsFromQueries(
    Array.from({ length: problemCount }, (_, index) => ({
      query: `problem query ${index + 1}`,
    })),
    Array.from({ length: solutionCount }, (_, index) => ({
      query: `solution query ${index + 1}`,
    })),
  );
}

function buildKeywordMetricsFromQueries(
  problemQueries: QueryFixture[],
  solutionQueries: QueryFixture[],
): KeywordMetrics {
  return {
    schema_version: "1.0.0",
    run_id: "run_metrics",
    generated_at: "2026-07-25T00:00:00.000Z",
    source_artifacts: ["seed-keywords.json"],
    status: "complete",
    warnings: [],
    website_url: "https://example.com",
    provider: {
      name: "dataforseo",
      endpoint: "/v3/dataforseo_labs/google/keyword_ideas/live",
      http_requests_made: 2,
      tasks_submitted: 2,
      total_cost_usd: 0,
    },
    request_config: {
      location_code: 2840,
      language_code: "en",
      limit_per_task: 500,
      closely_variants: true,
      ignore_synonyms: false,
      include_serp_info: true,
      include_clickstream_data: false,
      filters: [
        ["keyword_info.search_volume", ">", 50],
        "and",
        ["keyword_properties.is_another_language", "=", false],
        "and",
        ["keyword_properties.words_count", ">=", 2],
        "and",
        ["serp_info.serp_item_types", "has_not", "local_pack"],
        "and",
        [
          "keyword",
          "not_regex",
          "(^|\\s)(near me|nearby|in my area|open now|opening hours|directions)(\\s|$)",
        ],
        "and",
        ["search_intent_info.main_intent", "<>", "navigational"],
      ],
      order_by: ["relevance,desc", "keyword_info.search_volume,desc"],
      minimum_search_volume: 50,
    },
    query_sets: [
      buildQuerySet("problem_demand", problemQueries),
      buildQuerySet("solution_demand", solutionQueries),
    ],
    summary: {
      problem_queries_received: problemQueries.length,
      solution_queries_received: solutionQueries.length,
      total_queries_received: problemQueries.length + solutionQueries.length,
      unique_queries_received: problemQueries.length + solutionQueries.length,
      queries_returned_in_both_sets: 0,
      missing_search_volume_count: 0,
      missing_keyword_difficulty_count: 0,
      missing_search_intent_count: 0,
      missing_average_top_10_count: 0,
    },
  } as KeywordMetrics;
}

function buildQuerySet(
  territory: "problem_demand" | "solution_demand",
  queries: QueryFixture[],
) {
  return {
    territory,
    task_tag: territory,
    seeds_used: Array.from(
      { length: 15 },
      (_, index) => `${territory} seed ${index + 1}`,
    ),
    task_result: {
      task_id: `${territory}_task`,
      status_code: 20000,
      status_message: "Ok.",
      cost_usd: 0,
      total_available_results: queries.length,
      items_received: queries.length,
    },
    queries: queries.map((query, index) => ({
      query: query.query,
      discovery_rank: index + 1,
      core_keyword: query.core_keyword ?? null,
      detected_language: "en",
      metrics: buildQueryMetrics(index),
    })),
  };
}

function buildQueryMetrics(index: number) {
  return {
    search_volume: 100 + index,
    monthly_searches: [],
    search_volume_trend: null,
    cpc: 1,
    paid_competition: 0.5,
    paid_competition_level: "MEDIUM",
    keyword_difficulty: 20,
    search_intent: {
      main: "informational",
      secondary: [],
    },
    average_top_10: null,
  };
}
