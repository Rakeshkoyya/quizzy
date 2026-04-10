export type AnswerOption = "A" | "B" | "C" | "D";
export type AnswerKey = Record<string, AnswerOption>;

export interface Question {
  id: string;
  examId: string;
  questionNumber: number;
  imagePath?: string | null;
  imageUrl?: string;
  pageNumber: number;
  subject?: string;
  section?: string;
  cropX?: number | null;
  cropY?: number | null;
  cropW?: number | null;
  cropH?: number | null;
  questionText?: string | null;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
}

export interface ExamPage {
  id: string;
  examId: string;
  pageNumber: number;
  imagePath: string;
  width: number;
  height: number;
  imageUrl?: string;
}

export interface Exam {
  id: string;
  title: string;
  timeLimitMinutes: number;
  questionCount: number;
  answerKey: AnswerKey;
  imagePath: string | null;
  questionPdfPath: string | null;
  questionType: "image" | "text";
  solutionsJson: Record<string, string> | null;
  correctMarks: number;
  wrongMarks: number;
  unansweredMarks: number;
  userId: string;
  isPublic: boolean;
  createdAt: string;
  questions?: Question[];
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

export interface QuestionBoundary {
  pageNumber: number;
  questionNumber: number;
  xStartFraction: number;
  xEndFraction: number;
  yStartFraction: number;
  yEndFraction: number;
  subject?: string;
  section?: string;
}

export interface PageImage {
  pageNumber: number;
  width: number;
  height: number;
  dataUrl: string;
}

export type PageType = "introduction" | "questions" | "questions_with_solutions";

export interface PageAnalysisResult {
  pageNumber: number;
  pageType: PageType;
  subject: string | null;
  section: string | null;
  questions: QuestionBoundary[];
  solutions: Record<string, string> | null;
}
