import { createInterface } from "node:readline/promises";

type WebsitePrompt = () => Promise<string>;

export async function resolvePipelineArgs(
  argv: string[],
  promptForWebsite: WebsitePrompt = promptForWebsiteUrl,
): Promise<string[]> {
  if (argv.length > 0) {
    return argv;
  }

  const websiteUrl = (await promptForWebsite()).trim();

  if (websiteUrl.length === 0) {
    throw new Error("Website URL is required.");
  }

  return [
    websiteUrl,
    "--artifact-root",
    "artifacts",
    "--cache",
    "--stop-after",
    "company-report",
    "--save-to-supabase",
  ];
}

async function promptForWebsiteUrl(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Website URL is required when npm run dev is not attached to an interactive terminal.",
    );
  }

  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await prompt.question("Website URL: ");
  } finally {
    prompt.close();
  }
}
