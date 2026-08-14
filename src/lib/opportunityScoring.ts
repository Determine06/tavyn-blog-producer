export const MISSING_KEYWORD_DIFFICULTY_DEFAULT = 50;

export const OPPORTUNITY_SCORING_METHOD = {
  name: "relative_search_demand_plus_organic_attainability",
  version: "2.0.0",
  missing_keyword_difficulty_default: MISSING_KEYWORD_DIFFICULTY_DEFAULT,
  combination_method: "weighted_additive",
  formula:
    "100 * (0.70 * demand_score + 0.30 * attainability_score)",
  weights: {
    demand_score: 0.7,
    attainability_score: 0.3,
  },
  demand_normalization: {
    method: "log1p_territory_p95_capped",
    territory_specific: true,
    cap: 1,
  },
  score_scope: "within_territory_relative_priority",
} as const;

type ScorableQuery = {
  metrics: {
    search_volume: number | null;
    keyword_difficulty: number | null;
  };
};

export type OpportunityScoreComponents = {
  searchVolumeUsed: number;
  territoryP95SearchVolume: number;
  demandScore: number;
  keywordDifficultyOriginal: number | null;
  keywordDifficultyUsed: number;
  keywordDifficultyWasImputed: boolean;
  attainabilityScore: number;
  opportunityScore: number;
};

export function calculateOpportunityScore(
  query: ScorableQuery,
  territoryP95SearchVolume: number,
): OpportunityScoreComponents {
  const searchVolumeUsed = query.metrics.search_volume ?? 0;
  const demandScore =
    territoryP95SearchVolume > 0
      ? Math.min(
          1,
          Math.log1p(searchVolumeUsed) / Math.log1p(territoryP95SearchVolume),
        )
      : 0;
  const keywordDifficultyOriginal = query.metrics.keyword_difficulty;
  const keywordDifficultyUsed =
    keywordDifficultyOriginal ?? MISSING_KEYWORD_DIFFICULTY_DEFAULT;
  const keywordDifficultyWasImputed = keywordDifficultyOriginal === null;
  const attainabilityScore = 1 - keywordDifficultyUsed / 100;
  const opportunityScore =
    Math.round(
      100 *
        (OPPORTUNITY_SCORING_METHOD.weights.demand_score * demandScore +
          OPPORTUNITY_SCORING_METHOD.weights.attainability_score *
            attainabilityScore) *
        10,
    ) / 10;

  return {
    searchVolumeUsed,
    territoryP95SearchVolume,
    demandScore,
    keywordDifficultyOriginal,
    keywordDifficultyUsed,
    keywordDifficultyWasImputed,
    attainabilityScore,
    opportunityScore,
  };
}

export function calculateTerritoryP95SearchVolume(
  queries: ScorableQuery[],
): number {
  const observedVolumes = queries
    .map((query) => query.metrics.search_volume)
    .filter((volume): volume is number => volume !== null)
    .sort((a, b) => a - b);

  return observedVolumes.length === 0
    ? 0
    : observedVolumes[Math.ceil(0.95 * observedVolumes.length) - 1];
}
