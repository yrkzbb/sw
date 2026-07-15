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
    const [recentLogins] = await pool.query(
      `SELECT id, username, email, role, status, last_login_at
         FROM ${tableName("users")}
        WHERE last_login_at IS NOT NULL
        ORDER BY last_login_at DESC
        LIMIT 6`
    );
    const [recentAuditLogs] = await pool.query(
      `SELECT l.id, l.action, l.detail, l.created_at,
              a.username AS admin_username,
              t.username AS target_username
         FROM ${tableName("admin_audit_logs")} l
         LEFT JOIN ${tableName("users")} a ON a.id = l.admin_id
         LEFT JOIN ${tableName("users")} t ON t.id = l.target_user_id
        ORDER BY l.created_at DESC
        LIMIT 8`
    );
    sendJson(res, 200, {
      mysql: { connected: true },
      users: userCounts,
      data: dataCounts,
      recentLogins: recentLogins.map(publicUser),
      recentAuditLogs,
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

function isoDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

async function adminGetOverview(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const pool = await getMysql();
    const [[userCounts]] = await pool.query(
      `SELECT
         COUNT(*) AS totalUsers,
         SUM(status = 'active') AS activeUsers,
         SUM(status = 'disabled') AS disabledUsers,
         SUM(role = 'admin') AS adminUsers,
         SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS newUsers7d,
         SUM(created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS newUsers30d
       FROM ${tableName("users")}`
    );
    const [[activityCounts]] = await pool.query(
      `SELECT
         SUM(last_login_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)) AS activeUsers1d,
         SUM(last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS activeUsers7d,
         SUM(status = 'active' AND (last_login_at IS NULL OR last_login_at < DATE_SUB(NOW(), INTERVAL 30 DAY))) AS attentionUsers
       FROM ${tableName("users")}`
    );
    const [[dataCounts]] = await pool.query(
      `SELECT COUNT(*) AS dataRows, COALESCE(SUM(CHAR_LENGTH(data_value)), 0) AS dataBytes
         FROM ${tableName("user_data")}`
    );
    const [[sessionCounts]] = await pool.query(
      `SELECT
         SUM(expires_at > NOW()) AS activeSessions,
         SUM(expires_at <= NOW()) AS expiredSessions
       FROM ${tableName("sessions")}`
    );
    const [attentionUsers] = await pool.query(
      `SELECT id, username, email, role, status, created_at, last_login_at
         FROM ${tableName("users")}
        WHERE status = 'active' AND (last_login_at IS NULL OR last_login_at < DATE_SUB(NOW(), INTERVAL 30 DAY))
        ORDER BY last_login_at IS NULL DESC, last_login_at ASC, created_at ASC
        LIMIT 6`
    );
    const [heavyUsers] = await pool.query(
      `SELECT u.id, u.username, u.email, u.role, u.status, u.created_at, u.last_login_at,
              COUNT(d.data_key) AS dataRows,
              COALESCE(SUM(CHAR_LENGTH(d.data_value)), 0) AS dataBytes
         FROM ${tableName("users")} u
         JOIN ${tableName("user_data")} d ON d.user_id = u.id
        GROUP BY u.id, u.username, u.email, u.role, u.status, u.created_at, u.last_login_at
        ORDER BY dataBytes DESC
        LIMIT 6`
    );
    const [signupRows] = await pool.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS count
         FROM ${tableName("users")}
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(created_at)
        ORDER BY day ASC`
    );
    const trendMap = new Map(signupRows.map((row) => [isoDay(row.day), Number(row.count || 0)]));
    const signupTrend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - 6 + index);
      const day = date.toISOString().slice(5, 10);
      const key = date.toISOString().slice(0, 10);
      return { day, count: trendMap.get(key) || 0 };
    });
    const [dataKeyStats] = await pool.query(
      `SELECT data_key AS \`key\`, COUNT(*) AS dataRows, COALESCE(SUM(CHAR_LENGTH(data_value)), 0) AS bytes
         FROM ${tableName("user_data")}
        GROUP BY data_key
        ORDER BY bytes DESC
        LIMIT 8`
    );
    sendJson(res, 200, {
      users: userCounts,
      activity: activityCounts,
      data: dataCounts,
      sessions: sessionCounts,
      attentionUsers: attentionUsers.map(publicUser),
      heavyUsers: heavyUsers.map((row) => ({
        ...publicUser(row),
        dataRows: Number(row.dataRows || 0),
        dataBytes: Number(row.dataBytes || 0),
      })),
      signupTrend,
      dataKeyStats: dataKeyStats.map((row) => ({
        key: row.key,
        rows: Number(row.dataRows || 0),
        bytes: Number(row.bytes || 0),
      })),
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminListSessions(req, res, url) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const pool = await getMysql();
    const currentSessionId = parseCookies(req)[SESSION_COOKIE] || "";
    const page = normalizePositiveInt(url.searchParams.get("page"), 1, 1, 10000);
    const pageSize = normalizePositiveInt(url.searchParams.get("pageSize"), 20, 5, 100);
    const offset = (page - 1) * pageSize;
    const q = String(url.searchParams.get("q") || "").trim();
    const status = String(url.searchParams.get("status") || "active").trim();
    const params = [];
    const where = [];
    if (status === "active") where.push("s.expires_at > NOW()");
    if (status === "expired") where.push("s.expires_at <= NOW()");
    if (q) {
      where.push("(u.username LIKE ? OR u.email LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total
         FROM ${tableName("sessions")} s
         JOIN ${tableName("users")} u ON u.id = s.user_id
        ${whereSql}`,
      params
    );
    const [[summary]] = await pool.query(
      `SELECT
         SUM(s.expires_at > NOW()) AS activeSessions,
         SUM(s.expires_at <= NOW()) AS expiredSessions,
         COUNT(DISTINCT CASE WHEN s.expires_at > NOW() THEN s.user_id END) AS activeUsers,
         SUM(s.expires_at > NOW() AND u.role = 'admin') AS adminSessions,
         MAX(s.created_at) AS latestSessionAt
       FROM ${tableName("sessions")} s
       JOIN ${tableName("users")} u ON u.id = s.user_id`
    );
    const [sessions] = await pool.query(
      `SELECT s.id, s.created_at, s.expires_at,
              u.id AS user_id, u.username, u.email, u.role, u.status, u.created_at AS user_created_at, u.last_login_at
         FROM ${tableName("sessions")} s
         JOIN ${tableName("users")} u ON u.id = s.user_id
        ${whereSql}
        ORDER BY s.expires_at > NOW() DESC, s.created_at DESC
        LIMIT ? OFFSET ?`,
      params.concat([pageSize, offset])
    );
    sendJson(res, 200, {
      sessions: sessions.map((row) => ({
        id: row.id,
        idPreview: `${String(row.id).slice(0, 8)}...${String(row.id).slice(-6)}`,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at,
        expired: row.expires_at instanceof Date ? row.expires_at.getTime() <= Date.now() : new Date(row.expires_at).getTime() <= Date.now(),
        isCurrent: row.id === currentSessionId,
        user: publicUser({
          id: row.user_id,
          username: row.username,
          email: row.email,
          role: row.role,
          status: row.status,
          created_at: row.user_created_at,
          last_login_at: row.last_login_at,
        }),
      })),
      summary: {
        activeSessions: Number(summary.activeSessions || 0),
        expiredSessions: Number(summary.expiredSessions || 0),
        activeUsers: Number(summary.activeUsers || 0),
        adminSessions: Number(summary.adminSessions || 0),
        latestSessionAt: summary.latestSessionAt instanceof Date ? summary.latestSessionAt.toISOString() : summary.latestSessionAt,
      },
      pagination: {
        page,
        pageSize,
        total: Number(countRow.total || 0),
        totalPages: Math.max(1, Math.ceil(Number(countRow.total || 0) / pageSize)),
      },
    });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminRevokeSession(req, res, sessionId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const currentSessionId = parseCookies(req)[SESSION_COOKIE] || "";
  if (sessionId === currentSessionId) {
    sendJson(res, 400, { error: "不能撤销当前登录会话，请使用退出登录。" });
    return;
  }
  try {
    const pool = await getMysql();
    const [sessions] = await pool.query(
      `SELECT user_id FROM ${tableName("sessions")} WHERE id = ? LIMIT 1`,
      [sessionId]
    );
    if (!sessions.length) {
      sendJson(res, 404, { error: "会话不存在。" });
      return;
    }
    const [result] = await pool.query(`DELETE FROM ${tableName("sessions")} WHERE id = ?`, [sessionId]);
    await writeAdminAuditLog(pool, admin, "revoke_session", sessions[0].user_id, {
      session: `${String(sessionId).slice(0, 8)}...${String(sessionId).slice(-6)}`,
    });
    sendJson(res, 200, { ok: true, revokedSessions: result.affectedRows || 0 });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminCleanupExpiredSessions(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const pool = await getMysql();
    const [result] = await pool.query(`DELETE FROM ${tableName("sessions")} WHERE expires_at <= NOW()`);
    await writeAdminAuditLog(pool, admin, "cleanup_expired_sessions", null, { deletedSessions: result.affectedRows || 0 });
    sendJson(res, 200, { ok: true, deletedSessions: result.affectedRows || 0 });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminListAuditLogs(req, res, url) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const pool = await getMysql();
    const page = normalizePositiveInt(url.searchParams.get("page"), 1, 1, 10000);
    const pageSize = normalizePositiveInt(url.searchParams.get("pageSize"), 20, 5, 100);
    const offset = (page - 1) * pageSize;
    const q = String(url.searchParams.get("q") || "").trim();
    const action = String(url.searchParams.get("action") || "").trim();
    const params = [];
    const where = [];
    if (action) {
      where.push("l.action = ?");
      params.push(action);
    }
    if (q) {
      where.push("(a.username LIKE ? OR a.email LIKE ? OR t.username LIKE ? OR t.email LIKE ? OR l.detail LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total
         FROM ${tableName("admin_audit_logs")} l
         LEFT JOIN ${tableName("users")} a ON a.id = l.admin_id
         LEFT JOIN ${tableName("users")} t ON t.id = l.target_user_id
        ${whereSql}`,
      params
    );
    const [logs] = await pool.query(
      `SELECT l.id, l.action, l.detail, l.created_at,
              a.username AS admin_username,
              t.username AS target_username
         FROM ${tableName("admin_audit_logs")} l
         LEFT JOIN ${tableName("users")} a ON a.id = l.admin_id
         LEFT JOIN ${tableName("users")} t ON t.id = l.target_user_id
        ${whereSql}
        ORDER BY l.created_at DESC
        LIMIT ? OFFSET ?`,
      params.concat([pageSize, offset])
    );
    const [actions] = await pool.query(
      `SELECT DISTINCT action
         FROM ${tableName("admin_audit_logs")}
        ORDER BY action ASC`
    );
    sendJson(res, 200, {
      logs,
      actions: actions.map((row) => row.action).filter(Boolean),
      pagination: {
        page,
        pageSize,
        total: Number(countRow.total || 0),
        totalPages: Math.max(1, Math.ceil(Number(countRow.total || 0) / pageSize)),
      },
    });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

function buildAuditFilter(url) {
  const q = String(url.searchParams.get("q") || "").trim();
  const action = String(url.searchParams.get("action") || "").trim();
  const params = [];
  const where = [];
  if (action) {
    where.push("l.action = ?");
    params.push(action);
  }
  if (q) {
    where.push("(a.username LIKE ? OR a.email LIKE ? OR t.username LIKE ? OR t.email LIKE ? OR l.detail LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  return {
    params,
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
  };
}

async function adminExportAuditLogsCsv(req, res, url) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const pool = await getMysql();
    const { params, whereSql } = buildAuditFilter(url);
    const [logs] = await pool.query(
      `SELECT l.id, l.action, l.detail, l.created_at,
              a.username AS admin_username,
              t.username AS target_username
         FROM ${tableName("admin_audit_logs")} l
         LEFT JOIN ${tableName("users")} a ON a.id = l.admin_id
         LEFT JOIN ${tableName("users")} t ON t.id = l.target_user_id
        ${whereSql}
        ORDER BY l.created_at DESC
        LIMIT 10000`,
      params
    );
    await writeAdminAuditLog(pool, admin, "export_audit_csv", null, { exportedLogs: logs.length });
    const header = ["ID", "时间", "管理员", "操作", "对象", "详情"];
    const rows = logs.map((log) => [
      log.id,
      log.created_at instanceof Date ? log.created_at.toISOString() : log.created_at,
      log.admin_username || "未知管理员",
      log.action,
      renderAuditTarget(log),
      renderAuditCsvDetail(log.detail),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    res.setHeader("Content-Disposition", `attachment; filename="wenjie-audit-${new Date().toISOString().slice(0, 10)}.csv"`);
    sendText(res, 200, `\uFEFF${csv}\n`, "text/csv; charset=utf-8");
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

function renderAuditCsvDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  return JSON.stringify(detail);
}

function parseAuditDetail(detail) {
  if (!detail) return {};
  if (typeof detail === "object") return detail;
  try {
    return JSON.parse(detail);
  } catch {
    return {};
  }
}

