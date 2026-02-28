import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = Promise<{ id: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const exam = await prisma.exam.findFirst({
      where: { id, userId: user.id },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    return NextResponse.json({ exam });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
