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
import type { ApplicationStatus } from "@/types/database";

const statusVariant: Record<ApplicationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  submitted: "secondary",
  under_review: "secondary",
  approved: "default",
  rejected: "destructive",
  disbursed: "default",
  cancelled: "outline",
};

export default async function ApplicationsPage({
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
    .from("loan_applications")
    .select("*, profiles(full_name, phone)")
    .order("created_at", { ascending: false });

  if (filterStatus && filterStatus !== "all") {
    query = query.eq("status", filterStatus);
  }

  const { data: applications } = await query;

  const statuses: ApplicationStatus[] = [
    "submitted",
    "under_review",
    "approved",
    "rejected",
    "disbursed",
    "cancelled",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Loan Applications
        </h1>
        <p className="text-muted-foreground">Review and process applications</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Link href="/admin/applications">
          <Badge
            variant={!filterStatus || filterStatus === "all" ? "default" : "outline"}
            className="cursor-pointer"
          >
            All
          </Badge>
        </Link>
        {statuses.map((s) => (
          <Link key={s} href={`/admin/applications?status=${s}`}>
            <Badge
              variant={filterStatus === s ? "default" : "outline"}
              className="cursor-pointer"
            >
              {s.replace("_", " ")}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications && applications.length > 0 ? (
              applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-medium">
                    {app.profiles?.full_name || "Unknown"}
                  </TableCell>
                  <TableCell>R{Number(app.amount_requested).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[app.status as ApplicationStatus] ?? "outline"}>
                      {app.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {app.submitted_at
                      ? new Date(app.submitted_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/applications/${app.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Review
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No applications found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
