import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import { runStructuredPromptFile } from "../llm/runStructuredPromptFile.js";
import type { CompanyProfile } from "../types/companyProfile.schema.js";
import {
  KeywordMetricsSchema,
  type KeywordMetrics,
} from "../types/keywordMetrics.schema.js";
import {
  ConfirmedQueriesSchema,
  type ConfirmedQueries,
} from "../types/confirmedQueries.schema.js";
import {
  QueryValidationBatchSchema,
  QueryValidationSchema,
  type QueryValidationBatch,
  type QueryValidation,
} from "../types/queryValidation.schema.js";

export const QUERY_VALIDATION_BATCH_SIZE = 250;
export const QUERY_VALIDATION_MAX_CONCURRENCY = 4;

type QueryValidationInputQuery = {
  query_id: string;
  territory: "problem_demand" | "solution_demand";
  query: string;
};
type QueryValidationTerritory = QueryValidationInputQuery["territory"];

const QUERY_VALIDATION_TERRITORY_ORDER: QueryValidationTerritory[] = [
  "problem_demand",
  "solution_demand",
];

type QueryValidationBatchRunner = (input: {
  runtimeInput: string;
  batchNumber: number;
  totalBatches: number;
  queries: QueryValidationInputQuery[];
}) => Promise<QueryValidationBatch>;

export type GenerateQueryValidationDependencies = {
  batchRunner?: QueryValidationBatchRunner;
  generatedAt?: string;
};

type CanonicalMetricQuery = {
  query_id: string;
  territory: "problem_demand" | "solution_demand";
  query: string;
  source_seed_keywords: string[];
  discovery_rank: number;
  core_keyword: string | null;
  detected_language: string | null;
  metrics: KeywordMetrics["query_sets"][number]["queries"][number]["metrics"];
};

export async function generateQueryValidation(
  companyProfile: CompanyProfile,
  keywordMetrics: KeywordMetrics,
  runId: string,
  dependencies: GenerateQueryValidationDependencies = {},
): Promise<QueryValidation> {
  logStep("Starting query validation");

  const generatedAt = dependencies.generatedAt ?? new Date().toISOString();
  const queries = buildInputQueries(keywordMetrics);
  const batches = chunkQueries(queries, QUERY_VALIDATION_BATCH_SIZE);
  const totalBatches = batches.length;
  const batchRunner = dependencies.batchRunner ?? runQueryValidationBatch;

  logInfo(`Total query validation input queries: ${queries.length}`);
  logInfo(`Query validation batch size: ${QUERY_VALIDATION_BATCH_SIZE}`);
  logInfo(`Query validation batch count: ${totalBatches}`);
  logInfo(
    `Query validation maximum concurrency: ${QUERY_VALIDATION_MAX_CONCURRENCY}`,
  );

  const batchResults = await runConcurrentBatches(
    batches.map((batchQueries, index) => ({
      batchNumber: index + 1,
      totalBatches,
      queries: batchQueries,
      runtimeInput: buildBatchRuntimeInput(
        companyProfile,
        index + 1,
        totalBatches,
        batchQueries,
      ),
    })),
    QUERY_VALIDATION_MAX_CONCURRENCY,
    async (batch) => {
      logStep(
        `Starting query validation batch ${batch.batchNumber}/${batch.totalBatches}`,
      );
      logInfo(
        `Query validation batch ${batch.batchNumber} input count: ${batch.queries.length}`,
      );

      const batchResult = QueryValidationBatchSchema.parse(
        await batchRunner(batch),
      );

      logSuccess(
        `Query validation batch ${batch.batchNumber}/${batch.totalBatches} completed`,
      );
      logInfo(
        `Query validation batch ${batch.batchNumber} returned validation count: ${batchResult.query_validations.length}`,
      );

      validateBatchResultShape(batchResult, batch.queries, batch.batchNumber);

      return batchResult;
    },
  );

  const queryValidation = reconstructQueryValidationArtifact({
    companyProfile,
    runId,
    generatedAt,
    inputQueries: queries,
    batchResults,
  });

  validateBatchResultOrder(batchResults, batches);
  validateQueryIntegrity(queryValidation, queries);

  const validCount = queryValidation.query_validations.filter(
    (validation) => validation.verdict === "valid",
  ).length;
  const invalidCount = queryValidation.query_validations.length - validCount;

  logSuccess("Query validation completed");
  logInfo(`Query validation count: ${queryValidation.query_validations.length}`);
  logInfo(`Valid query count: ${validCount}`);
  logInfo(`Invalid query count: ${invalidCount}`);

  return queryValidation;
}

