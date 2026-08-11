// Anthropic (Claude) provider. Uses the SDK's structured outputs for the extraction
// and adaptive thinking at a low effort, which keeps the language work snappy.

import Anthropic from "@anthropic-ai/sdk";
import { AiNotConfiguredError, parseJson, type AiProvider } from "./client";

function firstText(message: Anthropic.Message): string {
  for (const block of message.content) {
    if (block.type === "text") return block.text;
  }
  return "";
}

export function anthropicProvider(): AiProvider {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiNotConfiguredError();
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

  return {
    async extract({ system, user, schema, maxTokens }) {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        output_config: {
          format: { type: "json_schema", schema },
          effort: "low",
        },
        system,
        messages: [{ role: "user", content: user }],
      });
      return parseJson(firstText(response));
    },
    async generate({ system, user, maxTokens }) {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        output_config: { effort: "medium" },
        system,
        messages: [{ role: "user", content: user }],
      });
      return firstText(response).trim();
    },
  };
}
