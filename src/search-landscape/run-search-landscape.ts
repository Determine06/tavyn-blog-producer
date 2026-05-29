import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CompanyProfile,
  RawSearchResult,
  RawSearchResultsArtifact,
  SearchLandscape,
  SearchQueryPlan,
  SearchResearchQuery,
} from "./types";

type SerperOrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
};

type SerperResponse = {
  organic?: SerperOrganicResult[];
  answerBox?: unknown;
  relatedSearches?: unknown[];
  [key: string]: unknown;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const serperLimitPerQuery = 10;
const defaultOpenAIModel = "gpt-4.1-mini";

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const artifactsDir = path.join(projectRoot, "artifacts");
  const companyProfilePath = path.join(artifactsDir, "company_profile.json");
  const searchQueriesPath = path.join(artifactsDir, "search_queries.json");
  const rawResultsPath = path.join(artifactsDir, "raw_search_results.json");
  const searchLandscapePath = path.join(artifactsDir, "search_landscape.json");
  const modelErrorPath = path.join(artifactsDir, "search_landscape_model_error.txt");
  const invalidLandscapePath = path.join(artifactsDir, "search_landscape_invalid.json");

  await loadDotEnv(projectRoot);
  await mkdir(artifactsDir, { recursive: true });

  const serperApiKey = process.env.SERPER_API_KEY;
  if (!serperApiKey) {
    throw new Error("Missing SERPER_API_KEY. Add it to .env or export it in your terminal.");
  }

  const openAIApiKey = process.env.OPENAI_API_KEY;
  if (!openAIApiKey) {
    throw new Error("Missing OPENAI_API_KEY. Add it to .env or export it in your terminal.");
  }

  const companyProfile = await readCompanyProfile(companyProfilePath);
  const searchQueryPlan = await readSearchQueryPlan(searchQueriesPath);

  console.log(`Loaded company profile for ${searchQueryPlan.companyName}`);
  console.log(`Loaded ${searchQueryPlan.queries.length} search queries`);
  console.log("Running Serper searches...");

  const rawSearchResults = await runSerperSearches(searchQueryPlan.queries, serperApiKey);
  await writeJson(rawResultsPath, rawSearchResults);

  console.log("");
  console.log("Saved raw search results to artifacts/raw_search_results.json");
  console.log("");
  console.log("Analyzing search landscape with OpenAI...");

  const searchLandscape = await analyzeWithOpenAI({
    companyProfile,
    rawSearchResults,
    apiKey: openAIApiKey,
    model: process.env.OPENAI_MODEL || defaultOpenAIModel,
    modelErrorPath,
  });

  try {
    validateSearchLandscape(searchLandscape, rawSearchResults);
  } catch (error) {
    await writeJson(invalidLandscapePath, searchLandscape);
    throw error;
  }

  await writeJson(searchLandscapePath, searchLandscape);

  console.log("Saved search landscape to artifacts/search_landscape.json");
  console.log("");
  console.log("Summary:");
  console.log(`- Query analyses: ${searchLandscape.queryAnalyses.length}`);
  console.log(`- SERP patterns: ${searchLandscape.serpPatterns.length}`);
  console.log(`- Domain visibility entries: ${searchLandscape.domainVisibility.length}`);
  console.log(`- Content gaps: ${searchLandscape.contentGaps.length}`);
  console.log(`- Angle opportunities: ${searchLandscape.angleOpportunities.length}`);
  console.log("- Recommended strategic focus:");
  console.log(`  ${searchLandscape.recommendedStrategicFocus}`);
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

async function readCompanyProfile(companyProfilePath: string): Promise<CompanyProfile> {
  try {
    const rawProfile = await readFile(companyProfilePath, "utf8");
    return JSON.parse(rawProfile) as CompanyProfile;
  } catch (error) {
    if (isFileMissing(error)) {
      throw new Error("Missing artifacts/company_profile.json.");
    }

    throw error;
  }
}

async function readSearchQueryPlan(searchQueriesPath: string): Promise<SearchQueryPlan> {
  try {
    const rawQueryPlan = await readFile(searchQueriesPath, "utf8");
    return JSON.parse(rawQueryPlan) as SearchQueryPlan;
  } catch (error) {
    if (isFileMissing(error)) {
      throw new Error("Missing artifacts/search_queries.json. Run:\nnpx tsx src/search-landscape/run-queries.ts");
    }

    throw error;
  }
}

async function runSerperSearches(
  queries: SearchResearchQuery[],
  apiKey: string,
): Promise<RawSearchResultsArtifact> {
  const results: RawSearchResultsArtifact["results"] = [];

  for (const [index, query] of queries.entries()) {
    console.log(`[${index + 1}/${queries.length}] ${query.query}`);

    const serperResponse = await searchSerper(query.query, apiKey);
    results.push({
      queryId: query.id,
      query: query.query,
      queryType: query.queryType,
      funnelStage: query.funnelStage,
      readerStage: query.readerStage,
      whySearchThis: query.whySearchThis,
      sourceSignals: query.sourceSignals,
      topResults: normalizeOrganicResults(serperResponse.organic ?? []),
      answerBox: serperResponse.answerBox,
      relatedSearches: serperResponse.relatedSearches,
    });

    if (index < queries.length - 1) {
      await sleep(250);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    provider: "serper",
    totalQueries: queries.length,
    limitPerQuery: serperLimitPerQuery,
    results,
  };
}

async function searchSerper(query: string, apiKey: string): Promise<SerperResponse> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      gl: "us",
      hl: "en",
      num: serperLimitPerQuery,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Serper request failed for "${query}" with status ${response.status}:\n${responseText}`);
  }

  return JSON.parse(responseText) as SerperResponse;
}

async function analyzeWithOpenAI(input: {
  companyProfile: CompanyProfile;
  rawSearchResults: RawSearchResultsArtifact;
  apiKey: string;
  model: string;
  modelErrorPath: string;
}): Promise<SearchLandscape> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are Tavyn's SEO search landscape analyst. You analyze live SERP results and produce strict JSON only.",
        },
        {
          role: "user",
          content: buildSearchLandscapePrompt(input.companyProfile, input.rawSearchResults),
        },
      ],
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}:\n${responseText}`);
  }

  const data = JSON.parse(responseText) as OpenAIChatResponse;
  const modelText = data.choices?.[0]?.message?.content;
  if (!modelText) {
    await writeFile(input.modelErrorPath, responseText, "utf8");
    throw new Error("OpenAI response did not include choices[0].message.content. Saved raw response to artifacts/search_landscape_model_error.txt");
  }

  try {
    return JSON.parse(modelText) as SearchLandscape;
  } catch (error) {
    await writeFile(input.modelErrorPath, modelText, "utf8");
    throw new Error("Failed to parse OpenAI response as JSON. Saved raw model text to artifacts/search_landscape_model_error.txt");
  }
}