async function runQueryValidationBatch(input: {
  runtimeInput: string;
  batchNumber: number;
  totalBatches: number;
  queries: QueryValidationInputQuery[];
}): Promise<QueryValidationBatch> {
  return runStructuredPromptFile<QueryValidationBatch>({
    promptFileName: "generate-query-validation.md",
    runtimeInput: input.runtimeInput,
    schema: QueryValidationBatchSchema,
    fallbackSchemaName: "QueryValidationBatchSchema",
  });
}

function buildBatchRuntimeInput(
  companyProfile: CompanyProfile,
  batchNumber: number,
  totalBatches: number,
  queries: QueryValidationInputQuery[],
): string {
  return `<query_validation_input>
  <company_profile>
    ${JSON.stringify(companyProfile, null, 2)}
  </company_profile>

  <batch_metadata>
    ${JSON.stringify(
      {
        batch_number: batchNumber,
        total_batches: totalBatches,
      },
      null,
      2,
    )}
  </batch_metadata>

  <queries>
    ${JSON.stringify(queries, null, 2)}
  </queries>
</query_validation_input>`;
}

function chunkQueries(
  queries: QueryValidationInputQuery[],
  batchSize: number,
): QueryValidationInputQuery[][] {
  const chunks: QueryValidationInputQuery[][] = [];

  for (let index = 0; index < queries.length; index += batchSize) {
    chunks.push(queries.slice(index, index + batchSize));
  }

  return chunks;
}

async function runConcurrentBatches<TInput, TResult>(
  inputs: TInput[],
  concurrency: number,
  run: (input: TInput) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = new Array(inputs.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await run(inputs[index]);
    }
  }

  const workerCount = Math.min(concurrency, inputs.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      await worker();
    }),
  );

  return results;
}

function validateBatchResultShape(
  batchResult: QueryValidationBatch,
  inputQueries: QueryValidationInputQuery[],
  batchNumber: number,
): void {
  if (batchResult.query_validations.length !== inputQueries.length) {
    throw new Error(
      `Query validation batch ${batchNumber} returned ${batchResult.query_validations.length} validations for ${inputQueries.length} input queries.`,
    );
  }

  const returnedIds = new Set<string>();

  for (const validation of batchResult.query_validations) {
    if (returnedIds.has(validation.query_id)) {
      throw new Error(
        `Query validation batch ${batchNumber} returned duplicate query_id ${validation.query_id}.`,
      );
    }

    returnedIds.add(validation.query_id);
  }
}

function validateBatchResultOrder(
  batchResults: QueryValidationBatch[],
  batches: QueryValidationInputQuery[][],
): void {
  for (const [batchIndex, batchResult] of batchResults.entries()) {
    const batchNumber = batchIndex + 1;
    const inputQueries = batches[batchIndex];

    for (const [queryIndex, validation] of batchResult.query_validations.entries()) {
      const inputQuery = inputQueries[queryIndex];

      if (
        inputQuery === undefined ||
        validation.query_id !== inputQuery.query_id
      ) {
        throw new Error(
          `Query validation batch ${batchNumber} returned query_id ${validation.query_id} out of order at index ${queryIndex}.`,
        );
      }
    }
  }
}

function reconstructQueryValidationArtifact(input: {
  companyProfile: CompanyProfile;
  runId: string;
  generatedAt: string;
  inputQueries: QueryValidationInputQuery[];
  batchResults: QueryValidationBatch[];
}): QueryValidation {
  const decisionsById = new Map<
    string,
    QueryValidationBatch["query_validations"][number]
  >();
  const inputIds = new Set(input.inputQueries.map((query) => query.query_id));

  for (const [batchIndex, batchResult] of input.batchResults.entries()) {
    const batchNumber = batchIndex + 1;

    for (const decision of batchResult.query_validations) {
      if (!inputIds.has(decision.query_id)) {
        throw new Error(
          `Query validation batch ${batchNumber} returned unknown query_id ${decision.query_id}.`,
        );
      }

      if (decisionsById.has(decision.query_id)) {
        throw new Error(
          `Query validation batch ${batchNumber} returned duplicate query_id ${decision.query_id} across batches.`,
        );
      }

      decisionsById.set(decision.query_id, decision);
    }
  }

  const reconstructedValidations = input.inputQueries.map((inputQuery) => {
    const decision = decisionsById.get(inputQuery.query_id);

    if (decision === undefined) {
      throw new Error(
        `Query validation omitted input query_id ${inputQuery.query_id}.`,
      );
    }

    return {
      query_id: inputQuery.query_id,
      territory: inputQuery.territory,
      query: inputQuery.query,
      verdict: decision.verdict,
      reasoning: decision.reasoning,
    };
  });

  return QueryValidationSchema.parse({
    schema_version: "1.0.0",
    run_id: input.runId,
    generated_at: input.generatedAt,
    source_artifacts: ["company-profile.json", "keyword_metrics.json"],
    status: "complete",
    warnings: [],
    website_url: input.companyProfile.website_url,
    source_profile: {
      company_name: input.companyProfile.company_identity.company_name.value,
      product_category:
        input.companyProfile.company_identity.product_category.value,
      primary_icp: input.companyProfile.icp_and_audience.primary_icp.value,
    },
    query_validations: reconstructedValidations,
  });
}

