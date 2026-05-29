import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateContentPlan } from "./generate";
import type { ContentPlan, PostingFrequency } from "./types";

const postsPerWeek = 3;
const durationWeeks = 4;

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const artifactsDir = path.join(projectRoot, "artifacts");
  const companyProfilePath = path.join(artifactsDir, "company_profile.json");
  const searchLandscapePath = path.join(artifactsDir, "search_landscape.json");
  const contentPlanPath = path.join(artifactsDir, "content_plan.json");
  const modelErrorPath = path.join(artifactsDir, "content_plan_model_error.txt");
  const invalidPlanPath = path.join(artifactsDir, "content_plan_invalid.json");

  await loadDotEnv(projectRoot);
  await mkdir(artifactsDir, { recursive: true });

  const companyProfile = await readCompanyProfile(companyProfilePath);
  const searchLandscape = await readSearchLandscape(searchLandscapePath);
  const companyName = inferCompanyName(companyProfile, searchLandscape);
  const postingFrequency: PostingFrequency = {
    postsPerWeek,
    durationWeeks,
  };

  console.log(`Loaded company profile for ${companyName}`);
  console.log("Loaded search landscape");
  console.log("");
  console.log(`Generating ${durationWeeks}-week content plan`);
  console.log(`Posts per week: ${postsPerWeek}`);
  console.log(`Total planned posts: ${postsPerWeek * durationWeeks}`);
  console.log("");

  let contentPlan: ContentPlan;
  try {
    contentPlan = await generateContentPlan({
      companyProfile,
      searchLandscape,
      postingFrequency,
    });
  } catch (error) {
    if (hasRawModelOutput(error)) {
      await writeFile(modelErrorPath, error.rawModelOutput, "utf8");
      throw new Error(`${error.message} Saved raw model output to artifacts/content_plan_model_error.txt`);
    }

    if (hasInvalidPlan(error)) {
      await writeJson(invalidPlanPath, error.invalidPlan);
      throw new Error(`${error.message} Saved invalid plan to artifacts/content_plan_invalid.json`);
    }

    throw error;
  }

  await writeJson(contentPlanPath, contentPlan);

  console.log("Saved content plan to artifacts/content_plan.json");
  console.log("");
  printSummary(contentPlan);
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

async function readCompanyProfile(companyProfilePath: string): Promise<unknown> {
  try {
    const rawProfile = await readFile(companyProfilePath, "utf8");
    return JSON.parse(rawProfile);
  } catch (error) {
    if (isFileMissing(error)) {
      throw new Error("Missing artifacts/company_profile.json.");
    }

    throw error;
  }
}

async function readSearchLandscape(searchLandscapePath: string): Promise<unknown> {
  try {
    const rawLandscape = await readFile(searchLandscapePath, "utf8");
    return JSON.parse(rawLandscape);
  } catch (error) {
    if (isFileMissing(error)) {
      throw new Error("Missing artifacts/search_landscape.json. Run:\nnpx tsx src/search-landscape/run-search-landscape.ts");
    }

    throw error;
  }
}

function printSummary(contentPlan: ContentPlan): void {
  console.log("Summary:");
  console.log(`- Clusters: ${contentPlan.clusters.length}`);
  console.log(`- Planned items: ${contentPlan.plannedItems.length}`);

  for (let week = 1; week <= contentPlan.durationWeeks; week += 1) {
    const items = contentPlan.plannedItems
      .filter((item) => item.week === week)
      .sort((a, b) => a.sequence - b.sequence);

    console.log(`- Week ${week}:`);
    for (const [index, item] of items.entries()) {
      console.log(`  ${index + 1}. ${item.workingTitle}`);
    }
  }

  console.log("- Next recommended action:");
  console.log(`  ${contentPlan.nextRecommendedAction.type} for ${contentPlan.nextRecommendedAction.plannedItemId}`);
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function inferCompanyName(companyProfile: unknown, searchLandscape: unknown): string {
  if (isRecord(searchLandscape) && typeof searchLandscape.companyName === "string" && searchLandscape.companyName.trim()) {
    return searchLandscape.companyName;
  }

  if (isRecord(companyProfile) && typeof companyProfile.companySummary === "string") {
    const firstSentence = companyProfile.companySummary.split(".")[0] ?? "";
    const beforeIs = firstSentence.split(/\s+is\s+/i)[0]?.trim();
    if (beforeIs) return beforeIs;
  }

  return "Company";
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

function hasInvalidPlan(error: unknown): error is Error & { invalidPlan: unknown } {
  return error instanceof Error && "invalidPlan" in error;
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
