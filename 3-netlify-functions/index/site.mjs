import { getStore } from "@netlify/blobs";

const SITE = (process.env.SITE_URL || "https://cozylina.net").replace(/\/+$/, "");
const NAME = "Cozy Lina";
const STATIC = ["/", "/shop", "/stories", "/about.html", "/privacy.html", "/terms.html", "/help.html", "/contact.html"];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const plain = (h) => String(h || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);

function cleanHtml(h) {
  return String(h || "")
    .replace(/<!--\s*ad\s*-->/gi, "")
    .replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "$1=$2#$2");
}

async function load(request) {
  let articles = null;
  try {
    const data = await getStore("cozy-lina-published-content").get("published", { type: "json" });
    if (data && Array.isArray(data.articles)) {
      articles = data.articles;
      // Add stories that arrived through a later deploy (not in the published copy and not known when it was published).
      if (Array.isArray(data.baseIds)) {
        try {
          const r = await fetch(new URL("/articles.json", request.url));
          if (r.ok) {
            const d = await r.json();
            const have = new Set(articles.map((a) => a && a.id));
            const known = new Set(data.baseIds);
            const extra = (Array.isArray(d.articles) ? d.articles : []).filter((a) => a && a.id && !have.has(a.id) && !known.has(a.id));
            if (extra.length) articles = articles.concat(extra);
          }
        } catch {}
      }
    }
  } catch {}
  if (!articles) {
    try {
      const r = await fetch(new URL("/articles.json", request.url));
      if (r.ok) { const d = await r.json(); if (Array.isArray(d.articles)) articles = d.articles; }
    } catch {}
  }
  const seen = new Set();
  const list = (articles || []).filter((a) => a && a.title && a.html).map((a, i) => {
    let slug = slugify(a.id) || slugify(a.title) || "story-" + (i + 1);
    let base = slug, n = 2;
    while (seen.has(slug)) slug = base + "-" + n++;
    seen.add(slug);
    return { ...a, slug };
  });
  list.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  return list;
}

const CSS = `:root{color-scheme:light dark;--bg:#f3efe8;--tx:#3b3350;--mut:#6b6380;--ac:#6d5bc0;--line:#e4dccf}@media(prefers-color-scheme:dark){:root{--bg:#1a1530;--tx:#ede9fe;--mut:#b9aedf;--ac:#c4b5fd;--line:#4a3f73}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:21px/1.75 Georgia,"Times New Roman",serif,-apple-system,"Segoe UI",Tahoma,sans-serif}
main{max-width:68ch;margin:0 auto;padding:26px 18px 48px}a{color:var(--ac)}h1{font-size:clamp(27px,5.5vw,38px);line-height:1.2;margin:.5em 0 .3em}h2{font-size:26px;margin:1.6em 0 .4em;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.meta{color:var(--mut);font-size:15px;margin:0 0 18px}.cover{width:100%;height:auto;border-radius:16px;margin:8px 0 22px}
figure{margin:24px 0}figure img{max-width:100%;height:auto;border-radius:14px;display:block}figcaption{color:var(--mut);font-size:14px;margin-top:6px}
blockquote{margin:20px 0;padding:6px 16px;border-inline-start:4px solid var(--ac);color:var(--mut)}.q{font-style:italic;color:var(--mut)}
.dots{text-align:center;letter-spacing:.5em;color:var(--mut)}.sign{font-style:italic;margin-top:28px}.disclaimer{margin-top:32px;padding-top:14px;border-top:1px solid var(--line);font-size:14px;color:var(--mut)}
header{border-bottom:1px solid var(--line)}header div{max-width:68ch;margin:0 auto;padding:14px 18px;font-weight:800;display:flex;align-items:center;gap:10px}header img{width:30px;height:30px;border-radius:9px}header a{text-decoration:none;color:var(--tx)}
footer.site{border-top:1px solid var(--line);max-width:68ch;margin:0 auto;padding:16px 18px;font-size:14px;color:var(--mut)}
ul.list{list-style:none;padding:0}ul.list li{padding:14px 0;border-bottom:1px solid var(--line)}ul.list a{font-weight:700;font-size:20px}ul.list p{margin:.3em 0 0;color:var(--mut);font-size:16px}`;

const NAV = `<footer class="site"><a href="/">Home</a> · <a href="/stories">Stories</a> · <a href="/about.html">About</a> · <a href="/privacy.html">Privacy Policy</a> · <a href="/terms.html">Terms</a> · <a href="/help.html">Need help?</a> · <a href="/contact.html">Contact</a></footer>`;

