export interface Choice {
  id: string;
  text: string;
}

export interface SessionAnswer {
  questionId: string;
  subject: string;
  questionText: string;
  imageUrl?: string;
  selectedAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  isBlank: boolean;
  explanation?: string;
  choices?: Choice[];
}

export interface Session {
  id: string;
  answers: SessionAnswer[];
  totalScore: number;
  totalQuestions: number;
  timeTakenSeconds: number;
  createdAt: string;
}

export interface Question {
  id: string;
  subject: string;
  topic?: string;
  text: string;
  imageUrl?: string;
  choices: Choice[];
  correctAnswer: string;
  explanation?: string;
}
