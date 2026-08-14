import assert from "node:assert/strict";
import test from "node:test";

import { resolvePipelineArgs } from "./interactiveOptions.js";
import { parsePipelineCliOptions } from "./options.js";

test("argument-free dev runs prompt for a website and enable cached Supabase output", async () => {
  const args = await resolvePipelineArgs([], async () => " example.com ");

  assert.deepEqual(args, [
    "example.com",
    "--artifact-root",
    "artifacts",
    "--cache",
    "--stop-after",
    "company-report",
    "--save-to-supabase",
  ]);

  const options = parsePipelineCliOptions(args);

  assert.equal(options.websiteUrl, "example.com");
  assert.equal(options.artifactRoot, "artifacts");
  assert.equal(options.cacheMode, "cache");
  assert.equal(options.stopAfter, "company-report");
  assert.equal(options.saveToSupabase, true);
});

test("explicit command-line arguments are preserved without prompting", async () => {
  let prompted = false;
  const suppliedArgs = ["https://example.com", "--no-cache"];

  const args = await resolvePipelineArgs(suppliedArgs, async () => {
    prompted = true;
    return "https://ignored.example";
  });

  assert.equal(args, suppliedArgs);
  assert.equal(prompted, false);
});

test("interactive dev runs reject an empty website", async () => {
  await assert.rejects(
    resolvePipelineArgs([], async () => "   "),
    /Website URL is required/,
  );
});
