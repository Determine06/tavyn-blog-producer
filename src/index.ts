// Temporary smoke test for env, logger, OpenAI client, and runPrompt. Replace when pipeline work starts.

import { env } from "./config/env.js";
import { logError, logInfo, logSuccess } from "./lib/logger.js";
import { openai } from "./llm/openaiClient.js";
import { runPrompt } from "./llm/runPrompt.js";

async function main(): Promise<void> {
  try {
    logSuccess("Environment validation passed");
    logInfo(`OpenAI API key loaded: ${env.OPENAI_API_KEY.length > 0}`);
    logInfo(`Firecrawl API key loaded: ${env.FIRECRAWL_API_KEY.length > 0}`);
    logInfo(`OpenAI client exists: ${openai !== undefined}`);

    const output = await runPrompt({
      model: "gpt-4.1-mini",
      temperature: 0,
      developerPrompt:
        "You are a test assistant. Reply with one short friendly sentence.",
      input: "Say hi and confirm the Tavyn local LLM setup works.",
      maxOutputTokens: 100,
    });

    logInfo(`Model output: ${output}`);
  } catch (error) {
    logError("Smoke test failed", error);
    process.exitCode = 1;
  }
}

await main();
