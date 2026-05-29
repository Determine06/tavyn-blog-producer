import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateSearchLandscape } from "./generate";
import { getDefaultSearchProvider, MockSearchProvider } from "./provider";
import type { CompanyProfile } from "./types";

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const artifactsDir = path.join(projectRoot, "artifacts");
  const companyProfilePath = path.join(artifactsDir, "company_profile.json");
  const outputPath = path.join(artifactsDir, "search_landscape.json");

  await mkdir(artifactsDir, { recursive: true });

  const companyProfile = await readOrCreateCompanyProfile(companyProfilePath);
  const searchProvider = getDefaultSearchProvider();
  const usingMockProvider = searchProvider instanceof MockSearchProvider;

  if (usingMockProvider) {
    console.warn("SERPER_API_KEY is not set. Falling back to MockSearchProvider.");
  }

  const landscape = await generateSearchLandscape({
    companyProfile,
    searchProvider,
    limitPerQuery: 10,
  });

  await writeFile(outputPath, `${JSON.stringify(landscape, null, 2)}\n`, "utf8");

  console.log(`Queries searched: ${landscape.searchedQueries.length}`);
  console.log(`Provider: ${usingMockProvider ? "mock" : "live Serper"}`);
  console.log(`Output written to: ${outputPath}`);
}

async function readOrCreateCompanyProfile(companyProfilePath: string): Promise<CompanyProfile> {
  try {
    const file = await readFile(companyProfilePath, "utf8");
    return JSON.parse(file) as CompanyProfile;
  } catch (error) {
    if (!isFileMissing(error)) throw error;

    const placeholder = createPlaceholderCompanyProfile();
    await writeFile(companyProfilePath, `${JSON.stringify(placeholder, null, 2)}\n`, "utf8");
    console.warn(`Created placeholder company profile at ${companyProfilePath}. Edit it before using live research output.`);
    return placeholder;
  }
}

function createPlaceholderCompanyProfile(): CompanyProfile {
  return {
    companySummary: "",
    primaryICP: {
      name: "",
      description: "",
      industries: [],
      companySize: [],
      roles: [],
      seniority: [],
      technicalLevel: "medium",
      budgetLevel: "medium",
    },
    pains: [],
    goals: [],
    buyingTriggers: [],
    objections: [],
    desiredOutcomes: [],
    messaging: {
      valueProposition: "",
      positioning: "",
      tone: [],
      wordsToUse: [],
      wordsToAvoid: [],
    },
    seo: {
      coreTopics: [],
      blogAngles: [],
      commercialKeywords: [],
      informationalKeywords: [],
      funnelStages: [],
    },
    confidence: {
      score: 0,
      missingInfo: [],
      assumptions: [],
    },
  };
}

function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
