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
  Pencil,
  Trash2,
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
  X,
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
import {
  CartesianGrid,
  Line,
  LineChart,
  BarChart,
  Bar,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);
  const [archiveSelection, setArchiveSelection] = useState<string[]>([]);
  const [reportGraphModes, setReportGraphModes] = useState<Record<string, "line" | "bar">>({});
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
  useEffect(() => {
    if (view !== "Listings") setSelectedListingIds([]);
  }, [view]);
  const listings = records.listings || [];
  const assets = records.assets || [];
  const filteredListingRows = listings.filter(
    (listing: any) => (listing.title || "").toLowerCase().includes(query.toLowerCase()),
  );
  const collateralRows = assets.map((asset: any) => {
    const listing = (records.asset_listings || []).find(
      (candidate: any) =>
        candidate.asset_id === asset.id &&
        candidate.status === "live" &&
        ["fixed_price", "fixed_plus_offer"].includes(candidate.method),
    );
    return {
      ...asset,
      cash_sale_candidate: true,
      cash_sale_listing: listing
        ? { ...listing, title: asset.title, price: listing.fixed_price }
        : null,
    };
  });
  const approvals = records.approvals || [];
  const orders = records.orders || [];
  const attention = records.attention || {};
  const chartData = Array.isArray(records.chart) ? records.chart : [];
  const reportData = records.reportData || {};
  const pendingApprovalCount = Number(
    attention.pending_approvals ?? approvals.filter((a: any) => a.status === "pending").length,
  );
  const awaitingCollectionCount = Number(
    attention.awaiting_collection ?? orders.filter((o: any) => o.status === "paid").length,
  );
  const pendingLoanCount = Number(attention.loan_pending || 0);
  const deadLetterLoanCount = Number(attention.loan_dead_letter || 0);
  const postedLoanCount = Number(attention.loan_posted || 0);
  const loanIntegrationSummary = deadLetterLoanCount
    ? `${deadLetterLoanCount} failed · ${pendingLoanCount} pending`
    : pendingLoanCount
      ? `${pendingLoanCount} awaiting loan posting`
      : postedLoanCount
        ? `${postedLoanCount} postings complete · none pending`
        : "No pending loan postings";
  const currentPolicy = records.settings?.[0]?.settings || {
    high_value_threshold: 5000000,
    extension_window: 120,
    extension_seconds: 120,
    max_extensions: 20,
  };
  const pendingPolicyChanges = approvals.filter(
    (request: any) => request.status === "pending" && ["settings_change", "fee_change"].includes(request.action_type),
  );
  const activeFeeRule = (records.fee_rules || []).find(
    (rule: any) => rule.is_active && new Date(rule.effective_at).getTime() <= Date.now(),
  );
  const reportCharts = [
    {
      key: "recovery",
      title: "Recovery report",
      description: "Monthly gross sales, loan recovery and owner surplus from approved settlements.",
      data: reportData.recovery || chartData,
      xKey: "month",
      money: true,
      series: [
        { key: "gross", label: "Gross sales", color: "#16866a" },
        { key: "recovered", label: "Loan recovery", color: "#3273a0" },
        { key: "surplus", label: "Owner surplus", color: "#bd812e" },
      ],
    },
    {
      key: "aging",
      title: "Asset aging",
      description: "Assets still in custody by actual time since intake.",
      data: reportData.assetAging || [],
      xKey: "age",
      money: false,
      series: [{ key: "assets", label: "Assets in custody", color: "#3273a0" }],
    },
    {
      key: "sales",
      title: "Sales performance",
      description: "Completed sale value by month and sale channel.",
      data: reportData.salesPerformance || [],
      xKey: "month",
      money: true,
      series: [
        { key: "fixed_price", label: "Fixed price", color: "#16866a" },
        { key: "auction_win", label: "Auction", color: "#3273a0" },
        { key: "accepted_offer", label: "Accepted offer", color: "#bd812e" },
      ],
    },
    {
      key: "exceptions",
      title: "Exceptions",
      description: "Current payment, dispute, loan-sync, approval and handover issues.",
      data: reportData.exceptions || [],
      xKey: "issue",
      money: false,
      series: [{ key: "count", label: "Open items", color: "#bd812e" }],
    },
  ];
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
            : path === "edit-listing"
              ? "Listing updated and the public page refreshed."
              : path === "archive-listings"
                ? `${d.archived_count} listing${d.archived_count === 1 ? "" : "s"} removed from the public website.`
              : path === "listing"
                ? level >= 4
                  ? "Listing published and visible on the public website."
                  : "Listing submitted for independent approval. It will appear on the public website automatically once approved."
                : d.message || "Action recorded successfully.",
      );
      if (path === "archive-listings") {
        setSelectedListingIds([]);
        setArchiveSelection([]);
      }
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
            <h2>Staff sign-in isn't configured</h2>
            <p>
              Configure the SUPABASE_PROJECT_REF and SUPABASE_PUBLISHABLE_KEY
              GitHub Actions variables, then deploy the Supabase API function.
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
                    <ResponsiveContainer width="100%" height={230}>
                      <LineChart data={chartData} margin={{ top: 12, right: 12, left: 8, bottom: 0 }}>
                        <CartesianGrid stroke="#e4ecee" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#82939b", fontSize: 10 }} />
                        <YAxis
                          width={88}
                          axisLine={false}
                          tickLine={false}
                          domain={[0, (max: number) => max || 1]}
                          tick={{ fill: "#82939b", fontSize: 9 }}
                          tickFormatter={(value) => "MWK " + new Intl.NumberFormat("en-MW", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))}
                        />
                        <Tooltip formatter={(value) => money(Number(value))} />
                        <Line type="monotone" dataKey="gross" name="Gross sales" stroke="#17866f" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                        <Line type="monotone" dataKey="recovered" name="Loan recovery" stroke="#3273a0" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                        <Line type="monotone" dataKey="surplus" name="Owner surplus" stroke="#bd812e" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-legend">
                    <span><i className="gross" />Gross sales</span>
                    <span><i className="recovered" />Loan recovery</span>
                    <span><i className="surplus" />Owner surplus</span>
                  </div>
                  {!chartData.some((month: any) => Number(month.gross || month.recovered || month.surplus)) && (
                    <p className="chart-empty">No finalized sales recorded in this period.</p>
                  )}
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
                        pendingApprovalCount === 0
                          ? "No requests waiting for a checker"
                          : `${pendingApprovalCount} request${pendingApprovalCount === 1 ? "" : "s"} need a checker`,
                        "Approvals",
                      ],
                      [
                        PackageCheck,
                        "Awaiting collection",
                        `${awaitingCollectionCount} verified paid order${awaitingCollectionCount === 1 ? "" : "s"} awaiting handover`,
                        "Release desk",
                      ],
                      [
                        Link2,
                        "Loan integration",
                        loanIntegrationSummary,
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
                  {view === "Listings" ? `${listings.length} listings` : "Authorized records"}
                </span>
                {view === "Listings" && level >= 4 && selectedListingIds.length > 0 && (
                  <button
                    className="btn secondary listing-delete-selected"
                    type="button"
                    onClick={() => setArchiveSelection(selectedListingIds)}
                  >
                    <Trash2 size={15} />
                    Delete selected ({selectedListingIds.length})
                  </button>
                )}
              </div>
              <AssetsTable
                rows={(view === "Listings" ? filteredListingRows : view === "Collateral" ? collateralRows : listings).filter(
                  (r: any) =>
                    (view !== "Auctions" || r.method.includes("auction")),
                )}
                selectionEnabled={view === "Listings" && level >= 4}
                selectedIds={selectedListingIds}
                onSelectionChange={(id, checked) =>
                  setSelectedListingIds((current) =>
                    checked ? [...new Set([...current, id])] : current.filter((value) => value !== id),
                  )
                }
                onSelectAll={(checked) =>
                  setSelectedListingIds(checked ? filteredListingRows.map((listing: any) => listing.id) : [])
                }
                onEdit={view === "Listings" && level >= 4 ? (listing) => open("listing-edit", listing) : undefined}
                onOpen={(r) => open("asset-detail", r)}
                onCashSale={
                  ["Collateral", "Listings"].includes(view) && level >= 3
                    ? (r) => open("cash-sale", r.cash_sale_listing || r)
                    : undefined
                }
                onChangePrice={
                  view === "Listings" && level >= 2
                    ? (r) => open("price-change", r)
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
                      <h3>
                        {a.public_title ||
                          a.proposed_values?.title ||
                          a.action_type.replaceAll("_", " ")}
                      </h3>
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
                  code. The code currently arrives in the buyer’s account notification, not by SMS.
                </p>
              </div>
              <DataPanel
                rows={orders.filter((o: any) => ["paid", "released"].includes(o.status)).map((order: any) => ({
                  ...order,
                  release_status: order.release_record?.status === "released"
                    ? "released"
                    : order.release_record?.status === "approved"
                      ? "ready_for_handover"
                      : order.release_approval
                        ? "pending_approval"
                        : "approval_required",
                }))}
                columns={["order_no", "public_title", "buyer_name", "collector_name", "handover_staff", "amount_due", "release_status", "status"]}
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
            <div className="report-chart-grid">
              {reportCharts.map((chart) => {
                const mode = reportGraphModes[chart.key] || "line";
                const hasValues = chart.data.some((point: any) =>
                  chart.series.some((series) => Number(point[series.key] || 0) !== 0),
                );
                return (
                  <section className="panel report-chart-panel" key={chart.key}>
                    <header className="report-chart-header">
                      <div>
                        <BarChart3 size={19} aria-hidden="true" />
                        <h2>{chart.title}</h2>
                        <p>{chart.description}</p>
                      </div>
                      <div className="report-chart-switch" role="group" aria-label={`${chart.title} chart style`}>
                        <button
                          type="button"
                          className={mode === "line" ? "active" : ""}
                          aria-pressed={mode === "line"}
                          onClick={() => setReportGraphModes((current) => ({ ...current, [chart.key]: "line" }))}
                        >
                          <TrendingUp size={15} /> Line
                        </button>
                        <button
                          type="button"
                          className={mode === "bar" ? "active" : ""}
                          aria-pressed={mode === "bar"}
                          onClick={() => setReportGraphModes((current) => ({ ...current, [chart.key]: "bar" }))}
                        >
                          <BarChart3 size={15} /> Bar
                        </button>
                      </div>
                    </header>
                    {hasValues ? (
                      <ReportGraph
                        data={chart.data}
                        xKey={chart.xKey}
                        series={chart.series}
                        mode={mode}
                        moneyValues={chart.money}
                      />
                    ) : (
                      <div className="report-chart-empty">
                        <span>No recorded data for this report yet.</span>
                      </div>
                    )}
                    <button
                      className="text-button report-export"
                      onClick={exportCsv}
                    >
                      Export authorized records <Download size={13} />
                    </button>
                  </section>
                );
              })}
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
                <div className="panel-head settings-panel-heading">
                  <div>
                    <h2>Approval & auction policy</h2>
                    <p>Active values come from the latest approved policy.</p>
                  </div>
                  <span className="badge green">
                    {records.settings?.[0]?.approved_by ? "Approved policy" : "System defaults"}
                  </span>
                </div>
                {records.settings?.[0]?.created_at && (
                  <p className="settings-updated">
                    Effective since {new Date(records.settings[0].created_at).toLocaleString()}
                  </p>
                )}
                <form
                  key={records.settings?.[0]?.version || "system-defaults"}
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
                      defaultValue={currentPolicy.high_value_threshold}
                      min="0"
                      step="1"
                      required
                    />
                    <span className="muted">Releases at or above this amount require Level 4 approval. Enter 0 to require Level 4 approval for every release.</span>
                  </label>
                  <label>
                    Extension window (seconds)
                    <input
                      type="number"
                      name="extension_window"
                      defaultValue={currentPolicy.extension_window}
                      min="1"
                      max="3600"
                      required
                    />
                  </label>
                  <label>
                    Extension length (seconds)
                    <input
                      type="number"
                      name="extension_seconds"
                      defaultValue={currentPolicy.extension_seconds}
                      min="1"
                      max="3600"
                      required
                    />
                  </label>
                  <label>
                    Maximum extensions
                    <input
                      type="number"
                      name="max_extensions"
                      defaultValue={currentPolicy.max_extensions}
                      min="0"
                      max="100"
                      required
                    />
                  </label>
                  <p className="muted settings-policy-scope">
                    Auction timing changes apply to new auctions only. Auctions already running keep the timing values saved when they were created.
                  </p>
                  <label>
                    Reason for this policy proposal
                    <textarea name="reason" minLength={3} maxLength={500} required placeholder="Explain why the institution needs this change." />
                  </label>
                  <button className="btn primary" disabled={busy}>
                    {busy ? "Submitting proposal…" : "Submit policy for approval"}
                  </button>
                  <p className="settings-approval-note">
                    Submitting creates a pending proposal. It does not change active settings until a different Level 4 administrator approves it.
                  </p>
                </form>
                {pendingPolicyChanges.length > 0 && (
                  <div className="settings-pending">
                    <div>
                      <b>{pendingPolicyChanges.length} policy proposal{pendingPolicyChanges.length === 1 ? "" : "s"} awaiting approval</b>
                      <p>Active settings stay unchanged until approval.</p>
                    </div>
                    <button className="text-button" onClick={() => setView("Approvals")}>
                      Review proposals <ArrowRight size={13} />
                    </button>
                  </div>
                )}
                {(records.settings || []).length > 1 && (
                  <details className="settings-history">
                    <summary>Recent approved policy versions</summary>
                    <ul>
                      {records.settings.slice(0, 5).map((version: any) => (
                        <li key={version.version}>
                          <span>{new Date(version.created_at).toLocaleString()}</span>
                          <b>{version.approved_by ? "Approved" : "System default"}</b>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
              <div className="panel">
                <h2>Connections & fee rules</h2>
                <div className="spec-list">
                  <div>
                    <span>Supabase</span>
                    <span className={"badge " + (records.connections?.supabase ?? connected ? "green" : "amber")}>
                      {records.connections?.supabase ?? connected ? "Connected" : "Not configured"}
                    </span>
                  </div>
                  <div>
                    <span>PayChangu</span>
                    <span className={"badge " + (records.connections?.paychangu ? "green" : "amber")}>
                      {records.connections?.paychangu ? "Credentials configured" : "Credentials missing"}
                    </span>
                  </div>
                  <div>
                    <span>Loan bridge</span>
                    <span className={"badge " + (records.connections?.loan_bridge ? "green" : "amber")}>
                      {records.connections?.loan_bridge ? "Credentials configured" : "Credentials missing"}
                    </span>
                  </div>
                  <div>
                    <span>Platform commission</span>
                    <b>{activeFeeRule
                      ? `${(Number(activeFeeRule.platform_bps) / 100).toFixed(2)}% + ${money(activeFeeRule.fixed_fee)} (${activeFeeRule.version})`
                      : "No active approved fee rule"}</b>
                  </div>
                </div>
                <p className="account-stat" style={{ marginTop: 20 }}>
                  Credentials remain server-side and are never shown here. Fee changes create a new version and do not alter historical settlements.
                </p>
                {!activeFeeRule && (
                  <p className="settings-warning" role="status">
                    No effective fee rule is active. Verified payments cannot finalize settlement until an approved rule is effective.
                  </p>
                )}
                <button
                  className="text-button"
                  onClick={() => open("fee-rule")}
                >
                  <Plus size={14} /> Propose fee rule
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
                      "condition_grade",
                      "valuation_amount",
                      "price",
                    ].includes(k),
                  )
                  .map(([k, v]) => (
                    <div key={k}>
                      <span>{k.replaceAll("_", " ")}</span>
                      <b>
                        {k === "valuation_amount"
                          ? formatValuation(String(v), selected?.currency)
                          : String(v)}
                      </b>
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
          ) : modal === "price-change" ? (
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                write("price-change", {
                  listing_id: selected.id,
                  ...Object.fromEntries(new FormData(event.currentTarget)),
                });
              }}
            >
              <p className="account-stat">
                The change will take effect after an independent staff member approves it.
                Auction starting bids can only change before the first bid.
              </p>
              <label>
                {selected?.method?.includes("auction")
                  ? selected?.method === "auction_plus_buy_now"
                    ? "New starting bid and buy-now price (MWK)"
                    : "New starting bid (MWK)"
                  : "New direct-sale price (MWK)"}
                <input
                  name="price"
                  type="number"
                  min="1"
                  step="0.01"
                  defaultValue={selected?.price || ""}
                  required
                />
              </label>
              <label>
                Reason for change
                <textarea name="reason" minLength={3} maxLength={500} required />
              </label>
              <button className="btn primary" disabled={busy}>
                Request price change
              </button>
            </form>
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
          ) : modal === "listing-edit" ? (
            <ListingEditForm
              key={selected?.id}
              selected={selected}
              busy={busy}
              onSubmit={(values) =>
                write("edit-listing", { listing_id: selected.id, ...values })
              }
            />
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
              level={level}
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
            <div className="form-grid">
              <b>{selected?.order_no} · {selected?.public_title}</b>
              <p className="account-stat">
                Payment verified: {money(selected?.amount_due || 0)}. Verify the named collector and their identity before handing over the asset.
              </p>
              <div className="spec-list release-parties">
                <div><span>Buyer</span><b>{selected?.buyer_name || "Buyer account"}</b></div>
                {selected?.buyer_email && <div><span>Buyer email</span><b>{selected.buyer_email}</b></div>}
                {selected?.buyer_contact && <div><span>Buyer contact</span><b>{selected.buyer_contact}</b></div>}
                {selected?.collector_name && <div><span>Approved collector</span><b>{selected.collector_name}</b></div>}
                {selected?.collector_ref && <div><span>Collector identity</span><b>{selected.collector_ref}</b></div>}
                {selected?.handover_staff && <div><span>Handover recorded by</span><b>{selected.handover_staff}</b></div>}
                {selected?.released_at && <div><span>Handover completed</span><b>{new Date(selected.released_at).toLocaleString()}</b></div>}
              </div>
              {selected?.release_record?.status === "released" ? (
                <p className="release-state-note" role="status">
                  <PackageCheck size={18} /> Handover completed and recorded. The buyer and collector details above are retained in the audit history.
                </p>
              ) : selected?.release_record?.status === "approved" ? (
                <form
                  className="form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    write("release", {
                      order_id: selected.id,
                      ...Object.fromEntries(new FormData(event.currentTarget)),
                    });
                  }}
                >
                  <label>
                    Approved collector
                    <input name="collector_name" defaultValue={selected.release_record.collector_name} required />
                  </label>
                  <label>
                    Approved masked identity reference
                    <input name="collector_ref" defaultValue={selected.release_record.collector_ref} required />
                  </label>
                  <label>
                    Single-use collection code from the buyer
                    <input name="release_code" autoComplete="one-time-code" required />
                  </label>
                  <p className="muted">
                    The buyer receives this code in their account notification after approval. Ask them to present it at handover.
                  </p>
                  <label>
                    Handover notes
                    <textarea name="notes" required minLength={3} />
                  </label>
                  {selected.release_record.approved_by === staff?.user_id ? (
                    <p className="error" role="alert">
                      A different staff member must record the handover than the person who approved this release.
                    </p>
                  ) : (
                    <button className="btn primary" disabled={busy}>
                      {busy ? "Recording handover…" : "Confirm handover"}
                    </button>
                  )}
                </form>
              ) : selected?.release_approval ? (
                <div className="release-state-note" role="status">
                  <ShieldCheck size={18} />
                  <div>
                    <b>Waiting for independent approval</b>
                    <p>Collector: {selected.release_approval.proposed_values?.collector_name}. Open Approvals to have a different Level 3 or 4 staff member decide it.</p>
                    <button className="text-button" onClick={() => { setModal(""); setView("Approvals"); }}>
                      Go to Approvals <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  className="form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    write("prepare-release", {
                      order_id: selected.id,
                      ...Object.fromEntries(new FormData(event.currentTarget)),
                      reason: "Collection identity checked; request independent release approval.",
                    });
                  }}
                >
                  <p className="muted">
                    Request approval after checking the collector’s identity. The approver must be a different eligible staff member.
                  </p>
                  <label>
                    Collector name
                    <input name="collector_name" required maxLength={120} />
                  </label>
                  <label>
                    Masked identity reference
                    <input name="collector_ref" placeholder="e.g. ID-***-4821" required maxLength={120} />
                  </label>
                  <button className="btn primary" disabled={busy}>
                    {busy ? "Requesting approval…" : "Request release approval"}
                  </button>
                </form>
              )}
            </div>
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
        open={archiveSelection.length > 0}
        onOpenChange={(open) => {
          if (!open) setArchiveSelection([]);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {archiveSelection.length} selected listing{archiveSelection.length === 1 ? "" : "s"} from the website?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be archived, not erased from the audit history. Listings with bids, active orders, or completed sales cannot be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="error">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              className="btn secondary listing-delete-selected"
              disabled={busy}
              onClick={() => write("archive-listings", { listing_ids: archiveSelection })}
            >
              <Trash2 size={15} />
              {busy ? "Removing…" : "Remove selected listings"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  "listing-edit": "Edit public listing",
  authorization: "Request sale authorization",
  staff: "Staff access request",
  "fee-rule": "Propose a fee rule",
  "price-change": "Request listing price change",
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
function ReportGraph({
  data,
  xKey,
  series,
  mode,
  moneyValues,
}: {
  data: any[];
  xKey: string;
  series: { key: string; label: string; color: string }[];
  mode: "line" | "bar";
  moneyValues: boolean;
}) {
  const axisFormatter = (value: number) =>
    moneyValues
      ? `MWK ${new Intl.NumberFormat("en-MW", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`
      : new Intl.NumberFormat("en-MW", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const tooltipFormatter = (value: any) =>
    moneyValues ? money(Number(value)) : Number(value).toLocaleString();
  const axisAngle = xKey === "issue" ? -18 : 0;

  return (
    <div className="report-chart-plot">
      <ResponsiveContainer width="100%" height="100%">
        {mode === "line" ? (
          <LineChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: axisAngle ? 30 : 4 }}>
            <CartesianGrid stroke="#e6edef" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} interval={0} angle={axisAngle} textAnchor={axisAngle ? "end" : "middle"} height={axisAngle ? 64 : 32} tick={{ fill: "#82939b", fontSize: 10 }} />
            <YAxis width={82} axisLine={false} tickLine={false} tickFormatter={axisFormatter} tick={{ fill: "#82939b", fontSize: 9 }} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            {series.map((item) => (
              <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: axisAngle ? 30 : 4 }}>
            <CartesianGrid stroke="#e6edef" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} interval={0} angle={axisAngle} textAnchor={axisAngle ? "end" : "middle"} height={axisAngle ? 64 : 32} tick={{ fill: "#82939b", fontSize: 10 }} />
            <YAxis width={82} axisLine={false} tickLine={false} tickFormatter={axisFormatter} tick={{ fill: "#82939b", fontSize: 9 }} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            {series.map((item) => (
              <Bar key={item.key} dataKey={item.key} name={item.label} fill={item.color} radius={[4, 4, 0, 0]} maxBarSize={38} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function ListingEditForm({
  selected,
  busy,
  onSubmit,
}: {
  selected: any;
  busy: boolean;
  onSubmit: (values: any) => void;
}) {
  const initialImages = Array.isArray(selected?.images) && selected.images.length
    ? selected.images
    : selected?.image
      ? [selected.image]
      : [];
  const [photos, setPhotos] = useState<{ url: string; path: string }[]>(
    initialImages.map((photo: any) => ({ url: typeof photo === "string" ? photo : photo.url, path: "" })),
  );
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");

  async function uploadPhotos(input: HTMLInputElement) {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    if (photos.length + files.length > 10) {
      setPhotoError("A listing can have up to 10 photos.");
      input.value = "";
      return;
    }
    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      setPhotoError("Each photo must be 5 MB or smaller.");
      input.value = "";
      return;
    }
    setPhotoError("");
    setUploading(true);
    try {
      const uploaded: { url: string; path: string }[] = [];
      for (const file of files) {
        const data = new FormData();
        data.set("file", file);
        data.set("purpose", "listing");
        const response = await fetch("/api/admin/listing-image", { method: "POST", body: data });
        const result: any = await response.json();
        if (!response.ok) throw Error(result.error);
        uploaded.push({ url: result.image, path: result.storage_path });
      }
      setPhotos((current) => [...current, ...uploaded]);
    } catch (error) {
      setPhotoError((error as Error).message);
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        if (!photos.length) {
          setPhotoError("Keep or upload at least one listing photo.");
          return;
        }
        onSubmit({
          ...Object.fromEntries(new FormData(event.currentTarget)),
          images: photos.map((photo) => photo.url),
          reason: "Level 4 staff updated listing details",
        });
      }}
    >
      <label>
        Public title
        <input name="title" defaultValue={selected.public_title || selected.title || ""} required maxLength={180} />
      </label>
      <label>
        Public page address
        <input name="slug" defaultValue={selected.slug || ""} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required maxLength={180} />
      </label>
      <label>
        Public description
        <textarea name="description" defaultValue={selected.public_description || selected.description || ""} maxLength={5000} />
      </label>
      <label>
        {selected.method?.includes("auction") ? "Starting bid / buy-now price (MWK)" : "Price (MWK)"}
        <input name="price" type="number" min="1" step="0.01" defaultValue={selected.method?.includes("auction") ? selected.starting_bid ?? selected.price ?? "" : selected.price ?? selected.fixed_price ?? ""} required />
      </label>
      <label>
        Collection point
        <input name="collection_point" defaultValue={selected.collection_point || selected.location || ""} required maxLength={300} />
      </label>
      <label>
        Condition
        <NativePick name="condition_grade" values={["New", "Excellent", "Good", "Fair"]} defaultValue={selected.condition_grade || "Good"} />
      </label>
      <label>
        Known defects
        <textarea name="defects" defaultValue={selected.defects || ""} maxLength={2000} />
      </label>
      <label>
        Listing photos (JPEG, PNG or WebP; up to 10 photos, 5 MB each)
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading || busy || photos.length >= 10}
          onChange={(event) => uploadPhotos(event.currentTarget)}
        />
        {uploading && <span className="muted">Uploading photos…</span>}
        {photoError && <span className="error" role="alert">{photoError}</span>}
        <div className="image-preview-list">
          {photos.map((photo, index) => (
            <div className="image-preview" key={`${photo.url}-${index}`}>
              <img src={photo.url} alt={`Listing photo ${index + 1}`} />
              <button
                type="button"
                className="image-preview-cancel"
                aria-label={`Remove listing photo ${index + 1}`}
                title="Remove photo"
                onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </label>
      <button className="btn primary" disabled={busy || uploading || !photos.length}>
        {busy ? "Saving…" : "Save listing"}
      </button>
    </form>
  );
}

function AssetsTable({
  rows,
  onOpen,
  onCashSale,
  onChangePrice,
  selectionEnabled = false,
  selectedIds = [],
  onSelectionChange,
  onSelectAll,
  onEdit,
}: {
  rows: any[];
  onOpen: (r: any) => void;
  onCashSale?: (r: any) => void;
  onChangePrice?: (r: any) => void;
  selectionEnabled?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (id: string, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  onEdit?: (r: any) => void;
}) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  return (
    <div className="data-table-wrap">
      <Table className="data-table">
        <TableHeader>
          <TableRow>
            {selectionEnabled && (
              <TableHead className="listing-select-cell">
                <input
                  className="listing-select-checkbox"
                  type="checkbox"
                  aria-label="Select all visible listings"
                  checked={allSelected}
                  onChange={(event) => onSelectAll?.(event.target.checked)}
                />
              </TableHead>
            )}
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
            <TableRow key={r.id} className={selectedIds.includes(r.id) ? "listing-row-selected" : undefined}>
              {selectionEnabled && (
                <TableCell className="listing-select-cell">
                  <input
                    className="listing-select-checkbox"
                    type="checkbox"
                    aria-label={`Select ${r.title || "listing"}`}
                    checked={selectedIds.includes(r.id)}
                    onChange={(event) => onSelectionChange?.(r.id, event.target.checked)}
                  />
                </TableCell>
              )}
              <TableCell>
                <div className="table-asset">
                  <img
                    src={r.images?.[0]?.url || r.images?.[0] || r.image_path || r.image || "/favicon.svg"}
                    alt={r.title ? `${r.title} photo` : "Collateral photo"}
                    onError={(event) => {
                      event.currentTarget.src = "/favicon.svg";
                    }}
                  />
                  <div>
                    {r.title}
                    <small>
                      {r.location || r.custody_location} · {r.category}
                    </small>
                  </div>
                </div>
              </TableCell>
              <TableCell>{r.external_loan_id || r.asset_ref || "—"}</TableCell>
              <TableCell>
                {r.cash_sale_candidate
                  ? r.cash_sale_listing
                    ? methodName(r.cash_sale_listing.method)
                    : "Not listed"
                  : methodName(r.method || "fixed")}
              </TableCell>
              <TableCell>
                {r.price != null
                  ? money(r.price)
                  : formatValuation(r.valuation_amount || 0, r.currency)}
              </TableCell>
              <TableCell>
                <Status status={r.status} />
              </TableCell>
              <TableCell>
                {onEdit && (
                  <button
                    className="listing-edit-button"
                    type="button"
                    aria-label={`Edit ${r.title || "listing"}`}
                    title="Edit listing and photos"
                    onClick={() => onEdit(r)}
                  >
                    <Pencil size={16} />
                  </button>
                )}
                {onChangePrice && r.status === "live" && (
                  <button
                    className="table-actions"
                    style={{ marginRight: 10 }}
                    disabled={r.method?.includes("auction") && Number(r.bids) > 0}
                    title={
                      r.method?.includes("auction") && Number(r.bids) > 0
                        ? "Starting bid is locked after the first bid."
                        : "Request an approved price change."
                    }
                    onClick={() => onChangePrice(r)}
                  >
                    {r.method?.includes("auction")
                      ? "Change starting bid"
                      : "Change price"}
                  </button>
                )}
                {onCashSale && (r.cash_sale_candidate || (r.status === "live" && !r.method?.includes("auction"))) && (
                  <button
                    className="table-actions"
                    style={{ marginRight: 10 }}
                    disabled={r.cash_sale_candidate && !r.cash_sale_listing}
                    title={
                      r.cash_sale_candidate && !r.cash_sale_listing
                        ? "Create and publish a fixed-price listing before recording a cash sale."
                        : "Record the cash receipt and mark the asset sold."
                    }
                    onClick={() => onCashSale(r)}
                  >
                    {r.cash_sale_candidate ? "Mark sold" : "Record cash"}
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
        (["paid", "live", "listed", "approved", "released", "closed", "ready_for_handover"].includes(
          status,
        )
          ? "green"
          : [
                "pending",
                "pending_approval",
                "awaiting_payment",
                "sale_review",
                "pending_approval",
                "approval_required",
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
                    {c === "status" || c === "release_status" ? (
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
function formatValuation(amount: number | string, currency = "MWK") {
  const code = currency === "USD" ? "USD" : "MWK";
  return new Intl.NumberFormat(code === "USD" ? "en-US" : "en-MW", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function NativePick({
  name,
  values,
  defaultValue,
}: {
  name: string;
  values: string[];
  defaultValue?: string;
}) {
  return (
    <Select name={name} defaultValue={defaultValue || values[0]}>
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
  level = 0,
  busy,
  onSubmit,
}: {
  type: string;
  selected: any;
  assets?: any[];
  authorizations?: any[];
  level?: number;
  busy: boolean;
  onSubmit: (d: any) => void;
}) {
  const [assetId, setAssetId] = useState(
    assets.some((asset) => asset.id === selected?.id) ? selected.id : "",
  );
  const [saleMethod, setSaleMethod] = useState(selected?.method || "fixed_price");
  const [listingTitle, setListingTitle] = useState(selected?.title || "");
  const [slug, setSlug] = useState(slugify(selected?.title || ""));
  const [slugEdited, setSlugEdited] = useState(false);
  const [photos, setPhotos] = useState<{ url: string; path: string }[]>(
    type === "listing"
      ? selected?.images || (selected?.image ? [{ url: selected.image, path: "" }] : [])
      : [],
  );
  const [imageUrl, setImageUrl] = useState(photos[0]?.url || "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const matchingAuthorizations = authorizations.filter(
    (authorization) =>
      authorization.asset_id === assetId && authorization.status === "approved",
  );
  async function uploadPhotos(input: HTMLInputElement, purpose: "asset" | "listing") {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    if (photos.length + files.length > 10) {
      setImageError("You can add up to 10 images per asset.");
      input.value = "";
      return;
    }
    setImageError("");
    setUploadingImage(true);
    let firstUploaded = "";
    try {
      for (const file of files) {
        const data = new FormData();
        data.set("file", file);
        data.set("purpose", purpose);
        const response = await fetch("/api/admin/listing-image", {
          method: "POST",
          body: data,
        });
        const result: any = await response.json();
        if (!response.ok) throw Error(result.error);
        if (!firstUploaded) firstUploaded = result.image;
        setPhotos((current) => [
          ...current,
          { url: result.image, path: result.storage_path },
        ]);
      }
      if (purpose === "listing" && !imageUrl) setImageUrl(firstUploaded);
    } catch (error) {
      setImageError((error as Error).message);
    } finally {
      setUploadingImage(false);
      input.value = "";
    }
  }
  function removePhoto(index: number) {
    const next = photos.filter((_, photoIndex) => photoIndex !== index);
    setPhotos(next);
    if (photos[index]?.url === imageUrl) setImageUrl(next[0]?.url || "");
    setImageError("");
  }
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        if (type === "listing" && level < 4 && !matchingAuthorizations.length) return;
        if (type === "asset" && !photos.some((photo) => photo.path.startsWith("assets/"))) {
          setImageError("Upload at least one collateral image before saving.");
          return;
        }
        const values = Object.fromEntries(new FormData(e.currentTarget));
        onSubmit({
          ...values,
          ...(type === "asset"
            ? { image_paths: photos.map((photo) => photo.path).filter(Boolean) }
            : { images: photos.map((photo) => photo.url), image: imageUrl }),
          entity_id: selected?.id,
        });
      }}
    >
      {type === "listing" && (
        <p className="listing-workflow-note" role="status">
          {level >= 4 ? (
            <>Level {level} can publish directly without a sale authorization. If you choose to include one, it must already be approved for this asset.</>
          ) : (
            <>Your Level {level} access will submit this listing for independent approval. It will appear on the public website after approval.</>
          )}
        </p>
      )}
      {type === "asset" ? (
        <>
          <label>
            External loan ID (optional)
            <input
              name="external_loan_id"
              placeholder="Leave blank for a standalone sale"
            />
          </label>
          <p className="muted">
            A unique asset reference is assigned automatically when the asset is saved.
          </p>
          <label>
            Collateral images (select up to 10; JPEG, PNG or WebP, 5 MB each)
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadingImage || busy}
              onChange={(event) => uploadPhotos(event.currentTarget, "asset")}
            />
            {uploadingImage && <span className="muted">Uploading image…</span>}
            {imageError && <span className="error">{imageError}</span>}
            <div className="image-preview-list">
              {photos.map((photo, index) => (
                <div className="image-preview" key={photo.path || photo.url}>
                  <img src={photo.url} alt={`Collateral image ${index + 1}`} />
                <button
                  type="button"
                  className="image-preview-cancel"
                    aria-label={`Remove collateral image ${index + 1}`}
                  title="Remove image"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    removePhoto(index);
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              ))}
            </div>
            <input
              type="hidden"
              name="image_paths"
              value={JSON.stringify(photos.map((photo) => photo.path).filter(Boolean))}
            />
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
            <div className="form-grid two">
              <label>
                Valuation amount
                <input
                  type="number"
                  name="valuation_amount"
                  required
                  min="1"
                  step="0.01"
                />
              </label>
              <label>
                Currency
                <NativePick name="currency" values={["MWK", "USD"]} />
              </label>
            </div>
          </div>
          <label>
            Custody location
            <input
              name="custody_location"
              placeholder="e.g. Blantyre branch, secured store"
              required
            />
            <span className="muted">
              Where the asset is physically held, such as a branch or warehouse.
            </span>
          </label>
          <label>
            Condition
            <NativePick
              name="condition_grade"
              values={["New", "Excellent", "Good", "Fair"]}
            />
          </label>
        </>
      ) : type === "listing" ? (
        <>
          <label>
            Asset
            <select
              name="asset_id"
              value={assetId}
              onChange={(event) => {
                const nextAsset = assets.find(
                  (asset) => asset.id === event.target.value,
                );
                setAssetId(event.target.value);
                const nextPhotos = nextAsset?.images || (nextAsset?.image ? [{ url: nextAsset.image, path: "" }] : []);
                setPhotos(nextPhotos);
                setImageUrl(nextPhotos[0]?.url || "");
                setListingTitle(nextAsset?.title || "");
                setSlug(slugify(nextAsset?.title || ""));
                setSlugEdited(false);
              }}
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
            {level >= 4
              ? "Approved sale authorization (optional)"
              : "Approved sale authorization"}
            <select
              key={assetId}
              name="sale_authorization_id"
              defaultValue={matchingAuthorizations[0]?.id || ""}
              required={level < 4}
            >
              <option value="" disabled={level < 4}>
                {matchingAuthorizations.length
                  ? "Select approved authorization"
                  : level >= 4
                    ? "No authorization needed for Level 4"
                    : "No approved authorization for this asset"}
              </option>
              {matchingAuthorizations.map((authorization) => (
                <option key={authorization.id} value={authorization.id}>
                  {authorization.reference_no || authorization.id}
                </option>
              ))}
            </select>
            {level >= 4 ? (
              <span className="muted">
                Level 4 staff may publish without one. Any authorization selected here must be approved and belong to this asset.
              </span>
            ) : !matchingAuthorizations.length && (
              <span className="muted" role="alert">
                There is no approved authorization for this asset, so it cannot be listed yet. Close this form, open the asset under Collateral, and choose “Request sale authorization.” A Level 3 or 4 staff member must approve it first.
              </span>
            )}
          </label>
          <label>
            Public title
            <input
              name="title"
              value={listingTitle}
              onChange={(event) => {
                const value = event.target.value;
                setListingTitle(value);
                if (!slugEdited) setSlug(slugify(value));
              }}
              required
            />
          </label>
          <label>
            Public page address
            <input
              name="slug"
              value={slug}
              onChange={(event) => {
                setSlug(slugify(event.target.value));
                setSlugEdited(true);
              }}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
            <span className="muted">
              Auto-filled from the title. Public address: nyasamarket.com/listing/{slug || "your-item"}
            </span>
          </label>
          <label>
            Sale mode
            <Select name="method" value={saleMethod} onValueChange={setSaleMethod}>
              <SelectTrigger style={{ width: "100%", marginTop: 8 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed_price">Direct sale · Buy</SelectItem>
                <SelectItem value="auction">Auction · bids</SelectItem>
                <SelectItem value="fixed_plus_offer">Direct sale · Buy or offer</SelectItem>
                <SelectItem value="auction_plus_buy_now">Auction · bids or buy now</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <div className={saleMethod.includes("auction") ? "form-grid two" : "form-grid"}>
            <label>
              {saleMethod.includes("auction")
                ? "Starting bid (MWK)"
                : "Direct-sale price (MWK)"}
              <input name="price" type="number" min="1" required step="0.01" />
            </label>
            {saleMethod.includes("auction") && (
              <label>
                Minimum bid increment (MWK)
                <input
                  name="increment"
                  type="number"
                  min="1"
                  defaultValue="10000"
                  step="0.01"
                />
              </label>
            )}
          </div>
          {saleMethod.includes("auction") && (
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
          )}
          <label>
            Collection point
            <input
              name="collection_point"
              defaultValue={selected?.location || ""}
              required
            />
          </label>
          <label>
            Condition
            <NativePick
              name="condition_grade"
              values={["New", "Excellent", "Good", "Fair"]}
              defaultValue={selected?.condition_grade || "Good"}
            />
          </label>
          <label>
            Description
            <textarea name="description" required />
          </label>
          <label>
            Known defects
            <textarea name="defects" required />
          </label>
          <label>
            Listing images (select up to 10; JPEG, PNG or WebP, 5 MB each)
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadingImage || busy}
              onChange={(event) => uploadPhotos(event.currentTarget, "listing")}
            />
            {uploadingImage && <span className="muted">Uploading image…</span>}
            {imageError && <span className="error">{imageError}</span>}
            <div className="image-preview-list">
              {photos.map((photo, index) => (
                <div className="image-preview" key={photo.path || photo.url}>
                  <img src={photo.url} alt={`Listing image ${index + 1}`} />
                <button
                  type="button"
                  className="image-preview-cancel"
                    aria-label={`Remove listing image ${index + 1}`}
                  title="Remove image"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    removePhoto(index);
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              ))}
            </div>
          </label>
          <label>
            Image URL
            <input
              name="image"
              type="url"
              value={imageUrl}
              onChange={(event) => {
                const value = event.target.value;
                setImageUrl(value);
                setPhotos((current) => [
                  ...(value ? [{ url: value, path: "" }] : []),
                  ...current.slice(1).filter((photo) => photo.url !== value),
                ]);
              }}
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
        {type === "listing" ? "Approval reason" : "Reason"}
        <textarea name="reason" required />
        {type === "listing" && (
          <span className="muted">
            Internal note for the approval record. The description above is shown publicly.
          </span>
        )}
      </label>
      <button
        className="btn primary"
        disabled={busy || (type === "listing" && level < 4 && !matchingAuthorizations.length)}
      >
        {busy
          ? "Submitting…"
          : type === "listing"
            ? level >= 4
              ? "Publish listing"
              : "Submit for approval"
            : "Save request"}
      </button>
    </form>
  );
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
