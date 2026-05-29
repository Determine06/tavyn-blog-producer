export type TechnicalSeoBriefStatus = "draft" | "approved" | "needs_revision";

export type TechnicalSeoBrief = {
  briefId: string;
  plannedItemId: string;
  companyName: string;
  createdAt: string;
  status: TechnicalSeoBriefStatus;

  sourceContentPlanItem: {
    workingTitle: string;
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
  };

  searchTarget: {
    primaryKeyword: string;
    targetQueryCluster: string[];
    searchIntent:
      | "informational"
      | "commercial"
      | "transactional"
      | "comparison"
      | "template"
      | "mixed";
    contentGoal: string;
  };

  keywordMap: {
    primaryKeyword: {
      term: string;
      required: boolean;
      recommendedPlacements: string[];
      usageGuidance: string;
    };
    secondaryKeywords: Array<{
      term: string;
      recommendedPlacements: string[];
    }>;
    semanticTermsToInclude: string[];
    termsToAvoidOrUseCarefully: string[];
  };

  serpRequirements: {
    dominantContentTypes: string[];
    commonThemesToCover: string[];
    contentGapsToExploit: string[];
    informationGainRequirement: string;
  };

  onPageSeo: {
    recommendedSlug: string;
    metaTitle: {
      draft: string;
      maxLength: number;
      mustInclude: string[];
    };
    metaDescription: {
      draft: string;
      maxLength: number;
      mustInclude: string[];
    };
    h1: string;
    headingRequirements: {
      mustIncludeH2sAbout: string[];
      avoidDuplicateH1: boolean;
    };
    recommendedWordCount: {
      min: number;
      target: number;
      max: number;
    };
  };

  technicalPublishing: {
    canonicalSlug: string;
    contentType: "blog_post";
    suggestedTags: string[];
    schemaMarkup: {
      recommendedType: "Article" | "BlogPosting" | "HowTo";
      includeFaqSchema: boolean;
      includeHowToSchema: boolean;
      reason: string;
    };
    imageRequirements: {
      recommendedHeroImageAlt: string;
      suggestedDiagram?: string;
    };
  };

  contentCoverageChecklist: string[];

  seoRiskWarnings: string[];

  founderQuestionTriggers: {
    askFounder: boolean;
    reason: string;
    maxQuestions: number;
    fallbackAllowed: boolean;
    questionAreas: Array<{
      gapType:
        | "founder_pov"
        | "product_accuracy"
        | "positioning"
        | "proof_or_example"
        | "claims_risk";
      whyNeeded: string;
      suggestedQuestion: string;
    }>;
  };

  nextRecommendedAction: {
    type: "generate_founder_questions" | "generate_outline";
    reason: string;
  };
};

export type GenerateTechnicalSeoBriefInput = {
  companyProfile: unknown;
  searchLandscape: unknown;
  contentPlan: unknown;
  plannedItem: unknown;
};
