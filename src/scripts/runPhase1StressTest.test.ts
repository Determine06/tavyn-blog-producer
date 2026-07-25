import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompanyArgs,
  createDryRunPlan,
  parsePhase1Options,
  phase1Companies,
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
        slug: "featurebase",
        url: "https://www.featurebase.app/",
      },
      {
        name: "Trigger.dev",
        slug: "trigger-dev",
        url: "https://trigger.dev/",
      },
      {
        name: "Harpsen",
        slug: "harpsen",
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
    ["--cache", "--force", "seed-keywords", "--stop-after", "query-validation"],
    ["--cache", "--force", "seed-keywords", "--stop-after", "query-validation"],
    ["--cache", "--force", "seed-keywords", "--stop-after", "query-validation"],
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

  assert.deepEqual(visited, ["featurebase", "trigger-dev"]);
  assert.deepEqual(exitCodes, [0, 1]);
});
