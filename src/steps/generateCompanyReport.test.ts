import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CompanyReportSchema } from "../types/companyReport.schema.js";
import type { QueryOpportunities } from "../types/queryOpportunities.schema.js";
import { generateCompanyReport } from "./generateCompanyReport.js";
import { generateQueryOpportunities } from "./generateQueryOpportunities.js";

type ReportArguments = Parameters<typeof generateCompanyReport>;

test("REGEN report retains 100 visualization queries with authoritative metrics", async () => {
  const { confirmedQueries, queryOpportunities, report } =
    await buildRegenReport();
  const confirmedIds = confirmedQueries.confirmed_queries.map(
    (query) => query.query_id,
  );
  const scoredIds = queryOpportunities.all_scored_queries.map(
    (query) => query.query_id,
  );
  const reportIds = report.validated_queries.queries.map(
    (query) => query.query_id,
  );
  const scoredById = new Map(
    queryOpportunities.all_scored_queries.map((query) => [
      query.query_id,
      query,
    ]),
  );
  const validatedById = new Map(
    report.validated_queries.queries.map((query) => [query.query_id, query]),
  );

  assert.equal(confirmedIds.length, 101);
  assert.equal(scoredIds.length, 101);
  assert.equal(new Set(scoredIds).size, 101);
  assert.equal(reportIds.length, 100);
  assert.equal(new Set(reportIds).size, 100);
  assert.ok(reportIds.every((queryId) => confirmedIds.includes(queryId)));
  assert.equal(
    report.validated_queries.summary.problem_demand +
      report.validated_queries.summary.solution_demand,
    100,
  );
  assert.equal(queryOpportunities.summary.problem_queries_scored, 71);
  assert.equal(queryOpportunities.summary.solution_queries_scored, 30);
  assert.equal(queryOpportunities.territory_rankings[0].queries.length, 10);
  assert.equal(queryOpportunities.territory_rankings[1].queries.length, 10);
  assert.equal(report.analysis_coverage.queries_validated, 101);
  assert.equal(report.analysis_coverage.queries_retained_for_visualization, 100);
  assert.equal(report.analysis_coverage.content_opportunities_scored, 101);

  for (const validatedQuery of report.validated_queries.queries) {
    assert.deepEqual(
      validatedQuery.opportunity_metrics,
      scoredById.get(validatedQuery.query_id)?.opportunity_metrics,
    );
  }

  const problemP95Values = new Set(
    report.validated_queries.queries
      .filter((query) => query.territory === "problem_demand")
      .map(
        (query) =>
          query.opportunity_metrics.territory_p95_search_volume,
      ),
  );
  const solutionP95Values = new Set(
    report.validated_queries.queries
      .filter((query) => query.territory === "solution_demand")
      .map(
        (query) =>
          query.opportunity_metrics.territory_p95_search_volume,
      ),
  );

  assert.deepEqual([...problemP95Values], [12_100]);
  assert.deepEqual([...solutionP95Values], [33_100]);

  const aboveP95 = validatedById.get("problem_demand_034");

  assert.ok(aboveP95);
  assert.equal(aboveP95.opportunity_metrics.search_volume_used, 301_000);
  assert.equal(
    aboveP95.opportunity_metrics.territory_p95_search_volume,
    12_100,
  );
  assert.ok(
    aboveP95.opportunity_metrics.search_volume_used >
      aboveP95.opportunity_metrics.territory_p95_search_volume,
  );
  assert.equal(aboveP95.opportunity_metrics.demand_score, 1);

  for (const contentItem of report.content_plan.items) {
    assert.deepEqual(
      contentItem.opportunity_metrics,
      validatedById.get(contentItem.query_id)?.opportunity_metrics,
    );
  }

  const expectedAverage = roundToTwoDecimals(
    report.validated_queries.queries.reduce(
      (total, query) =>
        total + query.opportunity_metrics.opportunity_score,
      0,
    ) / report.validated_queries.queries.length,
  );

  assert.equal(
    report.content_plan.summary.average_opportunity_score,
    expectedAverage,
  );
  assert.equal(CompanyReportSchema.safeParse(report).success, true);
});

