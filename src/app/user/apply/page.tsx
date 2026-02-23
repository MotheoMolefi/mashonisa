"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Tier, Document } from "@/types/database";

type Step = 1 | 2 | 3;

export default function ApplyPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tier, setTier] = useState<Tier | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [hasActiveLoan, setHasActiveLoan] = useState(false);
  const [hasPendingApp, setHasPendingApp] = useState(false);

  const [form, setForm] = useState({
    amount_requested: "",
    monthly_income: "",
    monthly_expenses: "",
    existing_debt: "",
  });

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tierHistory } = await supabase
      .from("user_tier_history")
      .select("*, tiers(*)")
      .eq("user_id", user.id)
      .is("effective_to", null)
      .single();

    if (tierHistory?.tiers) {
      setTier(tierHistory.tiers as unknown as Tier);
    } else {
      const { data: basicTier } = await supabase
        .from("tiers")
        .select("*")
        .eq("name", "Tier 1")
        .single();
      if (basicTier) setTier(basicTier as Tier);
    }

    const { data: userDocs } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id);
    if (userDocs) setDocs(userDocs as Document[]);

    // Check for active loan
    const { data: activeLoan } = await supabase
      .from("loans")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .single();
    setHasActiveLoan(!!activeLoan);

    // Check for pending/in-review application
    const { data: pendingApp } = await supabase
      .from("loan_applications")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["submitted", "under_review"])
      .limit(1)
      .single();
    setHasPendingApp(!!pendingApp);

    setInitialLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasIdDoc = docs.some((d) => d.type === "id_doc");
  const hasPayslip = docs.some((d) => d.type === "payslip");
  const canSubmit = hasIdDoc && hasPayslip;

  const amount = parseFloat(form.amount_requested) || 0;
  const income = parseFloat(form.monthly_income) || 0;
  const expenses = parseFloat(form.monthly_expenses) || 0;
  const debt = parseFloat(form.existing_debt) || 0;

  const disposable = income - expenses - debt;
  const rate = (tier?.interest_rate ?? 5) / 100;
  // Single salary cycle — total repayment = principal + one month's interest
  const totalRepayment = amount * (1 + rate);

  // Block if active loan or pending application
  if (!initialLoading && (hasActiveLoan || hasPendingApp)) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Apply for a Loan
          </h1>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              {hasActiveLoan
                ? "You already have an active loan. You must settle your current loan before applying for a new one."
                : "You already have a pending application. Please wait for it to be reviewed before submitting a new one."}
            </div>
            <Button asChild variant="outline">
              <Link href="/user/loans">View my loans</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleSubmit() {
    if (!canSubmit) {
      toast.error("Please upload your ID and payslip before submitting.");
      return;
    }

    if (amount <= 0) {
      toast.error("Please enter a valid loan amount.");
      return;
    }

    if (tier && amount > Number(tier.max_loan)) {
      toast.error(
        `Amount exceeds your tier limit of R${Number(tier.max_loan).toLocaleString()}`
      );
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setLoading(false);
      return;
    }

    const eligible =
      canSubmit &&
      (tier ? amount <= Number(tier.max_loan) : true) &&
      totalRepayment <= disposable;

    const affordabilityResult = {
      disposable_income: disposable,
      total_repayment: totalRepayment,
      eligible,
      reasons: [] as string[],
    };

    if (!eligible) {
      if (totalRepayment > disposable) {
        affordabilityResult.reasons.push(
          "Total repayment exceeds disposable income"
        );
      }
      if (tier && amount > Number(tier.max_loan)) {
        affordabilityResult.reasons.push("Amount exceeds tier limit");
      }
    }

    const { data, error } = await supabase
      .from("loan_applications")
      .insert({
        user_id: user.id,
        amount_requested: amount,
        term_months: 1,
        monthly_income: income,
        monthly_expenses: expenses,
        existing_debt: debt,
        affordability_result: affordabilityResult,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      toast.error("Submission failed: " + error.message);
      setLoading(false);
      return;
    }

    toast.success("Application submitted!");
    router.push(`/user/application/${data.id}`);
  }

  if (initialLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Apply for a Loan
          </h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Apply for a Loan
        </h1>
        <p className="text-muted-foreground">
          Complete all steps to submit your application
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step >= s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`h-0.5 w-8 ${
                  step > s ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          {step === 1
            ? "Loan Amount"
            : step === 2
              ? "Your Finances"
              : "Confirm & Submit"}
        </span>
      </div>

      {/* Step 1: Loan Amount */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Loan Amount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tier && (
              <div className="rounded-md bg-muted p-3 text-sm">
                Your tier: <strong>{tier.name}</strong> — Max loan:{" "}
                <strong>R{Number(tier.max_loan).toLocaleString()}</strong> at{" "}
                <strong>{Number(tier.interest_rate)}% interest</strong>
              </div>
            )}
            <div className="rounded-md bg-muted p-3 text-sm">
              Repayment is due within <strong>one salary cycle</strong> (next payday).
            </div>
            <div className="space-y-2">
              <Label>Amount you want (ZAR)</Label>
              <Input
                type="number"
                min={100}
                max={tier ? Number(tier.max_loan) : 1000}
                value={form.amount_requested}
                onChange={(e) =>
                  setForm({ ...form, amount_requested: e.target.value })
                }
                placeholder={`e.g. ${tier ? Number(tier.max_loan) : 700}`}
              />
            </div>
            <Button
              onClick={() => setStep(2)}
              disabled={!form.amount_requested}
            >
              Next
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Finances */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Your Monthly Finances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Monthly net salary (ZAR)</Label>
              <Input
                type="number"
                min={0}
                value={form.monthly_income}
                onChange={(e) =>
                  setForm({ ...form, monthly_income: e.target.value })
                }
                placeholder="e.g. 8000"
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly expenses (ZAR)</Label>
              <Input
                type="number"
                min={0}
                value={form.monthly_expenses}
                onChange={(e) =>
                  setForm({ ...form, monthly_expenses: e.target.value })
                }
                placeholder="e.g. 5000"
              />
            </div>
            <div className="space-y-2">
              <Label>Existing debt repayments (ZAR)</Label>
              <Input
                type="number"
                min={0}
                value={form.existing_debt}
                onChange={(e) =>
                  setForm({ ...form, existing_debt: e.target.value })
                }
                placeholder="e.g. 1000"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!form.monthly_income}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Confirm & Submit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-md border p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loan Amount</span>
                <span className="font-medium">
                  R{amount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Repayment Term</span>
                <span className="font-medium">1 salary cycle</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interest Rate</span>
                <span className="font-medium">
                  {tier?.interest_rate ?? 5}%
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">
                  Total Repayment
                </span>
                <span className="font-bold">
                  R{totalRepayment.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Documents Check */}
            <div className="space-y-2">
              <p className="font-medium">Documents</p>
              <div className="flex gap-2">
                <Badge variant={hasIdDoc ? "default" : "destructive"}>
                  ID {hasIdDoc ? "✓" : "✗"}
                </Badge>
                <Badge variant={hasPayslip ? "default" : "destructive"}>
                  Payslip {hasPayslip ? "✓" : "✗"}
                </Badge>
              </div>
              {!canSubmit && (
                <p className="text-sm text-destructive">
                  Please upload required documents before submitting.
                </p>
              )}
            </div>

            {/* Affordability Warning */}
            {totalRepayment > disposable && disposable > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                Total repayment (R{totalRepayment.toFixed(2)}) exceeds your
                disposable income (R{disposable.toFixed(2)}). The application
                may be declined.
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={loading || !canSubmit}>
                {loading ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
