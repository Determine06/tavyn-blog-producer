import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import { runStructuredPromptFile } from "../llm/runStructuredPromptFile.js";
import type { CompanyProfile } from "../types/companyProfile.schema.js";
import {
  QueryCandidatesSchema,
  type QueryCandidates,
} from "../types/queryCandidates.schema.js";

export async function generateQueryCandidates(
  companyProfile: CompanyProfile,
  runId: string,
): Promise<QueryCandidates> {
  logStep("Starting query-candidate generation");

  const generatedAt = new Date().toISOString();
  const input = `<query_candidate_input>
  <schema_version>1.0.0</schema_version>
  <run_id>${runId}</run_id>
  <generated_at>${generatedAt}</generated_at>

  <company_profile>
    ${JSON.stringify(companyProfile, null, 2)}
  </company_profile>
</query_candidate_input>`;

  const queryCandidates = await runStructuredPromptFile<QueryCandidates>({
    promptFileName: "generate-query-candidates.md",
    runtimeInput: input,
    schema: QueryCandidatesSchema,
    fallbackSchemaName: "QueryCandidatesSchema",
  });

  const problemDemandFamilyCount = queryCandidates.query_families.filter(
    (family) => family.territory === "problem_demand",
  ).length;
  const solutionDemandFamilyCount = queryCandidates.query_families.filter(
    (family) => family.territory === "solution_demand",
  ).length;
  const queryCandidateCount = queryCandidates.query_families.reduce(
    (total, family) => total + family.query_candidates.length,
    0,
  );

  logSuccess("Query-candidate generation completed");
  logInfo(`Query family count: ${queryCandidates.query_families.length}`);
  logInfo(`Problem-demand family count: ${problemDemandFamilyCount}`);
  logInfo(`Solution-demand family count: ${solutionDemandFamilyCount}`);
  logInfo(`Query candidate count: ${queryCandidateCount}`);
  logInfo(
    `Overall confidence: ${queryCandidates.generation_quality.overall_confidence}`,
  );

  return queryCandidates;
}
