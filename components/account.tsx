"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  ShieldCheck,
  Heart,
  Clock,
  PackageCheck,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import { Header, Footer, AssetCard } from "./marketplace";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { money } from "@/lib/catalog";
function StaffSignInImage() {
  return (
    <div className="auth-intro auth-intro-image">
      <img
        src="/assets/collateral-loan.png"
        alt="Collateral-backed loan assets including property, gold, a vehicle, and a fixed deposit"
      />
    </div>
  );
}
export default function Account({
  staff = false,
  onAuthenticated,
}: {
  staff?: boolean;
  onAuthenticated?: (d: any) => void;
}) {
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>({});
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfa, setMfa] = useState<any>(null);
  const [code, setCode] = useState("");
  const [oauthClient, setOauthClient] = useState<any>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  function safeReturnPath() {
    const requested =
      new URLSearchParams(window.location.search).get("next") ||
      sessionStorage.getItem("cmrp_auth_next");
    if (!requested || !requested.startsWith("/") || requested.startsWith("//")) return null;
    try {
      const destination = new URL(requested, window.location.origin);
      const appRoot = new URL(import.meta.env.BASE_URL, window.location.origin).pathname;
      if (destination.origin !== window.location.origin || !destination.pathname.startsWith(appRoot)) return null;
      return destination.pathname + destination.search + destination.hash;
    } catch {
      return null;
    }
  }

  async function load() {
    let r = await fetch("/api/session");
    if(r.status===401){const refreshed=await fetch("/api/auth/refresh",{method:"POST"});if(refreshed.ok)r=await fetch("/api/session");}
    if (r.ok) {
      const d: any = await r.json();
      setUser(d.user);
      const returnPath = safeReturnPath();
      if (returnPath) {
        sessionStorage.removeItem("cmrp_auth_next");
        window.location.replace(returnPath);
        return;
      }
      if (staff) {
        onAuthenticated?.(d);
        return;
      }
      const a = await fetch("/api/account");
      if (a.ok) setData(await a.json());
    }
  }
  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | undefined;
    const initialize = async () => {
      await load();
      try {
        const response = await fetch("/api/public-config");
        const configuration: any = await response.json();
        if (!response.ok) throw Error(configuration.error);
        if (!active) return;
        const client = createClient(configuration.url, configuration.key, {
          auth: {
            flowType: "pkce",
            autoRefreshToken: false,
            persistSession: true,
            storage: window.sessionStorage,
            storageKey: "cmrp_google_oauth",
            detectSessionInUrl: true,
          },
        });
        setOauthClient(client);
        const { data } = client.auth.onAuthStateChange((_event: string, session: any) => {
          if (!session?.access_token) return;
          sessionStorage.setItem("cmrp_access_token", session.access_token);
          if (session.refresh_token) sessionStorage.setItem("cmrp_refresh_token", session.refresh_token);
          setUser(session.user);
          const returnPath = safeReturnPath();
          if (returnPath) {
            sessionStorage.removeItem("cmrp_auth_next");
            window.location.replace(returnPath);
          } else {
            void load();
          }
        });
        subscription = data.subscription;
        const { data: sessionData } = await client.auth.getSession();
        if (sessionData.session?.access_token) {
          sessionStorage.setItem("cmrp_access_token", sessionData.session.access_token);
          if (sessionData.session.refresh_token) sessionStorage.setItem("cmrp_refresh_token", sessionData.session.refresh_token);
          await load();
        }
      } catch (error) {
        if (active && window.location.search.includes("code=")) {
          setError((error as Error).message);
        }
      }
    };
    void initialize();
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);
  async function signInWithGoogle() {
    setGoogleBusy(true);
    setError("");
    try {
      let client = oauthClient;
      if (!client) {
        const response = await fetch("/api/public-config");
        const configuration: any = await response.json();
        if (!response.ok) throw Error(configuration.error);
        client = createClient(configuration.url, configuration.key, {
          auth: { flowType: "pkce", autoRefreshToken: false, persistSession: true, storage: window.sessionStorage, storageKey: "cmrp_google_oauth", detectSessionInUrl: true },
        });
        setOauthClient(client);
      }
      const redirectTo = new URL(`${import.meta.env.BASE_URL}account`, window.location.origin).toString();
      const requested = safeReturnPath();
      if (requested) sessionStorage.setItem("cmrp_auth_next", requested);
      const { error: oauthError } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams: { prompt: "select_account" } },
      });
      if (oauthError) throw oauthError;
    } catch (error) {
      setError((error as Error).message);
      setGoogleBusy(false);
    }
  }
  async function auth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth/" + mode, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(f)),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      if (mode === "login") {
        await load();
      } else
        setSuccess(
          mode === "signup"
            ? "Check your email to confirm your account before signing in."
            : "Check your email for a secure recovery link.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await oauthClient?.auth.signOut();
    setUser(null);
    setData({});
  }
  async function verifyMfa(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/auth/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, ...mfa }),
    });
    const d: any = await r.json();
    if (!r.ok) setError(d.error);
    else {
      setMfa(null);
      await load();
    }
  }
  if (user && staff)
    return (
      <div className="auth-layout">
        <StaffSignInImage />
        <div className="auth-panel">
          <h2>Secure staff access</h2>
          {error && <p className="error">{error}</p>}
          {mfa ? (
            <form onSubmit={verifyMfa} className="form-grid">
              <label>
                Authenticator code
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button className="btn primary">Verify</button>
            </form>
          ) : (
            <button
              className="btn primary"
              onClick={async () => {
                const r = await fetch("/api/auth/mfa");
                const d: any = await r.json();
                if (!r.ok) setError(d.error);
                else setMfa(d);
              }}
            >
              Verify with authenticator
            </button>
          )}
          <button className="text-button" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    );
  return (
    <>
      {!staff && <Header />}
      {!user ? (
        <div className="auth-layout">
          {staff ? (
            <StaffSignInImage />
          ) : (
            <div className="auth-intro">
              <ShieldCheck size={35} />
              <h1>Your next asset starts here.</h1>
              <p>
                One account to follow auctions, manage offers and keep track of your purchases.
              </p>
              <ul>
                <li>
                  <Clock size={17} />
                  Track bids and auction outcomes
                </li>
                <li>
                  <Heart size={17} />
                  Keep a personal watchlist
                </li>
                <li>
                  <PackageCheck size={17} />
                  Follow payments and collection
                </li>
              </ul>
            </div>
          )}
          <div className="auth-panel">
            <h2>
              {staff
                ? "Staff sign in"
                : mode === "signup"
                  ? "Create your account"
                  : mode === "recover"
                    ? "Reset your password"
                    : "Welcome back"}
            </h2>
            <p>
              {staff
                ? "Use your institution-assigned staff account."
                : "Sign in to your nyasamarket.com buyer account."}
            </p>
            {!staff && (
              <div className="segmented">
                <button
                  className={mode === "login" ? "active" : ""}
                  onClick={() => setMode("login")}
                >
                  Sign in
                </button>
                <button
                  className={mode === "signup" ? "active" : ""}
                  onClick={() => setMode("signup")}
                >
                  Create account
                </button>
              </div>
            )}
            {!staff && mode !== "recover" && (
              <button
                type="button"
                className="btn secondary google-sign-in"
                onClick={signInWithGoogle}
                disabled={googleBusy}
              >
                <GoogleMark />
                {googleBusy ? "Connecting to Google…" : "Continue with Google"}
              </button>
            )}
            {!staff && mode !== "recover" && <div className="auth-divider"><span>or use email</span></div>}
            <form onSubmit={auth} className="form-grid">
              {mode === "signup" && (
                <label>
                  Display name
                  <input
                    name="display_name"
                    required
                    autoComplete="name"
                    maxLength={80}
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </label>
              {mode !== "recover" && (
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    minLength={mode === "signup" ? 12 : undefined}
                    required
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                  />
                </label>
              )}
              {mode === "signup" && (
                <label style={{ fontWeight: 400 }}>
                  <input type="checkbox" required /> I agree to the{" "}
                  <Link href="/help?section=terms">
                    terms and privacy notice
                  </Link>
                  .
                </label>
              )}
              {error && <p className="error">{error}</p>}
              {success && <p className="success">{success}</p>}
              <button className="btn primary" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "recover"
                      ? "Send recovery email"
                      : "Sign in securely"}
              </button>
            </form>
            <button
              className="text-button"
              onClick={() => setMode(mode === "recover" ? "login" : "recover")}
            >
              {mode === "recover" ? "Back to sign in" : "Forgot your password?"}
            </button>
            <p
              className="muted"
              style={{ fontSize: 10, marginTop: 20, lineHeight: 1.8 }}
            >
              A Supabase connection is required for account access. No passwords
              are stored in this website.
            </p>
            {staff && (
              <Link className="text-button" href="/">
                ← Back to marketplace
              </Link>
            )}
          </div>
        </div>
      ) : (
        <main className="page-wrap">
          <div className="section-top">
            <div>
              <div className="eyebrow">MY ACCOUNT</div>
              <h2>
                Hello,{" "}
                {user.user_metadata?.display_name || user.email?.split("@")[0]}
              </h2>
            </div>
            <button className="btn secondary" onClick={logout}>
              <LogOut size={15} />
              Sign out
            </button>
          </div>
          <Tabs defaultValue="orders" className="account-tabs">
            <TabsList>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="bids">Bids</TabsTrigger>
              <TabsTrigger value="offers">Offers</TabsTrigger>
              <TabsTrigger value="saved">Watchlist</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>
            <TabsContent value="orders">
              <div style={{ marginTop: 22 }}>
                {data.orders?.length ? (
                  data.orders.map((o: any) => (
                    <div
                      className="panel"
                      key={o.id}
                      style={{ marginBottom: 15 }}
                    >
                      <div className="section-top">
                        <div>
                          <h3>{o.order_no}</h3>
                          <p className="account-stat">
                            {money(o.amount_due)} · {o.status}
                          </p>
                        </div>
                        {o.status === "awaiting_payment" && (
                          <button
                            className="btn primary"
                            onClick={async () => {
                              const r = await fetch("/api/payments/checkout", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ order_id: o.id }),
                              });
                              const d: any = await r.json();
                              if (!r.ok) setError(d.error);
                              else window.location.assign(d.checkout_url);
                            }}
                          >
                            Pay with PayChangu
                          </button>
                        )}
                      </div>
                      <p
                        className="muted"
                        style={{ fontSize: 12, marginTop: 15 }}
                      >
                        {o.status === "paid"
                          ? "Payment verified. Collection requires release approval."
                          : "Payment is confirmed only after server verification."}
                      </p>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="No orders yet"
                    text="Your purchases and auction wins will appear here."
                  />
                )}
                {error && <p className="error">{error}</p>}
              </div>
            </TabsContent>
            <TabsContent value="bids">
              <Records
                rows={data.bids}
                title="No bids yet"
                text="Find an auction and place a bid to get started."
              />
            </TabsContent>
            <TabsContent value="offers">
              {data.offers?.filter((o:any)=>o.proposed_by==="seller"&&o.status==="open").map((o:any)=><div className="panel" key={o.id} style={{marginTop:20}}><b>Seller counteroffer · {money(o.amount)}</b><p className="account-stat">Expires {new Date(o.expires_at).toLocaleString("en-GB",{timeZone:"Africa/Blantyre"})} CAT</p><button className="btn primary" onClick={async()=>{const r=await fetch("/api/offers/accept",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({offer_id:o.id})});const d:any=await r.json();if(!r.ok)setError(d.error);else await load();}}>Accept & reserve</button></div>)}
              <Records
                rows={data.offers}
                title="No offers yet"
                text="Your offers and seller responses will appear here."
              />
            </TabsContent>
            <TabsContent value="saved">
              {data.watchlist?.length ? (
                <div className="asset-grid" style={{ marginTop: 25 }}>
                  {data.watchlist.map((i: any) => (
                    <AssetCard key={i.id} item={i} />
                  ))}
                </div>
              ) : (
                <Empty
                  title="Your watchlist is empty"
                  text="Save assets from the catalogue to revisit them later."
                />
              )}
            </TabsContent>
            <TabsContent value="notifications"><div style={{marginTop:25}}>{data.notifications?.length?data.notifications.map((n:any)=><div className="panel" key={n.id} style={{marginBottom:12}}><b>{n.kind.replaceAll("_"," ")}</b><p className="account-stat" style={{overflowWrap:"anywhere"}}>{n.message}</p><small className="muted">{new Date(n.created_at).toLocaleString("en-GB",{timeZone:"Africa/Blantyre"})} CAT</small></div>):<Empty title="No notifications" text="Bid, offer, payment and collection updates will appear here."/>}</div></TabsContent>
            <TabsContent value="security">
              <div className="panel" style={{ marginTop: 25 }}>
                <h3>Account security</h3>
                <p className="account-stat">
                  {user.email} ·{" "}
                  {user.email_confirmed_at
                    ? "Email verified"
                    : "Verification pending"}
                </p>
                <button
                  className="text-button"
                  onClick={async () => {
                    await fetch("/api/auth/recover", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email: user.email }),
                    });
                    setSuccess("Recovery email requested.");
                  }}
                >
                  Request password reset
                </button>
                {success && <p className="success">{success}</p>}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      )}
      {!staff && <Footer />}
    </>
  );
}
function GoogleMark() {
  return <span className="google-mark" aria-hidden="true">G</span>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <PackageCheck size={35} />
      <h3>{title}</h3>
      <p>{text}</p>
      <Link className="btn primary" href="/browse">
        Browse assets
      </Link>
    </div>
  );
}
function Records({
  rows,
  title,
  text,
}: {
  rows: any[];
  title: string;
  text: string;
}) {
  return rows?.length ? (
    <div style={{ marginTop: 25 }}>
      {rows.map((r) => (
        <div className="panel" key={r.id} style={{ marginBottom: 15 }}>
          <b>{money(r.amount)}</b>
          <p className="account-stat">
            {r.status} ·{" "}
            {new Date(r.created_at || r.placed_at).toLocaleString("en-GB", {
              timeZone: "Africa/Blantyre",
            })}{" "}
            CAT
          </p>
        </div>
      ))}
    </div>
  ) : (
    <Empty title={title} text={text} />
  );
}
