export type AnswerOption = "A" | "B" | "C" | "D";
export type AnswerKey = Record<string, AnswerOption>;

export interface Exam {
  id: string;
  title: string;
  timeLimitMinutes: number;
  questionCount: number;
  answerKey: AnswerKey;
  imagePath: string;
  userId: string;
  createdAt: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  userId: string;
  startedAt: string;
  submittedAt: string;
  userAnswers: AnswerKey;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  wrongQuestions: Array<{ questionNumber: number; yourAnswer: AnswerOption; correctAnswer: AnswerOption }>;
  unansweredQuestions: number[];
}
