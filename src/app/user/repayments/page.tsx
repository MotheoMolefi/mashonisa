/**
 * All repayments across the borrower’s loans: table + PayFast + overdue styling.
 * Query params: ?paid=1 / ?cancelled=1 after PayFast return (banner only).
 */
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayFastButton } from "@/components/user/payfast-button";
import { isRepaymentOverdue } from "@/lib/repayments";
import { getPayFastConfig } from "@/lib/payfast";

/** Maps DB status to a badge when the row is not calendar-overdue. */
function repaymentStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-600">Paid</Badge>;
    case "partial":
      return <Badge className="bg-yellow-600">Partial</Badge>;
    case "late":
      return <Badge variant="destructive">Late</Badge>;
    default:
      return <Badge variant="secondary">Due</Badge>;
  }
}

/** Overdue overrides raw status for clearer UX. */
function repaymentStatusCell(rep: {
  status: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
}) {
  if (isRepaymentOverdue(rep)) {
    return <Badge variant="destructive">Overdue</Badge>;
  }
  return repaymentStatusBadge(rep.status);
}

function isFullyPaid(rep: { status: string; amount_due: number; amount_paid: number }) {
  return rep.status === "paid" && Number(rep.amount_paid) >= Number(rep.amount_due);
}

export default async function RepaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; cancelled?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get all user's loans
  const { data: loans } = await supabase
    .from("loans")
    .select("id")
    .eq("user_id", user.id);

  const loanIds = loans?.map((l) => l.id) ?? [];

  let repayments: Array<{
    id: string;
    loan_id: string;
    due_date: string;
    amount_due: number;
    amount_paid: number;
    paid_at: string | null;
    status: string;
  }> = [];

  if (loanIds.length > 0) {
    const { data } = await supabase
      .from("repayments")
      .select("*")
      .in("loan_id", loanIds)
      .order("due_date", { ascending: true });

    if (data) repayments = data;
  }

  const payfastConfig = getPayFastConfig();
  const payfastReady = Boolean(payfastConfig?.baseUrl);
  /** PayFast servers cannot POST ITN to these hosts unless PAYFAST_NOTIFY_URL points to a public tunnel. */
  const appBaseIsNonPublic =
    payfastConfig &&
    /localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}/i.test(
      payfastConfig.baseUrl
    );
  const itnNeedsPublicNotifyUrl =
    payfastReady && payfastConfig && appBaseIsNonPublic && !process.env.PAYFAST_NOTIFY_URL?.trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Repayments</h1>
        <p className="text-muted-foreground">
          Track your upcoming and past repayments
        </p>
      </div>

      {params.paid === "1" && (
        <div
          className={
            itnNeedsPublicNotifyUrl
              ? "rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
              : "rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
          }
        >
          {itnNeedsPublicNotifyUrl ? (
            <>
              <p className="font-medium">PayFast reported success, but this environment cannot receive webhooks.</p>
              <p className="mt-1 text-muted-foreground dark:text-amber-200/90">
                Repayments update only when PayFast POSTs to your ITN URL (<code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900">/api/payfast/notify</code>).
                PayFast cannot reach <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900">localhost</code>. Set{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900">PAYFAST_NOTIFY_URL</code> to a public HTTPS URL (e.g. ngrok) pointing at that route, restart the app, then pay again—or test after deploying to a public URL.
              </p>
            </>
          ) : (
            <p>Payment received. Your repayment will be updated shortly.</p>
          )}
        </div>
      )}
      {params.cancelled === "1" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Payment was cancelled. You can try again when ready.
        </div>
      )}

      {payfastReady && itnNeedsPublicNotifyUrl && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
          <p className="font-medium">Local dev: repayment totals will not update after PayFast unless ITN can reach your machine.</p>
          <p className="mt-1 text-muted-foreground dark:text-blue-200/90">
            Set <code className="rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900">PAYFAST_NOTIFY_URL=https://&lt;your-tunnel&gt;/api/payfast/notify</code> in{" "}
            <code className="rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900">.env.local</code> (see <code className="rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900">.env.example</code>).
          </p>
        </div>
      )}

      {!payfastReady && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-medium">PayFast checkout is not configured on this server.</p>
          <p className="mt-1 text-muted-foreground dark:text-amber-200/90">
            Add <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900">PAYFAST_MERCHANT_ID</code>,{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900">PAYFAST_MERCHANT_KEY</code>, and{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900">NEXT_PUBLIC_APP_URL</code> to{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900">.env.local</code> (see{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900">.env.example</code>
            ). Use PayFast sandbox credentials until you go live. Full steps:{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900">docs/PAYFAST_INTEGRATION.md</code>.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Repayment Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {repayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No repayments to show.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount Due</TableHead>
                  <TableHead>Amount Paid</TableHead>
                  <TableHead>Paid On</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repayments.map((rep) => (
                  <TableRow
                    key={rep.id}
                    className={
                      isRepaymentOverdue(rep)
                        ? "bg-destructive/5 dark:bg-destructive/10"
                        : undefined
                    }
                  >
                    <TableCell>
                      {new Date(rep.due_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      R{Number(rep.amount_due).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      R{Number(rep.amount_paid).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {rep.paid_at
                        ? new Date(rep.paid_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>{repaymentStatusCell(rep)}</TableCell>
                    <TableCell className="text-right">
                      {!isFullyPaid(rep) ? (
                        <PayFastButton repaymentId={rep.id} payfastReady={payfastReady} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
