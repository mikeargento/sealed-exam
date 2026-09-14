// Copyright (c) Argento Computing Inc. All rights reserved. See LICENSE.

/**
 * One request per question, to the model's own API, with the user's own key
 * from the environment. What is recorded per question is the request body
 * (no headers, no key) and the provider's response body, verbatim.
 *
 * Temperature 0 where the provider allows it. Anthropic's 4.7+ models and
 * OpenAI's reasoning models reject sampling parameters; those get none.
 */
import type Anthropic from "@anthropic-ai/sdk";

export type ProviderId = "anthropic" | "openai" | "google" | "openrouter";
export const PROVIDERS: readonly ProviderId[] = ["anthropic", "openai", "google", "openrouter"];

export interface Reply {
  /** The model's visible text, all text blocks joined. */
  text: string;
  /** The version string the provider reported for the model, if any. */
  reportedVersion: string | null;
  /** The request body as sent, minus credentials. */
  request: unknown;
  /** The response body as received. */
  response: unknown;
  /** True when the provider reported a refusal or a truncated reply. */
  incomplete: boolean;
}

export interface Provider {
  id: ProviderId;
  envKey: string;
  ask(model: string, system: string, prompt: string): Promise<Reply>;
}

const NO_SAMPLING_ANTHROPIC = /(opus-5|opus-4-[78]|sonnet-5|fable|mythos)/;
const NO_SAMPLING_OPENAI = /^(o\d|gpt-[5-9])/;

function requireKey(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set; the exam asks the model with your own key from the environment`);
  return v;
}

/**
 * One POST, with a wait on a rate limit.
 *
 * A sitting is twenty requests in a row, and a free-tier key answers the
 * sixth of them with 429 (Gemini, 2026-09-13: the first ask failed and the
 * paper's two positions were spent for nothing). A 429 or 503 is waited out,
 * for the delay the provider names when it names one, and asked again, up to
 * five times. Any other refusal is the model's answer and is not retried.
 */
async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(600_000) });
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (res.ok) return json;
    if ((res.status === 429 || res.status === 503) && attempt < 6) {
      const named = retryAfterSeconds(res.headers.get("retry-after"), text);
      const wait = Math.min(120, Math.max(5, named ?? 15 * attempt));
      process.stderr.write(`  ${res.status} from the provider; waiting ${wait}s (attempt ${attempt} of 5)\n`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`${url} answered ${res.status}: ${text.slice(0, 300)}`);
  }
}

/** The wait a provider names: a Retry-After header, or Google's retryDelay ("23s") in the body. */
function retryAfterSeconds(header: string | null, body: string): number | null {
  if (header !== null && /^\d+$/.test(header.trim())) return Number(header.trim());
  const m = /"retryDelay"\s*:\s*"(\d+)(?:\.\d+)?s"/.exec(body);
  return m ? Number(m[1]) + 1 : null;
}

export const anthropic: Provider = {
  id: "anthropic",
  envKey: "ANTHROPIC_API_KEY",
  async ask(model, system, prompt) {
    requireKey(this.envKey);
    // Loaded here, not at module top: a verifier that imports the CLI must not need a provider SDK.
    const { default: AnthropicClient } = await import("@anthropic-ai/sdk");
    const client = new AnthropicClient();
    const request: Anthropic.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: prompt }],
      ...(NO_SAMPLING_ANTHROPIC.test(model) ? {} : { temperature: 0 }),
    };
    const response = await client.messages.create(request);
    const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
    return { text, reportedVersion: response.model, request, response, incomplete: response.stop_reason === "refusal" || response.stop_reason === "max_tokens" };
  },
};

function openaiShaped(id: ProviderId, envKey: string, url: string, extraHeaders: () => Record<string, string>): Provider {
  return {
    id,
    envKey,
    async ask(model, system, prompt) {
      const key = requireKey(envKey);
      const request = {
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        ...(id === "openai" && NO_SAMPLING_OPENAI.test(model) ? {} : { temperature: 0 }),
      };
      const response = (await postJson(url, { Authorization: `Bearer ${key}`, ...extraHeaders() }, request)) as { model?: string; choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }> };
      const choice = response.choices?.[0];
      return { text: choice?.message?.content ?? "", reportedVersion: response.model ?? null, request, response, incomplete: choice?.finish_reason === "length" || choice?.finish_reason === "content_filter" };
    },
  };
}

export const openai = openaiShaped("openai", "OPENAI_API_KEY", "https://api.openai.com/v1/chat/completions", () => ({}));
export const openrouter = openaiShaped("openrouter", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1/chat/completions", () => ({ "HTTP-Referer": "https://bitgraph.ing", "X-Title": "sealed exam" }));

export const google: Provider = {
  id: "google",
  envKey: "GOOGLE_API_KEY",
  async ask(model, system, prompt) {
    const key = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GOOGLE_API_KEY (or GEMINI_API_KEY) is not set; the exam asks the model with your own key from the environment");
    const request = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0 },
    };
    const response = (await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { "x-goog-api-key": key }, request)) as { modelVersion?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }> };
    const c = response.candidates?.[0];
    const text = (c?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    return { text, reportedVersion: response.modelVersion ?? null, request, response, incomplete: c?.finishReason !== undefined && c.finishReason !== "STOP" };
  },
};

export function providerById(id: string): Provider {
  switch (id) {
    case "anthropic": return anthropic;
    case "openai": return openai;
    case "google": return google;
    case "openrouter": return openrouter;
    default: throw new Error(`unknown provider "${id}"; one of ${PROVIDERS.join(", ")}`);
  }
}
