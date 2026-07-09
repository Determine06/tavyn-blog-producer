const LOGGING_ENABLED = true;
const HYPERPARAMETER_LOGGING_ENABLED =
  process.env.LOG_HYPERPARAMETERS === "true";

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
