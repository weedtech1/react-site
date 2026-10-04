import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const API = "https://api-faa.my.id/faa/react-channel";

app.set("trust proxy", 1);
app.use(express.static(path.join(__dirname, "public")));

// Limit senp: 5 demann pa minit pou chak IP
const hits = new Map();
function limiter(req, res, next) {
  const now = Date.now();
  const arr = (hits.get(req.ip) || []).filter((t) => now - t < 60_000);
  if (arr.length >= 5) {
    return res.status(429).json({ error: "Twòp demann. Tann yon ti moman epi eseye ankò." });
  }
  arr.push(now);
  hits.set(req.ip, arr);
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of hits) {
    const fresh = arr.filter((t) => now - t < 60_000);
    fresh.length ? hits.set(ip, fresh) : hits.delete(ip);
  }
}, 60_000).unref();

const CHANNEL_RE = /^https:\/\/whatsapp\.com\/channel\/[A-Za-z0-9_-]+\/\d+$/;

app.get("/react", limiter, async (req, res) => {
  const link = String(req.query.link || "").trim();
  const emoji = String(req.query.emoji || "").trim();

  if (!CHANNEL_RE.test(link)) {
    return res.status(400).json({
      error: "Lyen an pa bon. Fòma: https://whatsapp.com/channel/XXXX/123",
    });
  }
  if (!emoji || [...emoji].length > 4) {
    return res.status(400).json({ error: "Chwazi yon emoji." });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(
      `${API}?url=${encodeURIComponent(link)}&react=${encodeURIComponent(emoji)}`,
      { signal: ctrl.signal }
    );
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 300) }; }
    res.status(r.ok ? 200 : 502).json(data);
  } catch {
    res.status(504).json({ error: "API a pa reponn. Eseye ankò pita." });
  } finally {
    clearTimeout(timer);
  }
});

app.listen(PORT, () => console.log(`Sit la mache sou http://localhost:${PORT}`));
