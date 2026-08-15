import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import { runStructuredPromptFile } from "../llm/runStructuredPromptFile.js";
import type { CompanyProfile } from "../types/companyProfile.schema.js";
import {
  SeedKeywordsSchema,
  type SeedKeywords,
} from "../types/seedKeywords.schema.js";

const SEED_KEYWORD_MAX_ATTEMPTS = 2;

type SeedKeywordRunner = (runtimeInput: string) => Promise<SeedKeywords>;

export type GenerateSeedKeywordsDependencies = {
  runner?: SeedKeywordRunner;
};

export async function generateSeedKeywords(
  companyProfile: CompanyProfile,
  runId: string,
  dependencies: GenerateSeedKeywordsDependencies = {},
): Promise<SeedKeywords> {
  logStep("Starting seed-keyword generation");

  const generatedAt = new Date().toISOString();
  const runner = dependencies.runner ?? runSeedKeywordPrompt;
  let seedKeywords: SeedKeywords | undefined;
  let lastError: unknown;

  for (
    let attemptNumber = 1;
    attemptNumber <= SEED_KEYWORD_MAX_ATTEMPTS;
    attemptNumber += 1
  ) {
    try {
      if (attemptNumber > 1) {
        logInfo(
          "Retrying seed-keyword generation after an invalid structured response.",
        );
      }

      seedKeywords = SeedKeywordsSchema.parse(
        await runner(
          buildRuntimeInput(companyProfile, runId, generatedAt, attemptNumber),
        ),
      );
      break;
    } catch (error) {
      lastError = error;

      if (attemptNumber === SEED_KEYWORD_MAX_ATTEMPTS) {
        throw error;
      }
    }
  }

  if (seedKeywords === undefined) {
    throw lastError;
  }

  const totalSeedCount = seedKeywords.demand_groups.reduce(
    (total, group) => total + group.seed_keywords.length,
    0,
  );

  logSuccess("Seed-keyword generation completed");
  logInfo(`Demand group count: ${seedKeywords.demand_groups.length}`);
  for (const group of seedKeywords.demand_groups) {
    logInfo(`${group.group_id} seed count: ${group.seed_keywords.length}`);
  }
  logInfo(`Total seed count: ${totalSeedCount}`);
  logInfo(
    `Overall confidence: ${seedKeywords.generation_quality.overall_confidence}`,
  );

  return seedKeywords;
}

async function runSeedKeywordPrompt(
  runtimeInput: string,
): Promise<SeedKeywords> {
  return runStructuredPromptFile<SeedKeywords>({
    promptFileName: "generate-seed-keywords.md",
    runtimeInput,
    schema: SeedKeywordsSchema,
    fallbackSchemaName: "SeedKeywordsSchema",
  });
}

function buildRuntimeInput(
  companyProfile: CompanyProfile,
  runId: string,
  generatedAt: string,
  attemptNumber: number,
): string {
  const retryFeedback =
    attemptNumber === 1
      ? ""
      : `
  <retry_feedback>
    The previous response failed SeedKeywordsSchema validation. Regenerate the complete artifact and re-audit all twenty-four keywords globally. In particular, replace singular/plural, word-order, synonym, or superficial-modifier duplicates with genuinely distinct search territories.
  </retry_feedback>`;

  return `<seed_keyword_input>
  <schema_version>2.1.0</schema_version>
  <run_id>${runId}</run_id>
  <generated_at>${generatedAt}</generated_at>
  <website_url>${companyProfile.website_url}</website_url>
  <generation_attempt>${attemptNumber}</generation_attempt>${retryFeedback}

  <company_profile>
    ${JSON.stringify(companyProfile, null, 2)}
  </company_profile>
</seed_keyword_input>`;
}
