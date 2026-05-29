import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSearchQueryPlan } from "./queries";
import type { CompanyProfile, SearchQueryPlan } from "./types";

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const artifactsDir = path.join(projectRoot, "artifacts");
  const companyProfilePath = path.join(artifactsDir, "company_profile.json");
  const outputPath = path.join(artifactsDir, "search_queries.json");

  const companyProfile = await readCompanyProfile(companyProfilePath);
  validateCompanyProfile(companyProfile);

  const queryPlan = buildSearchQueryPlan(companyProfile);
  validateQueryPlan(queryPlan);

  await mkdir(artifactsDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(queryPlan, null, 2)}\n`, "utf8");

  printQueryPlan(queryPlan, path.relative(projectRoot, outputPath));
}

async function readCompanyProfile(companyProfilePath: string): Promise<CompanyProfile> {
  try {
    const rawProfile = await readFile(companyProfilePath, "utf8");
    return JSON.parse(rawProfile) as CompanyProfile;
  } catch (error) {
    if (isFileMissing(error)) {
      throw new Error(`Missing company profile at ${companyProfilePath}. Add artifacts/company_profile.json before generating search queries.`);
    }

    throw error;
  }
}

function validateCompanyProfile(profile: CompanyProfile): void {
  const missingFields: string[] = [];

  if (!profile.companySummary) missingFields.push("companySummary");
  if (!profile.primaryICP?.name) missingFields.push("primaryICP.name");
  if (!profile.primaryICP?.description) missingFields.push("primaryICP.description");
  if (!Array.isArray(profile.primaryICP?.roles)) missingFields.push("primaryICP.roles");
  if (!Array.isArray(profile.pains)) missingFields.push("pains");
  if (!Array.isArray(profile.goals)) missingFields.push("goals");
  if (!Array.isArray(profile.buyingTriggers)) missingFields.push("buyingTriggers");
  if (!Array.isArray(profile.objections)) missingFields.push("objections");
  if (!Array.isArray(profile.desiredOutcomes)) missingFields.push("desiredOutcomes");
  if (!profile.messaging?.valueProposition) missingFields.push("messaging.valueProposition");
  if (!profile.messaging?.positioning) missingFields.push("messaging.positioning");
  if (!Array.isArray(profile.seo?.coreTopics)) missingFields.push("seo.coreTopics");
  if (!Array.isArray(profile.seo?.blogAngles)) missingFields.push("seo.blogAngles");
  if (!Array.isArray(profile.seo?.commercialKeywords)) missingFields.push("seo.commercialKeywords");
  if (!Array.isArray(profile.seo?.informationalKeywords)) missingFields.push("seo.informationalKeywords");
  if (!Array.isArray(profile.seo?.funnelStages)) missingFields.push("seo.funnelStages");

  if (missingFields.length > 0) {
    throw new Error(`Company profile is missing required fields: ${missingFields.join(", ")}`);
  }
}

function validateQueryPlan(queryPlan: SearchQueryPlan): void {
  if (queryPlan.queries.length < 8 || queryPlan.queries.length > 12) {
    throw new Error(`Expected 8-12 search queries, generated ${queryPlan.queries.length}.`);
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const query of queryPlan.queries) {
    const key = query.query.toLowerCase().trim();
    if (seen.has(key)) duplicates.add(query.query);
    seen.add(key);
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate query strings generated: ${[...duplicates].join(", ")}`);
  }

  if (!queryPlan.queries.some((query) => query.funnelStage === "tofu")) {
    throw new Error("Expected at least one TOFU query.");
  }

  if (!queryPlan.queries.some((query) => query.funnelStage === "mofu")) {
    throw new Error("Expected at least one MOFU query.");
  }

  if (!queryPlan.queries.some((query) => query.funnelStage === "bofu")) {
    throw new Error("Expected at least one BOFU query.");
  }

  if (!queryPlan.queries.some((query) => query.queryType === "comparison")) {
    throw new Error("Expected at least one comparison query.");
  }

  if (!queryPlan.queries.some((query) => query.queryType === "product_wedge")) {
    throw new Error("Expected at least one product_wedge query.");
  }

  if (!queryPlan.queries.some((query) => query.queryType === "core_category")) {
    throw new Error("Expected at least one core_category query.");
  }
}

function printQueryPlan(queryPlan: SearchQueryPlan, outputPath: string): void {
  console.log(`Generated ${queryPlan.totalQueries} search research queries for ${queryPlan.companyName}`);
  console.log("");

  queryPlan.queries.forEach((query, index) => {
    console.log(`${index + 1}. [${query.funnelStage.toUpperCase()} / ${query.readerStage}] ${query.query}`);
    console.log(`   Type: ${query.queryType}`);
    console.log(`   Why: ${query.whySearchThis}`);
    console.log(`   Signals: ${query.sourceSignals.join(", ")}`);
    console.log("");
  });

  console.log(`Saved query plan to ${outputPath}`);
}

function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
