// Shared configuration and the provider interface for the AI workspace. Two
// providers are supported: Anthropic (Claude) and any OpenAI-compatible endpoint,
// which covers NVIDIA NIMs (build.nvidia.com or self-hosted), OpenRouter, and
// similar. Pick with AI_PROVIDER. The model only ever does language, so the choice
// never affects a route's yes or no.

export type AiProviderName = "anthropic" | "nvidia";

export function aiProviderName(): AiProviderName {
  return process.env.AI_PROVIDER === "nvidia" ? "nvidia" : "anthropic";
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("The AI workspace is missing its API key.");
    this.name = "AiNotConfiguredError";
  }
}

// The active provider is configured when its key is present.
export function isAiConfigured(): boolean {
  return aiProviderName() === "nvidia"
    ? Boolean(process.env.AI_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY);
}

// What the intake, reply, and brief steps ask of whichever model is behind them.
export interface AiProvider {
  // Extract a JSON object matching the schema. The caller validates it further.
  extract(input: {
    system: string;
    user: string;
    schema: Record<string, unknown>;
    maxTokens: number;
  }): Promise<Record<string, unknown>>;
  // Generate prose.
  generate(input: {
    system: string;
    user: string;
    maxTokens: number;
  }): Promise<string>;
}

// Parse a model's JSON reply. Tolerates a markdown code fence, since some
// OpenAI-compatible endpoints wrap JSON even in object mode.
export function parseJson(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    const v: unknown = JSON.parse(cleaned);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
