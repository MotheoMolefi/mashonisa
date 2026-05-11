"use client";

/**
 * Triggers server-signed PayFast checkout: POST /api/payfast/init then auto-POSTs
 * a hidden form to PayFast so the user leaves our site to pay.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const PAYFAST_SETUP_HINT =
  "Set PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, and NEXT_PUBLIC_APP_URL in .env.local (see .env.example).";

export function PayFastButton({
  repaymentId,
  payfastReady = true,
}: {
  repaymentId: string;
  /** When false, the button is disabled (server detected missing PayFast / app URL env). */
  payfastReady?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    if (!payfastReady) {
      toast.error("PayFast is not configured", { description: PAYFAST_SETUP_HINT });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/payfast/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repaymentId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        payfastUrl?: string;
        formParams?: Record<string, string>;
      };
      if (!res.ok) {
        const msg = data.error || "Could not start payment";
        toast.error(msg, {
          description:
            res.status === 503 && msg.includes("PayFast")
              ? PAYFAST_SETUP_HINT
              : undefined,
        });
        return;
      }
      const { payfastUrl, formParams } = data;
      if (!payfastUrl || !formParams || typeof formParams !== "object") {
        toast.error("Invalid response from server");
        return;
      }
      // Programmatic form POST — browser navigates to PayFast (same as manual form submit)
      const form = document.createElement("form");
      form.method = "POST";
      form.action = payfastUrl;
      for (const [key, value] of Object.entries(formParams)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error starting payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      title={!payfastReady ? PAYFAST_SETUP_HINT : undefined}
      onClick={handlePay}
      disabled={!payfastReady || loading}
    >
      {!payfastReady
        ? "Pay unavailable"
        : loading
          ? "Redirecting…"
          : "Pay with PayFast"}
    </Button>
  );
}
