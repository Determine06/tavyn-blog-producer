import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ContentRecommendationDecisionSchema, ContentRecommendationSchema } from "./contentRecommendation.schema.js";
import { QueryRecommendationDecisionSchema, QueryRecommendationsSchema } from "./queryRecommendations.schema.js";
import { SerpResultsSchema } from "./serpResults.schema.js";

test("query recommendation artifact accepts exactly one problem and two solutions", () => {
  const artifact = buildQueryRecommendations();

  assert.deepEqual(QueryRecommendationsSchema.parse(artifact), artifact);
});

test("query recommendation artifact rejects incorrect territory counts", () => {
  assert.equal(
    QueryRecommendationsSchema.safeParse(
      buildQueryRecommendations({
        problemCount: 0,
        solutionCount: 3,
      }),
    ).success,
    false,
  );

  assert.equal(
    QueryRecommendationsSchema.safeParse(
      buildQueryRecommendations({
        problemCount: 2,
        solutionCount: 1,
      }),
    ).success,
    false,
  );
});

test("query recommendation decision rejects totals other than one problem and two solutions", () => {
  assert.deepEqual(
    QueryRecommendationDecisionSchema.parse(buildDecision(1, 2)),
    buildDecision(1, 2),
  );

  assert.throws(
    () => QueryRecommendationDecisionSchema.parse(buildDecision(0, 2)),
    /problem_demand|Exactly three/,
  );
  assert.throws(
    () => QueryRecommendationDecisionSchema.parse(buildDecision(1, 1)),
    /solution_demand|Exactly three/,
  );
  assert.throws(
    () => QueryRecommendationDecisionSchema.parse(buildDecision(1, 3)),
    /Too big|solution_demand|Exactly three/,
  );
});

test("query recommendation prompt requires product-specific solution and fallback", () => {
  const prompt = readFileSync(
    new URL("../prompts/generate-query-recommendations.md", import.meta.url),
    "utf8",
  );

  assert.match(prompt, /exactly one `problem_demand`/);
  assert.match(prompt, /exactly two distinct `solution_demand`/);
  assert.match(prompt, /Product-Specific Solution Requirement/);
  assert.match(prompt, /strongest credible product-specific candidate/);
  assert.match(prompt, /fallback/);
  assert.match(prompt, /strongest remaining distinct `solution_demand` query/);
});

test("serp results require exactly three query records", () => {
  assert.deepEqual(
    SerpResultsSchema.parse(buildSerpResults(3)),
    buildSerpResults(3),
  );
  assert.throws(() => SerpResultsSchema.parse(buildSerpResults(2)), /Too small|exactly/);
  assert.throws(() => SerpResultsSchema.parse(buildSerpResults(4)), /Too big|exactly/);
});

test("content recommendation decisions and artifacts require exactly three records", () => {
  assert.deepEqual(
    ContentRecommendationDecisionSchema.parse(buildContentDecision(3)),
    buildContentDecision(3),
  );
  assert.throws(
    () => ContentRecommendationDecisionSchema.parse(buildContentDecision(2)),
    /Too small|exactly/,
  );

  assert.deepEqual(
    ContentRecommendationSchema.parse(buildContentRecommendation(3)),
    buildContentRecommendation(3),
  );
  assert.throws(
    () => ContentRecommendationSchema.parse(buildContentRecommendation(4)),
    /Too big|exactly/,
  );
});

function buildDecision(problemCount: number, solutionCount: number) {
  return {
    territory_decisions: [
      {
        territory: "problem_demand",
        assessment: "The selected problem query is the strongest distinct fit.",
        selected_queries: Array.from({ length: problemCount }, (_, index) =>
          buildDecisionQuery("problem_demand", index + 1),
        ),
      },
      {
        territory: "solution_demand",
        assessment:
          "The selected solution queries include the strongest solution fit and the product-specific slot.",
        selected_queries: Array.from({ length: solutionCount }, (_, index) =>
          buildDecisionQuery("solution_demand", index + 1),
        ),
      },
    ],
  };
}

