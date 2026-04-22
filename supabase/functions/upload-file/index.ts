// upload-file — posts a file into the matching wadeos-* folder on Google Drive.
//
// Frontend calls this with a FormData body:
//   file:     Blob
//   filename: string
//   category: one of CATEGORIES (below). Picks which Drive folder to drop into.
//
// Returns { id, webViewLink } — store `id` in your DB row; build the read URL
// via the sibling `get-file` function.
//
// Deploy with verify_jwt: true (the anon-key-in-body auth is fine; verify_jwt
// just stops anonymous curls from hammering this). See deploy checklist below.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Each category maps to a Supabase Secret holding that folder's Drive id.
// Keep in sync with the WadeOS Drive root: wadeos-chat-images, wadeos-chat-files,
// wadeos-voice, wadeos-social, wadeos-avatars, wadeos-capsules.
const CATEGORY_ENV: Record<string, string> = {
  chat_image: "GDRIVE_FOLDER_CHAT_IMAGES",
  chat_file: "GDRIVE_FOLDER_CHAT_FILES",
  voice: "GDRIVE_FOLDER_VOICE",
  social: "GDRIVE_FOLDER_SOCIAL",
  avatar: "GDRIVE_FOLDER_AVATARS",
  capsule: "GDRIVE_FOLDER_CAPSULES",
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
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: CORS });
  }
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const filename = form.get("filename") as string | null;
    const category = (form.get("category") as string | null) || "";
    if (!file || !filename) {
      return new Response(
        JSON.stringify({ error: "missing file or filename" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
    const envKey = CATEGORY_ENV[category];
    if (!envKey) {
      return new Response(
        JSON.stringify({ error: `unknown category: ${category}` }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
    const folderId = Deno.env.get(envKey);
    if (!folderId) {
      return new Response(
        JSON.stringify({ error: `missing secret: ${envKey}` }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const token = await getAccessToken();
    const boundary = "----upload" + crypto.randomUUID();
    const metadata = { name: filename, parents: [folderId] };
    const head = new TextEncoder().encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(metadata) + `\r\n` +
        `--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
    );
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const tail = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);
    const body = new Uint8Array(head.length + fileBytes.length + tail.length);
    body.set(head, 0);
    body.set(fileBytes, head.length);
    body.set(tail, head.length + fileBytes.length);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    const uploadText = await uploadRes.text();
    let uploaded: Record<string, unknown> = {};
    try { uploaded = JSON.parse(uploadText); } catch { /* noop */ }
    if (!uploadRes.ok || !uploaded.id) {
      return new Response(
        JSON.stringify({
          error: "upload failed",
          status: uploadRes.status,
          detail: uploadText.slice(0, 500),
        }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ id: uploaded.id, webViewLink: uploaded.webViewLink }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message || e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
