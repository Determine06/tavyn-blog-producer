export const MISSING_KEYWORD_DIFFICULTY_DEFAULT = 50;

type ScorableQuery = {
  metrics: {
    search_volume: number | null;
    keyword_difficulty: number | null;
  };
};

export type OpportunityScoreComponents = {
  searchVolumeUsed: number;
  maximumTerritorySearchVolume: number;
  volumeScore: number;
  keywordDifficultyOriginal: number | null;
  keywordDifficultyUsed: number;
  keywordDifficultyWasImputed: boolean;
  difficultyScore: number;
  opportunityScore: number;
};

export function calculateOpportunityScore(
  query: ScorableQuery,
  maximumTerritorySearchVolume: number,
): OpportunityScoreComponents {
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
