const LOGGING_ENABLED = true;
const HYPERPARAMETER_LOGGING_ENABLED =
  process.env.LOG_HYPERPARAMETERS === "true";
const RUN_STARTED_AT = process.hrtime.bigint();

type RunUsageSummary = {
  openAiRequests: number;
  openAiInputTokens: number;
  openAiCachedInputTokens: number;
  openAiOutputTokens: number;
  openAiReasoningTokens: number;
  openAiTotalTokens: number;
  dataForSeoHttpRequests: number;
  dataForSeoTasksSubmitted: number;
  dataForSeoTotalCostUsd: number;
};

const runUsageSummary: RunUsageSummary = {
  openAiRequests: 0,
  openAiInputTokens: 0,
  openAiCachedInputTokens: 0,
  openAiOutputTokens: 0,
  openAiReasoningTokens: 0,
  openAiTotalTokens: 0,
  dataForSeoHttpRequests: 0,
  dataForSeoTasksSubmitted: 0,
  dataForSeoTotalCostUsd: 0,
};

function writeLog(prefix: string, message: string): void {
  if (!LOGGING_ENABLED) {
    return;
  }

  console.log(`[${prefix}] ${message}`);
}

export function logStep(message: string): void {
  writeLog("STEP", message);
}

export function logInfo(message: string): void {
  writeLog("INFO", message);
}

export function logSuccess(message: string): void {
  writeLog("SUCCESS", message);
}

export function logWarn(message: string): void {
  writeLog("WARN", message);
}

export function logTokenUsage(label: string, usage: unknown): void {
  if (!LOGGING_ENABLED) {
    return;
  }

  if (usage === null || usage === undefined) {
    writeLog("WARN", `${label} token usage was not returned.`);
    return;
  }

  console.log(`[TOKENS] ${label}`);
  console.log(JSON.stringify(usage, null, 2));
  recordOpenAiTokenUsage(usage);
}

export function recordDataForSeoUsage(
  label: string,
  httpRequests: number,
  tasksSubmitted: number,
  costUsd: number,
): void {
  runUsageSummary.dataForSeoHttpRequests += httpRequests;
  runUsageSummary.dataForSeoTasksSubmitted += tasksSubmitted;
  runUsageSummary.dataForSeoTotalCostUsd += costUsd;

  logInfo(
    `${label} DataForSEO usage recorded: ${httpRequests} HTTP request${httpRequests === 1 ? "" : "s"}, ${tasksSubmitted} task${tasksSubmitted === 1 ? "" : "s"}, $${costUsd.toFixed(6)}`,
  );
}

export function logRunSummary(): void {
  const elapsedMs = Number(process.hrtime.bigint() - RUN_STARTED_AT) / 1_000_000;
  const elapsedSeconds = elapsedMs / 1000;

  console.log("[RUN SUMMARY]");
  console.log(
    JSON.stringify(
      {
        elapsed_seconds: roundToThreeDecimals(elapsedSeconds),
        openai: {
          requests: runUsageSummary.openAiRequests,
          input_tokens: runUsageSummary.openAiInputTokens,
          cached_input_tokens: runUsageSummary.openAiCachedInputTokens,
          output_tokens: runUsageSummary.openAiOutputTokens,
          reasoning_tokens: runUsageSummary.openAiReasoningTokens,
          total_tokens: runUsageSummary.openAiTotalTokens,
        },
        dataforseo: {
          http_requests: runUsageSummary.dataForSeoHttpRequests,
          tasks_submitted: runUsageSummary.dataForSeoTasksSubmitted,
          total_cost_usd: roundToSixDecimals(
            runUsageSummary.dataForSeoTotalCostUsd,
          ),
        },
      },
      null,
      2,
    ),
  );
}

export function logHyperparameters(label: string, payload: unknown): void {
  if (!LOGGING_ENABLED || !HYPERPARAMETER_LOGGING_ENABLED) {
    return;
  }

  console.log(`[HYPERPARAMS] ${label}`);
  console.dir(payload, { depth: null });
}

export function logError(message: string, error?: unknown): void {
  console.error(`[ERROR] ${message}`);

  if (error !== undefined) {
    console.error(error);
  }
}

function recordOpenAiTokenUsage(usage: unknown): void {
  const usageRecord = asRecord(usage);

  if (usageRecord === null) {
    return;
  }

  runUsageSummary.openAiRequests += 1;
  runUsageSummary.openAiInputTokens += getNumber(usageRecord.input_tokens);
  runUsageSummary.openAiOutputTokens += getNumber(usageRecord.output_tokens);
  runUsageSummary.openAiTotalTokens += getNumber(usageRecord.total_tokens);

  const inputDetails = asRecord(usageRecord.input_tokens_details);
  const outputDetails = asRecord(usageRecord.output_tokens_details);

  runUsageSummary.openAiCachedInputTokens += getNumber(
    inputDetails?.cached_tokens,
  );
  runUsageSummary.openAiReasoningTokens += getNumber(
    outputDetails?.reasoning_tokens,
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function roundToThreeDecimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundToSixDecimals(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
