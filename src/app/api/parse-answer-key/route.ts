import { extractAnswerKeyFromImage } from "@/lib/google-vision";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  imageUrl: z.string().url(),
});

export async function POST(request: Request) {
  console.log("[ParseAPI] Received parse request");
  
  try {
    const body = await request.json();
    console.log("[ParseAPI] Request body:", { imageUrl: body.imageUrl?.substring(0, 50) + "..." });
    
    const parsed = schema.parse(body);
    console.log("[ParseAPI] Extracting answer key from image using Gemini...");
    
    const answerKey = await extractAnswerKeyFromImage(parsed.imageUrl);
    console.log("[ParseAPI] Parsed answer key:", answerKey);

    if (Object.keys(answerKey).length === 0) {
      console.log("[ParseAPI] No answers detected");
      return NextResponse.json(
        { error: "No question-answer mappings detected. Try a clearer image." },
        { status: 400 },
      );
    }

    console.log("[ParseAPI] Success! Returning", Object.keys(answerKey).length, "answers");
    return NextResponse.json({ answerKey });
  } catch (error) {
    console.error("[ParseAPI] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
