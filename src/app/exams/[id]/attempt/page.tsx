import { AttemptRunner } from "@/components/attempt-runner";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/supabase-storage";
import type { Exam, Question } from "@/types/exam";
import { notFound } from "next/navigation";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function AttemptPage({ params }: { params: Params }) {
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
      },
    },
  });

  if (!exam) {
    notFound();
  }

  // Generate signed URLs for question images
  const questionsWithUrls: Question[] = await Promise.all(
    (exam.questions || []).map(async (q) => ({
      id: q.id,
      examId: q.examId,
      questionNumber: q.questionNumber,
      imagePath: q.imagePath,
      pageNumber: q.pageNumber,
      imageUrl: await getSignedUrl("question-images", q.imagePath, 7200),
    }))
  );


  const examData: Exam = {
    ...(exam as unknown as Exam),
    questions: questionsWithUrls,
  };

  return <AttemptRunner exam={examData} />;
}
