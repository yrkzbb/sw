const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");
const crypto = require("crypto");
const { spawn } = require("child_process");

const ROOT_DIR = path.join(__dirname, "..");
const JSON_UTF8 = "application/json; charset=utf-8";

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const BODY_LIMIT = 10 * 1024 * 1024;
const RUNTIME_DIR = path.join(ROOT_DIR, ".runtime");
const HLS_DIR = path.join(RUNTIME_DIR, "hls");
const SESSION_COOKIE = "wenjie_session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 14);
const AUTH_REQUIRED_MESSAGE = "请先登录。";
const ADMIN_REQUIRED_MESSAGE = "需要管理员权限。";
const USER_DATA_KEYS = {
  messages: "LINGXI_MESSAGES",
  chatSessions: "LINGXI_CHAT_SESSIONS",
  profile: "LINGXI_STUDENT_PROFILE",
  resources: "LINGXI_LEARNING_RESOURCES",
  mistakes: "LINGXI_MISTAKE_BOOK",
  pathLibrary: "LINGXI_LEARNING_PATH_LIBRARY",
  accountProfile: "LINGXI_ACCOUNT_PROFILE",
  favoriteCollections: "LINGXI_FAVORITE_COLLECTIONS",
};
const XFYUN_SPARK_BASE_URL = (
  process.env.XFYUN_SPARK_BASE_URL ||
  "https://spark-api-open.xf-yun.com/v1"
).replace(/\/+$/, "");
const XFYUN_SPARK_CHAT_ENDPOINT = `${XFYUN_SPARK_BASE_URL}/chat/completions`;
const XFYUN_SPARK_MODEL = (process.env.XFYUN_SPARK_MODEL || "4.0Ultra").trim();
const FELO_API_BASE_URL = (process.env.FELO_API_BASE_URL || "https://openapi.felo.ai").replace(/\/+$/, "");
const FELO_API_KEY = (process.env.FELO_API_KEY || "").trim();
const XFYUN_PPT_APP_ID = (process.env.XFYUN_PPT_APP_ID || process.env.XUNFEI_VMS_APP_ID || "").trim();
const XFYUN_PPT_API_SECRET = (process.env.XFYUN_PPT_API_SECRET || process.env.XUNFEI_VMS_API_SECRET || "").trim();
const XFYUN_PPT_BASE_URL = (process.env.XFYUN_PPT_BASE_URL || "https://zwapi.xfyun.cn").replace(/\/+$/, "");
const VIDEO_API_URL = (
  process.env.XUNFEI_DIGITAL_HUMAN_API_URL ||
  process.env.LINGXI_VIDEO_API_URL ||
  ""
).trim();
const VIDEO_API_KEY = (
  process.env.XUNFEI_DIGITAL_HUMAN_API_KEY ||
  process.env.LINGXI_VIDEO_API_KEY ||
  ""
).trim();
const VIDEO_PROVIDER = (process.env.VIDEO_PROVIDER || "dashscope_wan").trim();
const XUNFEI_VMS_HOST = (process.env.XUNFEI_VMS_HOST || "vms.cn-huadong-1.xf-yun.com").trim();
const XUNFEI_VMS_BASE_URL = (
  process.env.XUNFEI_VMS_BASE_URL ||
  `https://${XUNFEI_VMS_HOST}`
).replace(/\/+$/, "");
const XUNFEI_VMS_APP_ID = (process.env.XUNFEI_VMS_APP_ID || process.env.XUNFEI_APP_ID || "").trim();
const XUNFEI_VMS_API_KEY = (
  process.env.XUNFEI_VMS_API_KEY ||
  process.env.XUNFEI_DIGITAL_HUMAN_API_KEY ||
  ""
).trim();
const XUNFEI_VMS_API_SECRET = (
  process.env.XUNFEI_VMS_API_SECRET ||
  process.env.XUNFEI_DIGITAL_HUMAN_API_SECRET ||
  ""
).trim();
const XUNFEI_VMS_UID = (process.env.XUNFEI_VMS_UID || "").trim();
const XUNFEI_VMS_AVATAR_ID = (process.env.XUNFEI_VMS_AVATAR_ID || "118801001").trim();
const XUNFEI_VMS_VCN = (process.env.XUNFEI_VMS_VCN || "x3_qianxue").trim();
const XUNFEI_VMS_STREAM_PROTOCOL = (process.env.XUNFEI_VMS_STREAM_PROTOCOL || "rtmp").trim();
const XUNFEI_VMS_WIDTH = Number(process.env.XUNFEI_VMS_WIDTH || 1280);
const XUNFEI_VMS_HEIGHT = Number(process.env.XUNFEI_VMS_HEIGHT || 720);
const XUNFEI_VMS_SPEED = Number(process.env.XUNFEI_VMS_SPEED || 50);
const XUNFEI_VMS_PITCH = Number(process.env.XUNFEI_VMS_PITCH || 50);
const XUNFEI_VMS_VOLUME = Number(process.env.XUNFEI_VMS_VOLUME || 50);
const XUNFEI_VMS_TRANSCODE_HLS = String(process.env.XUNFEI_VMS_TRANSCODE_HLS || "1") !== "0";
const FFMPEG_BIN = (process.env.FFMPEG_BIN || "ffmpeg").trim();
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName("feed_posts")} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      author_id BIGINT UNSIGNED NOT NULL,
      content_type ENUM('question', 'answer', 'thought', 'article', 'document', 'video', 'quiz') NOT NULL DEFAULT 'thought',
      title VARCHAR(180) NOT NULL,
      summary VARCHAR(320) NOT NULL,
      body TEXT NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT '',
      tags JSON NULL,
      like_count INT UNSIGNED NOT NULL DEFAULT 0,
      comment_count INT UNSIGNED NOT NULL DEFAULT 0,
      favorite_count INT UNSIGNED NOT NULL DEFAULT 0,
      view_count INT UNSIGNED NOT NULL DEFAULT 0,
      heat_score DOUBLE NOT NULL DEFAULT 0,
      status ENUM('published', 'hidden') NOT NULL DEFAULT 'published',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_feed_status_created (status, created_at),
      KEY idx_feed_status_heat (status, heat_score),
      KEY idx_feed_author (author_id),
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}feed_posts_author
        FOREIGN KEY (author_id) REFERENCES ${tableName("users")} (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName("feed_post_interactions")} (
      user_id BIGINT UNSIGNED NOT NULL,
      post_id BIGINT UNSIGNED NOT NULL,
      interaction_type ENUM('like', 'favorite', 'view') NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id, interaction_type),
      KEY idx_feed_interactions_post (post_id, interaction_type),
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}feed_interactions_user
        FOREIGN KEY (user_id) REFERENCES ${tableName("users")} (id)
        ON DELETE CASCADE,
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}feed_interactions_post
        FOREIGN KEY (post_id) REFERENCES ${tableName("feed_posts")} (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName("feed_comments")} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      post_id BIGINT UNSIGNED NOT NULL,
      author_id BIGINT UNSIGNED NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_feed_comments_post (post_id, created_at),
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}feed_comments_post
        FOREIGN KEY (post_id) REFERENCES ${tableName("feed_posts")} (id)
        ON DELETE CASCADE,
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}feed_comments_author
        FOREIGN KEY (author_id) REFERENCES ${tableName("users")} (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName("feed_author_follows")} (
      follower_id BIGINT UNSIGNED NOT NULL,
      followee_id BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, followee_id),
      KEY idx_feed_followee (followee_id),
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}feed_follows_follower
        FOREIGN KEY (follower_id) REFERENCES ${tableName("users")} (id)
        ON DELETE CASCADE,
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}feed_follows_followee
        FOREIGN KEY (followee_id) REFERENCES ${tableName("users")} (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName("feed_user_interests")} (
      user_id BIGINT UNSIGNED NOT NULL,
      tag VARCHAR(64) NOT NULL,
      weight DOUBLE NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, tag),
      KEY idx_feed_interest_user_weight (user_id, weight),
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}feed_interests_user
        FOREIGN KEY (user_id) REFERENCES ${tableName("users")} (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName("feed_notifications")} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      actor_id BIGINT UNSIGNED NULL,
      post_id BIGINT UNSIGNED NULL,
      comment_id BIGINT UNSIGNED NULL,
      notification_type ENUM('comment') NOT NULL DEFAULT 'comment',
      message VARCHAR(240) NOT NULL DEFAULT '',
      read_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_feed_notifications_user_read (user_id, read_at, created_at),
      KEY idx_feed_notifications_post (post_id),
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}feed_notifications_user
        FOREIGN KEY (user_id) REFERENCES ${tableName("users")} (id)
        ON DELETE CASCADE,
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}feed_notifications_actor
        FOREIGN KEY (actor_id) REFERENCES ${tableName("users")} (id)
        ON DELETE SET NULL,
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}feed_notifications_post
        FOREIGN KEY (post_id) REFERENCES ${tableName("feed_posts")} (id)
        ON DELETE CASCADE,
      CONSTRAINT fk_${MYSQL_TABLE_PREFIX}feed_notifications_comment
        FOREIGN KEY (comment_id) REFERENCES ${tableName("feed_comments")} (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureUserColumn(pool, "role", "ENUM('user', 'admin') NOT NULL DEFAULT 'user'");
  await ensureUserColumn(pool, "status", "ENUM('active', 'disabled') NOT NULL DEFAULT 'active'");
  await ensureUserColumn(pool, "last_login_at", "DATETIME NULL");
  await ensureFeedPostContentTypes(pool);
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

async function ensureFeedPostContentTypes(pool) {
  await pool.query(
    `ALTER TABLE ${tableName("feed_posts")}
     MODIFY content_type ENUM('question', 'answer', 'thought', 'article', 'document', 'video', 'quiz') NOT NULL DEFAULT 'thought'`
  ).catch(() => {});
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
  const fromXfyunEnv = process.env.XFYUN_SPARK_API_PASSWORD?.trim();
  if (fromXfyunEnv) return fromXfyunEnv;
  try {
    const keyPath = path.join(ROOT_DIR, "lingxi-key.txt");
    if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, "utf-8").trim();
  } catch {
    /* ignore */
  }
  return "";
}

const XFYUN_SPARK_API_PASSWORD = loadApiKey();
