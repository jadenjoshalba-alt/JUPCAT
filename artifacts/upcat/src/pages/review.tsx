import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { getSession } from "@/lib/firestoreSessions";
import { Session } from "@/types/session";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SUBJECT_LABELS, formatTime } from "@/lib/format";
import { Loader2, ArrowLeft, Lightbulb, CheckCircle2, XCircle, MinusCircle, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReviewPage() {
  const [, params] = useRoute("/review/:sessionId");
  const sessionId = params?.sessionId ?? "";
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "wrong" | "correct" | "blank">("all");

  useEffect(() => {
    if (!sessionId || authLoading || !user) return;
    setIsLoading(true);
    getSession(user.uid, sessionId).then(setSession).finally(() => setIsLoading(false));
  }, [sessionId, user, authLoading]);

  if (authLoading || isLoading) return <Layout><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></Layout>;
  if (!user) return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4 text-center">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Sign in to review your session</h2>
          <Button onClick={signInWithGoogle}>Sign in with Google</Button>
        </div>
      </div>
    </Layout>
  );
  if (!session) return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4 text-center">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Session not found</h2>
          <Button asChild variant="outline"><Link href="/">Back to Dashboard</Link></Button>
        </div>
      </div>
    </Layout>
  );

  const correctCount = session.correctCount ?? session.answers.filter((a) => a.isCorrect).length;
  const wrongCount = session.wrongCount ?? session.answers.filter((a) => !a.isCorrect && !a.isBlank).length;
  const blankCount = session.blankCount ?? session.answers.filter((a) => a.isBlank).length;
  const upcatScore = Math.max(0, correctCount - 0.25 * wrongCount);
  const accuracyPct = Math.round((correctCount / session.totalQuestions) * 100);

  const filtered = session.answers.filter((a) => {
    if (filter === "wrong") return !a.isCorrect && !a.isBlank;
    if (filter === "correct") return a.isCorrect;
    if (filter === "blank") return a.isBlank;
    return true;
  });

  return (
    <Layout>
      <div className="max-w-4xl mx-auto w-full space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4 border-b pb-6">
          <Button variant="ghost" size="icon" asChild className="rounded-full shrink-0">
            <Link href="/"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">Review Answers</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {new Date(session.createdAt).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{correctCount}</div>
            <div className="text-xs text-green-600">Correct</div>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
            <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{wrongCount}</div>
            <div className="text-xs text-red-600">Wrong</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/20 border rounded-lg p-3 text-center">
            <MinusCircle className="h-5 w-5 text-gray-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{blankCount}</div>
            <div className="text-xs text-muted-foreground">Blank</div>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
            <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold text-primary">{upcatScore.toFixed(2)}</div>
            <div className="text-xs text-primary/80">UPCAT Score</div>
          </div>
        </div>

        {/* Accuracy bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Accuracy</span>
            <span className="font-semibold">{accuracyPct}%</span>
          </div>
          <Progress value={accuracyPct} className="h-2" />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Time taken: {formatTime(session.timeTakenSeconds)}</span>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "wrong", "correct", "blank"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-foreground"
              )}
            >
              {f === "all" && `All (${session.answers.length})`}
              {f === "correct" && `Correct (${correctCount})`}
              {f === "wrong" && `Wrong (${wrongCount})`}
              {f === "blank" && `Blank (${blankCount})`}
            </button>
          ))}
        </div>

        {/* Questions list */}
        <div className="space-y-6">
          {filtered.map((answer, index) => {
            const origIndex = session.answers.indexOf(answer);
            return (
              <Card key={answer.questionId} className={cn("overflow-hidden border-2 shadow-sm",
                answer.isCorrect ? "border-green-200 dark:border-green-800" :
                answer.isBlank ? "border-gray-200 dark:border-gray-700" :
                "border-red-200 dark:border-red-800"
              )}>
                <div className="px-5 py-3 border-b flex items-center justify-between bg-muted/20">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-muted-foreground text-sm">#{origIndex + 1}</span>
                    <Badge variant="outline" className="text-xs">{SUBJECT_LABELS[answer.subject] || answer.subject}</Badge>
                  </div>
                  <Badge variant={answer.isCorrect ? "default" : answer.isBlank ? "secondary" : "destructive"} className="text-xs">
                    {answer.isCorrect ? "✓ Correct" : answer.isBlank ? "– Blank" : "✗ Wrong"}
                  </Badge>
                </div>
                <CardContent className="p-5 space-y-4">
                  {/* Question text */}
                  <div className="text-base whitespace-pre-wrap font-sans leading-relaxed">{answer.questionText}</div>

                  {/* Choices */}
                  <div className="space-y-2">
                    {answer.choices?.map((choice, i) => {
                      const isSelected = answer.selectedAnswer === choice.id;
                      const isCorrect = choice.id === answer.correctAnswer;
                      return (
                        <div
                          key={choice.id}
                          className={cn(
                            "border p-3 rounded-lg text-sm",
                            isSelected && isCorrect && "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700",
                            isSelected && !isCorrect && "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700",
                            !isSelected && isCorrect && "bg-green-50/50 border-green-200 border-dashed dark:bg-green-950/10 dark:border-green-800",
                            !isSelected && !isCorrect && "border-border bg-background"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span className="font-bold text-muted-foreground shrink-0">{String.fromCharCode(65 + i)}.</span>
                            <span className="flex-1">{choice.text}</span>
                            {isSelected && isCorrect && <span className="text-green-600 text-xs font-semibold shrink-0">Your answer ✓</span>}
                            {isSelected && !isCorrect && <span className="text-red-600 text-xs font-semibold shrink-0">Your answer ✗</span>}
                            {!isSelected && isCorrect && <span className="text-green-600 text-xs font-semibold shrink-0">Correct answer</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {answer.explanation && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2 text-primary font-semibold text-sm">
                        <Lightbulb className="h-4 w-4" />
                        Explanation
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{answer.explanation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">No questions match this filter.</p>
          </div>
        )}

        <div className="pt-4 text-center">
          <Button asChild variant="outline">
            <Link href="/">← Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
}
