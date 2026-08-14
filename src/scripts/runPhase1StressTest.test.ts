import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildCompanyArgs,
  copySnapshotArtifacts,
  createDryRunPlan,
  getCompanySnapshotDirectory,
  parsePhase1Options,
  phase1Companies,
  phase1SuiteDirectory,
  runSequentialFailFast,
} from "./runPhase1StressTest.js";

test("Phase 1 suite contains exactly the three expected companies in order", () => {
  assert.deepEqual(
    phase1Companies.map((company) => ({
      name: company.name,
      slug: company.slug,
      url: company.url,
    })),
    [
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
    ],
  );
});

test("default Phase 1 behavior uses cache and stops at query validation", () => {
  const options = parsePhase1Options([]);

  assert.equal(options.cacheMode, "cache");
  assert.deepEqual(options.forceStages, []);
  assert.equal(options.stopAfter, "query-validation");
});

test("all companies receive the same resolved CLI configuration", () => {
  const options = parsePhase1Options([
    "--cache",
    "--force",
    "seed-keywords",
    "--stop-after",
    "query-validation",
  ]);
  const companyArgs = phase1Companies.map((company) =>
    buildCompanyArgs(company, options).slice(1),
  );

  assert.deepEqual(companyArgs, [
    [
      "--cache",
      "--artifact-root",
      phase1SuiteDirectory,
      "--force",
      "seed-keywords",
      "--stop-after",
      "query-validation",
    ],
    [
      "--cache",
      "--artifact-root",
      phase1SuiteDirectory,
      "--force",
      "seed-keywords",
      "--stop-after",
      "query-validation",
    ],
    [
      "--cache",
      "--artifact-root",
      phase1SuiteDirectory,
      "--force",
      "seed-keywords",
      "--stop-after",
      "query-validation",
    ],
  ]);
});

test("dry-run plan contains child argument arrays but executes no child process", () => {
  const options = parsePhase1Options(["--dry-run"]);
  const plan = createDryRunPlan(options);

  assert.equal(options.dryRun, true);
  assert.equal(plan.length, 3);
  assert.deepEqual(
    plan.map((item) => item.args.at(-2)),
    ["--stop-after", "--stop-after", "--stop-after"],
  );
});

test("companies run sequentially and failure prevents later companies", async () => {
  const visited: string[] = [];
  const exitCodes = await runSequentialFailFast(phase1Companies, async (company) => {
    visited.push(company.slug);
    return company.slug === "trigger-dev" ? 1 : 0;
  });

  assert.deepEqual(visited, ["featurebase-app", "trigger-dev"]);
  assert.deepEqual(exitCodes, [0, 1]);
});

test("Phase 1 snapshots use permanent company directories with no timestamp segment", () => {
  const directories = phase1Companies.map((company) =>
    getCompanySnapshotDirectory(company),
  );

  assert.equal(phase1SuiteDirectory, "artifacts/stress-tests/phase1");
  assert.deepEqual(directories, [
    "artifacts/stress-tests/phase1/featurebase-app",
    "artifacts/stress-tests/phase1/trigger-dev",
    "artifacts/stress-tests/phase1/harpsen-com",
  ]);
  assert.equal(
    directories.some((directory) =>
      /\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/.test(directory),
    ),
    false,
  );
});

test("repeated Phase 1 runs target the same company snapshot directories", () => {
  const firstRunDirectories = phase1Companies.map((company) =>
    getCompanySnapshotDirectory(company),
  );
  const secondRunDirectories = phase1Companies.map((company) =>
    getCompanySnapshotDirectory(company),
  );

  assert.deepEqual(secondRunDirectories, firstRunDirectories);
});

test("snapshot copying replaces previous company artifacts", async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "phase1-snapshot-"));

  try {
    const sourceFile = path.join(fixtureRoot, "keyword_metrics.json");
    const snapshotDirectory = path.join(fixtureRoot, "featurebase-app");
    const staleFile = path.join(snapshotDirectory, "query-validations.json");

    await mkdir(snapshotDirectory, { recursive: true });
    await writeFile(sourceFile, "current metrics", "utf8");
    await writeFile(staleFile, "stale downstream", "utf8");

    const copiedPaths = await copySnapshotArtifacts(snapshotDirectory, [
      sourceFile,
    ]);

    assert.deepEqual(copiedPaths, [
      path.join(snapshotDirectory, "keyword_metrics.json"),
    ]);
    assert.equal(
      await readFile(path.join(snapshotDirectory, "keyword_metrics.json"), "utf8"),
      "current metrics",
    );
    await assert.rejects(() => readFile(staleFile, "utf8"), {
      code: "ENOENT",
    });
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("snapshot copying only copies artifacts through the requested stop stage", async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "phase1-stop-"));

  try {
    const sourceDirectory = path.join(fixtureRoot, "regular-company-artifacts");
    const snapshotDirectory = path.join(fixtureRoot, "trigger-dev");
    const artifactPaths = [
      path.join(sourceDirectory, "crawl-context.json"),
      path.join(sourceDirectory, "company-profile.json"),
      path.join(sourceDirectory, "seed-keywords.json"),
      path.join(sourceDirectory, "keyword_metrics.json"),
    ];
    const downstreamPath = path.join(sourceDirectory, "query-validations.json");

    await mkdir(sourceDirectory, { recursive: true });
    await writeFile(downstreamPath, "regular downstream artifact", "utf8");

    for (const artifactPath of artifactPaths) {
      await writeFile(artifactPath, path.basename(artifactPath), "utf8");
    }

    await copySnapshotArtifacts(snapshotDirectory, artifactPaths);

    assert.deepEqual(
      (
        await Promise.all(
          artifactPaths.map((artifactPath) =>
            readFile(
              path.join(snapshotDirectory, path.basename(artifactPath)),
              "utf8",
            ),
          ),
        )
      ).sort(),
      [
        "company-profile.json",
        "crawl-context.json",
        "keyword_metrics.json",
        "seed-keywords.json",
      ],
    );
    await assert.rejects(
      () => readFile(path.join(snapshotDirectory, "query-validations.json"), "utf8"),
      { code: "ENOENT" },
    );
    assert.equal(
      await readFile(downstreamPath, "utf8"),
      "regular downstream artifact",
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
