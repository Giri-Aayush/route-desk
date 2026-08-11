// Picks the AI provider from AI_PROVIDER. The intake, reply, and brief steps depend
// only on this, so switching providers never touches the rest of the app.

import { aiProviderName, type AiProvider } from "./client";
import { anthropicProvider } from "./provider-anthropic";
import { openAiProvider } from "./provider-openai";

export function getProvider(): AiProvider {
  return aiProviderName() === "nvidia" ? openAiProvider() : anthropicProvider();
}