function buildSearchLandscapePrompt(companyProfile: CompanyProfile, rawResults: RawSearchResultsArtifact): string {
  return `You are creating Tavyn's search_landscape.json.

Your job:
Analyze the search results across all ${rawResults.totalQueries} queries and determine:

1. What the SERP already covers
2. What kinds of pages rank
3. Which domains appear repeatedly
4. Which angles are common
5. What is missing
6. Where this company can credibly win
7. What clusters should inform the later content plan

Use the company profile as the source of truth.

Do not invent search volume, keyword difficulty, traffic, or ranking probability.

Do not assume every visible domain is a competitor.
Classify each recurring domain by domainType.
Use direct_competitor only when the domain directly competes with the company's product.
Use indirect_competitor when the domain solves an adjacent problem or competes for the same buyer attention.
Use seo_publisher for SEO/content blogs, media sites, and educational publishers.
Use community for Reddit, forums, Hacker News, Quora, etc.
Use platform for GitHub, YouTube, Vercel, CMS platforms, or infrastructure platforms.
Use agency for SEO/content agencies or consultancies.
Use tool_vendor for software tools that may or may not be direct competitors.
Use other only when no category fits.

Prioritize:
- audience gaps
- workflow gaps
- product gaps
- founder POV gaps
- format gaps
- depth gaps
- freshness gaps

For Tavyn-like companies, pay special attention to:
- founder-led SaaS teams
- blog operations, not just AI writing
- content planning before blog generation
- SEO briefs
- approval workflows
- GitHub/code-based publishing
- direct publishing to site
- agency alternative positioning
- avoiding generic AI writing content

Return valid JSON only.

The returned JSON must match this exact shape:

{
  "generatedAt": "ISO string",
  "companyName": "string",
  "researchSummary": "string",
  "queryAnalyses": [
    {
      "queryId": "string",
      "query": "string",
      "queryType": "core_category | problem_aware | solution_aware | commercial | comparison | product_wedge | vendor_aware",
      "funnelStage": "tofu | mofu | bofu",
      "readerStage": "unaware | problem-aware | solution-aware | product-aware | vendor-aware",
      "observedIntent": "informational | commercial | transactional | navigational | comparison | template | mixed",
      "dominantContentTypes": ["string"],
      "topRankingDomains": ["string"],
      "recurringThemes": ["string"],
      "weakSpots": ["string"],
      "opportunity": "string",
      "evidence": [
        {
          "position": 1,
          "title": "string",
          "domain": "string",
          "url": "string"
        }
      ]
    }
  ],
  "serpPatterns": [
    {
      "pattern": "string",
      "relatedQueries": ["string"],
      "whyItMatters": "string"
    }
  ],
  "domainVisibility": [
    {
      "domain": "string",
      "domainType": "direct_competitor | indirect_competitor | seo_publisher | community | platform | agency | tool_vendor | other",
      "appearedForQueries": ["string"],
      "appearanceCount": 1,
      "observedPositioning": "string",
      "relevanceToCompany": "low | medium | high"
    }
  ],
  "contentGaps": [
    {
      "gap": "string",
      "gapType": "audience_gap | format_gap | depth_gap | pov_gap | workflow_gap | product_gap | freshness_gap",
      "relatedQueries": ["string"],
      "whyItMatters": "string",
      "suggestedContentAngle": "string",
      "priority": "low | medium | high"
    }
  ],
  "angleOpportunities": [
    {
      "angle": "string",
      "evidenceFromSearch": "string",
      "whyCompanyCanWin": "string",
      "recommendedCluster": "string",
      "businessValue": "low | medium | high",
      "seoOpportunity": "low | medium | high"
    }
  ],
  "recommendedStrategicFocus": "string",
  "implicationsForContentPlan": {
    "recommendedClusters": ["string"],
    "topicsToPrioritize": ["string"],
    "topicsToAvoidOrDelay": ["string"],
    "suggestedFirstPost": "string"
  },
  "assumptions": ["string"],
  "risks": ["string"]
}

COMPANY PROFILE:
${JSON.stringify(companyProfile, null, 2)}

RAW SEARCH RESULTS:
${JSON.stringify(rawResults, null, 2)}
`;
}

