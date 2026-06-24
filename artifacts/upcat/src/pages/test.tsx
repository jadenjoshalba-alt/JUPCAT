import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useTest } from "@/context/TestContext";
import { useAuth } from "@/context/AuthContext";
import { saveSession } from "@/lib/firestoreSessions";
import { SessionAnswer } from "@/types/session";
import { formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogTitle, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { markQuestionsUsed } from "@/lib/questionBank";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function TestPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { questions, answers, setAnswers, timeRemaining, setTimeRemaining, status, setStatus, setLastSession } = useTest();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [initialTime] = useState(timeRemaining);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<number | null>(null);
  const timeRef = useRef<number>(timeRemaining);

  useEffect(() => { timeRef.current = timeRemaining; }, [timeRemaining]);
  useEffect(() => {
    if ((status !== "running" && status !== "ready") || questions.length === 0) { setLocation("/"); return; }
    if (status !== "running") return;
    timerRef.current = window.setInterval(() => {
      const next = timeRef.current - 1;
      if (next <= 0) { clearInterval(timerRef.current!); setTimeRemaining(0); handleManualSubmit(); }
      else { setTimeRemaining(next); }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, questions.length]);

  const handleManualSubmit = async () => {
    if (submitting) return;
    setShowSubmitConfirm(false);
    setSubmitting(true);
    setStatus("finished");
    if (timerRef.current) clearInterval(timerRef.current);

    let correctCount = 0;
    let wrongCount = 0;
    const sessionAnswers = questions.map((q) => {
      const userAns = answers[q.id];
      const isCorrect = userAns?.selectedAnswer === q.correctAnswer;
      const isBlank = !userAns || !userAns.selectedAnswer;
      if (isCorrect) correctCount++;
      else if (!isBlank) wrongCount++;
      return {
        ...q,
        questionId: q.id,
        questionText: q.text,
        imageUrl: undefined,
        selectedAnswer: userAns?.selectedAnswer || null,
        isCorrect,
        isBlank,
      } as SessionAnswer;
    });

    markQuestionsUsed(questions.map((q) => q.id));
    const upcatScore = correctCount - 0.25 * wrongCount;
    const sessionData = {
      answers: sessionAnswers,
      totalScore: upcatScore,
      correctCount,
      wrongCount,
      blankCount: questions.length - correctCount - wrongCount,
      totalQuestions: questions.length,
      timeTakenSeconds: initialTime - timeRemaining,
    };

    if (user) {
      try {
        const saved = await saveSession(user.uid, sessionData);
        setLastSession(saved);
      } catch {
        setLastSession({ id: "local", ...sessionData, createdAt: new Date().toISOString() });
      }
    } else {
      setLastSession({ id: "local", ...sessionData, createdAt: new Date().toISOString() });
    }
    setSubmitting(false);
    setLocation("/results");
  };

  if (questions.length === 0) return null;
  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion.id];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="border-b p-4 flex justify-between items-center sticky top-0 bg-background z-10">
        <div className="font-bold text-lg">IskolarTrack Mock Test</div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{answeredCount}/{questions.length} answered</span>
          <span className={cn("font-mono text-lg font-bold", timeRemaining < 60 && "text-red-500 animate-pulse")}>
            {formatTime(timeRemaining)}
          </span>
          <Button onClick={() => setShowSubmitConfirm(true)} disabled={submitting}>Submit</Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 max-w-3xl flex flex-col gap-4">
        {/* Question number + progress */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Question <span className="text-foreground font-bold">{currentIndex + 1}</span> of {questions.length}
          </span>
          <div className="flex gap-1">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  "w-6 h-6 rounded text-xs font-bold transition-colors",
                  i === currentIndex && "ring-2 ring-primary ring-offset-1",
                  answers[q.id] ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Question text */}
        <div className="prose max-w-none text-base whitespace-pre-wrap font-sans leading-relaxed border rounded-lg p-4 bg-card">
          {currentQuestion.text}
        </div>

        {/* Choices */}
        <div className="grid gap-3">
          {currentQuestion.choices.map((choice, i) => (
            <Button
              key={choice.id}
              variant={currentAnswer?.selectedAnswer === choice.id ? "default" : "outline"}
              className="justify-start h-auto p-4 text-left whitespace-normal"
              onClick={() => setAnswers({
                ...answers,
                [currentQuestion.id]: {
                  questionId: currentQuestion.id,
                  subject: currentQuestion.subject,
                  questionText: currentQuestion.text,
                  selectedAnswer: choice.id,
                  correctAnswer: currentQuestion.correctAnswer,
                  isCorrect: choice.id === currentQuestion.correctAnswer,
                  isBlank: false,
                }
              })}
            >
              <span className="mr-3 font-bold shrink-0">{String.fromCharCode(65 + i)}.</span>
              <span>{choice.text}</span>
            </Button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          {currentIndex < questions.length - 1 ? (
            <Button onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => setShowSubmitConfirm(true)} disabled={submitting}>
              Submit Test
            </Button>
          )}
        </div>
      </main>

      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Submit test?</AlertDialogTitle>
          <p className="text-sm text-muted-foreground">
            You have answered {answeredCount} out of {questions.length} questions.
            {answeredCount < questions.length && ` ${questions.length - answeredCount} question(s) will be left blank (0 points).`}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleManualSubmit}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
