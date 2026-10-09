import type { Listing } from "./catalog.ts";
export function env(name: string) {
  const runtime = globalThis as typeof globalThis & {
    Deno?: { env?: { get: (key: string) => string | undefined } };
    process?: { env?: Record<string, string | undefined> };
  };
  const deno = runtime.Deno;
  if (deno?.env) {
    try {
      const value = deno.env.get(name);
      if (value !== undefined) return value;
    } catch {
      // Deno only exposes environment variables explicitly granted to the function.
    }
  }
  return runtime.process?.env?.[name];
}
export function config() {
  return {
    url: env("SUPABASE_URL"),
    key: env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY"),
    secret: env("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
export async function sb(
  path: string,
  init: RequestInit = {},
  token?: string,
  privileged = false,
): Promise<any> {
  const c = config();
  if (!c.url || !c.key)
    throw new Error(
      "Supabase is not connected. This preview uses sample data.",
    );
  const key = privileged ? c.secret : c.key;
  if (!key) throw new Error("Server connection is incomplete.");
  const r = await fetch(c.url + path, {
    ...init,
    headers: {
      apikey: key,
      Authorization: "Bearer " + (token || key),
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  const body: any = await r.json().catch(() => null);
  if (!r.ok)
    throw Object.assign(new Error(
      body?.message || body?.error_description || "Request failed",
    ), { code: body?.code });
  return body;
}
export async function getPublicListings(): Promise<{
  listings: Listing[];
  demo: boolean;
}> {
  if (!config().url || !config().key) return { listings: [], demo: true };
  const listings = await sb(
    "/rest/v1/public_catalog?select=*&status=in.(live,reserved,sold)&order=created_at.desc",
  );
  if (!Array.isArray(listings)) throw new Error("Public catalogue response is invalid.");
  return { listings, demo: false };
}
export async function currentUser(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const bearer = request.headers.get("authorization") || "";
  const token = bearer.startsWith("Bearer ")
    ? bearer.slice(7)
    : cookie
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("cmrp_session="))
        ?.slice(13);
  if (!token) throw new Error("Please sign in to continue.");
  const decoded = bearer.startsWith("Bearer ") ? token : decodeURIComponent(token);
  const user = await sb("/auth/v1/user", {}, decoded);
  return { user, token: decoded };
}
export async function staffUser(request: Request, min = 1) {
  const { user, token } = await currentUser(request);
  const rows = await sb(
    "/rest/v1/staff_profiles?user_id=eq." + user.id + "&select=*",
    {},
    token,
  );
  const staff = rows[0];
  if (!staff?.is_active || staff.security_level < min)
    throw new Error(
      "Your staff account does not have permission for this action.",
    );
  if (staff.mfa_required) {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (payload.aal !== "aal2")
      throw new Error("Multi-factor verification is required.");
  }
  return { user, token, staff };
}