test("report assembly uses persisted scores and fails clearly for missing mappings", async () => {
  const inputs = loadRegenInputs();
  const queryOpportunities = await generateQueryOpportunities(
    inputs.confirmedQueries,
    "run_regen_persisted_score_test",
  );
  const retainedQueryId =
    queryOpportunities.territory_rankings[0].queries[0].query_id;
  const retainedQuery = queryOpportunities.all_scored_queries.find(
    (query) => query.query_id === retainedQueryId,
  );

  assert.ok(retainedQuery);
  retainedQuery.opportunity_metrics.opportunity_score += 0.1;
  const report = generateReport(inputs, queryOpportunities);
  const propagatedQuery = report.validated_queries.queries.find(
    (query) => query.query_id === retainedQueryId,
  );

  assert.ok(propagatedQuery);
  assert.equal(
    propagatedQuery.opportunity_metrics.opportunity_score,
    retainedQuery.opportunity_metrics.opportunity_score,
  );
  assert.equal(
    report.content_plan.summary.average_opportunity_score,
    roundToTwoDecimals(
      report.validated_queries.queries.reduce(
        (total, query) =>
          total + query.opportunity_metrics.opportunity_score,
        0,
      ) / report.validated_queries.queries.length,
    ),
  );

  const missingMapping = structuredClone(queryOpportunities);
  const missingIndex = missingMapping.all_scored_queries.findIndex(
    (query) => query.query_id === retainedQueryId,
  );

  assert.notEqual(missingIndex, -1);
  missingMapping.all_scored_queries[missingIndex].query_id =
    "problem_demand_unmapped";
  assert.throws(
    () => generateReport(inputs, missingMapping),
    new RegExp(
      `missing authoritative opportunity metrics for validated query ${retainedQueryId}`,
    ),
  );
});

test("duplicate mappings and incomplete validated-query metrics are rejected", async () => {
  const { inputs, queryOpportunities, report } = await buildRegenReport();
  const duplicateMapping = structuredClone(queryOpportunities);

  duplicateMapping.all_scored_queries[1] = structuredClone(
    duplicateMapping.all_scored_queries[0],
  );
  assert.throws(
    () => generateReport(inputs, duplicateMapping),
    /all_scored_queries query_id must be unique|duplicate/,
  );

  const incompleteReport = structuredClone(report) as unknown as {
    validated_queries: {
      queries: Array<Record<string, unknown>>;
    };
  };
  delete incompleteReport.validated_queries.queries[0].opportunity_metrics;
  assert.equal(CompanyReportSchema.safeParse(incompleteReport).success, false);

  const inconsistentSelectedMetrics = structuredClone(report);
  inconsistentSelectedMetrics.content_plan.items[0].opportunity_metrics.opportunity_score -=
    0.1;
  assert.equal(
    CompanyReportSchema.safeParse(inconsistentSelectedMetrics).success,
    false,
  );
});

async function buildRegenReport() {
  const inputs = loadRegenInputs();
  const queryOpportunities = await generateQueryOpportunities(
    inputs.confirmedQueries,
    "run_regen_report_test",
  );
  const report = generateReport(inputs, queryOpportunities);

  return {
    inputs,
    confirmedQueries: inputs.confirmedQueries,
    queryOpportunities,
    report,
  };
}

function generateReport(
  inputs: ReturnType<typeof loadRegenInputs>,
  queryOpportunities: QueryOpportunities,
) {
  return generateCompanyReport(
    inputs.companyProfile,
    inputs.keywordMetrics,
    inputs.confirmedQueries,
    queryOpportunities,
    inputs.queryRecommendations,
    inputs.serpResults,
    inputs.contentRecommendation,
    inputs.competitorLandscape,
    "run_regen_report_test",
  );
}

function loadRegenInputs() {
  return {
    companyProfile: loadArtifact<ReportArguments[0]>("company-profile.json"),
    keywordMetrics: loadArtifact<ReportArguments[1]>("keyword_metrics.json"),
    confirmedQueries: loadArtifact<ReportArguments[2]>(
      "confirmed-queries.json",
    ),
    queryRecommendations: loadArtifact<ReportArguments[4]>(
      "query-recommendations.json",
    ),
    serpResults: loadArtifact<ReportArguments[5]>("serp-results.json"),
    contentRecommendation: loadArtifact<ReportArguments[6]>(
      "content-recommendation.json",
    ),
    competitorLandscape: loadArtifact<ReportArguments[7]>(
      "competitor-landscape.json",
    ),
  };
}

function loadArtifact<T>(fileName: string): T {
  return JSON.parse(
    readFileSync(
      new URL(`../../artifacts/regenhealth-app/${fileName}`, import.meta.url),
      "utf8",
    ),
  ) as T;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
