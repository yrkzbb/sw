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
  accountProfile: "LINGXI_ACCOUNT_PROFILE",
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName("admin_audit_logs")} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      admin_id BIGINT UNSIGNED NULL,
      target_user_id BIGINT UNSIGNED NULL,
      action VARCHAR(64) NOT NULL,
      detail JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_admin_audit_created_at (created_at),
      KEY idx_admin_audit_admin_id (admin_id),
      KEY idx_admin_audit_target_user_id (target_user_id),
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}audit_admin
        FOREIGN KEY (admin_id) REFERENCES ${tableName("users")} (id)
        ON DELETE SET NULL,
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}audit_target_user
        FOREIGN KEY (target_user_id) REFERENCES ${tableName("users")} (id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName("user_admin_notes")} (
      user_id BIGINT UNSIGNED NOT NULL,
      tags JSON NULL,
      note TEXT NULL,
      updated_by BIGINT UNSIGNED NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id),
      KEY idx_user_admin_notes_updated_by (updated_by),
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}user_notes_user
        FOREIGN KEY (user_id) REFERENCES ${tableName("users")} (id)
        ON DELETE CASCADE,
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}user_notes_admin
        FOREIGN KEY (updated_by) REFERENCES ${tableName("users")} (id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName("announcements")} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      title VARCHAR(120) NOT NULL,
      content TEXT NOT NULL,
      level ENUM('info', 'success', 'warning', 'danger') NOT NULL DEFAULT 'info',
      status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
      starts_at DATETIME NULL,
      ends_at DATETIME NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_announcements_status_time (status, starts_at, ends_at),
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}announcements_admin
        FOREIGN KEY (created_by) REFERENCES ${tableName("users")} (id)
        ON DELETE SET NULL
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
