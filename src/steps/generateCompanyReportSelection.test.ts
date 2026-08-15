import assert from "node:assert/strict";
import test from "node:test";

import type { CompanyReport } from "../types/companyReport.schema.js";
import { selectVisualizationQueries } from "./generateCompanyReport.js";

type ValidatedQuery = CompanyReport["validated_queries"]["queries"][number];

test("report visualization retains at most 100 queries with the preferred 60/30/10 mix", () => {
  const queries = [
    ...buildQueries(80, "problem_demand", "adjacent_problem_demand", 0),
    ...buildQueries(40, "solution_demand", "adjacent_solution_demand", 80),
    ...buildQueries(20, "solution_demand", "core_solution_demand", 120),
  ];
  const selected = selectVisualizationQueries(queries);

  assert.equal(selected.length, 100);
  assert.equal(
    selected.filter((query) => query.territory === "problem_demand").length,
    60,
  );
  assert.equal(
    selected.filter(
      (query) => query.discovery_group === "adjacent_solution_demand",
    ).length,
    30,
  );
  assert.equal(
    selected.filter(
      (query) => query.discovery_group === "core_solution_demand",
    ).length,
    10,
  );
});

test("report visualization preserves every truthful result below the cap", () => {
  const queries = buildQueries(
    40,
    "problem_demand",
    "core_problem_demand",
    0,
  );

  assert.deepEqual(selectVisualizationQueries(queries), queries);
});

function buildQueries(
  count: number,
  territory: "problem_demand" | "solution_demand",
  discoveryGroup:
    | "core_problem_demand"
    | "adjacent_problem_demand"
    | "core_solution_demand"
    | "adjacent_solution_demand",
  offset: number,
): ValidatedQuery[] {
  return Array.from({ length: count }, (_, index) => {
    const rank = offset + index + 1;

    return {
      query_id: `${territory}_${String(rank).padStart(3, "0")}`,
      territory,
      discovery_group: discoveryGroup,
      discovery_rank: rank,
      metrics: { search_volume: 1_000 - rank },
      opportunity_metrics: { opportunity_score: 1_000 - rank },
    } as ValidatedQuery;
  });
}
