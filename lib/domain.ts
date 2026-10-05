export function minorUnits(value: string | number): bigint {
  const s = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw new Error("Use a positive amount with at most two decimal places.");
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
}
export function decimalAmount(value: bigint) {
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}
export function settlement(gross: bigint, fees: bigint, outstanding: bigint) {
  if (gross < 0n || fees < 0n || outstanding < 0n || fees > gross)
    throw new Error("Invalid settlement amounts.");
  const pool = gross - fees;
  return {
    gross,
    fees,
    recovery: pool < outstanding ? pool : outstanding,
    surplus: pool > outstanding ? pool - outstanding : 0n,
    shortfall: outstanding > pool ? outstanding - pool : 0n,
  };
}
export function paymentMatches(
  expected: { tx_ref: string; amount: string | number; currency: string },
  verified: any,
) {
  return (
    verified.status === "success" &&
    verified.tx_ref === expected.tx_ref &&
    verified.currency === expected.currency &&
    minorUnits(verified.amount) === minorUnits(expected.amount)
  );
}
export function canApprove(
  level: number,
  maker: string,
  actor: string,
  required: number,
) {
  return level >= required && actor !== maker;
}
export async function validSignature(
  body: string,
  signature: string,
  secret: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );
  const hex = Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join(
    "",
  );
  let diff = 0;
  for (let i = 0; i < 64; i++)
    diff |= hex.charCodeAt(i) ^ signature.toLowerCase().charCodeAt(i);
  return diff === 0;
}
