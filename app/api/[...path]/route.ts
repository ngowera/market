import { NextResponse } from "next/server";
import { z } from "zod";
import {
  config,
  sb,
  currentUser,
  staffUser,
  getPublicListings,
} from "@/lib/server";
import { minorUnits, validSignature } from "@/lib/domain";
import { verifyPayment } from "@/lib/payments";
const uuid = z.string().uuid();
const amount = z
  .union([z.string(), z.number()])
  .transform(String)
  .refine((v) => {
    try {
      return minorUnits(v) > 0n;
    } catch {
      return false;
    }
  }, "Invalid amount");
function json(d: any, status = 200) {
  return NextResponse.json(d, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function cookie(res: NextResponse, token: string, refresh?: string) {
  res.cookies.set("cmrp_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });
  if (refresh)
    res.cookies.set("cmrp_refresh", refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 604800,
    });
  return res;
}
async function rpc(name: string, args: any, token?: string, service = false) {
  return sb(
    "/rest/v1/rpc/" + name,
    { method: "POST", body: JSON.stringify(args) },
    token,
    service,
  );
}
async function get(request: Request, path: string) {
  if(path==="public-config"){const c=config();if(!c.url||!c.key)return json({error:"Connection unavailable"},503);return json({url:c.url,key:c.key})}
  if (path === "health")
    return json({
      status: "ok",
      backend: config().key ? "configured" : "sample",
      time: new Date().toISOString(),
    });
  if (path === "catalog") {
    const d = await getPublicListings();
    return json(d);
  }
  if (path === "session") {
    const { user, token } = await currentUser(request);
    let staff;
    try {
      staff = (
        await sb(
          "/rest/v1/staff_profiles?user_id=eq." + user.id + "&select=*",
          {},
          token,
        )
      )[0];
      if (staff) {
        await staffUser(request);
      }
    } catch {
      staff = null;
    }
    return json({ user, staff });
  }
  if (path === "auth/mfa") {
    const { token } = await currentUser(request);
    const rows = await sb("/auth/v1/factors", {}, token);
    const factor =
      rows.all?.find(
        (f: any) => f.factor_type === "totp" && f.status === "verified",
      ) ||
      rows.find?.(
        (f: any) => f.factor_type === "totp" && f.status === "verified",
      );
    if (!factor)
      throw Error(
        "Enroll a TOTP factor through Supabase Auth before staff access.",
      );
    const challenge = await sb(
      "/auth/v1/factors/" + factor.id + "/challenge",
      { method: "POST", body: JSON.stringify({}) },
      token,
    );
    return json({ factor_id: factor.id, challenge_id: challenge.id });
  }
  if (path.startsWith("listings/")) {
    const id = uuid.parse(path.split("/")[1]);
    const listing = (
      await sb("/rest/v1/public_catalog?id=eq." + id + "&select=*")
    )[0];
    if (!listing) return json({ error: "Asset not found" }, 404);
    return json({ listing, bids: await rpc("bid_history", { p_listing: id }) });
  }
  if (path === "account") {
    const { user, token } = await currentUser(request);
    const [orders, bids, offers, watch, notifications, releases] =
      await Promise.all(
        [
          "orders?buyer_id=eq." + user.id,
          "bids?bidder_id=eq." + user.id,
          "offers?buyer_id=eq." + user.id,
          "watchlist?user_id=eq." + user.id,
          "notifications?user_id=eq." + user.id,
          "release_orders?status=eq.approved",
        ].map((t) => sb("/rest/v1/" + t + "&select=*", {}, token)),
      );
    const all = await getPublicListings();
    return json({
      orders,
      bids,
      offers,
      notifications,
      releases,
      watchlist: all.listings.filter((i) =>
        watch.some((w: any) => w.listing_id === i.id),
      ),
    });
  }
  if (path === "admin/data") {
    const { staff, token } = await staffUser(request);
    const names = [
      "public_catalog",
      "approval_requests",
      "orders",
      "settlements",
      "system_settings",
    ];
    if (staff.security_level >= 2)
      names.push("collateral_assets", "sale_authorizations", "offers");
    if (staff.security_level === 4) names.push("staff_profiles");
    const rows = await Promise.all(
      names.map((n) => sb("/rest/v1/" + n + "?select=*&limit=200", {}, token)),
    );
    const d = Object.fromEntries(names.map((n, i) => [n, rows[i]]));
    if (staff.security_level >= 2 && d.collateral_assets) {
      const media = await sb(
        "/rest/v1/asset_media?media_type=eq.public_image&select=asset_id,storage_path,sort_order&order=sort_order.asc&limit=500",
        {},
        token,
      );
      const imagesByAsset = new Map<string, { url: string; path: string }[]>();
      const imageRoot = config().url!.replace(/\/$/, "") + "/storage/v1/object/public/listing-images/";
      for (const item of media) {
        const images = imagesByAsset.get(item.asset_id) || [];
        images.push({
          path: item.storage_path,
          url: imageRoot + item.storage_path,
        });
        imagesByAsset.set(item.asset_id, images);
      }
      d.collateral_assets = d.collateral_assets.map((asset: any) => {
        const images = imagesByAsset.get(asset.id) || [];
        return images.length
          ? { ...asset, images, image_path: images[0].path, image: images[0].url }
          : asset;
      });
    }
    return json({
      listings: d.public_catalog,
      assets: d.collateral_assets || d.public_catalog,
      authorizations: d.sale_authorizations || [],
      approvals: d.approval_requests,
      orders: (d.orders || []).map((order: any) => ({
        ...order,
        public_title: d.public_catalog.find((listing: any) => listing.id === order.listing_id)?.title || "—",
      })),
      settlements: d.settlements,
      logs: await rpc("admin_audit_log", {}, token),
      staff: d.staff_profiles,
      offers: d.offers,
      settings: d.system_settings,
      ...(await rpc("dashboard_metrics",{},token)),
    });
  }
  return json({ error: "Endpoint not found" }, 404);
}
async function post(request: Request, path: string) {
  const origin = request.headers.get("origin");
  if (
    path !== "payments/webhook" &&
    !path.startsWith("jobs/") &&
    path !== "integration/collateral"
  ) {
    if (origin && origin !== new URL(request.url).origin)
      return json({ error: "Cross-origin request rejected" }, 403);
  }
  if (path === "payments/webhook") {
    const secret = process.env.PAYCHANGU_WEBHOOK_SECRET;
    if (!secret) return json({ error: "Webhook not configured" }, 503);
    const raw = await request.text();
    if (raw.length > 65536) return json({ error: "Payload too large" }, 413);
    if (
      !(await validSignature(
        raw,
        request.headers.get("signature") || "",
        secret,
      ))
    )
      return json({ error: "Invalid signature" }, 401);
    const event = JSON.parse(raw);
    const ref = event.tx_ref || event.data?.tx_ref;
    if (!ref) return json({ received: true, ignored: true });
    const id = event.event_id || String(ref) + ":" + String(event.status);
    const previous = await sb(
      "/rest/v1/webhook_events?provider=eq.paychangu&provider_event_id=eq." +
        encodeURIComponent(id) +
        "&select=*",
      {},
      undefined,
      true,
    );
    if (previous[0]?.processed)
      return json({ received: true, duplicate: true });
    if (!previous.length) {
      try {
        await sb(
          "/rest/v1/webhook_events",
          {
            method: "POST",
            body: JSON.stringify({
              provider: "paychangu",
              provider_event_id: id,
              event_type: event.event_type,
              payload: {
                tx_ref: ref,
                status: event.status,
                currency: event.currency,
                amount: event.amount,
              },
              signature_valid: true,
            }),
            headers: { Prefer: "return=minimal" },
          },
          undefined,
          true,
        );
      } catch (e) {
        const existing = await sb(
          "/rest/v1/webhook_events?provider_event_id=eq." +
            encodeURIComponent(id) +
            "&select=id",
          {},
          undefined,
          true,
        );
        if (!existing.length) throw e;
      }
    }
    const result = await verifyPayment(ref);
    await sb(
      "/rest/v1/webhook_events?provider_event_id=eq." + encodeURIComponent(id),
      {
        method: "PATCH",
        body: JSON.stringify({
          processed: result.status === "paid",
          processed_at: new Date().toISOString(),
        }),
        headers: { Prefer: "return=minimal" },
      },
      undefined,
      true,
    );
    return json({ received: true, status: result.status });
  }
  if (path === "admin/listing-image") {
    const maxImageSize = 5 * 1024 * 1024;
    if (Number(request.headers.get("content-length") || 0) > maxImageSize + 16384)
      return json({ error: "Image must be 5 MB or smaller." }, 413);
    const { token } = await staffUser(request, 2);
    const form = await request.formData();
    const file = form.get("file");
    const purpose = form.get("purpose") === "asset" ? "assets" : "listings";
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    if (!(file instanceof File) || !extensions[file.type])
      return json({ error: "Choose a JPEG, PNG, or WebP image." }, 400);
    if (file.size > maxImageSize)
      return json({ error: "Image must be 5 MB or smaller." }, 413);
    const c = config();
    const objectPath = `${purpose}/${crypto.randomUUID()}.${extensions[file.type]}`;
    await sb(
      "/storage/v1/object/listing-images/" + objectPath,
      {
        method: "POST",
        body: await file.arrayBuffer(),
        headers: { "Content-Type": file.type, "x-upsert": "false" },
      },
      token,
    );
    return json({
      image:
        c.url!.replace(/\/$/, "") +
        "/storage/v1/object/public/listing-images/" +
        objectPath,
      storage_path: objectPath,
    });
  }
  if (Number(request.headers.get("content-length") || 0) > 65536)
    return json({ error: "Payload too large" }, 413);
  const b: any = await request.json().catch(() => ({}));
  if(path==="auth/refresh"){const refresh=request.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith("cmrp_refresh="))?.slice(13);if(!refresh)return json({error:"Please sign in."},401);const auth=await sb("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:decodeURIComponent(refresh)})});return cookie(json({refreshed:true}),auth.access_token,auth.refresh_token)}
  if (path === "auth/login") {
    const d = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(b);
    const auth = await sb("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify(d),
    });
    return cookie(
      json({ user: auth.user }),
      auth.access_token,
      auth.refresh_token,
    );
  }
  if (path === "auth/signup") {
    const d = z
      .object({
        email: z.string().email(),
        password: z.string().min(12),
        display_name: z.string().min(1).max(80),
      })
      .parse(b);
    const auth = await sb("/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify({
        email: d.email,
        password: d.password,
        data: { display_name: d.display_name },
      }),
    });
    return json({ sent: true });
  }
  if (path === "auth/recover") {
    const email = z.string().email().parse(b.email);
    await sb("/auth/v1/recover", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return json({ sent: true });
  }
  if (path === "auth/logout") {
    try {
      const { token } = await currentUser(request);
      await sb("/auth/v1/logout", { method: "POST" }, token);
    } catch {}
    const r = json({ logged_out: true });
    r.cookies.delete("cmrp_session");
    r.cookies.delete("cmrp_refresh");
    return r;
  }
  if (path === "auth/mfa") {
    const { token } = await currentUser(request);
    const d = z
      .object({
        factor_id: uuid,
        challenge_id: uuid,
        code: z.string().regex(/^\d{6}$/),
      })
      .parse(b);
    const auth = await sb(
      "/auth/v1/factors/" + d.factor_id + "/verify",
      {
        method: "POST",
        body: JSON.stringify({ challenge_id: d.challenge_id, code: d.code }),
      },
      token,
    );
    return cookie(
      json({ verified: true }),
      auth.access_token,
      auth.refresh_token,
    );
  }
  if (path.startsWith("jobs/")) {
    if (
      !process.env.INTEGRATION_JOB_SECRET ||
      request.headers.get("authorization") !==
        "Bearer " + process.env.INTEGRATION_JOB_SECRET
    )
      return json({ error: "Job authorization required" }, 401);
    if (path === "jobs/auctions")
      return json({
        closed: await rpc("close_auctions", {}, undefined, true),
        expired: await rpc("expire_reservations", {}, undefined, true),
      });
    if (path === "jobs/reconcile") {
      const payments = await sb(
        "/rest/v1/payments?status=in.(pending,verifying)&select=tx_ref&limit=100",
        {},
        undefined,
        true,
      );
      const results = [];
      for (const p of payments) {
        try {
          results.push(await verifyPayment(p.tx_ref));
        } catch (e) {
          results.push({ tx_ref: p.tx_ref, error: (e as Error).message });
        }
      }
      return json({ results });
    }
    if (path === "jobs/loan-sync") return json(await syncLoans());
  }
  if (path === "integration/collateral") {
    if (
      !process.env.INTEGRATION_JOB_SECRET ||
      request.headers.get("authorization") !==
        "Bearer " + process.env.INTEGRATION_JOB_SECRET
    )
      return json({ error: "Integration authorization required" }, 401);
    const d = z
      .object({
        source_system: z.string().min(1),
        external_loan_id: z.string().min(1),
        external_collateral_id: z.string().optional(),
        borrower_reference: z.string().optional(),
        outstanding_amount: amount,
        currency: z.literal("MWK"),
        recovery_status: z.string(),
        source_version: z.string(),
      })
      .parse(b);
    return json(await rpc("sync_loan", { p_values: d }, undefined, true));
  }
  const { user, token } = await currentUser(request);
  if (path === "bids") {
    const d = z
      .object({ listing_id: uuid, amount, terms: z.literal(true) })
      .parse(b);
    return json(
      await rpc(
        "place_bid",
        { p_listing: d.listing_id, p_amount: d.amount },
        token,
      ),
    );
  }
  if (path === "offers") {
    const d = z
      .object({
        listing_id: uuid,
        amount,
        note: z.string().max(500).default(""),
        terms: z.literal(true),
      })
      .parse(b);
    return json(
      await rpc(
        "submit_offer",
        { p_listing: d.listing_id, p_amount: d.amount, p_note: d.note },
        token,
      ),
    );
  }
  if (path === "orders") {
    const d = z.object({ listing_id: uuid, terms: z.literal(true) }).parse(b);
    return json(await rpc("buy_now", { p_listing: d.listing_id }, token));
  }
  if(path==="offers/accept"){return json(await rpc("accept_counteroffer",{p_offer:uuid.parse(b.offer_id)},token))}
  if (path === "watchlist") {
    const id = uuid.parse(b.listing_id);
    const rows = await sb(
      "/rest/v1/watchlist?user_id=eq." + user.id + "&listing_id=eq." + id,
      {},
      token,
    );
    return json(
      await sb(
        "/rest/v1/watchlist" +
          (rows.length
            ? "?user_id=eq." + user.id + "&listing_id=eq." + id
            : ""),
        {
          method: rows.length ? "DELETE" : "POST",
          body: rows.length
            ? undefined
            : JSON.stringify({ user_id: user.id, listing_id: id }),
          headers: { Prefer: "return=minimal" },
        },
        token,
      ),
    );
  }
  if (path === "payments/checkout") {
    const id = uuid.parse(b.order_id);
    if (!process.env.PAYCHANGU_SECRET_KEY)
      throw Error("PayChangu server secret is not configured.");
    const payment = await rpc("begin_payment", { p_order: id }, token);
    if(payment.checkout_url)return json({checkout_url:payment.checkout_url});
    const app = process.env.APP_URL;
    if (!app) throw Error("APP_URL must be configured.");
    const r = await fetch("https://api.paychangu.com/payment", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.PAYCHANGU_SECRET_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        tx_ref: payment.tx_ref,
        amount: payment.amount,
        currency: payment.currency,
        email: user.email,
        callback_url: app + "/account",
        return_url: app + "/account",
        meta: { order_id: id },
        customization: { title: "CMRP asset purchase" },
      }),
    });
    const result: any = await r.json();
    if (!r.ok || result.status !== "success")
      throw Error("Payment session creation failed. Please retry.");
    const checkout = new URL(result.data.checkout_url);
    if (
      checkout.protocol !== "https:" ||
      checkout.hostname !== "checkout.paychangu.com"
    )
      throw Error("Invalid payment provider redirect.");
    await sb("/rest/v1/payments?tx_ref=eq."+encodeURIComponent(payment.tx_ref),{method:"PATCH",body:JSON.stringify({checkout_url:checkout.href})},undefined,true);
    return json({ checkout_url: checkout.href });
  }
  if (path.startsWith("admin/")) {
    const action = path.slice(6);
    const min = ["staff", "settings", "fee-rule"].includes(action)
      ? 4
      : ["approve", "offer", "settlement", "cash-sale"].includes(action)
        ? 3
        : 2;
    const { staff } = await staffUser(request, min);
    if (action === "cash-sale") {
      const d = z
        .object({
          listing_id: uuid,
          receipt_ref: z.string().trim().min(1).max(100),
          buyer_name: z.string().trim().min(1).max(120),
          buyer_contact: z.string().trim().max(100).optional().default(""),
          reason: z.string().trim().min(3).max(500),
        })
        .parse(b);
      return json(
        await rpc(
          "record_cash_sale",
          {
            p_listing: d.listing_id,
            p_receipt_ref: d.receipt_ref,
            p_buyer_name: d.buyer_name,
            p_buyer_contact: d.buyer_contact,
            p_reason: d.reason,
          },
          token,
        ),
      );
    }
    if (action === "asset")
      return json(await rpc("create_asset", { p_values: b }, token));
    if (action === "listing")
      return json(await rpc("create_listing", { p_values: b }, token));
    if (action === "price-change") {
      const d = z
        .object({
          listing_id: uuid,
          price: amount,
          reason: z.string().trim().min(3).max(500),
        })
        .parse(b);
      return json(
        await rpc(
          "request_change",
          {
            p_action: "listing_price_change",
            p_entity: d.listing_id,
            p_values: { price: d.price, reason: d.reason },
          },
          token,
        ),
      );
    }
    if (action === "authorization")
      return json(
        await rpc(
          "request_authorization",
          { p_asset: uuid.parse(b.entity_id), p_values: b },
          token,
        ),
      );
    if (action === "approve") {
      const d = z
        .object({
          request_id: uuid,
          decision: z.enum(["approved", "rejected"]),
          reason: z.string().min(3),
        })
        .parse(b);
      return json(
        await rpc(
          "approve_action",
          {
            p_request: d.request_id,
            p_decision: d.decision,
            p_reason: d.reason,
          },
          token,
        ),
      );
    }
    if (action === "offer")
      return json(
        await rpc(
          "decide_offer",
          {
            p_offer: uuid.parse(b.offer_id),
            p_decision: z
              .enum(["accepted", "rejected", "countered"])
              .parse(b.decision),
            p_amount: b.amount ? amount.parse(b.amount) : null,
            p_reason: z.string().min(3).parse(b.reason),
          },
          token,
        ),
      );
    if (action === "release")
      return json(
        await rpc(
          "release_asset",
          {
            p_order: uuid.parse(b.order_id),
            p_token: z.string().min(1).parse(b.release_code),
            p_collector: z.string().min(1).parse(b.collector_name),
            p_ref: z.string().min(1).parse(b.collector_ref),
            p_notes: z.string().min(1).parse(b.notes),
          },
          token,
        ),
      );
    if (
      [
        "staff",
        "settings",
        "fee-rule",
        "settlement",
        "prepare-release",
      ].includes(action)
    ) {
      const names: Record<string, string> = {
        staff: "staff_change",
        settings: "settings_change",
        "fee-rule": "fee_change",
        settlement: "settlement",
        "prepare-release": "release",
      };
      return json(
        await rpc(
          "request_change",
          {
            p_action: names[action],
            p_entity:
              action === "staff"
                ? uuid.parse(b.user_id)
                : action === "settlement"
                  ? uuid.parse(b.settlement_id)
                  : action === "prepare-release"
                    ? uuid.parse(b.order_id)
                    : crypto.randomUUID(),
            p_values: b,
          },
          token,
        ),
      );
    }
    if (action === "verify-payment") {
      const rows = await sb(
        "/rest/v1/payments?order_id=eq." +
          uuid.parse(b.order_id) +
          "&select=tx_ref",
        {},
        token,
      );
      if (!rows.length) throw Error("No payment attempts found.");
      return json(await verifyPayment(rows[rows.length - 1].tx_ref));
    }
    if (action === "export")
      return json(
        await rpc(
          "log_export",
          { p_report: z.string().max(80).parse(b.report) },
          token,
        ),
      );
  }
  return json({ error: "Endpoint not found" }, 404);
}
async function syncLoans() {
  if (!process.env.LOAN_API_URL || !process.env.LOAN_API_TOKEN)
    throw Error("Loan integration is not configured.");
  const rows = await sb(
    "/rest/v1/integration_outbox?status=eq.pending&next_attempt_at=lte." +
      encodeURIComponent(new Date().toISOString()) +
      "&select=*&limit=50",
    {},
    undefined,
    true,
  );
  const results = [];
  for (const row of rows) {
    try {
      const r = await fetch(
        process.env.LOAN_API_URL + "/integration/recovery",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + process.env.LOAN_API_TOKEN,
            "Idempotency-Key": row.idempotency_key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...row.payload,
            idempotency_key: row.idempotency_key,
          }),
        },
      );
      if (!r.ok) throw Error("Loan API HTTP " + r.status);
      await sb(
        "/rest/v1/integration_outbox?id=eq." + row.id,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "posted",
            attempts: row.attempts + 1,
          }),
        },
        undefined,
        true,
      );
      await sb(
        "/rest/v1/settlements?id=eq." + row.settlement_id,
        {
          method: "PATCH",
          body: JSON.stringify({
            loan_sync: "posted",
            status: "posted_to_loan",
          }),
        },
        undefined,
        true,
      );
      results.push({ id: row.id, status: "posted" });
    } catch (e) {
      await sb(
        "/rest/v1/integration_outbox?id=eq." + row.id,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: row.attempts >= 9 ? "dead_letter" : "pending",
            attempts: row.attempts + 1,
            next_attempt_at: new Date(
              Date.now() + Math.min(86400000, 60000 * 2 ** row.attempts),
            ).toISOString(),
            last_error: (e as Error).message,
          }),
        },
        undefined,
        true,
      );
      results.push({ id: row.id, status: "retry" });
    }
  }
  return { results };
}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    return await get(req, (await params).path.join("/"));
  } catch (e) {
    return json(
      { error: (e as Error).message },
      (e as Error).message.includes("sign in") ? 401 : 503,
    );
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    return await post(req, (await params).path.join("/"));
  } catch (e) {
    if (e instanceof z.ZodError)
      return json(
        { error: "Invalid request. Check the required values." },
        400,
      );
    const msg = (e as Error).message;
    return json(
      { error: msg },
      msg.includes("sign in")
        ? 401
        : msg.includes("permission") || msg.includes("MFA")
          ? 403
          : 400,
    );
  }
}
