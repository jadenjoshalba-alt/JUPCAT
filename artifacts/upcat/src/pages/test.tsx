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

export default function TestPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { questions, answers, setAnswers, timeRemaining, setTimeRemaining, status, setStatus, setLastSession } = useTest();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [initialTime] = useState(timeRemaining);

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
    setShowSubmitConfirm(false); setStatus("finished"); if (timerRef.current) clearInterval(timerRef.current);
    let correctCount = 0;
    const sessionAnswers = questions.map((q) => {
      const userAns = answers[q.id];
      const isCorrect = userAns?.selectedAnswer === q.correctAnswer;
      if (isCorrect) correctCount++;
      return { ...q, questionId: q.id, questionText: q.text, imageUrl: q.imageUrl, selectedAnswer: userAns?.selectedAnswer || null, isCorrect, isBlank: !userAns } as SessionAnswer;
    });
    markQuestionsUsed(questions.map((q) => q.id));
    const sessionData = { answers: sessionAnswers, totalScore: correctCount, totalQuestions: questions.length, timeTakenSeconds: initialTime - timeRemaining };
    if (user) { await saveSession(user.uid, sessionData); setLastSession({ id: "saved", ...sessionData, createdAt: new Date().toISOString() }); }
    setLocation("/results");
  };

  if (questions.length === 0) return null;
  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion.id];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="border-b p-4 flex justify-between items-center">
        <div className="font-bold text-lg">IskolarTrack Mock Test</div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-lg">{formatTime(timeRemaining)}</span>
          <Button onClick={() => setShowSubmitConfirm(true)}>Submit</Button>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 max-w-3xl">
        <div className="prose text-lg mb-4">{currentQuestion.text}</div>
        {currentQuestion.imageUrl && <img src={currentQuestion.imageUrl} alt="Diagram" className="max-h-[300px] mb-6 border rounded" />}
        <div className="grid gap-3">
          {currentQuestion.choices.map((choice, i) => (
            <Button key={choice.id} variant={currentAnswer?.selectedAnswer === choice.id ? "default" : "outline"} className="justify-start h-auto p-4" onClick={() => setAnswers({...answers, [currentQuestion.id]: { questionId: currentQuestion.id, subject: currentQuestion.subject, questionText: currentQuestion.text, selectedAnswer: choice.id, correctAnswer: currentQuestion.correctAnswer, isCorrect: choice.id === currentQuestion.correctAnswer, isBlank: false }})}>
              <span className="mr-3 font-bold">{String.fromCharCode(65 + i)}.</span> {choice.text}
            </Button>
          ))}
        </div>
      </main>
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}><AlertDialogContent><AlertDialogTitle>Submit test?</AlertDialogTitle><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleManualSubmit}>Confirm</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}