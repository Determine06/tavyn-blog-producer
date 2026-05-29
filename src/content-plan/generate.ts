import type { ContentPlan, GenerateContentPlanInput, OpenAIChatResponse } from "./types";
import { buildContentPlanPrompt } from "./prompt";

export async function generateContentPlan(input: GenerateContentPlanInput): Promise<ContentPlan> {
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
          content: "You are Tavyn's SEO content strategist. Return strict JSON only.",
        },
        {
          role: "user",
          content: buildContentPlanPrompt(input),
        },
      ],
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error(`OpenAI request failed with status ${response.status}:`);
    console.error(responseText);
    throw new Error(`OpenAI request failed with status ${response.status}.`);
  }

  const data = JSON.parse(responseText) as OpenAIChatResponse;
  const modelText = data.choices?.[0]?.message?.content;
  if (!modelText) {
    throw new Error("OpenAI response did not include choices[0].message.content.");
  }

  let parsedPlan: unknown;
  try {
    parsedPlan = JSON.parse(modelText);
  } catch {
    const error = new Error("Failed to parse OpenAI response as JSON.");
    Object.defineProperty(error, "rawModelOutput", {
      value: modelText,
      enumerable: false,
    });
    throw error;
  }

  validateContentPlanShape(parsedPlan, input);
  const repairedPlan = removeInvalidRelatedQueries(parsedPlan, input.searchLandscape);

  validateContentPlan(repairedPlan, input);
  return repairedPlan;
}

function validateContentPlanShape(plan: unknown, input: GenerateContentPlanInput): asserts plan is ContentPlan {
  if (!isRecord(plan)) {
    throwValidationError("content plan must be an object", plan);
  }

  const expectedItems = input.postingFrequency.postsPerWeek * input.postingFrequency.durationWeeks;

  if (!Array.isArray(plan.plannedItems)) {
    throwValidationError("plannedItems must be an array", plan);
  }

  if (plan.plannedItems.length !== expectedItems) {
    throwValidationError(`expected ${expectedItems} plannedItems, got ${plan.plannedItems.length}`, plan);
  }

  if (!Array.isArray(plan.clusters)) {
    throwValidationError("clusters must be an array", plan);
  }

  if (!isRecord(plan.strategy)) {
    throwValidationError("strategy must exist", plan);
  }

  if (!isRecord(plan.nextRecommendedAction) || plan.nextRecommendedAction.type !== "generate_seo_brief") {
    throwValidationError("nextRecommendedAction.type must be generate_seo_brief", plan);
  }

  const clusterIds = new Set<string>();
  for (const [index, cluster] of plan.clusters.entries()) {
    if (!isRecord(cluster) || typeof cluster.id !== "string" || !cluster.id.trim()) {
      throwValidationError(`clusters[${index}].id must be a non-empty string`, plan);
    }
    clusterIds.add(cluster.id);
  }

  const plannedItemIds = new Set<string>();
  const weekCounts = new Map<number, number>();
  const funnelCounts = new Map<string, number>();

  for (const [index, item] of plan.plannedItems.entries()) {
    if (!isRecord(item)) {
      throwValidationError(`plannedItems[${index}] must be an object`, plan);
    }

    if (typeof item.id !== "string" || !item.id.trim()) {
      throwValidationError(`plannedItems[${index}].id must be a non-empty string`, plan);
    }

    if (plannedItemIds.has(item.id)) {
      throwValidationError(`duplicate planned item id: ${item.id}`, plan);
    }
    plannedItemIds.add(item.id);

    if (typeof item.week !== "number" || item.week < 1 || item.week > input.postingFrequency.durationWeeks) {
      throwValidationError(`plannedItems[${index}].week must be between 1 and ${input.postingFrequency.durationWeeks}`, plan);
    }
    weekCounts.set(item.week, (weekCounts.get(item.week) ?? 0) + 1);

    if (typeof item.clusterId !== "string" || !clusterIds.has(item.clusterId)) {
      throwValidationError(`plannedItems[${index}].clusterId must reference an existing cluster`, plan);
    }

    for (const field of ["workingTitle", "primaryKeyword", "whyThisPost", "productTieIn"] as const) {
      if (typeof item[field] !== "string" || !item[field].trim()) {
        throwValidationError(`plannedItems[${index}].${field} must be a non-empty string`, plan);
      }
    }

    if (!isRecord(item.searchLandscapeSupport)) {
      throwValidationError(`plannedItems[${index}].searchLandscapeSupport must exist`, plan);
    }

    if (!Array.isArray(item.searchLandscapeSupport.relatedQueries)) {
      throwValidationError(`plannedItems[${index}].searchLandscapeSupport.relatedQueries must be an array`, plan);
    }

    if (typeof item.funnelStage === "string") {
      funnelCounts.set(item.funnelStage, (funnelCounts.get(item.funnelStage) ?? 0) + 1);
    }
  }

  for (let week = 1; week <= input.postingFrequency.durationWeeks; week += 1) {
    const count = weekCounts.get(week) ?? 0;
    if (count !== input.postingFrequency.postsPerWeek) {
      throwValidationError(`week ${week} must have exactly ${input.postingFrequency.postsPerWeek} planned items, got ${count}`, plan);
    }
  }

  for (const stage of ["tofu", "mofu", "bofu"]) {
    if ((funnelCounts.get(stage) ?? 0) < 3) {
      throwValidationError(`funnel balance must include at least 3 ${stage} planned items`, plan);
    }
  }

  if (expectedItems === 12) {
    for (const stage of ["tofu", "mofu", "bofu"]) {
      const count = funnelCounts.get(stage) ?? 0;
      if (count !== 4) {
        throwValidationError(`12-item MVP content plans must include exactly 4 ${stage} planned items, got ${count}`, plan);
      }
    }
  }

  if (
    typeof plan.nextRecommendedAction.plannedItemId !== "string" ||
    !plannedItemIds.has(plan.nextRecommendedAction.plannedItemId)
  ) {
    throwValidationError("nextRecommendedAction.plannedItemId must reference an existing planned item", plan);
  }
}