function buildDecisionQuery(
  territory: "problem_demand" | "solution_demand",
  rank: number,
) {
  return {
    query_id: `${territory}_${String(rank).padStart(3, "0")}`,
    territory,
    query: `${territory} query ${rank}`,
    selection_reasoning: "This query has strong fit, demand, and attainability.",
    content_angle: "The page should satisfy the exact query with practical guidance.",
    product_connection: "The product can appear naturally through its core workflow.",
    confidence: "high",
  };
}

function buildQueryRecommendations(
  options: { problemCount?: number; solutionCount?: number } = {},
) {
  const problemCount = options.problemCount ?? 1;
  const solutionCount = options.solutionCount ?? 2;
  const problemRecommendations = Array.from(
    { length: problemCount },
    (_, index) => buildRecommendation("problem_demand", index + 1),
  );
  const solutionRecommendations = Array.from(
    { length: solutionCount },
    (_, index) => buildRecommendation("solution_demand", index + 1),
  );

  return {
    schema_version: "2.0.0",
    run_id: "run_test",
    generated_at: "2026-07-26T00:00:00.000Z",
    source_artifacts: ["company-profile.json", "query-opportunities.json"],
    status: "complete",
    warnings: [],
    website_url: "https://example.com/",
    source_profile: {
      company_name: "Example",
      product_category: "Example software",
      primary_icp: "Example buyers",
    },
    selection_policy: {
      problem_demand_target: 1,
      solution_demand_target: 2,
      total_target: 3,
      require_exact_total: true,
      prefer_product_specific_solution: true,
      product_specific_fallback: "best_distinct_solution_demand",
    },
    territory_recommendations: [
      {
        territory: "problem_demand",
        candidates_available: 10,
        target_recommendations: 1,
        recommendations_selected: problemRecommendations.length,
        assessment: "The problem recommendation is the strongest distinct fit.",
        recommendations: problemRecommendations,
      },
      {
        territory: "solution_demand",
        candidates_available: 10,
        target_recommendations: 2,
        recommendations_selected: solutionRecommendations.length,
        assessment:
          "The solution recommendations include the strongest fit and the product-specific slot.",
        recommendations: solutionRecommendations,
      },
    ],
    summary: {
      total_candidates_considered: 20,
      problem_candidates_considered: 10,
      solution_candidates_considered: 10,
      target_recommendations: 3,
      problem_recommendations_selected: problemRecommendations.length,
      solution_recommendations_selected: solutionRecommendations.length,
      total_recommendations_selected:
        problemRecommendations.length + solutionRecommendations.length,
      target_fulfilled: true,
    },
  };
}

function buildRecommendation(
  territory: "problem_demand" | "solution_demand",
  rank: number,
) {
  return {
    recommendation_id: `${territory}_recommendation_${String(rank).padStart(2, "0")}`,
    recommendation_rank: rank,
    query_id: `${territory}_${String(rank).padStart(3, "0")}`,
    territory,
    query: `${territory} query ${rank}`,
    selection_reasoning: "This query has strong fit, demand, and attainability.",
    content_angle: "The page should satisfy the exact query with practical guidance.",
    product_connection: "The product can appear naturally through its core workflow.",
    confidence: "high",
    opportunity_rank: rank,
    validation_reasoning: "The query is relevant.",
    source_seed_keywords: Array.from(
      { length: 6 },
      (_, index) => `seed ${index + 1}`,
    ),
    discovery_rank: rank,
    core_keyword: null,
    detected_language: "en",
    metrics: buildMetrics(),
    opportunity_metrics: {
      search_volume_used: 100,
      territory_p95_search_volume: 10_200,
      demand_score: 0.5,
      keyword_difficulty_original: 20,
      keyword_difficulty_used: 20,
      keyword_difficulty_was_imputed: false,
      attainability_score: 0.8,
      opportunity_score: 59,
    },
  };
}

function buildMetrics() {
  return {
    search_volume: 100,
    monthly_searches: [],
    search_volume_trend: null,
    cpc: 1,
    paid_competition: 0.5,
    paid_competition_level: "MEDIUM",
    keyword_difficulty: 20,
    search_intent: {
      main: "commercial",
      secondary: [],
    },
    average_top_10: null,
  };
}

