import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization"
  }
});

export default async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization"
  }});

  const store = getStore("cozy-lina-published-content");
  if (request.method === "GET") {
    // Authenticated backup download: ?backup=1 returns the version that was live before the latest publish.
    if (new URL(request.url).searchParams.get("backup")) {
      const exp = process.env.COZY_LINA_ADMIN_TOKEN;
      const au = request.headers.get("authorization") || "";
      const sp = au.startsWith("Bearer ") ? au.slice(7) : "";
      if (!exp || exp.length < 24 || !sp || sp.length !== exp.length || !safeEqual(sp, exp)) return json({ error: "Unauthorized" }, 401);
      try {
        const prevData = await store.get("published-previous", { type: "json" });
        if (!prevData) return json({ error: "No previous version stored yet" }, 404);
        return json(prevData);
      } catch (error) {
        return json({ error: "Backup unavailable" }, 404);
      }
    }
    try {
      const data = await store.get("published", { type: "json" });
      if (!data || !Array.isArray(data.articles)) return json({ error: "No published content yet" }, 404);
      return json(data);
    } catch (error) {
      return json({ error: "Published content unavailable" }, 404);
    }
  }

  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const expected = process.env.COZY_LINA_ADMIN_TOKEN;
  if (!expected || expected.length < 24) return json({ error: "Server publishing token is not configured" }, 503);
  const auth = request.headers.get("authorization") || "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!supplied || supplied.length !== expected.length || !safeEqual(supplied, expected)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let data;
  try {
    const raw = await request.text();
    if (raw.length > 4_500_000) return json({ error: "Payload too large (max 4.5 MB)" }, 413);
    data = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!data || !Array.isArray(data.articles) || data.articles.length > 500) {
    return json({ error: "Content must contain an articles array (max 500 articles)" }, 400);
  }
  for (const article of data.articles) {
    if (!article || typeof article.title !== "string" || typeof article.html !== "string") {
      return json({ error: "Each article needs a title and HTML body" }, 400);
    }
  }
  for (const article of data.articles) article.html = cleanArticleHtml(article.html);
  let imagesMoved = 0;
  try {
    imagesMoved = await moveImagesToMedia(data);
  } catch (error) {
    const tooBig = error && error.message === "image too large";
    return json({ error: tooBig ? "An image is larger than 3 MB. Please compress it." : "Could not process the images" }, tooBig ? 413 : 400);
  }
  let products;
  if (Array.isArray(data.products)) {
    if (data.products.length > 300) return json({ error: "Max 300 products" }, 400);
    for (const x of data.products) {
      if (!x || typeof x.name !== "string" || typeof x.url !== "string" || !/^https:\/\//.test(x.url)) {
        return json({ error: "Each product needs a name and an https link" }, 400);
      }
    }
    products = data.products.map((x) => ({ ...x, image: okImage(x.image) ? x.image : "" }));
  } else {
    try {
      const prev = await store.get("published", { type: "json" });
      if (prev && Array.isArray(prev.products)) products = prev.products;
    } catch {}
  }
  // Remember which items the deployed files already contained, so items added later through a new
  // deploy (a new zip or git push) are not hidden by this published copy.
  let baseIds, baseProductIds;
  try {
    const r = await fetch(new URL("/articles.json", request.url));
    if (r.ok) { const d = await r.json(); if (Array.isArray(d.articles)) baseIds = d.articles.map((a) => a && a.id).filter(Boolean); }
  } catch {}
  try {
    const r = await fetch(new URL("/products.json", request.url));
    if (r.ok) { const d = await r.json(); if (Array.isArray(d.products)) baseProductIds = d.products.map((p) => p && p.id).filter(Boolean); }
  } catch {}
  const payload = {
    products,
    baseIds,
    baseProductIds,
    articles: data.articles,
    settings: data.settings && typeof data.settings === "object" ? data.settings : {},
    publishedAt: new Date().toISOString()
  };
  try {
    try {
      const current = await store.get("published", { type: "json" });
      if (current && Array.isArray(current.articles)) await store.setJSON("published-previous", current);
    } catch {}
    await store.setJSON("published", payload);
    return json({ ok: true, publishedAt: payload.publishedAt, articleCount: payload.articles.length, imagesMoved });
  } catch (error) {
    return json({ error: "Could not save published content" }, 500);
  }
};

// Server-side clean-up of article HTML (defence in depth: the site also cleans it when rendering).
function cleanArticleHtml(h) {
  return String(h || "")
    .replace(/<(script|style|iframe|object|embed|form)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "$1=$2#$2");
}

function okImage(u) {
  return typeof u === "string" && (u === "" || /^https:\/\//.test(u) || /^\/(?!\/)/.test(u) || /^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(u));
}

function safeEqual(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Moves embedded base64 images (in any string of the payload) into Netlify Blobs
// and replaces them with short /media/<hash>.<ext> URLs served by site.mjs.
const IMG = /data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+\/=]+)/g;
const MAX_IMG = 3_000_000;

function looksLikeImage(b, ext) {
  if (ext === "jpg") return b[0] === 0xff && b[1] === 0xd8;
  if (ext === "png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (ext === "gif") return b.slice(0, 3).toString("latin1") === "GIF";
  if (ext === "webp") return b.slice(0, 4).toString("latin1") === "RIFF" && b.slice(8, 12).toString("latin1") === "WEBP";
  return false;
}

async function moveImagesToMedia(root) {
  const media = getStore("cozy-lina-media");
  const done = new Map();
  async function convert(str) {
    const found = [...str.matchAll(IMG)];
    let out = str;
    for (const m of found) {
      const full = m[0];
      if (!done.has(full)) {
        const bytes = Buffer.from(m[2], "base64");
        if (bytes.length > MAX_IMG) throw new Error("image too large");
        const ext = m[1] === "jpeg" ? "jpg" : m[1];
        if (!looksLikeImage(bytes, ext)) throw new Error("not an image");
        const key = createHash("sha256").update(bytes).digest("hex").slice(0, 20) + "." + ext;
        await media.set(key, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        done.set(full, "/media/" + key);
      }
      out = out.split(full).join(done.get(full));
    }
    return out;
  }
  async function walk(node) {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (typeof node[i] === "string") node[i] = await convert(node[i]);
        else if (node[i] && typeof node[i] === "object") await walk(node[i]);
      }
    } else if (node && typeof node === "object") {
      for (const k of Object.keys(node)) {
        if (typeof node[k] === "string") node[k] = await convert(node[k]);
        else if (node[k] && typeof node[k] === "object") await walk(node[k]);
      }
    }
  }
  await walk(root);
  return done.size;
}
