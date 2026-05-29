export type CompanyProfile = {
  companySummary: string;
  primaryICP: {
    name: string;
    description: string;
    industries: string[];
    companySize: string[];
    roles: string[];
    seniority: string[];
    technicalLevel: "low" | "medium" | "high";
    budgetLevel: "low" | "medium" | "high";
  };
  pains: string[];
  goals: string[];
  buyingTriggers: string[];
  objections: string[];
  desiredOutcomes: string[];
  messaging: {
    valueProposition: string;
    positioning: string;
    tone: string[];
    wordsToUse: string[];
    wordsToAvoid: string[];
  };
  seo: {
    coreTopics: string[];
    blogAngles: string[];
    commercialKeywords: string[];
    informationalKeywords: string[];
    funnelStages: string[];
  };
  confidence: {
    score: number;
    missingInfo: string[];
    assumptions: string[];
  };
};

export type SearchQueryType =
  | "core_category"
  | "problem_aware"
  | "solution_aware"
  | "commercial"
  | "comparison"
  | "product_wedge"
  | "vendor_aware";

export type FunnelStage = "tofu" | "mofu" | "bofu";

export type ReaderStage =
  | "unaware"
  | "problem-aware"
  | "solution-aware"
  | "product-aware"
  | "vendor-aware";

export type SearchIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "navigational"
  | "comparison"
  | "template"
  | "mixed";

export type SearchResearchQuery = {
  id: string;
  query: string;
  queryType: SearchQueryType;
  funnelStage: FunnelStage;
  readerStage: ReaderStage;
  whySearchThis: string;
  sourceSignals: string[];
};

export type SearchQueryPlan = {
  generatedAt: string;
  companyName: string;
  totalQueries: number;
  queries: SearchResearchQuery[];
};

export type RawSearchResult = {
  position: number;
  title: string;
  url: string;
  domain: string;
  snippet?: string;
};

export type SearchQueryResult = {
  query: string;
  queryType: SearchQueryType;
  observedIntent: SearchIntent;
  topResults: RawSearchResult[];
  dominantContentTypes: string[];
  topResultThemes: string[];
  recurringAngles: string[];
  notableDomains: string[];
  weakSpots: string[];
};

export type ContentGap = {
  gap: string;
  gapType:
    | "audience_gap"
    | "format_gap"
    | "depth_gap"
    | "pov_gap"
    | "workflow_gap"
    | "product_gap"
    | "freshness_gap";
  relatedQueries: string[];
  whyItMatters: string;
  suggestedContentAngle: string;
  priority: "low" | "medium" | "high";
};

export type AngleOpportunity = {
  angle: string;
  evidenceFromSearch: string;
  whyCompanyCanWin: string;
  recommendedCluster: string;
  businessValue: "low" | "medium" | "high";
  seoOpportunity: "low" | "medium" | "high";
};

export type RawSearchResultsArtifact = {
  generatedAt: string;
  provider: "serper";
  totalQueries: number;
  limitPerQuery: number;
  results: Array<{
    queryId: string;
    query: string;
    queryType: SearchQueryType;
    funnelStage: FunnelStage;
    readerStage: ReaderStage;
    whySearchThis: string;
    sourceSignals: string[];
    topResults: RawSearchResult[];
    answerBox?: unknown;
    relatedSearches?: unknown[];
  }>;
};

export type SearchLandscape = {
  generatedAt: string;
  companyName: string;
  researchSummary: string;

  queryAnalyses: Array<{
    queryId: string;
    query: string;
    queryType: SearchQueryType;
    funnelStage: FunnelStage;
    readerStage: ReaderStage;
    observedIntent: SearchIntent;
    dominantContentTypes: string[];
    topRankingDomains: string[];
    recurringThemes: string[];
    weakSpots: string[];
    opportunity: string;
    evidence: Array<{
      position: number;
      title: string;
      domain: string;
      url: string;
    }>;
  }>;

  serpPatterns: Array<{
    pattern: string;
    relatedQueries: string[];
    whyItMatters: string;
  }>;

  domainVisibility: Array<{
    domain: string;
    domainType:
      | "direct_competitor"
      | "indirect_competitor"
      | "seo_publisher"
      | "community"
      | "platform"
      | "agency"
      | "tool_vendor"
      | "other";
    appearedForQueries: string[];
    appearanceCount: number;
    observedPositioning: string;
    relevanceToCompany: "low" | "medium" | "high";
  }>;

  contentGaps: ContentGap[];
  angleOpportunities: AngleOpportunity[];
  recommendedStrategicFocus: string;

  implicationsForContentPlan: {
    recommendedClusters: string[];
    topicsToPrioritize: string[];
    topicsToAvoidOrDelay: string[];
    suggestedFirstPost: string;
  };

  assumptions: string[];
  risks: string[];
};
