import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/supabase-storage";
import { NextResponse } from "next/server";

type Params = Promise<{ id: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const exam = await prisma.exam.findFirst({
      where: {
        id,
        OR: [{ userId: user.id }, { isPublic: true }],
      },
      include: {
        questions: {
          orderBy: { questionNumber: "asc" },
          select: { questionNumber: true, imagePath: true },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const questionUrls: Record<number, string> = {};
    for (const q of exam.questions) {
      if (!q.imagePath) continue;
      try {
        questionUrls[q.questionNumber] = await getSignedUrl("question-images", q.imagePath, 3600);
      } catch {
        // Skip if image not found
      }
    }

    return NextResponse.json({ questionUrls });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
