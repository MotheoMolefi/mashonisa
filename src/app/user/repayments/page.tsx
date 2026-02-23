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

export default async function RepaymentsPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Repayments</h1>
        <p className="text-muted-foreground">
          Track your upcoming and past repayments
        </p>
      </div>

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {repayments.map((rep) => (
                  <TableRow key={rep.id}>
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
                    <TableCell>{repaymentStatusBadge(rep.status)}</TableCell>
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
