const LOGGING_ENABLED = true;

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

export function logError(message: string, error?: unknown): void {
  console.error(`[ERROR] ${message}`);

  if (error !== undefined) {
    console.error(error);
  }
}
