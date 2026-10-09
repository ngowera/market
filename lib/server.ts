import { samples, type Listing } from "./catalog";
export function config() {
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY,
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
  if (!config().url || !config().key) return { listings: samples, demo: true };
  try {
    const listings = await sb(
      "/rest/v1/public_catalog?select=*&status=in.(live,reserved,sold)&order=created_at.desc",
    );
    if (!Array.isArray(listings) || listings.length === 0) {
      return { listings: samples, demo: true };
    }
    return { listings, demo: false };
  } catch (error) {
    if ((error as {code?: string}).code === "PGRST205")
      return { listings: samples, demo: true };
    throw error;
  }
}
export async function currentUser(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const token = cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("cmrp_session="))
    ?.slice(13);
  if (!token) throw new Error("Please sign in to continue.");
  const user = await sb("/auth/v1/user", {}, decodeURIComponent(token));
  return { user, token: decodeURIComponent(token) };
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
  if (staff.security_level >= 3) {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (payload.aal !== "aal2")
      throw new Error("Multi-factor verification is required.");
  }
  return { user, token, staff };
}
