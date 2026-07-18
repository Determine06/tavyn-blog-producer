import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import { runStructuredPromptFile } from "../llm/runStructuredPromptFile.js";
import type { CompanyProfile } from "../types/companyProfile.schema.js";
import {
  SeedKeywordsSchema,
  type SeedKeywords,
} from "../types/seedKeywords.schema.js";

export async function generateSeedKeywords(
  companyProfile: CompanyProfile,
  runId: string,
): Promise<SeedKeywords> {
  logStep("Starting seed-keyword generation");

  const generatedAt = new Date().toISOString();
  const input = `<seed_keyword_input>
  <schema_version>1.0.0</schema_version>
  <run_id>${runId}</run_id>
  <generated_at>${generatedAt}</generated_at>
  <website_url>${companyProfile.website_url}</website_url>

  <company_profile>
    ${JSON.stringify(companyProfile, null, 2)}
  </company_profile>
</seed_keyword_input>`;

  const seedKeywords = await runStructuredPromptFile<SeedKeywords>({
    promptFileName: "generate-seed-keywords.md",
    runtimeInput: input,
    schema: SeedKeywordsSchema,
    fallbackSchemaName: "SeedKeywordsSchema",
  });

  const problemDemandSeedCount =
    seedKeywords.demand_territories.find(
      (territory) => territory.territory_id === "problem_demand",
    )?.seed_keywords.length ?? 0;
  const solutionDemandSeedCount =
    seedKeywords.demand_territories.find(
      (territory) => territory.territory_id === "solution_demand",
    )?.seed_keywords.length ?? 0;
  const totalSeedCount = seedKeywords.demand_territories.reduce(
    (total, territory) => total + territory.seed_keywords.length,
    0,
  );

  logSuccess("Seed-keyword generation completed");
  logInfo(`Demand territory count: ${seedKeywords.demand_territories.length}`);
  logInfo(`Problem-demand seed count: ${problemDemandSeedCount}`);
  logInfo(`Solution-demand seed count: ${solutionDemandSeedCount}`);
  logInfo(`Total seed count: ${totalSeedCount}`);
  logInfo(
    `Overall confidence: ${seedKeywords.generation_quality.overall_confidence}`,
  );

  return seedKeywords;
}
