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
  QueryValidationSchema,
  type QueryValidation,
} from "../types/queryValidation.schema.js";

type QueryValidationInputQuery = {
  query_id: string;
  territory: "problem_demand" | "solution_demand";
  query: string;
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
): Promise<QueryValidation> {
  logStep("Starting query validation");

  const generatedAt = new Date().toISOString();
  const queries = buildInputQueries(keywordMetrics);
  const input = `<query_validation_input>
  <schema_version>1.0.0</schema_version>
  <run_id>${runId}</run_id>
  <generated_at>${generatedAt}</generated_at>

  <company_profile>
    ${JSON.stringify(companyProfile, null, 2)}
  </company_profile>

  <queries>
    ${JSON.stringify(queries, null, 2)}
  </queries>
</query_validation_input>`;

  const queryValidation = await runStructuredPromptFile<QueryValidation>({
    promptFileName: "generate-query-validation.md",
    runtimeInput: input,
    schema: QueryValidationSchema,
    fallbackSchemaName: "QueryValidationSchema",
  });

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
  return keywordMetrics.query_sets.flatMap((querySet) =>
    querySet.queries.map((query, index) => ({
      query_id: createStableQueryId(querySet.territory, index),
      territory: querySet.territory,
      query: query.query,
    })),
  );
}

function buildCanonicalMetricQueries(
  keywordMetrics: KeywordMetrics,
): CanonicalMetricQuery[] {
  return keywordMetrics.query_sets.flatMap((querySet) =>
    querySet.queries.map((query, index) => ({
      query_id: createStableQueryId(querySet.territory, index),
      territory: querySet.territory,
      query: query.query,
      source_seed_keywords: querySet.seeds_used,
      discovery_rank: query.discovery_rank,
      core_keyword: query.core_keyword,
      detected_language: query.detected_language,
      metrics: query.metrics,
    })),
  );
}

function createStableQueryId(
  territory: "problem_demand" | "solution_demand",
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
