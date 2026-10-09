"use client";
import { useState, useEffect, useRef } from "react";
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
  const [listings, setListings] = useState(initial);
  const [isDemo, setIsDemo] = useState(demo);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All assets");
  useCatalogTools((q,c)=>{setQuery(q);setCategory(c);document.getElementById("catalogue")?.scrollIntoView({behavior:"smooth"});});
  const [method, setMethod] = useState("all");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState("featured");
  const [condition, setCondition] = useState("all");
  const [max, setMax] = useState("");
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [previousFeaturedIndex, setPreviousFeaturedIndex] = useState<number | null>(null);
  const [featuredTransitioning, setFeaturedTransitioning] = useState(false);
  const [featuredPaused, setFeaturedPaused] = useState(false);
  const [desktopHero, setDesktopHero] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const featuredIndexRef = useRef(0);
  const featuredTransitionTimeout = useRef<number | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/catalog", { cache: "no-store" });
        if (!response.ok) return;
        const data: { listings?: Listing[]; demo?: boolean } =
          await response.json();
        if (active && Array.isArray(data.listings)) {
          setListings(data.listings);
          setIsDemo(data.demo === true);
        }
      } catch {}
    };
    const onFocus = () => void refresh();
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  useEffect(() => {
    const m = new URLSearchParams(locationSearch()).get("method");
    if (m) setMethod(m);
  }, []);
  const filtered = listings
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
    const featuredCategories = new Map<string, Listing>();
    for (const listing of listings) {
      if (listing.image && !featuredCategories.has(listing.category)) {
        featuredCategories.set(listing.category, listing);
      }
    }
    const featuredListings = Array.from(featuredCategories.values());
    const featuredKey = featuredListings.map((listing) => listing.id).join("|");
    const featuredListing = featuredListings[featuredIndex] || listings[0];

    useEffect(() => {
      const desktopQuery = window.matchMedia("(min-width: 1101px)");
      const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const updateMedia = () => {
        setDesktopHero(desktopQuery.matches);
        setReducedMotion(motionQuery.matches);
      };
      updateMedia();
      desktopQuery.addEventListener("change", updateMedia);
      motionQuery.addEventListener("change", updateMedia);
      return () => {
        desktopQuery.removeEventListener("change", updateMedia);
        motionQuery.removeEventListener("change", updateMedia);
      };
    }, []);

    useEffect(() => {
      featuredIndexRef.current = 0;
      setFeaturedIndex(0);
      setPreviousFeaturedIndex(null);
      setFeaturedTransitioning(false);
    }, [featuredKey]);

    useEffect(() => {
      if (!desktopHero || reducedMotion || featuredPaused || featuredListings.length < 2) return;
      const interval = window.setInterval(() => {
        const nextIndex = (featuredIndexRef.current + 1) % featuredListings.length;
        setPreviousFeaturedIndex(featuredIndexRef.current);
        featuredIndexRef.current = nextIndex;
        setFeaturedIndex(nextIndex);
        setFeaturedTransitioning(true);
      }, 4000);
      return () => {
        window.clearInterval(interval);
      };
    }, [desktopHero, featuredKey, featuredListings.length, featuredPaused, reducedMotion]);

    useEffect(() => {
      if (!featuredTransitioning) return;
      featuredTransitionTimeout.current = window.setTimeout(() => {
        setFeaturedTransitioning(false);
        setPreviousFeaturedIndex(null);
        featuredTransitionTimeout.current = null;
      }, 900);
      return () => {
        if (featuredTransitionTimeout.current !== null) {
          window.clearTimeout(featuredTransitionTimeout.current);
          featuredTransitionTimeout.current = null;
        }
      };
    }, [featuredTransitioning, featuredIndex]);

  return (
    <>
      <Header
        query={query}
        onSearchChange={setQuery}
        onSaleMethodChange={setMethod}
      />
      <main>
        {!browse && listings.length > 0 && featuredListing ? (
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
            <div
              className="hero-visual"
              onMouseEnter={() => setFeaturedPaused(true)}
              onMouseLeave={() => setFeaturedPaused(false)}
              onFocusCapture={() => setFeaturedPaused(true)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setFeaturedPaused(false);
                }
              }}
            >
              <div className="visual-orbit" />
              <div className="featured-label">
                FEATURED LISTING
              </div>
              <div className="featured-image-frame">
                {featuredTransitioning && previousFeaturedIndex !== null && featuredListings[previousFeaturedIndex] && (
                  <img
                    className="featured-slide featured-slide-out"
                    src={featuredListings[previousFeaturedIndex].image}
                    alt=""
                    aria-hidden="true"
                  />
                )}
                <img
                  key={featuredListing.id}
                  className={"featured-slide " + (featuredTransitioning ? "featured-slide-in" : "featured-slide-active")}
                  src={featuredListing.image}
                  alt={featuredListing.title}
                />
              </div>
              <div className="hero-asset-caption">
                <div>
                  <span>
                    {featuredListing.category.toUpperCase()} · {featuredListing.location.toUpperCase()}
                  </span>
                  <h2>{featuredListing.title}</h2>
                </div>
                <Link
                  href={"/listing/" + featuredListing.slug}
                  aria-label={"View " + featuredListing.title}
                >
                  <ArrowUpRight />
                </Link>
              </div>
              <div className="float-label">
                <span className="status-dot" />
                {methodName(featuredListing.method)} <b>{money(featuredListing.price)}</b>
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
                  {listings.filter((i) => i.method.includes("auction")).length}
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
                choices={["all", "New", "Excellent", "Good", "Fair"]}
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
                choices={["all", "New", "Excellent", "Good", "Fair"]}
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
          {isDemo && <DemoNotice />}
          <div className="asset-grid">
            {filtered.map((i) => (
              <AssetCard item={i} key={i.id} />
            ))}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <Search size={30} />
              <h3>{listings.length ? "No matching assets" : "No assets listed yet"}</h3>
              <p>
                {listings.length
                  ? "Try another category or a broader search."
                  : "Approved listings will appear here when they are available."}
              </p>
              {!!listings.length && (
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
