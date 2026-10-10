"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import { Header, Footer } from "./marketplace";
import { money, methodName, type Listing } from "@/lib/catalog";

export default function Checkout() {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("listing");
    if (!slug) {
      setError("Choose a listing before starting checkout.");
      setLoading(false);
      return;
    }
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
        const result: any = await session.json().catch(() => ({}));
        throw Error(result.error || "Unable to verify your buyer account.");
      }
      return true;
    };
    requireSession().then((authorized) => {
      if (!authorized || !active) return;
      return fetch("/api/catalog", { cache: "no-store" })
      .then(async (response) => {
        const data: any = await response.json();
        if (!response.ok) throw Error(data.error || "The catalogue is unavailable.");
        const item = (data.listings || []).find((candidate: Listing) => candidate.slug === slug);
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

  const whatsappHref = listing
    ? `https://wa.me/265981954171?text=${encodeURIComponent(
        `Hello Nyasa Market, I would like to buy this listing.\n\nItem: ${listing.title}\nListing: ${window.location.origin}${import.meta.env.BASE_URL}listing/${listing.slug}\nPrice shown: ${money(listing.price)}\n\nPlease confirm availability and explain the next payment steps.`,
      )}`
    : "#";

  return (
    <>
      <Header />
      <main className="checkout-page">
        <Link className="checkout-back" href="/browse"><ArrowLeft size={16} /> Back to marketplace</Link>
        <div className="checkout-heading">
          <div className="eyebrow">SECURE PURCHASE REQUEST</div>
          <h1>Checkout</h1>
          <p>Review the listing, then contact our team to confirm availability and payment steps.</p>
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
                This request does not reserve the item or record a payment. The seller must confirm availability and provide the approved payment instructions.
              </p>
              <a className="btn primary checkout-whatsapp" href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle size={17} /> Continue on WhatsApp
              </a>
              <p className="checkout-security"><ShieldCheck size={15} /> Never send payment until availability and official payment instructions are confirmed.</p>
              <Link className="text-button checkout-help" href="/help">Questions about buying? <ArrowRight size={14} /></Link>
            </aside>
          </div>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
