"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Boxes,
  FileCheck2,
  Gavel,
  MessagesSquare,
  CreditCard,
  PackageCheck,
  Scale,
  Users,
  ScrollText,
  BarChart3,
  Settings,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Bell,
  Plus,
  Search,
  Download,
  TrendingUp,
  Wallet,
  Clock,
  AlertTriangle,
  LogOut,
  Check,
  Link2,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Brand, Pick } from "./marketplace";
import Account from "./account";
import { money, methodName } from "@/lib/catalog";
const navigation = [
  ["Dashboard", LayoutDashboard],
  ["Collateral", Boxes],
  ["Listings", FileCheck2],
  ["Approvals", ShieldCheck],
  ["Auctions", Gavel],
  ["Offers", MessagesSquare],
  ["Orders & payments", CreditCard],
  ["Release desk", PackageCheck],
  ["Settlements", Scale],
  ["Reports", BarChart3],
  ["Logs", ScrollText],
  ["Users & security", Users],
  ["Configuration", Settings],
] as const;
export default function Admin({ connected }: { connected: boolean }) {
  const [view, setView] = useState("Dashboard");
  const [staff, setStaff] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [pending, setPending] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [records, setRecords] = useState<any>({});
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (connected)
      fetch("/api/session")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: any) => {
          if (d?.staff) setStaff(d.staff);
        });
  }, [connected]);
  useEffect(() => {
    if (!staff) return;
    setLoading(true);
    fetch("/api/admin/data")
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error);
        setRecords(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [staff, view, success]);
  const listings = records.listings || [];
  const assets = records.assets || [];
  const approvals = records.approvals || [];
  const orders = records.orders || [];
  const level = staff?.security_level || 0;
  const write = async (path: string, body: any) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/admin/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      setSuccess(
        d.release_code
          ? `Cash collection code: ${d.release_code}. Verify the collector before handover.`
          : d.order_no
            ? `Cash sale recorded as ${d.order_no}. The item is sold; request collection approval before handover.`
            : d.message || "Action recorded successfully.",
      );
      setModal("");
      setPending(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  function open(type: string, row?: any) {
    setError("");
    setSelected(row);
    setModal(type);
  }
  function exportCsv() {
    const rows =
      view === "Logs"
        ? records.logs || []
        : view === "Orders & payments"
          ? orders
          : assets;
    const keys = Object.keys(rows[0] || {}).filter(
      (k) => !["specs", "proposed_values"].includes(k),
    );
    const cell = (v: any) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@-]/, "'")
        .replaceAll('"', '""') +
      '"';
    const csv = [
      keys.join(","),
      ...rows.map((r: any) => keys.map((k) => cell(r[k])).join(",")),
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "cmrp-" + view.toLowerCase().replaceAll(" ", "-") + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
    write("export", { report: view });
  }
  if (!connected)
    return (
      <>
        <header className="public-header">
          <Brand />
          <Link className="btn secondary" href="/">
            Browse marketplace
          </Link>
        </header>
        <div className="auth-layout">
          <div className="auth-panel">
            <h2>Staff sign-in unavailable here</h2>
            <p>
              GitHub Pages is a read-only preview. Staff sign-in requires the
              server-backed admin app.
            </p>
          </div>
        </div>
      </>
    );
  if (!staff)
    return (
      <>
        <header className="public-header">
          <Brand />
          <Link className="btn secondary" href="/">Browse marketplace</Link>
        </header>
        <Account
          staff
          onAuthenticated={(d) => {
            if (d.staff) setStaff(d.staff);
            else
              setError(
                "This account is not an active staff account, or requires MFA.",
              );
          }}
        />
        {error && (
          <p className="error" style={{ maxWidth: 450, margin: "20px auto" }}>
            {error}
          </p>
        )}
      </>
    );
  return (
    <SidebarProvider className="admin-shell">
      <Sidebar collapsible="none" className="admin-sidebar">
        <SidebarHeader style={{ padding: 0 }}>
          <Brand />
        </SidebarHeader>
        <SidebarContent style={{ overflow: "visible" }}>
          <div className="sidebar-label">RECOVERY WORKSPACE</div>
          <SidebarMenu className="admin-nav">
            {navigation.map(([title, Icon]) => {
              if (
                level < 4 &&
                ["Users & security", "Configuration"].includes(title)
              )
                return null;
              return (
                <SidebarMenuItem key={title}>
                  <SidebarMenuButton
                    className={view === title ? "active" : ""}
                    isActive={view === title}
                    onClick={() => {
                      setView(title);
                      setQuery("");
                      setError("");
                      setSuccess("");
                    }}
                  >
                    <Icon size={17} />
                    {title}
                    {title === "Approvals" && (
                      <span>
                        {
                          approvals.filter((a: any) => a.status === "pending")
                            .length
                        }
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
          <div className="admin-sidebar-bottom">
            <p style={{ fontSize: 9, marginTop: 25, lineHeight: 1.8 }}>
              nyasamarket.com · Malawi
              <br />
              Secure recovery operations
            </p>
          </div>
        </SidebarContent>
      </Sidebar>
      <div className="admin-main">
        <header className="admin-topbar">
          <b>Recovery operations</b>
          <span>/ {view}</span>
          <div className="user-pill">
            <ShieldCheck size={15} />
            {"Level " + level + " · " + staff?.full_name}
            <span className="avatar">
              {staff?.full_name?.slice(0, 2).toUpperCase()}
            </span>
            <button
              aria-label="Sign out"
              className="text-button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                setStaff(null);
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>
        <main className="admin-content">
          <div className="admin-heading">
            <div>
              <div className="eyebrow">INSTITUTIONAL RECOVERY</div>
              <h1>
                {view === "Dashboard"
                  ? `Welcome, ${staff?.full_name?.trim().split(/\s+/)[0] || "Admin"}`
                  : view}
              </h1>
              <p>
                {view === "Dashboard"
                  ? "A clear view of assets, approvals and recovered value."
                  : descriptions[view]}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["Collateral", "Listings"].includes(view) && (
                <button
                  className="btn primary"
                  onClick={() =>
                    open(view === "Collateral" ? "asset" : "listing")
                  }
                >
                  <Plus size={15} />
                  {view === "Collateral" ? "Add collateral" : "Create listing"}
                </button>
              )}
                {["Reports", "Logs"].includes(view) && (
                <button className="btn secondary" onClick={exportCsv}>
                  <Download size={14} />
                  Export CSV
                </button>
              )}
            </div>
          </div>
          {error && (
            <p className="error" style={{ marginBottom: 15 }}>
              {error}
            </p>
          )}
          {success && (
            <p className="success" style={{ marginBottom: 15 }}>
              {success}
            </p>
          )}
          {loading && <p className="muted">Loading authorized records…</p>}
          {view === "Dashboard" && (
            <>
              <div className="kpi-grid">
                {[
                  [
                    "Net recovery",
                    money(records.kpis?.recovered || 0),
                    Wallet,
                    "Applied to loans",
                  ],
                  [
                    "Assets in custody",
                    String(assets.length),
                    Boxes,
                    "Across collection centres",
                  ],
                  [
                    "Pending approvals",
                    String(
                      approvals.filter((a: any) => a.status === "pending")
                        .length,
                    ),
                    ShieldCheck,
                    "Awaiting independent review",
                  ],
                  [
                    "Live auctions",
                    String(
                      listings.filter(
                        (i: any) =>
                          i.method.includes("auction") && i.status === "live",
                      ).length,
                    ),
                    Gavel,
                    "Server-managed sale windows",
                  ],
                ].map(([label, value, Icon, note]: any) => (
                  <div className="kpi" key={label}>
                    <div className="kpi-head">
                      {label}
                      <Icon size={17} />
                    </div>
                    <strong>{value}</strong>
                    <small>{note}</small>
                  </div>
                ))}
              </div>
              <div className="dashboard-middle">
                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Recovery performance</h2>
                      <p>Verified net value allocated to loans</p>
                    </div>
                    <span>LAST 6 MONTHS</span>
                  </div>
                  <div className="recovery-chart">
                    {(records.chart || []).map((m: any) => (
                      <div className="chart-column" key={m.month}>
                        <div
                          style={{ height: m.amount + "%" }}
                          title={m.month + ": " + m.amount}
                        />
                        <span>{m.month}</span>
                      </div>
                    ))}
                  </div>
                  <div className="chart-legend">
                    <i />
                    Net loan recovery
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-head">
                    <h2>Needs your attention</h2>
                    <span>OPERATIONS</span>
                  </div>
                  <div className="attention-list">
                    {[
                      [
                        ShieldCheck,
                        "Pending approvals",
                        approvals.length + " requests need a checker",
                        "Approvals",
                      ],
                      [
                        PackageCheck,
                        "Awaiting collection",
                        orders.filter((o: any) => o.status === "paid").length +
                          " verified paid orders",
                        "Release desk",
                      ],
                      [
                        Link2,
                        "Loan integration",
                        "Review recovery posting status",
                        "Settlements",
                      ],
                    ].map(([Icon, title, text, target]: any) => (
                      <div key={title}>
                        <span className="attention-icon">
                          <Icon size={19} />
                        </span>
                        <div>
                          <b>{title}</b>
                          <p>{text}</p>
                        </div>
                        <button
                          aria-label={"Open " + target}
                          onClick={() => setView(target)}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Assets in the pipeline</h2>
                    <p>Track each asset from authorization to release</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setView("Collateral")}
                  >
                    View collateral{" "}
                    <ArrowRight size={13} style={{ display: "inline" }} />
                  </button>
                </div>
                <AssetsTable
                  rows={assets}
                  onOpen={(r) => open("asset-detail", r)}
                />
              </div>
            </>
          )}
          {["Collateral", "Listings", "Auctions"].includes(view) && (
            <div className="panel">
              <div className="admin-table-tools">
                <label className="search-field">
                  <Search size={15} />
                  <input
                    aria-label="Search records"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search title or reference…"
                  />
                </label>
                <span className="badge">
                  Authorized records
                </span>
              </div>
              <AssetsTable
                rows={(view === "Collateral" ? assets : listings).filter(
                  (r: any) =>
                    (r.title || "")
                      .toLowerCase()
                      .includes(query.toLowerCase()) &&
                    (view !== "Auctions" || r.method.includes("auction")),
                )}
                onOpen={(r) => open("asset-detail", r)}
                onCashSale={
                  view === "Listings" && level >= 3
                    ? (r) => open("cash-sale", r)
                    : undefined
                }
              />
            </div>
          )}
          {view === "Approvals" && (
            <>
              {approvals.length ? (
                approvals.map((a: any) => (
                  <div className="panel approval-card" key={a.id}>
                    <div>
                      <span
                        className={
                          "badge " +
                          (a.status === "pending" ? "amber" : "green")
                        }
                      >
                        {a.status} · Level {a.required_min_level}+
                      </span>
                      <h3>{a.public_title || a.action_type}</h3>
                      <p>
                        {a.reason}
                        <br />
                        Requested by {a.requested_name || a.requested_by}
                      </p>
                      <div className="approval-values">
                        {Object.entries(a.proposed_values || {}).map(
                          ([k, v]) => (
                            <span key={k}>
                              {k}: <b>{String(v)}</b>
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                    <div className="approval-actions">
                      <button
                        className="btn secondary"
                        onClick={() =>
                          setPending({ ...a, decision: "rejected" })
                        }
                      >
                        Reject
                      </button>
                      <button
                        className="btn primary"
                        onClick={() =>
                          setPending({ ...a, decision: "approved" })
                        }
                      >
                        <Check size={14} />
                        Review & approve
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <Empty text="No pending approval requests." />
              )}
              <p className="muted" style={{ fontSize: 11, lineHeight: 1.8 }}>
                Maker-checker control: the request maker cannot approve their
                own action. The server checks security level, MFA and the
                underlying authorization.
              </p>
            </>
          )}
          {view === "Offers" && (
            <DataPanel
              rows={records.offers || []}
              columns={["listing", "amount", "status", "expires_at"]}
              onOpen={(r) => open("offer", r)}
            />
          )}
          {view === "Orders & payments" && (
            <DataPanel
              rows={orders}
              columns={[
                "order_no",
                "public_title",
                "buyer_name",
                "payment_method",
                "amount_due",
                "status",
                "tx_ref",
              ]}
              onOpen={(r) => open("order", r)}
            />
          )}
          {view === "Release desk" && (
            <>
              <div className="panel" style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 15, marginBottom: 10 }}>
                  Verify before handover
                </h2>
                <p className="account-stat">
                  Only paid orders are eligible. A release needs independent
                  approval, collector identity confirmation and a single-use
                  code.
                </p>
              </div>
              <DataPanel
                rows={orders.filter((o: any) => o.status === "paid")}
                columns={["order_no", "public_title", "amount_due", "status"]}
                onOpen={(r) => open("release", r)}
              />
            </>
          )}
          {view === "Settlements" && (
            <>
              <div className="kpi-grid">
                {[
                  [
                    "Gross sale",
                    money(records.kpis?.gross || 0),
                  ],
                  [
                    "Approved costs",
                    money(records.kpis?.fees || 0),
                  ],
                  [
                    "Loan recovery",
                    money(records.kpis?.recovered || 0),
                  ],
                  [
                    "Owner surplus",
                    money(records.kpis?.surplus || 0),
                  ],
                ].map(([l, v]) => (
                  <div className="kpi" key={l}>
                    <div className="kpi-head">{l}</div>
                    <strong style={{ fontSize: 22 }}>{v}</strong>
                    <small>Approved ledger lines</small>
                  </div>
                ))}
              </div>
              <DataPanel
                rows={records.settlements || []}
                columns={[
                  "order_no",
                  "gross_sale",
                  "rule_version",
                  "status",
                  "loan_sync",
                ]}
                onOpen={(r) => open("settlement", r)}
              />
            </>
          )}
          {view === "Logs" && (
            <>
              <div className="admin-table-tools">
                <label className="search-field">
                  <Search size={15} />
                  <input
                    aria-label="Filter audit events"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter by actor, action or entity…"
                  />
                </label>
                <span className="badge">
                  <ShieldCheck size={12} />
                  Append-only history
                </span>
              </div>
              <DataPanel
                rows={(records.logs || []).filter((a: any) =>
                  JSON.stringify(a).toLowerCase().includes(query.toLowerCase()),
                )}
                columns={[
                  "occurred_at",
                  "actor",
                  "actor_level",
                  "action",
                  "entity_type",
                  "entity_id",
                  "reason",
                  "source",
                ]}
                onOpen={(r) => open("audit", r)}
              />
            </>
          )}
          {view === "Reports" && (
            <div className="admin-settings">
              {[
                [
                  "Recovery report",
                  "Gross sales, fees, loan allocation and owner surplus.",
                ],
                [
                  "Asset aging",
                  "Time in custody, time to list and time to verified payment.",
                ],
                [
                  "Sales performance",
                  "Auction outcomes, fixed-price conversion and buyer offers.",
                ],
                [
                  "Exceptions",
                  "Payment mismatches, uncollected assets and pending loan sync.",
                ],
              ].map(([t, p]) => (
                <div className="panel" key={t}>
                  <BarChart3 color="#087c68" size={25} />
                  <h2 style={{ marginTop: 20, marginBottom: 10 }}>{t}</h2>
                  <p className="account-stat">{p}</p>
                  <button
                    className="text-button"
                    style={{ marginTop: 15 }}
                    onClick={exportCsv}
                  >
                    Export authorized records{" "}
                    <Download size={13} style={{ display: "inline" }} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {view === "Users & security" && (
            <div className="admin-settings">
              <div className="panel">
                <div className="panel-head">
                  <h2>Staff directory</h2>
                  <button className="text-button" onClick={() => open("staff")}>
                    Add staff
                  </button>
                </div>
                <DataPanel
                  rows={records.staff || []}
                  columns={["full_name", "security_level", "is_active"]}
                  onOpen={(r) => open("staff", r)}
                />
              </div>
              <div className="panel">
                <h2>Four levels of control</h2>
                <div className="security-levels">
                  {[
                    [
                      "1",
                      "View",
                      "Read permitted dashboards and operational records.",
                    ],
                    [
                      "2",
                      "Operate",
                      "Prepare collateral, evidence and listing drafts.",
                    ],
                    [
                      "3",
                      "Approve",
                      "Approve eligible actions with MFA and maker-checker.",
                    ],
                    [
                      "4",
                      "Administer",
                      "Manage staff and policy. Dual control still applies.",
                    ],
                  ].map(([n, t, p]) => (
                    <div key={n}>
                      <span className="level-circle">{n}</span>
                      <div>
                        <b>{t}</b>
                        <p>{p}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {view === "Configuration" && (
            <div className="admin-settings">
              <div className="panel">
                <h2>Approval & auction policy</h2>
                <form
                  className="form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    write(
                      "settings",
                      Object.fromEntries(new FormData(e.currentTarget)),
                    );
                  }}
                >
                  <label>
                    High-value release threshold (MWK)
                    <input
                      type="number"
                      name="high_value_threshold"
                      defaultValue="5000000"
                      min="0"
                    />
                  </label>
                  <label>
                    Extension window (seconds)
                    <input
                      type="number"
                      name="extension_window"
                      defaultValue="120"
                      min="1"
                    />
                  </label>
                  <label>
                    Extension length (seconds)
                    <input
                      type="number"
                      name="extension_seconds"
                      defaultValue="120"
                      min="1"
                    />
                  </label>
                  <label>
                    Maximum extensions
                    <input
                      type="number"
                      name="max_extensions"
                      defaultValue="20"
                      min="0"
                    />
                  </label>
                  <button className="btn primary">Request policy change</button>
                  <p className="muted" style={{ fontSize: 11 }}>
                    Changes create a versioned approval request.
                  </p>
                </form>
              </div>
              <div className="panel">
                <h2>Connections & fee rules</h2>
                <div className="spec-list">
                  <div>
                    <span>Supabase</span>
                    <span className="badge">
                      {connected ? "Configured" : "Awaiting anon key"}
                    </span>
                  </div>
                  <div>
                    <span>PayChangu</span>
                    <span className="badge amber">Server secret required</span>
                  </div>
                  <div>
                    <span>Loan bridge</span>
                    <span className="badge amber">API contract required</span>
                  </div>
                  <div>
                    <span>Platform commission</span>
                    <b>Versioned · disabled by default</b>
                  </div>
                </div>
                <p className="account-stat" style={{ marginTop: 20 }}>
                  Credentials stay in server configuration. Fee changes require
                  a new rule version and never alter historical settlements.
                </p>
                <button
                  className="text-button"
                  onClick={() => open("fee-rule")}
                >
                  Propose fee rule
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
      <Dialog
        open={!!modal}
        onOpenChange={(v) => {
          if (!v) setModal("");
        }}
      >
        <DialogContent
          className="sm:max-w-xl"
          style={{ maxHeight: "85vh", overflowY: "auto" }}
        >
          <DialogTitle>{modalTitle[modal] || "Record details"}</DialogTitle>
          <DialogDescription>
            Actions are checked on the server and recorded in the audit trail.
          </DialogDescription>
          {modal === "connection" ? (
            <p className="account-stat">
              Add SUPABASE_ANON_KEY to the .env file and apply the database
              migration. Staff sign-in will be available once the connection is
              configured.
            </p>
          ) : modal === "asset-detail" ? (
            <>
              <h3>{selected?.title}</h3>
              <div className="spec-list">
                {Object.entries(selected || {})
                  .filter(([k]) =>
                    [
                      "asset_ref",
                      "external_loan_id",
                      "category",
                      "custody_location",
                      "status",
                      "condition",
                      "valuation_amount",
                      "price",
                    ].includes(k),
                  )
                  .map(([k, v]) => (
                    <div key={k}>
                      <span>{k.replaceAll("_", " ")}</span>
                      <b>{String(v)}</b>
                    </div>
                  ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="btn secondary"
                  onClick={() => open("authorization", selected)}
                >
                  Request sale authorization
                </button>
                <button
                  className="btn primary"
                  onClick={() => open("listing", selected)}
                >
                  Prepare listing
                </button>
              </div>
            </>
          ) : modal === "cash-sale" ? (
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                write("cash-sale", {
                  listing_id: selected.id,
                  ...Object.fromEntries(new FormData(event.currentTarget)),
                });
              }}
            >
              <p>
                Record the full listed price ({money(selected?.price)}). This
                marks the item sold; collection still requires separate approval.
              </p>
              <label>
                Cash receipt reference
                <input name="receipt_ref" maxLength={100} required />
              </label>
              <label>
                Buyer name
                <input name="buyer_name" maxLength={120} required />
              </label>
              <label>
                Buyer contact (optional)
                <input name="buyer_contact" maxLength={100} />
              </label>
              <label>
                Sale note
                <textarea name="reason" minLength={3} maxLength={500} required />
              </label>
              <button className="btn primary" disabled={busy}>
                {busy ? "Recording cash sale…" : "Record cash sale"}
              </button>
            </form>
          ) : [
              "asset",
              "listing",
              "authorization",
              "staff",
              "fee-rule",
            ].includes(modal) ? (
            <AdminForm
              type={modal}
              selected={selected}
              assets={assets}
              authorizations={records.authorizations || []}
              busy={busy}
              onSubmit={(body) => write(modal, body)}
            />
          ) : modal === "offer" ? (
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                write("offer", {
                  offer_id: selected.id,
                  ...Object.fromEntries(new FormData(e.currentTarget)),
                });
              }}
            >
              <p>
                {money(selected?.amount)} · {selected?.status}
              </p>
              <label>
                Decision
                <NativePick
                  name="decision"
                  values={["countered", "accepted", "rejected"]}
                />
              </label>
              <label>
                Counter amount (MWK)
                <input name="amount" type="number" min="1" step="0.01" />
              </label>
              <label>
                Reason
                <textarea name="reason" required />
              </label>
              <button className="btn primary" disabled={busy}>
                Submit decision
              </button>
            </form>
          ) : modal === "release" ? (
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                write("release", {
                  order_id: selected.id,
                  ...Object.fromEntries(new FormData(e.currentTarget)),
                });
              }}
            >
              <b>{selected?.order_no}</b>
              <label>
                Collector name
                <input name="collector_name" required />
              </label>
              <label>
                Masked identity reference
                <input name="collector_ref" required />
              </label>
              <label>
                Release code
                <input name="release_code" />
              </label>
              <label>
                Handover notes
                <textarea name="notes" required />
              </label>
              <button className="btn primary" disabled={busy}>
                Confirm approved handover
              </button>
              <button type="button" className="btn secondary" disabled={busy} onClick={(e)=>{const form=(e.currentTarget as HTMLButtonElement).form!;const body=Object.fromEntries(new FormData(form));if(!body.collector_name||!body.collector_ref){setError('Collector name and identity reference are required.');return;}write('prepare-release',{order_id:selected.id,...body,reason:'Collection identity checked; request independent release approval.'})}}>Request release approval</button>
            </form>
          ) : modal === "settlement" ? (
            <>
              <div className="spec-list">
                {Object.entries(selected || {}).map(([k, v]) => (
                  <div key={k}>
                    <span>{k}</span>
                    <b>{String(v)}</b>
                  </div>
                ))}
              </div>
              <button
                className="btn primary"
                onClick={() =>
                  write("settlement", { settlement_id: selected.id })
                }
              >
                Request settlement approval
              </button>
            </>
          ) : (
            <div>
              <div className="spec-list">
                {Object.entries(selected || {}).map(([k, v]) => (
                  <div key={k}>
                    <span>{k.replaceAll("_", " ")}</span>
                    <b style={{ maxWidth: "60%", overflowWrap: "anywhere" }}>
                      {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </b>
                  </div>
                ))}
              </div>
              {modal === "order" && (
                <button
                  className="btn secondary"
                  style={{ marginTop: 15 }}
                  onClick={() =>
                    write("verify-payment", { order_id: selected.id })
                  }
                >
                  Reconcile payment
                </button>
              )}
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!pending}
        onOpenChange={(v) => {
          if (!v) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.decision === "approved"
                ? "Approve this request?"
                : "Reject this request?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.reason} Your decision is recorded with your identity.
              You cannot approve your own request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label>
            Decision reason
            <textarea id="decision-reason" required />
          </label>
          {error && <p className="error">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => {
                const reason = (
                  document.getElementById(
                    "decision-reason",
                  ) as HTMLTextAreaElement
                )?.value;
                if (!reason?.trim()) {
                  setError("A decision reason is required.");
                  return;
                }
                write("approve", {
                  request_id: pending.id,
                  decision: pending.decision,
                  reason,
                });
              }}
            >
              Confirm decision
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
const descriptions: Record<string, string> = {
  Collateral: "Loan-linked assets, custody and sale readiness.",
  Listings: "Prepare, review and publish authorized assets.",
  Approvals: "Independent decisions for sensitive actions.",
  Auctions: "Monitor server-authoritative bids and closing windows.",
  Offers: "Review buyer offers and prepare counteroffers.",
  "Orders & payments": "Track payments and resolve verification exceptions.",
  "Release desk":
    "Verified payment, approved collection and accountable handover.",
  Settlements: "Explain every kwacha, from gross sale to loan recovery.",
  Reports: "Operational and financial reporting for your institution.",
  Logs: "A permanent, named trail of staff actions and decisions.",
  "Users & security": "Named staff accounts with four levels of authority.",
  Configuration: "Versioned policies, fee rules and integrations.",
};
const modalTitle: Record<string, string> = {
  asset: "Add collateral",
  listing: "Prepare listing",
  authorization: "Request sale authorization",
  staff: "Staff access request",
  "fee-rule": "Propose a fee rule",
  connection: "Connect your institution",
  release: "Confirm asset release",
  offer: "Review buyer offer",
  settlement: "Settlement review",
  audit: "Audit event",
  order: "Order & payment details",
};
function Empty({ text }: { text: string }) {
  return (
    <div className="panel empty-state">
      <Boxes size={28} />
      <h3>{text}</h3>
    </div>
  );
}
function AssetsTable({
  rows,
  onOpen,
  onCashSale,
}: {
  rows: any[];
  onOpen: (r: any) => void;
  onCashSale?: (r: any) => void;
}) {
  return (
    <div className="data-table-wrap">
      <Table className="data-table">
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>Loan / asset reference</TableHead>
            <TableHead>Sale method</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="table-asset">
                  <img src={r.image || "/favicon.svg"} alt="" />
                  <div>
                    {r.title}
                    <small>
                      {r.location || r.custody_location} · {r.category}
                    </small>
                  </div>
                </div>
              </TableCell>
              <TableCell>{r.external_loan_id || r.asset_ref || "—"}</TableCell>
              <TableCell>{methodName(r.method || "fixed")}</TableCell>
              <TableCell>{money(r.price || r.valuation_amount || 0)}</TableCell>
              <TableCell>
                <Status status={r.status} />
              </TableCell>
              <TableCell>
                {onCashSale && r.status === "live" && !r.method?.includes("auction") && (
                  <button
                    className="table-actions"
                    style={{ marginRight: 10 }}
                    onClick={() => onCashSale(r)}
                  >
                    Record cash
                  </button>
                )}
                <button className="table-actions" onClick={() => onOpen(r)}>
                  Review <ArrowUpRight size={14} />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && <div className="empty-state">No matching records.</div>}
    </div>
  );
}
function Status({ status }: { status: string }) {
  return (
    <span
      className={
        "badge " +
        (["paid", "live", "listed", "approved", "released", "closed"].includes(
          status,
        )
          ? "green"
          : [
                "pending",
                "pending_approval",
                "awaiting_payment",
                "sale_review",
              ].includes(status)
            ? "amber"
            : status === "failed"
              ? "red"
              : "")
      }
    >
      {status?.replaceAll("_", " ")}
    </span>
  );
}
function DataPanel({
  rows,
  columns,
  onOpen,
}: {
  rows: any[];
  columns: string[];
  onOpen: (r: any) => void;
}) {
  return (
    <div className="panel">
      <div className="data-table-wrap">
        <Table className="data-table">
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c}>{c.replaceAll("_", " ")}</TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any, index) => (
              <TableRow key={r.id || index}>
                {columns.map((c) => (
                  <TableCell key={c}>
                    {c === "status" ? (
                      <Status status={r[c]} />
                    ) : ["amount", "amount_due", "gross_sale"].includes(c) ? (
                      money(r[c])
                    ) : (
                      String(r[c] ?? "—")
                    )}
                  </TableCell>
                ))}
                <TableCell>
                  <button className="table-actions" onClick={() => onOpen(r)}>
                    Review <ArrowUpRight size={13} />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!rows.length && <p className="empty-state">No records to display.</p>}
      </div>
    </div>
  );
}
function NativePick({ name, values }: { name: string; values: string[] }) {
  return (
    <Select name={name} defaultValue={values[0]}>
      <SelectTrigger style={{ width: "100%", marginTop: 8 }}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {values.map((v) => (
          <SelectItem key={v} value={v}>
            {v.replaceAll("_", " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function AdminForm({
  type,
  selected,
  assets = [],
  authorizations = [],
  busy,
  onSubmit,
}: {
  type: string;
  selected: any;
  assets?: any[];
  authorizations?: any[];
  busy: boolean;
  onSubmit: (d: any) => void;
}) {
  const [assetId, setAssetId] = useState(
    assets.some((asset) => asset.id === selected?.id) ? selected.id : "",
  );
  const [imageUrl, setImageUrl] = useState(selected?.image || "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const matchingAuthorizations = authorizations.filter(
    (authorization) =>
      authorization.asset_id === assetId && authorization.status === "approved",
  );
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...Object.fromEntries(new FormData(e.currentTarget)),
          entity_id: selected?.id,
        });
      }}
    >
      {type === "asset" ? (
        <>
          <label>
            External loan ID (optional)
            <input
              name="external_loan_id"
              placeholder="Leave blank for a standalone sale"
            />
          </label>
          <label>
            Asset reference
            <input name="asset_ref" required />
          </label>
          <label>
            Asset title
            <input name="title" required />
          </label>
          <div className="form-grid two">
            <label>
              Category
              <NativePick
                name="category"
                values={[
                  "Vehicles",
                  "Electronics",
                  "Gaming",
                  "Home Appliances",
                  "Furniture",
                  "Equipment",
                  "Other",
                ]}
              />
            </label>
            <label>
              Valuation (MWK)
              <input
                type="number"
                name="valuation_amount"
                required
                min="1"
                step="0.01"
              />
            </label>
          </div>
          <label>
            Custody location
            <input name="custody_location" required />
          </label>
          <label>
            Condition notes
            <textarea name="condition_notes" required />
          </label>
        </>
      ) : type === "listing" ? (
        <>
          <label>
            Asset
            <select
              name="asset_id"
              value={assetId}
              onChange={(event) => setAssetId(event.target.value)}
              required
            >
              <option value="" disabled>
                Select collateral asset
              </option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.title} · {asset.asset_ref || asset.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Approved sale authorization
            <select
              key={assetId}
              name="sale_authorization_id"
              defaultValue={matchingAuthorizations[0]?.id || ""}
              required
            >
              <option value="" disabled>
                {matchingAuthorizations.length
                  ? "Select approved authorization"
                  : "No approved authorization for this asset"}
              </option>
              {matchingAuthorizations.map((authorization) => (
                <option key={authorization.id} value={authorization.id}>
                  {authorization.reference_no || authorization.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Public title
            <input name="title" defaultValue={selected?.title || ""} required />
          </label>
          <label>
            Slug
            <input name="slug" pattern="[a-z0-9-]+" required />
          </label>
          <label>
            Sale mode
            <NativePick
              name="method"
              values={[
                "fixed_price",
                "auction",
                "fixed_plus_offer",
                "auction_plus_buy_now",
              ]}
            />
          </label>
          <div className="form-grid two">
            <label>
              Fixed price / starting bid (MWK)
              <input name="price" type="number" min="1" required step="0.01" />
            </label>
            <label>
              Minimum increment (MWK)
              <input
                name="increment"
                type="number"
                min="1"
                defaultValue="10000"
                step="0.01"
              />
            </label>
          </div>
          <label>
            Auction duration (hours)
            <input
              type="number"
              name="duration_hours"
              min="1"
              max="720"
              defaultValue="72"
            />
          </label>
          <label>
            Collection point
            <input
              name="collection_point"
              defaultValue={selected?.location || ""}
              required
            />
          </label>
          <label>
            Public description
            <textarea name="description" required />
          </label>
          <label>
            Known defects
            <textarea name="defects" required />
          </label>
          <label>
            Upload listing photo (JPEG, PNG or WebP, up to 5 MB)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadingImage || busy}
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                if (!file) return;
                setImageError("");
                setUploadingImage(true);
                try {
                  const data = new FormData();
                  data.set("file", file);
                  const response = await fetch("/api/admin/listing-image", {
                    method: "POST",
                    body: data,
                  });
                  const result: any = await response.json();
                  if (!response.ok) throw Error(result.error);
                  setImageUrl(result.image);
                } catch (error) {
                  setImageError((error as Error).message);
                } finally {
                  setUploadingImage(false);
                  input.value = "";
                }
              }}
            />
            {uploadingImage && <span className="muted">Uploading image…</span>}
            {imageError && <span className="error">{imageError}</span>}
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Selected listing"
                style={{
                  display: "block",
                  width: 112,
                  height: 84,
                  marginTop: 8,
                  objectFit: "contain",
                  background: "#f3f6f6",
                  borderRadius: 5,
                }}
              />
            )}
          </label>
          <label>
            Image URL
            <input
              name="image"
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              required
            />
          </label>
          <label>
            Approved terms version
            <input name="terms_version" defaultValue="v1" required />
          </label>
        </>
      ) : type === "authorization" ? (
        <>
          <label>
            Sale basis
            <textarea name="basis" required />
          </label>
          <label>
            Authorization reference
            <input name="reference_no" required />
          </label>
          <label>
            Private evidence path
            <input name="evidence_path" required />
          </label>
        </>
      ) : type === "staff" ? (
        <>
          <label>
            Existing Supabase user UUID
            <input
              name="user_id"
              defaultValue={selected?.user_id || ""}
              required
            />
          </label>
          <label>
            Staff full name
            <input
              name="full_name"
              defaultValue={selected?.full_name || ""}
              required
            />
          </label>
          <label>
            Security level
            <NativePick name="security_level" values={["1", "2", "3", "4"]} />
          </label>
          <label>
            Account state
            <NativePick name="is_active" values={["true", "false"]} />
          </label>
        </>
      ) : (
        <>
          <label>
            Rule version
            <input name="version" required />
          </label>
          <label>
            Platform commission (basis points)
            <input
              type="number"
              name="platform_bps"
              min="0"
              max="10000"
              required
            />
          </label>
          <label>
            Fixed approved fee (MWK)
            <input
              type="number"
              name="fixed_fee"
              min="0"
              step="0.01"
              required
            />
          </label>
          <label>
            Effective date
            <input type="date" name="effective_at" required />
          </label>
        </>
      )}
      <label>
        Reason
        <textarea name="reason" required />
      </label>
      <button className="btn primary" disabled={busy}>
        {busy ? "Submitting…" : "Save request"}
      </button>
    </form>
  );
}
