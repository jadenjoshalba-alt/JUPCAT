import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { getSession } from "@/lib/firestoreSessions";
import { Session } from "@/types/session";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SUBJECT_LABELS } from "@/lib/format";
import { Loader2, ArrowLeft, CheckCircle2, XCircle, MinusCircle, Lightbulb, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReviewPage() {
  const [, params] = useRoute("/review/:sessionId");
  const sessionId = params?.sessionId ?? "";
  const { user, loading: authLoading, signInWithGoogle } = useAuth();

  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!sessionId || authLoading) return;
    if (!user) return;

    setIsLoading(true);
    setIsError(false);
    getSession(user.uid, sessionId)
      .then((data) => {
        if (!data) setIsError(true);
        else setSession(data);
      })
      .catch(() => setIsError(true))
      .finally(() => setIsLoading(false));
  }, [sessionId, user, authLoading]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Sign in required</h2>
            <p className="text-muted-foreground">Please sign in to view your review session.</p>
            <Button onClick={signInWithGoogle} className="gap-2">
              <LogIn className="h-4 w-4" />
              Sign in with Google
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Loading session data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !session) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Session not found</h2>
            <p className="text-muted-foreground">The requested review session could not be loaded.</p>
            <Button asChild>
              <Link href="/">Back to Dashboard</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto w-full space-y-8 pb-12">
        <div className="flex items-center gap-4 border-b pb-6">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Review Answers</h1>
            <p className="text-muted-foreground mt-1">
              Score: <span className="font-semibold text-foreground">{session.totalScore}</span> / {session.totalQuestions}
            </p>
          </div>
        </div>

        <div className="space-y-12">
          {session.answers.map((answer, index) => {
            const choices = answer.choices || [];

            return (
              <Card key={answer.questionId} className="overflow-hidden border-2 shadow-sm">
                <div className="bg-muted/30 px-6 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-muted-foreground">#{index + 1}</span>
                    <Badge variant="outline" className="bg-background">
                      {SUBJECT_LABELS[answer.subject] || answer.subject}
                    </Badge>
                  </div>
                  <div className="flex items-center">
                    {answer.isCorrect ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Correct
                      </Badge>
                    ) : answer.isBlank ? (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300">
                        <MinusCircle className="h-3.5 w-3.5 mr-1" /> Blank
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Incorrect
                      </Badge>
                    )}
                  </div>
                </div>

                <CardContent className="p-6 space-y-8">
                  <div className="prose prose-slate dark:prose-invert max-w-none text-lg whitespace-pre-wrap">
                    {answer.questionText || "Question text not available."}
                  </div>
                  {answer.imageUrl && (
                    <div className="mb-6 rounded-lg border bg-card overflow-hidden">
                      <img
                        src={answer.imageUrl}
                        alt="Question diagram"
                        className="w-full h-auto max-h-[400px] object-contain"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                    {choices.map((choice, i) => {
                      const isSelected = answer.selectedAnswer === choice.id;
                      const isActualCorrect = choice.id === answer.correctAnswer;
                      const label = String.fromCharCode(65 + i);

                      let cardClass = "border p-4 rounded-lg flex items-start gap-4 transition-colors";
                      let icon = null;

                      if (isSelected && isActualCorrect) {
                        cardClass = cn(cardClass, "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900");
                        icon = <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />;
                      } else if (isSelected && !isActualCorrect) {
                        cardClass = cn(cardClass, "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900");
                        icon = <XCircle className="h-5 w-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />;
                      } else if (!isSelected && isActualCorrect) {
                        cardClass = cn(cardClass, "bg-green-50/50 border-green-200 border-dashed dark:bg-green-950/10 dark:border-green-900");
                        icon = <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />;
                      } else {
                        cardClass = cn(cardClass, "bg-card opacity-60");
                        icon = <div className="w-5 h-5 shrink-0 mt-0.5" />;
                      }

                      return (
                        <div key={choice.id} className={cardClass}>
                          <span className="font-bold w-6 shrink-0 text-muted-foreground">{label}.</span>
                          <span className="flex-1">{choice.text}</span>
                          {icon}
                        </div>
                      );
                    })}
                  </div>

                  {answer.explanation && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-5 mt-6">
                      <div className="flex items-center gap-2 mb-2 text-primary font-semibold">
                        <Lightbulb className="h-5 w-5" />
                        Explanation
                      </div>
                      <div className="text-sm text-foreground/90 leading-relaxed">
                        {answer.explanation}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
