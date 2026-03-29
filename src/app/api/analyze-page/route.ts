import { requireUser } from "@/lib/auth";
import { analyzePageContent } from "@/lib/google-vision";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    await requireUser();

    const formData = await request.formData();
    const pageFile = formData.get("page") as File | null;
    const pageNumberStr = formData.get("pageNumber") as string | null;

    if (!pageFile || !pageNumberStr) {
      return NextResponse.json(
        { error: "Missing page image or page number" },
        { status: 400 },
      );
    }

    const pageNumber = parseInt(pageNumberStr, 10);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      return NextResponse.json(
        { error: "Invalid page number" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await pageFile.arrayBuffer());
    const imageBase64 = buffer.toString("base64");
    const mimeType = pageFile.type || "image/png";

    const analysis = await analyzePageContent(imageBase64, mimeType, pageNumber);

    return NextResponse.json({ analysis });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze page";
    console.error("[analyze-page]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
