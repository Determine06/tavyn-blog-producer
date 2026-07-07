import "dotenv/config";

const requiredEnvVars = ["OPENAI_API_KEY", "FIRECRAWL_API_KEY"] as const;

type RequiredEnvVar = (typeof requiredEnvVars)[number];

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
}

export const env: Record<RequiredEnvVar, string> = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY as string,
  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY as string,
};
