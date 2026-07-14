const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");
const crypto = require("crypto");

const ROOT_DIR = path.join(__dirname, "..");
const JSON_UTF8 = "application/json; charset=utf-8";

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const BODY_LIMIT = 10 * 1024 * 1024;
const SESSION_COOKIE = "wenjie_session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 14);
const AUTH_REQUIRED_MESSAGE = "请先登录。";
const ADMIN_REQUIRED_MESSAGE = "需要管理员权限。";
const USER_DATA_KEYS = {
  messages: "LINGXI_MESSAGES",
  profile: "LINGXI_STUDENT_PROFILE",
  resources: "LINGXI_LEARNING_RESOURCES",
  mistakes: "LINGXI_MISTAKE_BOOK",
  pathLibrary: "LINGXI_LEARNING_PATH_LIBRARY",
};
const OPENAI_PROXY_BASE_URL = (
  process.env.OPENAI_PROXY_BASE_URL ||
  "https://api.openai-proxy.org/v1"
).replace(/\/+$/, "");
const OPENAI_PROXY_CHAT_ENDPOINT = `${OPENAI_PROXY_BASE_URL}/chat/completions`;
const VIDEO_API_URL = (process.env.LINGXI_VIDEO_API_URL || "").trim();
const VIDEO_API_KEY = (process.env.LINGXI_VIDEO_API_KEY || "").trim();
const VIDEO_PROVIDER = (process.env.VIDEO_PROVIDER || "dashscope_wan").trim();
const DASHSCOPE_API_KEY = (process.env.DASHSCOPE_API_KEY || "").trim();
const DASHSCOPE_WORKSPACE_ID = (process.env.DASHSCOPE_WORKSPACE_ID || "").trim();
const DASHSCOPE_REGION = (process.env.DASHSCOPE_REGION || "cn-beijing").trim();
const DASHSCOPE_VIDEO_MODEL = (process.env.DASHSCOPE_VIDEO_MODEL || "wan2.5-t2v-preview").trim();
const DASHSCOPE_VIDEO_RESOLUTION = (process.env.DASHSCOPE_VIDEO_RESOLUTION || "480P").trim();
const DASHSCOPE_VIDEO_DURATION = Number(process.env.DASHSCOPE_VIDEO_DURATION || 5);
const MYSQL_TABLE_PREFIX = (process.env.MYSQL_TABLE_PREFIX || "wj_").replace(/[^\w]/g, "") || "wj_";
const DATABASE_URL = (process.env.DATABASE_URL || "").trim();
const MYSQL_SOCKET = (process.env.MYSQL_SOCKET || "").trim();
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "wenjie",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
  queueLimit: 0,
};
if (MYSQL_SOCKET) {
  MYSQL_CONFIG.socketPath = MYSQL_SOCKET;
  delete MYSQL_CONFIG.host;
  delete MYSQL_CONFIG.port;
}

let mysqlPool = null;
let mysqlInitPromise = null;

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

function hasDatabaseConfig() {
  return !!DATABASE_URL || !!process.env.MYSQL_DATABASE || !!process.env.MYSQL_USER;
}

async function getMysql() {
  if (!hasDatabaseConfig()) {
    throw new Error("Missing MySQL config. Set DATABASE_URL or MYSQL_* in .env.");
  }
  if (!mysqlPool) {
    let mysql;
    try {
      mysql = require("mysql2/promise");
    } catch {
      throw new Error("Missing dependency mysql2. Run npm install first.");
    }
    mysqlPool = DATABASE_URL
      ? mysql.createPool(`${DATABASE_URL}${DATABASE_URL.includes("?") ? "&" : "?"}charset=utf8mb4`)
      : mysql.createPool(MYSQL_CONFIG);
  }
  if (!mysqlInitPromise) mysqlInitPromise = initMysqlSchema(mysqlPool);
  await mysqlInitPromise;
  return mysqlPool;
}

function tableName(name) {
  return `\`${MYSQL_TABLE_PREFIX}${name}\``;
}

