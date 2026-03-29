import { extractAnswerKeyFromBuffer, extractAnswerKeyFromImage } from "@/lib/google-vision";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  console.log("[ParseAPI] Received parse request");
  
  try {
    const contentType = request.headers.get("content-type") ?? "";

    let answerKey;

    if (contentType.includes("multipart/form-data")) {
      // File upload flow (new v2 flow)
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || "image/png";
      console.log("[ParseAPI] Extracting answer key from uploaded file using Gemini...");
      answerKey = await extractAnswerKeyFromBuffer(buffer, mimeType);
    } else {
      // JSON flow (legacy — accepts imageUrl)
      const body = await request.json();
      const imageUrl = body.imageUrl;

      if (!imageUrl || typeof imageUrl !== "string") {
        return NextResponse.json({ error: "No imageUrl provided" }, { status: 400 });
      }

      console.log("[ParseAPI] Extracting answer key from URL using Gemini...");
      answerKey = await extractAnswerKeyFromImage(imageUrl);
    }

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
