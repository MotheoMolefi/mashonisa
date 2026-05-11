/**
 * PayFast ITN (Instant Transaction Notification) webhook.
 *
 * Called by PayFast servers — no user session. Trust only after signature check.
 * Updates repayment row; settles loan + emails borrower when all installments paid.
 */
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  getPayFastConfig,
  parsePayFastFormBody,
  validateItnSignature,
} from "@/lib/payfast";
import { notifyUser } from "@/lib/notifications";

export async function POST(req: Request) {
  let params: Record<string, string> = {};
  let signaturePairs: { key: string; value: string }[] | null = null;

  // --- Parse body (PayFast sends application/x-www-form-urlencoded) ---
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const parsed = parsePayFastFormBody(text);
      params = parsed.params;
      signaturePairs = parsed.pairs;
    } else {
      const body = await req.json().catch(() => ({}));
      if (typeof body === "object" && body !== null) {
        for (const [k, v] of Object.entries(body)) {
          if (typeof v === "string") params[k] = v;
        }
      }
    }
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const config = getPayFastConfig();
  if (!config) {
    return NextResponse.json({ error: "PayFast not configured" }, { status: 503 });
  }

  if (!signaturePairs?.length) {
    console.error("[payfast/notify] Expected form-urlencoded ITN body with preserved field order");
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!validateItnSignature(signaturePairs, config.passphrase)) {
    console.error("[payfast/notify] Invalid ITN signature (check passphrase matches PayFast dashboard)");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // m_payment_id matches our repayment.id from init
  const mPaymentId = params.m_payment_id?.trim();
  const paymentStatus = params.payment_status?.trim();
  const amountStr =
    params.amount_gross?.trim() ||
    params.amount?.trim();

  if (!mPaymentId) {
    return NextResponse.json({ error: "Missing m_payment_id" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  if (!service) {
    console.error(
      "[payfast/notify] SUPABASE_SERVICE_ROLE_KEY missing — cannot update repayments"
    );
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 503 }
    );
  }

  const { data: repayment } = await service
    .from("repayments")
    .select("id, loan_id, amount_due, amount_paid, status")
    .eq("id", mPaymentId)
    .single();

  if (!repayment) {
    return NextResponse.json({ error: "Repayment not found" }, { status: 404 });
  }

  const amountDue = Number(repayment.amount_due);
  const amountPaid = Number(repayment.amount_paid);
  const expectedAmount = Math.round((amountDue - amountPaid) * 100) / 100;

  // Idempotent: PayFast may retry ITN; already complete → 200, no double credit
  if (repayment.status === "paid" && amountPaid >= amountDue) {
    return new NextResponse(null, { status: 200 });
  }

  const payfastAmount = amountStr ? parseFloat(amountStr) : NaN;
  if (Number.isNaN(payfastAmount) || Math.abs(payfastAmount - expectedAmount) > 0.01) {
    console.error("[payfast/notify] Amount mismatch", {
      m_payment_id: mPaymentId,
      expected: expectedAmount,
      received: payfastAmount,
    });
    return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
  }

  // Failed/cancelled payments: acknowledge but do not update DB
  if (paymentStatus !== "COMPLETE") {
    return new NextResponse(null, { status: 200 });
  }

  const newAmountPaid = amountPaid + payfastAmount;
  const isPaid = newAmountPaid >= amountDue;

  const { error: updateError } = await service
    .from("repayments")
    .update({
      amount_paid: newAmountPaid,
      paid_at: new Date().toISOString(),
      status: isPaid ? "paid" : "partial",
    })
    .eq("id", mPaymentId);

  if (updateError) {
    console.error("[payfast/notify] Repayment update failed", updateError);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  const { data: loan } = await service
    .from("loans")
    .select("id, user_id")
    .eq("id", repayment.loan_id)
    .single();

  if (loan) {
    // Audit trail attributes payment to the borrower (system path, not admin UI)
    await service.from("audit_logs").insert({
      actor_user_id: loan.user_id,
      action: "REPAYMENT_RECORDED",
      entity_type: "repayment",
      entity_id: mPaymentId,
      meta: { source: "payfast", amount: payfastAmount, loan_id: loan.id },
    });

    const { data: allRepayments } = await service
      .from("repayments")
      .select("id, status, amount_due, amount_paid")
      .eq("loan_id", loan.id);

    const allPaid =
      allRepayments?.every(
        (r) => r.status === "paid" && Number(r.amount_paid) >= Number(r.amount_due)
      ) ?? false;

    if (allPaid) {
      await service
        .from("loans")
        .update({ status: "settled" })
        .eq("id", loan.id);

      await service.from("audit_logs").insert({
        actor_user_id: loan.user_id,
        action: "LOAN_SETTLED",
        entity_type: "loan",
        entity_id: loan.id,
        meta: { source: "payfast" },
      });

      const { data: authUser } = await service.auth.admin.getUserById(loan.user_id);
      const { data: profileRow } = await service
        .from("profiles")
        .select("phone")
        .eq("id", loan.user_id)
        .single();
      const email = authUser?.user?.email ?? null;
      const phone = (profileRow?.phone as string) ?? null;
      notifyUser(email, phone, "loan_settled", {
        userId: loan.user_id,
        loanId: loan.id,
      }).catch(() => {});
    }
  }

  return new NextResponse(null, { status: 200 });
}
