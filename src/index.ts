import { env } from "./config/env.js";
import { runCachedStep } from "./cache/runCachedStep.js";
import { logError, logInfo, logSuccess } from "./lib/logger.js";
import {
  generateCompanyProfileContext,
  generateCompanyProfileFromContext,
} from "./steps/generateCompanyProfile.js";
import { generateCandidateTopicalClusters } from "./steps/generateCandidateTopicalClusters.js";

type CliOptions = {
  websiteUrl: string;
  forceCrawl: boolean;
  forceProfile: boolean;
  forceClusters: boolean;
};

function parseCliOptions(argv: string[]): CliOptions {
  const forceCrawl = argv.includes("--force-crawl");
  const forceProfile = argv.includes("--force-profile");
  const forceClusters = argv.includes("--force-clusters");
  const urlArgs = argv.filter((arg) => !arg.startsWith("--"));

  return {
    websiteUrl: urlArgs[0] ?? "https://tavyn.dev/",
    forceCrawl,
    forceProfile,
    forceClusters,
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
    const { websiteUrl, forceCrawl, forceProfile, forceClusters } =
      parseCliOptions(process.argv.slice(2));
    const safeHostname = createSafeHostname(websiteUrl);
    const crawlArtifactPath = `artifacts/${safeHostname}/crawl-context.json`;
    const companyProfileArtifactPath = `artifacts/${safeHostname}/company-profile.json`;
    const topicalClustersArtifactPath = `artifacts/${safeHostname}/topical-clusters.json`;

    logSuccess("Environment validation passed");
    logInfo(`Firecrawl API key loaded: ${env.FIRECRAWL_API_KEY.length > 0}`);
    logInfo(`Company profile website URL: ${websiteUrl}`);
    logInfo(`forceCrawl: ${forceCrawl}`);
    logInfo(`forceProfile: ${forceProfile}`);
    logInfo(`forceClusters: ${forceClusters}`);
    logInfo(`Crawl artifact path: ${crawlArtifactPath}`);
    logInfo(`Company profile artifact path: ${companyProfileArtifactPath}`);
    logInfo(`Topical clusters artifact path: ${topicalClustersArtifactPath}`);

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
  } catch (error) {
    logError("Local pipeline run failed", error);
    process.exitCode = 1;
  }
}

await main();
