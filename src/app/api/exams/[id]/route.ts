import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = Promise<{ id: string }>;

const updateExamSchema = z.object({
  isPublic: z.boolean().optional(),
});

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // Allow access to own exams or public exams
    const exam = await prisma.exam.findFirst({
      where: {
        id,
        OR: [{ userId: user.id }, { isPublic: true }],
      },
      include: {
        user: {
          select: { email: true },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    return NextResponse.json({ exam });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = updateExamSchema.parse(await request.json());

    // Only owner can update the exam
    const exam = await prisma.exam.findFirst({
      where: { id, userId: user.id },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found or not authorized" }, { status: 404 });
    }

    const updatedExam = await prisma.exam.update({
      where: { id },
      data: {
        ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
      },
    });

    return NextResponse.json({ exam: updatedExam });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update exam";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // Only owner can delete the exam
    const exam = await prisma.exam.findFirst({
      where: { id, userId: user.id },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found or not authorized" }, { status: 404 });
    }

    await prisma.exam.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete exam";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
