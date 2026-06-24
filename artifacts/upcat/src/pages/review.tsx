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
import { Loader2, ArrowLeft, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveImageUrl, hasImage } from "@/lib/imageResolver";

export default function ReviewPage() {
  const [, params] = useRoute("/review/:sessionId");
  const sessionId = params?.sessionId ?? "";
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    // Try localStorage first (works for anonymous users)
    if (sessionId === "local") {
      try {
        const raw = localStorage.getItem("upcat_last_session");
        if (raw) {
          setSession(JSON.parse(raw));
          return;
        }
      } catch {
        // fall through
      }
    }
    // Try Firestore if logged in
    if (!authLoading && user) {
      setIsLoading(true);
      getSession(user.uid, sessionId)
        .then(setSession)
        .finally(() => setIsLoading(false));
    }
  }, [sessionId, user, authLoading]);

  if (authLoading || isLoading) return <Layout><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></Layout>;
  if (!session) return <Layout><div className="flex-1 flex items-center justify-center p-4 text-center"><div className="space-y-4"><h2 className="text-2xl font-bold">Session Missing</h2><Button onClick={signInWithGoogle}>Sign In</Button></div></div></Layout>;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto w-full space-y-8 pb-12">
        <div className="flex items-center gap-4 border-b pb-6">
          <Button variant="ghost" size="icon" asChild className="rounded-full"><Link href="/"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div><h1 className="text-3xl font-bold">Review Answers</h1><p className="text-muted-foreground mt-1">Score: {session.totalScore} / {session.totalQuestions}</p></div>
        </div>
        <div className="space-y-12">
          {session.answers.map((answer, index) => (
            <Card key={answer.questionId} className="overflow-hidden border-2 shadow-sm">
              <div className="bg-muted/30 px-6 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-3"><span className="font-bold text-muted-foreground">#{index + 1}</span><Badge variant="outline">{SUBJECT_LABELS[answer.subject] || answer.subject}</Badge></div>
                <Badge variant={answer.isCorrect ? "default" : "destructive"}>{answer.isCorrect ? "Correct" : "Incorrect"}</Badge>
              </div>
              <CardContent className="p-6 space-y-6">
                <div className="prose max-w-none text-lg whitespace-pre-wrap">{answer.questionText}</div>
                {hasImage(answer.imageUrl) && <div className="rounded-lg border overflow-hidden flex justify-center bg-white p-2"><img src={resolveImageUrl(answer.imageUrl!)} alt="Diagram" className="max-h-[350px] object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div>}
                <div className="space-y-3">
                  {answer.choices?.map((choice, i) => {
                    const isSelected = answer.selectedAnswer === choice.id;
                    const isCorrect = choice.id === answer.correctAnswer;
                    return (
                      <div key={choice.id} className={cn("border p-4 rounded-xl transition-all w-full", isSelected && isCorrect && "bg-green-50 border-green-200", isSelected && !isCorrect && "bg-red-50 border-red-200", !isSelected && isCorrect && "bg-green-50/30 border-dashed")}>
                        <div className="flex items-start gap-2"><span className="font-bold text-muted-foreground">{String.fromCharCode(65 + i)}.</span><span>{choice.text}</span></div>
                        {hasImage(choice.imageUrl) && <div className="mt-3 ml-6 p-1 bg-white border rounded max-w-[240px]"><img src={resolveImageUrl(choice.imageUrl!)} alt="Visual" className="max-h-32 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div>}
                      </div>
                    );
                  })}
                </div>
                {answer.explanation && <div className="bg-primary/5 border rounded-lg p-4 mt-4"><div className="flex items-center gap-2 mb-1 text-primary font-semibold"><Lightbulb className="h-4 w-4"/>Explanation</div><p className="text-sm text-muted-foreground">{answer.explanation}</p></div>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}