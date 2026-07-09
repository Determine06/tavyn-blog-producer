import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { logInfo, logStep, logSuccess } from "../lib/logger.js";

export type CachedStepResult<T> = {
  stepName: string;
  artifactPath: string;
  cacheHit: boolean;
  didRun: boolean;
  data: T;
};

export type RunCachedStepOptions<T> = {
  stepName: string;
  artifactPath: string;
  force?: boolean;
  run: () => Promise<T>;
};

export async function runCachedStep<T>(
  options: RunCachedStepOptions<T>,
): Promise<CachedStepResult<T>> {
  const { stepName, artifactPath, force = false, run } = options;

  if (!force) {
    try {
      const cachedArtifact = await readFile(artifactPath, "utf8");
      const data = JSON.parse(cachedArtifact) as T;

      logInfo(`Using cached artifact for ${stepName}: ${artifactPath}`);

      return {
        stepName,
        artifactPath,
        cacheHit: true,
        didRun: false,
        data,
      };
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }

  if (force) {
    logStep(`Force enabled for ${stepName}; running step.`);
  } else {
    logStep(`No cached artifact found for ${stepName}; running step.`);
  }

  const data = await run();

  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  logSuccess(`Saved artifact for ${stepName}: ${artifactPath}`);

  return {
    stepName,
    artifactPath,
    cacheHit: false,
    didRun: true,
    data,
  };
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
