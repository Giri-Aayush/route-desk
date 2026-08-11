// OpenAI-compatible provider. Talks to any /chat/completions endpoint: an NVIDIA NIM
// on build.nvidia.com, a self-hosted NIM, OpenRouter, and so on. Extraction asks for
// JSON object mode with the schema in the prompt; we validate the result against the
// live catalog regardless, so a loose model cannot slip an unknown chain through.

import { AiNotConfiguredError, parseJson, type AiProvider } from "./client";

// NVIDIA's hosted endpoint by default. Point AI_BASE_URL at a self-hosted NIM or
// another OpenAI-compatible server to run the model wherever you host it.
const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

export function openAiProvider(): AiProvider {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();
  const baseUrl = (process.env.AI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL;

  async function chat(input: {
    system: string;
    user: string;
    maxTokens: number;
    temperature: number;
    json: boolean;
  }): Promise<string> {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens,
        temperature: input.temperature,
        ...(input.json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`AI provider returned ${res.status}`);
    }
    const data = (await res.json()) as ChatResponse;
    return data.choices?.[0]?.message?.content ?? "";
  }

  return {
    async extract({ system, user, schema, maxTokens }) {
      const withSchema = `${system}

Respond with a single JSON object that matches this schema exactly. Output only the JSON, with no surrounding prose or code fences.
${JSON.stringify(schema)}`;
      return parseJson(
        await chat({
          system: withSchema,
          user,
          maxTokens,
          temperature: 0.2,
          json: true,
        }),
      );
    },
    async generate({ system, user, maxTokens }) {
      const text = await chat({
        system,
        user,
        maxTokens,
        temperature: 0.6,
        json: false,
      });
      return text.trim();
    },
  };
}
