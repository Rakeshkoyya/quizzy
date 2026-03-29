import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/supabase-storage";
import { NextResponse } from "next/server";

type Params = Promise<{ id: string; pageNumber: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser();
    const { id, pageNumber } = await params;
    const pageNum = parseInt(pageNumber, 10);

    if (isNaN(pageNum)) {
      return NextResponse.json({ error: "Invalid page number" }, { status: 400 });
    }

    // Only owner can access page images (needed for editing)
    const exam = await prisma.exam.findFirst({
      where: { id, userId: user.id },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found or not authorized" }, { status: 404 });
    }

    const page = await prisma.examPage.findUnique({
      where: { examId_pageNumber: { examId: id, pageNumber: pageNum } },
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Get signed URL and proxy the image
    const signedUrl = await getSignedUrl("question-images", page.imagePath, 60);
    const imageResponse = await fetch(signedUrl);

    if (!imageResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch page image" }, { status: 500 });
    }

    const buffer = await imageResponse.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
