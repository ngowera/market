import { GET, POST } from "../../../app/api/[...path]/route.ts";

const runtime = (
  globalThis as typeof globalThis & {
    Deno: {
      env: { get: (name: string) => string | undefined };
      serve: (handler: (request: Request) => Promise<Response>) => unknown;
    };
  }
).Deno;
const apiPrefix = "/functions/v1/api";
const allowedOrigin = runtime.env.get("ALLOWED_ORIGIN") as string | undefined;

function withCors(response: Response, origin: string | null) {
  const headers = new Headers(response.headers);
  if (origin && origin === allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin!);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "authorization, apikey, content-type, x-cmrp-api-client, x-cmrp-refresh-token, signature",
    );
    headers.set("Access-Control-Max-Age", "600");
    headers.append("Vary", "Origin");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

runtime.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (!allowedOrigin || origin !== allowedOrigin)
      return new Response(null, { status: 403 });
    return withCors(new Response(null), origin);
  }
  if (origin && origin !== allowedOrigin)
    return withCors(
      new Response(JSON.stringify({ error: "Cross-origin request rejected" }), {
        status: 403,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }),
      origin,
    );

  const url = new URL(request.url);
  const routePath = url.pathname.startsWith(apiPrefix)
    ? url.pathname.slice(apiPrefix.length)
    : url.pathname.replace(/^\/api(?=\/|$)/, "");
  const path = routePath.replace(/^\/+|\/+$/g, "");
  const params = Promise.resolve({ path: path ? path.split("/") : [] });
  const response =
    request.method === "GET"
      ? await GET(request, { params })
      : request.method === "POST"
        ? await POST(request, { params })
        : new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          });
  return withCors(response, origin);
});