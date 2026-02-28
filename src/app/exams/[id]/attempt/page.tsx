import { AttemptRunner } from "@/components/attempt-runner";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Exam } from "@/types/exam";
import { notFound } from "next/navigation";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function AttemptPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;

  const exam = await prisma.exam.findFirst({
    where: { id, userId: user.id },
  });

  if (!exam) {
    notFound();
  }

  return <AttemptRunner exam={exam as unknown as Exam} />;
}
