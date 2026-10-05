import { sb } from "./server";
import { paymentMatches } from "./domain";
export async function verifyPayment(tx_ref: string) {
  const secret = process.env.PAYCHANGU_SECRET_KEY;
  if (!secret) throw new Error("PayChangu server secret is not configured.");
  const rows = await sb(
    "/rest/v1/payments?tx_ref=eq." + encodeURIComponent(tx_ref) + "&select=*",
    {},
    undefined,
    true,
  );
  const p = rows[0];
  if (!p) throw new Error("Unknown payment reference.");
  if (p.status === "paid") return { status: "paid", id: p.id };
  const r = await fetch(
    "https://api.paychangu.com/verify-payment/" + encodeURIComponent(tx_ref),
    {
      headers: {
        Authorization: "Bearer " + secret,
        Accept: "application/json",
      },
    },
  );
  const d: any = await r.json();
  if (!r.ok || d.status !== "success")
    throw new Error(
      "Provider verification is unavailable. Retry reconciliation.",
    );
  const v = d.data;
  if(v.tx_ref!==p.tx_ref)throw new Error("Provider reference mismatch.");
  if (v.status !== "success") {
    if(v.status === "failed")await sb("/rest/v1/rpc/mark_payment_failed",{method:"POST",body:JSON.stringify({p_tx_ref:tx_ref})},undefined,true);
    return { status: v.status === "failed" ? "failed" : "pending" };
  }
  if (!paymentMatches(p, v))
    throw new Error(
      "Payment mismatch. Reference, currency and exact amount must match.",
    );
  return sb(
    "/rest/v1/rpc/confirm_verified_payment",
    {
      method: "POST",
      body: JSON.stringify({
        p_tx_ref: tx_ref,
        p_amount: String(v.amount),
        p_currency: v.currency,
        p_provider_ref: String(v.reference),
        p_payload: {
          tx_ref: v.tx_ref,
          status: v.status,
          amount: v.amount,
          currency: v.currency,
          reference: v.reference,
          mode: v.mode,
        },
      }),
    },
    undefined,
    true,
  );
}
