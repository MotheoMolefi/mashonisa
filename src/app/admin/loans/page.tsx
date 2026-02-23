import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LoanStatus } from "@/types/database";

const statusVariant: Record<LoanStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  settled: "secondary",
  in_arrears: "destructive",
  written_off: "outline",
};

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: filterStatus } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("loans")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false });

  if (filterStatus && filterStatus !== "all") {
    query = query.eq("status", filterStatus);
  }

  const { data: loans } = await query;

  const statuses: LoanStatus[] = ["active", "settled", "in_arrears", "written_off"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Loans</h1>
        <p className="text-muted-foreground">Track and manage all loans</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Link href="/admin/loans">
          <Badge
            variant={!filterStatus || filterStatus === "all" ? "default" : "outline"}
            className="cursor-pointer"
          >
            All
          </Badge>
        </Link>
        {statuses.map((s) => (
          <Link key={s} href={`/admin/loans?status=${s}`}>
            <Badge
              variant={filterStatus === s ? "default" : "outline"}
              className="cursor-pointer"
            >
              {s.replace("_", " ")}
            </Badge>
          </Link>
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Borrower</TableHead>
              <TableHead>Principal</TableHead>
              <TableHead>Total Payable</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans && loans.length > 0 ? (
              loans.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">
                    {loan.profiles?.full_name || "Unknown"}
                  </TableCell>
                  <TableCell>R{Number(loan.principal).toLocaleString()}</TableCell>
                  <TableCell>R{Number(loan.total_payable).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[loan.status as LoanStatus] ?? "outline"}>
                      {loan.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {loan.start_date
                      ? new Date(loan.start_date).toLocaleDateString()
                      : "Not disbursed"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/loans/${loan.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Manage
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No loans found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
