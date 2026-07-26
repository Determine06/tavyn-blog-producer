import { spawn, spawnSync } from "node:child_process";
import { access, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { resolveArtifactPathsForStop } from "../pipeline/artifacts.js";
import {
  parseCacheMode,
  parseForceStages,
  parseStopAfter,
  type CacheMode,
} from "../pipeline/options.js";
import {
  formatStageList,
  pipelineStageIds,
  type PipelineStageId,
} from "../pipeline/stages.js";

export const phase1Companies = [
  {
    name: "Featurebase",
    slug: "featurebase-app",
    url: "https://www.featurebase.app/",
  },
  {
    name: "Trigger.dev",
    slug: "trigger-dev",
    url: "https://trigger.dev/",
  },
  {
    name: "Harpsen",
    slug: "harpsen-com",
    url: "https://www.harpsen.com/",
  },
] as const;

export const phase1SuiteDirectory = path.join(
  "artifacts",
  "stress-tests",
  "phase1",
);

export type Phase1Company = (typeof phase1Companies)[number];
type SnapshotCompany = {
  slug: string;
  url: string;
};

type Phase1Options = {
  cacheMode: CacheMode;
  forceStages: PipelineStageId[];
  directForceStages: string[];
  stopAfter: PipelineStageId;
  dryRun: boolean;
};

type CompanyManifest = {
  name: string;
  slug: string;
  url: string;
  status: "pending" | "success" | "failed";
  duration_ms: number | null;
  exit_code: number | null;
  snapshot_directory: string | null;
  snapshotted_artifact_paths: string[];
};

export type DryRunCompanyPlan = {
  name: string;
  slug: string;
  url: string;
  args: string[];
};

async function main(): Promise<void> {
  try {
    const argv = process.argv.slice(2);

    if (argv.includes("--help")) {
      printHelp();
      return;
    }

    if (argv.includes("--list-stages")) {
      printStages();
      return;
    }

    const options = parsePhase1Options(argv);

    if (options.dryRun) {
      printDryRun(options);
      return;
    }

    const suiteStart = new Date();
    const suiteDir = phase1SuiteDirectory;
    const manifestPath = path.join(suiteDir, "manifest.json");
    const manifest = createInitialManifest(options, suiteStart, suiteDir);

    await mkdir(suiteDir, { recursive: true });
    await writeManifest(manifestPath, manifest);
    printHeader(options);

    for (const [index, company] of phase1Companies.entries()) {
      console.log(`\n${index + 1}/3 ${company.name}`);

      const companyManifest = manifest.companies[index];
      const startedAt = performance.now();

      if (options.cacheMode === "cache") {
        const restoredPaths = await hydrateCompanyArtifactsFromSnapshot(
          company,
          options.stopAfter,
          suiteDir,
        );

        if (restoredPaths.length > 0) {
          console.log(
            `Restored ${restoredPaths.length} cached artifact(s) from ${getCompanySnapshotDirectory(company, suiteDir)}`,
          );
        }
      }

      const exitCode = await runCompany(company, options);
      const durationMs = Math.round(performance.now() - startedAt);

      companyManifest.duration_ms = durationMs;
      companyManifest.exit_code = exitCode;

      if (exitCode !== 0) {
        companyManifest.status = "failed";
        manifest.overall_status = "failed";
        manifest.completed_at = new Date().toISOString();
        await writeManifest(manifestPath, manifest);
        printSummary(manifest, manifestPath);
        process.exitCode = exitCode || 1;
        return;
      }

      try {
        const snapshot = await snapshotCompanyArtifacts(
          company,
          options.stopAfter,
          suiteDir,
        );

        companyManifest.status = "success";
        companyManifest.snapshot_directory = snapshot.snapshotDirectory;
        companyManifest.snapshotted_artifact_paths =
          snapshot.snapshottedArtifactPaths;
      } catch (error) {
        console.error(
          `Failed to snapshot artifacts for ${company.name}: ${formatError(error)}`,
        );
        companyManifest.status = "failed";
        manifest.overall_status = "failed";
        manifest.completed_at = new Date().toISOString();
        await writeManifest(manifestPath, manifest);
        printSummary(manifest, manifestPath);
        process.exitCode = 1;
        return;
      }

      await writeManifest(manifestPath, manifest);
    }

    manifest.overall_status = "success";
    manifest.completed_at = new Date().toISOString();
    await writeManifest(manifestPath, manifest);
    printSummary(manifest, manifestPath);
  } catch (error) {
    console.error(formatError(error));
    process.exitCode = 1;
  }
}

export function parsePhase1Options(argv: string[]): Phase1Options {
  const cacheMode = parseCacheMode(argv);
  const stopAfter = parseStopAfter(argv) ?? "query-validation";
  const forceStages = parseForceStages(argv, stopAfter, cacheMode);

  return {
    cacheMode,
    forceStages,
    directForceStages: parseDirectForceValues(argv),
    stopAfter,
    dryRun: argv.includes("--dry-run"),
  };
}

export function buildCompanyArgs(
  company: Phase1Company,
  options: Phase1Options,
): string[] {
  const args = [company.url];

  args.push(options.cacheMode === "cache" ? "--cache" : "--no-cache");

  if (options.cacheMode === "cache") {
    for (const stage of options.forceStages) {
      args.push("--force", stage);
    }
  }

  args.push("--stop-after", options.stopAfter);

  return args;
}

export function createDryRunPlan(options: Phase1Options): DryRunCompanyPlan[] {
  return phase1Companies.map((company) => ({
    name: company.name,
    slug: company.slug,
    url: company.url,
    args: buildCompanyArgs(company, options),
  }));
}

export async function runSequentialFailFast<T>(
  items: readonly T[],
  run: (item: T, index: number) => Promise<number>,
): Promise<number[]> {
  const exitCodes: number[] = [];

  for (const [index, item] of items.entries()) {
    const exitCode = await run(item, index);
    exitCodes.push(exitCode);

    if (exitCode !== 0) {
      return exitCodes;
    }
  }

  return exitCodes;
}

async function runCompany(
  company: Phase1Company,
  options: Phase1Options,
): Promise<number> {
  const child = spawn("npm", ["run", "dev", "--", ...buildCompanyArgs(company, options)], {
    stdio: "inherit",
  });

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export function getCompanySnapshotDirectory(
  company: Pick<SnapshotCompany, "slug">,
  suiteDir = phase1SuiteDirectory,
): string {
  return path.join(suiteDir, company.slug);
}

async function snapshotCompanyArtifacts(
  company: Phase1Company,
  stopAfter: PipelineStageId,
  suiteDir: string,
): Promise<{
  snapshotDirectory: string;
  snapshottedArtifactPaths: string[];
}> {
  const snapshotDirectory = getCompanySnapshotDirectory(company, suiteDir);
  const artifactPaths = await resolveArtifactPathsForStop(
    company.url,
    stopAfter,
  );

  const snapshottedArtifactPaths = await copySnapshotArtifacts(
    snapshotDirectory,
    artifactPaths,
  );

  return {
    snapshotDirectory,
    snapshottedArtifactPaths,
  };
}

export async function copySnapshotArtifacts(
  snapshotDirectory: string,
  artifactPaths: string[],
): Promise<string[]> {
  const snapshottedArtifactPaths: string[] = [];

  await rm(snapshotDirectory, { recursive: true, force: true });
  await mkdir(snapshotDirectory, { recursive: true });

  for (const artifactPath of artifactPaths) {
    const destination = path.join(snapshotDirectory, path.basename(artifactPath));

    await copyFile(artifactPath, destination);
    snapshottedArtifactPaths.push(destination);
  }

  return snapshottedArtifactPaths;
}

export async function hydrateCompanyArtifactsFromSnapshot(
  company: SnapshotCompany,
  stopAfter: PipelineStageId,
  suiteDir = phase1SuiteDirectory,
): Promise<string[]> {
  const snapshotDirectory = getCompanySnapshotDirectory(company, suiteDir);
  const artifactPaths = await resolveArtifactPathsForStop(
    company.url,
    stopAfter,
  );
  const restoredArtifactPaths: string[] = [];

  for (const artifactPath of artifactPaths) {
    const source = path.join(snapshotDirectory, path.basename(artifactPath));

    if (!(await fileExists(source))) {
      continue;
    }

    await mkdir(path.dirname(artifactPath), { recursive: true });
    await copyFile(source, artifactPath);
    restoredArtifactPaths.push(artifactPath);
  }

  return restoredArtifactPaths;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function createInitialManifest(
  options: Phase1Options,
  suiteStart: Date,
  suiteDir: string,
) {
  return {
    suite_name: "phase1-stress-test",
    git_branch: gitValue(["branch", "--show-current"]),
    git_commit_sha: gitValue(["rev-parse", "HEAD"]) || null,
    dirty_working_tree: gitValue(["status", "--short"]).length > 0,
    started_at: suiteStart.toISOString(),
    completed_at: null as string | null,
    execution_order: phase1Companies.map((company) => company.slug),
    cache_mode: options.cacheMode,
    direct_force_selections: options.directForceStages,
    effective_force_behavior: options.forceStages,
    stop_after: options.stopAfter,
    snapshot_directory: suiteDir,
    overall_status: "running" as "running" | "success" | "failed",
    companies: phase1Companies.map(
      (company): CompanyManifest => ({
        name: company.name,
        slug: company.slug,
        url: company.url,
        status: "pending",
        duration_ms: null,
        exit_code: null,
        snapshot_directory: null,
        snapshotted_artifact_paths: [],
      }),
    ),
  };
}

async function writeManifest(
  manifestPath: string,
  manifest: ReturnType<typeof createInitialManifest>,
): Promise<void> {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function gitValue(args: string[]): string {
  const result = spawnSync("git", args, {
    encoding: "utf8",
  });

  return result.status === 0 ? result.stdout.trim() : "";
}

function parseDirectForceValues(argv: string[]): string[] {
  const values: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--force") {
      const value = argv[index + 1];

      if (value !== undefined && !value.startsWith("--")) {
        values.push(value);
        index += 1;
      }
      continue;
    }

    if (arg.startsWith("--force=")) {
      values.push(arg.slice("--force=".length));
    }
  }

  return [...new Set(values)];
}

function printHelp(): void {
  console.log(`Phase 1 stress test

Default:
  npm run stress-test:phase1

Runs Featurebase, Trigger.dev, and Harpsen sequentially through query-validation.
Defaults to --cache, no forced stages, and --stop-after query-validation.

Options:
  --cache                  Reuse valid cached artifacts unless forced. Default.
  --no-cache               Force every executed stage through the stop point.
  --force <stage>          Force a stage. Repeatable.
  --force all              Force every executed stage through the stop point.
  --stop-after <stage>     Stop after the selected stage resolves.
  --dry-run                Print resolved execution without child processes.
  --list-stages            Print canonical stages in execution order.
  --help                   Show this help.

Stages:
  ${formatStageList()}

Examples:
  npm run stress-test:phase1 -- --dry-run
  npm run stress-test:phase1 -- --force seed-keywords
  npm run stress-test:phase1 -- --cache --force seed-keywords --stop-after query-validation --dry-run
  npm run stress-test:phase1 -- --no-cache --stop-after seed-keywords
`);
}

function printStages(): void {
  for (const [index, stage] of pipelineStageIds.entries()) {
    console.log(`${index + 1}. ${stage}`);
  }
}

function printDryRun(options: Phase1Options): void {
  printHeader(options);

  for (const [index, company] of createDryRunPlan(options).entries()) {
    console.log(`${index + 1}/3 ${company.name}`);
    console.log(`  URL: ${company.url}`);
    console.log(`  Args: ${JSON.stringify(company.args)}`);
  }
}

function printHeader(options: Phase1Options): void {
  console.log("Phase 1 stress test");
  console.log(`Cache mode: ${options.cacheMode}`);
  console.log(`Force: ${options.forceStages.join(", ") || "none"}`);
  console.log(`Stop after: ${options.stopAfter}`);
}

function printSummary(
  manifest: ReturnType<typeof createInitialManifest>,
  manifestPath: string,
): void {
  console.log("\nPhase 1 stress test summary");

  for (const company of manifest.companies) {
    console.log(
      `${company.name}: ${company.status} (${company.duration_ms ?? 0}ms) ${
        company.snapshot_directory ?? ""
      }`,
    );
  }

  console.log(`Overall result: ${manifest.overall_status}`);
  console.log(`Manifest: ${manifestPath}`);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
