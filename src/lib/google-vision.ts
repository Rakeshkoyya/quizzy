import { AnswerKeyMap, AnswerOption } from "./exam";

const GEMINI_PROMPT = `Detect the question numbers and their answer options (a, b, c, or d) from the given image.
The image contains an answer key with questions numbered from 1 to 200 (or less) with their correct answers.
The format in the image might be like: "1. (a)  2. (b)  3. (c)  4. (d)" etc.

Extract ALL question-answer pairs and return them as a JSON object where:
- Keys are the question numbers (as strings)
- Values are the answer options in UPPERCASE (A, B, C, or D)

Return the JSON wrapped inside XML tags like this:
<pairs>{"1":"A","2":"B","3":"C","4":"D"}</pairs>

Important:
- Be thorough and extract ALL questions visible in the image
- Convert lowercase answers (a,b,c,d) to uppercase (A,B,C,D)
- Only return valid answers (A, B, C, or D)
- The output must be valid JSON inside the <pairs> tags`;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

function parseXmlPairs(response: string): AnswerKeyMap {
  // Extract JSON from <pairs>...</pairs> tags
  const match = response.match(/<pairs>\s*([\s\S]*?)\s*<\/pairs>/i);
  
  if (!match || !match[1]) {
    console.error("[Gemini] Could not find <pairs> tags in response:", response);
    throw new Error("Failed to parse answer key: No <pairs> tags found in response");
  }

  const jsonString = match[1].trim();
  
  try {
    const parsed = JSON.parse(jsonString) as Record<string, string>;
    const result: AnswerKeyMap = {};
    
    for (const [key, value] of Object.entries(parsed)) {
      const questionNumber = Number(key);
      const answer = value?.toUpperCase?.();
      
      if (
        Number.isInteger(questionNumber) &&
        questionNumber > 0 &&
        (answer === "A" || answer === "B" || answer === "C" || answer === "D")
      ) {
        result[questionNumber] = answer as AnswerOption;
      }
    }
    
    return result;
  } catch (e) {
    console.error("[Gemini] Failed to parse JSON:", jsonString);
    throw new Error(`Failed to parse answer key JSON: ${e instanceof Error ? e.message : "Unknown error"}`);
  }
}

export async function extractAnswerKeyFromImage(imageUrl: string): Promise<AnswerKeyMap> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // Fetch the image and convert to base64
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("Unable to fetch uploaded image");
  }

  const imageArrayBuffer = await imageResponse.arrayBuffer();
  const imageBase64 = Buffer.from(imageArrayBuffer).toString("base64");
  
  // Determine mime type from URL or default to jpeg
  const mimeType = imageUrl.includes(".png") ? "image/png" : "image/jpeg";

  // Call Gemini API with multimodal request
  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                },
              },
              {
                text: GEMINI_PROMPT,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!geminiResponse.ok) {
    const message = await geminiResponse.text();
    console.error("[Gemini] API error:", message);
    throw new Error(`Gemini API failed: ${message}`);
  }

  const payload = (await geminiResponse.json()) as GeminiResponse;

  if (payload.error) {
    throw new Error(`Gemini API error: ${payload.error.message}`);
  }

  const responseText = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  
  console.log("[Gemini] Raw response:", responseText);

  if (!responseText) {
    throw new Error("Gemini returned empty response");
  }

  return parseXmlPairs(responseText);
}

// Keep the old function for backward compatibility if needed
export async function extractTextFromImageUrl(imageUrl: string): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_CLOUD_API_KEY is not configured");
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("Unable to fetch uploaded image");
  }

  const imageArrayBuffer = await imageResponse.arrayBuffer();
  const imageBase64 = Buffer.from(imageArrayBuffer).toString("base64");

  const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBase64 },
          features: [{ type: "TEXT_DETECTION" }],
        },
      ],
    }),
  });

  if (!visionResponse.ok) {
    const message = await visionResponse.text();
    throw new Error(`Vision API failed: ${message}`);
  }

  const payload = (await visionResponse.json()) as {
    responses?: Array<{ fullTextAnnotation?: { text?: string } }>;
  };

  return payload.responses?.[0]?.fullTextAnnotation?.text ?? "";
}
