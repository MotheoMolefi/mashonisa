import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function loanStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge>Active</Badge>;
    case "settled":
      return <Badge className="bg-green-600">Settled</Badge>;
    case "in_arrears":
      return <Badge variant="destructive">In Arrears</Badge>;
    case "written_off":
      return <Badge variant="outline">Written Off</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default async function LoansPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: loans } = await supabase
    .from("loans")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Loans</h1>
        <p className="text-muted-foreground">
          View your loan history and details
        </p>
      </div>

      {!loans || loans.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">You don&apos;t have any loans yet.</p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/employee/apply">Apply for a loan</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Principal</TableHead>
                  <TableHead>Total Payable</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">
                      R{Number(loan.principal).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      R{Number(loan.total_payable).toLocaleString()}
                    </TableCell>
                    <TableCell>{Number(loan.interest_rate)}%</TableCell>
                    <TableCell>
                      {loan.start_date
                        ? new Date(loan.start_date).toLocaleDateString()
                        : "Pending"}
                    </TableCell>
                    <TableCell>{loanStatusBadge(loan.status)}</TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/employee/loans/${loan.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
