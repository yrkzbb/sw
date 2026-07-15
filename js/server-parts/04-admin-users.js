function adminPublicUser(row, dataRows = []) {
  return {
    ...publicUser(row),
    activeSessionCount: Number(row.active_session_count || 0),
    overview: summarizeUserData(dataRows),
  };
}

function normalizePositiveInt(value, fallback, min, max) {
  const number = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

async function writeAdminAuditLog(pool, admin, action, targetUserId = null, detail = {}) {
  await pool.query(
    `INSERT INTO ${tableName("admin_audit_logs")} (admin_id, target_user_id, action, detail)
     VALUES (?, ?, ?, ?)`,
    [
      admin?.id || null,
      targetUserId || null,
      action,
      JSON.stringify(detail || {}),
    ]
  );
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

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeTags(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(raw.map((tag) => String(tag || "").trim()).filter(Boolean))]
    .slice(0, 12)
    .map((tag) => tag.slice(0, 24));
}

async function getUserAdminNote(pool, userId) {
  const [rows] = await pool.query(
    `SELECT n.user_id, n.tags, n.note, n.updated_at, a.username AS updated_by_name
       FROM ${tableName("user_admin_notes")} n
       LEFT JOIN ${tableName("users")} a ON a.id = n.updated_by
      WHERE n.user_id = ?
      LIMIT 1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return { tags: [], note: "", updatedAt: "", updatedBy: "" };
  return {
    tags: parseJsonArray(row.tags),
    note: row.note || "",
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    updatedBy: row.updated_by_name || "",
  };
}

async function adminGetMe(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  sendJson(res, 200, { user: publicUser(admin) });
}

function buildAdminUserFilter(url) {
  const q = String(url.searchParams.get("q") || "").trim();
  const status = String(url.searchParams.get("status") || "").trim();
  const role = String(url.searchParams.get("role") || "").trim();
  const login = String(url.searchParams.get("login") || "").trim();
  const data = String(url.searchParams.get("data") || "").trim();
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
  if (role === "user" || role === "admin") {
    where.push("role = ?");
    params.push(role);
  }
  if (login === "online") {
    where.push(`EXISTS (SELECT 1 FROM ${tableName("sessions")} s WHERE s.user_id = ${tableName("users")}.id AND s.expires_at > NOW())`);
  }
  if (login === "never") {
    where.push("last_login_at IS NULL");
  }
  if (login === "active7d") {
    where.push("last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
  }
  if (login === "inactive30d") {
    where.push("(last_login_at IS NULL OR last_login_at < DATE_SUB(NOW(), INTERVAL 30 DAY))");
  }
  if (data === "has_data") {
    where.push(`EXISTS (SELECT 1 FROM ${tableName("user_data")} d WHERE d.user_id = ${tableName("users")}.id)`);
  }
  if (data === "no_data") {
    where.push(`NOT EXISTS (SELECT 1 FROM ${tableName("user_data")} d WHERE d.user_id = ${tableName("users")}.id)`);
  }
  if (data === "profile_ready") {
    where.push(`EXISTS (SELECT 1 FROM ${tableName("user_data")} d WHERE d.user_id = ${tableName("users")}.id AND d.data_key = ? AND CHAR_LENGTH(d.data_value) > 2)`);
    params.push(USER_DATA_KEYS.profile);
  }
  if (data === "profile_missing") {
    where.push(`NOT EXISTS (SELECT 1 FROM ${tableName("user_data")} d WHERE d.user_id = ${tableName("users")}.id AND d.data_key = ? AND CHAR_LENGTH(d.data_value) > 2)`);
    params.push(USER_DATA_KEYS.profile);
  }
  return {
    params,
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
  };
}

function adminUserSort(url) {
  const sortMap = {
    created_desc: "created_at DESC",
    created_asc: "created_at ASC",
    login_desc: "last_login_at IS NULL ASC, last_login_at DESC",
    login_asc: "last_login_at IS NULL ASC, last_login_at ASC",
    name_asc: "username ASC",
    name_desc: "username DESC",
  };
  return sortMap[String(url.searchParams.get("sort") || "created_desc")] || sortMap.created_desc;
}

async function adminListUsers(req, res, url) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const pool = await getMysql();
    const page = normalizePositiveInt(url.searchParams.get("page"), 1, 1, 10000);
    const pageSize = normalizePositiveInt(url.searchParams.get("pageSize"), 20, 5, 100);
    const offset = (page - 1) * pageSize;
    const sort = adminUserSort(url);
    const { params, whereSql } = buildAdminUserFilter(url);
    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM ${tableName("users")} ${whereSql}`,
      params
    );
    const [users] = await pool.query(
      `SELECT id, username, email, role, status, created_at, last_login_at, updated_at,
              (SELECT COUNT(*) FROM ${tableName("sessions")} s WHERE s.user_id = ${tableName("users")}.id AND s.expires_at > NOW()) AS active_session_count
         FROM ${tableName("users")}
        ${whereSql}
        ORDER BY ${sort}
        LIMIT ? OFFSET ?`,
      params.concat([pageSize, offset])
    );
    const dataRows = await getUserDataRows(pool, users.map((user) => user.id));
    sendJson(res, 200, {
      users: users.map((user) => adminPublicUser(user, dataRows.get(String(user.id)) || [])),
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

function csvCell(value) {
  const text = String(value ?? "");
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

async function adminExportUsersCsv(req, res, url) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const pool = await getMysql();
    const sort = adminUserSort(url);
    const { params, whereSql } = buildAdminUserFilter(url);
    const [users] = await pool.query(
      `SELECT id, username, email, role, status, created_at, last_login_at, updated_at,
              (SELECT COUNT(*) FROM ${tableName("sessions")} s WHERE s.user_id = ${tableName("users")}.id AND s.expires_at > NOW()) AS active_session_count
         FROM ${tableName("users")}
        ${whereSql}
        ORDER BY ${sort}
        LIMIT 5000`,
      params
    );
    const dataRows = await getUserDataRows(pool, users.map((user) => user.id));
    const header = [
      "ID",
      "用户名",
      "邮箱",
      "角色",
      "状态",
      "注册时间",
      "最近登录",
      "对话数",
      "错题数",
      "资源数",
      "数据量",
      "数据键数",
      "有效会话数",
    ];
    const rows = users.map((user) => {
      const overview = summarizeUserData(dataRows.get(String(user.id)) || []);
      return [
        user.id,
        user.username,
        user.email,
        user.role,
        user.status,
        user.created_at instanceof Date ? user.created_at.toISOString() : user.created_at,
        user.last_login_at instanceof Date ? user.last_login_at.toISOString() : user.last_login_at,
        overview.conversationCount,
        overview.mistakeCount,
        overview.resourceCount,
        overview.dataBytes,
        overview.dataKeyCount,
        user.active_session_count || 0,
      ];
    });
    await writeAdminAuditLog(pool, admin, "export_users_csv", null, { exportedUsers: users.length });
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    res.setHeader("Content-Disposition", `attachment; filename="wenjie-users-${new Date().toISOString().slice(0, 10)}.csv"`);
    sendText(res, 200, `\uFEFF${csv}\n`, "text/csv; charset=utf-8");
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
    await writeAdminAuditLog(pool, admin, "create_user", result.insertId, { username, email, role, status });
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
      `SELECT id, username, email, role, status, created_at, last_login_at, updated_at,
              (SELECT COUNT(*) FROM ${tableName("sessions")} s WHERE s.user_id = ${tableName("users")}.id AND s.expires_at > NOW()) AS active_session_count
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
    const adminNote = await getUserAdminNote(pool, userId);
    sendJson(res, 200, {
      user: adminPublicUser(users[0], rows),
      adminNote,
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

async function adminSaveUserNote(req, res, userId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;
  const tags = normalizeTags(body.tags);
  const note = String(body.note || "").trim().slice(0, 2000);
  try {
    const pool = await getMysql();
    const [users] = await pool.query(`SELECT id FROM ${tableName("users")} WHERE id = ? LIMIT 1`, [userId]);
    if (!users.length) {
      sendJson(res, 404, { error: "用户不存在。" });
      return;
    }
    await pool.query(
      `INSERT INTO ${tableName("user_admin_notes")} (user_id, tags, note, updated_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tags = VALUES(tags), note = VALUES(note), updated_by = VALUES(updated_by)`,
      [userId, JSON.stringify(tags), note, admin.id]
    );
    await writeAdminAuditLog(pool, admin, "update_user_note", userId, { tags });
    sendJson(res, 200, { ok: true, adminNote: await getUserAdminNote(pool, userId) });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminExportUserData(req, res, userId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try {
    const pool = await getMysql();
    const [users] = await pool.query(
      `SELECT id, username, email, role, status, created_at, last_login_at, updated_at,
              (SELECT COUNT(*) FROM ${tableName("sessions")} s WHERE s.user_id = ${tableName("users")}.id AND s.expires_at > NOW()) AS active_session_count
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
    const data = {};
    rows.forEach((row) => {
      data[row.data_key] = row.data_value;
    });
    await writeAdminAuditLog(pool, admin, "export_user_data", userId, { dataKeyCount: rows.length });
    sendJson(res, 200, {
      exportedAt: new Date().toISOString(),
      user: adminPublicUser(users[0], rows),
      data,
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

function normalizeUserIds(value) {
  const raw = Array.isArray(value) ? value : [];
  return [...new Set(raw.map((id) => String(id || "").trim()).filter((id) => /^\d+$/.test(id)))].slice(0, 100);
}

async function adminBulkUsers(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;
  const userIds = normalizeUserIds(body.userIds);
  const action = String(body.action || "").trim();
  if (!userIds.length) {
    sendJson(res, 400, { error: "请选择用户。" });
    return;
  }
  if (!["enable", "disable", "clear_data"].includes(action)) {
    sendJson(res, 400, { error: "批量操作无效。" });
    return;
  }
  if (action === "disable" && userIds.includes(String(admin.id))) {
    sendJson(res, 400, { error: "不能禁用当前登录的管理员。" });
    return;
  }
  try {
    const pool = await getMysql();
    const placeholders = userIds.map(() => "?").join(",");
    const [users] = await pool.query(
      `SELECT id, username FROM ${tableName("users")} WHERE id IN (${placeholders})`,
      userIds
    );
    if (!users.length) {
      sendJson(res, 404, { error: "没有找到可操作的用户。" });
      return;
    }
    const foundIds = users.map((user) => String(user.id));
    if (action === "enable" || action === "disable") {
      const status = action === "enable" ? "active" : "disabled";
      await pool.query(
        `UPDATE ${tableName("users")} SET status = ? WHERE id IN (${foundIds.map(() => "?").join(",")})`,
        [status].concat(foundIds)
      );
      if (status === "disabled") {
        await pool.query(
          `DELETE FROM ${tableName("sessions")} WHERE user_id IN (${foundIds.map(() => "?").join(",")})`,
          foundIds
        );
      }
      await Promise.all(foundIds.map((id) => writeAdminAuditLog(
        pool,
        admin,
        status === "disabled" ? "bulk_disable_user" : "bulk_enable_user",
        id,
        { status }
      )));
      sendJson(res, 200, { ok: true, affectedUsers: foundIds.length });
      return;
    }
    if (action === "clear_data") {
      const [result] = await pool.query(
        `DELETE FROM ${tableName("user_data")} WHERE user_id IN (${foundIds.map(() => "?").join(",")})`,
        foundIds
      );
      await Promise.all(foundIds.map((id) => writeAdminAuditLog(
        pool,
        admin,
        "bulk_clear_user_data",
        id,
        { affectedUsers: foundIds.length }
      )));
      sendJson(res, 200, { ok: true, affectedUsers: foundIds.length, deletedRows: result.affectedRows || 0 });
    }
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
    await writeAdminAuditLog(pool, admin, status === "disabled" ? "disable_user" : "enable_user", userId, { status });
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
    await writeAdminAuditLog(pool, admin, "set_user_role", userId, { role });
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
    await writeAdminAuditLog(pool, admin, "reset_password", userId, { generated: !String(body.password || "").trim() });
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
    await writeAdminAuditLog(pool, admin, "clear_user_data", userId, { deletedRows: result.affectedRows || 0 });
    sendJson(res, 200, { ok: true, deletedRows: result.affectedRows || 0 });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function adminRevokeUserSessions(req, res, userId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (String(admin.id) === String(userId)) {
    sendJson(res, 400, { error: "不能在用户详情里撤销当前管理员自己的会话。" });
    return;
  }
  try {
    const pool = await getMysql();
    const [result] = await pool.query(
      `DELETE FROM ${tableName("sessions")} WHERE user_id = ? AND expires_at > NOW()`,
      [userId]
    );
    await writeAdminAuditLog(pool, admin, "revoke_user_sessions", userId, { revokedSessions: result.affectedRows || 0 });
    sendJson(res, 200, { ok: true, revokedSessions: result.affectedRows || 0 });
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
    await writeAdminAuditLog(pool, admin, "delete_user", userId, {
      username: users[0].username,
      email: users[0].email,
    });
    await pool.query(`DELETE FROM ${tableName("users")} WHERE id = ?`, [userId]);
    sendJson(res, 200, { ok: true });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}
