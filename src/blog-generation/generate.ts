import type { BlogGenerationInput, BlogGenerationResult } from "./types";
import { buildBlogGenerationPrompt } from "./prompt";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type BlogGenerationChecks = BlogGenerationResult["checks"];

export async function generateBlogMarkdown(
  input: BlogGenerationInput,
): Promise<BlogGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Add it to .env or export it in your terminal.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.55,
      messages: [
        {
          role: "system",
          content: "You are Tavyn's blog generation engine. Write human, specific, SEO-aware Markdown. Never use em dashes.",
        },
        {
          role: "user",
          content: buildBlogGenerationPrompt(input),
        },
      ],
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error(`OpenAI request failed with status ${response.status}:`);
    console.error(responseText);
    throw new Error(`OpenAI request failed with status ${response.status}.`);
  }

  const data = JSON.parse(responseText) as OpenAIChatResponse;
  const modelText = data.choices?.[0]?.message?.content;
  if (!modelText) {
    throw new Error("OpenAI response did not include choices[0].message.content.");
  }

  const strippedMarkdown = stripCodeFence(modelText);
  const markdown = containsEmDash(strippedMarkdown)
    ? strippedMarkdown.replace(/—/g, " - ")
    : strippedMarkdown;

  try {
    validateBlogMarkdown(markdown, input.technicalSeoBrief);
  } catch (error) {
    const validationError = error instanceof Error ? error : new Error(String(error));
    Object.defineProperty(validationError, "rawModelOutput", {
      value: modelText,
      enumerable: false,
    });
    throw validationError;
  }

  const checks = buildChecks(markdown, input.technicalSeoBrief);

  return {
    plannedItemId: getStringPath(input.technicalSeoBrief, ["plannedItemId"], "post_001"),
    title: getStringPath(input.technicalSeoBrief, ["onPageSeo", "h1"], "Untitled Blog Post"),
    slug: getStringPath(input.technicalSeoBrief, ["onPageSeo", "recommendedSlug"], "blog-post"),
    markdown,
    checks,
  };
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:md|markdown)?\s*\n([\s\S]*?)\n```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function estimateWordCount(markdown: string): number {
  const text = markdown
    .replace(/^---[\s\S]*?---/, " ")
    .replace(/[`#>*_[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function containsEmDash(markdown: string): boolean {
  return markdown.includes("—");
}

function includesPrimaryKeyword(markdown: string, technicalSeoBrief: any): boolean {
  const primaryKeyword = technicalSeoBrief?.searchTarget?.primaryKeyword;
  if (typeof primaryKeyword !== "string" || !primaryKeyword.trim()) return false;

  const normalizedMarkdown = normalizeForSearch(markdown);
  const normalizedKeyword = normalizeForSearch(primaryKeyword);
  if (normalizedMarkdown.includes(normalizedKeyword)) return true;

  const keywordTokens = normalizedKeyword.split(" ").filter((token) => token.length > 2);
  return keywordTokens.length > 0 && keywordTokens.every((token) => normalizedMarkdown.includes(token));
}

function includesFounderContext(markdown: string): boolean {
  const normalizedMarkdown = normalizeForSearch(markdown);
  const founderPhrases = [
    "three to six months",
    "3-6 months",
    "3 to 6 months",
    "founder control",
    "founder input",
    "email-native",
    "dashboard",
    "github",
  ];

  return founderPhrases.some((phrase) => normalizedMarkdown.includes(normalizeForSearch(phrase)));
}

function includesSoftProductTieIn(markdown: string): boolean {
  const normalizedMarkdown = normalizeForSearch(markdown);
  return (
    normalizedMarkdown.includes("tavyn") &&
    (
      normalizedMarkdown.includes("email-native") ||
      normalizedMarkdown.includes("github publishing") ||
      normalizedMarkdown.includes("serp") ||
      normalizedMarkdown.includes("approval")
    )
  );
}

function validateBlogMarkdown(markdown: string, technicalSeoBrief: unknown): void {
  const issues: string[] = [];
  const checks = buildChecks(markdown, technicalSeoBrief);
  const normalizedMarkdown = normalizeForSearch(markdown);

  if (!markdown.trim()) {
    issues.push("Markdown is empty.");
  }

  if (!markdown.trimStart().startsWith("---")) {
    issues.push("Markdown must start with YAML frontmatter using ---.");
  }

  if (!checks.hasNoEmDashes) {
    issues.push("Markdown must not contain em dashes.");
  }

  if (!checks.includesPrimaryKeyword) {
    issues.push("Markdown must include the primary keyword or a close phrase.");
  }

  if (checks.estimatedWordCount < 900) {
    issues.push(`Markdown must have at least 900 words. Found ${checks.estimatedWordCount}.`);
  }

  if (!checks.includesFounderContext) {
    issues.push("Markdown must include founder context.");
  }

  if (!checks.includesSoftProductTieIn) {
    issues.push("Markdown must include a soft Tavyn/product tie-in.");
  }

  for (const bannedPhrase of ["in today's digital landscape", "delve", "game-changer", "unlock"]) {
    if (normalizedMarkdown.includes(normalizeForSearch(bannedPhrase))) {
      issues.push(`Markdown must not include "${bannedPhrase}".`);
    }
  }

  if (issues.length > 0) {
    throw new Error(`Blog generation validation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  }
}

function buildChecks(markdown: string, technicalSeoBrief: unknown): BlogGenerationChecks {
  return {
    hasNoEmDashes: !containsEmDash(markdown),
    estimatedWordCount: estimateWordCount(markdown),
    includesPrimaryKeyword: includesPrimaryKeyword(markdown, technicalSeoBrief),
    includesFounderContext: includesFounderContext(markdown),
    includesSoftProductTieIn: includesSoftProductTieIn(markdown),
  };
}

function normalizeForSearch(value: string): string {
  return value.toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function getStringPath(value: unknown, path: string[], fallback: string): string {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return fallback;
    current = current[key];
  }

  return typeof current === "string" && current.trim() ? current : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