async function initMysqlSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName("users")} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(64) NOT NULL,
      email VARCHAR(160) NOT NULL,
      password_salt VARCHAR(64) NOT NULL,
      password_hash VARCHAR(160) NOT NULL,
      role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
      status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
      last_login_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_username (username),
      UNIQUE KEY uniq_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName("sessions")} (
      id CHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_user_id (user_id),
      KEY idx_expires_at (expires_at),
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}sessions_user
        FOREIGN KEY (user_id) REFERENCES ${tableName("users")} (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName("user_data")} (
      user_id BIGINT UNSIGNED NOT NULL,
      data_key VARCHAR(128) NOT NULL,
      data_value LONGTEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, data_key),
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}user_data_user
        FOREIGN KEY (user_id) REFERENCES ${tableName("users")} (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureUserColumn(pool, "role", "ENUM('user', 'admin') NOT NULL DEFAULT 'user'");
  await ensureUserColumn(pool, "status", "ENUM('active', 'disabled') NOT NULL DEFAULT 'active'");
  await ensureUserColumn(pool, "last_login_at", "DATETIME NULL");
  await bootstrapAdminUser(pool);
}

async function ensureUserColumn(pool, columnName, definition) {
  const table = `${MYSQL_TABLE_PREFIX}users`;
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
      LIMIT 1`,
    [table, columnName]
  );
  if (rows.length) return;
  await pool.query(`ALTER TABLE ${tableName("users")} ADD COLUMN ${columnName} ${definition}`);
}

async function bootstrapAdminUser(pool) {
  const username = normalizeUsername(process.env.ADMIN_BOOTSTRAP_USERNAME || "");
  const email = normalizeEmail(process.env.ADMIN_BOOTSTRAP_EMAIL || "");
  const password = String(process.env.ADMIN_BOOTSTRAP_PASSWORD || "");
  if (!username || !email || !password) return;

  const [rows] = await pool.query(
    `SELECT id, role FROM ${tableName("users")} WHERE username = ? OR email = ? LIMIT 1`,
    [username, email]
  );
  if (rows.length) {
    if (rows[0].role !== "admin") {
      await pool.query(`UPDATE ${tableName("users")} SET role = 'admin', status = 'active' WHERE id = ?`, [rows[0].id]);
    }
    return;
  }

  const passwordData = hashPassword(password);
  await pool.query(
    `INSERT INTO ${tableName("users")} (username, email, password_salt, password_hash, role, status)
     VALUES (?, ?, ?, ?, 'admin', 'active')`,
    [username, email, passwordData.salt, passwordData.hash]
  );
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

async function registerUser(req, res) {
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;

  const username = normalizeUsername(body.username || body.name);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const confirmPassword = body.confirmPassword == null ? undefined : String(body.confirmPassword || "");
  const inputError = validateAuthInput({ username, email, password, confirmPassword }, "register");
  if (inputError) {
    sendJson(res, 400, { error: inputError });
    return;
  }

  try {
    const pool = await getMysql();
    const [existing] = await pool.query(
      `SELECT id FROM ${tableName("users")} WHERE username = ? OR email = ? LIMIT 1`,
      [username, email]
    );
    if (existing.length) {
      sendJson(res, 409, { error: "用户名或邮箱已经注册，请直接登录。" });
      return;
    }
    const passwordData = hashPassword(password);
    const [result] = await pool.query(
      `INSERT INTO ${tableName("users")} (username, email, password_salt, password_hash) VALUES (?, ?, ?, ?)`,
      [username, email, passwordData.salt, passwordData.hash]
    );
    const [rows] = await pool.query(
      `SELECT id, username, email, role, status, created_at, last_login_at FROM ${tableName("users")} WHERE id = ? LIMIT 1`,
      [result.insertId]
    );
    await createSession(pool, result.insertId, res);
    sendJson(res, 201, { user: publicUser(rows[0]) });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function loginUser(req, res) {
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;

  const rawAccount = String(body.account || body.username || body.email || "");
  const account = normalizeUsername(rawAccount);
  const accountEmail = normalizeEmail(rawAccount);
  const password = String(body.password || "");
  const inputError = validateAuthInput({ username: account, password }, "login");
  if (inputError) {
    sendJson(res, 400, { error: inputError });
    return;
  }

  try {
    const pool = await getMysql();
    const [rows] = await pool.query(
      `SELECT id, username, email, password_salt, password_hash, role, status, created_at, last_login_at
         FROM ${tableName("users")}
        WHERE username = ? OR email = ?
        LIMIT 1`,
      [account, accountEmail]
    );
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
      sendJson(res, 401, { error: "账号或密码不正确。" });
      return;
    }
    if (user.status !== "active") {
      sendJson(res, 403, { error: "该账号已被禁用，请联系管理员。" });
      return;
    }
    await pool.query(`UPDATE ${tableName("users")} SET last_login_at = NOW() WHERE id = ?`, [user.id]);
    user.last_login_at = new Date();
    await createSession(pool, user.id, res);
    sendJson(res, 200, { user: publicUser(user) });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function logoutUser(req, res) {
  try {
    const sessionId = parseCookies(req)[SESSION_COOKIE];
    if (sessionId) {
      const pool = await getMysql();
      await pool.query(`DELETE FROM ${tableName("sessions")} WHERE id = ?`, [sessionId]);
    }
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true });
  } catch (e) {
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true, warning: String(e?.message || e) });
  }
}

async function getAuthMe(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  sendJson(res, 200, { user: publicUser(user) });
}

async function getUserData(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const pool = await getMysql();
    const [rows] = await pool.query(
      `SELECT data_key, data_value FROM ${tableName("user_data")} WHERE user_id = ?`,
      [user.id]
    );
    const data = {};
    rows.forEach((row) => {
      data[row.data_key] = row.data_value;
    });
    sendJson(res, 200, { data });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function saveUserData(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;
  const key = String(body.key || "").trim();
  if (!key || key.length > 128) {
    sendJson(res, 400, { error: "数据键无效。" });
    return;
  }
  const value = String(body.value ?? "");
  try {
    const pool = await getMysql();
    await pool.query(
      `INSERT INTO ${tableName("user_data")} (user_id, data_key, data_value)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data_value = VALUES(data_value), updated_at = CURRENT_TIMESTAMP`,
      [user.id, key, value]
    );
    sendJson(res, 200, { ok: true });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function deleteUserData(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;
  const key = String(body.key || "").trim();
  if (!key || key.length > 128) {
    sendJson(res, 400, { error: "数据键无效。" });
    return;
  }
  try {
    const pool = await getMysql();
    await pool.query(
      `DELETE FROM ${tableName("user_data")} WHERE user_id = ? AND data_key = ?`,
      [user.id, key]
    );
    sendJson(res, 200, { ok: true });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

function parseStoredJson(value, fallback) {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return fallback;
  }
}

function summarizeUserData(rows) {
  const dataByKey = new Map(rows.map((row) => [row.data_key, row.data_value]));
  const messages = parseStoredJson(dataByKey.get(USER_DATA_KEYS.messages), []);
  const mistakes = parseStoredJson(dataByKey.get(USER_DATA_KEYS.mistakes), []);
  const resourcesData = parseStoredJson(dataByKey.get(USER_DATA_KEYS.resources), null);
  const pathLibrary = parseStoredJson(dataByKey.get(USER_DATA_KEYS.pathLibrary), {});
  const profile = parseStoredJson(dataByKey.get(USER_DATA_KEYS.profile), null);
  const directResources = Array.isArray(resourcesData?.resources) ? resourcesData.resources.length : 0;
  const libraryResources = Object.values(pathLibrary || {}).reduce((sum, item) => {
    return sum + (Array.isArray(item?.resources) ? item.resources.length : 0);
  }, 0);
  const profileGenerated = !!profile && Object.entries(profile).some(([key, value]) => {
    if (key === "last_updated_reason") return false;
    return !!String(value?.value || value?.evidence || "").trim();
  });
  const dataBytes = rows.reduce((sum, row) => sum + Buffer.byteLength(String(row.data_value || ""), "utf8"), 0);
  return {
    conversationCount: Array.isArray(messages) ? messages.filter((item) => item?.role === "user").length : 0,
    messageCount: Array.isArray(messages) ? messages.length : 0,
    mistakeCount: Array.isArray(mistakes) ? mistakes.length : 0,
    resourceCount: directResources + libraryResources,
    profileGenerated,
    dataKeyCount: rows.length,
    dataBytes,
    lastDataUpdatedAt: rows.reduce((latest, row) => {
      const value = row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at;
      return !latest || (value && String(value) > String(latest)) ? value : latest;
    }, ""),
  };
}

function adminPublicUser(row, dataRows = []) {
  return {
    ...publicUser(row),
    overview: summarizeUserData(dataRows),
  };
}

async function getUserDataRows(pool, userIds) {
  if (!userIds.length) return new Map();
  const placeholders = userIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT user_id, data_key, data_value, updated_at
       FROM ${tableName("user_data")}
      WHERE user_id IN (${placeholders})`,
    userIds
  );
  const byUser = new Map(userIds.map((id) => [String(id), []]));
  rows.forEach((row) => {
    const id = String(row.user_id);
    if (!byUser.has(id)) byUser.set(id, []);
    byUser.get(id).push(row);
  });
  return byUser;
}

