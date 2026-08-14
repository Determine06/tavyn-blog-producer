import assert from "node:assert/strict";
import test from "node:test";

import type { ConfirmedQueries } from "../types/confirmedQueries.schema.js";

type MockCompetitorItem = {
  domain?: unknown;
  rating?: number;
};

test("filters generic candidates in provider order and backfills to fifty", async () => {
  const { generateCompetitorLandscape } =
    await importCompetitorLandscapeModule();
  const fetchCalls: Array<{ body: string }> = [];
  const validDomains = Array.from(
    { length: 55 },
    (_, index) => `visibility-${String(index + 1).padStart(2, "0")}.example`,
  );
  const items: MockCompetitorItem[] = [
    { domain: "youtube.com", rating: 1000 },
    { domain: "WWW.Reddit.com", rating: 999 },
    { domain: "subdomain.reddit.com", rating: 998 },
    { domain: "notg2.com", rating: 997 },
    { domain: "play.google.com", rating: 996 },
    { domain: "support.google.com", rating: 995 },
    { domain: "https://regenhealth.app/path", rating: 994 },
    { domain: "SUPPORT.GOOGLE.COM.", rating: 993 },
    { domain: "not a hostname", rating: 992 },
    { rating: 991 },
    ...validDomains.map((domain, index) => ({
      domain,
      rating: 900 - index,
    })),
  ];

  await withMockedFetch(fetchCalls, items, async () => {
    const artifact = await generateCompetitorLandscape(
      buildConfirmedQueries(),
      "run_test",
    );
    const [request] = JSON.parse(fetchCalls[0].body) as Array<{
      limit: number;
      order_by: string[];
    }>;
    const domains = artifact.competitors.map((competitor) => competitor.domain);

    assert.equal(fetchCalls.length, 1);
    assert.equal(request.limit, 1000);
    assert.deepEqual(request.order_by, ["rating,desc"]);
    assert.equal(artifact.request_config.limit, 1000);
    assert.equal(artifact.competitors.length, 50);
    assert.deepEqual(domains.slice(0, 4), [
      "notg2.com",
      "support.google.com",
      "visibility-01.example",
      "visibility-02.example",
    ]);
    assert.equal(domains.includes("youtube.com"), false);
    assert.equal(domains.includes("reddit.com"), false);
    assert.equal(domains.includes("subdomain.reddit.com"), false);
    assert.equal(domains.includes("play.google.com"), false);
    assert.equal(domains.includes("regenhealth.app"), false);
    assert.equal(domains.at(-1), "visibility-48.example");
    assert.deepEqual(
      artifact.competitors.map((competitor) => competitor.rank),
      Array.from({ length: 50 }, (_, index) => index + 1),
    );
    assert.equal(artifact.summary.raw_candidates_received, items.length);
    assert.equal(artifact.summary.domains_received, items.length);
    assert.equal(artifact.summary.generic_candidates_filtered, 4);
    assert.equal(artifact.summary.final_competitors_profiled, 50);
    assert.equal(artifact.summary.competitors_included, 50);
    assert.equal(artifact.summary.target_domain_excluded, true);

    const visibilityLeader = artifact.competitors[0];
    const coverageLeader = [...artifact.competitors].sort(
      (left, right) =>
        right.query_coverage_percentage - left.query_coverage_percentage,
    )[0];

    assert.equal(visibilityLeader.domain, "notg2.com");
    assert.notEqual(coverageLeader.domain, "youtube.com");
    assert.equal(visibilityLeader.visibility_rating, 997);
    assert.equal(visibilityLeader.query_positions[0].query_id, "problem_demand_001");
  });
});

test("returns a small surviving pool without fabricating competitors", async () => {
  const { generateCompetitorLandscape } =
    await importCompetitorLandscapeModule();
  const fetchCalls: Array<{ body: string }> = [];
  const survivors = Array.from(
    { length: 32 },
    (_, index) => `small-${index + 1}.example`,
  );
  const items: MockCompetitorItem[] = [
    { domain: "facebook.com" },
    ...survivors.map((domain) => ({ domain })),
  ];

  await withMockedFetch(fetchCalls, items, async () => {
    const artifact = await generateCompetitorLandscape(
      buildConfirmedQueries(),
      "run_test",
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(artifact.competitors.length, 32);
    assert.deepEqual(
      artifact.competitors.map((competitor) => competitor.domain),
      survivors,
    );
    assert.equal(artifact.summary.generic_candidates_filtered, 1);
    assert.equal(artifact.summary.final_competitors_profiled, 32);
    assert.ok(
      artifact.warnings.some((warning) =>
        warning.includes("32 valid visibility competitors survived filtering"),
      ),
    );
  });
});

async function importCompetitorLandscapeModule() {
  process.env.OPENAI_API_KEY = "test";
  process.env.FIRECRAWL_API_KEY = "test";
  process.env.SERPER_API_KEY = "test";
  process.env.DATAFORSEO_LOGIN = "test";
  process.env.DATAFORSEO_PASSWORD = "test";

  return import("./generateCompetitorLandscape.js");
}

async function withMockedFetch(
  fetchCalls: Array<{ body: string }>,
  items: MockCompetitorItem[],
  run: () => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_url, init) => {
    const body = String(init?.body ?? "");
    fetchCalls.push({ body });

    return {
      ok: true,
      json: async () => buildDataForSeoResponse(items),
    } as Response;
  }) as typeof fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function buildDataForSeoResponse(items: MockCompetitorItem[]) {
  return {
    status_code: 20000,
    status_message: "Ok.",
    cost: 0.01,
    tasks: [
      {
        id: "competitor-task",
        status_code: 20000,
        status_message: "Ok.",
        data: { tag: "competitor_landscape" },
        result: [
          {
            total_count: items.length,
            items_count: items.length,
            items: items.map((item, index) => ({
              domain: item.domain,
              avg_position: index + 1,
              median_position: index + 1,
              rating: item.rating ?? items.length - index,
              etv: 100 - index,
              keywords_count: 1,
              visibility: 1,
              relevant_serp_items: 1,
              keywords_positions: { "example query": [index + 1] },
            })),
          },
        ],
      },
    ],
  };
}

function buildConfirmedQueries(): ConfirmedQueries {
  return {
    schema_version: "1.0.0",
    run_id: "run_test",
    generated_at: "2026-08-10T00:00:00.000Z",
    source_artifacts: ["query-validations.json", "keyword_metrics.json"],
    status: "complete",
    warnings: [],
    website_url: "https://regenhealth.app/",
    source_profile: {
      company_name: "REGEN",
      product_category: "Health software",
      primary_icp: "Health professionals",
    },
    confirmed_queries: [
      {
        query_id: "problem_demand_001",
        territory: "problem_demand",
        query: "example query",
        validation_reasoning: "Relevant query.",
        source_seed_keywords: Array.from(
          { length: 15 },
          (_, index) => `seed ${index + 1}`,
        ),
        discovery_rank: 1,
        core_keyword: "example",
        detected_language: "en",
        metrics: {
          search_volume: 100,
          monthly_searches: [],
          search_volume_trend: null,
          cpc: 1,
          paid_competition: 0.5,
          paid_competition_level: "MEDIUM",
          keyword_difficulty: 30,
          search_intent: { main: "informational", secondary: [] },
          average_top_10: null,
        },
      },
    ],
    summary: {
      total_queries_evaluated: 1,
      total_queries_confirmed: 1,
      total_queries_rejected: 0,
      problem_queries_confirmed: 1,
      solution_queries_confirmed: 0,
    },
  };
}
