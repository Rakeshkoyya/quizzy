import { requireUser } from "@/lib/auth";
import { callOpenRouterStream, type OpenRouterMessage } from "@/lib/openrouter";
import { NextResponse } from "next/server";
import { z } from "zod";

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
  questionContext: z.object({
    questionNumber: z.number(),
    questionImageUrl: z.string().optional(),
    questionText: z.string().optional(),
    optionA: z.string().optional(),
    optionB: z.string().optional(),
    optionC: z.string().optional(),
    optionD: z.string().optional(),
    userAnswer: z.string().optional(),
    correctAnswer: z.string(),
    examTitle: z.string(),
  }),
});

const SYSTEM_PROMPT = `You are an expert exam tutor helping a student review their exam results. You have deep knowledge across all subjects (Physics, Chemistry, Biology, Mathematics, etc.) commonly found in competitive exams like NEET, JEE, and similar.

Your role:
- Help the student understand why their answer was wrong and why the correct answer is right
- Explain concepts clearly with examples
- Suggest memory techniques and tricks to remember key concepts
- Be encouraging but honest about mistakes
- Keep explanations concise but thorough
- Use markdown formatting for clarity (bold for key terms, bullet points for lists)

You are currently discussing a specific question from the exam. Use the question context provided to give relevant, targeted help.`;

export async function POST(request: Request) {
  try {
    await requireUser();
    const body = chatSchema.parse(await request.json());

    const contextMessage = buildContextMessage(body.questionContext);

    const messages: OpenRouterMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: contextMessage },
      ...body.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const stream = await callOpenRouterStream(messages, {
      temperature: 0.3,
      maxTokens: 2048,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function buildContextMessage(ctx: z.infer<typeof chatSchema>["questionContext"]): string {
  const parts = [
    `[Question Context]`,
    `Exam: ${ctx.examTitle}`,
    `Question #${ctx.questionNumber}`,
    `Correct Answer: ${ctx.correctAnswer}`,
  ];
  if (ctx.userAnswer) {
    parts.push(`Student's Answer: ${ctx.userAnswer}`);
    if (ctx.userAnswer !== ctx.correctAnswer) {
      parts.push(`Status: Wrong answer`);
    }
  } else {
    parts.push(`Status: Unanswered`);
  }
  if (ctx.questionText) {
    parts.push("", `Question: ${ctx.questionText}`);
    if (ctx.optionA) parts.push(`A) ${ctx.optionA}`);
    if (ctx.optionB) parts.push(`B) ${ctx.optionB}`);
    if (ctx.optionC) parts.push(`C) ${ctx.optionC}`);
    if (ctx.optionD) parts.push(`D) ${ctx.optionD}`);
  }
  return parts.join("\n");
}
