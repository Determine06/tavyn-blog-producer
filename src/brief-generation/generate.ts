import type {
  GenerateTechnicalSeoBriefInput,
  TechnicalSeoBrief,
} from "./types";
import { buildTechnicalSeoBriefPrompt } from "./prompt";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export async function generateTechnicalSeoBrief(
  input: GenerateTechnicalSeoBriefInput,
): Promise<TechnicalSeoBrief> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Add it to .env or export it in your terminal.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are Tavyn's technical SEO brief generator. Return strict JSON only.",
        },
        {
          role: "user",
          content: buildTechnicalSeoBriefPrompt(input),
        },
      ],
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}: ${responseText}`);
  }

  const data = JSON.parse(responseText) as OpenAIChatResponse;
  const modelText = data.choices?.[0]?.message?.content;
  if (!modelText) {
    throw new Error("OpenAI response did not include choices[0].message.content.");
  }

  let parsedBrief: unknown;
  try {
    parsedBrief = JSON.parse(modelText);
  } catch {
    const error = new Error("Failed to parse OpenAI response as JSON.");
    Object.defineProperty(error, "rawModelOutput", {
      value: modelText,
      enumerable: false,
    });
    throw error;
  }

  const repairedBrief = repairTechnicalSeoBriefCandidate(parsedBrief, input);

  validateTechnicalSeoBrief(repairedBrief, input);
  return repairedBrief;
}

function validateTechnicalSeoBrief(
  brief: unknown,
  input: GenerateTechnicalSeoBriefInput,
): asserts brief is TechnicalSeoBrief {
  if (!isRecord(brief)) {
    throwValidationError("brief must be an object", brief);
  }

  if ("internalLinks" in brief) {
    throwValidationError("brief must not include internalLinks", brief);
  }

  if ("externalLinks" in brief) {
    throwValidationError("brief must not include externalLinks", brief);
  }

  const plannedItemId = getPlannedItemId(input.plannedItem);

  if (typeof brief.briefId !== "string" || !brief.briefId.trim()) {
    throwValidationError("briefId must be a non-empty string", brief);
  }

  if (brief.plannedItemId !== plannedItemId) {
    throwValidationError(`plannedItemId must match selected planned item id ${plannedItemId}`, brief);
  }

  if (brief.status !== "draft") {
    throwValidationError("status must be draft", brief);
  }

  if (!isRecord(brief.searchTarget) || !isNonEmptyString(brief.searchTarget.primaryKeyword)) {
    throwValidationError("searchTarget.primaryKeyword must exist", brief);
  }

  if (
    !isRecord(brief.keywordMap) ||
    !isRecord(brief.keywordMap.primaryKeyword) ||
    !isNonEmptyString(brief.keywordMap.primaryKeyword.term)
  ) {
    throwValidationError("keywordMap.primaryKeyword.term must exist", brief);
  }

  if (!hasArrayWithMinLength(brief.keywordMap.semanticTermsToInclude, 5)) {
    throwValidationError("keywordMap.semanticTermsToInclude must include at least 5 items", brief);
  }

  if (!isRecord(brief.serpRequirements) || !hasArrayWithMinLength(brief.serpRequirements.contentGapsToExploit, 2)) {
    throwValidationError("serpRequirements.contentGapsToExploit must include at least 2 items", brief);
  }

  if (!isRecord(brief.onPageSeo) || !isNonEmptyString(brief.onPageSeo.recommendedSlug)) {
    throwValidationError("onPageSeo.recommendedSlug must exist", brief);
  }

  if (!isRecord(brief.onPageSeo.metaTitle) || !isNonEmptyString(brief.onPageSeo.metaTitle.draft)) {
    throwValidationError("onPageSeo.metaTitle.draft must exist", brief);
  }

  if (typeof brief.onPageSeo.metaTitle.maxLength !== "number") {
    throwValidationError("onPageSeo.metaTitle.maxLength must exist", brief);
  }

  if (brief.onPageSeo.metaTitle.draft.length > brief.onPageSeo.metaTitle.maxLength) {
    throwValidationError(
      `Meta title is ${brief.onPageSeo.metaTitle.draft.length} characters, exceeding maxLength ${brief.onPageSeo.metaTitle.maxLength}`,
      brief,
    );
  }

  if (!isRecord(brief.onPageSeo.metaDescription) || !isNonEmptyString(brief.onPageSeo.metaDescription.draft)) {
    throwValidationError("onPageSeo.metaDescription.draft must exist", brief);
  }

  if (typeof brief.onPageSeo.metaDescription.maxLength !== "number") {
    throwValidationError("onPageSeo.metaDescription.maxLength must exist", brief);
  }

  if (brief.onPageSeo.metaDescription.draft.length > brief.onPageSeo.metaDescription.maxLength) {
    throwValidationError(
      `Meta description is ${brief.onPageSeo.metaDescription.draft.length} characters, exceeding maxLength ${brief.onPageSeo.metaDescription.maxLength}`,
      brief,
    );
  }

  if (
    !isRecord(brief.onPageSeo.headingRequirements) ||
    !hasArrayWithMinLength(brief.onPageSeo.headingRequirements.mustIncludeH2sAbout, 3)
  ) {
    throwValidationError("onPageSeo.headingRequirements.mustIncludeH2sAbout must include at least 3 items", brief);
  }

  if (
    isRecord(brief.sourceContentPlanItem) &&
    brief.sourceContentPlanItem.funnelStage === "tofu" &&
    brief.onPageSeo.headingRequirements.mustIncludeH2sAbout.some(
      (heading) => typeof heading === "string" && heading.toLowerCase().includes("tavyn"),
    )
  ) {
    throwValidationError("TOFU heading requirements must not directly name Tavyn", brief);
  }

  if (!isRecord(brief.technicalPublishing) || brief.technicalPublishing.contentType !== "blog_post") {
    throwValidationError("technicalPublishing.contentType must be blog_post", brief);
  }

  if (
    !isRecord(brief.technicalPublishing.schemaMarkup) ||
    !["Article", "BlogPosting", "HowTo"].includes(String(brief.technicalPublishing.schemaMarkup.recommendedType))
  ) {
    throwValidationError("technicalPublishing.schemaMarkup.recommendedType must be Article, BlogPosting, or HowTo", brief);
  }

  if (
    brief.technicalPublishing.schemaMarkup.recommendedType !== "HowTo" &&
    brief.technicalPublishing.schemaMarkup.includeHowToSchema !== false
  ) {
    throwValidationError("technicalPublishing.schemaMarkup.includeHowToSchema must be false unless recommendedType is HowTo", brief);
  }

  if (!hasArrayWithMinLength(brief.contentCoverageChecklist, 5)) {
    throwValidationError("contentCoverageChecklist must include at least 5 items", brief);
  }

  if (!hasArrayWithMinLength(brief.seoRiskWarnings, 3)) {
    throwValidationError("seoRiskWarnings must include at least 3 items", brief);
  }

  if (!isRecord(brief.founderQuestionTriggers)) {
    throwValidationError("founderQuestionTriggers must exist", brief);
  }

  if (
    typeof brief.founderQuestionTriggers.maxQuestions !== "number" ||
    brief.founderQuestionTriggers.maxQuestions > 3
  ) {
    throwValidationError("founderQuestionTriggers.maxQuestions must be 3 or less", brief);
  }

  if (!Array.isArray(brief.founderQuestionTriggers.questionAreas)) {
    throwValidationError("founderQuestionTriggers.questionAreas must exist", brief);
  }

  if (brief.founderQuestionTriggers.questionAreas.length > brief.founderQuestionTriggers.maxQuestions) {
    throwValidationError("founderQuestionTriggers.questionAreas must not exceed maxQuestions", brief);
  }

  for (const [index, questionArea] of brief.founderQuestionTriggers.questionAreas.entries()) {
    if (!isRecord(questionArea) || !isNonEmptyString(questionArea.suggestedQuestion)) {
      throwValidationError(`founderQuestionTriggers.questionAreas[${index}].suggestedQuestion must exist`, brief);
    }

    if (questionArea.suggestedQuestion.length >= 160) {
      throwValidationError(
        `founderQuestionTriggers.questionAreas[${index}].suggestedQuestion must be under 160 characters`,
        brief,
      );
    }

    if (!questionArea.suggestedQuestion.trim().endsWith("?")) {
      throwValidationError(
        `founderQuestionTriggers.questionAreas[${index}].suggestedQuestion must end with ?`,
        brief,
      );
    }
  }

  if (
    !isRecord(brief.nextRecommendedAction) ||
    (brief.nextRecommendedAction.type !== "generate_founder_questions" &&
      brief.nextRecommendedAction.type !== "generate_outline")
  ) {
    throwValidationError("nextRecommendedAction.type must be generate_founder_questions or generate_outline", brief);
  }
}

function repairTechnicalSeoBriefCandidate(brief: unknown, input: GenerateTechnicalSeoBriefInput): unknown {
  if (!isRecord(brief)) return brief;

  const keywordRepairedBrief = repairWorkflowPrimaryKeyword(brief, input);
  const h2RepairedBrief = softenTofuProductH2s(keywordRepairedBrief);
  return repairHowToSchemaFlag(h2RepairedBrief);
}

function repairWorkflowPrimaryKeyword(brief: Record<string, unknown>, input: GenerateTechnicalSeoBriefInput): Record<string, unknown> {
  if (!isWorkflowFocusedPlannedItem(input.plannedItem)) return brief;

  const searchTarget = brief.searchTarget;
  const keywordMap = brief.keywordMap;

  if (!isRecord(searchTarget) || !isRecord(keywordMap) || !isRecord(keywordMap.primaryKeyword)) return brief;
  if (typeof searchTarget.primaryKeyword !== "string") return brief;

  const currentPrimaryKeyword = searchTarget.primaryKeyword.trim();
  if (!currentPrimaryKeyword || currentPrimaryKeyword.toLowerCase() !== "founder-led content strategy") return brief;

  const repairedPrimaryKeyword = "SEO blog workflow for SaaS founders";
  const existingTargetQueryCluster = Array.isArray(searchTarget.targetQueryCluster)
    ? searchTarget.targetQueryCluster.filter((query): query is string => typeof query === "string" && query.trim().length > 0)
    : [];
  const targetQueryCluster = [repairedPrimaryKeyword, ...existingTargetQueryCluster.filter((query) => query !== repairedPrimaryKeyword)];
  const semanticTermsToInclude = Array.isArray(keywordMap.semanticTermsToInclude)
    ? keywordMap.semanticTermsToInclude
    : [];

  return {
    ...brief,
    searchTarget: {
      ...searchTarget,
      primaryKeyword: repairedPrimaryKeyword,
      targetQueryCluster,
    },
    keywordMap: {
      ...keywordMap,
      primaryKeyword: {
        ...keywordMap.primaryKeyword,
        term: repairedPrimaryKeyword,
      },
      semanticTermsToInclude: semanticTermsToInclude.includes(currentPrimaryKeyword)
        ? semanticTermsToInclude
        : [...semanticTermsToInclude, currentPrimaryKeyword],
    },
  };
}

function isWorkflowFocusedPlannedItem(plannedItem: unknown): boolean {
  if (!isRecord(plannedItem)) return false;

  const workingTitle = typeof plannedItem.workingTitle === "string" ? plannedItem.workingTitle.toLowerCase() : "";
  const primaryKeyword = typeof plannedItem.primaryKeyword === "string" ? plannedItem.primaryKeyword.toLowerCase() : "";
  const supportingKeywords = Array.isArray(plannedItem.supportingKeywords)
    ? plannedItem.supportingKeywords.filter((keyword): keyword is string => typeof keyword === "string")
    : [];
  const keywordText = [primaryKeyword, ...supportingKeywords].join(" ").toLowerCase();

  return (
    (workingTitle.includes("workflow") || workingTitle.includes("process") || workingTitle.includes("system")) &&
    (workingTitle.includes("saas") || keywordText.includes("saas")) &&
    (workingTitle.includes("founder") || keywordText.includes("founder"))
  );
}

function softenTofuProductH2s(brief: unknown): unknown {
  if (!isRecord(brief)) return brief;

  const sourceContentPlanItem = brief.sourceContentPlanItem;
  const onPageSeo = brief.onPageSeo;

  if (!isRecord(sourceContentPlanItem) || sourceContentPlanItem.funnelStage !== "tofu") return brief;
  if (!isRecord(onPageSeo) || !isRecord(onPageSeo.headingRequirements)) return brief;

  const mustIncludeH2sAbout = onPageSeo.headingRequirements.mustIncludeH2sAbout;
  if (!Array.isArray(mustIncludeH2sAbout)) return brief;

  return {
    ...brief,
    onPageSeo: {
      ...onPageSeo,
      headingRequirements: {
        ...onPageSeo.headingRequirements,
        mustIncludeH2sAbout: mustIncludeH2sAbout.map((heading) =>
          typeof heading === "string" && heading.toLowerCase().includes("tavyn")
            ? "How a lightweight blog operations system helps founders stay consistent"
            : heading,
        ),
      },
    },
  };
}

function repairHowToSchemaFlag(brief: unknown): unknown {
  if (!isRecord(brief) || !isRecord(brief.technicalPublishing)) return brief;

  const schemaMarkup = brief.technicalPublishing.schemaMarkup;
  if (!isRecord(schemaMarkup) || schemaMarkup.recommendedType === "HowTo") return brief;

  return {
    ...brief,
    technicalPublishing: {
      ...brief.technicalPublishing,
      schemaMarkup: {
        ...schemaMarkup,
        includeHowToSchema: false,
      },
    },
  };
}

function getPlannedItemId(plannedItem: unknown): string {
  if (!isRecord(plannedItem) || !isNonEmptyString(plannedItem.id)) {
    throw new Error("Selected planned item is missing id.");
  }

  return plannedItem.id;
}

function throwValidationError(message: string, invalidBrief: unknown): never {
  const error = new Error(`Invalid technical SEO brief: ${message}.`);
  Object.defineProperty(error, "invalidBrief", {
    value: invalidBrief,
    enumerable: false,
  });
  throw error;
}

function hasArrayWithMinLength(value: unknown, minLength: number): value is unknown[] {
  return Array.isArray(value) && value.length >= minLength;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
