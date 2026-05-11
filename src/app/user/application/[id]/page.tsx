import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LoanApplication, AffordabilityResult } from "@/types/database";

const STATUS_STEPS = [
  "submitted",
  "under_review",
  "approved",
  "disbursed",
] as const;

/** JSONB `affordability_result` may include `total_repayment` before the TS type on all branches includes it. */
function displayTotalRepayment(aff: AffordabilityResult): string {
  const withTotal = aff as AffordabilityResult & { total_repayment?: number };
  const n = Number(
    withTotal.total_repayment ?? aff.estimated_installment ?? 0
  );
  return n.toFixed(2);
}

function statusColor(status: string) {
  switch (status) {
    case "approved":
    case "disbursed":
      return "bg-green-600";
    case "rejected":
      return "destructive";
    case "under_review":
      return "bg-yellow-600";
    default:
      return "secondary";
  }
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: application } = await supabase
    .from("loan_applications")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!application) notFound();

  const app = application as unknown as LoanApplication;
  const affordability = app.affordability_result as AffordabilityResult | null;
  const isRejected = app.status === "rejected";
  const isApproved =
    app.status === "approved" || app.status === "disbursed";

  // Find associated loan if approved
  let loanId: string | null = null;
  if (isApproved) {
    const { data: loan } = await supabase
      .from("loans")
      .select("id")
      .eq("application_id", app.id)
      .single();
    if (loan) loanId = loan.id;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Application Status
        </h1>
        <p className="text-muted-foreground">
          Submitted{" "}
          {app.submitted_at
            ? new Date(app.submitted_at).toLocaleDateString()
            : "—"}
        </p>
      </div>

      {/* Progress Tracker */}
      {!isRejected && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              {STATUS_STEPS.map((s, i) => {
                const stepIndex = STATUS_STEPS.indexOf(
                  app.status as (typeof STATUS_STEPS)[number]
                );
                const isComplete = i <= stepIndex;
                const isCurrent = i === stepIndex;
                return (
                  <div key={s} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                          isComplete
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        } ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}
                      >
                        {isComplete ? "✓" : i + 1}
                      </div>
                      <span className="mt-1 text-xs capitalize">{s.replace("_", " ")}</span>
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div
                        className={`mx-2 h-0.5 flex-1 ${
                          i < stepIndex ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status */}
      {isRejected && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Badge variant="destructive">Rejected</Badge>
            </div>
            {app.admin_notes && (
              <p className="mt-2 text-sm text-muted-foreground">
                Reason: {app.admin_notes}
              </p>
            )}
            <Button asChild className="mt-4" size="sm">
              <Link href="/user/apply">Apply again</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Application Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Application Details
            <Badge className={statusColor(app.status)}>{app.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Amount Requested</span>
              <p className="font-medium">
                R{Number(app.amount_requested).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Term</span>
              <p className="font-medium">{app.term_months} months</p>
            </div>
            <div>
              <span className="text-muted-foreground">Monthly Income</span>
              <p className="font-medium">
                R{Number(app.monthly_income).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Monthly Expenses</span>
              <p className="font-medium">
                R{Number(app.monthly_expenses).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Affordability Result */}
      {affordability && (
        <Card>
          <CardHeader>
            <CardTitle>Affordability Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground">
                  Disposable Income
                </span>
                <p className="font-medium">
                  R{Number(affordability.disposable_income ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Repayment</span>
                <p className="font-medium">
                  R{displayTotalRepayment(affordability)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Eligible</span>
                <p>
                  <Badge
                    variant={affordability.eligible ? "default" : "destructive"}
                  >
                    {affordability.eligible ? "Yes" : "No"}
                  </Badge>
                </p>
              </div>
            </div>
            {affordability.reasons.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 text-destructive">
                <ul className="list-disc pl-4 space-y-1">
                  {affordability.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {isApproved && loanId && (
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/user/loans/${loanId}`}>
              View Loan & Repayment Schedule
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
