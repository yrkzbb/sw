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
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
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

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", contentType);
  res.end(text);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").map((part) => {
      const index = part.indexOf("=");
      if (index < 0) return ["", ""];
      return [
        decodeURIComponent(part.slice(0, index).trim()),
        decodeURIComponent(part.slice(index + 1).trim()),
      ];
    }).filter(([key]) => key)
  );
}

function setSessionCookie(res, sessionId, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  res.setHeader("Set-Cookie", [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`,
  ]);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", [
    `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`,
  ]);
}

function normalizeUsername(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 32);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 120);
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.username,
    email: row.email,
    role: row.role || "user",
    status: row.status || "active",
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    lastLoginAt: row.last_login_at instanceof Date ? row.last_login_at.toISOString() : row.last_login_at,
  };
}

function publicUserWithProfile(row, profile = null) {
  return {
    ...publicUser(row),
    profile: normalizeAccountProfile(profile),
  };
}

function normalizeAccountProfile(profile = {}) {
  const source = profile && typeof profile === "object" ? profile : {};
  const avatarInitial = String(source.avatarInitial || "")
    .trim()
    .slice(0, 2)
    .toUpperCase();
  const bio = String(source.bio || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const accent = String(source.accent || "teal").trim();
  const theme = String(source.theme || "system").trim();
  const defaultPage = String(source.defaultPage || "chat").trim();
  const replyStyle = String(source.replyStyle || "").trim().replace(/\s+/g, " ").slice(0, 180);
  const allowedAccents = new Set(["teal", "blue", "violet", "gold", "rose"]);
  const allowedThemes = new Set(["system", "light", "dark"]);
  const allowedPages = new Set(["chat", "profile", "resource", "storage"]);
  return {
    avatarInitial,
    bio,
    accent: allowedAccents.has(accent) ? accent : "teal",
    theme: allowedThemes.has(theme) ? theme : "system",
    defaultPage: allowedPages.has(defaultPage) ? defaultPage : "chat",
    replyStyle,
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 48, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const actual = Buffer.from(hash, "hex");
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function createSession(pool, userId, res) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO ${tableName("sessions")} (id, user_id, expires_at) VALUES (?, ?, ?)`,
    [sessionId, userId, expiresAt]
  );
  setSessionCookie(res, sessionId, expiresAt);
}

async function getCurrentUser(req) {
  const sessionId = parseCookies(req)[SESSION_COOKIE];
  if (!sessionId) return null;
  const pool = await getMysql();
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.email, u.role, u.status, u.created_at, u.last_login_at
       FROM ${tableName("sessions")} s
       JOIN ${tableName("users")} u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > NOW() AND u.status = 'active'
      LIMIT 1`,
    [sessionId]
  );
  if (!rows.length) return null;
  return rows[0];
}

async function requireUser(req, res) {
  try {
    const user = await getCurrentUser(req);
    if (user) return user;
    sendJson(res, 401, { error: AUTH_REQUIRED_MESSAGE });
    return null;
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
    return null;
  }
}

async function requireAdmin(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.role === "admin") return user;
  sendJson(res, 403, { error: ADMIN_REQUIRED_MESSAGE });
  return null;
}

function validateAuthInput({ username, email, password, confirmPassword }, mode) {
  if (mode === "register") {
    if (!username || !email || !password) return "请填写用户名、邮箱和密码。";
    if (username.length < 2) return "用户名至少需要 2 个字符。";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "请输入有效邮箱。";
    if (password.length < 8) return "正式版密码至少需要 8 位。";
    if (confirmPassword !== undefined && password !== confirmPassword) return "两次输入的密码不一致。";
  } else if (!username || !password) {
    return "请输入账号和密码。";
  }
  return "";
}

