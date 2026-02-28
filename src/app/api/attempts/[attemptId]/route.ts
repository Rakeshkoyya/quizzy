import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = Promise<{ attemptId: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser();
    const { attemptId } = await params;

    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, userId: user.id },
      include: { exam: true },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    return NextResponse.json({ attempt });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
