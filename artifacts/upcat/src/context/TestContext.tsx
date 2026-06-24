import React, { createContext, useContext, useState, ReactNode } from "react";
import { Question, SessionAnswer, Session } from "@/types/session";

interface TestContextType {
  questions: Question[];
  answers: Record<string, SessionAnswer>;
  timeRemaining: number;
  status: "idle" | "ready" | "running" | "finished";
  setQuestions: (questions: Question[]) => void;
  setAnswers: (answers: Record<string, SessionAnswer>) => void;
  setTimeRemaining: (time: number) => void;
  setStatus: (status: "idle" | "ready" | "running" | "finished") => void;
  lastSession: Session | null;
  setLastSession: (session: Session | null) => void;
  resetTest: () => void;
}

const TestContext = createContext<TestContextType | undefined>(undefined);

export function TestProvider({ children }: { children: ReactNode }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, SessionAnswer>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [status, setStatus] = useState<"idle" | "ready" | "running" | "finished">("idle");
  const [lastSession, setLastSession] = useState<Session | null>(null);

  const resetTest = () => {
    setQuestions([]);
    setAnswers({});
    setTimeRemaining(0);
    setStatus("idle");
  };

  return (
    <TestContext.Provider
      value={{
        questions,
        answers,
        timeRemaining,
        status,
        setQuestions,
        setAnswers,
        setTimeRemaining,
        setStatus,
        lastSession,
        setLastSession,
        resetTest,
      }}
    >
      {children}
    </TestContext.Provider>
  );
}

export function useTest() {
  const context = useContext(TestContext);
  if (context === undefined) {
    throw new Error("useTest must be used within a TestProvider");
  }
  return context;
}
