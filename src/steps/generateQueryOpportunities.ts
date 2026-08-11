import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import {
  OPPORTUNITY_SCORING_METHOD,
  calculateOpportunityScore,
  calculateTerritoryP95SearchVolume,
} from "../lib/opportunityScoring.js";
import {
  ConfirmedQueriesSchema,
  type ConfirmedQueries,
} from "../types/confirmedQueries.schema.js";
import {
  QueryOpportunitiesSchema,
  type QueryOpportunities,
} from "../types/queryOpportunities.schema.js";

const SELECTED_QUERY_COUNT = 10;

type Territory = "problem_demand" | "solution_demand";
type ConfirmedQuery = ConfirmedQueries["confirmed_queries"][number];

type ScoredQuery = {
  query: ConfirmedQuery;
  searchVolumeUsed: number;
  territoryP95SearchVolume: number;
  demandScore: number;
  keywordDifficultyOriginal: number | null;
  keywordDifficultyUsed: number;
  keywordDifficultyWasImputed: boolean;
  attainabilityScore: number;
  opportunityScore: number;
};

export async function generateQueryOpportunities(
  confirmedQueries: ConfirmedQueries,
  runId: string,
): Promise<QueryOpportunities> {
  logStep("Starting query opportunity scoring");

  const validatedConfirmedQueries =
    ConfirmedQueriesSchema.parse(confirmedQueries);
  const problemQueries = validatedConfirmedQueries.confirmed_queries.filter(
    (query) => query.territory === "problem_demand",
  );
  const solutionQueries = validatedConfirmedQueries.confirmed_queries.filter(
    (query) => query.territory === "solution_demand",
  );
  const problemTerritoryP95SearchVolume =
    calculateTerritoryP95SearchVolume(problemQueries);
  const solutionTerritoryP95SearchVolume =
    calculateTerritoryP95SearchVolume(solutionQueries);
  const scoredQueries = validatedConfirmedQueries.confirmed_queries.map(
    (query) =>
      scoreQuery(
        query,
        query.territory === "problem_demand"
          ? problemTerritoryP95SearchVolume
          : solutionTerritoryP95SearchVolume,
      ),
  );
  const problemRanking = buildTerritoryRanking(
    scoredQueries,
    "problem_demand",
    problemTerritoryP95SearchVolume,
  );
  const solutionRanking = buildTerritoryRanking(
    scoredQueries,
    "solution_demand",
    solutionTerritoryP95SearchVolume,
  );
  const allScoredQueries = scoredQueries.map((scoredQuery) => ({
    query_id: scoredQuery.query.query_id,
    territory: scoredQuery.query.territory,
    opportunity_metrics: buildOpportunityMetrics(scoredQuery),
  }));
  const selectedQueries = [
    ...problemRanking.queries,
    ...solutionRanking.queries,
  ];
  const warnings = [
    ...validatedConfirmedQueries.warnings,
    ...buildSelectionWarnings([problemRanking, solutionRanking]),
  ];
  const missingKeywordDifficultySelected = selectedQueries.filter(
    (query) => query.opportunity_metrics.keyword_difficulty_was_imputed,
  ).length;
  const missingKeywordDifficultyScored = allScoredQueries.filter(
    (query) => query.opportunity_metrics.keyword_difficulty_was_imputed,
  ).length;
  const queryOpportunities = QueryOpportunitiesSchema.parse({
    schema_version: "2.1.0",
    run_id: runId,
    generated_at: new Date().toISOString(),
    source_artifacts: ["confirmed-queries.json"],
    status: "complete",
    warnings,
    website_url: validatedConfirmedQueries.website_url,
    scoring_method: OPPORTUNITY_SCORING_METHOD,
    all_scored_queries: allScoredQueries,
    territory_rankings: [problemRanking, solutionRanking],
    summary: {
      confirmed_queries_considered:
        validatedConfirmedQueries.confirmed_queries.length,
      problem_queries_considered: problemRanking.confirmed_query_count,
      solution_queries_considered: solutionRanking.confirmed_query_count,
      problem_queries_selected: problemRanking.selected_query_count,
      solution_queries_selected: solutionRanking.selected_query_count,
      total_queries_selected: selectedQueries.length,
      total_queries_scored: allScoredQueries.length,
      problem_queries_scored: problemQueries.length,
      solution_queries_scored: solutionQueries.length,
      missing_keyword_difficulty_scored: missingKeywordDifficultyScored,
      missing_keyword_difficulty_selected: missingKeywordDifficultySelected,
    },
  });

  logSuccess("Query opportunity scoring completed");
  logInfo(
    `Total queries selected: ${queryOpportunities.summary.total_queries_selected}`,
  );
  logInfo(
    `Total queries scored: ${queryOpportunities.summary.total_queries_scored}`,
  );
  logInfo(
    `Selected queries with imputed keyword difficulty: ${queryOpportunities.summary.missing_keyword_difficulty_selected}`,
  );

  return queryOpportunities;
}

