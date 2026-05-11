"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";
import {
  areAllRequiredLoanDocumentsVerified,
  missingVerifiedLoanDocuments,
  requiredLoanDocumentLabel,
} from "@/lib/documents";
import { getLoanPricing } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type {
  LoanApplication,
  Profile,
  Document,
  AffordabilityResult,
} from "@/types/database";

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [app, setApp] = useState<LoanApplication | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [adminNotes, setAdminNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: application } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("id", id)
      .single();

    if (!application) return;
    setApp(application as LoanApplication);
    setAdminNotes(application.admin_notes || "");

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", application.user_id)
      .single();
    if (userProfile) setProfile(userProfile as Profile);

    const { data: userDocs } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", application.user_id);
    if (userDocs) setDocs(userDocs as Document[]);

    setLoading(false);
  }, [supabase, id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function updateStatus(newStatus: string) {
    if (!app) return;
    setActionLoading(true);

    const { error } = await supabase
      .from("loan_applications")
      .update({ status: newStatus, admin_notes: adminNotes })
      .eq("id", app.id);

    if (error) {
      toast.error("Failed to update: " + error.message);
      setActionLoading(false);
      return;
    }

    await logAudit(supabase, {
      action: `APPLICATION_${newStatus.toUpperCase()}`,
      entityType: "loan_application",
      entityId: app.id,
      meta: { admin_notes: adminNotes },
    });

    if (newStatus === "rejected") {
      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "application_rejected",
          userId: app.user_id,
          applicationId: app.id,
        }),
      }).catch(() => {});
    }

    toast.success(`Application ${newStatus.replace("_", " ")}`);
    setApp({ ...app, status: newStatus as LoanApplication["status"] });
    setActionLoading(false);
  }

  async function handleApprove() {
    if (!app || !profile) return;
    setActionLoading(true);

    const { data: latestDocs } = await supabase
      .from("documents")
      .select("type, status")
      .eq("user_id", app.user_id);

    const latest = latestDocs ?? [];
    if (!areAllRequiredLoanDocumentsVerified(latest)) {
      const missing = missingVerifiedLoanDocuments(latest);
      toast.error("All three documents must be verified before approval.", {
        description: `Still need: ${missing.map(requiredLoanDocumentLabel).join(", ")}`,
      });
      setActionLoading(false);
      return;
    }

    // Fetch user's current tier for interest rate
    const { data: tierHistory } = await supabase
      .from("user_tier_history")
      .select("*, tiers(*)")
      .eq("user_id", app.user_id)
      .is("effective_to", null)
      .single();

    const principal = Number(app.amount_requested);
    const { totalPayable, adminFee, vatAmount, interestAmount } = getLoanPricing(principal);
    const interestRate = principal > 0 ? (interestAmount / principal) * 100 : 0;

    // Create loan
    const { data: loan, error: loanError } = await supabase
      .from("loans")
      .insert({
        application_id: app.id,
        user_id: app.user_id,
        principal,
        interest_rate: Math.round(interestRate * 100) / 100,
        fees: 0,
        admin_fee: adminFee,
        vat_amount: vatAmount,
        interest_amount: interestAmount,
        total_payable: totalPayable,
        status: "active",
      })
      .select()
      .single();

    if (loanError) {
      toast.error("Failed to create loan: " + loanError.message);
      setActionLoading(false);
      return;
    }

    // Create single repayment entry (1 salary cycle = ~30 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    await supabase.from("repayments").insert({
      loan_id: loan.id,
      due_date: dueDate.toISOString().split("T")[0],
      amount_due: totalPayable,
      amount_paid: 0,
      status: "due",
    });

    // Update application status
    await supabase
      .from("loan_applications")
      .update({ status: "approved", admin_notes: adminNotes })
      .eq("id", app.id);

    await logAudit(supabase, {
      action: "APPLICATION_APPROVED",
      entityType: "loan_application",
      entityId: app.id,
      meta: { loan_id: loan.id, principal, total_payable: totalPayable },
    });

    await logAudit(supabase, {
      action: "LOAN_CREATED",
      entityType: "loan",
      entityId: loan.id,
      meta: { principal, total_payable: totalPayable, admin_fee: adminFee, vat_amount: vatAmount, interest_amount: interestAmount },
    });

    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "application_approved",
        userId: app.user_id,
        applicationId: app.id,
        loanId: loan.id,
        amount: principal,
        totalPayable,
      }),
    }).catch(() => {});

    toast.success("Application approved and loan created!");
    router.push(`/admin/loans/${loan.id}`);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Loading...</h1>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Application not found
        </h1>
      </div>
    );
  }

  const affordability = app.affordability_result as AffordabilityResult | null;
  const isActionable = app.status === "submitted" || app.status === "under_review";
  const previewPricing = app.amount_requested ? getLoanPricing(Number(app.amount_requested)) : null;
  const missingVerifiedDocs = missingVerifiedLoanDocuments(docs);
  const allThreeDocumentsVerified = areAllRequiredLoanDocumentsVerified(docs);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Application Review
          </h1>
          <p className="text-muted-foreground">
            {profile?.full_name || "Unknown applicant"}
          </p>
        </div>
        <Badge
          variant={
            app.status === "approved" || app.status === "disbursed"
              ? "default"
              : app.status === "rejected"
                ? "destructive"
                : "secondary"
          }
        >
          {app.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Applicant Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Applicant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{profile?.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{profile?.phone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ID Number</span>
              <span className="font-medium">{profile?.id_number || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Joined</span>
              <span className="font-medium">
                {new Date(profile?.created_at || "").toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Loan Request */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Loan Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-bold">
                R{Number(app.amount_requested).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Term</span>
              <span className="font-medium">1 salary cycle</span>
            </div>
            {previewPricing && (
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Total payable (35%)</span>
                <span className="font-bold">R{previewPricing.totalPayable.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly Income</span>
              <span className="font-medium">
                R{Number(app.monthly_income).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly Expenses</span>
              <span className="font-medium">
                R{Number(app.monthly_expenses).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Existing Debt</span>
              <span className="font-medium">
                R{Number(app.existing_debt).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Affordability Result */}
      {affordability && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Affordability Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Disposable Income</span>
              <span className="font-medium">
                R{affordability.disposable_income?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Eligible</span>
              <Badge variant={affordability.eligible ? "default" : "destructive"}>
                {affordability.eligible ? "Yes" : "No"}
              </Badge>
            </div>
            {affordability.reasons?.length > 0 && (
              <div className="mt-2 rounded-md bg-destructive/10 p-3 text-destructive">
                {affordability.reasons.map((r, i) => (
                  <p key={i}>{r}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length > 0 ? (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <span className="font-medium text-sm">
                      {doc.type.replace("_", " ").toUpperCase()}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {doc.file_name}
                    </span>
                  </div>
                  <Badge
                    variant={
                      doc.status === "verified"
                        ? "default"
                        : doc.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {doc.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No documents uploaded
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Notes + approval actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Action Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isActionable && !allThreeDocumentsVerified && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <p className="font-medium">All three documents must be verified</p>
              <p className="mt-1 text-muted-foreground dark:text-amber-200/90">
                Pending:{" "}
                {missingVerifiedDocs.map(requiredLoanDocumentLabel).join(", ")}.
              </p>
              <Link
                href="/admin/documents"
                className="mt-2 inline-block text-sm font-medium text-amber-900 underline underline-offset-4 hover:text-amber-800 dark:text-amber-100 dark:hover:text-amber-50"
              >
                Open Documents →
              </Link>
            </div>
          )}

          <div className="space-y-2">
            <Label>Admin Notes</Label>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add notes about this application..."
              disabled={!isActionable}
            />
          </div>

          {isActionable && (
            <div className="flex gap-2 flex-wrap">
              {app.status === "submitted" && (
                <Button
                  variant="outline"
                  onClick={() => updateStatus("under_review")}
                  disabled={actionLoading}
                >
                  Mark Under Review
                </Button>
              )}
              <Button
                onClick={handleApprove}
                disabled={actionLoading || !allThreeDocumentsVerified}
                title={
                  !allThreeDocumentsVerified
                    ? "All three (ID, payslip, bank statement) must be verified on Documents first"
                    : undefined
                }
              >
                {actionLoading ? "Processing..." : "Approve & Create Loan"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => updateStatus("rejected")}
                disabled={actionLoading}
              >
                Reject
              </Button>
            </div>
          )}

          {!isActionable && (
            <p className="text-sm text-muted-foreground">
              This application has been {app.status.replace("_", " ")}. No
              further actions available.
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <Link
          href="/admin/applications"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to applications
        </Link>
      </div>
    </div>
  );
}