function validateSearchLandscape(
  searchLandscape: SearchLandscape,
  rawSearchResults: RawSearchResultsArtifact,
): void {
  if (!Array.isArray(searchLandscape.queryAnalyses)) {
    throw new Error("Invalid search landscape: queryAnalyses must be an array. Saved invalid JSON to artifacts/search_landscape_invalid.json");
  }

  if (searchLandscape.queryAnalyses.length !== rawSearchResults.results.length) {
    throw new Error(`Invalid search landscape: expected ${rawSearchResults.results.length} queryAnalyses, got ${searchLandscape.queryAnalyses.length}. Saved invalid JSON to artifacts/search_landscape_invalid.json`);
  }

  if (!Array.isArray(searchLandscape.domainVisibility)) {
    throw new Error("Invalid search landscape: domainVisibility must be an array. Saved invalid JSON to artifacts/search_landscape_invalid.json");
  }

  for (const [index, entry] of searchLandscape.domainVisibility.entries()) {
    if (!isDomainVisibilityEntry(entry)) {
      throw new Error(`Invalid search landscape: domainVisibility[${index}] is missing required fields. Saved invalid JSON to artifacts/search_landscape_invalid.json`);
    }
  }

  if (!Array.isArray(searchLandscape.contentGaps)) {
    throw new Error("Invalid search landscape: contentGaps must be an array. Saved invalid JSON to artifacts/search_landscape_invalid.json");
  }

  if (!Array.isArray(searchLandscape.angleOpportunities)) {
    throw new Error("Invalid search landscape: angleOpportunities must be an array. Saved invalid JSON to artifacts/search_landscape_invalid.json");
  }

  if (typeof searchLandscape.recommendedStrategicFocus !== "string" || !searchLandscape.recommendedStrategicFocus.trim()) {
    throw new Error("Invalid search landscape: recommendedStrategicFocus must be a non-empty string. Saved invalid JSON to artifacts/search_landscape_invalid.json");
  }

  if (!Array.isArray(searchLandscape.implicationsForContentPlan?.recommendedClusters)) {
    throw new Error("Invalid search landscape: implicationsForContentPlan.recommendedClusters must be an array. Saved invalid JSON to artifacts/search_landscape_invalid.json");
  }
}

function isDomainVisibilityEntry(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;

  const entry = value as Record<string, unknown>;
  return typeof entry.domain === "string" &&
    typeof entry.domainType === "string" &&
    Array.isArray(entry.appearedForQueries) &&
    typeof entry.appearanceCount === "number" &&
    typeof entry.observedPositioning === "string" &&
    typeof entry.relevanceToCompany === "string";
}

function normalizeOrganicResults(results: SerperOrganicResult[]): RawSearchResult[] {
  return results.map((result, index) => {
    const url = result.link ?? "";
    return {
      position: result.position ?? index + 1,
      title: result.title ?? "",
      url,
      domain: getDomain(url),
      snippet: result.snippet ?? "",
    };
  });
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
