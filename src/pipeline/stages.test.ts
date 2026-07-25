import assert from "node:assert/strict";
import test from "node:test";

import { pipelineStageIds } from "./stages.js";

test("stage registry matches the actual pipeline order", () => {
  assert.deepEqual(pipelineStageIds, [
    "crawl-context",
    "company-profile",
    "seed-keywords",
    "keyword-metrics",
    "query-validation",
    "confirmed-queries",
    "query-opportunities",
    "query-recommendations",
    "serp-results",
    "content-recommendation",
    "competitor-landscape",
    "company-report",
  ]);
});
