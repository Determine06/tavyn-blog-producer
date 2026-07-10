import { env } from "./config/env.js";
import { runCachedStep } from "./cache/runCachedStep.js";
import { logError, logInfo, logSuccess } from "./lib/logger.js";
import {
  generateCompanyProfileContext,
  generateCompanyProfileFromContext,
} from "./steps/generateCompanyProfile.js";
import { collectQueryMetrics } from "./steps/collectQueryMetrics.js";
import { collectSerpData } from "./steps/collectSerpData.js";
import { generateCandidateTopicalClusters } from "./steps/generateCandidateTopicalClusters.js";

type CliOptions = {
  websiteUrl: string;
  forceCrawl: boolean;
  forceProfile: boolean;
  forceClusters: boolean;
  forceSerp: boolean;
  forceQueryMetrics: boolean;
};

function parseCliOptions(argv: string[]): CliOptions {
  const forceCrawl = argv.includes("--force-crawl");
  const forceProfile = argv.includes("--force-profile");
  const forceClusters = argv.includes("--force-clusters");
  const forceSerp = argv.includes("--force-serp");
  const forceQueryMetrics = argv.includes("--force-query-metrics");
  const urlArgs = argv.filter((arg) => !arg.startsWith("--"));

  return {
    websiteUrl: urlArgs[0] ?? "https://tavyn.dev/",
    forceCrawl,
    forceProfile,
    forceClusters,
    forceSerp,
    forceQueryMetrics,
  };
}

function createSafeHostname(websiteUrl: string): string {
  return new URL(websiteUrl).hostname
    .replace(/^www\./, "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .toLowerCase();
}

function hasQueryCandidates(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.topical_clusters)) {
    return false;
  }

  return value.topical_clusters.some((cluster) => {
    if (!isRecord(cluster)) {
      return false;
    }

    const pillarPage = cluster.pillar_page;
    const subpages = cluster.subpages;

    return (
      (isRecord(pillarPage) && Array.isArray(pillarPage.query_candidates)) ||
      (Array.isArray(subpages) &&
        subpages.some(
          (subpage) =>
            isRecord(subpage) && Array.isArray(subpage.query_candidates),
        ))
    );
  });
}

function hasLegacyPrimaryQueries(
  value: unknown,
): value is Parameters<typeof collectSerpData>[0] {
  if (!isRecord(value) || !Array.isArray(value.topical_clusters)) {
    return false;
  }

  return value.topical_clusters.every((cluster) => {
    if (!isRecord(cluster) || !isRecord(cluster.pillar_page)) {
      return false;
    }

    const subpages = cluster.subpages;

    return (
      typeof cluster.pillar_page.primary_query === "string" &&
      Array.isArray(subpages) &&
      subpages.every(
        (subpage) =>
          isRecord(subpage) && typeof subpage.primary_query === "string",
      )
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function main(): Promise<void> {
  try {
    const {
      websiteUrl,
      forceCrawl,
      forceProfile,
      forceClusters,
      forceSerp,
      forceQueryMetrics,
    } = parseCliOptions(process.argv.slice(2));
    const safeHostname = createSafeHostname(websiteUrl);
    const crawlArtifactPath = `artifacts/${safeHostname}/crawl-context.json`;
    const companyProfileArtifactPath = `artifacts/${safeHostname}/company-profile.json`;
    const topicalClustersArtifactPath = `artifacts/${safeHostname}/topical-clusters.json`;
    const serpDataArtifactPath = `artifacts/${safeHostname}/serp-data.json`;
    const queryAnalysisArtifactPath = `artifacts/${safeHostname}/query-analysis.json`;

    logSuccess("Environment validation passed");
    logInfo(`Firecrawl API key loaded: ${env.FIRECRAWL_API_KEY.length > 0}`);
    logInfo(`Company profile website URL: ${websiteUrl}`);
    logInfo(`forceCrawl: ${forceCrawl}`);
    logInfo(`forceProfile: ${forceProfile}`);
    logInfo(`forceClusters: ${forceClusters}`);
    logInfo(`forceSerp: ${forceSerp}`);
    logInfo(`forceQueryMetrics: ${forceQueryMetrics}`);
    logInfo(`Crawl artifact path: ${crawlArtifactPath}`);
    logInfo(`Company profile artifact path: ${companyProfileArtifactPath}`);
    logInfo(`Topical clusters artifact path: ${topicalClustersArtifactPath}`);
    logInfo(`SERP data artifact path: ${serpDataArtifactPath}`);
    logInfo(`Query analysis artifact path: ${queryAnalysisArtifactPath}`);

    const crawlResult = await runCachedStep({
      stepName: "company-profile-crawl",
      artifactPath: crawlArtifactPath,
      force: forceCrawl,
      run: () => generateCompanyProfileContext(websiteUrl),
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

    const companyProfileResult = await runCachedStep({
      stepName: "company-profile-generation",
      artifactPath: companyProfileArtifactPath,
      force: forceProfile,
      run: () => generateCompanyProfileFromContext(companyProfileContext),
    });
    const companyProfile = companyProfileResult.data;

    logInfo(`Company profile cache hit: ${companyProfileResult.cacheHit}`);
    logInfo(`Company profile step ran: ${companyProfileResult.didRun}`);
    logInfo(
      `Overall confidence: ${companyProfile.profile_quality.overall_confidence}`,
    );

    const topicalClustersResult = await runCachedStep({
      stepName: "topical-cluster-generation",
      artifactPath: topicalClustersArtifactPath,
      force: forceClusters,
      run: () => generateCandidateTopicalClusters(companyProfile),
    });
    const topicalClusters = topicalClustersResult.data;

    logInfo(`Topical clusters cache hit: ${topicalClustersResult.cacheHit}`);
    logInfo(`Topical clusters step ran: ${topicalClustersResult.didRun}`);
    logInfo(`Topical cluster count: ${topicalClusters.topical_clusters.length}`);
    logInfo(
      `Topical clusters confidence: ${topicalClusters.generation_quality.overall_confidence}`,
    );

    if (hasQueryCandidates(topicalClusters)) {
      logInfo(
        "Topical clusters generated with query_candidates. SERP collection requires validated selected queries and is skipped for now.",
      );
      return;
    }

    if (!hasLegacyPrimaryQueries(topicalClusters)) {
      logInfo(
        "Topical clusters do not include selected SERP queries. SERP collection is skipped for now.",
      );
      return;
    }

    const serpDataResult = await runCachedStep({
      stepName: "serp-data-collection",
      artifactPath: serpDataArtifactPath,
      force: forceSerp,
      run: () => collectSerpData(topicalClusters),
    });
    const serpData = serpDataResult.data;

    logInfo(`SERP data cache hit: ${serpDataResult.cacheHit}`);
    logInfo(`SERP data step ran: ${serpDataResult.didRun}`);
    logInfo(`SERP query entries: ${serpData.queries.length}`);

    const queryMetricsResult = await runCachedStep({
      stepName: "query-metrics-collection",
      artifactPath: queryAnalysisArtifactPath,
      force: forceQueryMetrics,
      run: () => collectQueryMetrics(serpData),
    });

    logInfo(`Query metrics cache hit: ${queryMetricsResult.cacheHit}`);
    logInfo(`Query metrics step ran: ${queryMetricsResult.didRun}`);
    logInfo(`Query analyses: ${queryMetricsResult.data.length}`);
  } catch (error) {
    logError("Local pipeline run failed", error);
    process.exitCode = 1;
  }
}

await main();
