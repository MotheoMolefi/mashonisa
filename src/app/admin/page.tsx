import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch counts
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
            <div className="text-2xl font-bold text-destructive">
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
