import { AnswerKeyMap, AnswerOption } from "./exam";
import { callOpenRouter } from "./openrouter";
import type { QuestionBoundary } from "@/types/exam";

const GEMINI_PROMPT = `Detect the question numbers and their answer options (a, b, c, or d) from the given image.
The image contains an answer key with questions numbered from 1 to 200 (or less) with their correct answers.
The format in the image might be like: "1. (a)  2. (b)  3. (c)  4. (d)" etc.
Or the answers might be numbered options: "1. (1)  2. (2)  3. (3)  4. (4)" where 1=A, 2=B, 3=C, 4=D.

Extract ALL question-answer pairs and return them as a JSON object where:
- Keys are the question numbers (as strings)
- Values are the answer options in UPPERCASE (A, B, C, or D)
- If the image uses numbered options (1,2,3,4), convert them: 1=A, 2=B, 3=C, 4=D

Return the JSON wrapped inside XML tags like this:
<pairs>{"1":"A","2":"B","3":"C","4":"D"}</pairs>

Important:
- Be thorough and extract ALL questions visible in the image
- Convert lowercase answers (a,b,c,d) to uppercase (A,B,C,D)
- Convert numbered answers (1,2,3,4) to letters (A,B,C,D)
- Only return valid answers (A, B, C, or D)
- The output must be valid JSON inside the <pairs> tags`;

// GeminiResponse kept for backward-compat with Vision API
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
    
    const numToLetter: Record<string, AnswerOption> = { "1": "A", "2": "B", "3": "C", "4": "D" };

    for (const [key, value] of Object.entries(parsed)) {
      const questionNumber = Number(key);
      if (!Number.isInteger(questionNumber) || questionNumber <= 0) continue;

      const raw = value?.trim?.();
      if (!raw) continue;

      // Handle comma-separated multi-answers (e.g. "2,3")
      const parts = raw.split(",").map((p: string) => p.trim());
      const mapped = parts.map((p: string) => {
        const upper = p.toUpperCase();
        if (upper === "A" || upper === "B" || upper === "C" || upper === "D") return upper;
        return numToLetter[p] ?? null;
      }).filter(Boolean) as AnswerOption[];

      if (mapped.length === 1) {
        result[questionNumber] = mapped[0];
      } else if (mapped.length > 1) {
        // Store first valid option for single-answer fields
        result[questionNumber] = mapped[0];
      }
    }
    
    return result;
  } catch (e) {
    console.error("[Gemini] Failed to parse JSON:", jsonString);
    throw new Error(`Failed to parse answer key JSON: ${e instanceof Error ? e.message : "Unknown error"}`);
  }
}

export async function extractAnswerKeyFromImage(imageUrl: string): Promise<AnswerKeyMap> {
  // Fetch the image and convert to base64
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("Unable to fetch uploaded image");
  }

  const imageArrayBuffer = await imageResponse.arrayBuffer();
  const imageBase64 = Buffer.from(imageArrayBuffer).toString("base64");
  
  // Determine mime type from URL or default to jpeg
  const mimeType = imageUrl.includes(".png") ? "image/png" : "image/jpeg";

  return callGeminiForAnswerKey(imageBase64, mimeType);
}

/**
 * Extract answer key from a raw image buffer (used when image is uploaded directly)
 */
export async function extractAnswerKeyFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<AnswerKeyMap> {
  const imageBase64 = buffer.toString("base64");
  return callGeminiForAnswerKey(imageBase64, mimeType);
}

