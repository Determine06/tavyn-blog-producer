import { randomUUID } from "node:crypto";

import { env } from "./config/env.js";
import { runCachedStep } from "./cache/runCachedStep.js";
import { logError, logInfo, logSuccess } from "./lib/logger.js";

type CliOptions = {
  websiteUrl: string;
  forceCrawl: boolean;
  forceProfile: boolean;
  forceQueryCandidates: boolean;
  forceSerp: boolean;
  forceQueryMetrics: boolean;
};

type RunContext = {
  runId: string;
  websiteUrl: string;
  targetDomain: string;
  locationCode: number;
  languageCode: string;
  country: string;
  device: "desktop";
  generatedAt: string;
};

function parseCliOptions(argv: string[]): CliOptions {
  const forceCrawl = argv.includes("--force-crawl");
  const forceProfile = argv.includes("--force-profile");
  const forceQueryCandidates =
    argv.includes("--force-query-candidates") ||
    argv.includes("--force-clusters");
  const forceSerp = argv.includes("--force-serp");
  const forceQueryMetrics = argv.includes("--force-query-metrics");
  const urlArgs = argv.filter((arg) => !arg.startsWith("--"));

  return {
    websiteUrl: urlArgs[0] ?? "https://tavyn.dev/",
    forceCrawl,
    forceProfile,
    forceQueryCandidates,
    forceSerp,
    forceQueryMetrics,
  };
}

function createRunContext(websiteUrl: string): RunContext {
  const normalizedUrl = new URL(websiteUrl);

  return {
    runId: randomUUID(),
    websiteUrl: normalizedUrl.toString(),
    targetDomain: normalizedUrl.hostname.replace(/^www\./, ""),
    locationCode: 2840,
    languageCode: "en",
    country: "United States",
    device: "desktop",
    generatedAt: new Date().toISOString(),
  };
}

