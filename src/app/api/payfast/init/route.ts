/**
 * PayFast payment start (authenticated borrower only).
 *
 * POST body: { repaymentId }
 * Response: { payfastUrl, formParams } — client builds a form and POSTs to PayFast.
 * m_payment_id is the repayment UUID so the ITN can update the correct row.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getPayFastConfig,
  buildPayFastParams,
} from "@/lib/payfast";

export async function POST(req: Request) {
  try {
    // --- Auth: must be logged in ---
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = getPayFastConfig();
    if (!config) {
      return NextResponse.json(
        { error: "PayFast is not configured" },
        { status: 503 }
      );
    }
    if (!config.baseUrl) {
      return NextResponse.json(
        { error: "App URL not set (NEXT_PUBLIC_APP_URL or VERCEL_URL)" },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const repaymentId = typeof body.repaymentId === "string" ? body.repaymentId.trim() : null;
    if (!repaymentId) {
      return NextResponse.json(
        { error: "Missing repaymentId" },
        { status: 400 }
      );
    }

    // --- Load repayment and ensure it belongs to this user's loan ---
    const { data: repayment } = await supabase
      .from("repayments")
      .select("id, loan_id, amount_due, amount_paid, status")
      .eq("id", repaymentId)
      .single();

    if (!repayment) {
      return NextResponse.json({ error: "Repayment not found" }, { status: 404 });
    }

    const { data: loan } = await supabase
      .from("loans")
      .select("user_id")
      .eq("id", repayment.loan_id)
      .single();

    if (!loan || loan.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const amountDue = Number(repayment.amount_due);
    const amountPaid = Number(repayment.amount_paid);
    const remaining = amountDue - amountPaid;

    if (repayment.status === "paid" || remaining <= 0) {
      return NextResponse.json(
        { error: "This repayment is already fully paid" },
        { status: 400 }
      );
    }

    // --- Optional payer fields shown on PayFast checkout ---
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single();

    const fullName = (profile?.full_name as string) || "";
    const parts = fullName.trim().split(/\s+/);
    const nameFirst = parts[0] || "";
    const nameLast = parts.slice(1).join(" ") || "";

    // --- URLs: return/cancel use your app origin; notify must be reachable by PayFast (not localhost unless tunneled) ---
    const base = config.baseUrl.replace(/\/$/, "");
    const returnUrl = `${base}/user/repayments?paid=1`;
    const cancelUrl = `${base}/user/repayments?cancelled=1`;
    const notifyUrl = config.notifyUrl;
    if (!notifyUrl) {
      return NextResponse.json(
        { error: "Notify URL missing. Set NEXT_PUBLIC_APP_URL or PAYFAST_NOTIFY_URL." },
        { status: 503 }
      );
    }

    const formParams = buildPayFastParams({
      config,
      mPaymentId: repaymentId,
      amount: Math.round(remaining * 100) / 100,
      itemName: "Loan repayment",
      returnUrl,
      cancelUrl,
      notifyUrl,
      email: user.email ?? undefined,
      nameFirst: nameFirst || undefined,
      nameLast: nameLast || undefined,
      cellNumber: (profile?.phone as string) || undefined,
      itemDescription: `Repayment ${repaymentId.slice(0, 8)}`,
    });

    return NextResponse.json({
      payfastUrl: config.payfastUrl,
      formParams,
    });
  } catch (e) {
    console.error("[payfast/init]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Init failed" },
      { status: 500 }
    );
  }
}
