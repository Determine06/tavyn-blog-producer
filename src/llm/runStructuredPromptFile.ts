import type { ZodType } from "zod";

import { loadPrompt } from "./loadPrompt.js";
import { runStructuredPrompt } from "./runStructuredPrompt.js";

export type RunStructuredPromptFileOptions<T> = {
  promptFileName: string;
  runtimeInput: string;
  schema: ZodType<T>;
  fallbackSchemaName: string;
};

export async function runStructuredPromptFile<T>(
  options: RunStructuredPromptFileOptions<T>,
): Promise<T> {
  const prompt = await loadPrompt(options.promptFileName);
  const input = prompt.inputInstructions.trim()
    ? `${prompt.inputInstructions.trim()}\n\n${options.runtimeInput}`
    : options.runtimeInput;

  return runStructuredPrompt<T>({
    model: prompt.config.model,
    developerPrompt: prompt.developerInstructions,
    input,
    schemaName: prompt.config.schemaName ?? options.fallbackSchemaName,
    schema: options.schema,
    temperature: prompt.config.temperature,
    maxOutputTokens: prompt.config.maxOutputTokens,
    reasoningEffort: prompt.config.reasoningEffort,
  });
}
