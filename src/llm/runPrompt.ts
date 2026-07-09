import {
  logError,
  logStep,
  logSuccess,
  logTokenUsage,
} from "../lib/logger.js";
import { loadPrompt } from "./loadPrompt.js";
import { openai } from "./openaiClient.js";

export type RunPromptOptions = {
  model: string;
  developerPrompt: string;
  input: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export async function runPrompt(options: RunPromptOptions): Promise<string> {
  try {
    const universalDevPrompt = await loadPrompt("universal-dev.md");
    const combinedDeveloperPrompt = `${universalDevPrompt.developerInstructions.trim()}\n\n${options.developerPrompt.trim()}`;
    const request = {
      model: options.model,
      input: [
        {
          role: "developer" as const,
          content: combinedDeveloperPrompt,
        },
        {
          role: "user" as const,
          content: options.input,
        },
      ],
      ...(options.temperature !== undefined
        ? { temperature: options.temperature }
        : {}),
      ...(options.maxOutputTokens !== undefined
        ? { max_output_tokens: options.maxOutputTokens }
        : {}),
    };

    logStep(`Running OpenAI prompt with model ${options.model}`);

    const response = await openai.responses.create(request);
    logTokenUsage("OpenAI runPrompt", response.usage);

    const outputText = response.output_text;

    if (!outputText) {
      throw new Error("OpenAI response did not include output text.");
    }

    logSuccess("OpenAI prompt completed");

    return outputText;
  } catch (error) {
    logError("OpenAI request failed", error);
    throw error;
  }
}
