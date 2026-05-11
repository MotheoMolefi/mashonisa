/**
 * Admin home: KPI cards, Recharts pies (loans/repayments + interest), quick links.
 * When DB has no chart data yet, server injects demo slices so charts aren’t empty.
 */
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardCharts } from "@/components/admin/dashboard-charts";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // --- Summary counts (header cards) ---
  const { count: pendingApps } = await supabase
    .from("loan_applications")
    .select("*", { count: "exact", head: true })
    .in("status", ["submitted", "under_review"]);

  const { count: activeLoans } = await supabase
    .from("loans")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const { count: lateRepayments } = await supabase
    .from("repayments")
    .select("*", { count: "exact", head: true })
    .eq("status", "late");

  const { data: loanBookData } = await supabase
    .from("loans")
    .select("total_payable")
    .eq("status", "active");

  const totalLoanBook =
    loanBookData?.reduce(
      (sum, loan) => sum + Number(loan.total_payable),
      0
    ) ?? 0;

  // --- Chart datasets (fallback demo when all empty) ---
  const { data: settledLoans } = await supabase
    .from("loans")
    .select("interest_amount")
    .eq("status", "settled");
  const interestEarned =
    settledLoans?.reduce((sum, l) => sum + Number(l.interest_amount ?? 0), 0) ?? 0;

  const { data: allLoans } = await supabase.from("loans").select("status");
  const loanCounts = { active: 0, settled: 0, in_arrears: 0, written_off: 0 };
  allLoans?.forEach((l) => {
    if (l.status in loanCounts) loanCounts[l.status as keyof typeof loanCounts]++;
  });
  const loansPieDataRaw = [
    { name: "Active", value: loanCounts.active },
    { name: "Settled", value: loanCounts.settled },
    { name: "In arrears", value: loanCounts.in_arrears },
    { name: "Written off", value: loanCounts.written_off },
  ].filter((d) => d.value > 0);

  const { data: allRepayments } = await supabase.from("repayments").select("status");
  const repCounts = { paid: 0, late: 0, due: 0, partial: 0 };
  allRepayments?.forEach((r) => {
    if (r.status in repCounts) repCounts[r.status as keyof typeof repCounts]++;
  });
  const repaymentsPieDataRaw = [
    { name: "Paid", value: repCounts.paid },
    { name: "Late", value: repCounts.late },
    { name: "No payment (due)", value: repCounts.due },
    { name: "Partial", value: repCounts.partial },
  ].filter((d) => d.value > 0);

  // Dummy data when empty so you can see what the charts look like
  const loansPieData =
    loansPieDataRaw.length > 0
      ? loansPieDataRaw
      : [
          { name: "Active", value: 12 },
          { name: "Settled", value: 8 },
          { name: "In arrears", value: 2 },
          { name: "Written off", value: 1 },
        ];
  const repaymentsPieData =
    repaymentsPieDataRaw.length > 0
      ? repaymentsPieDataRaw
      : [
          { name: "Paid", value: 45 },
          { name: "Late", value: 3 },
          { name: "No payment (due)", value: 7 },
          { name: "Partial", value: 2 },
        ];
  const chartInterestEarned = interestEarned > 0 ? interestEarned : 12_500;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">Operations overview</p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApps ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Loans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLoans ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Late Repayments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${(lateRepayments ?? 0) > 0 ? "text-destructive" : ""}`}
            >
              {lateRepayments ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Loan Book
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R{totalLoanBook.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <DashboardCharts
        loansPieData={loansPieData}
        repaymentsPieData={repaymentsPieData}
        interestEarned={chartInterestEarned}
      />

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold">View Applications</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Review and process loan applications
            </p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/admin/applications">Open queue</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold">Manage Loans</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Track active loans and repayments
            </p>
            <Button asChild className="mt-4" size="sm" variant="outline">
              <Link href="/admin/loans">View loans</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold">Audit Log</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Review system activity trail
            </p>
            <Button asChild className="mt-4" size="sm" variant="outline">
              <Link href="/admin/audit">View log</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
