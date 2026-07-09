import Firecrawl from "firecrawl";

import { env } from "../config/env.js";
import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import { runStructuredPromptFile } from "../llm/runStructuredPromptFile.js";
import {
  CompanyProfileSchema,
  type CompanyProfile,
} from "../types/companyProfile.schema.js";

export type CrawledProfilePage = {
  url: string;
  title: string | null;
  markdown: string;
};

export type CompanyProfileContext = {
  websiteUrl: string;
  pages: CrawledProfilePage[];
  combinedMarkdown: string;
};

const BLOCKED_PROFILE_PATHS = [
  "/login",
  "/log-in",
  "/signin",
  "/sign-in",
  "/signup",
  "/sign-up",
  "/register",
  "/auth",
  "/account",
  "/dashboard",
  "/app",
  "/admin",

  "/privacy",
  "/privacy-policy",
  "/terms",
  "/terms-of-service",
  "/legal",
  "/cookie",
  "/cookies",
  "/gdpr",
  "/dpa",
  "/subprocessors",
  "/security",
  "/trust",
  "/compliance",

  "/careers",
  "/jobs",
  "/hiring",

  "/status",
  "/changelog",
  "/release-notes",
  "/releases",
  "/rss",
  "/sitemap",

  "/help",
  "/support",
];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getCrawlData(crawlResult: unknown): unknown[] {
  if (Array.isArray(crawlResult)) {
    return crawlResult;
  }

  if (!isRecord(crawlResult)) {
    return [];
  }

  const data = crawlResult.data;
  return Array.isArray(data) ? data : [];
}

function normalizePage(page: unknown): CrawledProfilePage | null {
  if (!isRecord(page)) {
    return null;
  }

  const markdown = getString(page.markdown);
  if (markdown === null) {
    return null;
  }

  const metadata = isRecord(page.metadata) ? page.metadata : {};
  const url =
    getString(metadata.sourceURL) ??
    getString(metadata.sourceUrl) ??
    getString(metadata.url) ??
    getString(page.url) ??
    "unknown";
  const title = getString(metadata.title);

  return {
    url,
    title,
    markdown,
  };
}

function buildCombinedMarkdown(pages: CrawledProfilePage[]): string {
  return pages
    .map((page, index) => {
      const titleLine = page.title === null ? "" : `\nTitle: ${page.title}`;

      return [
        `# Crawled Page ${index + 1}`,
        `URL: ${page.url}${titleLine}`,
        "",
        page.markdown,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

export async function generateCompanyProfileContext(
  websiteUrl: string,
): Promise<CompanyProfileContext> {
  const firecrawl = new Firecrawl({
    apiKey: env.FIRECRAWL_API_KEY,
  });

  logStep("Starting Firecrawl company profile crawl");
  logInfo(`Website URL: ${websiteUrl}`);

  const crawlResult = await firecrawl.crawl(websiteUrl, {
    limit: 8,
    maxDiscoveryDepth: 1,
    sitemap: "skip",
    excludePaths: BLOCKED_PROFILE_PATHS,
    scrapeOptions: {
      formats: ["markdown"],
      onlyMainContent: true,
    },
    pollInterval: 2,
    timeout: 120,
  });

  const pages = getCrawlData(crawlResult)
    .map((page) => normalizePage(page))
    .filter((page): page is CrawledProfilePage => page !== null);
  const combinedMarkdown = buildCombinedMarkdown(pages);

  logInfo(`Firecrawl pages returned with markdown: ${pages.length}`);

  for (const page of pages) {
    logInfo(`Crawled page URL: ${page.url}`);
    logInfo(`Crawled page markdown length: ${page.markdown.length}`);
  }

  logInfo(`Total combined markdown length: ${combinedMarkdown.length}`);
  logSuccess("Firecrawl company profile crawl completed");

  return {
    websiteUrl,
    pages,
    combinedMarkdown,
  };
}

export async function generateCompanyProfileFromContext(
  context: CompanyProfileContext,
): Promise<CompanyProfile> {
  logStep("Starting company profile generation");

  const generatedAt = new Date().toISOString();
  const sourcePages = context.pages.map(({ url, title }) => ({
    url,
    title,
  }));
  const input = `<company_profile_input>
  <schema_version>1.0.0</schema_version>
  <generated_at>${generatedAt}</generated_at>
  <website_url>${context.websiteUrl}</website_url>

  <source_pages>
    ${JSON.stringify(sourcePages, null, 2)}
  </source_pages>

  <crawled_markdown>
    ${context.combinedMarkdown}
  </crawled_markdown>
</company_profile_input>`;

  const companyProfile = await runStructuredPromptFile<CompanyProfile>({
    promptFileName: "generate-company-profile.md",
    runtimeInput: input,
    schema: CompanyProfileSchema,
    fallbackSchemaName: "CompanyProfileSchema",
  });

  logSuccess("Company profile generation completed");
  return companyProfile;
}
