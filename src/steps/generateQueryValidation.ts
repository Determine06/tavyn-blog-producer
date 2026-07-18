import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import { runStructuredPromptFile } from "../llm/runStructuredPromptFile.js";
import type { CompanyProfile } from "../types/companyProfile.schema.js";
import type { KeywordMetrics } from "../types/keywordMetrics.schema.js";
import {
  QueryValidationSchema,
  type QueryValidation,
} from "../types/queryValidation.schema.js";

type QueryValidationInputQuery = {
  query_id: string;
  territory: "problem_demand" | "solution_demand";
  query: string;
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

function buildInputQueries(
  keywordMetrics: KeywordMetrics,
): QueryValidationInputQuery[] {
  return keywordMetrics.query_sets.flatMap((querySet) =>
    querySet.queries.map((query, index) => ({
      query_id: `${querySet.territory}_${String(index + 1).padStart(3, "0")}`,
      territory: querySet.territory,
      query: query.query,
    })),
  );
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