function createSafeHostname(websiteUrl: string): string {
  return new URL(websiteUrl).hostname
    .replace(/^www\./, "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .toLowerCase();
}

async function main(): Promise<void> {
  try {
    const {
      websiteUrl,
      forceCrawl,
      forceProfile,
      forceQueryCandidates,
      forceSerp,
      forceQueryMetrics,
    } = parseCliOptions(process.argv.slice(2));
    const runContext = createRunContext(websiteUrl);
    const safeHostname = createSafeHostname(runContext.websiteUrl);
    const crawlArtifactPath = `artifacts/${safeHostname}/crawl-context.json`;
    const companyProfileArtifactPath = `artifacts/${safeHostname}/company-profile.json`;
    const queryCandidatesArtifactPath = `artifacts/${safeHostname}/query-candidates.json`;
    const keywordMetricsArtifactPath = `artifacts/${safeHostname}/keyword_metrics.json`;

    logSuccess("Environment validation passed");
    logInfo(`Firecrawl API key loaded: ${env.FIRECRAWL_API_KEY.length > 0}`);
    logInfo(`Run ID: ${runContext.runId}`);
    logInfo(`Target domain: ${runContext.targetDomain}`);
    logInfo(
      `Search market: ${runContext.country}, ${runContext.languageCode}`,
    );
    logInfo(`Device: ${runContext.device}`);
    logInfo(`Company profile website URL: ${runContext.websiteUrl}`);
    logInfo(`forceCrawl: ${forceCrawl}`);
    logInfo(`forceProfile: ${forceProfile}`);
    logInfo(`forceQueryCandidates: ${forceQueryCandidates}`);
    logInfo(`forceSerp: ${forceSerp}`);
    logInfo(`forceQueryMetrics: ${forceQueryMetrics}`);
    logInfo(`Crawl artifact path: ${crawlArtifactPath}`);
    logInfo(`Company profile artifact path: ${companyProfileArtifactPath}`);
    logInfo(`Query candidates artifact path: ${queryCandidatesArtifactPath}`);
    logInfo(`Keyword metrics artifact path: ${keywordMetricsArtifactPath}`);

    const crawlResult = await runCachedStep({
      stepName: "company-profile-crawl",
      artifactPath: crawlArtifactPath,
      force: forceCrawl,
      run: async () => {
        const { generateCompanyProfileContext } = await import(
          "./steps/generateCompanyProfile.js"
        );

        return generateCompanyProfileContext(runContext.websiteUrl);
      },
    });
    const companyProfileContext = crawlResult.data;

    logInfo(`Crawl cache hit: ${crawlResult.cacheHit}`);
    logInfo(`Crawl step ran: ${crawlResult.didRun}`);
    logInfo(
      `Crawl context page count: ${companyProfileContext.pages.length}`,
    );
    logInfo(
      `Crawl context combined markdown length: ${companyProfileContext.combinedMarkdown.length}`,
    );

    const shouldForceProfile = forceProfile || crawlResult.didRun;

    if (crawlResult.didRun && !forceProfile) {
      logInfo(
        "Company profile regeneration required because the crawl artifact changed.",
      );
    }

    const companyProfileResult = await runCachedStep({
      stepName: "company-profile-generation",
      artifactPath: companyProfileArtifactPath,
      force: shouldForceProfile,
      run: async () => {
        const { generateCompanyProfileFromContext } = await import(
          "./steps/generateCompanyProfile.js"
        );

        return generateCompanyProfileFromContext(companyProfileContext);
      },
    });
    const companyProfile = companyProfileResult.data;

    logInfo(`Company profile cache hit: ${companyProfileResult.cacheHit}`);
    logInfo(`Company profile step ran: ${companyProfileResult.didRun}`);
    logInfo(
      `Overall confidence: ${companyProfile.profile_quality.overall_confidence}`,
    );

    const shouldForceQueryCandidates =
      forceQueryCandidates || companyProfileResult.didRun;

    if (companyProfileResult.didRun && !forceQueryCandidates) {
      logInfo(
        "Query candidate regeneration required because the company profile changed.",
      );
    }

    const queryCandidatesResult = await runCachedStep({
      stepName: "query-candidate-generation",
      artifactPath: queryCandidatesArtifactPath,
      force: shouldForceQueryCandidates,
      run: async () => {
        const { generateQueryCandidates } = await import(
          "./steps/generateQueryCandidates.js"
        );

        return generateQueryCandidates(companyProfile, runContext.runId);
      },
    });
    const queryCandidates = queryCandidatesResult.data;

    logInfo(`Query candidates cache hit: ${queryCandidatesResult.cacheHit}`);
    logInfo(`Query candidate step ran: ${queryCandidatesResult.didRun}`);
    logInfo(`Query family count: ${queryCandidates.query_families.length}`);
    logInfo(
      `Total query candidate count: ${queryCandidates.query_families.reduce(
        (total, family) => total + family.query_candidates.length,
        0,
      )}`,
    );
    logInfo(
      `Query generation confidence: ${queryCandidates.generation_quality.overall_confidence}`,
    );
    logSuccess("Query candidate generation stage completed");

    const keywordMetricsResult = await runCachedStep({
      stepName: "keyword-metrics-generation",
      artifactPath: keywordMetricsArtifactPath,
      force: forceQueryMetrics,
      run: async () => {
        const { generateKeywordMetrics } = await import(
          "./steps/generateKeywordMetrics.js"
        );

        return generateKeywordMetrics(queryCandidates, runContext.runId, {
          locationCode: runContext.locationCode,
          locationName: runContext.country,
          languageCode: runContext.languageCode,
        });
      },
    });
    const keywordMetrics = keywordMetricsResult.data;

    logInfo(`Keyword metrics cache hit: ${keywordMetricsResult.cacheHit}`);
    logInfo(`Keyword metrics step ran: ${keywordMetricsResult.didRun}`);
    logInfo(
      `Keyword metrics submitted queries: ${keywordMetrics.summary.submitted_queries}`,
    );
    logInfo(
      `Keyword metrics returned queries: ${keywordMetrics.summary.returned_queries}`,
    );
    logInfo(
      `Keyword metrics no-data queries: ${keywordMetrics.summary.no_data_queries}`,
    );
    logInfo(
      `Keyword metrics positive-volume queries: ${keywordMetrics.summary.positive_volume_queries}`,
    );
    logInfo(
      `Keyword metrics families with positive volume: ${keywordMetrics.summary.families_with_positive_volume}`,
    );
    logInfo(
      `Keyword metrics provider cost: ${keywordMetrics.summary.provider_cost_usd}`,
    );
    logSuccess("Keyword metrics generation stage completed");
    logInfo(
      "Keyword validation is not implemented yet; stopping after keyword_metrics.json.",
    );
  } catch (error) {
    logError("Local pipeline run failed", error);
    process.exitCode = 1;
  }
}

await main();
