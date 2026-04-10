import { requireUser } from "@/lib/auth";
import { callOpenRouter } from "@/lib/openrouter";
import { NextResponse } from "next/server";
import { z } from "zod";

const explainSchema = z.object({
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
  mode: z.enum(["solution", "explain_question", "techniques"]),
});

const PROMPTS: Record<string, string> = {
  solution: `You are an expert exam tutor. A student got a question wrong (or didn't answer it) on their exam. Explain the correct solution clearly and concisely.

Instructions:
- Start with a brief 1-sentence summary of why the correct answer is right
- Then provide a step-by-step explanation of the solution
- If the student chose a wrong answer, briefly explain why that option is incorrect
- Use markdown formatting (bold key terms, bullet points)
- Keep it under 300 words
- Be direct and educational`,

  explain_question: `You are an expert exam tutor. A student needs help understanding this exam question. Explain the question clearly.

Instructions:
- Break down what the question is asking
- Identify the key concepts and topics being tested
- Explain any technical terms or tricky wording
- Mention related concepts that might be helpful
- Use markdown formatting 
- Keep it under 250 words`,

  techniques: `You are an expert exam tutor. Help the student remember the concept tested in this question by providing memory techniques and tricks.

Instructions:
- Provide 2-3 practical memory techniques (mnemonics, analogies, visual tricks)
- Explain a quick shortcut or pattern to solve similar questions faster
- Suggest a one-line "rule of thumb" they can remember during exams
- Use markdown formatting
- Keep it under 250 words
- Be creative and make the techniques memorable`,
};

export async function POST(request: Request) {
  try {
    await requireUser();
    const body = explainSchema.parse(await request.json());

    const prompt = buildPrompt(body);
    const response = await callOpenRouter(prompt, {
      temperature: 0.3,
      maxTokens: 1024,
    });

    return NextResponse.json({ explanation: response });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Explanation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function buildPrompt(body: z.infer<typeof explainSchema>): string {
  const systemPrompt = PROMPTS[body.mode];
  const contextParts = [
    systemPrompt,
    "",
    `Exam: ${body.examTitle}`,
    `Question #${body.questionNumber}`,
    `Correct Answer: ${body.correctAnswer}`,
  ];

  if (body.userAnswer) {
    contextParts.push(`Student's Answer: ${body.userAnswer}`);
    if (body.userAnswer !== body.correctAnswer) {
      contextParts.push(`(Student chose the wrong answer)`);
    }
  } else {
    contextParts.push(`(Student did not answer this question)`);
  }

  // Include question text if available (text-based questions)
  if (body.questionText) {
    contextParts.push("", `Question: ${body.questionText}`);
    if (body.optionA) contextParts.push(`A) ${body.optionA}`);
    if (body.optionB) contextParts.push(`B) ${body.optionB}`);
    if (body.optionC) contextParts.push(`C) ${body.optionC}`);
    if (body.optionD) contextParts.push(`D) ${body.optionD}`);
  }

  contextParts.push("", "Please provide your explanation now:");

  return contextParts.join("\n");
}
