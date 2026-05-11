/**
 * Public marketing home: no auth. Links to signup/login only (no admin shortcut).
 */
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Mashonisa
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="#how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              How it works
            </Link>
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Create account</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="container mx-auto flex flex-col items-center justify-center px-6 py-24 text-center">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Loan Portal
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Apply for a loan, upload your documents, and track your repayments —
            all in one secure platform.
          </p>
          <div className="mt-10 flex gap-4">
            <Button asChild size="lg">
              <Link href="/signup">Create account</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="border-t bg-muted/40 py-20"
        >
          <div className="container mx-auto px-6">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              How it works
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  step: "1",
                  title: "Create an account",
                  description:
                    "Sign up with your email and fill in your personal details.",
                },
                {
                  step: "2",
                  title: "Upload documents",
                  description:
                    "Upload your ID and latest payslip for verification.",
                },
                {
                  step: "3",
                  title: "Apply for a loan",
                  description:
                    "Choose your amount and term, we'll check your affordability instantly.",
                },
                {
                  step: "4",
                  title: "Get funded",
                  description:
                    "Once approved, funds are disbursed and you track repayments online.",
                },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
                    {item.step}
                  </div>
                  <h3 className="mt-4 font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Mashonisa. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