async function callGeminiForAnswerKey(imageBase64: string, mimeType: string): Promise<AnswerKeyMap> {
  const responseText = await callOpenRouter(GEMINI_PROMPT, {
    imageBase64,
    mimeType,
    maxTokens: 8192,
  });

  console.log("[AnswerKey] Raw response:", responseText);
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

// ── Gemini-based per-page analysis ──

import type { PageAnalysisResult } from "@/types/exam";

const PAGE_ANALYSIS_PROMPT = `Analyze this single page from an exam/test paper. Determine:

1. **Page Classification**:
   - "introduction" — title page, instructions, general information, headers, or any page with NO exam questions
   - "questions" — contains numbered exam questions (MCQ or otherwise) WITHOUT solutions/answers
   - "questions_with_solutions" — contains questions AND their correct answers/solutions shown on the same page

2. **Questions** (if any):
   For each question found, provide its bounding box as FRACTIONS of the page dimensions (0.0 to 1.0):
   - questionNumber: the question number (integer)
   - xStart/xEnd: horizontal bounds (fraction of page width)
   - yStart/yEnd: vertical bounds (fraction of page height, 0.0 = top, 1.0 = bottom)

3. **Solutions/Answers** (if this page contains answer keys or solutions):
   Extract question number → correct answer (A/B/C/D) mapping

Return the result as JSON inside XML tags:
<analysis>
{
  "pageType": "introduction",
  "questions": [],
  "solutions": null
}
</analysis>

Example for a page with questions:
<analysis>
{
  "pageType": "questions",
  "questions": [
    {"questionNumber": 1, "xStart": 0.05, "xEnd": 0.95, "yStart": 0.08, "yEnd": 0.30},
    {"questionNumber": 2, "xStart": 0.05, "xEnd": 0.95, "yStart": 0.30, "yEnd": 0.55}
  ],
  "solutions": null
}
</analysis>

Example for a page with solutions:
<analysis>
{
  "pageType": "questions_with_solutions",
  "questions": [
    {"questionNumber": 15, "xStart": 0.05, "xEnd": 0.95, "yStart": 0.05, "yEnd": 0.30}
  ],
  "solutions": {"15": "A", "16": "B", "17": "C"}
}
</analysis>

Important:
- All coordinates are fractions between 0.0 and 1.0
- Questions may be numbered as: 1, 2, 3 or 1., 2., 3. or Q1, Q2 or (1), (2) etc.
- Questions include their options/choices (A, B, C, D) and any diagrams
- Questions may be in single or multiple columns — detect the actual layout
- If a question has a diagram/figure, include it in the bounding box
- xStart/xEnd should reflect column layout (half page for 2-column)
- Return pageType "introduction" with empty questions array for non-question pages
- If solutions are present (answer key, correct answers marked), extract them into the solutions field`;

interface AnalyzedQuestion {
  questionNumber: number;
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
  subject?: string;
  section?: string;
}

interface PageAnalysisResponse {
  pageType: string;
  subject: string | null;
  section: string | null;
  questions: AnalyzedQuestion[];
  solutions: Record<string, string> | null;
}

/**
 * Analyze a single page image with Gemini.
 * Returns page classification, questions, solutions, and section info.
 */
export async function analyzePageContent(
  imageBase64: string,
  mimeType: string,
  pageNumber: number,
): Promise<PageAnalysisResult> {
  let text: string;
  try {
    text = await callOpenRouter(PAGE_ANALYSIS_PROMPT, {
      imageBase64,
      mimeType,
      maxTokens: 16384,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Page ${pageNumber}] API error:`, message);
    throw new Error(`API failed for page ${pageNumber}: ${message}`);
  }

  console.log(`[Page ${pageNumber}] Response length: ${text.length}`);

  // Parse <analysis> tags, fallback to JSON block
  let jsonString: string | null = null;
  const tagMatch = text.match(/<analysis>\s*([\s\S]*?)\s*<\/analysis>/i);
  if (tagMatch?.[1]) {
    jsonString = tagMatch[1].trim();
  } else {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch?.[1]) {
      jsonString = fenceMatch[1].trim();
    } else {
      const objMatch = text.match(/(\{[\s\S]*\})/);
      if (objMatch?.[1]) {
        jsonString = objMatch[1].trim();
      }
    }
  }

  if (!jsonString) {
    console.warn(`[Page ${pageNumber}] No JSON found, treating as introduction`);
    return {
      pageNumber,
      pageType: "introduction",
      subject: null,
      section: null,
      questions: [],
      solutions: null,
    };
  }

  try {
    const parsed = JSON.parse(jsonString) as PageAnalysisResponse;

    const validPageTypes = ["introduction", "questions", "questions_with_solutions"];
    const pageType = validPageTypes.includes(parsed.pageType)
      ? (parsed.pageType as PageAnalysisResult["pageType"])
      : "introduction";

    const questions: QuestionBoundary[] = (parsed.questions ?? [])
      .filter(
        (q) =>
          Number.isInteger(q.questionNumber) &&
          q.questionNumber > 0 &&
          typeof q.xStart === "number" &&
          typeof q.xEnd === "number" &&
          typeof q.yStart === "number" &&
          typeof q.yEnd === "number" &&
          q.xEnd > q.xStart &&
          q.yEnd > q.yStart,
      )
      .map((q) => ({
        pageNumber,
        questionNumber: q.questionNumber,
        xStartFraction: Math.max(0, Math.min(1, q.xStart)),
        xEndFraction: Math.max(0, Math.min(1, q.xEnd)),
        yStartFraction: Math.max(0, Math.min(1, q.yStart)),
        yEndFraction: Math.max(0, Math.min(1, q.yEnd)),
      }));

    // Validate solutions
    let solutions: Record<string, string> | null = null;
    if (parsed.solutions && typeof parsed.solutions === "object") {
      solutions = {};
      for (const [key, value] of Object.entries(parsed.solutions)) {
        const qNum = Number(key);
        const answer = String(value).toUpperCase();
        if (Number.isInteger(qNum) && qNum > 0 && ["A", "B", "C", "D"].includes(answer)) {
          solutions[String(qNum)] = answer;
        }
      }
      if (Object.keys(solutions).length === 0) solutions = null;
    }

    return {
      pageNumber,
      pageType,
      subject: parsed.subject ?? null,
      section: parsed.section ?? null,
      questions,
      solutions,
    };
  } catch (e) {
    console.error(`[Page ${pageNumber}] Failed to parse JSON:`, e);
    return {
      pageNumber,
      pageType: "introduction",
      subject: null,
      section: null,
      questions: [],
      solutions: null,
    };
  }
}