export function generateConfirmedQueries(
  queryValidation: QueryValidation,
  keywordMetrics: KeywordMetrics,
): ConfirmedQueries {
  logStep("Starting confirmed query generation");

  const validatedQueryValidation =
    QueryValidationSchema.parse(queryValidation);
  const validatedKeywordMetrics = KeywordMetricsSchema.parse(keywordMetrics);

  if (
    validatedQueryValidation.website_url !== validatedKeywordMetrics.website_url
  ) {
    throw new Error(
      `Cannot generate confirmed queries because website_url values differ: ${validatedQueryValidation.website_url} !== ${validatedKeywordMetrics.website_url}.`,
    );
  }

  const canonicalMetricQueries =
    buildCanonicalMetricQueries(validatedKeywordMetrics);
  const metricQueriesById = new Map<string, CanonicalMetricQuery>();

  for (const metricQuery of canonicalMetricQueries) {
    if (metricQueriesById.has(metricQuery.query_id)) {
      throw new Error(
        `Cannot generate confirmed queries because keyword metrics contain duplicate query_id ${metricQuery.query_id}.`,
      );
    }

    metricQueriesById.set(metricQuery.query_id, metricQuery);
  }

  const validationIds = new Set<string>();

  for (const validation of validatedQueryValidation.query_validations) {
    if (validationIds.has(validation.query_id)) {
      throw new Error(
        `Cannot generate confirmed queries because query validation contains duplicate query_id ${validation.query_id}.`,
      );
    }

    validationIds.add(validation.query_id);
    const metricQuery = metricQueriesById.get(validation.query_id);

    if (metricQuery === undefined) {
      throw new Error(
        `Cannot generate confirmed queries because validation ${validation.query_id} has no matching keyword metric query.`,
      );
    }

    if (validation.territory !== metricQuery.territory) {
      throw new Error(
        `Cannot generate confirmed queries because ${validation.query_id} territory differs: ${validation.territory} !== ${metricQuery.territory}.`,
      );
    }

    if (validation.query !== metricQuery.query) {
      throw new Error(
        `Cannot generate confirmed queries because ${validation.query_id} query differs: ${validation.query} !== ${metricQuery.query}.`,
      );
    }
  }

  for (const metricQuery of canonicalMetricQueries) {
    if (!validationIds.has(metricQuery.query_id)) {
      throw new Error(
        `Cannot generate confirmed queries because keyword metric query ${metricQuery.query_id} has no matching validation.`,
      );
    }
  }

  const confirmedQueries =
    validatedQueryValidation.query_validations.flatMap((validation) => {
      if (validation.verdict !== "valid") {
        return [];
      }

      const metricQuery = metricQueriesById.get(validation.query_id);

      if (metricQuery === undefined) {
        throw new Error(
          `Cannot generate confirmed queries because validation ${validation.query_id} has no matching keyword metric query.`,
        );
      }

      return [
        {
          query_id: validation.query_id,
          territory: validation.territory,
          query: validation.query,
          validation_reasoning: validation.reasoning,
          source_seed_keywords: metricQuery.source_seed_keywords,
          discovery_rank: metricQuery.discovery_rank,
          core_keyword: metricQuery.core_keyword,
          detected_language: metricQuery.detected_language,
          metrics: metricQuery.metrics,
        },
      ];
    });
  const problemQueriesConfirmed = confirmedQueries.filter(
    (query) => query.territory === "problem_demand",
  ).length;
  const solutionQueriesConfirmed = confirmedQueries.filter(
    (query) => query.territory === "solution_demand",
  ).length;
  const totalQueriesEvaluated =
    validatedQueryValidation.query_validations.length;
  const totalQueriesConfirmed = confirmedQueries.length;
  const totalQueriesRejected =
    totalQueriesEvaluated - totalQueriesConfirmed;
  const confirmedQueryArtifact = ConfirmedQueriesSchema.parse({
    schema_version: "1.0.0",
    run_id: validatedQueryValidation.run_id,
    generated_at: validatedQueryValidation.generated_at,
    source_artifacts: ["query-validations.json", "keyword_metrics.json"],
    status: "complete",
    warnings: uniqueOrdered([
      ...validatedQueryValidation.warnings,
      ...validatedKeywordMetrics.warnings,
    ]),
    website_url: validatedQueryValidation.website_url,
    source_profile: validatedQueryValidation.source_profile,
    confirmed_queries: confirmedQueries,
    summary: {
      total_queries_evaluated: totalQueriesEvaluated,
      total_queries_confirmed: totalQueriesConfirmed,
      total_queries_rejected: totalQueriesRejected,
      problem_queries_confirmed: problemQueriesConfirmed,
      solution_queries_confirmed: solutionQueriesConfirmed,
    },
  });

  logSuccess("Confirmed query generation completed");
  logInfo(
    `Total queries evaluated: ${confirmedQueryArtifact.summary.total_queries_evaluated}`,
  );
  logInfo(
    `Total queries confirmed: ${confirmedQueryArtifact.summary.total_queries_confirmed}`,
  );
  logInfo(
    `Total queries rejected: ${confirmedQueryArtifact.summary.total_queries_rejected}`,
  );
  logInfo(
    `Problem-demand confirmed: ${confirmedQueryArtifact.summary.problem_queries_confirmed}`,
  );
  logInfo(
    `Solution-demand confirmed: ${confirmedQueryArtifact.summary.solution_queries_confirmed}`,
  );

  return confirmedQueryArtifact;
}

