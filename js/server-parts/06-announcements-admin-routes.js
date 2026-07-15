function renderAuditTarget(log) {
  const detail = parseAuditDetail(log.detail);
  if (String(log.action || "").includes("announcement")) {
    const title = detail.title ? `：${detail.title}` : "";
    const id = detail.announcementId ? ` #${detail.announcementId}` : "";
    return `公告${title}${id}`;
  }
  if (["export_users_csv", "export_audit_csv", "cleanup_expired_sessions"].includes(log.action)) {
    return "系统";
  }
  return log.target_username || "已删除用户";
}

function publicAnnouncement(row) {
  return {
    id: String(row.id),
    title: row.title,
    content: row.content,
    level: row.level || "info",
    status: row.status || "draft",
    startsAt: row.starts_at instanceof Date ? row.starts_at.toISOString() : row.starts_at,
    endsAt: row.ends_at instanceof Date ? row.ends_at.toISOString() : row.ends_at,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    createdBy: row.created_by_name || "",
  };
}

async function getPublicAnnouncements(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const pool = await getMysql();
    const [rows] = await pool.query(
      `SELECT id, title, content, level, status, starts_at, ends_at, created_at, updated_at
         FROM ${tableName("announcements")}
        WHERE status = 'published'
        ORDER BY COALESCE(starts_at, created_at) DESC, id DESC
        LIMIT 50`
    );
    sendJson(res, 200, { announcements: rows.map(publicAnnouncement) });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminListAnnouncements(req, res, url) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const pool = await getMysql();
    const status = String(url.searchParams.get("status") || "").trim();
    const params = [];
    const where = [];
    if (["draft", "published", "archived"].includes(status)) {
      where.push("n.status = ?");
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.content, n.level, n.status, n.starts_at, n.ends_at, n.created_at, n.updated_at,
              a.username AS created_by_name
         FROM ${tableName("announcements")} n
         LEFT JOIN ${tableName("users")} a ON a.id = n.created_by
        ${whereSql}
        ORDER BY n.updated_at DESC, n.id DESC
        LIMIT 50`,
      params
    );
    sendJson(res, 200, { announcements: rows.map(publicAnnouncement) });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminCreateAnnouncement(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;
  const title = String(body.title || "").trim().slice(0, 120);
  const content = String(body.content || "").trim().slice(0, 3000);
  const level = ["info", "success", "warning", "danger"].includes(String(body.level)) ? String(body.level) : "info";
  const status = ["draft", "published"].includes(String(body.status)) ? String(body.status) : "draft";
  const startsAt = normalizeDateTimeInput(body.startsAt);
  const endsAt = normalizeDateTimeInput(body.endsAt);
  if (!title || !content) {
    sendJson(res, 400, { error: "公告标题和内容不能为空。" });
    return;
  }
  try {
    const pool = await getMysql();
    const [result] = await pool.query(
      `INSERT INTO ${tableName("announcements")} (title, content, level, status, starts_at, ends_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, content, level, status, startsAt, endsAt, admin.id]
    );
    await writeAdminAuditLog(pool, admin, "create_announcement", null, { title, status });
    const [rows] = await pool.query(`SELECT * FROM ${tableName("announcements")} WHERE id = ? LIMIT 1`, [result.insertId]);
    sendJson(res, 201, { announcement: publicAnnouncement(rows[0]) });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminUpdateAnnouncement(req, res, announcementId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;
  const title = String(body.title || "").trim().slice(0, 120);
  const content = String(body.content || "").trim().slice(0, 3000);
  const level = ["info", "success", "warning", "danger"].includes(String(body.level)) ? String(body.level) : "info";
  const status = ["draft", "published", "archived"].includes(String(body.status)) ? String(body.status) : "draft";
  const startsAt = normalizeDateTimeInput(body.startsAt);
  const endsAt = normalizeDateTimeInput(body.endsAt);
  if (!title || !content) {
    sendJson(res, 400, { error: "公告标题和内容不能为空。" });
    return;
  }
  try {
    const pool = await getMysql();
    const [result] = await pool.query(
      `UPDATE ${tableName("announcements")}
          SET title = ?, content = ?, level = ?, status = ?, starts_at = ?, ends_at = ?
        WHERE id = ?`,
      [title, content, level, status, startsAt, endsAt, announcementId]
    );
    if (!result.affectedRows) {
      sendJson(res, 404, { error: "公告不存在。" });
      return;
    }
    await writeAdminAuditLog(pool, admin, "update_announcement", null, { announcementId, title, status });
    sendJson(res, 200, { ok: true });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminDeleteAnnouncement(req, res, announcementId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const pool = await getMysql();
    const [result] = await pool.query(`DELETE FROM ${tableName("announcements")} WHERE id = ?`, [announcementId]);
    if (!result.affectedRows) {
      sendJson(res, 404, { error: "公告不存在。" });
      return;
    }
    await writeAdminAuditLog(pool, admin, "delete_announcement", null, { announcementId });
    sendJson(res, 200, { ok: true });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

function normalizeDateTimeInput(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function handleAdminRoute(req, res, url) {
  const userMatch = url.pathname.match(/^\/api\/admin\/users\/(\d+)(?:\/(status|role|reset-password|data|export|sessions|note))?$/);
  const sessionMatch = url.pathname.match(/^\/api\/admin\/sessions\/([a-f0-9]{64})$/);
  const announcementMatch = url.pathname.match(/^\/api\/admin\/announcements\/(\d+)$/);
  if (url.pathname === "/api/admin/me" && req.method === "GET") {
    void adminGetMe(req, res);
    return true;
  }
  if (url.pathname === "/api/admin/users" && req.method === "GET") {
    void adminListUsers(req, res, url);
    return true;
  }
  if (url.pathname === "/api/admin/users/export" && req.method === "GET") {
    void adminExportUsersCsv(req, res, url);
    return true;
  }
  if (url.pathname === "/api/admin/users" && req.method === "POST") {
    void adminCreateUser(req, res);
    return true;
  }
  if (url.pathname === "/api/admin/users/bulk" && req.method === "POST") {
    void adminBulkUsers(req, res);
    return true;
  }
  if (userMatch && req.method === "GET" && !userMatch[2]) {
    void adminGetUser(req, res, userMatch[1]);
    return true;
  }
  if (userMatch && req.method === "GET" && userMatch[2] === "export") {
    void adminExportUserData(req, res, userMatch[1]);
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
  if (userMatch && req.method === "PATCH" && userMatch[2] === "note") {
    void adminSaveUserNote(req, res, userMatch[1]);
    return true;
  }
  if (userMatch && req.method === "DELETE" && userMatch[2] === "sessions") {
    void adminRevokeUserSessions(req, res, userMatch[1]);
    return true;
  }
  if (userMatch && req.method === "DELETE" && !userMatch[2]) {
    void adminDeleteUser(req, res, userMatch[1]);
    return true;
  }
  if (url.pathname === "/api/admin/sessions" && req.method === "GET") {
    void adminListSessions(req, res, url);
    return true;
  }
  if (url.pathname === "/api/admin/sessions/expired" && req.method === "DELETE") {
    void adminCleanupExpiredSessions(req, res);
    return true;
  }
  if (sessionMatch && req.method === "DELETE") {
    void adminRevokeSession(req, res, sessionMatch[1]);
    return true;
  }
  if (url.pathname === "/api/admin/status" && req.method === "GET") {
    void adminGetSystemStatus(req, res);
    return true;
  }
  if (url.pathname === "/api/admin/overview" && req.method === "GET") {
    void adminGetOverview(req, res);
    return true;
  }
  if (url.pathname === "/api/admin/audit-logs/export" && req.method === "GET") {
    void adminExportAuditLogsCsv(req, res, url);
    return true;
  }
  if (url.pathname === "/api/admin/audit-logs" && req.method === "GET") {
    void adminListAuditLogs(req, res, url);
    return true;
  }
  if (url.pathname === "/api/admin/announcements" && req.method === "GET") {
    void adminListAnnouncements(req, res, url);
    return true;
  }
  if (url.pathname === "/api/admin/announcements" && req.method === "POST") {
    void adminCreateAnnouncement(req, res);
    return true;
  }
  if (announcementMatch && req.method === "PATCH") {
    void adminUpdateAnnouncement(req, res, announcementMatch[1]);
    return true;
  }
  if (announcementMatch && req.method === "DELETE") {
    void adminDeleteAnnouncement(req, res, announcementMatch[1]);
    return true;
  }
  return false;
}

