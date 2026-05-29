export type BlogGenerationInput = {
  companyProfile: unknown;
  contentPlan: unknown;
  technicalSeoBrief: unknown;
  founderAnswers: unknown;
  plannedItem: unknown;
};

export type BlogGenerationResult = {
  plannedItemId: string;
  title: string;
  slug: string;
  markdown: string;
  checks: {
    hasNoEmDashes: boolean;
    estimatedWordCount: number;
    includesPrimaryKeyword: boolean;
    includesFounderContext: boolean;
    includesSoftProductTieIn: boolean;
  };
};