function buildInputQueries(
  keywordMetrics: KeywordMetrics,
): QueryValidationInputQuery[] {
  return QUERY_VALIDATION_TERRITORY_ORDER.flatMap((territory) => {
    const querySet = getQuerySet(keywordMetrics, territory);

    return querySet.queries.map((query, index) => ({
      query_id: createStableQueryId(territory, index),
      territory,
      query: query.query,
    }));
  });
}

function buildCanonicalMetricQueries(
  keywordMetrics: KeywordMetrics,
): CanonicalMetricQuery[] {
  return QUERY_VALIDATION_TERRITORY_ORDER.flatMap((territory) => {
    const querySet = getQuerySet(keywordMetrics, territory);

    return querySet.queries.map((query, index) => ({
      query_id: createStableQueryId(territory, index),
      territory,
      query: query.query,
      source_seed_keywords: querySet.seeds_used,
      discovery_rank: query.discovery_rank,
      core_keyword: query.core_keyword,
      detected_language: query.detected_language,
      metrics: query.metrics,
    }));
  });
}

function getQuerySet(
  keywordMetrics: KeywordMetrics,
  territory: QueryValidationTerritory,
): KeywordMetrics["query_sets"][number] {
  const querySet = keywordMetrics.query_sets.find(
    (candidate) => candidate.territory === territory,
  );

  if (querySet === undefined) {
    throw new Error(`Keyword metrics is missing ${territory} query set.`);
  }

  return querySet;
}

function createStableQueryId(
  territory: QueryValidationTerritory,
  index: number,
): string {
  return `${territory}_${String(index + 1).padStart(3, "0")}`;
}

function uniqueOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      uniqueValues.push(value);
    }
  }

  return uniqueValues;
}

function validateQueryIntegrity(
  queryValidation: QueryValidation,
  inputQueries: QueryValidationInputQuery[],
): void {
  if (queryValidation.query_validations.length !== inputQueries.length) {
    throw new Error(
      `Query validation returned ${queryValidation.query_validations.length} validations for ${inputQueries.length} input queries.`,
    );
  }

  for (const [index, inputQuery] of inputQueries.entries()) {
    const validation = queryValidation.query_validations[index];

    if (validation === undefined) {
      throw new Error(`Query validation omitted query at index ${index}.`);
    }

    if (
      validation.query_id !== inputQuery.query_id ||
      validation.territory !== inputQuery.territory ||
      validation.query !== inputQuery.query
    ) {
      throw new Error(
        `Query validation output changed input query identity at index ${index}.`,
      );
    }
  }
}
