import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function UserDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile
  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Get display name from the best available source:
  // 1. Profile table (if it exists and has a name)
  // 2. Auth user metadata (set during signUp — always reliable)
  // 3. Fallback to "there"
  const metaName = (user.user_metadata?.full_name as string) || "";
  const metaPhone = (user.user_metadata?.phone as string) || "";
  const displayName = profile?.full_name || metaName || "there";

  // Try to sync profile if it exists but name is missing
  if (profile && !profile.full_name && metaName) {
    await supabase
      .from("profiles")
      .update({
        full_name: metaName,
        ...(metaPhone && !profile.phone ? { phone: metaPhone } : {}),
      })
      .eq("id", user.id);
  }

  // Fetch current tier
  const { data: currentTier } = await supabase
    .from("user_tier_history")
    .select("*, tiers(*)")
    .eq("user_id", user.id)
    .is("effective_to", null)
    .single();

  // Fetch active loan
  const { data: activeLoan } = await supabase
    .from("loans")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  // Fetch next repayment
  let nextRepayment = null;
  if (activeLoan) {
    const { data } = await supabase
      .from("repayments")
      .select("*")
      .eq("loan_id", activeLoan.id)
      .in("status", ["due", "late"])
      .order("due_date", { ascending: true })
      .limit(1)
      .single();
    nextRepayment = data;
  }

  // Fetch latest application
  const { data: latestApp } = await supabase
    .from("loan_applications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const tierName = currentTier?.tiers?.name ?? "Tier 1";
  const maxLoan = currentTier?.tiers?.max_loan ?? 700;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hi, {displayName}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your account
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tierName}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Loan Limit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R{Number(maxLoan).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Loan Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeLoan ? (
              <Badge variant="default">Active</Badge>
            ) : latestApp ? (
              <Badge variant="secondary">{latestApp.status}</Badge>
            ) : (
              <span className="text-sm text-muted-foreground">No loan</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Next Repayment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextRepayment ? (
              <div>
                <div className="text-2xl font-bold">
                  R{Number(nextRepayment.amount_due).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Due {new Date(nextRepayment.due_date).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">None</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold">Apply for a Loan</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit a new loan application
            </p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/user/apply">Apply now</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold">Upload Documents</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload your ID and payslip
            </p>
            <Button asChild className="mt-4" size="sm" variant="outline">
              <Link href="/user/documents">Upload</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold">My Loans</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              View your loan history and status
            </p>
            <Button asChild className="mt-4" size="sm" variant="outline">
              <Link href="/user/loans">View loans</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
