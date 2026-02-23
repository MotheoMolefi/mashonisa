"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Loan, Repayment, Profile } from "@/types/database";

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const fetchData = useCallback(async () => {
    const { data: loanData } = await supabase
      .from("loans")
      .select("*")
      .eq("id", id)
      .single();

    if (!loanData) return;
    setLoan(loanData as Loan);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", loanData.user_id)
      .single();
    if (profileData) setProfile(profileData as Profile);

    const { data: repaymentData } = await supabase
      .from("repayments")
      .select("*")
      .eq("loan_id", id)
      .order("due_date", { ascending: true });
    if (repaymentData) setRepayments(repaymentData as Repayment[]);

    setLoading(false);
  }, [supabase, id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDisburse() {
    if (!loan) return;
    setActionLoading(true);

    const today = new Date().toISOString().split("T")[0];

    await supabase
      .from("loans")
      .update({ start_date: today })
      .eq("id", loan.id);

    await supabase
      .from("loan_applications")
      .update({ status: "disbursed" })
      .eq("id", loan.application_id);

    await logAudit(supabase, {
      action: "LOAN_DISBURSED",
      entityType: "loan",
      entityId: loan.id,
      meta: { start_date: today },
    });

    toast.success("Loan marked as disbursed");
    setLoan({ ...loan, start_date: today });
    setActionLoading(false);
  }

  async function handleRecordPayment() {
    if (!paymentDialog || !loan) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setActionLoading(true);

    const repayment = repayments.find((r) => r.id === paymentDialog);
    if (!repayment) return;

    const newAmountPaid = Number(repayment.amount_paid) + amount;
    const isPaid = newAmountPaid >= Number(repayment.amount_due);

    await supabase
      .from("repayments")
      .update({
        amount_paid: newAmountPaid,
        paid_at: new Date().toISOString(),
        status: isPaid ? "paid" : "partial",
      })
      .eq("id", paymentDialog);

    await logAudit(supabase, {
      action: "REPAYMENT_RECORDED",
      entityType: "repayment",
      entityId: paymentDialog,
      meta: { amount, loan_id: loan.id },
    });

    // Check if all repayments are paid — settle the loan
    const updatedRepayments = repayments.map((r) =>
      r.id === paymentDialog
        ? { ...r, amount_paid: newAmountPaid, status: isPaid ? "paid" as const : "partial" as const }
        : r
    );

    const allPaid = updatedRepayments.every((r) => r.status === "paid");
    if (allPaid) {
      await supabase
        .from("loans")
        .update({ status: "settled" })
        .eq("id", loan.id);

      await logAudit(supabase, {
        action: "LOAN_SETTLED",
        entityType: "loan",
        entityId: loan.id,
      });

      setLoan({ ...loan, status: "settled" });
      toast.success("Payment recorded — loan fully settled!");
    } else {
      toast.success("Payment recorded");
    }

    setRepayments(updatedRepayments);
    setPaymentDialog(null);
    setPaymentAmount("");
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Loading...</h1>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Loan not found</h1>
      </div>
    );
  }

  const isActive = loan.status === "active";
  const isDisbursed = !!loan.start_date;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loan Detail</h1>
          <p className="text-muted-foreground">
            {profile?.full_name || "Unknown borrower"}
          </p>
        </div>
        <Badge
          variant={
            loan.status === "settled"
              ? "secondary"
              : loan.status === "in_arrears"
                ? "destructive"
                : "default"
          }
        >
          {loan.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Loan Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Principal</span>
              <span className="font-bold">
                R{Number(loan.principal).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Rate</span>
              <span className="font-medium">{Number(loan.interest_rate)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Payable</span>
              <span className="font-bold">
                R{Number(loan.total_payable).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span className="font-medium">
                {loan.start_date
                  ? new Date(loan.start_date).toLocaleDateString()
                  : "Not disbursed"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isActive && !isDisbursed && (
              <Button
                onClick={handleDisburse}
                disabled={actionLoading}
                className="w-full"
              >
                {actionLoading ? "Processing..." : "Mark as Disbursed"}
              </Button>
            )}
            {isActive && isDisbursed && (
              <p className="text-sm text-muted-foreground">
                Loan is active and disbursed. Record payments below.
              </p>
            )}
            {loan.status === "settled" && (
              <p className="text-sm text-muted-foreground">
                This loan has been fully settled.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Repayments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repayment Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount Due</TableHead>
                  <TableHead>Amount Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repayments.map((r) => {
                  const isLate =
                    r.status !== "paid" &&
                    new Date(r.due_date) < new Date();
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        {new Date(r.due_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>R{Number(r.amount_due).toFixed(2)}</TableCell>
                      <TableCell>R{Number(r.amount_paid).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.status === "paid"
                              ? "default"
                              : isLate
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {isLate && r.status !== "paid" ? "late" : r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.status !== "paid" && isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPaymentDialog(r.id);
                              setPaymentAmount(
                                String(Number(r.amount_due) - Number(r.amount_paid))
                              );
                            }}
                          >
                            Record Payment
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {repayments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No repayments scheduled
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog
        open={!!paymentDialog}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentDialog(null);
            setPaymentAmount("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount Received (ZAR)</Label>
              <Input
                type="number"
                min={0}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="e.g. 735"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPaymentDialog(null);
                setPaymentAmount("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={actionLoading}>
              {actionLoading ? "Saving..." : "Save Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <Link
          href="/admin/loans"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to loans
        </Link>
      </div>
    </div>
  );
}
