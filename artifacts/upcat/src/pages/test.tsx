import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useTest } from "@/context/TestContext";
import { useAuth } from "@/context/AuthContext";
import { saveSession } from "@/lib/firestoreSessions";
import { SessionAnswer } from "@/types/session";
import { formatTime, SUBJECT_LABELS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Clock, CheckCircle2, XCircle, Flag, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { markQuestionsUsed } from "@/lib/questionBank";

// Permanent fix helper for subfolder asset pathways
const fixImagePath = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith("/")) {
    return `.${url}`;
  }
  return url;
};

export default function TestPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { questions, answers, setAnswers, timeRemaining, setTimeRemaining, status, setStatus, setLastSession } = useTest();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [initialTime] = useState(timeRemaining);
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const timerRef = useRef<number | null>(null);
  const timeRef = useRef<number>(timeRemaining);

  useEffect(() => {
    timeRef.current = timeRemaining;
  }, [timeRemaining]);

  useEffect(() => {
    if ((status !== "running" && status !== "ready") || questions.length === 0) {
      setLocation("/");
      return;
    }
    if (status !== "running") return;

    timerRef.current = window.setInterval(() => {
      const next = timeRef.current - 1;
      if (next <= 0) {
        clearInterval(timerRef.current!);
        setTimeRemaining(0);
        handleAutoSubmit();
      } else {
        setTimeRemaining(next);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, questions.length]);

  const handleAutoSubmit = () => {
    setStatus("finished");
    submitTest();
  };

  const handleManualSubmit = () => {
    setShowSubmitConfirm(false);
    setStatus("finished");
    if (timerRef.current) clearInterval(timerRef.current);
    submitTest();
  };

  const submitTest = async () => {
    setSubmitted(true);
    let correctCount = 0;
    let wrongCount = 0;
    let blankCount = 0;

    const sessionAnswers = questions.map((q) => {
      const userAns = answers[q.id];
      const isBlank = !userAns;
      const isCorrect = userAns ? userAns.selectedAnswer === q.correctAnswer : false;
      const isWrong = userAns ? !isCorrect && !isBlank : false;

      if (isCorrect) correctCount++;
      else if (isWrong) wrongCount++;
      else blankCount++;

      return {
        questionId: q.id,
        subject: q.subject,
        questionText: q.text,
        imageUrl: fixImagePath(q.imageUrl),
        selectedAnswer: userAns?.selectedAnswer || null,
        correctAnswer: q.correctAnswer,
        isCorrect,
        isBlank,
        explanation: q.explanation,
        choices: q.choices.map(c => ({ ...c, imageUrl: fixImagePath(c.imageUrl) })),
      } as SessionAnswer;
    });

    const totalScore = correctCount - (0.25 * wrongCount);
    const timeTaken = initialTime - timeRemaining;

    markQuestionsUsed(questions.map((q) => q.id));

    const sessionData = {
      answers: sessionAnswers,
      totalScore: Math.max(0, totalScore),
      totalQuestions: questions.length,
      timeTakenSeconds: timeTaken,
    };

    if (user) {
      setIsSaving(true);
      try {
        const session = await saveSession(user.uid, sessionData);
        setLastSession(session);
        setLocation("/results");
      } catch (err) {
        console.error("Failed to save session to Firestore:", err);
        setLastSession({ id: "local", ...sessionData, createdAt: new Date().toISOString() });
        setLocation("/results");
      } finally {
        setIsSaving(false);
      }
    } else {
      setLastSession({ id: "local", ...sessionData, createdAt: new Date().toISOString() });
      setLocation("/results");
    }
  };

  const toggleFlag = (id: string) => {
    setFlagged((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectAnswer = (choiceId: string) => {
    if (submitted) return;
    const currentQ = questions[currentIndex];
    const isCorrect = choiceId === currentQ.correctAnswer;

    setAnswers({
      ...answers,
      [currentQ.id]: {
        questionId: currentQ.id,
        subject: currentQ.subject,
        questionText: currentQ.text,
        selectedAnswer: choiceId,
        correctAnswer: currentQ.correctAnswer,
        isCorrect,
        isBlank: false,
      },
    });
  };

  if (questions.length === 0) return null;

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion.id];

  const answeredCount = Object.keys(answers).length;
  const isLastQuestion = currentIndex === questions.length - 1;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
            <img src="./up-logo.png" alt="UP Logo" className="h-8 w-8 object-contain hidden sm:block" />
            <div className="font-bold text-lg text-primary hidden sm:block">IskolarTrack Mock Test</div>
            <div className="text-sm font-medium px-3 py-1 bg-muted rounded-full">
              {SUBJECT_LABELS[currentQuestion.subject] || currentQuestion.subject}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 font-mono text-lg tabular-nums">
              <Clock className={cn("h-5 w-5", timeRemaining < 300 ? "text-destructive animate-pulse" : "text-muted-foreground")} />
              <span className={cn(timeRemaining < 300 && "text-destructive font-bold")}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            <Button variant="default" onClick={() => setShowSubmitConfirm(true)} disabled={isSaving || submitted}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Test"}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden container mx-auto max-w-7xl">
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-4 md:p-8">
          <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="text-sm font-medium text-muted-foreground">
                Question {currentIndex + 1} of {questions.length}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className={cn("gap-2", flagged[currentQuestion.id] && "text-amber-500 bg-amber-50 dark:bg-amber-950/30")}
                onClick={() => toggleFlag(currentQuestion.id)}
              >
                <Flag className={cn("h-4 w-4", flagged[currentQuestion.id] && "fill-current")} />
                {flagged[currentQuestion.id] ? "Flagged" : "Flag for review"}
              </Button>
            </div>

            <div className="prose prose-slate dark:prose-invert max-w-none mb-8 text-lg whitespace-pre-wrap">
              {currentQuestion.text}
            </div>

            {/* Fixed Main Question Diagram Image Rendering */}
            {currentQuestion.imageUrl && (
              <div className="mb-6 rounded-lg border bg-card overflow-hidden flex justify-center">
                <img
                  src={fixImagePath(currentQuestion.imageUrl)}
                  alt="Question diagram"
                  className="w-auto h-auto max-h-[400px] object-contain p-2"
                  loading="lazy"
                />
              </div>
            )}

            {/* Enhanced Grid layout supporting Text + Choice Images seamlessly */}
            <div className="grid grid-cols-1 gap-3 mt-auto">
              {currentQuestion.choices.map((choice, i) => {
                const isSelected = currentAnswer?.selectedAnswer === choice.id;
                const label = String.fromCharCode(65 + i);

                return (
                  <Button
                    key={choice.id}
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "flex flex-col items-start justify-center h-auto py-4 px-6 text-left font-normal text-base w-full border transition-all rounded-xl",
                      isSelected
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => handleSelectAnswer(choice.id)}
                    disabled={submitted}
                  >
                    <div className="flex items-start w-full">
                      <span className="font-bold mr-4 w-6 mt-0.5">{label}.</span>
                      <span className="flex-1 whitespace-normal break-words">{choice.text}</span>
                    </div>

                    {/* Render choice images natively when they are provided in the data scheme */}
                    {choice.imageUrl && (
                      <div className="mt-3 ml-10 p-1 bg-white border rounded shadow-sm max-w-[240px] overflow-hidden">
                        <img 
                          src={fixImagePath(choice.imageUrl)} 
                          alt={`Choice ${label} diagram`} 
                          className="max-h-32 object-contain w-auto h-auto"
                        />
                      </div>
                    )}
                  </Button>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-12 pt-6 border-t">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="mr-2 h-5 w-5" />
                Previous
              </Button>

              <Button
                variant={isLastQuestion ? "default" : "outline"}
                size="lg"
                onClick={() => {
                  if (isLastQuestion) {
                    setShowSubmitConfirm(true);
                  } else {
                    setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
                  }
                }}
              >
                {isLastQuestion ? "Finish" : "Next"}
                {!isLastQuestion && <ChevronRight className="ml-2 h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="w-80 border-l bg-card hidden lg:flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">Question Navigator</h3>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-primary" /> Answered
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border-2 border-muted-foreground" /> Unanswered
              </div>
            </div>
            <div className="mt-2 text-sm">
              <span className="font-bold">{answeredCount}</span> of {questions.length} answered
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4">
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, i) => {
                  const isAns = !!answers[q.id];
                  const isFlag = flagged[q.id];
                  const isCurr = i === currentIndex;

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(i)}
                      className={cn(
                        "relative h-10 w-full flex items-center justify-center rounded-md text-sm font-medium transition-colors border",
                        isCurr ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                        isAns ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent border-input",
                      )}
                    >
                      {i + 1}
                      {isFlag && (
                        <div className="absolute -top-1 -right-1">
                          <Flag className="h-3 w-3 fill-amber-500 text-amber-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </div>
      </main>

      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Mock Test?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} out of {questions.length} questions.
              {answeredCount < questions.length && (
                <span className="block mt-2 font-medium text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Blank questions will receive 0 points.
                </span>
              )}
              Once submitted, you cannot change your answers.
              {!user && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  You are not signed in. Results will not be saved to the cloud.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Testing</AlertDialogCancel>
            <AlertDialogAction onClick={handleManualSubmit} className="bg-primary hover:bg-primary/90">
              Submit Test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}