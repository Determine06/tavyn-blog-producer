import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import { runStructuredPromptFile } from "../llm/runStructuredPromptFile.js";
import type { CompanyProfile } from "../types/companyProfile.schema.js";
import {
  TopicalClusterCandidatesSchema,
  type TopicalClusterCandidates,
} from "../types/topicalClusterCandidates.schema.js";

export async function generateCandidateTopicalClusters(
  companyProfile: CompanyProfile,
): Promise<TopicalClusterCandidates> {
  logStep("Starting topical cluster candidate generation");

  const generatedAt = new Date().toISOString();
  const input = `<topical_cluster_input>
  <schema_version>1.0.0</schema_version>
  <generated_at>${generatedAt}</generated_at>

  <company_profile>
    ${JSON.stringify(companyProfile, null, 2)}
  </company_profile>
</topical_cluster_input>`;

  const topicalClusters =
    await runStructuredPromptFile<TopicalClusterCandidates>({
      promptFileName: "generate-topical-clusters.md",
      runtimeInput: input,
      schema: TopicalClusterCandidatesSchema,
      fallbackSchemaName: "TopicalClustersSchema",
    });

  logSuccess("Topical cluster candidate generation completed");
  logInfo(
    `Topical cluster count: ${topicalClusters.topical_clusters.length}`,
  );
  logInfo(
    `Overall confidence: ${topicalClusters.generation_quality.overall_confidence}`,
  );

  return topicalClusters;
}
