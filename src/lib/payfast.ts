/**
 * PayFast (South Africa) custom integration: signature generation and form fields.
 *
 * Flow: /api/payfast/init builds signed params → user POSTs form to PayFast →
 * PayFast POSTs ITN to /api/payfast/notify. See docs/PAYFAST_INTEGRATION.md.
 */
import { createHash } from "crypto";

/** PayFast requires this exact key order when building the string before MD5. */
const SIGNATURE_PARAM_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "name_first",
  "name_last",
  "email_address",
  "cell_number",
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
] as const;

export type PayFastConfig = {
  sandbox: boolean;
  baseUrl: string;
  merchantId: string;
  merchantKey: string;
  passphrase: string | null;
  payfastUrl: string;
  /**
   * Full `notify_url` for PayFast ITN. Use PAYFAST_NOTIFY_URL when testing locally
   * (e.g. ngrok HTTPS URL + `/api/payfast/notify`); PayFast cannot reach localhost.
   */
  notifyUrl: string;
};

const PAYFAST_NOTIFY_PATH = "/api/payfast/notify";

/**
 * If PAYFAST_NOTIFY_URL is only the tunnel origin (e.g. https://abc.ngrok-free.dev),
 * PayFast POSTs to `/` and gets HTML 200 — ITN never hits the API. Append the route.
 */
function normalizeNotifyUrlOverride(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  try {
    const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const p = u.pathname.replace(/\/$/, "") || "/";
    if (p === "/") {
      u.pathname = PAYFAST_NOTIFY_PATH;
      return u.href.replace(/\/$/, "");
    }
    return trimmed;
  } catch {
    return `${trimmed}${PAYFAST_NOTIFY_PATH}`;
  }
}

/**
 * Read PayFast env and base URL. Use NEXT_PUBLIC_APP_URL or VERCEL_URL for return/cancel URLs.
 * For ITN, set PAYFAST_NOTIFY_URL to a public HTTPS URL when developing on localhost.
 */
export function getPayFastConfig(): PayFastConfig | null {
  const merchantId = process.env.PAYFAST_MERCHANT_ID?.trim();
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY?.trim();
  if (!merchantId || !merchantKey) return null;

  const sandbox = process.env.PAYFAST_SANDBOX !== "false";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";
  const passphrase = process.env.PAYFAST_PASSPHRASE?.trim() || null;
  const notifyOverride = process.env.PAYFAST_NOTIFY_URL?.trim();

  const payfastUrl = sandbox
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process";

  const baseNorm = baseUrl.replace(/\/$/, "");
  const notifyUrl = notifyOverride
    ? normalizeNotifyUrlOverride(notifyOverride)
    : baseNorm
      ? `${baseNorm}${PAYFAST_NOTIFY_PATH}`
      : "";

  return {
    sandbox,
    baseUrl,
    merchantId,
    merchantKey,
    passphrase,
    payfastUrl,
    notifyUrl,
  };
}

/**
 * Encode a field value like PHP `urlencode(trim($v))`: spaces as `+`, then uppercase %XX.
 * `encodeURIComponent` uses `%20` for spaces; PayFast's signature check expects `+`, which
 * causes "Generated signature does not match" for values like item_name "Loan repayment".
 */
function encodePayFastFieldValue(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, "+")
    .replace(/%[0-9a-f]{2}/gi, (m) => m.toUpperCase());
}

/**
 * Build the parameter string for signature: only non-empty params in order, trimmed, uppercase-encoded.
 */
function buildParamString(
  params: Record<string, string>,
  appendPassphrase: string | null
): string {
  const parts: string[] = [];
  for (const key of SIGNATURE_PARAM_ORDER) {
    const raw = params[key];
    if (raw == null) continue;
    const trimmed = String(raw).trim();
    if (trimmed === "") continue;
    parts.push(`${key}=${encodePayFastFieldValue(trimmed)}`);
  }
  let str = parts.join("&");
  // PayFast appends the raw passphrase (not URL-encoded) like common PHP integrations.
  if (appendPassphrase) {
    str += `&passphrase=${appendPassphrase.trim()}`;
  }
  return str;
}

/**
 * Compute PayFast signature (MD5 of param string). Params should be in SIGNATURE_PARAM_ORDER;
 * only include keys with non-empty trimmed values. Passphrase appended if provided.
 */
export function buildSignature(
  params: Record<string, string>,
  passphrase: string | null
): string {
  const str = buildParamString(params, passphrase);
  return createHash("md5").update(str).digest("hex");
}

/**
 * Build PayFast form params (for init). Amount must be 2 decimal places.
 */
export function buildPayFastParams(options: {
  config: PayFastConfig;
  mPaymentId: string;
  amount: number;
  itemName: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  email?: string | null;
  nameFirst?: string | null;
  nameLast?: string | null;
  cellNumber?: string | null;
  itemDescription?: string | null;
}): Record<string, string> {
  const {
    config,
    mPaymentId,
    amount,
    itemName,
    returnUrl,
    cancelUrl,
    notifyUrl,
    email,
    nameFirst,
    nameLast,
    cellNumber,
    itemDescription,
  } = options;

  const params: Record<string, string> = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    m_payment_id: mPaymentId,
    amount: amount.toFixed(2),
    item_name: itemName,
  };
  if (nameFirst) params.name_first = nameFirst.trim();
  if (nameLast) params.name_last = nameLast.trim();
  if (email) params.email_address = email.trim();
  if (cellNumber) params.cell_number = cellNumber.trim();
  if (itemDescription) params.item_description = itemDescription.trim();

  const signature = buildSignature(params, config.passphrase);
  params.signature = signature;
  return params;
}

/**
 * Parse PayFast `application/x-www-form-urlencoded` body. Preserves pair order for ITN signatures.
 */
export function parsePayFastFormBody(text: string): {
  params: Record<string, string>;
  pairs: { key: string; value: string }[];
} {
  const search = new URLSearchParams(text);
  const params: Record<string, string> = {};
  const pairs: { key: string; value: string }[] = [];
  search.forEach((value, key) => {
    params[key] = value;
    pairs.push({ key, value });
  });
  return { params, pairs };
}

/**
 * ITN signature is NOT the same as checkout: PayFast signs fields in POST body order (see e.g.
 * WooCommerce PayFast `_generate_parameter_string($data, false, false)`), including ITN-only
 * fields like `amount_gross`, `pf_payment_id`, `payment_status`.
 */
export function buildItnSignatureString(
  pairs: { key: string; value: string }[],
  passphrase: string | null
): string {
  let s = "";
  for (const { key, value } of pairs) {
    if (key === "signature") continue;
    s += `${key}=${encodePayFastFieldValue(value ?? "")}&`;
  }
  if (passphrase?.trim()) {
    s += `passphrase=${encodePayFastFieldValue(passphrase.trim())}`;
  } else if (s.endsWith("&")) {
    s = s.slice(0, -1);
  }
  return s;
}

export function validateItnSignature(
  pairs: { key: string; value: string }[],
  passphrase: string | null
): boolean {
  const received = pairs.find((p) => p.key === "signature")?.value;
  if (!received) return false;
  const str = buildItnSignatureString(pairs, passphrase);
  const expected = createHash("md5").update(str).digest("hex");
  return received.toLowerCase() === expected.toLowerCase();
}
