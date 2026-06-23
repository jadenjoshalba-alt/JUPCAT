import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useTest } from "@/context/TestContext";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { SUBJECT_LABELS, formatTime } from "@/lib/format";
import { CheckCircle2, XCircle, MinusCircle, ArrowRight, RotateCcw } from "lucide-react";
import { SessionAnswer } from "@workspace/api-client-react";

export default function ResultsPage() {
  const [, setLocation] = useLocation();
  const { lastSession, resetTest } = useTest();

  useEffect(() => {
    if (!lastSession) {
      setLocation("/");
    }
  }, [lastSession, setLocation]);

  if (!lastSession) return null;

  const { answers, totalScore, totalQuestions, timeTakenSeconds } = lastSession;
  
  const correctAnswers = answers.filter((a) => a.isCorrect).length;
  const percentage = (correctAnswers / totalQuestions) * 100;
  
  // High-level UP grading standard approximation:
  // Usually the passing mark varies, but roughly 60-70% raw is safe for decent courses.
  // We'll just display it objectively.
  const isPassing = percentage >= 60;

  // Group by subject
  const subjectBreakdown = answers.reduce((acc, ans) => {
    if (!acc[ans.subject]) {
      acc[ans.subject] = { correct: 0, wrong: 0, blank: 0, total: 0 };
    }
    acc[ans.subject].total++;
    if (ans.isCorrect) acc[ans.subject].correct++;
    else if (ans.isBlank) acc[ans.subject].blank++;
    else acc[ans.subject].wrong++;
    return acc;
  }, {} as Record<string, { correct: number; wrong: number; blank: number; total: number }>);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        <div className="text-center space-y-4 pt-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
            Test Results
          </h1>
          <p className="text-lg text-muted-foreground">
            Here is your comprehensive UPCAT mock performance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Score Card */}
          <Card className="md:col-span-2 shadow-md border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">UPCAT Score Profile</CardTitle>
              <CardDescription>Right minus 1/4 wrong formula applied.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center gap-8 py-6">
                <div className="relative flex items-center justify-center w-40 h-40 shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-muted" />
                    <circle
                      cx="80" cy="80" r="70"
                      stroke="currentColor" strokeWidth="12" fill="transparent"
                      strokeDasharray={440}
                      strokeDashoffset={440 - (440 * percentage) / 100}
                      className="text-primary transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold">{Math.round(percentage)}%</span>
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mt-1">Accuracy</span>
                  </div>
                </div>
                
                <div className="flex-1 space-y-6 w-full">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Raw Score</div>
                      <div className="text-3xl font-bold text-foreground">{totalScore.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">out of {totalQuestions} max</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Time Taken</div>
                      <div className="text-3xl font-bold text-foreground">{formatTime(timeTakenSeconds)}</div>
                      <div className="text-sm text-muted-foreground">MM:SS</div>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-muted/50 border flex items-start gap-4">
                    <div className={`p-2 rounded-full ${isPassing ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isPassing ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangleIcon className="h-6 w-6" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">
                        {isPassing ? "Solid Performance" : "Needs Improvement"}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isPassing 
                          ? "You are on track. Review your mistakes to secure a higher percentile."
                          : "Focus on your weak subjects. Accuracy is more important than speed in right-minus-wrong scoring."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Card */}
          <Card className="shadow-md flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl">Next Steps</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center space-y-4">
              <Button size="lg" className="w-full text-base h-14" onClick={() => setLocation(`/review/${lastSession.id}`)}>
                Review Answers
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="w-full text-base h-14" onClick={() => {
                resetTest();
                setLocation("/");
              }}>
                <RotateCcw className="mr-2 h-5 w-5" />
                Take Another Test
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown Table */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Subject Breakdown</CardTitle>
            <CardDescription>Raw counts per subject area. No minus points applied here.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Subject Area</th>
                    <th className="px-6 py-4 font-semibold text-center text-green-600 dark:text-green-500">Correct (+1)</th>
                    <th className="px-6 py-4 font-semibold text-center text-red-600 dark:text-red-500">Wrong (-0.25)</th>
                    <th className="px-6 py-4 font-semibold text-center text-muted-foreground">Blank (0)</th>
                    <th className="px-6 py-4 font-semibold text-right">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(subjectBreakdown).map(([subject, stats]) => (
                    <tr key={subject} className="bg-card hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">
                        {SUBJECT_LABELS[subject] || subject}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold dark:bg-green-900/30 dark:text-green-400">
                          {stats.correct}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 font-bold dark:bg-red-900/30 dark:text-red-400">
                          {stats.wrong}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold dark:bg-gray-800 dark:text-gray-400">
                          {stats.blank}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className="font-semibold">{Math.round((stats.correct / stats.total) * 100)}%</span>
                          <Progress value={(stats.correct / stats.total) * 100} className="w-16 h-2" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function AlertTriangleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
