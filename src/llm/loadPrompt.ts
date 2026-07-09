import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type PromptReasoningEffort = "minimal" | "low" | "medium" | "high";

export type LoadedPrompt = {
  config: {
    promptName: string;
    promptVersion?: string;
    outputMode?: string;
    schemaName?: string;
    model: string;
    reasoningEffort?: PromptReasoningEffort;
    temperature?: number;
    maxOutputTokens?: number;
  };
  developerInstructions: string;
  inputInstructions: string;
  rawBody: string;
};

export async function loadPrompt(
  relativePromptPath: string,
): Promise<LoadedPrompt> {
  const promptPath = path.join(__dirname, "..", "prompts", relativePromptPath);
  const fileContents = await readFile(promptPath, "utf8");
  const { frontmatter, body } = splitFrontmatter(fileContents);
  const config = parsePromptConfig(frontmatter);
  const { developerInstructions, inputInstructions } =
    splitPromptInstructions(body);

  return {
    config,
    developerInstructions,
    inputInstructions,
    rawBody: body,
  };
}

function splitFrontmatter(fileContents: string): {
  frontmatter: string;
  body: string;
} {
  if (!fileContents.startsWith("---\n")) {
    throw new Error("Prompt file is missing required frontmatter.");
  }

  const closingMarkerIndex = fileContents.indexOf("\n---", 4);
  if (closingMarkerIndex === -1) {
    throw new Error("Prompt file frontmatter is missing closing marker.");
  }

  return {
    frontmatter: fileContents.slice(4, closingMarkerIndex),
    body: fileContents.slice(closingMarkerIndex + 4).trimStart(),
  };
}

function parsePromptConfig(frontmatter: string): LoadedPrompt["config"] {
  const values = new Map<string, string>();

  for (const line of frontmatter.split("\n")) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();
    values.set(key, value);
  }

  const promptName = values.get("prompt_name");
  const model = values.get("model");

  if (!promptName) {
    throw new Error("Prompt frontmatter is missing required prompt_name.");
  }

  if (!model) {
    throw new Error("Prompt frontmatter is missing required model.");
  }

  const reasoningEffort = values.get("reasoning_effort");

  return {
    promptName,
    promptVersion: values.get("prompt_version"),
    outputMode: values.get("output_mode"),
    schemaName: values.get("schema_name"),
    model,
    reasoningEffort: isPromptReasoningEffort(reasoningEffort)
      ? reasoningEffort
      : undefined,
    temperature: parseOptionalNumber(values.get("temperature")),
    maxOutputTokens: parseOptionalNumber(values.get("max_output_tokens")),
  };
}

function splitPromptInstructions(body: string): {
  developerInstructions: string;
  inputInstructions: string;
} {
  const inputHeading = "# Input Instructions";
  const inputHeadingIndex = body.indexOf(inputHeading);
  const rawDeveloperInstructions =
    inputHeadingIndex === -1 ? body : body.slice(0, inputHeadingIndex);
  const inputInstructions =
    inputHeadingIndex === -1
      ? ""
      : body.slice(inputHeadingIndex + inputHeading.length).trim();

  return {
    developerInstructions: rawDeveloperInstructions
      .replace(/^# Developer Instructions\s*/, "")
      .trim(),
    inputInstructions,
  };
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsedValue = Number(value);
  return Number.isNaN(parsedValue) ? undefined : parsedValue;
}

function isPromptReasoningEffort(
  value: string | undefined,
): value is PromptReasoningEffort {
  return (
    value === "minimal" ||
    value === "low" ||
    value === "medium" ||
    value === "high"
  );
}
