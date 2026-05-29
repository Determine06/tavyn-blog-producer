import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SearchQueryPlan = {
  generatedAt: string;
  companyName: string;
  totalQueries: number;
  queries: Array<{
    id: string;
    query: string;
    queryType: string;
    funnelStage: string;
    readerStage: string;
    whySearchThis: string;
    sourceSignals: string[];
  }>;
};

type SerperOrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
};

type SerperResponse = {
  searchParameters?: Record<string, unknown>;
  organic?: SerperOrganicResult[];
  peopleAlsoAsk?: unknown[];
  relatedSearches?: unknown[];
  credits?: number;
  [key: string]: unknown;
};

type NormalizedPreview = {
  generatedAt: string;
  query: {
    id: string;
    query: string;
    queryType: string;
    funnelStage: string;
    readerStage: string;
  };
  organicResults: Array<{
    position: number;
    title: string;
    url: string;
    domain: string;
    snippet?: string;
  }>;
};

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const artifactsDir = path.join(projectRoot, "artifacts");
  const queryPlanPath = path.join(artifactsDir, "search_queries.json");
  const rawOutputPath = path.join(artifactsDir, "first_search_response.json");
  const previewOutputPath = path.join(artifactsDir, "first_search_preview.json");

  await loadDotEnv(projectRoot);

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing SERPER_API_KEY. Add it to your environment or .env before running the first search smoke test.");
  }

  const queryPlan = await readSearchQueryPlan(queryPlanPath);
  const firstQuery = queryPlan.queries[0];
  if (!firstQuery) {
    throw new Error("artifacts/search_queries.json does not contain any queries. Run: npx tsx src/search-landscape/run-queries.ts");
  }

  console.log("Loaded first query from artifacts/search_queries.json");
  console.log("");
  console.log("Searching Serper for:");
  console.log(`"${firstQuery.query}"`);
  console.log("");

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: firstQuery.query,
      gl: "us",
      hl: "en",
      num: 10,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error(`Serper request failed with status ${response.status}`);
    console.error(responseText);
    process.exitCode = 1;
    return;
  }

  const serperResponse = JSON.parse(responseText) as SerperResponse;
  const organicResults = serperResponse.organic ?? [];
  const topLevelKeys = Object.keys(serperResponse);
  const normalizedPreview = buildPreview(firstQuery, organicResults);

  await mkdir(artifactsDir, { recursive: true });
  await writeFile(rawOutputPath, `${JSON.stringify(serperResponse, null, 2)}\n`, "utf8");
  await writeFile(previewOutputPath, `${JSON.stringify(normalizedPreview, null, 2)}\n`, "utf8");

  console.log(`Response status: ${response.status}`);
  console.log(`Top-level keys: ${topLevelKeys.join(", ")}`);
  console.log(`Organic results: ${organicResults.length}`);
  console.log("");

  if (organicResults.length === 0) {
    console.warn("Warning: Serper returned no organic results.");
  } else {
    console.log("Top 3 organic results:");
    console.log("");
    for (const result of normalizedPreview.organicResults.slice(0, 3)) {
      console.log(`${result.position}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Domain: ${result.domain}`);
      if (result.snippet) {
        console.log(`   Snippet: ${result.snippet}`);
      }
      console.log("");
    }
  }

  console.log("Saved raw response to artifacts/first_search_response.json");
  console.log("Saved normalized preview to artifacts/first_search_preview.json");
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

async function readSearchQueryPlan(queryPlanPath: string): Promise<SearchQueryPlan> {
  try {
    const rawPlan = await readFile(queryPlanPath, "utf8");
    return JSON.parse(rawPlan) as SearchQueryPlan;
  } catch (error) {
    if (isFileMissing(error)) {
      throw new Error("Missing artifacts/search_queries.json. Run: npx tsx src/search-landscape/run-queries.ts");
    }

    throw error;
  }
}

function buildPreview(query: SearchQueryPlan["queries"][number], organicResults: SerperOrganicResult[]): NormalizedPreview {
  return {
    generatedAt: new Date().toISOString(),
    query: {
      id: query.id,
      query: query.query,
      queryType: query.queryType,
      funnelStage: query.funnelStage,
      readerStage: query.readerStage,
    },
    organicResults: organicResults.map((result, index) => {
      const url = result.link ?? "";
      return {
        position: result.position ?? index + 1,
        title: result.title ?? "",
        url,
        domain: getDomain(url),
        snippet: result.snippet,
      };
    }),
  };
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
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
