import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCacheMode,
  parseForceStages,
  parsePipelineCliOptions,
  parseStopAfter,
} from "./options.js";
import { pipelineStageIds } from "./stages.js";

test("cache modes parse and default to cache", () => {
  assert.equal(parseCacheMode([]), "cache");
  assert.equal(parseCacheMode(["--cache"]), "cache");
  assert.equal(parseCacheMode(["--no-cache"]), "no-cache");
  assert.throws(() => parseCacheMode(["--cache", "--no-cache"]));
});

test("force stages parse, dedupe, and preserve pipeline order", () => {
  assert.deepEqual(
    parseForceStages(
      ["--force", "query-validation", "--force", "seed-keywords", "--force", "seed-keywords"],
      null,
      "cache",
    ),
    ["seed-keywords", "query-validation"],
  );
});

test("force all is supported through the stop point", () => {
  assert.deepEqual(
    parseForceStages(["--force", "all"], "query-validation", "cache"),
    [
      "crawl-context",
      "company-profile",
      "seed-keywords",
      "keyword-metrics",
      "query-validation",
    ],
  );
});

test("unknown force and stop stages are rejected before execution", () => {
  assert.throws(() => parseForceStages(["--force", "unknown"], null, "cache"));
  assert.throws(() => parseStopAfter(["--stop-after", "unknown"]));
});

test("every valid stop point is accepted", () => {
  for (const stageId of pipelineStageIds) {
    assert.equal(parseStopAfter(["--stop-after", stageId]), stageId);
  }
});

test("force selection after stop point is rejected", () => {
  assert.throws(() =>
    parseForceStages(
      ["--force", "query-validation"],
      "seed-keywords",
      "cache",
    ),
  );
});

test("no-cache forces only stages through the stop point", () => {
  assert.deepEqual(parseForceStages([], "seed-keywords", "no-cache"), [
    "crawl-context",
    "company-profile",
    "seed-keywords",
  ]);
});

test("legacy force flags normalize into typed force configuration", () => {
  const options = parsePipelineCliOptions([
    "https://example.com",
    "--force-seed-keywords",
    "--stop-after",
    "query-validation",
  ]);

  assert.equal(options.websiteUrl, "https://example.com");
  assert.equal(options.forceSeedKeywords, true);
  assert.equal(options.stopAfter, "query-validation");
});

test("confirmed queries can be forced with modern and legacy flags", () => {
  const modernOptions = parsePipelineCliOptions([
    "https://example.com",
    "--force",
    "confirmed-queries",
  ]);
  const legacyOptions = parsePipelineCliOptions([
    "https://example.com",
    "--force-confirmed-queries",
  ]);

  assert.deepEqual(modernOptions.forceStages, ["confirmed-queries"]);
  assert.equal(modernOptions.forceConfirmedQueries, true);
  assert.deepEqual(legacyOptions.forceStages, ["confirmed-queries"]);
  assert.equal(legacyOptions.forceConfirmedQueries, true);
});

test("artifact root parses without becoming the website URL", () => {
  const options = parsePipelineCliOptions([
    "https://example.com",
    "--artifact-root",
    "artifacts/stress-tests/phase1",
    "--stop-after",
    "query-validation",
  ]);

  assert.equal(options.websiteUrl, "https://example.com");
  assert.equal(options.artifactRoot, "artifacts/stress-tests/phase1");
});
