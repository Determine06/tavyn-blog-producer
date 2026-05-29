export type PostingFrequency = {
  postsPerWeek: number;
  durationWeeks: number;
};

export type GenerateContentPlanInput = {
  companyProfile: unknown;
  searchLandscape: unknown;
  postingFrequency: PostingFrequency;
};

export type ContentPlan = {
  planId: string;
  companyName: string;
  createdAt: string;
  durationWeeks: number;
  postsPerWeek: number;
  totalPlannedItems: number;
  status: "draft" | "approved" | "in_progress" | "completed";

  strategy: {
    primaryFocus: string;
    positioningThesis: string;
    recommendedFirstPost: string;
    topicsToPrioritize: string[];
    topicsToAvoidOrDelay: string[];
  };

  clusters: Array<{
    id: string;
    name: string;
    description: string;
    businessValue: "low" | "medium" | "high";
    priority: number;
  }>;

  plannedItems: Array<{
    id: string;
    week: number;
    sequence: number;
    workingTitle: string;

    clusterId: string;
    clusterName: string;

    funnelStage: "tofu" | "mofu" | "bofu";
    readerStage:
      | "unaware"
      | "problem-aware"
      | "solution-aware"
      | "product-aware"
      | "vendor-aware";
    searchIntent:
      | "informational"
      | "commercial"
      | "transactional"
      | "comparison"
      | "template"
      | "mixed";

    primaryKeyword: string;
    supportingKeywords: string[];

    whyThisPost: string;

    searchLandscapeSupport: {
      relatedQueries: string[];
      relatedGaps: string[];
      angleOpportunity: string;
    };

    productTieIn: string;
    founderPerspectiveNeeded: string[];

    priorityScore: number;
    status:
      | "planned"
      | "approved"
      | "brief_generated"
      | "blog_generated"
      | "published"
      | "skipped";
  }>;

  nextRecommendedAction: {
    type: "generate_seo_brief";
    plannedItemId: string;
    reason: string;
  };
};

export type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};
