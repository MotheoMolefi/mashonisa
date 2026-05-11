/**
 * Single loan view for the borrower: summary cards + repayment schedule table.
 * RLS ensures the loan belongs to the logged-in user.
 */
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
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
import { isRepaymentOverdue } from "@/lib/repayments";

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

export default async function LoanDetailPage({
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

  const { data: loan } = await supabase
    .from("loans")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!loan) notFound();

  const { data: repayments } = await supabase
    .from("repayments")
    .select("*")
    .eq("loan_id", loan.id)
    .order("due_date", { ascending: true });

  const paidCount =
    repayments?.filter((r) => r.status === "paid").length ?? 0;
  const totalCount = repayments?.length ?? 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Loan Details</h1>
        <p className="text-muted-foreground">
          Started{" "}
          {loan.start_date
            ? new Date(loan.start_date).toLocaleDateString()
            : "Pending disbursement"}
        </p>
      </div>

      {/* Loan Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Principal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              R{Number(loan.principal).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Payable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              R{Number(loan.total_payable).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        {(loan.admin_fee != null || loan.interest_amount != null) ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cost breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Admin fee</span>
                <span>R{Number(loan.admin_fee ?? 0).toFixed(2)}</span>
              </div>
              {Number(loan.vat_amount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT</span>
                  <span>R{Number(loan.vat_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interest</span>
                <span>R{Number(loan.interest_amount ?? 0).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Interest Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {Number(loan.interest_rate)}% p.m.
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {paidCount}/{totalCount}
            </div>
            <p className="text-xs text-muted-foreground">payments made</p>
          </CardContent>
        </Card>
      </div>

      {/* Repayment Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Repayment Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {!repayments || repayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No repayment schedule generated yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount Due</TableHead>
                  <TableHead>Amount Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repayments.map((rep, i) => (
                  <TableRow
                    key={rep.id}
                    className={
                      isRepaymentOverdue(rep)
                        ? "bg-destructive/5 dark:bg-destructive/10"
                        : undefined
                    }
                  >
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      {new Date(rep.due_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      R{Number(rep.amount_due).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      R{Number(rep.amount_paid).toLocaleString()}
                    </TableCell>
                    <TableCell>{repaymentStatusCell(rep)}</TableCell>
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
