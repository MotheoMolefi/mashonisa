"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const headerLine = headers.map(escape).join(",");
  const dataLines = rows.map((row) => row.map(escape).join(","));
  return [headerLine, ...dataLines].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState<string | null>(null);

  async function exportApplications() {
    setLoading("applications");
    const { data } = await supabase
      .from("loan_applications")
      .select("*, profiles(full_name)")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      toast.error("No data to export");
      setLoading(null);
      return;
    }

    const csv = toCsv(
      ["Applicant", "Amount", "Term", "Income", "Expenses", "Debt", "Status", "Submitted"],
      data.map((a) => [
        a.profiles?.full_name || "Unknown",
        String(a.amount_requested),
        String(a.term_months),
        String(a.monthly_income),
        String(a.monthly_expenses),
        String(a.existing_debt),
        a.status,
        a.submitted_at || "",
      ])
    );

    downloadCsv("mashonisa_applications.csv", csv);
    toast.success("Applications exported");
    setLoading(null);
  }

  async function exportLoans() {
    setLoading("loans");
    const { data } = await supabase
      .from("loans")
      .select("*, profiles(full_name)")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      toast.error("No data to export");
      setLoading(null);
      return;
    }

    const csv = toCsv(
      ["Borrower", "Principal", "Interest Rate", "Total Payable", "Status", "Start Date"],
      data.map((l) => [
        l.profiles?.full_name || "Unknown",
        String(l.principal),
        String(l.interest_rate),
        String(l.total_payable),
        l.status,
        l.start_date || "Not disbursed",
      ])
    );

    downloadCsv("mashonisa_loans.csv", csv);
    toast.success("Loan book exported");
    setLoading(null);
  }

  async function exportRepayments() {
    setLoading("repayments");
    const { data } = await supabase
      .from("repayments")
      .select("*, loans(principal, profiles(full_name))")
      .order("due_date", { ascending: false });

    if (!data || data.length === 0) {
      toast.error("No data to export");
      setLoading(null);
      return;
    }

    const csv = toCsv(
      ["Borrower", "Loan Amount", "Due Date", "Amount Due", "Amount Paid", "Status"],
      data.map((r) => {
        const loan = r.loans as { principal: number; profiles: { full_name: string } | null } | null;
        return [
          loan?.profiles?.full_name || "Unknown",
          String(loan?.principal || 0),
          r.due_date,
          String(r.amount_due),
          String(r.amount_paid),
          r.status,
        ];
      })
    );

    downloadCsv("mashonisa_repayments.csv", csv);
    toast.success("Repayments exported");
    setLoading(null);
  }

  async function exportAuditLogs() {
    setLoading("audit");
    const { data } = await supabase
      .from("audit_logs")
      .select("*, profiles(full_name)")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      toast.error("No data to export");
      setLoading(null);
      return;
    }

    const csv = toCsv(
      ["Timestamp", "Actor", "Action", "Entity Type", "Entity ID", "Details"],
      data.map((l) => [
        new Date(l.created_at).toISOString(),
        l.profiles?.full_name || "System",
        l.action,
        l.entity_type,
        l.entity_id || "",
        l.meta ? JSON.stringify(l.meta) : "",
      ])
    );

    downloadCsv("mashonisa_audit_log.csv", csv);
    toast.success("Audit log exported");
    setLoading(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Exports</h1>
        <p className="text-muted-foreground">
          Download reports as CSV files for compliance and record-keeping
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              All loan applications with applicant details, amounts, and status.
            </p>
            <Button
              onClick={exportApplications}
              disabled={loading === "applications"}
              variant="outline"
              className="w-full"
            >
              {loading === "applications" ? "Exporting..." : "Download CSV"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Loan Book</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              All loans with principal, interest, payable amounts, and status.
            </p>
            <Button
              onClick={exportLoans}
              disabled={loading === "loans"}
              variant="outline"
              className="w-full"
            >
              {loading === "loans" ? "Exporting..." : "Download CSV"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repayments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Full repayment ledger with due dates, amounts, and payment status.
            </p>
            <Button
              onClick={exportRepayments}
              disabled={loading === "repayments"}
              variant="outline"
              className="w-full"
            >
              {loading === "repayments" ? "Exporting..." : "Download CSV"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audit Log</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Complete activity trail for compliance and NCR audit readiness.
            </p>
            <Button
              onClick={exportAuditLogs}
              disabled={loading === "audit"}
              variant="outline"
              className="w-full"
            >
              {loading === "audit" ? "Exporting..." : "Download CSV"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