function shell({ title, desc, path, extraHead = "", body }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta name="robots" content="index,follow">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="canonical" href="${SITE}${path}">${extraHead}<style>${CSS}</style></head><body>
<header><div><img src="/logo.svg" alt="" width="30" height="30"><a href="/">${NAME}</a></div></header>
<main>${body}</main>
${NAV}
</body></html>`;
}

const abs = (u) => (!u ? `${SITE}/og-image.jpg` : /^https?:\/\//.test(u) ? u : u.startsWith("/") ? SITE + u : `${SITE}/og-image.jpg`);

// FINDS-START
const FINDS_CSS = `.finds{--panel:#fff;--thumb1:#efe6f7;--g:#6d5bc0;--gd:#5a49a8;--oa:#fff;--em:#1f7a4d;margin:34px 0 10px;padding:22px 16px;background:var(--panel);border:1px solid var(--line);border-radius:20px;font:16px/1.55 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;color:var(--tx)}@media(prefers-color-scheme:dark){.finds{--panel:#2a2244;--thumb1:#3a2f66;--g:#c4b5fd;--gd:#a78bfa;--oa:#1a1530;--em:#6fd39a}}.finds h2{font:700 1.4rem/1.3 system-ui,sans-serif;margin:0 0 .3rem;text-align:center}.finds .sub{margin:0 0 1.2rem;text-align:center;color:var(--mut)}.fgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin:0;padding:0;list-style:none}.fcard{display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--line);border-radius:16px;overflow:hidden}.fimg{position:relative;aspect-ratio:1/1;background:var(--thumb1);display:flex;align-items:center;justify-content:center;font-size:2.2rem;color:var(--g)}.fimg img{width:100%;height:100%;object-fit:cover;display:block;margin:0;border-radius:0}.fbadge{position:absolute;top:8px;left:8px;background:var(--g);color:var(--oa);font:700 12px system-ui,sans-serif;padding:3px 9px;border-radius:999px}.fbody{display:flex;flex-direction:column;gap:6px;padding:10px 12px 14px;flex:1}.fcat{font-size:12px;color:var(--em);font-weight:700}.fname{font-size:.98rem;line-height:1.3;font-weight:700;margin:0}.fdesc{margin:0;font-size:.88rem;line-height:1.45;color:var(--mut);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.fprice{font-weight:700;font-size:.95rem}.fbtn{margin-top:auto;display:block;text-align:center;background:var(--g);color:var(--oa);text-decoration:none;font-weight:700;font-size:.92rem;padding:.7rem .6rem;border-radius:12px;min-height:44px}.fbtn:hover{background:var(--gd)}.fdisc{margin:1rem 0 0;font-size:.82rem;line-height:1.5;color:var(--mut);text-align:center}.finds .all{text-align:center;margin:.8rem 0 0}`;
const okHttps = (u) => /^https:\/\//.test(String(u || ""));
const okImgSrc = (u) => okHttps(u) || /^\/(?!\/)/.test(String(u || ""));
function pickFinds(d, a) {
  const all = (d && Array.isArray(d.products) ? d.products : []).filter((x) => x && x.enabled !== false && x.name && okHttps(x.url));
  if (!all.length) return [];
  const m = (d && d.articleTags) || {};
  let tags = m[a.id] || m[slugify(a.title)];
  if (!tags) for (const k in m) if (String(a.id).indexOf(k + "-") === 0) { tags = m[k]; break; }
  if (!tags || !tags.length) tags = ["selfcare"];
  let l = all.filter((x) => Array.isArray(x.tags) && x.tags.some((g) => tags.includes(g)));
  if (!l.length) l = all;
  if (l.length > 4) {
    let h = 0; const id = String(a.id || "");
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const o = h % l.length; l = l.slice(o).concat(l.slice(0, o));
  }
  return l.slice(0, 4);
}
function findsHtml(d, a) {
  const l = pickFinds(d, a);
  if (!l.length) return "";
  const card = (x) => `<li class="fcard"><div class="fimg">${okImgSrc(x.image) ? `<img src="${esc(x.image)}" alt="${esc(x.name)}" loading="lazy" width="300" height="300">` : "♡"}${x.badge ? `<span class="fbadge">${esc(x.badge)}</span>` : ""}</div><div class="fbody">${x.category ? `<span class="fcat">${esc(x.category)}</span>` : ""}<h3 class="fname">${esc(x.name)}</h3>${x.description ? `<p class="fdesc">${esc(x.description)}</p>` : ""}${x.price ? `<span class="fprice">${esc(x.price)}</span>` : ""}<a class="fbtn" href="${esc(x.url)}" target="_blank" rel="nofollow sponsored noopener noreferrer" aria-label="View product: ${esc(x.name)}">See details ↗</a></div></li>`;
  return `<style>${FINDS_CSS}</style><section class="finds" aria-labelledby="finds-t"><h2 id="finds-t">Cozy Lina Finds</h2><p class="sub">Little things to make your everyday life a little cozier ♡</p><ul class="fgrid">${l.map(card).join("")}</ul><p class="fdisc">Disclosure: Some links may be affiliate links. We may earn a commission if you make a purchase through these links, at no extra cost to you.</p><p class="all"><a href="/#shop">See all Cozy Lina Finds →</a></p></section>`;
}
async function loadFinds(request) {
  let d = { products: [], articleTags: {} };
  try {
    const r = await fetch(new URL("/products.json", request.url));
    if (r.ok) { const j = await r.json(); d = { products: Array.isArray(j.products) ? j.products : [], articleTags: j.articleTags || {} }; }
  } catch {}
  try {
    const data = await getStore("cozy-lina-published-content").get("published", { type: "json" });
    if (data && Array.isArray(data.products) && data.products.length) d.products = data.products;
  } catch {}
  return d;
}
// FINDS-END

const SUB_CSS = `.subs{--panel:#fff;--g:#6d5bc0;--gd:#5a49a8;--oa:#fff;margin:34px 0 10px;padding:22px 18px;background:var(--panel);border:1px solid var(--line);border-radius:20px;text-align:center;font:16px/1.55 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;color:var(--tx)}@media(prefers-color-scheme:dark){.subs{--panel:#2a2244;--g:#c4b5fd;--gd:#a78bfa;--oa:#1a1530}}.subs h2{font:700 1.3rem/1.3 system-ui,sans-serif;margin:0 0 .3rem}.subs .subd{margin:0 0 1rem;color:var(--mut)}.subs form{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.subs input[type=email]{flex:1 1 220px;min-width:0;padding:12px 14px;font:inherit;color:var(--tx);background:var(--bg);border:1px solid var(--line);border-radius:12px}.subs button{padding:12px 20px;font:700 1rem system-ui,sans-serif;color:var(--oa);background:var(--g);border:0;border-radius:12px;cursor:pointer;min-height:44px}.subs button:hover{background:var(--gd)}.subs .hp{position:absolute;left:-9999px;height:0;overflow:hidden}.subs .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.subs .subn{margin:.8rem 0 0;font-size:.8rem;color:var(--mut)}`;
function subHtml(slug) {
  return `<style>${SUB_CSS}</style><section class="subs" aria-labelledby="subs-t"><h2 id="subs-t">Get a calm story in your inbox</h2><p class="subd">One short, cozy story every now and then. No spam, and you can unsubscribe anytime.</p><form name="newsletter" method="POST" action="/thanks.html" data-netlify="true" netlify-honeypot="bot-field"><input type="hidden" name="form-name" value="newsletter"><input type="hidden" name="source" value="${esc(slug)}"><p class="hp"><label>Leave this empty: <input name="bot-field" tabindex="-1" autocomplete="off"></label></p><label class="sr" for="subs-email">Email address</label><input id="subs-email" type="email" name="email" required autocomplete="email" placeholder="Your email address"><button type="submit">Subscribe</button></form><p class="subn">By subscribing you agree to receive occasional emails from Cozy Lina. See our <a href="/privacy.html">Privacy Policy</a>.</p></section>`;
}

function articlePage(a, finds) {
  const path = "/stories/" + a.slug;
  const desc = clip(a.summary ? plain(a.summary) : plain(a.html), 155);
  const img = abs(a.image);
  const title = `${a.title} | ${NAME}`;
  const ld = { "@context": "https://schema.org", "@type": "Article", headline: a.title, description: desc, image: [img], datePublished: a.date || undefined, author: { "@type": "Person", name: "Lina" }, publisher: { "@type": "Organization", name: NAME, url: SITE + "/" }, mainEntityOfPage: SITE + path, inLanguage: "en" };
  const head = `<meta property="og:type" content="article"><meta property="og:title" content="${esc(a.title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE + path}"><meta property="og:site_name" content="${NAME}"><meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(a.title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`;
  const cover = a.image && !String(a.html || "").includes(a.image) ? `<img class="cover" src="${esc(a.image)}" alt="${esc(a.title)}" width="1100" height="733">` : "";
  const body = `<article><h1>${esc(a.title)}</h1><p class="meta">${esc([a.category, a.date].filter(Boolean).join(" · "))}</p>${cover}${withMidAd(cleanHtml(a.html))}</article>${subHtml(a.slug)}<div class="ad" style="margin:26px auto;text-align:center;overflow:hidden"><span style="display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin-bottom:6px">Advertisement</span><script async="async" data-cfasync="false" src="https://pl32122486.profitableratecpmnetwork.com/6212046c9c6be81cb88835122b7d14f8/invoke.js"></script>
<div id="container-6212046c9c6be81cb88835122b7d14f8"></div></div>${finds ? findsHtml(finds, a) : ""}<p><a href="/stories">← All stories</a></p>`;
  return shell({ title, desc, path, extraHead: head, body });
}

const MID_AD = `<div class="ad" style="margin:26px auto;text-align:center;overflow:hidden"><span style="display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin-bottom:6px">Advertisement</span><iframe title="Advertisement" scrolling="no" style="width:100%;border:0;display:block;height:250px" srcdoc="&lt;!doctype html&gt;&lt;html&gt;&lt;head&gt;&lt;meta charset=&quot;utf-8&quot;&gt;&lt;base target=&quot;_blank&quot;&gt;&lt;/head&gt;&lt;body style=&quot;margin:0;display:flex;justify-content:center&quot;&gt;&lt;script&gt;
  atOptions = {
    &#x27;key&#x27; : &#x27;fcc5b9ba90ea1d5063732a311c66b0ea&#x27;,
    &#x27;format&#x27; : &#x27;iframe&#x27;,
    &#x27;height&#x27; : 250,
    &#x27;width&#x27; : 300,
    &#x27;params&#x27; : {}
  };
&lt;/script&gt;
&lt;script src=&quot;https://www.highrevenueformat.com/fcc5b9ba90ea1d5063732a311c66b0ea/invoke.js&quot;&gt;&lt;/script&gt;&lt;/body&gt;&lt;/html&gt;"></iframe></div>`;
function withMidAd(h) {
  const parts = String(h).split("</p>"), n = parts.length - 1;
  if (n < 6) return h;
  for (const off of [0, 1, -1, 2, -2, 3, -3]) {
    const i = Math.floor((n * 2) / 3) + off;
    const head = parts.slice(0, i + 1).join("</p>") + "</p>";
    const open = (t) => (head.match(new RegExp("<" + t + "\\b", "g")) || []).length - (head.match(new RegExp("</" + t + ">", "g")) || []).length;
    if (["figure", "blockquote", "ul", "ol", "div"].every((t) => open(t) === 0)) return head + MID_AD + parts.slice(i + 1).join("</p>");
  }
  return h;
}

function indexPage(list) {
  const items = list.map((a) => `<li><a href="/stories/${a.slug}">${esc(a.title)}</a><p>${esc([a.category, a.date].filter(Boolean).join(" · "))}</p>${a.summary ? `<p>${esc(clip(plain(a.summary), 160))}</p>` : ""}</li>`).join("");
  return shell({ title: `Stories | ${NAME}`, desc: "Short, honest stories about overthinking, sleep and gentle habits from Cozy Lina.", path: "/stories", body: `<h1>Stories</h1><ul class="list">${items || "<li>No stories yet.</li>"}</ul>` });
}

function sitemap(list) {
  const urls = STATIC.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).concat(
    list.map((a) => `  <url><loc>${SITE}/stories/${a.slug}</loc>${/^\d{4}-\d{2}-\d{2}/.test(a.date || "") ? `<lastmod>${a.date.slice(0, 10)}</lastmod>` : ""}</url>`)
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

const H = (type, status = 200) => ({ status, headers: { "content-type": type, "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" } });

const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
async function media(key) {
  const m = /^[a-f0-9]{20}\.(jpg|png|webp|gif)$/.exec(key);
  if (!m) return new Response("Not found", { status: 404 });
  let body = null;
  try { body = await getStore("cozy-lina-media").get(key, { type: "arrayBuffer" }); } catch {}
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, { status: 200, headers: { "content-type": MIME[m[1]], "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}

export default async (request, context) => {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  if (pathname.startsWith("/media/")) return media(pathname.slice(7));
  const list = await load(request);
  if (pathname === "/sitemap.xml") return new Response(sitemap(list), H("application/xml; charset=utf-8"));
  if (pathname === "/stories") return new Response(indexPage(list), H("text/html; charset=utf-8"));
  const slug = (context && context.params && context.params.slug) || pathname.split("/").pop();
  const a = list.find((x) => x.slug === slug);
  if (!a) return new Response(shell({ title: `Story not found | ${NAME}`, desc: "This story could not be found.", path: "/stories", body: `<h1>Story not found</h1><p><a href="/stories">Browse all stories</a></p>` }).replace('content="index,follow"', 'content="noindex"'), H("text/html; charset=utf-8", 404));
  return new Response(articlePage(a, await loadFinds(request)), H("text/html; charset=utf-8"));
};

export const config = { path: ["/stories", "/stories/:slug", "/sitemap.xml", "/media/:key"] };
