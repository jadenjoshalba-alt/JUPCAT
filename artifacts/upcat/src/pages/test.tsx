import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useTest } from "@/context/TestContext";
import { useAuth } from "@/context/AuthContext";
import { saveSession } from "@/lib/firestoreSessions";
import { SessionAnswer } from "@/types/session";
import { formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { markQuestionsUsed } from "@/lib/questionBank";
import { resolveImageUrl, hasImage } from "@/lib/imageResolver";
import { ChevronLeft, ChevronRight, Flag, CheckCircle } from "lucide-react";

export default function TestPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const {
    questions,
    answers,
    setAnswers,
    timeRemaining,
    setTimeRemaining,
    status,
    setStatus,
    setLastSession,
  } = useTest();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [initialTime] = useState(timeRemaining);
  const [showNavPanel, setShowNavPanel] = useState(false);

  const timerRef = useRef<number | null>(null);
  const timeRef = useRef<number>(timeRemaining);

  useEffect(() => {
    timeRef.current = timeRemaining;
  }, [timeRemaining]);

  useEffect(() => {
    if (
      (status !== "running" && status !== "ready") ||
      questions.length === 0
    ) {
      setLocation("/");
      return;
    }
    if (status !== "running") return;
    timerRef.current = window.setInterval(() => {
      const next = timeRef.current - 1;
      if (next <= 0) {
        clearInterval(timerRef.current!);
        setTimeRemaining(0);
        handleManualSubmit();
      } else {
        setTimeRemaining(next);
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, questions.length]);

  const handleManualSubmit = async () => {
    setShowSubmitConfirm(false);
    setStatus("finished");
    if (timerRef.current) clearInterval(timerRef.current);

    let correctCount = 0;
    const sessionAnswers = questions.map((q) => {
      const userAns = answers[q.id];
      const isCorrect = userAns?.selectedAnswer === q.correctAnswer;
      if (isCorrect) correctCount++;
      return {
        ...q,
        questionId: q.id,
        questionText: q.text,
        imageUrl: q.imageUrl,
        selectedAnswer: userAns?.selectedAnswer || null,
        isCorrect,
        isBlank: !userAns,
      } as SessionAnswer;
    });

    markQuestionsUsed(questions.map((q) => q.id));

    const sessionData = {
      answers: sessionAnswers,
      totalScore: correctCount,
      totalQuestions: questions.length,
      timeTakenSeconds: initialTime - timeRemaining,
    };

    let savedSessionId = "local";
    if (user) {
      try {
        const saved = await saveSession(user.uid, sessionData);
        savedSessionId = saved.id;
      } catch {
        // fall through to local
      }
    }

    // Always save to localStorage so anonymous users see results
    const localSession = {
      id: savedSessionId,
      ...sessionData,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem("upcat_last_session", JSON.stringify(localSession));
    setLastSession(localSession);

    setLocation("/results");
  };

  if (questions.length === 0) return null;
  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion.id];

  const answeredCount = Object.keys(answers).length;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <header className="border-b p-3 flex justify-between items-center bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="font-bold text-lg">IskolarTrack Mock Test</div>
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:flex gap-1"
            onClick={() => setShowNavPanel(true)}
          >
            <Flag className="h-4 w-4" />
            {answeredCount}/{questions.length}
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-lg tabular-nums">
            {formatTime(timeRemaining)}
          </span>
          <Button onClick={() => setShowSubmitConfirm(true)}>Submit</Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto p-4 max-w-3xl flex flex-col">
        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question number */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground uppercase tracking-wider">
            {currentQuestion.subject}
          </span>
        </div>

        {/* Question text */}
        <div className="prose text-lg mb-4 whitespace-pre-wrap">
          {currentQuestion.text}
        </div>

        {/* Image — only shows if valid */}
        {hasImage(currentQuestion.imageUrl) && (
          <div className="mb-6 rounded-lg border overflow-hidden flex justify-center bg-white p-2">
            <img
              src={resolveImageUrl(currentQuestion.imageUrl!)}
              alt="Diagram"
              className="max-h-[300px] object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        {/* Choices */}
        <div className="grid gap-3 mb-8">
          {currentQuestion.choices.map((choice, i) => (
            <Button
              key={choice.id}
              variant={
                currentAnswer?.selectedAnswer === choice.id
                  ? "default"
                  : "outline"
              }
              className="justify-start h-auto p-4 text-left"
              onClick={() =>
                setAnswers({
                  ...answers,
                  [currentQuestion.id]: {
                    questionId: currentQuestion.id,
                    subject: currentQuestion.subject,
                    questionText: currentQuestion.text,
                    selectedAnswer: choice.id,
                    correctAnswer: currentQuestion.correctAnswer,
                    isCorrect: choice.id === currentQuestion.correctAnswer,
                    isBlank: false,
                  },
                })
              }
            >
              <span className="mr-3 font-bold shrink-0">
                {String.fromCharCode(65 + i)}.
              </span>
              <span className="whitespace-pre-wrap">{choice.text}</span>
            </Button>
          ))}
        </div>

        {/* Navigation */}
        <div className="mt-auto flex items-center justify-between gap-4 pb-4">
          <Button
            variant="outline"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={isFirst}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          {/* Quick nav dots (mobile-friendly) */}
          <div className="hidden sm:flex items-center gap-1">
            {questions.map((q, i) => {
              const isAnswered = !!answers[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentIndex
                      ? "bg-primary w-6"
                      : isAnswered
                      ? "bg-primary/60"
                      : "bg-muted"
                  }`}
                  title={`Q${i + 1}`}
                />
              );
            })}
          </div>

          <Button
            onClick={() =>
              setCurrentIndex((i) =>
                Math.min(questions.length - 1, i + 1)
              )
            }
            disabled={isLast}
            className="gap-2"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </main>

      {/* Submit confirmation */}
      <AlertDialog
        open={showSubmitConfirm}
        onOpenChange={setShowSubmitConfirm}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Submit test?</AlertDialogTitle>
          <AlertDialogDescription>
            You have answered {answeredCount} of {questions.length} questions.
            {answeredCount < questions.length && (
              <span className="text-amber-600 font-medium">
                {" "}
                {questions.length - answeredCount} unanswered
                {questions.length - answeredCount === 1
                  ? " question"
                  : " questions"}
                .
              </span>
            )}
            {" "}This action cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleManualSubmit}>
              Confirm Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Navigation panel (question grid) */}
      {showNavPanel && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowNavPanel(false)}
        >
          <div
            className="bg-card border rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4">Question Navigator</h2>
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
              {questions.map((q, i) => {
                const isAnswered = !!answers[q.id];
                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentIndex(i);
                      setShowNavPanel(false);
                    }}
                    className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                      i === currentIndex
                        ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                        : isAnswered
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-muted text-muted-foreground border"
                    }`}
                  >
                    {isAnswered ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-primary/10 border border-primary/30" />{" "}
                Answered
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-muted border" /> Unanswered
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-primary ring-2 ring-primary ring-offset-1" />{" "}
                Current
              </span>
            </div>
            <Button
              className="w-full mt-4"
              onClick={() => {
                setShowNavPanel(false);
                setShowSubmitConfirm(true);
              }}
            >
              Submit Test
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
