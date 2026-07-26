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
  territoryP95SearchVolume: number,
): OpportunityScoreComponents {
  const searchVolumeUsed = query.metrics.search_volume ?? 0;
  const volumeScore =
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
  const difficultyScore = 1 - keywordDifficultyUsed / 100;
  const opportunityScore =
    Math.round(100 * (0.7 * volumeScore + 0.3 * difficultyScore) * 10) / 10;

  return {
    searchVolumeUsed,
    maximumTerritorySearchVolume: territoryP95SearchVolume,
    volumeScore,
    keywordDifficultyOriginal,
    keywordDifficultyUsed,
    keywordDifficultyWasImputed,
    difficultyScore,
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
