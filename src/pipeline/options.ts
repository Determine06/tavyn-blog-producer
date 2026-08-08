import {
  formatStageList,
  getStageIndex,
  isStageAfter,
  parsePipelineStageId,
  pipelineStageIds,
  type PipelineStageId,
} from "./stages.js";

export type CacheMode = "cache" | "no-cache";

export type PipelineCliOptions = {
  websiteUrl: string;
  artifactRoot: string;
  cacheMode: CacheMode;
  forceStages: PipelineStageId[];
  stopAfter: PipelineStageId | null;
  forceCrawl: boolean;
  forceProfile: boolean;
  forceSeedKeywords: boolean;
  forceQueryCandidates: boolean;
  forceSerp: boolean;
  forceQueryMetrics: boolean;
  forceQueryValidation: boolean;
  forceQueryOpportunities: boolean;
  forceQueryRecommendations: boolean;
  forceContentRecommendation: boolean;
  forceCompetitorLandscape: boolean;
  forceCompanyReport: boolean;
  saveToSupabase: boolean;
};

export function parsePipelineCliOptions(argv: string[]): PipelineCliOptions {
  const cacheMode = parseCacheMode(argv);
  const stopAfter = parseStopAfter(argv);
  const forceStages = normalizeForceStages([
    ...parseForceStages(argv, stopAfter, cacheMode),
    ...parseLegacyForceStages(argv),
  ]);

  validateForcedStagesBeforeStop(forceStages, stopAfter);
  const forceCrawl = hasLegacyForce(argv, "--force-crawl", "crawl-context");
  const forceProfile = hasLegacyForce(
    argv,
    "--force-profile",
    "company-profile",
  );
  const forceSeedKeywords = hasLegacyForce(
    argv,
    "--force-seed-keywords",
    "seed-keywords",
  );
  const forceQueryCandidates =
    argv.includes("--force-query-candidates") ||
    argv.includes("--force-clusters");
  const forceSerp = hasLegacyForce(argv, "--force-serp", "serp-results");
  const forceQueryMetrics = hasLegacyForce(
    argv,
    "--force-query-metrics",
    "keyword-metrics",
  );
  const forceQueryValidation = hasLegacyForce(
    argv,
    "--force-query-validation",
    "query-validation",
  );
  const forceQueryOpportunities = hasLegacyForce(
    argv,
    "--force-query-opportunities",
    "query-opportunities",
  );
  const forceQueryRecommendations = hasLegacyForce(
    argv,
    "--force-query-recommendations",
    "query-recommendations",
  );
  const forceContentRecommendation = hasLegacyForce(
    argv,
    "--force-content-recommendation",
    "content-recommendation",
  );
  const forceCompetitorLandscape = hasLegacyForce(
    argv,
    "--force-competitor-landscape",
    "competitor-landscape",
  );
  const forceCompanyReport = hasLegacyForce(
    argv,
    "--force-company-report",
    "company-report",
  );

  return {
    websiteUrl: parseUrlArgs(argv)[0] ?? "https://tavyn.dev/",
    artifactRoot: parseArtifactRoot(argv),
    cacheMode,
    forceStages,
    stopAfter,
    forceCrawl,
    forceProfile,
    forceSeedKeywords,
    forceQueryCandidates,
    forceSerp,
    forceQueryMetrics,
    forceQueryValidation,
    forceQueryOpportunities,
    forceQueryRecommendations,
    forceContentRecommendation,
    forceCompetitorLandscape,
    forceCompanyReport,
    saveToSupabase: argv.includes("--save-to-supabase"),
  };

  function hasLegacyForce(
    argvValue: string[],
    legacyFlag: string,
    stageId: PipelineStageId,
  ): boolean {
    return argvValue.includes(legacyFlag) || forceStages.includes(stageId);
  }
}

export function parseArtifactRoot(argv: string[]): string {
  const equalsArg = argv.find((arg) => arg.startsWith("--artifact-root="));

  if (equalsArg !== undefined) {
    return requireArtifactRoot(equalsArg.slice("--artifact-root=".length));
  }

  const flagIndex = argv.indexOf("--artifact-root");

  if (flagIndex === -1) {
    return "artifacts";
  }

  const value = argv[flagIndex + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new Error("--artifact-root requires a path value.");
  }

  return requireArtifactRoot(value);
}

function parseLegacyForceStages(argv: string[]): PipelineStageId[] {
  const stages: PipelineStageId[] = [];

  if (argv.includes("--force-crawl")) {
    stages.push("crawl-context");
  }
  if (argv.includes("--force-profile")) {
    stages.push("company-profile");
  }
  if (argv.includes("--force-seed-keywords")) {
    stages.push("seed-keywords");
  }
  if (argv.includes("--force-query-metrics")) {
    stages.push("keyword-metrics");
  }
  if (argv.includes("--force-query-validation")) {
    stages.push("query-validation");
  }
  if (argv.includes("--force-query-opportunities")) {
    stages.push("query-opportunities");
  }
  if (argv.includes("--force-query-recommendations")) {
    stages.push("query-recommendations");
  }
  if (argv.includes("--force-serp")) {
    stages.push("serp-results");
  }
  if (argv.includes("--force-content-recommendation")) {
    stages.push("content-recommendation");
  }
  if (argv.includes("--force-competitor-landscape")) {
    stages.push("competitor-landscape");
  }
  if (argv.includes("--force-company-report")) {
    stages.push("company-report");
  }

  return stages;
}

