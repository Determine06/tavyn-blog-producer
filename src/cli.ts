import { readFile } from "node:fs/promises";

import { runCachedStep } from "./cache/runCachedStep.js";
import { logError, logInfo, logSuccess } from "./lib/logger.js";
import { collectQueryMetrics } from "./steps/collectQueryMetrics.js";
import { collectSerpData } from "./steps/collectSerpData.js";
import { SerpDataSchema } from "./types/serpData.schema.js";

async function main(): Promise<void> {
  try {
    const [command, ...args] = process.argv.slice(2);

    if (command === "collect-serp-data") {
      await runCollectSerpData(args);
      return;
    }

    if (command === "collect-query-metrics") {
      await runCollectQueryMetrics(args);
      return;
    }

    if (command === "analyze-queries") {
      throw new Error("analyze-queries is not implemented yet.");
    }

    throw new Error(`Unknown CLI command: ${command ?? "(missing)"}`);
  } catch (error) {
    logError("CLI command failed", error);
    process.exitCode = 1;
  }
}

async function runCollectSerpData(args: string[]): Promise<void> {
  const force = args.includes("--force");
  const topicalClustersArtifactPath =
    "artifacts/tavyn-dev/topical-clusters.json";
  const serpDataArtifactPath = "artifacts/tavyn-dev/serp-data.json";

  logInfo(`force: ${force}`);
  logInfo(`Input artifact: ${topicalClustersArtifactPath}`);
  logInfo(`Output artifact: ${serpDataArtifactPath}`);

  const result = await runCachedStep({
    stepName: "serp-data-collection",
    artifactPath: serpDataArtifactPath,
    force,
    run: async () => {
      const topicalClusters = JSON.parse(
        await readFile(topicalClustersArtifactPath, "utf8"),
      ) as unknown;

      if (!hasLegacyPrimaryQueries(topicalClusters)) {
        throw new Error(
          "SERP collection requires validated selected queries. The current topical cluster artifact uses query_candidates.",
        );
      }

      return collectSerpData(topicalClusters);
    },
  });

  logInfo(`SERP data cache hit: ${result.cacheHit}`);
  logInfo(`SERP data step ran: ${result.didRun}`);
  logInfo(`SERP query entries: ${result.data.queries.length}`);
  logSuccess("CLI command completed");
}

async function runCollectQueryMetrics(args: string[]): Promise<void> {
  const force = args.includes("--force");
  const serpDataArtifactPath = "artifacts/tavyn-dev/serp-data.json";
  const queryAnalysisArtifactPath = "artifacts/tavyn-dev/query-analysis.json";

  logInfo(`force: ${force}`);
  logInfo(`Input artifact: ${serpDataArtifactPath}`);
  logInfo(`Output artifact: ${queryAnalysisArtifactPath}`);

  const result = await runCachedStep({
    stepName: "query-metrics-collection",
    artifactPath: queryAnalysisArtifactPath,
    force,
    run: async () => {
      const serpData = SerpDataSchema.parse(
        JSON.parse(await readFile(serpDataArtifactPath, "utf8")),
      );

      return collectQueryMetrics(serpData);
    },
  });

  logInfo(`Query metrics cache hit: ${result.cacheHit}`);
  logInfo(`Query metrics step ran: ${result.didRun}`);
  logInfo(`Query analyses: ${result.data.length}`);
  logSuccess("CLI command completed");
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

await main();
