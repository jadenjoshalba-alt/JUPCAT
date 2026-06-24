import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useTest } from "@/context/TestContext";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SUBJECT_LABELS, formatTime } from "@/lib/format";
import { CheckCircle2, XCircle, MinusCircle, Clock, RotateCcw, ArrowRight, TrendingUp, AlertTriangle, Trophy, BookOpen } from "lucide-react";
import { SessionAnswer } from "@/types/session";
import { cn } from "@/lib/utils";

function getStatus(pct: number) {
  if (pct >= 85) return { label: "Excellent", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800", icon: Trophy, message: "Outstanding performance! You are very well prepared for UPCAT. Keep reviewing to maintain this level." };
  if (pct >= 75) return { label: "Very Good", color: "text-blue-600", bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800", icon: TrendingUp, message: "Strong performance. You are on track. Focus on the subjects where you lost points to push higher." };
  if (pct >= 60) return { label: "Good", color: "text-amber-600", bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800", icon: BookOpen, message: "Decent result but room to improve. Identify your weak subjects and allocate more study time there." };
  if (pct >= 40) return { label: "Needs Improvement", color: "text-orange-600", bg: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800", icon: AlertTriangle, message: "You need to strengthen your foundations. Review concepts thoroughly and practice more before the actual exam." };
  return { label: "Critical – Study More", color: "text-red-600", bg: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800", icon: AlertTriangle, message: "Significant gaps in your preparation. Focus on core concepts for each subject and increase your practice frequency." };
}

export default function ResultsPage() {
  const [, setLocation] = useLocation();
  const { lastSession, resetTest } = useTest();

  useEffect(() => {
    if (!lastSession) setLocation("/");
  }, [lastSession, setLocation]);

  if (!lastSession) return null;

  const { answers, totalScore, totalQuestions, timeTakenSeconds } = lastSession;

  const correctCount = lastSession.correctCount ?? (answers as SessionAnswer[]).filter((a) => a.isCorrect).length;
  const wrongCount = lastSession.wrongCount ?? (answers as SessionAnswer[]).filter((a) => !a.isCorrect && !a.isBlank).length;
  const blankCount = lastSession.blankCount ?? (answers as SessionAnswer[]).filter((a) => a.isBlank).length;

  const upcatScore = correctCount - 0.25 * wrongCount;
  const accuracyPct = Math.round((correctCount / totalQuestions) * 100);
  const upcatPct = Math.round((upcatScore / totalQuestions) * 100);

  const status = getStatus(accuracyPct);
  const StatusIcon = status.icon;

  const subjectBreakdown = (answers as SessionAnswer[]).reduce((acc, ans) => {
    if (!acc[ans.subject]) acc[ans.subject] = { correct: 0, wrong: 0, blank: 0, total: 0 };
    acc[ans.subject].total++;
    if (ans.isCorrect) acc[ans.subject].correct++;
    else if (ans.isBlank) acc[ans.subject].blank++;
    else acc[ans.subject].wrong++;
    return acc;
  }, {} as Record<string, { correct: number; wrong: number; blank: number; total: number }>);

  const canReview = lastSession.id !== "local";

  return (
    <Layout>
      <div className="max-w-4xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">

        {/* Header */}
        <div className="text-center space-y-2 pt-6">
          <h1 className="text-4xl font-extrabold tracking-tight">Test Results</h1>
          <p className="text-muted-foreground">Your comprehensive UPCAT mock performance report</p>
        </div>

        {/* Score cards row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="text-center p-4 border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <div className="text-3xl font-bold text-green-700 dark:text-green-400">{correctCount}</div>
            <div className="text-xs text-green-600 dark:text-green-500 font-medium mt-0.5">Correct</div>
            <div className="text-xs text-muted-foreground">(+1 each)</div>
          </Card>
          <Card className="text-center p-4 border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
            <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
            <div className="text-3xl font-bold text-red-700 dark:text-red-400">{wrongCount}</div>
            <div className="text-xs text-red-600 dark:text-red-500 font-medium mt-0.5">Wrong</div>
            <div className="text-xs text-muted-foreground">(-0.25 each)</div>
          </Card>
          <Card className="text-center p-4 border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20">
            <MinusCircle className="h-6 w-6 text-gray-500 mx-auto mb-1" />
            <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">{blankCount}</div>
            <div className="text-xs text-gray-500 font-medium mt-0.5">Blank</div>
            <div className="text-xs text-muted-foreground">(0 points)</div>
          </Card>
          <Card className="text-center p-4 border-2 border-primary/30 bg-primary/5">
            <Clock className="h-6 w-6 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold text-primary font-mono">{formatTime(timeTakenSeconds)}</div>
            <div className="text-xs text-primary/80 font-medium mt-0.5">Time Used</div>
            <div className="text-xs text-muted-foreground">MM:SS</div>
          </Card>
        </div>

        {/* Main score + status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-md border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">UPCAT Score Profile</CardTitle>
              <CardDescription>Score = Correct − (0.25 × Wrong)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-6 py-4">
                {/* Donut chart */}
                <div className="relative flex items-center justify-center w-36 h-36 shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="72" cy="72" r="60" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-muted" />
                    <circle
                      cx="72" cy="72" r="60"
                      stroke="currentColor" strokeWidth="12" fill="transparent"
                      strokeDasharray={377}
                      strokeDashoffset={377 - (377 * Math.max(0, upcatPct)) / 100}
                      className="text-primary transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold">{Math.max(0, upcatScore).toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mt-0.5">UPCAT Score</span>
                  </div>
                </div>

                <div className="w-full space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Raw score (no deduction)</span>
                    <span className="font-bold">{correctCount} / {totalQuestions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deduction (−0.25 × {wrongCount})</span>
                    <span className="font-bold text-red-500">−{(0.25 * wrongCount).toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-semibold">UPCAT Score</span>
                    <span className="font-bold text-primary">{Math.max(0, upcatScore).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Accuracy %</span>
                    <span className="font-bold">{accuracyPct}%</span>
                  </div>
                  <Progress value={accuracyPct} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status & recommendation */}
          <Card className={cn("shadow-md border-2", status.bg)}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <StatusIcon className={cn("h-5 w-5", status.color)} />
                <CardTitle className={cn("text-xl", status.color)}>{status.label}</CardTitle>
              </div>
              <CardDescription>Performance verdict & recommendations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed">{status.message}</p>

              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key Metrics</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-background/60 rounded p-2 text-center">
                    <div className="font-bold text-lg">{accuracyPct}%</div>
                    <div className="text-xs text-muted-foreground">Accuracy</div>
                  </div>
                  <div className="bg-background/60 rounded p-2 text-center">
                    <div className="font-bold text-lg">{blankCount > 0 ? "Skip wisely" : "No blanks"}</div>
                    <div className="text-xs text-muted-foreground">{blankCount} blank{blankCount !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="bg-background/60 rounded p-2 text-center">
                    <div className="font-bold text-lg">{wrongCount > 0 ? `−${(0.25 * wrongCount).toFixed(2)}` : "±0"}</div>
                    <div className="text-xs text-muted-foreground">Penalty points</div>
                  </div>
                  <div className="bg-background/60 rounded p-2 text-center">
                    <div className="font-bold text-lg font-mono">{formatTime(timeTakenSeconds)}</div>
                    <div className="text-xs text-muted-foreground">Time used</div>
                  </div>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                {canReview && (
                  <Button size="lg" className="w-full" onClick={() => setLocation(`/review/${lastSession.id}`)}>
                    Review Answers & Explanations
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                <Button size="lg" variant="outline" className="w-full" onClick={() => { resetTest(); setLocation("/"); }}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Take Another Test
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subject Breakdown */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Subject Breakdown</CardTitle>
            <CardDescription>Per-subject correct / wrong / blank counts and accuracy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Subject</th>
                    <th className="px-4 py-3 text-center text-green-600 dark:text-green-500">✓ Correct</th>
                    <th className="px-4 py-3 text-center text-red-600 dark:text-red-500">✗ Wrong</th>
                    <th className="px-4 py-3 text-center text-muted-foreground">– Blank</th>
                    <th className="px-4 py-3 text-center">Score</th>
                    <th className="px-4 py-3 text-right">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(subjectBreakdown).map(([subject, stats]) => {
                    const subjectScore = stats.correct - 0.25 * stats.wrong;
                    const subjectAcc = Math.round((stats.correct / stats.total) * 100);
                    return (
                      <tr key={subject} className="bg-card hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{SUBJECT_LABELS[subject] || subject}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400">
                            {stats.correct}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400">
                            {stats.wrong}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="text-muted-foreground">{stats.blank}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold">
                          {Math.max(0, subjectScore).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-semibold">{subjectAcc}%</span>
                            <Progress value={subjectAcc} className="w-14 h-2" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 bg-muted/30">
                  <tr>
                    <td className="px-4 py-3 font-bold">TOTAL</td>
                    <td className="px-4 py-3 text-center font-bold text-green-600">{correctCount}</td>
                    <td className="px-4 py-3 text-center font-bold text-red-600">{wrongCount}</td>
                    <td className="px-4 py-3 text-center font-bold text-muted-foreground">{blankCount}</td>
                    <td className="px-4 py-3 text-center font-bold text-primary">{Math.max(0, upcatScore).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold">{accuracyPct}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Study tips */}
        <Card className="shadow-sm bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">UPCAT Scoring Tip</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• <strong>Right answer:</strong> +1 point</p>
            <p>• <strong>Wrong answer:</strong> −0.25 point (penalty for guessing incorrectly)</p>
            <p>• <strong>Blank:</strong> 0 points (no penalty — skip if very unsure)</p>
            <p>• <strong>Strategy:</strong> Only guess when you can eliminate at least 2 choices. Otherwise, leave blank.</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
