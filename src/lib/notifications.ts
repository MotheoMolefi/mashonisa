/**
 * Notifications: email (Resend) and SMS (Twilio).
 *
 * Set RESEND_API_KEY and/or TWILIO_* in .env to enable; missing keys = silent no-op.
 * Invoked from /api/notify (admin actions) and PayFast ITN when loan settles.
 */

export type NotifyEvent =
  | "application_approved"
  | "application_rejected"
  | "loan_disbursed"
  | "loan_settled";

export type NotifyPayload = {
  userId: string;
  applicationId?: string;
  loanId?: string;
  amount?: number;
  totalPayable?: number;
  principal?: number;
};

const FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL ?? "Mashonisa <noreply@mashonisa.example.com>";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

// --- Copy for each channel (plain text only) ---

function subject(event: NotifyEvent, payload: NotifyPayload): string {
  switch (event) {
    case "application_approved":
      return "Your loan application was approved";
    case "application_rejected":
      return "Update on your loan application";
    case "loan_disbursed":
      return "Your loan has been disbursed";
    case "loan_settled":
      return "Your loan is fully settled";
    default:
      return "Mashonisa update";
  }
}

function emailBody(event: NotifyEvent, payload: NotifyPayload): string {
  const r = (n: number) => `R${n.toLocaleString()}`;
  switch (event) {
    case "application_approved":
      return `Your loan application has been approved. Amount: ${payload.totalPayable != null ? r(payload.totalPayable) : "see portal"}. Log in to view details and next steps.`;
    case "application_rejected":
      return "Your loan application was not approved. Log in to the portal for any notes from our team.";
    case "loan_disbursed":
      return `Your loan of ${payload.principal != null ? r(payload.principal) : ""} has been disbursed. Thank you for choosing Mashonisa.`;
    case "loan_settled":
      return "Your loan has been fully repaid. Thank you for banking with Mashonisa.";
    default:
      return "You have an update in your Mashonisa account. Please log in to view.";
  }
}

function smsBody(event: NotifyEvent, payload: NotifyPayload): string {
  const r = (n: number) => `R${n.toLocaleString()}`;
  switch (event) {
    case "application_approved":
      return `Mashonisa: Your loan was approved. Total due: ${payload.totalPayable != null ? r(payload.totalPayable) : "see portal"}.`;
    case "application_rejected":
      return "Mashonisa: Your loan application was not approved. Log in for details.";
    case "loan_disbursed":
      return `Mashonisa: Your loan has been disbursed.`;
    case "loan_settled":
      return "Mashonisa: Your loan is fully settled. Thank you.";
    default:
      return "Mashonisa: You have an update. Log in to view.";
  }
}

/** Resend REST call; skips if RESEND_API_KEY unset. */
export async function sendEmail(to: string, event: NotifyEvent, payload: NotifyPayload): Promise<void> {
  if (!RESEND_API_KEY) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: subject(event, payload),
        text: emailBody(event, payload),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[notifications] Resend error:", res.status, err);
    }
  } catch (e) {
    console.error("[notifications] sendEmail error:", e);
  }
}

/** Twilio REST call; skips if Twilio env incomplete. */
export async function sendSMS(to: string, event: NotifyEvent, payload: NotifyPayload): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) return;
  const body = smsBody(event, payload);
  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        body: new URLSearchParams({
          To: to,
          From: TWILIO_FROM,
          Body: body,
        }).toString(),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error("[notifications] Twilio error:", res.status, err);
    }
  } catch (e) {
    console.error("[notifications] sendSMS error:", e);
  }
}

/** Sends on every channel we have an address for (email and/or SMS). */
export async function notifyUser(
  email: string | null,
  phone: string | null,
  event: NotifyEvent,
  payload: NotifyPayload
): Promise<void> {
  if (email) await sendEmail(email, event, payload);
  if (phone) await sendSMS(phone, event, payload);
}
