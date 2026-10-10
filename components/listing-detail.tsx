"use client";
import { useState, useEffect, useRef } from "react";
import {subscribeListing} from "@/lib/realtime";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  MapPin,
  Share2,
  Clock,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Header, Footer, DemoNotice, Countdown } from "./marketplace";
import { money, methodName, type Listing } from "@/lib/catalog";
export default function ListingDetail({
  item: initial,
  demo,
}: {
  item: Listing;
  demo: boolean;
}) {
  const [item, setItem] = useState(initial);
  const [action, setAction] = useState("");
  const [amount, setAmount] = useState(
    String(initial.price + initial.increment),
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signInRequired, setSignInRequired] = useState(false);
  const [success, setSuccess] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [activeImage, setActiveImage] = useState(initial.image);
  const auction = item.method.includes("auction");
  const galleryImages = item.images?.length ? item.images : [item.image];
  const displayedImage = galleryImages.includes(activeImage)
    ? activeImage
    : galleryImages[0];
  const activeImageIndex = Math.max(0, galleryImages.indexOf(displayedImage));
  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  useEffect(() => {
    if (demo) return;
    const update = async () => {
      try {
        const r = await fetch("/api/listings/" + item.id);
        if (r.ok) {
          const d: any = await r.json();
          setItem(d.listing);
          setHistory(d.bids || []);
        }
      } catch {}
    };
    update();
    const timer = setInterval(update, 5000);
    let cleanup=()=>{};let disposed=false;subscribeListing(item.id,update).then(stop=>{if(disposed)stop();else cleanup=stop;}).catch(()=>{});
    return () => {disposed=true;clearInterval(timer);cleanup();};
  }, [demo, item.id]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSignInRequired(false);
    try {
      const r = await fetch(
        "/api/" +
          (action === "bid"
            ? "bids"
            : action === "offer"
              ? "offers"
              : "orders"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listing_id: item.id,
            amount,
            note: message,
            terms: true,
          }),
        },
      );
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      if (action === "buy") {
        window.location.assign("/account?order=" + d.id);
        return;
      }
      setSuccess(
        action === "bid"
          ? "Your bid was accepted by the server."
          : "Your offer was submitted for review.",
      );
      setAction("");
    } catch (e) {
      setError((e as Error).message);
      setSignInRequired(/sign in|verified buyer account/i.test((e as Error).message));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Header />
      <main className="page-wrap">
        <div className="breadcrumb">
          <Link href="/browse">Marketplace</Link> / <span>{item.category}</span>{" "}
          / <span>{item.title}</span>
        </div>
        {demo && <DemoNotice />}
        <div className="detail-grid">
          <div>
            <div className="detail-media">
              {galleryImages.length > 1 && (
                <div className="detail-gallery" aria-label="Listing images">
                {galleryImages.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    className={image === displayedImage ? "active" : ""}
                    aria-label={`Show image ${index + 1} of ${galleryImages.length}`}
                    aria-pressed={image === displayedImage}
                    onClick={() => setActiveImage(image)}
                  >
                    <img src={image} alt="" />
                  </button>
                ))}
                </div>
              )}
              <div className="detail-photo-stage">
                <button
                  type="button"
                  className="detail-photo"
                  aria-label="Zoom asset image"
                  onTouchStart={(event) => {
                    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
                    didSwipe.current = false;
                  }}
                  onTouchEnd={(event) => {
                    const start = touchStartX.current;
                    touchStartX.current = null;
                    if (start === null || galleryImages.length < 2) return;
                    const delta = event.changedTouches[0].clientX - start;
                    if (Math.abs(delta) < 44) return;
                    didSwipe.current = true;
                    const direction = delta < 0 ? 1 : -1;
                    const nextIndex = (activeImageIndex + direction + galleryImages.length) % galleryImages.length;
                    setActiveImage(galleryImages[nextIndex]);
                  }}
                  onClick={() => {
                    if (didSwipe.current) {
                      didSwipe.current = false;
                      return;
                    }
                    setAction("zoom");
                  }}
                >
                  <img src={displayedImage} alt={item.title} />
                </button>
                {galleryImages.length > 1 && (
                  <span className="detail-image-count" aria-live="polite">
                    {activeImageIndex + 1} / {galleryImages.length}
                  </span>
                )}
              </div>
            </div>
            <p className="muted" style={{ fontSize: 10, marginTop: 10 }}>
              {demo
                ? "Reference photo, not the actual collateral asset."
                : "Select image to enlarge."}
            </p>
            <div className="detail-subsection">
              <Tabs defaultValue="details">
                <TabsList>
                  <TabsTrigger value="details">Asset details</TabsTrigger>
                  <TabsTrigger value="bids">Bid history</TabsTrigger>
                  <TabsTrigger value="collection">Collection</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <p style={{ marginTop: 20 }}>{item.description}</p>
                  <div className="defect-box">
                    <b>Condition disclosure · {item.condition}</b>
                    <br />
                    {item.defects}
                  </div>
                  <div className="spec-list">
                    {Object.entries(item.specs || {}).map(([k, v]) => (
                      <div key={k}>
                        <span className="muted">{k}</span>
                        <b>{v}</b>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="bids">
                  <div style={{ marginTop: 20 }}>
                    {!auction ? (
                      <p>This asset is offered at a fixed price.</p>
                    ) : demo ? (
                      <p>
                        Bid history becomes available for connected, live
                        auctions. Sample bid counts are illustrative.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bidder alias</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Time (Blantyre)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {history.map((b) => (
                            <TableRow key={b.sequence_no}>
                              <TableCell>{b.alias}</TableCell>
                              <TableCell>{money(b.amount)}</TableCell>
                              <TableCell>
                                {new Date(b.placed_at).toLocaleString("en-GB", {
                                  timeZone: "Africa/Blantyre",
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="collection">
                  <p style={{ marginTop: 20 }}>
                    Collection takes place at our office in Blantyre.
                    Instructions and the collection deadline appear on your
                    paid order. Bring your identity reference or an approved
                    collector. The institution must verify payment and authorize
                    release before handover.
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <div className="detail-info">
            <span className="badge green">
              <ShieldCheck size={13} />{" "}
              {demo ? "Sample listing" : "Institution-approved listing"}
            </span>
            <h1>{item.title}</h1>
            <p className="location">
              <MapPin size={15} />
              {item.location} · {item.condition} condition ·{" "}
              {methodName(item.method)}
            </p>
            <div className="detail-price">
              <small className="muted">
                {auction ? "CURRENT BID" : "FIXED PRICE"}
              </small>
              <strong>{money(item.price)}</strong>
              {auction && (
                <>
                  <Countdown end={item.ends_at} />
                  <p>
                    Closes{" "}
                    {new Date(item.ends_at!).toLocaleString("en-GB", {
                      timeZone: "Africa/Blantyre",
                    })}{" "}
                    CAT (UTC+2). The server determines auction closure.
                  </p>
                  <p>
                    Minimum next bid:{" "}
                    <b>{money(item.price + item.increment)}</b> · {item.bids}{" "}
                    bids
                  </p>
                </>
              )}
              <button
                className="btn primary"
                onClick={() => {
                  setError("");
                  if (auction) setAction("bid");
                  else window.location.assign(`${import.meta.env.BASE_URL}checkout?listing=${encodeURIComponent(item.slug)}`);
                }}
                disabled={item.status !== "live"}
              >
                {item.status === "live"
                  ? auction
                    ? "Place a bid"
                    : "Buy now"
                  : item.status}
              </button>
              {item.method.includes("offer") && (
                <button
                  className="btn secondary"
                  onClick={() => {
                    setAmount(String(item.price));
                    setAction("offer");
                    setError("");
                  }}
                >
                  Make an offer
                </button>
              )}
              <p>
                Sale price shown in MWK. Any applicable fees must be disclosed
                in your order before checkout. Used assets: review the condition
                and terms before committing.
              </p>
            </div>
            {success && (
              <div className="success" style={{ marginTop: 15 }}>
                {success}
              </div>
            )}
            <div className="detail-subsection">
              <h2>Buy with a clear process.</h2>
              <p>
                <ShieldCheck
                  size={15}
                  style={{ display: "inline", marginRight: 6 }}
                />
                Assets require institutional sale authorization.
                <br />
                <CheckCircle2
                  size={15}
                  style={{ display: "inline", marginRight: 6 }}
                />
                Payment verified before collection approval.
                <br />
                <Clock
                  size={15}
                  style={{ display: "inline", marginRight: 6 }}
                />
                Late qualifying bids may extend an auction.
              </p>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 25 }}>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    setSuccess("Listing link copied.");
                  } catch {
                    setSuccess("Copy the page address to share this listing.");
                  }
                }}
              >
                <Share2 size={14} style={{ display: "inline" }} /> Share asset
              </button>
              <Link className="text-button" href="/help">
                Questions & sale terms{" "}
                <ExternalLink size={12} style={{ display: "inline" }} />
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Dialog
        open={!!action}
        onOpenChange={(v) => {
          if (!v) {
            setAction("");
            setError("");
          }
        }}
      >
        <DialogContent className={action === "zoom" ? "sm:max-w-3xl" : ""}>
          <DialogTitle>
            {action === "zoom"
              ? item.title
              : action === "bid"
                ? "Place your bid"
                : action === "offer"
                  ? "Make an offer"
                  : "Confirm your purchase"}
          </DialogTitle>
          <DialogDescription>
            {action === "zoom"
              ? "Review the asset image."
              : item.title + " · " + item.location}
          </DialogDescription>
          {action === "zoom" ? (
            <img
              src={displayedImage}
              alt={item.title}
              style={{ maxHeight: "65vh", objectFit: "contain" }}
            />
          ) : (
            <form onSubmit={submit} className="form-grid">
              {action === "buy" ? (
                <div className="receipt">
                  <small>Total before any disclosed buyer fees</small>
                  <br />
                  <strong>{money(item.price)}</strong>
                </div>
              ) : (
                <label>
                  Amount (MWK)
                  <input
                    type="number"
                    required
                    min={action === "bid" ? item.price + item.increment : 1}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
              )}
              {action === "offer" && (
                <label>
                  Message (optional)
                  <textarea
                    maxLength={500}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>
              )}
              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "start",
                  fontWeight: 400,
                  lineHeight: 1.6,
                }}
              >
                <input
                  type="checkbox"
                  required
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                I have reviewed the asset condition and{" "}
                <Link
                  href="/help?section=terms"
                  style={{ textDecoration: "underline" }}
                >
                  sale terms
                </Link>
                .
              </label>
              {error && <p className="error">{error}</p>}
              {signInRequired && (
                <Link className="btn secondary" href="/account">
                  Sign in with Google or email
                </Link>
              )}
              <button className="btn primary" disabled={busy || !accepted}>
                {busy
                  ? "Submitting…"
                  : action === "buy"
                    ? "Reserve & continue to checkout"
                    : "Submit " + action}
              </button>
              <p className="muted" style={{ fontSize: 11 }}>
                {demo
                  ? "Sample catalogue: this action will not create a financial transaction."
                  : "Your request is validated by the server before confirmation."}
              </p>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Footer />
    </>
  );
}
