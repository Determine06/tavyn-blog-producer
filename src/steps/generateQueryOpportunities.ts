import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import {
  ConfirmedQueriesSchema,
  type ConfirmedQueries,
} from "../types/confirmedQueries.schema.js";
import {
  QueryOpportunitiesSchema,
  type QueryOpportunities,
} from "../types/queryOpportunities.schema.js";

const MISSING_KEYWORD_DIFFICULTY_DEFAULT = 50;
const SELECTED_QUERY_COUNT = 10;

type Territory = "problem_demand" | "solution_demand";
type ConfirmedQuery = ConfirmedQueries["confirmed_queries"][number];

type ScoredQuery = {
  query: ConfirmedQuery;
  searchVolumeUsed: number;
  maximumTerritorySearchVolume: number;
  volumeScore: number;
  keywordDifficultyOriginal: number | null;
  keywordDifficultyUsed: number;
  keywordDifficultyWasImputed: boolean;
  difficultyScore: number;
  opportunityScore: number;
};

export async function generateQueryOpportunities(
  confirmedQueries: ConfirmedQueries,
  runId: string,
): Promise<QueryOpportunities> {
  logStep("Starting query opportunity scoring");

  const validatedConfirmedQueries =
    ConfirmedQueriesSchema.parse(confirmedQueries);
  const problemRanking = buildTerritoryRanking(
    validatedConfirmedQueries.confirmed_queries,
    "problem_demand",
  );
  const solutionRanking = buildTerritoryRanking(
    validatedConfirmedQueries.confirmed_queries,
    "solution_demand",
  );
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
  const queryOpportunities = QueryOpportunitiesSchema.parse({
    schema_version: "1.2.0",
    run_id: runId,
    generated_at: new Date().toISOString(),
    source_artifacts: ["confirmed-queries.json"],
    status: "complete",
    warnings,
    website_url: validatedConfirmedQueries.website_url,
    scoring_method: {
      name: "search_demand_times_organic_attainability",
      version: "1.1.0",
      missing_keyword_difficulty_default: MISSING_KEYWORD_DIFFICULTY_DEFAULT,
      volume_normalization: "log1p_relative_to_territory_max",
      combination_method: "multiplicative",
      formula: "100 * volume_score * difficulty_score",
    },
    territory_rankings: [problemRanking, solutionRanking],
    summary: {
      confirmed_queries_considered:
        validatedConfirmedQueries.confirmed_queries.length,
      problem_queries_considered: problemRanking.confirmed_query_count,
      solution_queries_considered: solutionRanking.confirmed_query_count,
      problem_queries_selected: problemRanking.selected_query_count,
      solution_queries_selected: solutionRanking.selected_query_count,
      total_queries_selected: selectedQueries.length,
      missing_keyword_difficulty_selected: missingKeywordDifficultySelected,
    },
  });

  logSuccess("Query opportunity scoring completed");
  logInfo(
    `Total queries selected: ${queryOpportunities.summary.total_queries_selected}`,
  );
  logInfo(
    `Selected queries with imputed keyword difficulty: ${queryOpportunities.summary.missing_keyword_difficulty_selected}`,
  );

  return queryOpportunities;
}

function buildTerritoryRanking(
  confirmedQueries: ConfirmedQuery[],
  territory: Territory,
) {
  const territoryQueries = confirmedQueries.filter(
    (query) => query.territory === territory,
  );
  const selectedCount = Math.min(SELECTED_QUERY_COUNT, territoryQueries.length);
  const maximumSearchVolume =
    territoryQueries.length > 0
      ? Math.max(
          ...territoryQueries.map((query) => query.metrics.search_volume ?? 0),
        )
      : 0;
  const scoredQueries = territoryQueries
    .map((query) => scoreQuery(query, maximumSearchVolume))
    .sort(compareScoredQueries);
  const selectedQueries = scoredQueries
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
      opportunity_metrics: {
        search_volume_used: scoredQuery.searchVolumeUsed,
        maximum_territory_search_volume:
          scoredQuery.maximumTerritorySearchVolume,
        volume_score: roundTo(scoredQuery.volumeScore, 4),
        keyword_difficulty_original:
          scoredQuery.keywordDifficultyOriginal,
        keyword_difficulty_used: scoredQuery.keywordDifficultyUsed,
        keyword_difficulty_was_imputed:
          scoredQuery.keywordDifficultyWasImputed,
        difficulty_score: roundTo(scoredQuery.difficultyScore, 4),
        opportunity_score: roundTo(scoredQuery.opportunityScore, 1),
      },
    }));

  logInfo(`${territory} confirmed queries considered: ${territoryQueries.length}`);
  logInfo(`${territory} maximum search volume: ${maximumSearchVolume}`);
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
    confirmed_query_count: territoryQueries.length,
    maximum_search_volume: maximumSearchVolume,
    selected_query_count: selectedCount,
    queries: selectedQueries,
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
  maximumTerritorySearchVolume: number,
): ScoredQuery {
  const searchVolumeUsed = query.metrics.search_volume ?? 0;
  const volumeScore =
    maximumTerritorySearchVolume > 0
      ? Math.log1p(searchVolumeUsed) / Math.log1p(maximumTerritorySearchVolume)
      : 0;
  const keywordDifficultyOriginal = query.metrics.keyword_difficulty;
  const keywordDifficultyUsed =
    keywordDifficultyOriginal ?? MISSING_KEYWORD_DIFFICULTY_DEFAULT;
  const keywordDifficultyWasImputed = keywordDifficultyOriginal === null;
  const difficultyScore = 1 - keywordDifficultyUsed / 100;
  const opportunityScore = 100 * volumeScore * difficultyScore;

  return {
    query,
    searchVolumeUsed,
    maximumTerritorySearchVolume,
    volumeScore,
    keywordDifficultyOriginal,
    keywordDifficultyUsed,
    keywordDifficultyWasImputed,
    difficultyScore,
    opportunityScore,
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
