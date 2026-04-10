// ── Shared OpenRouter API helper ──

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_MODEL = "google/gemini-2.5-flash";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

function getApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  return apiKey;
}

/**
 * Call OpenRouter with a prompt and optional base64 image/PDF.
 * Returns the text content of the first choice.
 */
export async function callOpenRouter(
  prompt: string,
  opts?: {
    imageBase64?: string;
    mimeType?: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<string> {
  const apiKey = getApiKey();

  const contentParts: Array<Record<string, unknown>> = [];

  if (opts?.imageBase64 && opts.mimeType) {
    contentParts.push({
      type: "image_url",
      image_url: {
        url: `data:${opts.mimeType};base64,${opts.imageBase64}`,
      },
    });
  }

  contentParts.push({ type: "text", text: prompt });

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "user",
          content: contentParts,
        },
      ],
      temperature: opts?.temperature ?? 0.1,
      max_tokens: opts?.maxTokens ?? 16384,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    console.error("[OpenRouter] API error:", message);
    throw new Error(`OpenRouter API failed: ${message}`);
  }

  const payload = (await response.json()) as OpenRouterResponse;

  if (payload.error) {
    throw new Error(`OpenRouter API error: ${payload.error.message}`);
  }

  const text = payload.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenRouter returned empty response");

  return text;
}

/**
 * Call OpenRouter with full message array and stream the response.
 * Returns a ReadableStream of text chunks.
 */
export async function callOpenRouterStream(
  messages: OpenRouterMessage[],
  opts?: {
    temperature?: number;
    maxTokens?: number;
  },
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = getApiKey();

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      temperature: opts?.temperature ?? 0.3,
      max_tokens: opts?.maxTokens ?? 4096,
      stream: true,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    console.error("[OpenRouter] API error:", message);
    throw new Error(`OpenRouter API failed: ${message}`);
  }

  if (!response.body) {
    throw new Error("OpenRouter returned no stream body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}