function buildSerpResults(count: number) {
  return {
    schema_version: "1.1.0",
    run_id: "run_test",
    generated_at: "2026-07-26T00:00:00.000Z",
    source_artifacts: ["query-recommendations.json"],
    status: "complete",
    warnings: [],
    website_url: "https://example.com/",
    provider: {
      name: "serper",
      endpoint: "https://google.serper.dev/search",
      search_engine: "google",
      country_code: "us",
      language_code: "en",
      requested_results_per_query: 10,
      http_requests_made: count,
      total_credits_used: count,
    },
    query_serps: Array.from({ length: count }, (_, index) =>
      buildQuerySerp(index),
    ),
    summary: {
      recommended_queries_received: count,
      serp_requests_completed: count,
      total_organic_results: count,
      queries_with_fewer_than_ten_results: Array.from(
        { length: count },
        (_, index) => `query_${index + 1}`,
      ),
    },
  };
}

function buildQuerySerp(index: number) {
  const territory = index === 0 ? "problem_demand" : "solution_demand";
  return {
    recommendation_id: `${territory}_recommendation_${String(index === 0 ? 1 : index).padStart(2, "0")}`,
    query_id: `query_${index + 1}`,
    territory,
    query: `query ${index + 1}`,
    requested_at: "2026-07-26T00:00:00.000Z",
    provider_credits_used: 1,
    organic_results_received: 1,
    organic_results: [
      {
        position: 1,
        title: "Result",
        url: "https://example.com/result",
        domain: "example.com",
        snippet: null,
        date: null,
      },
    ],
  };
}

function buildContentDecision(count: number) {
  return {
    analyses: Array.from({ length: count }, (_, index) =>
      buildContentAnalysis(index),
    ),
  };
}

function buildContentRecommendation(count: number) {
  const items = Array.from({ length: count }, (_, index) =>
    buildContentItem(index),
  );

  return {
    schema_version: "1.1.0",
    run_id: "run_test",
    generated_at: "2026-07-26T00:00:00.000Z",
    source_artifacts: [
      "company-profile.json",
      "query-recommendations.json",
      "serp-results.json",
    ],
    status: "complete",
    warnings: [],
    website_url: "https://example.com/",
    source_profile: {
      company_name: "Example",
      product_category: "Example software",
      primary_icp: "Example buyers",
    },
    content_recommendations: items,
    summary: {
      recommendations_received: count,
      recommendations_analyzed: count,
      problem_demand_count: items.filter((item) => item.territory === "problem_demand").length,
      solution_demand_count: items.filter((item) => item.territory === "solution_demand").length,
      high_confidence_count: count,
      medium_confidence_count: 0,
      low_confidence_count: 0,
      mixed_intent_count: 0,
      insufficient_serp_count: 0,
    },
  };
}

function buildContentAnalysis(index: number) {
  const territory = index === 0 ? "problem_demand" : "solution_demand";
  return {
    recommendation_id: `${territory}_recommendation_${String(index === 0 ? 1 : index).padStart(2, "0")}`,
    query_id: `query_${index + 1}`,
    territory,
    query: `query ${index + 1}`,
    serp_analysis: buildSerpAnalysis(),
    editorial_recommendation: buildEditorialRecommendation(),
  };
}

function buildContentItem(index: number) {
  const analysis = buildContentAnalysis(index);

  return {
    recommendation_id: analysis.recommendation_id,
    recommendation_rank: index === 0 ? 1 : index,
    query_id: analysis.query_id,
    territory: analysis.territory,
    primary_query: `query ${index + 1}`,
    serp_analysis: analysis.serp_analysis,
    editorial_recommendation: analysis.editorial_recommendation,
  };
}

function buildSerpAnalysis() {
  return {
    dominant_intent: "commercial",
    dominant_page_type: "guide",
    serp_consistency: "high",
    summary: "The SERP consistently addresses this query.",
    recurring_concepts: [],
  };
}

function buildEditorialRecommendation() {
  return {
    recommended_title: "Example Guide",
    recommended_page_type: "guide",
    content_angle: "The article should address the query directly.",
    product_connection: "The product can appear through its core workflow.",
    confidence: "high",
    warnings: [],
  };
}
