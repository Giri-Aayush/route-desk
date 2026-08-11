// Server-side Anthropic client for the internal AI workspace. The model does the
// language work: reading a prospect's message into a structured requirement, and
// drafting a reply from a result. It never decides whether a route is supported -
// that stays with the rule engine and the live rhino.fi API.
//
// Everything here is gated on ANTHROPIC_API_KEY. With no key set, the AI features
// report themselves as unconfigured and the rest of the app is unaffected.

import Anthropic from "@anthropic-ai/sdk";

// Opus 5 by default. Override with ANTHROPIC_MODEL for a cheaper or faster tier
// (claude-sonnet-5, claude-haiku-4-5) on a high-volume desk.
export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("The AI workspace needs ANTHROPIC_API_KEY to be set.");
    this.name = "AiNotConfiguredError";
  }
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cached: Anthropic | null = null;

export function aiClient(): Anthropic {
  if (!isAiConfigured()) throw new AiNotConfiguredError();
  if (!cached) cached = new Anthropic();
  return cached;
}

// First text block of a response. When the model thinks, thinking blocks precede
// the text, so filter by type rather than reading content[0].
export function firstText(message: Anthropic.Message): string {
  for (const block of message.content) {
    if (block.type === "text") return block.text;
  }
  return "";
}
