"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  const [tier, setTier] = useState<Tier | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);

  const [form, setForm] = useState({
    amount_requested: "",
    term_months: "",
    monthly_income: "",
    monthly_expenses: "",
    existing_debt: "",
  });

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch current tier
    const { data: tierHistory } = await supabase
      .from("user_tier_history")
      .select("*, tiers(*)")
      .eq("user_id", user.id)
      .is("effective_to", null)
      .single();

    if (tierHistory?.tiers) {
      setTier(tierHistory.tiers as unknown as Tier);
    } else {
      // Fallback to Basic tier
      const { data: basicTier } = await supabase
        .from("tiers")
        .select("*")
        .eq("name", "Basic")
        .single();
      if (basicTier) setTier(basicTier as Tier);
    }

    // Fetch documents
    const { data: userDocs } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id);

    if (userDocs) setDocs(userDocs as Document[]);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasIdDoc = docs.some((d) => d.type === "id_doc");
  const hasPayslip = docs.some((d) => d.type === "payslip");
  const canSubmit = hasIdDoc && hasPayslip;

  const amount = parseFloat(form.amount_requested) || 0;
  const term = parseInt(form.term_months) || 0;
  const income = parseFloat(form.monthly_income) || 0;
  const expenses = parseFloat(form.monthly_expenses) || 0;
  const debt = parseFloat(form.existing_debt) || 0;

  const disposable = income - expenses - debt;
  const maxInstallment = disposable * 0.3;
  const rate = (tier?.interest_rate ?? 5) / 100;
  const estimatedInstallment =
    term > 0 ? (amount * (1 + rate * term)) / term : 0;

  async function handleSubmit() {
    if (!canSubmit) {
      toast.error("Please upload your ID and payslip before submitting.");
      return;
    }

    if (amount <= 0 || term <= 0) {
      toast.error("Please enter valid loan amount and term.");
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
      estimatedInstallment <= maxInstallment;

    const affordabilityResult = {
      disposable_income: disposable,
      max_installment: maxInstallment,
      estimated_installment: estimatedInstallment,
      eligible,
      reasons: [] as string[],
    };

    if (!eligible) {
      if (estimatedInstallment > maxInstallment) {
        affordabilityResult.reasons.push(
          "Estimated installment exceeds 30% of disposable income"
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
        term_months: term,
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
    router.push(`/employee/application/${data.id}`);
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
            ? "Loan Request"
            : step === 2
              ? "Your Finances"
              : "Confirm & Submit"}
        </span>
      </div>

      {/* Step 1: Loan Request */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Loan Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tier && (
              <div className="rounded-md bg-muted p-3 text-sm">
                Your tier: <strong>{tier.name}</strong> — Max loan:{" "}
                <strong>R{Number(tier.max_loan).toLocaleString()}</strong> at{" "}
                <strong>{Number(tier.interest_rate)}% p.m.</strong>
              </div>
            )}
            <div className="space-y-2">
              <Label>Amount you want (ZAR)</Label>
              <Input
                type="number"
                min={500}
                max={tier ? Number(tier.max_loan) : 50000}
                value={form.amount_requested}
                onChange={(e) =>
                  setForm({ ...form, amount_requested: e.target.value })
                }
                placeholder="e.g. 5000"
              />
            </div>
            <div className="space-y-2">
              <Label>Months to repay</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={form.term_months}
                onChange={(e) =>
                  setForm({ ...form, term_months: e.target.value })
                }
                placeholder="e.g. 6"
              />
            </div>
            <Button
              onClick={() => setStep(2)}
              disabled={!form.amount_requested || !form.term_months}
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
              <Label>Monthly income (ZAR)</Label>
              <Input
                type="number"
                min={0}
                value={form.monthly_income}
                onChange={(e) =>
                  setForm({ ...form, monthly_income: e.target.value })
                }
                placeholder="e.g. 15000"
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
                placeholder="e.g. 8000"
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
                placeholder="e.g. 2000"
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
                <span className="text-muted-foreground">Term</span>
                <span className="font-medium">{term} months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interest Rate</span>
                <span className="font-medium">
                  {tier?.interest_rate ?? 5}% p.m.
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Est. Monthly Repayment
                </span>
                <span className="font-bold">
                  R{estimatedInstallment.toFixed(2)}
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
            {estimatedInstallment > maxInstallment && maxInstallment > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                Your estimated installment (R{estimatedInstallment.toFixed(2)})
                exceeds 30% of your disposable income (R
                {maxInstallment.toFixed(2)}). The application may be declined.
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