async function adminGetMe(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  sendJson(res, 200, { user: publicUser(admin) });
}

async function adminListUsers(req, res, url) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const pool = await getMysql();
    const q = String(url.searchParams.get("q") || "").trim();
    const status = String(url.searchParams.get("status") || "").trim();
    const params = [];
    const where = [];
    if (q) {
      where.push("(username LIKE ? OR email LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }
    if (status === "active" || status === "disabled") {
      where.push("status = ?");
      params.push(status);
    }
    const [users] = await pool.query(
      `SELECT id, username, email, role, status, created_at, last_login_at, updated_at
         FROM ${tableName("users")}
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY created_at DESC
        LIMIT 500`,
      params
    );
    const dataRows = await getUserDataRows(pool, users.map((user) => user.id));
    sendJson(res, 200, {
      users: users.map((user) => adminPublicUser(user, dataRows.get(String(user.id)) || [])),
    });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminCreateUser(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;

  const username = normalizeUsername(body.username || body.name);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const role = String(body.role || "user").trim() === "admin" ? "admin" : "user";
  const status = String(body.status || "active").trim() === "disabled" ? "disabled" : "active";
  const inputError = validateAuthInput({ username, email, password }, "register");
  if (inputError) {
    sendJson(res, 400, { error: inputError });
    return;
  }

  try {
    const pool = await getMysql();
    const [existing] = await pool.query(
      `SELECT id FROM ${tableName("users")} WHERE username = ? OR email = ? LIMIT 1`,
      [username, email]
    );
    if (existing.length) {
      sendJson(res, 409, { error: "用户名或邮箱已经存在。" });
      return;
    }
    const passwordData = hashPassword(password);
    const [result] = await pool.query(
      `INSERT INTO ${tableName("users")} (username, email, password_salt, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, email, passwordData.salt, passwordData.hash, role, status]
    );
    const [rows] = await pool.query(
      `SELECT id, username, email, role, status, created_at, last_login_at
         FROM ${tableName("users")}
        WHERE id = ?
        LIMIT 1`,
      [result.insertId]
    );
    sendJson(res, 201, { user: publicUser(rows[0]) });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminGetUser(req, res, userId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const pool = await getMysql();
    const [users] = await pool.query(
      `SELECT id, username, email, role, status, created_at, last_login_at, updated_at
         FROM ${tableName("users")}
        WHERE id = ?
        LIMIT 1`,
      [userId]
    );
    if (!users.length) {
      sendJson(res, 404, { error: "用户不存在。" });
      return;
    }
    const dataRows = await getUserDataRows(pool, [userId]);
    const rows = dataRows.get(String(userId)) || [];
    sendJson(res, 200, {
      user: adminPublicUser(users[0], rows),
      dataKeys: rows.map((row) => ({
        key: row.data_key,
        bytes: Buffer.byteLength(String(row.data_value || ""), "utf8"),
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      })),
    });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminSetUserStatus(req, res, userId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;
  const status = String(body.status || "").trim();
  if (status !== "active" && status !== "disabled") {
    sendJson(res, 400, { error: "状态只能是 active 或 disabled。" });
    return;
  }
  if (String(admin.id) === String(userId) && status === "disabled") {
    sendJson(res, 400, { error: "不能禁用当前登录的管理员。" });
    return;
  }
  try {
    const pool = await getMysql();
    const [result] = await pool.query(
      `UPDATE ${tableName("users")} SET status = ? WHERE id = ?`,
      [status, userId]
    );
    if (!result.affectedRows) {
      sendJson(res, 404, { error: "用户不存在。" });
      return;
    }
    if (status === "disabled") {
      await pool.query(`DELETE FROM ${tableName("sessions")} WHERE user_id = ?`, [userId]);
    }
    sendJson(res, 200, { ok: true, status });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminSetUserRole(req, res, userId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;
  const role = String(body.role || "").trim();
  if (role !== "user" && role !== "admin") {
    sendJson(res, 400, { error: "角色只能是 user 或 admin。" });
    return;
  }
  if (String(admin.id) === String(userId) && role !== "admin") {
    sendJson(res, 400, { error: "不能把当前登录的管理员降为普通用户。" });
    return;
  }
  try {
    const pool = await getMysql();
    const [result] = await pool.query(
      `UPDATE ${tableName("users")} SET role = ? WHERE id = ?`,
      [role, userId]
    );
    if (!result.affectedRows) {
      sendJson(res, 404, { error: "用户不存在。" });
      return;
    }
    sendJson(res, 200, { ok: true, role });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

function generateTemporaryPassword() {
  return `Wj${crypto.randomBytes(6).toString("base64url")}9`;
}

async function adminResetPassword(req, res, userId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;
  const password = String(body.password || "").trim() || generateTemporaryPassword();
  if (password.length < 8) {
    sendJson(res, 400, { error: "新密码至少需要 8 位。" });
    return;
  }
  try {
    const pool = await getMysql();
    const passwordData = hashPassword(password);
    const [result] = await pool.query(
      `UPDATE ${tableName("users")}
          SET password_salt = ?, password_hash = ?
        WHERE id = ?`,
      [passwordData.salt, passwordData.hash, userId]
    );
    if (!result.affectedRows) {
      sendJson(res, 404, { error: "用户不存在。" });
      return;
    }
    await pool.query(`DELETE FROM ${tableName("sessions")} WHERE user_id = ?`, [userId]);
    sendJson(res, 200, { ok: true, temporaryPassword: password });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminClearUserData(req, res, userId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const pool = await getMysql();
    const [result] = await pool.query(`DELETE FROM ${tableName("user_data")} WHERE user_id = ?`, [userId]);
    sendJson(res, 200, { ok: true, deletedRows: result.affectedRows || 0 });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminDeleteUser(req, res, userId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (String(admin.id) === String(userId)) {
    sendJson(res, 400, { error: "不能删除当前登录的管理员。" });
    return;
  }
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;
  try {
    const pool = await getMysql();
    const [users] = await pool.query(
      `SELECT username, email FROM ${tableName("users")} WHERE id = ? LIMIT 1`,
      [userId]
    );
    if (!users.length) {
      sendJson(res, 404, { error: "用户不存在。" });
      return;
    }
    const confirm = String(body.confirm || "").trim();
    if (confirm !== users[0].username && confirm !== users[0].email) {
      sendJson(res, 400, { error: "请输入该用户的用户名或邮箱作为删除确认。" });
      return;
    }
    await pool.query(`DELETE FROM ${tableName("users")} WHERE id = ?`, [userId]);
    sendJson(res, 200, { ok: true });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminGetSystemStatus(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const pool = await getMysql();
    await pool.query("SELECT 1");
    const [[userCounts]] = await pool.query(
      `SELECT
         COUNT(*) AS totalUsers,
         SUM(status = 'active') AS activeUsers,
         SUM(status = 'disabled') AS disabledUsers,
         SUM(role = 'admin') AS adminUsers
       FROM ${tableName("users")}`
    );
    const [[dataCounts]] = await pool.query(
      `SELECT COUNT(*) AS dataRows, COALESCE(SUM(CHAR_LENGTH(data_value)), 0) AS dataBytes
         FROM ${tableName("user_data")}`
    );
    sendJson(res, 200, {
      mysql: { connected: true },
      users: userCounts,
      data: dataCounts,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    sendJson(res, 200, {
      mysql: { connected: false, error: String(e?.message || e) },
      users: { totalUsers: 0, activeUsers: 0, disabledUsers: 0, adminUsers: 0 },
      data: { dataRows: 0, dataBytes: 0 },
      checkedAt: new Date().toISOString(),
    });
  }
}

function handleAdminRoute(req, res, url) {
  const userMatch = url.pathname.match(/^\/api\/admin\/users\/(\d+)(?:\/(status|role|reset-password|data))?$/);
  if (url.pathname === "/api/admin/me" && req.method === "GET") {
    void adminGetMe(req, res);
    return true;
  }
  if (url.pathname === "/api/admin/users" && req.method === "GET") {
    void adminListUsers(req, res, url);
    return true;
  }
  if (url.pathname === "/api/admin/users" && req.method === "POST") {
    void adminCreateUser(req, res);
    return true;
  }
  if (userMatch && req.method === "GET" && !userMatch[2]) {
    void adminGetUser(req, res, userMatch[1]);
    return true;
  }
  if (userMatch && req.method === "PATCH" && userMatch[2] === "status") {
    void adminSetUserStatus(req, res, userMatch[1]);
    return true;
  }
  if (userMatch && req.method === "PATCH" && userMatch[2] === "role") {
    void adminSetUserRole(req, res, userMatch[1]);
    return true;
  }
  if (userMatch && req.method === "POST" && userMatch[2] === "reset-password") {
    void adminResetPassword(req, res, userMatch[1]);
    return true;
  }
  if (userMatch && req.method === "DELETE" && userMatch[2] === "data") {
    void adminClearUserData(req, res, userMatch[1]);
    return true;
  }
  if (userMatch && req.method === "DELETE" && !userMatch[2]) {
    void adminDeleteUser(req, res, userMatch[1]);
    return true;
  }
  if (url.pathname === "/api/admin/status" && req.method === "GET") {
    void adminGetSystemStatus(req, res);
    return true;
  }
  return false;
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

async function proxyVideo(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;

  if (VIDEO_PROVIDER === "dashscope_wan") {
    await proxyDashScopeWan(body, res);
    return;
  }

  if (!VIDEO_API_URL) {
    sendJson(res, 501, {
      error:
        "Missing LINGXI_VIDEO_API_URL. Set it to your video generation or digital human API endpoint.",
    });
    return;
  }

  try {
    const upstream = await fetch(VIDEO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(VIDEO_API_KEY ? { Authorization: `Bearer ${VIDEO_API_KEY}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const contentType = upstream.headers.get("content-type") || JSON_UTF8;
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", contentType);
    res.end(await upstream.text());
  } catch (e) {
    sendJson(res, 502, { error: `Video API request failed: ${String(e?.message || e)}` });
  }
}

function dashScopeBaseUrl() {
  if (DASHSCOPE_WORKSPACE_ID) {
    return `https://${DASHSCOPE_WORKSPACE_ID}.${DASHSCOPE_REGION}.maas.aliyuncs.com`;
  }
  return "https://dashscope.aliyuncs.com";
}

function dashScopeVideoSize() {
  const resolution = DASHSCOPE_VIDEO_RESOLUTION.toUpperCase();
  if (resolution === "720P") return "1280*720";
  if (resolution === "1080P") return "1920*1080";
  return "832*480";
}

function buildWanPrompt(body) {
  const scenes = Array.isArray(body.scenes) ? body.scenes : [];
  const sceneText = scenes
    .slice(0, 6)
    .map((scene, index) => {
      const title = String(scene?.title || `片段${index + 1}`).trim();
      const narration = String(scene?.narration || scene?.visual || "").trim();
      const visual = String(scene?.visual || "").trim();
      return `${index + 1}. ${title}：${visual || narration}`;
    })
    .join("；");
  const title = String(body.title || "教学视频").trim();
  const prompt = String(body.prompt || "").trim();
  return [
    `生成一段“老师正在讲授知识点”的短课视频，主题是“${title}”。`,
    "核心目标：让观众感觉自己正在听老师讲这一个知识点，而不是看教育科技广告。画面要有明确授课行为：老师讲解、指向白板/黑板、画示意图、拆解例子、学生视角听课。",
    "场景：真实普通教室、大学小课堂、辅导课桌面或线上课程录制间。老师 25-45 岁，穿日常教师风格服装或商务休闲服，不能穿学生校服，不能像广告模特摆拍。",
    "镜头语言：固定机位或轻微推拉。优先中景老师讲解、手部写板书、白板图示、学生笔记本视角、老师指点示意图。镜头要服务“讲清知识点”，不要炫技，不要宣传片剪辑。",
    "板书/图示：可以出现简洁几何图形、箭头、圆圈、流程框、手绘示意、公式形状和无字图表；尽量避免可读文字。中文标题和字幕会由网页前端叠加，不需要模型生成。",
    "画面节奏：开头老师引入概念，中间指向图示解释关系，结尾回到学生笔记或老师总结。保留下方字幕安全区，不要把主体放在底部 18%。",
    "硬性禁止：教育科技宣传片、品牌广告感、学生制服、校徽、夸张微笑摆拍、二次元、卡通、PPT整页展示、乱码文字、可读字幕、水印、logo、畸形手指、多人杂乱场景。",
    prompt ? `授课镜头补充：${prompt}` : "",
    sceneText ? `授课要点参考，只理解含义，不要把这些文字直接画进视频：${sceneText}` : "",
  ].filter(Boolean).join("\n");
}

async function proxyDashScopeWan(body, res) {
  if (!DASHSCOPE_API_KEY) {
    sendJson(res, 500, { error: "Missing DASHSCOPE_API_KEY in .env" });
    return;
  }

  const action = String(body.action || "generate");
  const baseUrl = dashScopeBaseUrl();
  try {
    if (action === "config") {
      sendJson(res, 200, {
        provider: "dashscope_wan",
        model: DASHSCOPE_VIDEO_MODEL,
        resolution: DASHSCOPE_VIDEO_RESOLUTION,
        duration: Math.min(15, Math.max(2, DASHSCOPE_VIDEO_DURATION || 5)),
        billing_notice: "这是付费视频生成 API，提交任务后可能立即计费。",
      });
      return;
    }

    if (action === "status") {
      const taskId = String(body.task_id || body.taskId || "").trim();
      if (!taskId) {
        sendJson(res, 400, { error: "Missing task_id" });
        return;
      }
      const upstream = await fetch(`${baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        },
      });
      const text = await upstream.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        sendJson(res, upstream.status, { error: text || upstream.statusText });
        return;
      }
      sendJson(res, upstream.status, normalizeDashScopeTask(json));
      return;
    }

    const prompt = buildWanPrompt(body);
    const upstream = await fetch(`${baseUrl}/api/v1/services/aigc/video-generation/video-synthesis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: DASHSCOPE_VIDEO_MODEL,
        input: { prompt },
        parameters: {
          size: dashScopeVideoSize(),
          duration: Math.min(15, Math.max(2, DASHSCOPE_VIDEO_DURATION || 5)),
          prompt_extend: true,
          watermark: false,
        },
      }),
    });
    const text = await upstream.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      sendJson(res, upstream.status, { error: text || upstream.statusText });
      return;
    }
    sendJson(res, upstream.status, normalizeDashScopeTask(json, { prompt }));
  } catch (e) {
    sendJson(res, 502, { error: `DashScope video request failed: ${String(e?.message || e)}` });
  }
}

