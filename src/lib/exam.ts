export type AnswerOption = "A" | "B" | "C" | "D";
export type AnswerKeyMap = Record<number, AnswerOption>;

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
