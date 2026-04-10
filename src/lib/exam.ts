export type AnswerOption = "A" | "B" | "C" | "D";
export type AnswerKeyMap = Record<number, AnswerOption>;

export interface ParsedTextQuestion {
  questionNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

/**
 * Parse text-format questions like:
 * Q1. Which period does the chapter focus on?
 * A) Ancient Period
 * B) Medieval Period
 * C) Modern Period
 * D) Prehistoric Period
 */
export function parseQuestionsText(input: string): ParsedTextQuestion[] {
  const results: ParsedTextQuestion[] = [];

  // Split into question blocks: each starts with Q<number> or just a number
  const blocks = input.split(/(?=(?:^|\n)\s*(?:Q|q)?\s*\d{1,4}\s*[.):\-])/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Extract question number and text
    const headerMatch = trimmed.match(/^(?:Q|q)?\s*(\d{1,4})\s*[.):\-]\s*([\s\S]*?)(?=\n\s*[AaBb]\s*[.):\-])/);
    if (!headerMatch) continue;

    const questionNumber = Number(headerMatch[1]);
    const questionText = headerMatch[2].trim();

    // Extract options A-D
    const optionA = extractOption(trimmed, "A");
    const optionB = extractOption(trimmed, "B");
    const optionC = extractOption(trimmed, "C");
    const optionD = extractOption(trimmed, "D");

    if (questionNumber > 0 && questionText && optionA && optionB && optionC && optionD) {
      results.push({ questionNumber, questionText, optionA, optionB, optionC, optionD });
    }
  }

  results.sort((a, b) => a.questionNumber - b.questionNumber);
  return results;
}

function extractOption(block: string, letter: string): string {
  const nextLetters: Record<string, string> = { A: "B", B: "C", C: "D", D: "" };
  const next = nextLetters[letter];
  const pattern = next
    ? new RegExp(`${letter}\\s*[.):\\-]\\s*([\\s\\S]*?)(?=\\n\\s*${next}\\s*[.):\\-])`, "i")
    : new RegExp(`${letter}\\s*[.):\\-]\\s*([\\s\\S]*?)$`, "i");

  const match = block.match(pattern);
  return match ? match[1].trim() : "";
}

export function parseAnswerKeyText(input: string): AnswerKeyMap {
  const cleaned = input
    .toUpperCase()
    .replace(/[\r\t]/g, " ")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ");

  const matches = cleaned.matchAll(/(\d{1,4})\s*[\)\].,:\-]*\s*([ABCD])/g);
  const result: AnswerKeyMap = {};

  for (const match of matches) {
    const questionNumber = Number(match[1]);
    const answer = match[2] as AnswerOption;
    if (Number.isInteger(questionNumber) && questionNumber > 0) {
      result[questionNumber] = answer;
    }
  }

  return result;
}

export function normalizeAnswerKey(raw: Record<string, string>): AnswerKeyMap {
  const out: AnswerKeyMap = {};
  for (const [key, value] of Object.entries(raw)) {
    const questionNumber = Number(key);
    const answer = value?.toUpperCase?.();
    if (
      Number.isInteger(questionNumber) &&
      questionNumber > 0 &&
      (answer === "A" || answer === "B" || answer === "C" || answer === "D")
    ) {
      out[questionNumber] = answer;
    }
  }
  return out;
}

export function scoreAttempt(answerKey: AnswerKeyMap, userAnswers: Partial<Record<number, AnswerOption>>) {
  const wrongQuestions: Array<{ questionNumber: number; yourAnswer: AnswerOption; correctAnswer: AnswerOption }> = [];
  const unansweredQuestions: number[] = [];

  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  for (const [questionNumberText, correctAnswer] of Object.entries(answerKey)) {
    const questionNumber = Number(questionNumberText);
    const selectedAnswer = userAnswers[questionNumber];

    if (!selectedAnswer) {
      unansweredCount += 1;
      unansweredQuestions.push(questionNumber);
      continue;
    }

    if (selectedAnswer === correctAnswer) {
      correctCount += 1;
    } else {
      wrongCount += 1;
      wrongQuestions.push({
        questionNumber,
        yourAnswer: selectedAnswer,
        correctAnswer,
      });
    }
  }

  return { correctCount, wrongCount, unansweredCount, wrongQuestions, unansweredQuestions };
}