function buildTerritoryRanking(
  scoredQueries: ScoredQuery[],
  territory: Territory,
  territoryP95SearchVolume: number,
) {
  const territoryScoredQueries = scoredQueries.filter(
    (scoredQuery) => scoredQuery.query.territory === territory,
  );
  const selectedCount = Math.min(
    SELECTED_QUERY_COUNT,
    territoryScoredQueries.length,
  );
  const selectedQueries = [...territoryScoredQueries]
    .sort(compareScoredQueries)
    .slice(0, selectedCount)
    .map((scoredQuery, index) => ({
      rank: index + 1,
      query_id: scoredQuery.query.query_id,
      territory: scoredQuery.query.territory,
      query: scoredQuery.query.query,
      validation_reasoning: scoredQuery.query.validation_reasoning,
      source_seed_keywords: scoredQuery.query.source_seed_keywords,
      discovery_rank: scoredQuery.query.discovery_rank,
      core_keyword: scoredQuery.query.core_keyword,
      detected_language: scoredQuery.query.detected_language,
      metrics: scoredQuery.query.metrics,
      opportunity_metrics: buildOpportunityMetrics(scoredQuery),
    }));

  logInfo(
    `${territory} confirmed queries considered: ${territoryScoredQueries.length}`,
  );
  logInfo(`${territory} P95 search volume benchmark: ${territoryP95SearchVolume}`);
  logInfo(
    `${territory} selected query IDs and scores: ${selectedQueries
      .map(
        (query) =>
          `${query.query_id} (${query.opportunity_metrics.opportunity_score})`,
      )
      .join(", ")}`,
  );

  return {
    territory,
    confirmed_query_count: territoryScoredQueries.length,
    territory_p95_search_volume: territoryP95SearchVolume,
    selected_query_count: selectedCount,
    queries: selectedQueries,
  };
}

function buildOpportunityMetrics(scoredQuery: ScoredQuery) {
  return {
    search_volume_used: scoredQuery.searchVolumeUsed,
    territory_p95_search_volume: scoredQuery.territoryP95SearchVolume,
    demand_score: roundTo(scoredQuery.demandScore, 4),
    keyword_difficulty_original: scoredQuery.keywordDifficultyOriginal,
    keyword_difficulty_used: scoredQuery.keywordDifficultyUsed,
    keyword_difficulty_was_imputed:
      scoredQuery.keywordDifficultyWasImputed,
    attainability_score: roundTo(scoredQuery.attainabilityScore, 4),
    opportunity_score: roundTo(scoredQuery.opportunityScore, 1),
  };
}

function buildSelectionWarnings(
  rankings: Array<{
    territory: Territory;
    confirmed_query_count: number;
    selected_query_count: number;
  }>,
): string[] {
  return rankings.flatMap((ranking) => {
    if (ranking.confirmed_query_count >= SELECTED_QUERY_COUNT) {
      return [];
    }

    if (ranking.confirmed_query_count === 0) {
      return [
        `${ranking.territory} had no confirmed queries; selected 0 instead of ${SELECTED_QUERY_COUNT}.`,
      ];
    }

    return [
      `${ranking.territory} had ${ranking.confirmed_query_count} confirmed queries; selected all ${ranking.selected_query_count} instead of ${SELECTED_QUERY_COUNT}.`,
    ];
  });
}

function scoreQuery(
  query: ConfirmedQuery,
  territoryP95SearchVolume: number,
): ScoredQuery {
  const score = calculateOpportunityScore(
    query,
    territoryP95SearchVolume,
  );

  return {
    query,
    searchVolumeUsed: score.searchVolumeUsed,
    territoryP95SearchVolume: score.territoryP95SearchVolume,
    demandScore: score.demandScore,
    keywordDifficultyOriginal: score.keywordDifficultyOriginal,
    keywordDifficultyUsed: score.keywordDifficultyUsed,
    keywordDifficultyWasImputed: score.keywordDifficultyWasImputed,
    attainabilityScore: score.attainabilityScore,
    opportunityScore: score.opportunityScore,
  };
}

function compareScoredQueries(left: ScoredQuery, right: ScoredQuery): number {
  return (
    compareDescending(left.opportunityScore, right.opportunityScore) ||
    compareDescending(left.searchVolumeUsed, right.searchVolumeUsed) ||
    compareNullableAscendingLast(
      left.keywordDifficultyOriginal,
      right.keywordDifficultyOriginal,
    ) ||
    compareNullableAscendingLast(
      left.query.metrics.average_top_10?.referring_domains ?? null,
      right.query.metrics.average_top_10?.referring_domains ?? null,
    ) ||
    compareNullableAscendingLast(
      left.query.metrics.average_top_10?.main_domain_rank ?? null,
      right.query.metrics.average_top_10?.main_domain_rank ?? null,
    ) ||
    left.query.discovery_rank - right.query.discovery_rank ||
    left.query.query_id.localeCompare(right.query.query_id)
  );
}

function compareDescending(left: number, right: number): number {
  return right - left;
}

function compareNullableAscendingLast(
  left: number | null,
  right: number | null,
): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

function roundTo(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;

  return Math.round(value * factor) / factor;
}
