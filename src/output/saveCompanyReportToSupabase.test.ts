import assert from "node:assert/strict";
import test from "node:test";

import { OPPORTUNITY_SCORING_METHOD } from "../lib/opportunityScoring.js";
import type { CompanyReport } from "../types/companyReport.schema.js";
import {
  buildSerpReportPayload,
  saveCompanyReportToSupabase,
  type CompanyReportSupabaseClient,
} from "./saveCompanyReportToSupabase.js";

type SupabaseError = {
  message: string;
};

type SavedRow = {
  id: string;
  report_id: string | null;
  slug: string | null;
};

type FakeClientOptions = {
  matchingRows?: SavedRow[];
  selectError?: SupabaseError | null;
  insertError?: SupabaseError | null;
  updateError?: SupabaseError | null;
};

test("payload maps report fields and adds only Supabase compatibility aliases", () => {
  const companyReport = buildCompanyReport();
  const payload = buildSerpReportPayload(
    companyReport,
    new Date("2026-07-26T12:00:00.000Z"),
  );

  assert.deepEqual(
    {
      report_id: payload.report_id,
      slug: payload.slug,
      website_url: payload.website_url,
      company_name: payload.company_name,
      status: payload.status,
      updated_at: payload.updated_at,
    },
    {
      report_id: "report_example",
      slug: "example-report",
      website_url: "https://example.com/",
      company_name: "Example Co",
      status: "complete",
      updated_at: "2026-07-26T12:00:00.000Z",
    },
  );
  assertSupabaseCompatibilityArtifact(payload.artifact, companyReport);
  assert.equal(Object.hasOwn(payload, "id"), false);
  assert.equal(Object.hasOwn(payload, "created_at"), false);
});

test("no matching slug inserts a new row", async () => {
  const companyReport = buildCompanyReport();
  const client = new FakeSupabaseClient({ matchingRows: [] });

  const saved = await saveCompanyReportToSupabase(companyReport, {
    client,
    now: () => new Date("2026-07-26T12:00:00.000Z"),
  });

  assert.deepEqual(saved, {
    id: "inserted_row",
    report_id: "report_example",
    slug: "example-report",
  });
  assert.equal(client.insertPayloads.length, 1);
  assert.equal(client.updatePayloads.length, 0);
  assertSupabaseCompatibilityArtifact(
    client.insertPayloads[0].artifact,
    companyReport,
  );
  assert.equal(Object.hasOwn(client.insertPayloads[0], "id"), false);
  assert.equal(Object.hasOwn(client.insertPayloads[0], "created_at"), false);
});

test("one matching slug updates that exact row by UUID", async () => {
  const companyReport = buildCompanyReport();
  const client = new FakeSupabaseClient({
    matchingRows: [
      {
        id: "existing_row",
        report_id: "old_report",
        slug: "example-report",
      },
    ],
  });

  const saved = await saveCompanyReportToSupabase(companyReport, {
    client,
    now: () => new Date("2026-07-26T12:00:00.000Z"),
  });

  assert.deepEqual(saved, {
    id: "existing_row",
    report_id: "report_example",
    slug: "example-report",
  });
  assert.equal(client.insertPayloads.length, 0);
  assert.equal(client.updatePayloads.length, 1);
  assert.deepEqual(client.updateFilters, [{ column: "id", value: "existing_row" }]);
  assertSupabaseCompatibilityArtifact(
    client.updatePayloads[0].artifact,
    companyReport,
  );
  assert.equal(Object.hasOwn(client.updatePayloads[0], "id"), false);
  assert.equal(Object.hasOwn(client.updatePayloads[0], "created_at"), false);
});

test("multiple matching rows produce duplicate slug error", async () => {
  const client = new FakeSupabaseClient({
    matchingRows: [
      { id: "row_one", report_id: "one", slug: "example-report" },
      { id: "row_two", report_id: "two", slug: "example-report" },
    ],
  });

  await assert.rejects(
    () =>
      saveCompanyReportToSupabase(buildCompanyReport(), {
        client,
        now: () => new Date("2026-07-26T12:00:00.000Z"),
      }),
    /multiple serp_reports rows for slug "example-report"/,
  );
  assert.equal(client.insertPayloads.length, 0);
  assert.equal(client.updatePayloads.length, 0);
});

test("select insert and update errors are propagated", async () => {
  await assert.rejects(
    () =>
      saveCompanyReportToSupabase(buildCompanyReport(), {
        client: new FakeSupabaseClient({
          selectError: { message: "select failed" },
        }),
      }),
    /Supabase select serp_reports failed: select failed/,
  );

  await assert.rejects(
    () =>
      saveCompanyReportToSupabase(buildCompanyReport(), {
        client: new FakeSupabaseClient({
          matchingRows: [],
          insertError: { message: "insert failed" },
        }),
      }),
    /Supabase insert serp_reports failed: insert failed/,
  );

  await assert.rejects(
    () =>
      saveCompanyReportToSupabase(buildCompanyReport(), {
        client: new FakeSupabaseClient({
          matchingRows: [
            { id: "existing_row", report_id: "old", slug: "example-report" },
          ],
          updateError: { message: "update failed" },
        }),
      }),
    /Supabase update serp_reports failed: update failed/,
  );
});

