import OpenAI from "openai";

import { env } from "../config/env.js";

export function createOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
}

// The OpenAI client is reused across requests. The model, temperature,
// developer instructions, and user input are chosen per request in runPrompt.ts.
export const openai = createOpenAIClient();
