"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {useCatalogTools} from "@/lib/webmcp";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  ShieldCheck,
  MapPin,
  Heart,
  Clock,
  Car,
  Monitor,
  Gamepad2,
  Refrigerator,
  Armchair,
  Wrench,
  LayoutGrid,
  ChevronRight,
  CheckCircle2,
  LockKeyhole,
  PackageCheck,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { categories, money, methodName, type Listing } from "@/lib/catalog";
const icons = [
  LayoutGrid,
  Car,
  Monitor,
  Gamepad2,
  Refrigerator,
  Armchair,
  Wrench,
  LayoutGrid,
];
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-mark" aria-hidden="true">
        <img src="/logo.svg" alt="" width="42" height="42" />
      </span>
      <span>
        nyasamarket.com<small>SECURE ASSET MARKETPLACE</small>
      </span>
    </Link>
  );
}
export function Header({
  query = "",
  onSearchChange,
  onSaleMethodChange,
}: {
  query?: string;
  onSearchChange?: (value: string) => void;
  onSaleMethodChange?: (method: "auction" | "fixed") => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <header className="public-header">
        <Brand />
        {onSearchChange && (
          <>
            <button
              className="mobile-search-toggle"
              type="button"
              aria-label={searchOpen ? "Close search" : "Search assets"}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              {searchOpen ? <X size={19} /> : <Search size={19} />}
            </button>
            <form
              className={
                "mobile-header-search " + (searchOpen ? "open" : "")
              }
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                document
                  .getElementById("catalogue")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Search size={17} />
              <input
                aria-label="Search assets"
                placeholder="Search assets"
                value={query}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </form>
          </>
        )}
        <nav>
          <Link href="/browse">Browse assets</Link>
          <Link
            href="/browse?method=auction"
            onClick={() => onSaleMethodChange?.("auction")}
          >
            Auctions
          </Link>
          <Link
            href="/browse?method=fixed"
            onClick={() => onSaleMethodChange?.("fixed")}
          >
            Buy now
          </Link>
          <Link href="/help">How it works</Link>
        </nav>
    </header>
  );
}
export function Footer() {
  return (
    <footer>
      <div>
        <Brand />
        <p>
          A clearer way to discover assets.
          <br />A more accountable way to recover value.
        </p>
      </div>
      <div>
        <b>Marketplace</b>
        <Link href="/browse">Browse assets</Link>
        <Link href="/browse?method=auction">Live auctions</Link>
        <Link href="/help">How it works</Link>
      </div>
      <div>
        <b>Buyer support</b>
        <Link href="/help/bidding">Bidding & collection</Link>
        <Link href="/help/terms">Terms of sale</Link>
        <Link href="/help/privacy-and-complaints">Privacy & complaints</Link>
      </div>
      <div>
        <p>
          Malawi · Africa/Blantyre
          <br />
          All prices in MWK
        </p>
      </div>
      <div className="footer-bottom">
        © {new Date().getFullYear()} nyasamarket.com. All rights reserved.
        <span>
          No part of this website may be copied, reproduced, or distributed
          without written permission.
        </span>
      </div>
    </footer>
  );
}
export function DemoNotice() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={"demo-note " + (expanded ? "expanded" : "")}>
      <span className="status-dot" aria-hidden="true" />
      <span className="demo-note-copy">
        Items listed may include collateral offered through loan-recovery
        processes and assets offered for disposal by their owners or authorized
        sellers. All sales are subject to the applicable listing and sale terms.
        Review each item's description, condition, price and collection
        arrangements before bidding or buying.
      </span>
      <button
        type="button"
        className="demo-note-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Read less" : "Read more"}
      </button>
    </div>
  );
}
export function Countdown({ end }: { end?: string }) {
  const [remaining, setRemaining] = useState("Scheduled close");
  useEffect(() => {
    if (!end) return;
    const tick = () => {
      const d = Math.max(0, new Date(end).getTime() - Date.now());
      setRemaining(
        d === 0
          ? "Awaiting server closure"
          : `${Math.floor(d / 86400000)}d ${Math.floor(d / 3600000) % 24}h ${Math.floor(d / 60000) % 60}m`,
      );
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [end]);
  return (
    <span>
      <Clock size={13} />
      {remaining}
    </span>
  );
}
export function AssetCard({ item }: { item: Listing }) {
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState(false);
  const auction = item.method.includes("auction");
  return (
    <article className="asset-card">
      <div className="asset-photo">
        <Link href={"/listing/" + item.slug}>
          <img src={item.image} alt={item.title} loading="lazy" />
        </Link>
        <span className={"sale-badge " + (auction ? "auction" : "fixed")}>
          {auction ? <Clock size={12} /> : <CheckCircle2 size={12} />}{" "}
          {methodName(item.method)}
        </span>
        <button
          className={"save-button " + (saved ? "saved" : "")}
          aria-label={"Save " + item.title}
          onClick={async () => {
            try {
              const r = await fetch("/api/watchlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ listing_id: item.id }),
              });
              if (!r.ok) {
                setNotice(true);
                return;
              }
              setSaved(!saved);
            } catch {
              setNotice(true);
            }
          }}
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>
        <span className="condition-badge">{item.condition} condition</span>
      </div>
      <div className="asset-body">
        <div className="eyebrow">
          {item.category}{" "}
          <span>#{item.id.replace("demo-", "").slice(0, 8).toUpperCase()}</span>
        </div>
        <Link href={"/listing/" + item.slug}>
          <h3>{item.title}</h3>
        </Link>
        <p className="location">
          <MapPin size={13} />
          {item.location}
        </p>
        <div className="card-price">
          <div>
            <small>{auction ? "Current bid" : "Fixed price"}</small>
            <strong>{money(item.price)}</strong>
          </div>
          {auction ? (
            <span className="bid-count">{item.bids} bids</span>
          ) : (
            <span className="offer-label">Offers welcome</span>
          )}
        </div>
        <div className="card-bottom">
          {auction ? (
            <Countdown end={item.ends_at} />
          ) : (
            <span>
              <PackageCheck size={14} />
              Collection available
            </span>
          )}
          <Link href={"/listing/" + item.slug}>
            View asset <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
      <Dialog open={notice} onOpenChange={setNotice}>
        <DialogContent>
          <DialogTitle>Save assets to your watchlist</DialogTitle>
          <DialogDescription>
            Account access is available through the secure private portal.
            Public browsing remains open for discovery only.
          </DialogDescription>
          <button className="btn primary" onClick={() => setNotice(false)}>
            Close
          </button>
        </DialogContent>
      </Dialog>
    </article>
  );
}
export default function Marketplace({
  initial,
  demo,
  browse = false,
}: {
  initial: Listing[];
  demo: boolean;
  browse?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All assets");
  useCatalogTools((q,c)=>{setQuery(q);setCategory(c);document.getElementById("catalogue")?.scrollIntoView({behavior:"smooth"});});
  const [method, setMethod] = useState("all");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState("featured");
  const [condition, setCondition] = useState("all");
  const [max, setMax] = useState("");
  useEffect(() => {
    const m = new URLSearchParams(locationSearch()).get("method");
    if (m) setMethod(m);
  }, []);
  const filtered = initial
    .filter(
      (i) =>
        (category === "All assets" || i.category === category) &&
        i.title.toLowerCase().includes(query.toLowerCase()) &&
        (method === "all" ||
          (method === "auction"
            ? i.method.includes("auction")
            : !i.method.includes("auction"))) &&
        (location === "all" || i.location === location) &&
        (condition === "all" || i.condition === condition) &&
        (!max || i.price <= Number(max)),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : sort === "ending"
            ? new Date(a.ends_at || "2100").getTime() -
              new Date(b.ends_at || "2100").getTime()
            : 0,
    );
  return (
    <>
      <Header
        query={query}
        onSearchChange={setQuery}
        onSaleMethodChange={setMethod}
      />
      <main>
        {!browse && initial.length > 0 ? (
          <section className="hero">
            <div className="hero-content">
              <div className="hero-kicker">
                <span /> VERIFIED INSTITUTION · MALAWI
              </div>
              <h1>
                Find your next asset.
                <br />
                <em>Unlock more value.</em>
              </h1>
              <p>
                Discover vehicles, electronics and more through
                <br className="desktop-break" /> transparent auctions and
                fixed-price sales.
              </p>
              <form
                className="hero-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  document
                    .getElementById("catalogue")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <Search size={20} />
                <input
                  aria-label="Search assets"
                  placeholder="What are you looking for?"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button>
                  Explore assets <ArrowRight size={17} />
                </button>
              </form>
              <div className="hero-checks">
                <span>
                  <ShieldCheck size={16} />
                  Institution-approved assets
                </span>
                <span>
                  <LockKeyhole size={16} />
                  Secure payment
                </span>
              </div>
            </div>
            <div className="hero-visual">
              <div className="visual-orbit" />
              <div className="featured-label">
                FEATURED LISTING
              </div>
              <img
                src={initial[0].image}
                alt={initial[0].title}
              />
              <div className="hero-asset-caption">
                <div>
                  <span>
                    {initial[0].category.toUpperCase()} · {initial[0].location.toUpperCase()}
                  </span>
                  <h2>{initial[0].title}</h2>
                </div>
                <Link
                  href={"/listing/" + initial[0].slug}
                  aria-label={"View " + initial[0].title}
                >
                  <ArrowUpRight />
                </Link>
              </div>
              <div className="float-label">
                <span className="status-dot" />
                {methodName(initial[0].method)} <b>{money(initial[0].price)}</b>
              </div>
            </div>
          </section>
        ) : browse ? (
          <section className="browse-heading">
            <div className="eyebrow">THE MARKETPLACE</div>
            <h1>Find something worth owning.</h1>
            <p>Explore assets by category, location and sale method.</p>
          </section>
        ) : null}
        <div className="trust-strip">
          <span>
            <ShieldCheck />
            Institution-led sales
          </span>
          <span>
            <Clock />
            Transparent bidding
          </span>
          <span>
            <LockKeyhole />
            Verified payment before release
          </span>
          <span>
            <PackageCheck />
            Clear collection process
          </span>
        </div>
        <section id="catalogue" className="catalogue">
          <div className="section-top">
            <div>
              <div className="eyebrow">DISCOVER THE MARKETPLACE</div>
              <h2>
                {browse
                  ? "Browse all assets"
                  : "Good assets. New possibilities."}
              </h2>
            </div>
            <Link href="/browse">
              View all assets <ArrowRight size={17} />
            </Link>
          </div>
          <div className="categories">
            {categories.map((c, i) => {
              const Icon = icons[i];
              return (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  onClick={() => setCategory(c)}
                >
                  <Icon size={20} />
                  {c}
                </button>
              );
            })}
          </div>
          <div className="catalogue-toolbar">
            <div className="segmented">
              <button
                className={method === "all" ? "active" : ""}
                onClick={() => setMethod("all")}
              >
                All listings
              </button>
              <button
                className={method === "auction" ? "active" : ""}
                onClick={() => setMethod("auction")}
              >
                Live auctions{" "}
                <span>
                  {initial.filter((i) => i.method.includes("auction")).length}
                </span>
              </button>
              <button
                className={method === "fixed" ? "active" : ""}
                onClick={() => setMethod("fixed")}
              >
                Buy now
              </button>
            </div>
            <div className="filter-tools">
              <Pick
                value={location}
                set={setLocation}
                choices={["all", "Lilongwe", "Blantyre", "Mzuzu"]}
                label="Location"
              />
              <Pick
                value={sort}
                set={setSort}
                choices={["featured", "ending", "low", "high"]}
                label="Sort"
              />
            </div>
          </div>
          {browse && (
            <div className="mobile-filter-row">
              <Pick
                value={location}
                set={setLocation}
                choices={["all", "Lilongwe", "Blantyre", "Mzuzu"]}
                label="Location"
              />
              <Pick
                value={condition}
                set={setCondition}
                choices={["all", "Good", "Fair", "Excellent"]}
                label="Condition"
              />
              <input
                aria-label="Maximum price in MWK"
                type="number"
                min="0"
                placeholder="Max MWK"
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
            </div>
          )}
          {browse && (
            <div className="extra-filters">
              <label className="search-field">
                <Search size={17} />
                <input
                  aria-label="Search catalogue"
                  placeholder="Search assets"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <Pick
                value={condition}
                set={setCondition}
                choices={["all", "Good", "Fair", "Excellent"]}
                label="Condition"
              />
              <input
                aria-label="Maximum price in MWK"
                type="number"
                min="0"
                placeholder="Max price · MWK"
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
            </div>
          )}
          <div className="results-line">
            {filtered.length} assets available{" "}
            <span>All prices in Malawi kwacha (MWK)</span>
          </div>
          {demo && <DemoNotice />}
          <div className="asset-grid">
            {filtered.map((i) => (
              <AssetCard item={i} key={i.id} />
            ))}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <Search size={30} />
              <h3>{initial.length ? "No matching assets" : "No assets listed yet"}</h3>
              <p>
                {initial.length
                  ? "Try another category or a broader search."
                  : "Approved listings will appear here when they are available."}
              </p>
              {!!initial.length && (
                <button
                  className="btn secondary"
                  onClick={() => {
                    setQuery("");
                    setCategory("All assets");
                    setMethod("all");
                    setLocation("all");
                    setMax("");
                    setCondition("all");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </section>
        <section className="how-section">
          <div>
            <div className="eyebrow">A SIMPLE, CLEAR PROCESS</div>
            <h2>
              From discovery
              <br />
              to collection.
            </h2>
            <Link href="/help">
              See how it works <ArrowUpRight size={17} />
            </Link>
          </div>
          {[
            [
              "01",
              "Find your asset",
              "Browse the condition, specifications and collection details.",
            ],
            [
              "02",
              "Bid, buy or make an offer",
              "Choose the sale method that works for you.",
            ],
            [
              "03",
              "Pay securely & collect",
              "Payment is verified before your collection is approved.",
            ],
          ].map(([n, t, p]) => (
            <div className="how-step" key={n}>
              <span>{n}</span>
              <h3>{t}</h3>
              <p>{p}</p>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
function locationSearch() {
  return typeof window !== "undefined" ? window.location.search : "";
}
export function Pick({
  value,
  set,
  choices,
  label,
}: {
  value: string;
  set: (v: string) => void;
  choices: string[];
  label: string;
}) {
  const names: Record<string, string> = {
    all: "All " + label.toLowerCase() + "s",
    featured: "Featured first",
    ending: "Ending soon",
    low: "Price: low to high",
    high: "Price: high to low",
  };
  return (
    <Select value={value} onValueChange={set}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {choices.map((c) => (
          <SelectItem value={c} key={c}>
            {names[c] || c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
