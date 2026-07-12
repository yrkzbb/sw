const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");

const ROOT_DIR = path.join(__dirname, "..");
const JSON_UTF8 = "application/json; charset=utf-8";

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const BODY_LIMIT = 10 * 1024 * 1024;
const OPENAI_PROXY_BASE_URL = (
  process.env.OPENAI_PROXY_BASE_URL ||
  "https://api.openai-proxy.org/v1"
).replace(/\/+$/, "");
const OPENAI_PROXY_CHAT_ENDPOINT = `${OPENAI_PROXY_BASE_URL}/chat/completions`;

function loadDotEnv() {
  const envPath = path.join(ROOT_DIR, ".env");
  if (!fs.existsSync(envPath)) return;

  const text = fs.readFileSync(envPath, "utf-8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function loadApiKey() {
  const fromOpenAiEnv = process.env.OPENAI_PROXY_API_KEY?.trim();
  if (fromOpenAiEnv) return fromOpenAiEnv;
  const fromEnv = process.env.LINGXI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    const keyPath = path.join(ROOT_DIR, "lingxi-key.txt");
    if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, "utf-8").trim();
  } catch {
    /* ignore */
  }
  return "";
}

const LINGXI_API_KEY = loadApiKey();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function safeJoin(base, targetPath) {
  const rel = String(targetPath).replace(/^\/+/, "");
  const target = path.normalize(path.join(base, rel));
  return target.startsWith(base) ? target : null;
}

function readJsonBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw.trim() ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", JSON_UTF8);
  res.end(JSON.stringify(data));
}

function copyUpstreamHeaders(upstream, res) {
  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "content-length") res.setHeader(key, value);
  });
  if (!res.getHeader("Content-Type")) {
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "text/event-stream");
  }
}

async function proxyChat(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!LINGXI_API_KEY) {
    sendJson(res, 500, {
      error:
        "Missing OPENAI_PROXY_API_KEY. Set it in .env or as an environment variable.",
    });
    return;
  }

  const controller = new AbortController();
  req.on("aborted", () => controller.abort());
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;

  let upstream;
  try {
    upstream = await fetch(OPENAI_PROXY_CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINGXI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (!res.headersSent) {
      const message = controller.signal.aborted
        ? "Request aborted"
        : `Proxy request failed: ${String(e?.message || e)}`;
      sendJson(res, controller.signal.aborted ? 499 : 502, { error: message });
    }
    return;
  }

  copyUpstreamHeaders(upstream, res);

  const webBody = upstream.body;
  if (!webBody) {
    res.end((await upstream.text().catch(() => "")) || "");
    return;
  }

  await pipeline(Readable.fromWeb(webBody), res).catch(() => {});
}

function serveStatic(req, res, pathname) {
  const reqPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = safeJoin(ROOT_DIR, decodeURIComponent(reqPath));
  if (!filePath) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }
    res.setHeader("Content-Type", getMimeType(filePath));
    const rs = fs.createReadStream(filePath);
    rs.on("error", () => {
      res.statusCode = 500;
      res.end("Read Error");
    });
    rs.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/api/chat" && (req.method === "POST" || req.method === "OPTIONS")) {
      void proxyChat(req, res);
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch {
    res.statusCode = 400;
    res.end("Bad Request");
  }
});

server.listen(PORT, () => {
  console.log(`[lingxi] Server listening on http://localhost:${PORT}`);
  console.log(`[lingxi] Proxy base URL: ${OPENAI_PROXY_BASE_URL}`);
  console.log(`[lingxi] Run from lingxi folder: node js/server.js`);
});
