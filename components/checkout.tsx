"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import { Header, Footer } from "./marketplace";
import { money, methodName, type Listing } from "@/lib/catalog";

type BuyerOrder = { id: string; listing_id: string; status: string };
type ApiResult = {
  id?: string;
  checkout_url?: string;
  error?: string;
};

export default function Checkout() {
  const [slug] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("listing") || "",
  );
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(() => !!slug);
  const [error, setError] = useState(() =>
    slug ? "" : "Choose a listing before starting checkout.",
  );
  const [busy, setBusy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    const requireSession = async () => {
      let session = await fetch("/api/session", { cache: "no-store" });
      if (session.status === 401) {
        const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
        if (refreshed.ok) session = await fetch("/api/session", { cache: "no-store" });
      }
      if (session.status === 401) {
        const checkoutPath = `${import.meta.env.BASE_URL}checkout?listing=${encodeURIComponent(slug)}`;
        window.location.replace(`${import.meta.env.BASE_URL}account?next=${encodeURIComponent(checkoutPath)}`);
        return false;
      }
      if (!session.ok) {
        const result = await session.json().catch(() => ({})) as { error?: string };
        throw Error(result.error || "Unable to verify your buyer account.");
      }
      const sessionData = await session.json() as {
        user?: { app_metadata?: { provider?: string; providers?: string[] } };
      };
      const providers = sessionData.user?.app_metadata?.providers || [];
      if (!providers.includes("google") && sessionData.user?.app_metadata?.provider !== "google")
        throw Error("Sign in with Google to continue to checkout.");
      return true;
    };
    requireSession().then((authorized) => {
      if (!authorized || !active) return;
      return fetch("/api/catalog", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { listings?: Listing[]; error?: string };
        if (!response.ok) throw Error(data.error || "The catalogue is unavailable.");
        const item = data.listings?.find((candidate) => candidate.slug === slug);
        if (!item) throw Error("This listing is no longer available.");
        if (active) setListing(item);
      })
      .catch((failure) => {
        if (active) setError((failure as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    }).catch((failure) => {
      if (active) {
        setError((failure as Error).message);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  async function payWithPayChangu() {
    if (!listing || !acceptedTerms) return;
    setBusy(true);
    setError("");
    try {
      const accountResponse = await fetch("/api/account", { cache: "no-store" });
      const account = await accountResponse.json() as {
        orders?: BuyerOrder[];
        error?: string;
      };
      if (!accountResponse.ok) throw Error(account.error || "Sign in with Google to continue.");
      const existingOrder = (account.orders || []).find(
        (order) => order.listing_id === listing.id && order.status === "awaiting_payment",
      );
      let order = existingOrder;
      if (!order) {
        const orderResponse = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listing_id: listing.id, terms: true }),
        });
        const result = await orderResponse.json() as ApiResult;
        if (!orderResponse.ok) throw Error(result.error || "Could not reserve this listing.");
        if (!result.id) throw Error("The order response is invalid.");
        order = { id: result.id, listing_id: listing.id, status: "awaiting_payment" };
      }
      const paymentResponse = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id }),
      });
      const payment = await paymentResponse.json() as ApiResult;
      if (!paymentResponse.ok) throw Error(payment.error || "Could not start PayChangu checkout.");
      if (!payment.checkout_url) throw Error("PayChangu did not return a checkout link.");
      const destination = new URL(payment.checkout_url);
      if (destination.protocol !== "https:" || destination.hostname !== "checkout.paychangu.com")
        throw Error("PayChangu returned an invalid checkout destination.");
      window.location.assign(destination.href);
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <main className="checkout-page">
        <Link className="checkout-back" href="/browse"><ArrowLeft size={16} /> Back to marketplace</Link>
        <div className="checkout-heading">
          <div className="eyebrow">SECURE PAYCHANGU CHECKOUT</div>
          <h1>Checkout</h1>
          <p>Review the item and continue to PayChangu to choose an available payment method.</p>
        </div>
        {loading ? (
          <div className="checkout-state">Loading listing details…</div>
        ) : error ? (
          <div className="checkout-state error" role="alert">{error}</div>
        ) : listing ? (
          <div className="checkout-layout">
            <section className="checkout-item">
              <img src={listing.image} alt={listing.title} />
              <div className="checkout-item-copy">
                <span className="badge green">{methodName(listing.method)}</span>
                <h2>{listing.title}</h2>
                <p className="location"><MapPin size={15} />{listing.location}</p>
                <p className="checkout-condition">{listing.condition} condition · {listing.category}</p>
              </div>
            </section>
            <aside className="checkout-summary">
              <div className="checkout-summary-title">Purchase summary</div>
              <div className="checkout-total"><span>Listing price</span><b>{money(listing.price)}</b></div>
              <p className="checkout-notice">
                Secure payment is handled by PayChangu. Select Airtel Money or a bank-transfer option, such as a transfer from National Bank of Malawi, if those methods are enabled for this merchant checkout.
              </p>
              <label className="checkout-terms">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                />
                <span>I agree to the <Link href="/help/terms">terms of sale</Link> and confirm that I have reviewed the item details.</span>
              </label>
              {error && <p className="error" role="alert">{error}</p>}
              <button
                className="btn primary checkout-whatsapp"
                type="button"
                disabled={busy || !acceptedTerms}
                onClick={payWithPayChangu}
              >
                <CheckCircle2 size={17} /> {busy ? "Starting secure checkout…" : "Continue to PayChangu"}
              </button>
              <p className="checkout-security"><ShieldCheck size={15} /> Payment is confirmed only after server-side verification with PayChangu.</p>
              <Link className="text-button checkout-help" href="/help">Questions about buying? <ArrowRight size={14} /></Link>
            </aside>
          </div>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
