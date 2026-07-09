import { zodTextFormat } from "openai/helpers/zod";

import {
  logError,
  logHyperparameters,
  logInfo,
  logStep,
  logSuccess,
  logTokenUsage,
} from "../lib/logger.js";
import { loadPrompt } from "./loadPrompt.js";
import { openai } from "./openaiClient.js";

export type RunStructuredPromptOptions<T> = {
  model: string;
  developerPrompt: string;
  input: string;
  schemaName: string;
  schema: any;
  temperature?: number;
  maxOutputTokens?: number;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
};

export async function runStructuredPrompt<T>(
  options: RunStructuredPromptOptions<T>,
): Promise<T> {
  try {
    const universalDevPrompt = await loadPrompt("universal-dev.md");
    const combinedDeveloperPrompt = `${universalDevPrompt.developerInstructions.trim()}\n\n${options.developerPrompt.trim()}`;

    logStep("Running OpenAI structured prompt");
    logInfo(`Model: ${options.model}`);
    logInfo(`Schema: ${options.schemaName}`);

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
      text: {
        format: zodTextFormat(options.schema, options.schemaName),
      },
      ...(options.temperature !== undefined &&
      !modelUsesFixedTemperature(options.model)
        ? { temperature: options.temperature }
        : {}),
      ...(options.maxOutputTokens !== undefined
        ? { max_output_tokens: options.maxOutputTokens }
        : {}),
      ...(options.reasoningEffort !== undefined
        ? { reasoning: { effort: options.reasoningEffort } }
        : {}),
    };

    logHyperparameters("OpenAI structured prompt request", request);

    const response = await openai.responses.parse(request);

    logTokenUsage("OpenAI structured prompt", response.usage);

    if (response.output_parsed === null) {
      throw new Error(
        `OpenAI structured response did not include parsed output for ${options.schemaName}.`,
      );
    }

    logSuccess("OpenAI structured prompt completed");

    return response.output_parsed as T;
  } catch (error) {
    logError("OpenAI structured request failed", error);
    throw error;
  }
}

function modelUsesFixedTemperature(model: string): boolean {
  return model.startsWith("gpt-5");
}
