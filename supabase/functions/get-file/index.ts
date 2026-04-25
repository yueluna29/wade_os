// get-file — streams a Google Drive file's bytes back through the Edge so
// browser <img src> / <audio src> can load it without needing an OAuth token.
//
// GET /functions/v1/get-file?id=<drive-file-id>
// Deploy with verify_jwt: FALSE — browsers can't attach Authorization headers
// to <img>/<audio>. Security: file id is the only thing needed to read, but
// Drive file ids are ~33 random chars so they're not guessable, and the app
// only exposes ids stored in our own DB rows (which have RLS).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

async function getAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
    client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
    refresh_token: Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN")!,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("refresh failed: " + JSON.stringify(data));
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") {
    return new Response("method not allowed", { status: 405, headers: CORS });
  }
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id || !/^[a-zA-Z0-9_-]{10,100}$/.test(id)) {
      return new Response("invalid id", { status: 400, headers: CORS });
    }
    const token = await getAccessToken();
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!driveRes.ok) {
      return new Response("drive fetch failed: " + driveRes.status, {
        status: driveRes.status,
        headers: CORS,
      });
    }
    return new Response(driveRes.body, {
      headers: {
        ...CORS,
        "Content-Type": driveRes.headers.get("Content-Type") || "application/octet-stream",
        // Drive file ids are immutable — replacing an avatar produces a new
        // id, so the URL changes too. Safe to cache aggressively (30 days +
        // immutable hint) which lets the browser AND any CDN in front of
        // this skip the network entirely on repeat loads. The previous
        // 1h max-age meant Luna's avatar redownloaded every hour.
        "Cache-Control": "public, max-age=2592000, immutable",
      },
    });
  } catch (e) {
    return new Response(String((e as Error)?.message || e), { status: 500, headers: CORS });
  }
});
