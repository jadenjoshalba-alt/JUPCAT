import { Link } from "wouter";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center mx-auto px-4 md:px-6 max-w-6xl">
          <Link href="/" className="flex items-center gap-3 font-bold text-lg text-primary transition-colors hover:text-primary/80">
            <img src="/up-logo.png" alt="UP Logo" className="h-9 w-9 object-contain" />
            <span>IskolarTrack</span>
          </Link>
          <div className="ml-auto flex items-center space-x-4">
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        <div className="container mx-auto px-4 md:px-6 py-8 max-w-6xl flex-1 flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
