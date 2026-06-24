import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TestProvider } from "@/context/TestContext";
import { AuthProvider } from "@/context/AuthContext";

import Dashboard from "@/pages/dashboard";
import TestPage from "@/pages/test";
import ResultsPage from "@/pages/results";
import ReviewPage from "@/pages/review";
import ImageManagerPage from "@/pages/image-manager";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/test" component={TestPage} />
      <Route path="/results" component={ResultsPage} />
      <Route path="/review/:sessionId" component={ReviewPage} />
      <Route path="/images" component={ImageManagerPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TestProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </TestProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
