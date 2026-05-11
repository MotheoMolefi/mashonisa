# PayFast Integration Requirements (South Africa)

Use this as a checklist and reference when integrating PayFast for loan repayments in Mashonisa.

---

## 1. Account & credentials

- **Register**: [PayFast](https://www.payfast.co.za/) merchant account (and a separate **Sandbox** account for testing).
- **Credentials** (from PayFast merchant dashboard):
  - **Merchant ID** – 8-character integer.
  - **Merchant Key** – string.
  - **Passphrase** – optional but recommended; used for signature validation. If set in the PayFast dashboard, it **must** be included when generating the signature.

Without both Merchant ID and Merchant Key (and correct passphrase if set), payments will not process.

---

## 2. Environments

| Use case | Base URL |
|----------|----------|
| **Sandbox (testing)** | `https://sandbox.payfast.co.za/eng/process` |
| **Live** | `https://www.payfast.co.za/eng/process` |

Use Sandbox first; switch to Live only after testing.

---

## 3. Custom form integration (redirect to PayFast)

You build an HTML form and POST it to the PayFast URL above. All values must be **URL-encoded**.

### Required form fields

| Field | Description |
|-------|-------------|
| `merchant_id` | Your Merchant ID |
| `merchant_key` | Your Merchant Key |
| `return_url` | Where to send the user after **successful** payment (e.g. `/user/repayments?paid=1`) |
| `cancel_url` | Where to send the user if they **cancel** (e.g. `/user/repayments`) |
| `notify_url` | **Server** URL PayFast will call with payment result (ITN – Instant Transaction Notification). Must be publicly reachable (e.g. `https://yourdomain.com/api/payfast/notify`) |
| `m_payment_id` | Your unique payment/repayment ID (so you can match the ITN to a record) |
| `amount` | Payment amount (e.g. `1234.56`, 2 decimal places) |
| `item_name` | Short description (e.g. "Loan repayment") |
| `signature` | MD5 hash of a string built from the parameters (see below) |

### Optional but useful

- `item_description` – longer description.
- `email_address` – payer email (from your user).
- `name_first`, `name_last` – payer name.
- `cell_number` – payer cell (if you want it on the PayFast screen).

---

## 4. Signature (critical)

PayFast uses a **signature** to ensure the request was not tampered with.

1. **Parameter order** (use this order when building the string):
   - `merchant_id`, `merchant_key`, `return_url`, `cancel_url`, `notify_url`, `name_first`, `name_last`, `email_address`, `cell_number`, `m_payment_id`, `amount`, `item_name`, `item_description`, then any custom fields.

2. **Build the string**:
   - For each parameter in order: `key=value` (only include parameters that have a non-empty value).
   - URL-encode values using **uppercase** hex (e.g. `%3A` not `%3a`).
   - Trim whitespace from values.
   - Join with `&`, e.g. `merchant_id=10000100&merchant_key=key&return_url=https%3A%2F%2F...`.

3. **Passphrase** (if set in PayFast dashboard):
   - Append `&passphrase=YourPassphrase` to the string (no URL encoding of the passphrase in some implementations – check PayFast docs for your case).

4. **Hash**:
   - Compute **MD5** of the full string; send the result as the `signature` form field.

Common causes of "signature does not match":
- Wrong parameter order.
- Empty values included (or required values omitted).
- Lowercase URL encoding instead of uppercase.
- Passphrase missing or different from dashboard.
- Extra/missing spaces (trim everything).

---

## 5. Instant Transaction Notification (ITN) – `notify_url`

When a payment is completed (or fails), PayFast POSTs to your `notify_url` with payment data. Your server **must**:

1. **Validate the signature** – Recompute the signature from the POST body using the same rules (parameter order, encoding, passphrase) and compare to the `signature` PayFast sends. Reject if they differ.
2. **Idempotency** – Use `m_payment_id` (and possibly PayFast’s transaction ID) to avoid applying the same payment twice (e.g. mark repayment as paid only once).
3. **Respond with 200** – Reply with HTTP 200 quickly so PayFast knows you received the ITN. Do heavy work (DB updates, emails) after responding or in a background job.
4. **Check payment status** – Use the ITN field that indicates success/failure (e.g. `payment_status=COMPLETE`) before updating your repayment/loan state.

Store in env (server-only):

- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE` (if set)
- `PAYFAST_NOTIFY_URL` (full URL to your ITN endpoint, e.g. `https://yourdomain.com/api/payfast/notify`)

---

## 6. Flow in Mashonisa

1. **User chooses to pay** (e.g. from Repayments page) → your app creates a pending payment record and `m_payment_id` (e.g. repayment ID or a dedicated payment id).
2. **Your server** builds the form data (amount, return_url, cancel_url, notify_url, m_payment_id, item_name, customer fields, signature) and either:
   - Renders a form that auto-submits to PayFast, or
   - Returns a server-signed payload so the front-end can POST to PayFast (never expose passphrase or key in the browser).
3. **User completes payment** on PayFast (card, EFT, etc.).
4. **PayFast** calls your `notify_url` with the result; your API validates signature and updates repayment/loan (e.g. mark repayment as paid, or settle loan when fully paid).
5. **User** is redirected to `return_url` or `cancel_url`; you can show a “Payment received” or “Payment pending” message based on your DB state.

---

## 7. Security

- **Never** expose `merchant_key` or `passphrase` in the front-end. Build the form or signature on the server.
- Use **HTTPS** for `return_url`, `cancel_url`, and especially `notify_url`.
- Validate **amount** in the ITN against the amount you stored for `m_payment_id` to avoid amount tampering.
- Only trust payment status after **signature validation** and (if available) optional server-to-server confirmation with PayFast.

---

## 8. Implementation notes (Mashonisa)

The following routes and modules are in use:

- **`POST /api/payfast/init`** – Authenticated. Body: `{ repaymentId }`. Returns `{ payfastUrl, formParams }`. The client builds a form and POSTs to PayFast. Requires `NEXT_PUBLIC_APP_URL` or `VERCEL_URL` so return/cancel/notify URLs can be built.
- **`POST /api/payfast/notify`** – Called by PayFast (ITN). Validates signature, updates repayment, and settles the loan if all repayments are paid. No auth; validation is by signature. **Must be publicly reachable** (deploy or use ngrok for local testing).
- **`src/lib/payfast.ts`** – Config (`getPayFastConfig`), signature building (`buildSignature`, `validateItnSignature`), and param helpers.

Use **PayFast Sandbox** first (`PAYFAST_SANDBOX=true` or unset). Set `PAYFAST_SANDBOX=false` only when going live.

---

## 9. References

- [PayFast Developer Documentation](https://developers.payfast.co.za/documentation/)
- [PayFast Custom Integration](https://payfast.io/integration/custom-integration/)
- Use Sandbox first; test with PayFast test cards and flows before going live.