function validateContentPlan(plan: unknown, input: GenerateContentPlanInput): asserts plan is ContentPlan {
  validateContentPlanShape(plan, input);

  const validQueries = getValidSearchedQuerySet(input.searchLandscape);

  for (const item of plan.plannedItems) {
    const relatedQueries = item.searchLandscapeSupport?.relatedQueries;

    if (!Array.isArray(relatedQueries)) {
      throwValidationError(`planned item ${item.id} is missing searchLandscapeSupport.relatedQueries`, plan);
    }

    if (relatedQueries.length === 0) {
      throwValidationError(`planned item ${item.id} has no valid related queries after cleanup`, plan);
    }

    for (const relatedQuery of relatedQueries) {
      if (!validQueries.has(relatedQuery)) {
        throwValidationError(
          `planned item ${item.id} includes related query "${relatedQuery}" that was not found in searchLandscape.queryAnalyses[].query`,
          plan,
        );
      }
    }
  }
}

function removeInvalidRelatedQueries(plan: ContentPlan, searchLandscape: unknown): ContentPlan {
  const validQueries = getValidSearchedQuerySet(searchLandscape);

  return {
    ...plan,
    plannedItems: plan.plannedItems.map((item) => {
      const relatedQueries = item.searchLandscapeSupport.relatedQueries;
      const validRelatedQueries = relatedQueries.filter((query) => validQueries.has(query));
      const removedQueries = relatedQueries.filter((query) => !validQueries.has(query));

      if (removedQueries.length > 0) {
        console.warn(`Removed invalid related queries from ${item.id}: ${removedQueries.join(", ")}`);
      }

      return {
        ...item,
        searchLandscapeSupport: {
          ...item.searchLandscapeSupport,
          relatedQueries: validRelatedQueries,
        },
      };
    }),
  };
}

function getValidSearchedQuerySet(searchLandscape: unknown): Set<string> {
  const analyses = (searchLandscape as any)?.queryAnalyses;
  if (!Array.isArray(analyses)) return new Set();

  return new Set(
    analyses
      .map((analysis: any) => analysis?.query)
      .filter((query: unknown): query is string => typeof query === "string" && query.trim().length > 0),
  );
}

function throwValidationError(message: string, invalidPlan: unknown): never {
  const error = new Error(`Invalid content plan: ${message}.`);
  Object.defineProperty(error, "invalidPlan", {
    value: invalidPlan,
    enumerable: false,
  });
  throw error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
