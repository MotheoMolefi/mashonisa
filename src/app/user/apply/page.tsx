"use client";

/**
 * Multi-step loan application (client component): documents → finances & payday →
 * amount → confirm/submit. Draft persisted in localStorage; uploads go to Storage + `documents`.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { CalendarIcon, FileText, X } from "lucide-react";
import { startOfDay } from "date-fns";
import { getLoanPricing } from "@/lib/pricing";
import type { Tier, Document, DocumentType, DocumentStatus } from "@/types/database";

type Step = 1 | 2 | 3 | 4;

const REQUIRED_DOCS: { type: DocumentType; label: string }[] = [
  { type: "id_doc", label: "ID Document" },
  { type: "payslip", label: "Latest Payslip" },
  { type: "bank_statement", label: "Bank Statement" },
];

const STEP_LABELS = ["Your Documents", "Your Finances", "Loan Amount", "Confirm & Submit"];

function statusBadge(status: DocumentStatus) {
  switch (status) {
    case "verified":
      return <Badge className="bg-green-600">Verified</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="secondary">Uploaded</Badge>;
  }
}

export default function ApplyPage() {
  const router = useRouter();
  // Stable instance so useCallback(fetchData) and its useEffect do not re-run every render.
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingDocs, setPendingDocs] = useState<Partial<Record<DocumentType, File>>>({});
  const fileInputRefs = useRef<Partial<Record<DocumentType, HTMLInputElement>>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [tier, setTier] = useState<Tier | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [hasActiveLoan, setHasActiveLoan] = useState(false);
  const [hasPendingApp, setHasPendingApp] = useState(false);

  const FORM_KEY = "mashonisa_apply_draft_v2";
  const STEP_KEY = "mashonisa_apply_step_v2";

  const [form, setForm] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(FORM_KEY);
      if (saved) return JSON.parse(saved);
    }
    return { amount_requested: "", monthly_income: "", monthly_expenses: "", existing_debt: "", next_pay_date: "" };
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Remove stale keys from the old 3-step flow
      localStorage.removeItem("mashonisa_apply_draft");
      localStorage.removeItem("mashonisa_apply_step");

      const savedStep = localStorage.getItem(STEP_KEY);
      if (savedStep) setStep(Number(savedStep) as Step);
    }
  }, []);

  const setFormAndSave = (values: typeof form) => {
    setForm(values);
    localStorage.setItem(FORM_KEY, JSON.stringify(values));
  };

  const goToStep = (s: Step) => {
    setStep(s);
    localStorage.setItem(STEP_KEY, String(s));
  };

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

    const { data: activeLoan } = await supabase
      .from("loans")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .single();
    setHasActiveLoan(!!activeLoan);

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
  const hasBankStatement = docs.some((d) => d.type === "bank_statement");
  const hasIdDocOrPending = hasIdDoc || !!pendingDocs.id_doc;
  const hasPayslipOrPending = hasPayslip || !!pendingDocs.payslip;
  const hasBankStatementOrPending = hasBankStatement || !!pendingDocs.bank_statement;
  const canProceedFromStep1 =
    hasIdDocOrPending && hasPayslipOrPending && hasBankStatementOrPending;
  const canSubmit = hasIdDoc && hasPayslip && hasBankStatement;

  const amount = parseFloat(form.amount_requested) || 0;
  const income = parseFloat(form.monthly_income) || 0;
  const expenses = parseFloat(form.monthly_expenses) || 0;
  const debt = parseFloat(form.existing_debt) || 0;

  const disposable = income - expenses - debt;

  const todayStart = startOfDay(new Date());
  const paydayDate = form.next_pay_date
    ? new Date(form.next_pay_date + "T12:00:00")
    : null;
  const isPaydayValid =
    !!form.next_pay_date &&
    !!paydayDate &&
    !Number.isNaN(paydayDate.getTime()) &&
    startOfDay(paydayDate) >= todayStart;
  const pricing = amount > 0 ? getLoanPricing(amount) : null;
  const totalRepayment = pricing?.totalPayable ?? 0;

  function handleFileSelect(type: DocumentType, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 10MB.");
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Invalid file type. Upload PDF, JPG, PNG, or WebP.");
      return;
    }
    setPendingDocs((prev) => ({ ...prev, [type]: file }));
  }

  async function uploadOneDocument(type: DocumentType, file: File): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: existingRows } = await supabase
      .from("documents")
      .select("id, storage_path")
      .eq("user_id", user.id)
      .eq("type", type);
    if (existingRows?.length) {
      const paths = existingRows.map((r) => r.storage_path);
      await supabase.storage.from("documents").remove(paths);
      await supabase.from("documents").delete().eq("user_id", user.id).eq("type", type);
    }
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);
    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      return false;
    }
    const { error: dbError } = await supabase.from("documents").insert({
      user_id: user.id,
      type,
      storage_path: filePath,
      file_name: file.name,
      status: "uploaded",
    });
    if (dbError) {
      toast.error("Failed to save document: " + dbError.message);
      return false;
    }
    return true;
  }

  async function handleStep1Next() {
    if (!canProceedFromStep1) return;
    const toUpload = REQUIRED_DOCS.filter((req) => pendingDocs[req.type]);
    if (toUpload.length === 0) {
      goToStep(2);
      return;
    }
    setUploading(true);
    for (const { type } of toUpload) {
      const file = pendingDocs[type];
      if (!file) continue;
      const ok = await uploadOneDocument(type, file);
      if (!ok) {
        setUploading(false);
        return;
      }
    }
    setPendingDocs({});
    REQUIRED_DOCS.forEach(({ type }) => {
      const input = fileInputRefs.current[type];
      if (input) input.value = "";
    });
    await fetchData();
    setUploading(false);
    goToStep(2);
  }

  async function handleRemoveDocument(doc: Document) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: rows, error: selectError } = await supabase
      .from("documents")
      .select("id, storage_path")
      .eq("user_id", user.id)
      .eq("type", doc.type);

    if (selectError) {
      toast.error("Failed to load documents: " + selectError.message);
      return;
    }

    if (!rows?.length) {
      await fetchData();
      return;
    }

    const ids = rows.map((r) => r.id);
    const { data: deleted, error: dbError } = await supabase
      .from("documents")
      .delete()
      .in("id", ids)
      .select("id, storage_path");

    if (dbError) {
      toast.error("Failed to remove document: " + dbError.message);
      return;
    }

    if (!deleted?.length) {
      toast.error(
        "Could not delete the document in the database. Run migration 20250407_documents_user_delete.sql on your Supabase project (adds the policy users need to remove uploads), then try again."
      );
      return;
    }

    const paths = [...new Set(deleted.map((r) => r.storage_path).filter(Boolean))];
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("documents").remove(paths);
      if (storageError) {
        toast.warning("Document removed from your application, but storage cleanup failed: " + storageError.message);
      }
    }

    await fetchData();
    toast.success("Document removed");
  }

  async function handleSubmit() {
    if (!canSubmit) {
      toast.error("Please upload your ID and payslip.");
      return;
    }
    if (amount <= 0) {
      toast.error("Please enter a valid loan amount.");
      return;
    }
    if (tier && amount > Number(tier.max_loan)) {
      toast.error(`Amount exceeds your tier limit of R${Number(tier.max_loan).toLocaleString()}`);
      return;
    }
    if (!form.next_pay_date) {
      toast.error("Please provide your next payday.");
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
    if (totalRepayment > disposable)
      affordabilityResult.reasons.push("Total repayment exceeds disposable income");
    if (tier && amount > Number(tier.max_loan))
      affordabilityResult.reasons.push("Amount exceeds tier limit");

    const { data, error } = await supabase
      .from("loan_applications")
      .insert({
        user_id: user.id,
        amount_requested: amount,
        term_months: 1,
        monthly_income: income,
        monthly_expenses: expenses,
        existing_debt: debt,
        next_pay_date: form.next_pay_date || null,
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

    localStorage.removeItem(FORM_KEY);
    localStorage.removeItem(STEP_KEY);
    toast.success("Application submitted!");
    router.push(`/user/application/${data.id}`);
  }

  if (initialLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">Apply for a Loan</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (hasActiveLoan || hasPendingApp) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">Apply for a Loan</h1>
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Apply for a Loan</h1>
        <p className="text-muted-foreground">Complete all steps to submit your application</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
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
            {s < 4 && (
              <div className={`h-0.5 w-8 ${step > s ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">{STEP_LABELS[step - 1]}</span>
      </div>

      {/* Step 1: Documents */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Your Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload your ID, latest payslip, and bank statement to verify your identity and income. All three are required before you can proceed.
            </p>

            {REQUIRED_DOCS.map((req) => {
              const existing = docs.find((d) => d.type === req.type);
              const pendingFile = pendingDocs[req.type];

              return (
                <div key={req.type} className="rounded-md border p-4 space-y-3">
                  <Label className="font-medium">{req.label}</Label>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {existing || pendingFile ? "Replace file" : "Upload file"} (PDF, JPG, PNG — max 10MB)
                    </Label>
                    <Input
                      ref={(el) => {
                        fileInputRefs.current[req.type] = el ?? undefined;
                      }}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => handleFileSelect(req.type, e)}
                      disabled={uploading}
                    />
                  </div>
                  {existing && !pendingFile && (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate" title={existing.file_name}>
                          {existing.file_name}
                        </span>
                        {statusBadge(existing.status as DocumentStatus)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveDocument(existing)}
                        disabled={uploading}
                        aria-label="Remove document"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {pendingFile && (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate" title={pendingFile.name}>
                          {pendingFile.name}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setPendingDocs((prev) => ({ ...prev, [req.type]: undefined }));
                          const input = fileInputRefs.current[req.type];
                          if (input) input.value = "";
                        }}
                        disabled={uploading}
                        aria-label="Remove document"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {uploading && (
              <p className="text-sm text-muted-foreground">Uploading documents...</p>
            )}
            <Button
              onClick={handleStep1Next}
              disabled={!canProceedFromStep1 || uploading}
            >
              {uploading ? "Uploading..." : canProceedFromStep1 ? "Next" : "Upload all documents to continue"}
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
                onChange={(e) => setFormAndSave({ ...form, monthly_income: e.target.value })}
                placeholder="e.g. 8000"
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly expenses (ZAR)</Label>
              <Input
                type="number"
                min={0}
                value={form.monthly_expenses}
                onChange={(e) => setFormAndSave({ ...form, monthly_expenses: e.target.value })}
                placeholder="e.g. 5000"
              />
            </div>
            <div className="space-y-2">
              <Label>Existing debt repayments (ZAR)</Label>
              <Input
                type="number"
                min={0}
                value={form.existing_debt}
                onChange={(e) => setFormAndSave({ ...form, existing_debt: e.target.value })}
                placeholder="e.g. 1000"
              />
            </div>
            <div className="space-y-2">
              <Label>When is your next payday?</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.next_pay_date
                      ? new Date(form.next_pay_date + "T12:00:00").toLocaleDateString("en-ZA", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto min-w-[280px] p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.next_pay_date ? new Date(form.next_pay_date + "T12:00:00") : undefined}
                    onSelect={(date) =>
                      setFormAndSave({
                        ...form,
                        next_pay_date: date
                          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
                          : "",
                      })
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
            {form.next_pay_date && !isPaydayValid && (
              <p className="text-sm text-destructive">
                Payday must be today or a future date. Please pick a valid date.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => goToStep(1)}>
                Back
              </Button>
              <Button
                onClick={() => goToStep(3)}
                disabled={!form.monthly_income || !isPaydayValid}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Loan Amount */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Loan Amount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tier && (
              <div className="rounded-md bg-muted p-3 text-sm">
                Your tier: <strong>{tier.name}</strong> — Max loan:{" "}
                <strong>R{Number(tier.max_loan).toLocaleString()}</strong>. Total cost:{" "}
                <strong>35%</strong> (admin fee + interest).
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
                onChange={(e) => setFormAndSave({ ...form, amount_requested: e.target.value })}
                placeholder={`e.g. ${tier ? Number(tier.max_loan) : 700}`}
                className={
                  amount > 0 && tier && amount > Number(tier.max_loan)
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {amount > 0 && tier && amount > Number(tier.max_loan) && (
                <p className="text-sm text-destructive">
                  Exceeds your {tier.name} limit of R{Number(tier.max_loan).toLocaleString()}.
                </p>
              )}
              {amount > 0 && tier && amount <= Number(tier.max_loan) && (
                <p className="text-sm text-muted-foreground">
                  Within your {tier.name} limit (max R{Number(tier.max_loan).toLocaleString()}) ✓
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => goToStep(2)}>
                Back
              </Button>
              <Button
                onClick={() => goToStep(4)}
                disabled={
                  !form.amount_requested || (tier ? amount > Number(tier.max_loan) : false)
                }
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirm & Submit */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Confirm & Submit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-md border p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loan Amount</span>
                <span className="font-medium">R{amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Repayment Term</span>
                <span className="font-medium">1 salary cycle</span>
              </div>
              {form.next_pay_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Repayment due by</span>
                  <span className="font-medium">
                    {new Date(form.next_pay_date + "T12:00:00").toLocaleDateString("en-ZA", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              {pricing && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Admin fee</span>
                    <span className="font-medium">R{pricing.adminFee.toFixed(2)}</span>
                  </div>
                  {pricing.vatAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">VAT</span>
                      <span className="font-medium">R{pricing.vatAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Interest</span>
                    <span className="font-medium">R{pricing.interestAmount.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Total Repayment</span>
                <span className="font-bold">R{totalRepayment.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-medium">Documents</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant={hasIdDoc ? "default" : "destructive"}>
                  ID {hasIdDoc ? "✓" : "✗"}
                </Badge>
                <Badge variant={hasPayslip ? "default" : "destructive"}>
                  Payslip {hasPayslip ? "✓" : "✗"}
                </Badge>
                <Badge variant={hasBankStatement ? "default" : "destructive"}>
                  Bank statement {hasBankStatement ? "✓" : "✗"}
                </Badge>
              </div>
              {!canSubmit && (
                <p className="text-sm text-muted-foreground">
                  Upload all three documents on step 1 before you can submit.
                </p>
              )}
            </div>

            {totalRepayment > disposable && disposable > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                Total repayment (R{totalRepayment.toFixed(2)}) exceeds your disposable income (R
                {disposable.toFixed(2)}). The application may be declined.
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => goToStep(3)}>
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
