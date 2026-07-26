import assert from "node:assert/strict";
import test from "node:test";

import type { CompanyProfile } from "../types/companyProfile.schema.js";
import type { KeywordMetrics } from "../types/keywordMetrics.schema.js";
import { QueryValidationSchema } from "../types/queryValidation.schema.js";
import {
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
  } as CompanyProfile;
}

function buildKeywordMetrics(
  problemCount: number,
  solutionCount: number,
): KeywordMetrics {
  return {
    website_url: "https://example.com",
    query_sets: [
      buildQuerySet("problem_demand", problemCount),
      buildQuerySet("solution_demand", solutionCount),
    ],
  } as KeywordMetrics;
}

function buildQuerySet(
  territory: "problem_demand" | "solution_demand",
  count: number,
) {
  const prefix = territory === "problem_demand" ? "problem" : "solution";

  return {
    territory,
    queries: Array.from({ length: count }, (_, index) => ({
      query: `${prefix} query ${index + 1}`,
    })),
  };
}
