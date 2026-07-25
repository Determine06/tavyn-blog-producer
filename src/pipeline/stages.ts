export const pipelineStages = [
  {
    id: "crawl-context",
    stepName: "company-profile-crawl",
    description: "Crawl website content for company profile context.",
  },
  {
    id: "company-profile",
    stepName: "company-profile-generation",
    description: "Generate the company profile from crawl context.",
  },
  {
    id: "seed-keywords",
    stepName: "seed-keyword-generation",
    description: "Generate problem-demand and solution-demand seed keywords.",
  },
  {
    id: "keyword-metrics",
    stepName: "keyword-metrics-generation",
    description: "Discover keyword candidates and metrics with DataForSEO.",
  },
  {
    id: "query-validation",
    stepName: "query-validation",
    description: "Validate keyword candidates against the company profile.",
  },
  {
    id: "confirmed-queries",
    stepName: "confirmed-query-generation",
    description: "Convert valid query validations into confirmed queries.",
  },
  {
    id: "query-opportunities",
    stepName: "query-opportunity-scoring",
    description: "Score confirmed queries for organic opportunity.",
  },
  {
    id: "query-recommendations",
    stepName: "query-recommendation-selection",
    description: "Select the final recommended query opportunities.",
  },
  {
    id: "serp-results",
    stepName: "serper-organic-serp-collection",
    description: "Collect organic SERP results for recommended queries.",
  },
  {
    id: "content-recommendation",
    stepName: "serp-informed-content-recommendation",
    description: "Generate content recommendations from SERP evidence.",
  },
  {
    id: "competitor-landscape",
    stepName: "dataforseo-serp-competitor-landscape",
    description: "Collect competitor landscape data for confirmed queries.",
  },
  {
    id: "company-report",
    stepName: "deterministic-company-report-assembly",
    description: "Assemble the deterministic company report.",
  },
] as const;

export type PipelineStageId = (typeof pipelineStages)[number]["id"];

export const pipelineStageIds = pipelineStages.map((stage) => stage.id);

const stageAliases = new Map<string, PipelineStageId>([
  ["crawl", "crawl-context"],
]);

export function parsePipelineStageId(value: string): PipelineStageId | null {
  if (isPipelineStageId(value)) {
    return value;
  }

  return stageAliases.get(value) ?? null;
}

export function isPipelineStageId(value: string): value is PipelineStageId {
  return pipelineStageIds.some((stageId) => stageId === value);
}

export function getStageIndex(stageId: PipelineStageId): number {
  return pipelineStageIds.indexOf(stageId);
}

export function isStageAfter(
  stageId: PipelineStageId,
  stopAfter: PipelineStageId,
): boolean {
  return getStageIndex(stageId) > getStageIndex(stopAfter);
}

export function getStagesThrough(
  stopAfter: PipelineStageId,
): PipelineStageId[] {
  return pipelineStageIds.slice(0, getStageIndex(stopAfter) + 1);
}

export function formatStageList(): string {
  return pipelineStageIds.join(", ");
}