class FakeSupabaseClient implements CompanyReportSupabaseClient {
  readonly insertPayloads: Array<Record<string, unknown>> = [];
  readonly updatePayloads: Array<Record<string, unknown>> = [];
  readonly updateFilters: Array<{ column: string; value: string }> = [];

  constructor(private readonly options: FakeClientOptions = {}) {}

  from(table: "serp_reports") {
    assert.equal(table, "serp_reports");

    return {
      select: (columns: string) => {
        assert.equal(columns, "id, report_id, slug");

        return {
          eq: (column: string, value: string) => {
            assert.equal(column, "slug");
            assert.equal(value, "example-report");

            return {
              limit: async (count: number) => {
                assert.equal(count, 2);

                return {
                  data: this.options.matchingRows ?? [],
                  error: this.options.selectError ?? null,
                };
              },
            };
          },
        };
      },
      insert: (payload: Record<string, unknown>) => {
        this.insertPayloads.push(payload);

        return {
          select: (columns: string) => {
            assert.equal(columns, "id, report_id, slug");

            return {
              single: async () => ({
                data: {
                  id: "inserted_row",
                  report_id: "report_example",
                  slug: "example-report",
                },
                error: this.options.insertError ?? null,
              }),
            };
          },
        };
      },
      update: (payload: Record<string, unknown>) => {
        this.updatePayloads.push(payload);

        return {
          eq: (column: string, value: string) => {
            this.updateFilters.push({ column, value });

            return {
              select: (columns: string) => {
                assert.equal(columns, "id, report_id, slug");

                return {
                  single: async () => ({
                    data: {
                      id: value,
                      report_id: "report_example",
                      slug: "example-report",
                    },
                    error: this.options.updateError ?? null,
                  }),
                };
              },
            };
          },
        };
      },
    };
  }
}

function buildCompanyReport(): CompanyReport {
  return {
    schema_version: "2.2.0",
    report_id: "report_example",
    report_slug: "example-report",
    website_url: "https://example.com/",
    status: "complete",
    scoring_method: OPPORTUNITY_SCORING_METHOD,
    company: {
      name: "Example Co",
    },
    content_plan: {
      items: [
        {
          opportunity_metrics: {
            search_volume_used: 301_000,
            territory_p95_search_volume: 12_100,
            demand_score: 1,
            keyword_difficulty_original: 60,
            keyword_difficulty_used: 60,
            keyword_difficulty_was_imputed: false,
            attainability_score: 0.4,
            opportunity_score: 82,
          },
        },
      ],
    },
    nested: {
      preserved: true,
    },
  } as unknown as CompanyReport;
}

function assertSupabaseCompatibilityArtifact(
  artifact: unknown,
  companyReport: CompanyReport,
): void {
  const persistedArtifact = artifact as {
    scoring_method: unknown;
    content_plan: {
      items: Array<{
        opportunity_metrics: Record<string, unknown>;
      }>;
    };
  };
  const canonicalMetrics =
    companyReport.content_plan.items[0].opportunity_metrics;
  const persistedMetrics =
    persistedArtifact.content_plan.items[0].opportunity_metrics;

  assert.notEqual(artifact, companyReport);
  assert.deepEqual(persistedArtifact, {
    ...companyReport,
    content_plan: {
      ...companyReport.content_plan,
      items: companyReport.content_plan.items.map((item) => ({
        ...item,
        opportunity_metrics: {
          ...item.opportunity_metrics,
          maximum_territory_search_volume:
            item.opportunity_metrics.territory_p95_search_volume,
          volume_score: item.opportunity_metrics.demand_score,
          difficulty_score: item.opportunity_metrics.attainability_score,
        },
      })),
    },
  });
  assert.deepEqual(persistedArtifact.scoring_method, OPPORTUNITY_SCORING_METHOD);
  assert.deepEqual(persistedMetrics, {
    ...canonicalMetrics,
    maximum_territory_search_volume:
      canonicalMetrics.territory_p95_search_volume,
    volume_score: canonicalMetrics.demand_score,
    difficulty_score: canonicalMetrics.attainability_score,
  });
  assert.equal(
    Object.hasOwn(canonicalMetrics, "maximum_territory_search_volume"),
    false,
  );
  assert.equal(Object.hasOwn(canonicalMetrics, "volume_score"), false);
  assert.equal(Object.hasOwn(canonicalMetrics, "difficulty_score"), false);
}
