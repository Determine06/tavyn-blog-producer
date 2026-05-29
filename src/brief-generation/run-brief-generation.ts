import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateTechnicalSeoBrief } from "./generate";
import type { TechnicalSeoBrief } from "./types";

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const artifactsDir = path.join(projectRoot, "artifacts");
  const companyProfilePath = path.join(artifactsDir, "company_profile.json");
  const searchLandscapePath = path.join(artifactsDir, "search_landscape.json");
  const contentPlanPath = path.join(artifactsDir, "content_plan.json");
  const briefsDir = path.join(artifactsDir, "briefs");
  const latestBriefPath = path.join(artifactsDir, "technical_seo_brief.json");
  const modelErrorPath = path.join(artifactsDir, "brief_generation_model_error.txt");
  const invalidBriefPath = path.join(artifactsDir, "brief_generation_invalid.json");

  await loadDotEnv(projectRoot);

  const companyProfile = await readJsonFile(companyProfilePath, "Missing artifacts/company_profile.json.");
  const searchLandscape = await readJsonFile(
    searchLandscapePath,
    "Missing artifacts/search_landscape.json. Run:\nnpx tsx src/search-landscape/run-search-landscape.ts",
  );
  const contentPlan = await readJsonFile(
    contentPlanPath,
    "Missing artifacts/content_plan.json. Run:\nnpx tsx src/content-plan/run-content-plan.ts",
  );

  const companyName = inferCompanyName(companyProfile, searchLandscape, contentPlan);
  const plannedItem = selectPlannedItem(contentPlan);
  const plannedItemId = getStringField(plannedItem, "id");
  const workingTitle = getStringField(plannedItem, "workingTitle");

  console.log(`Loaded company profile for ${companyName}`);
  console.log("Loaded search landscape");
  console.log("Loaded content plan");
  console.log(`Selected planned item: ${plannedItemId}`);
  console.log(`Title: ${workingTitle}`);
  console.log("");
  console.log("Generating technical SEO brief...");
  console.log("");

  let brief: TechnicalSeoBrief;
  try {
    brief = await generateTechnicalSeoBrief({
      companyProfile,
      searchLandscape,
      contentPlan,
      plannedItem,
    });
  } catch (error) {
    if (hasRawModelOutput(error)) {
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(modelErrorPath, error.rawModelOutput, "utf8");
      throw new Error(`${error.message} Saved raw model output to artifacts/brief_generation_model_error.txt`);
    }

    if (hasInvalidBrief(error)) {
      await mkdir(artifactsDir, { recursive: true });
      await writeJson(invalidBriefPath, error.invalidBrief);
      throw new Error(`${error.message} Saved invalid brief to artifacts/brief_generation_invalid.json`);
    }

    throw error;
  }

  await mkdir(briefsDir, { recursive: true });
  const briefPath = path.join(briefsDir, `${plannedItemId}_technical_seo_brief.json`);
  await writeJson(briefPath, brief);
  await writeJson(latestBriefPath, brief);

  console.log(`Saved brief to artifacts/briefs/${plannedItemId}_technical_seo_brief.json`);
  console.log("Saved latest brief to artifacts/technical_seo_brief.json");
  console.log("");
  printSummary(brief);
}

async function loadDotEnv(projectRoot: string): Promise<void> {
  try {
    const dotEnv = await readFile(path.join(projectRoot, ".env"), "utf8");

    for (const line of dotEnv.split(/\r?\n/)) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) continue;

      const separatorIndex = trimmedLine.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
      const value = trimSurroundingQuotes(rawValue);

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (!isFileMissing(error)) throw error;
  }
}

async function readJsonFile(filePath: string, missingMessage: string): Promise<unknown> {
  try {
    const rawJson = await readFile(filePath, "utf8");
    return JSON.parse(rawJson);
  } catch (error) {
    if (isFileMissing(error)) {
      throw new Error(missingMessage);
    }

    throw error;
  }
}

function selectPlannedItem(contentPlan: unknown): unknown {
  if (!isRecord(contentPlan)) {
    throw new Error("Invalid artifacts/content_plan.json: content plan must be an object.");
  }

  const plannedItems = contentPlan.plannedItems;
  if (!Array.isArray(plannedItems) || plannedItems.length === 0) {
    throw new Error("No planned items found in artifacts/content_plan.json.");
  }

  const nextRecommendedAction = contentPlan.nextRecommendedAction;
  const selectedPlannedItemId =
    (isRecord(nextRecommendedAction) && typeof nextRecommendedAction.plannedItemId === "string"
      ? nextRecommendedAction.plannedItemId
      : undefined) ?? (isRecord(plannedItems[0]) && typeof plannedItems[0].id === "string" ? plannedItems[0].id : undefined);

  if (!selectedPlannedItemId) {
    throw new Error("No planned item id found from nextRecommendedAction or plannedItems[0].");
  }

  const plannedItem = plannedItems.find((item) => isRecord(item) && item.id === selectedPlannedItemId);
  if (!plannedItem) {
    throw new Error(`No planned item found for id ${selectedPlannedItemId}.`);
  }

  return plannedItem;
}

function printSummary(brief: TechnicalSeoBrief): void {
  console.log("Summary:");
  console.log(`- Primary keyword: ${brief.searchTarget.primaryKeyword}`);
  console.log(`- Target query cluster: ${brief.searchTarget.targetQueryCluster.join(", ")}`);
  console.log(`- Recommended slug: ${brief.onPageSeo.recommendedSlug}`);
  console.log(`- Meta title: ${brief.onPageSeo.metaTitle.draft}`);
  console.log(`- Founder questions needed: ${brief.founderQuestionTriggers.askFounder}`);
  console.log(`- Next recommended action: ${brief.nextRecommendedAction.type}`);
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function inferCompanyName(companyProfile: unknown, searchLandscape: unknown, contentPlan: unknown): string {
  for (const value of [contentPlan, searchLandscape]) {
    if (isRecord(value) && typeof value.companyName === "string" && value.companyName.trim()) {
      return value.companyName;
    }
  }

  if (isRecord(companyProfile) && typeof companyProfile.companySummary === "string") {
    const firstSentence = companyProfile.companySummary.split(".")[0] ?? "";
    const beforeIs = firstSentence.split(/\s+is\s+/i)[0]?.trim();
    if (beforeIs) return beforeIs;
  }

  return "Company";
}

function getStringField(value: unknown, field: string): string {
  if (!isRecord(value) || typeof value[field] !== "string" || !value[field].trim()) {
    throw new Error(`Selected planned item is missing ${field}.`);
  }

  return value[field];
}

function trimSurroundingQuotes(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function hasRawModelOutput(error: unknown): error is Error & { rawModelOutput: string } {
  return error instanceof Error && "rawModelOutput" in error && typeof error.rawModelOutput === "string";
}

function hasInvalidBrief(error: unknown): error is Error & { invalidBrief: unknown } {
  return error instanceof Error && "invalidBrief" in error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
