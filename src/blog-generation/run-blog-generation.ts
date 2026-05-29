import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateBlogMarkdown } from "./generate";
import type { BlogGenerationResult } from "./types";

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const artifactsDir = path.join(projectRoot, "artifacts");
  const companyProfilePath = path.join(artifactsDir, "company_profile.json");
  const contentPlanPath = path.join(artifactsDir, "content_plan.json");
  const latestTechnicalSeoBriefPath = path.join(artifactsDir, "technical_seo_brief.json");
  const latestFounderAnswersPath = path.join(artifactsDir, "founder_answers.json");
  const blogsDir = path.join(artifactsDir, "blogs");
  const latestBlogPath = path.join(artifactsDir, "blog.md");
  const modelErrorPath = path.join(artifactsDir, "blog_generation_model_error.md");

  await loadDotEnv(projectRoot);

  const companyProfile = await readJsonFile(companyProfilePath, "Missing artifacts/company_profile.json.");
  const contentPlan = await readJsonFile(contentPlanPath, "Missing artifacts/content_plan.json.");
  const technicalSeoBrief = await readJsonFile(
    latestTechnicalSeoBriefPath,
    "Missing artifacts/technical_seo_brief.json. Run:\nnpx tsx src/brief-generation/run-brief-generation.ts",
  );

  const plannedItemId = getStringField(technicalSeoBrief, "plannedItemId");
  const specificTechnicalSeoBriefPath = path.join(artifactsDir, "briefs", `${plannedItemId}_technical_seo_brief.json`);
  const selectedTechnicalSeoBrief = await readJsonFileIfExists(specificTechnicalSeoBriefPath) ?? technicalSeoBrief;
  const selectedPlannedItemId = getStringField(selectedTechnicalSeoBrief, "plannedItemId");
  const specificFounderAnswersPath = path.join(artifactsDir, "founder_answers", `${selectedPlannedItemId}_founder_answers.json`);
  const founderAnswers = await readJsonFileIfExists(specificFounderAnswersPath) ?? await readJsonFile(
    latestFounderAnswersPath,
    "Missing artifacts/founder_answers.json. Create founder answers before blog generation.",
  );
  const plannedItem = findPlannedItem(contentPlan, selectedPlannedItemId);
  const companyName = inferCompanyName(companyProfile, contentPlan, selectedTechnicalSeoBrief);

  console.log(`Loaded company profile for ${companyName}`);
  console.log("Loaded content plan");
  console.log(`Loaded technical SEO brief: ${selectedPlannedItemId}`);
  console.log("Loaded founder answers");
  console.log("");
  console.log("Generating blog markdown...");
  console.log("");

  let result: BlogGenerationResult;
  try {
    result = await generateBlogMarkdown({
      companyProfile,
      contentPlan,
      technicalSeoBrief: selectedTechnicalSeoBrief,
      founderAnswers,
      plannedItem,
    });
  } catch (error) {
    if (hasRawModelOutput(error)) {
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(modelErrorPath, error.rawModelOutput, "utf8");
      throw new Error(`${error.message} Saved raw model output to artifacts/blog_generation_model_error.md`);
    }

    throw error;
  }

  await mkdir(blogsDir, { recursive: true });
  const blogPath = path.join(blogsDir, `${result.plannedItemId}.md`);
  const generationReportPath = path.join(blogsDir, `${result.plannedItemId}_generation_report.json`);

  await writeFile(blogPath, `${result.markdown.trim()}\n`, "utf8");
  await writeFile(latestBlogPath, `${result.markdown.trim()}\n`, "utf8");
  await writeJson(generationReportPath, {
    plannedItemId: result.plannedItemId,
    title: result.title,
    slug: result.slug,
    checks: result.checks,
    generatedAt: new Date().toISOString(),
  });

  console.log(`Saved blog to artifacts/blogs/${result.plannedItemId}.md`);
  console.log("Saved latest blog to artifacts/blog.md");
  console.log(`Saved generation report to artifacts/blogs/${result.plannedItemId}_generation_report.json`);
  console.log("");
  printSummary(result);
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

async function readJsonFileIfExists(filePath: string): Promise<unknown | undefined> {
  try {
    await stat(filePath);
    const rawJson = await readFile(filePath, "utf8");
    return JSON.parse(rawJson);
  } catch (error) {
    if (isFileMissing(error)) return undefined;
    throw error;
  }
}

function findPlannedItem(contentPlan: unknown, plannedItemId: string): unknown {
  if (!isRecord(contentPlan) || !Array.isArray(contentPlan.plannedItems)) {
    throw new Error("Invalid artifacts/content_plan.json: plannedItems must be an array.");
  }

  const plannedItem = contentPlan.plannedItems.find(
    (item) => isRecord(item) && item.id === plannedItemId,
  );

  if (!plannedItem) {
    throw new Error(`No planned item found in artifacts/content_plan.json for ${plannedItemId}.`);
  }

  return plannedItem;
}

function printSummary(result: BlogGenerationResult): void {
  console.log("Summary:");
  console.log(`- Title: ${result.title}`);
  console.log(`- Slug: ${result.slug}`);
  console.log(`- Estimated word count: ${result.checks.estimatedWordCount}`);
  console.log(`- Primary keyword included: ${result.checks.includesPrimaryKeyword}`);
  console.log(`- Founder context included: ${result.checks.includesFounderContext}`);
  console.log(`- No em dashes: ${result.checks.hasNoEmDashes}`);
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function inferCompanyName(...values: unknown[]): string {
  for (const value of values) {
    if (isRecord(value) && typeof value.companyName === "string" && value.companyName.trim()) {
      return value.companyName;
    }
  }

  for (const value of values) {
    if (isRecord(value) && typeof value.companySummary === "string") {
      const firstSentence = value.companySummary.split(".")[0] ?? "";
      const beforeIs = firstSentence.split(/\s+is\s+/i)[0]?.trim();
      if (beforeIs) return beforeIs;
    }
  }

  return "Company";
}

function getStringField(value: unknown, field: string): string {
  if (!isRecord(value) || typeof value[field] !== "string" || !value[field].trim()) {
    throw new Error(`Technical SEO brief is missing ${field}.`);
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
