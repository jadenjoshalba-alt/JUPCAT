import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useTest } from "@/context/TestContext";
import { useAuth } from "@/context/AuthContext";
import { saveSession } from "@/lib/firestoreSessions";
import { SessionAnswer } from "@/types/session";
import { formatTime, SUBJECT_LABELS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Clock, Flag, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { markQuestionsUsed } from "@/lib/questionBank";

const fixImagePath = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  return url.startsWith("/") ? `.${url}` : url;
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

  useEffect(() => { timeRef.current = timeRemaining; }, [timeRemaining]);
  useEffect(() => {
    if ((status !== "running" && status !== "ready") || questions.length === 0) { setLocation("/"); return; }
    if (status !== "running") return;
    timerRef.current = window.setInterval(() => {
      const next = timeRef.current - 1;
      if (next <= 0) { clearInterval(timerRef.current!); setTimeRemaining(0); handleAutoSubmit(); }
      else { setTimeRemaining(next); }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, questions.length]);

  const handleAutoSubmit = () => { setStatus("finished"); submitTest(); };
  const handleManualSubmit = () => { setShowSubmitConfirm(false); setStatus("finished"); if (timerRef.current) clearInterval(timerRef.current); submitTest(); };

  const submitTest = async () => {
    setSubmitted(true);
    let correctCount = 0; let wrongCount = 0;
    const sessionAnswers = questions.map((q) => {
      const userAns = answers[q.id];
      const isBlank = !userAns;
      const isCorrect = userAns ? userAns.selectedAnswer === q.correctAnswer : false;
      if (isCorrect) correctCount++;
      return { questionId: q.id, subject: q.subject, questionText: q.text, imageUrl: fixImagePath(q.imageUrl), selectedAnswer: userAns?.selectedAnswer || null, correctAnswer: q.correctAnswer, isCorrect, isBlank, explanation: q.explanation, choices: q.choices.map(c => ({ ...c, imageUrl: fixImagePath(c.imageUrl) })) } as SessionAnswer;
    });
    markQuestionsUsed(questions.map((q) => q.id));
    const sessionData = { answers: sessionAnswers, totalScore: Math.max(0, correctCount - (0.25 * wrongCount)), totalQuestions: questions.length, timeTakenSeconds: initialTime - timeRemaining };
    if (user) { setIsSaving(true); try { const session = await saveSession(user.uid, sessionData); setLastSession(session); } catch {} finally { setLocation("/results"); } }
    else { setLastSession({ id: "local", ...sessionData, createdAt: new Date().toISOString() }); setLocation("/results"); }
  };

  if (questions.length === 0) return null;
  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion.id];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-7xl">
          <div className="font-bold text-lg text-primary">IskolarTrack Mock Test</div>
          <div className="flex items-center gap-6"><span className={cn("font-mono text-lg", timeRemaining < 300 && "text-destructive font-bold")}>{formatTime(timeRemaining)}</span><Button onClick={() => setShowSubmitConfirm(true)}>Submit</Button></div>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="prose max-w-none text-lg mb-4">{currentQuestion.text}</div>
          {currentQuestion.imageUrl && <div className="rounded-lg border p-2 flex justify-center bg-white"><img src={fixImagePath(currentQuestion.imageUrl)} alt="Diagram" className="max-h-[300px] object-contain" /></div>}
          <div className="grid gap-3 mt-6">
            {currentQuestion.choices.map((choice, i) => (
              <Button key={choice.id} variant={currentAnswer?.selectedAnswer === choice.id ? "default" : "outline"} className="h-auto py-4 px-6 text-left justify-start" onClick={() => { const isCorrect = choice.id === currentQuestion.correctAnswer; setAnswers({...answers, [currentQuestion.id]: { questionId: currentQuestion.id, subject: currentQuestion.subject, questionText: currentQuestion.text, selectedAnswer: choice.id, correctAnswer: currentQuestion.correctAnswer, isCorrect, isBlank: false }}); }}>
                <span className="font-bold mr-3">{String.fromCharCode(65 + i)}.</span>
                <span className="flex-1">{choice.text}</span>
                {choice.imageUrl && <img src={fixImagePath(choice.imageUrl)} className="ml-4 max-h-16" />}
              </Button>
            ))}
          </div>
        </div>
      </main>
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}><AlertDialogContent><AlertDialogTitle>Submit?</AlertDialogTitle><AlertDialogFooter><AlertDialogCancel>Continue</AlertDialogCancel><AlertDialogAction onClick={handleManualSubmit}>Submit</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}