function normalizeDashScopeTask(json, extra = {}) {
  const output = json?.output || {};
  const results = output?.results || output?.video || {};
  const videoUrl =
    output.video_url ||
    output.videoUrl ||
    results.video_url ||
    results.url ||
    output.url ||
    "";
  return {
    provider: "dashscope_wan",
    raw: json,
    request_id: json?.request_id || json?.requestId || "",
    task_id: output.task_id || output.taskId || json?.task_id || json?.taskId || "",
    task_status: output.task_status || output.taskStatus || json?.task_status || json?.status || "",
    video_url: videoUrl,
    error: output.message || json?.message || json?.error?.message || "",
    ...extra,
  };
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
    if (url.pathname === "/api/auth/register" && req.method === "POST") {
      void registerUser(req, res);
      return;
    }
    if (url.pathname === "/api/auth/login" && req.method === "POST") {
      void loginUser(req, res);
      return;
    }
    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      void logoutUser(req, res);
      return;
    }
    if (url.pathname === "/api/auth/me" && req.method === "GET") {
      void getAuthMe(req, res);
      return;
    }
    if (url.pathname.startsWith("/api/admin/") && handleAdminRoute(req, res, url)) {
      return;
    }
    if (url.pathname === "/api/user-data" && req.method === "GET") {
      void getUserData(req, res);
      return;
    }
    if (url.pathname === "/api/user-data" && req.method === "PUT") {
      void saveUserData(req, res);
      return;
    }
    if (url.pathname === "/api/user-data" && req.method === "DELETE") {
      void deleteUserData(req, res);
      return;
    }
    if (url.pathname === "/api/chat" && (req.method === "POST" || req.method === "OPTIONS")) {
      void proxyChat(req, res);
      return;
    }
    if (url.pathname === "/api/video" && (req.method === "POST" || req.method === "OPTIONS")) {
      void proxyVideo(req, res);
      return;
    }
    if (url.pathname === "/admin") {
      serveStatic(req, res, "/admin.html");
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
