import { useState, useEffect, useRef, useMemo } from "react";
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

interface QuestionGroup {
  type: "single" | "passage";
  passage?: string;
  questions: {
    id: string;
    subject: string;
    text: string;
    choices: { id: string; text: string }[];
    correctAnswer: string;
    explanation?: string;
  }[];
  startIndex: number; // global question index of the first question in this group
}

function parsePassage(text: string): { passage: string | null; question: string } {
  const match = text.match(/^PASSAGE:\s*\n?([\s\S]*?)\n?\nQUESTION:\s*([\s\S]*)$/i);
  if (match) {
    return { passage: match[1].trim(), question: match[2].trim() };
  }
  return { passage: null, question: text };
}

function buildGroups(questions: any[]): QuestionGroup[] {
  const groups: QuestionGroup[] = [];
  let i = 0;
  while (i < questions.length) {
    const q = questions[i];
    if (q.passageId || (q.subject.startsWith("reading_") && q.text.startsWith("PASSAGE:"))) {
      // Reading comprehension group
      const passageId = q.passageId || "p" + i;
      const passageQuestions: any[] = [q];
      let j = i + 1;
      while (j < questions.length) {
        const nextQ = questions[j];
        const nextPassageId = nextQ.passageId || (nextQ.subject.startsWith("reading_") && nextQ.text.startsWith("PASSAGE:") ? "p" + j : null);
        if (nextPassageId === passageId) {
          passageQuestions.push(nextQ);
          j++;
        } else {
          break;
        }
      }
      const { passage } = parsePassage(q.text);
      groups.push({
        type: "passage",
        passage: passage || q.text,
        questions: passageQuestions,
        startIndex: i,
      });
      i = j;
    } else {
      groups.push({
        type: "single",
        questions: [q],
        startIndex: i,
      });
      i++;
    }
  }
  return groups;
}

export default function TestPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { questions, answers, setAnswers, timeRemaining, setTimeRemaining, status, setStatus, setLastSession } = useTest();

  const [currentGroup, setCurrentGroup] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [initialTime] = useState(timeRemaining);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<number | null>(null);
  const timeRef = useRef<number>(timeRemaining);

  const groups = useMemo(() => buildGroups(questions), [questions]);

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
      const ans: SessionAnswer = {
        questionId: q.id,
        subject: q.subject,
        questionText: q.text,
        selectedAnswer: userAns?.selectedAnswer || null,
        correctAnswer: q.correctAnswer,
        isCorrect,
        isBlank,
      };
      if (q.explanation) ans.explanation = q.explanation;
      if (q.choices) ans.choices = q.choices;
      return ans;
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
      } catch (err) {
        console.error("Failed to save session to Firestore:", err);
        setLastSession({ id: "local", ...sessionData, createdAt: new Date().toISOString() });
      }
    } else {
      setLastSession({ id: "local", ...sessionData, createdAt: new Date().toISOString() });
    }
    setSubmitting(false);
    setLocation("/results");
  };

  if (questions.length === 0) return null;
  const group = groups[currentGroup];
  const answeredCount = Object.keys(answers).length;

  // Build a map from global question index to group index
  const questionIndexToGroup = useMemo(() => {
    const map: number[] = [];
    for (let g = 0; g < groups.length; g++) {
      const grp = groups[g];
      for (let q = 0; q < grp.questions.length; q++) {
        map.push(g);
      }
    }
    return map;
  }, [groups]);

  const globalIndex = (groupIndex: number) => {
    return groups[groupIndex].startIndex;
  };

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
        {/* Question number grid */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {group.type === "passage" ? (
              <span>
                Passage <span className="text-foreground font-bold">{currentGroup + 1}</span> of {groups.length}
                <span className="text-muted-foreground text-xs ml-1">
                  ({group.questions.length} question{group.questions.length !== 1 ? "s" : ""})
                </span>
              </span>
            ) : (
              <span>
                Question <span className="text-foreground font-bold">{globalIndex(currentGroup) + 1}</span> of {questions.length}
              </span>
            )}
          </span>
          <div className="flex gap-1 flex-wrap">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentGroup(questionIndexToGroup[i])}
                className={cn(
                  "w-6 h-6 rounded text-xs font-bold transition-colors",
                  i === globalIndex(currentGroup) && "ring-2 ring-primary ring-offset-1",
                  answers[q.id] ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Passage view */}
        {group.type === "passage" && group.passage && (
          <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-4">
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Reading Passage</div>
            <div className="text-base whitespace-pre-wrap font-sans leading-relaxed">
              {group.passage}
            </div>
          </div>
        )}

        {/* Questions */}
        {group.questions.map((q, qIdx) => {
          const userAns = answers[q.id];
          const { question } = parsePassage(q.text);
          return (
            <div key={q.id} className="border rounded-lg p-4 bg-card flex flex-col gap-3">
              <div className="text-sm font-medium text-muted-foreground">
                Question {globalIndex(currentGroup) + qIdx + 1}
              </div>
              <div className="prose max-w-none text-base whitespace-pre-wrap font-sans leading-relaxed">
                {question}
              </div>
              <div className="grid gap-2">
                {q.choices.map((choice, i) => (
                  <Button
                    key={choice.id}
                    variant={userAns?.selectedAnswer === choice.id ? "default" : "outline"}
                    className="justify-start h-auto p-3 text-left whitespace-normal"
                    onClick={() => setAnswers({
                      ...answers,
                      [q.id]: {
                        questionId: q.id,
                        subject: q.subject,
                        questionText: q.text,
                        selectedAnswer: choice.id,
                        correctAnswer: q.correctAnswer,
                        isCorrect: choice.id === q.correctAnswer,
                        isBlank: false,
                      }
                    })}
                  >
                    <span className="mr-3 font-bold shrink-0">{String.fromCharCode(65 + i)}.</span>
                    <span>{choice.text}</span>
                  </Button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setCurrentGroup((g) => Math.max(0, g - 1))}
            disabled={currentGroup === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          {currentGroup < groups.length - 1 ? (
            <Button onClick={() => setCurrentGroup((g) => Math.min(groups.length - 1, g + 1))}>
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