function normalizeForceStages(stages: PipelineStageId[]): PipelineStageId[] {
  const selected = new Set(stages);

  return pipelineStageIds.filter((stageId) => selected.has(stageId));
}

export function parseCacheMode(argv: string[]): CacheMode {
  const hasCache = argv.includes("--cache");
  const hasNoCache = argv.includes("--no-cache");

  if (hasCache && hasNoCache) {
    throw new Error("Cannot supply both --cache and --no-cache.");
  }

  return hasNoCache ? "no-cache" : "cache";
}

export function parseStopAfter(argv: string[]): PipelineStageId | null {
  const equalsArg = argv.find((arg) => arg.startsWith("--stop-after="));

  if (equalsArg !== undefined) {
    return requireStage(equalsArg.slice("--stop-after=".length), "--stop-after");
  }

  const flagIndex = argv.indexOf("--stop-after");

  if (flagIndex === -1) {
    return null;
  }

  const value = argv[flagIndex + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new Error(`--stop-after requires one of: ${formatStageList()}.`);
  }

  return requireStage(value, "--stop-after");
}

export function parseForceStages(
  argv: string[],
  stopAfter: PipelineStageId | null,
  cacheMode: CacheMode,
): PipelineStageId[] {
  const selected = new Set<PipelineStageId>();
  let forceAll = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--force") {
      const value = argv[index + 1];

      if (value === undefined || value.startsWith("--")) {
        throw new Error(`--force requires a stage or all. Valid stages: ${formatStageList()}.`);
      }

      forceAll = addForceValue(value, selected) || forceAll;
      index += 1;
      continue;
    }

    if (arg.startsWith("--force=")) {
      forceAll = addForceValue(arg.slice("--force=".length), selected) || forceAll;
    }
  }

  if (cacheMode === "no-cache" || forceAll) {
    const effectiveStop = stopAfter ?? pipelineStageIds[pipelineStageIds.length - 1];

    for (const stageId of pipelineStageIds.slice(0, getStageIndex(effectiveStop) + 1)) {
      selected.add(stageId);
    }
  }

  const ordered = pipelineStageIds.filter((stageId) => selected.has(stageId));

  if (stopAfter !== null) {
    const invalidStage = ordered.find((stageId) =>
      isStageAfter(stageId, stopAfter),
    );

    if (invalidStage !== undefined) {
      throw new Error(
        `Cannot force ${invalidStage} because it occurs after --stop-after ${stopAfter}.`,
      );
    }
  }

  return ordered;
}

function validateForcedStagesBeforeStop(
  stages: PipelineStageId[],
  stopAfter: PipelineStageId | null,
): void {
  if (stopAfter === null) {
    return;
  }

  const invalidStage = stages.find((stageId) => isStageAfter(stageId, stopAfter));

  if (invalidStage !== undefined) {
    throw new Error(
      `Cannot force ${invalidStage} because it occurs after --stop-after ${stopAfter}.`,
    );
  }
}

export function parseUrlArgs(argv: string[]): string[] {
  const urlArgs: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (
      arg === "--stop-after" ||
      arg === "--force" ||
      arg === "--artifact-root"
    ) {
      index += 1;
      continue;
    }

    if (
      arg.startsWith("--stop-after=") ||
      arg.startsWith("--force=") ||
      arg.startsWith("--artifact-root=") ||
      arg === "--cache" ||
      arg === "--no-cache" ||
      arg === "--save-to-supabase"
    ) {
      continue;
    }

    if (!arg.startsWith("--")) {
      urlArgs.push(arg);
    }
  }

  return urlArgs;
}

function requireArtifactRoot(value: string): string {
  const trimmedValue = value.trim().replace(/\/+$/g, "");

  if (trimmedValue.length === 0) {
    throw new Error("--artifact-root requires a non-empty path value.");
  }

  return trimmedValue;
}

function addForceValue(
  value: string,
  selected: Set<PipelineStageId>,
): boolean {
  if (value === "all") {
    return true;
  }

  selected.add(requireStage(value, "--force"));
  return false;
}

function requireStage(value: string, flagName: string): PipelineStageId {
  const stage = parsePipelineStageId(value);

  if (stage !== null) {
    return stage;
  }

  throw new Error(
    `Unknown ${flagName} stage "${value}". Valid stages: ${formatStageList()}.`,
  );
}
