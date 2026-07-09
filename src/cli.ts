import { readFile } from "node:fs/promises";

import { runCachedStep } from "./cache/runCachedStep.js";
import { logError, logInfo, logSuccess } from "./lib/logger.js";
import { collectSerpData } from "./steps/collectSerpData.js";
import { TopicalClusterCandidatesSchema } from "./types/topicalClusterCandidates.schema.js";

async function main(): Promise<void> {
  try {
    const [command, ...args] = process.argv.slice(2);

    if (command !== "collect-serp-data") {
      throw new Error(`Unknown CLI command: ${command ?? "(missing)"}`);
    }

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
        const topicalClusters = TopicalClusterCandidatesSchema.parse(
          JSON.parse(await readFile(topicalClustersArtifactPath, "utf8")),
        );

        return collectSerpData(topicalClusters);
      },
    });

    logInfo(`SERP data cache hit: ${result.cacheHit}`);
    logInfo(`SERP data step ran: ${result.didRun}`);
    logInfo(`SERP query entries: ${result.data.queries.length}`);
    logSuccess("CLI command completed");
  } catch (error) {
    logError("CLI command failed", error);
    process.exitCode = 1;
  }
}

await main();
