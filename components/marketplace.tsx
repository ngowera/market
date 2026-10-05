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
        CMRP<small>COLLATERAL MARKETPLACE</small>
      </span>
    </Link>
  );
}
export function Header() {
  return (
    <>
      <div className="announcement">
        <ShieldCheck size={14} /> Institution-led asset sales. Transparent by
        design.<span>Malawi · MWK</span>
      </div>
      <header className="public-header">
        <Brand />
        <nav>
          <Link href="/browse">Browse assets</Link>
          <Link href="/browse?method=auction">Auctions</Link>
          <Link href="/browse?method=fixed">Buy now</Link>
          <Link href="/help">How it works</Link>
        </nav>
        <Link className="account-link" href="/account">
          My account <ArrowUpRight size={16} />
        </Link>
      </header>
    </>
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
        <Link href="/account">My account</Link>
      </div>
      <div>
        <b>Buyer support</b>
        <Link href="/help">Bidding & collection</Link>
        <Link href="/help?section=terms">Terms of sale</Link>
        <Link href="/help?section=privacy">Privacy & complaints</Link>
      </div>
      <div>
        <b>For the institution</b>
        <Link href="/admin">
          Staff portal <ArrowUpRight size={13} />
        </Link>
        <p>
          Malawi · Africa/Blantyre
          <br />
          All prices in MWK
        </p>
      </div>
      <div className="footer-bottom">
        © {new Date().getFullYear()} CMRP. Collateral Marketplace & Recovery
        Platform.<span>Built around trust. Backed by traceability.</span>
      </div>
    </footer>
  );
}
export function DemoNotice() {
  return (
    <div className="demo-note">
      <span className="status-dot" /> Preview catalogue · Sample assets and
      reference photos. Purchases and bids require connected services.
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
            Sign in to save assets. Sample listings cannot be added to a real
            watchlist.
          </DialogDescription>
          <Link className="btn primary" href="/account">
            Go to my account
          </Link>
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
      <Header />
      <main>
        {!browse ? (
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
                THE FEATURED LOT <span>01 / 04</span>
              </div>
              <img
                src="/assets/hilux.webp"
                alt="White Toyota Hilux, illustrative sample asset"
              />
              <div className="hero-asset-caption">
                <div>
                  <span>VEHICLES · LILONGWE</span>
                  <h2>Toyota Hilux Double Cab</h2>
                </div>
                <Link
                  href="/listing/toyota-hilux-double-cab"
                  aria-label="Explore featured Hilux"
                >
                  <ArrowUpRight />
                </Link>
              </div>
              <div className="float-label">
                <span className="status-dot" />
                Sample auction <b>{money(18500000)}</b>
              </div>
            </div>
          </section>
        ) : (
          <section className="browse-heading">
            <div className="eyebrow">THE MARKETPLACE</div>
            <h1>Find something worth owning.</h1>
            <p>Explore assets by category, location and sale method.</p>
          </section>
        )}
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
              <h3>No matching assets</h3>
              <p>Try another category or a broader search.</p>
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
        <section className="staff-banner">
          <ShieldCheck size={28} />
          <div>
            <b>Every asset has a story. Every sale has a record.</b>
            <p>
              Built for transparent sales and accountable institutional
              recovery.
            </p>
          </div>
          <Link href="/admin">
            Staff portal <ChevronRight size={18} />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
function locationSearch() {
  return window.location.search;
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
