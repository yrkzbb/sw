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
  try {
    const pool = await getMysql();
    const profile = await loadAccountProfile(pool, user.id);
    sendJson(res, 200, { user: publicUserWithProfile(user, profile) });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function loadAccountProfile(pool, userId) {
  const [rows] = await pool.query(
    `SELECT data_value FROM ${tableName("user_data")} WHERE user_id = ? AND data_key = ? LIMIT 1`,
    [userId, USER_DATA_KEYS.accountProfile]
  );
  return parseStoredJson(rows[0]?.data_value, {});
}

async function updateAuthProfile(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;

  const username = normalizeUsername(body.name || body.username || user.username);
  const email = normalizeEmail(body.email || user.email);
  const existingProfile = await getMysql()
    .then((pool) => loadAccountProfile(pool, user.id))
    .catch(() => ({}));
  const profile = normalizeAccountProfile({ ...existingProfile, ...(body.profile || {}) });
  if (!username || username.length < 2) {
    sendJson(res, 400, { error: "昵称至少需要 2 个字符。" });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    sendJson(res, 400, { error: "请输入有效邮箱。" });
    return;
  }

  try {
    const pool = await getMysql();
    const [existing] = await pool.query(
      `SELECT id FROM ${tableName("users")} WHERE (username = ? OR email = ?) AND id <> ? LIMIT 1`,
      [username, email, user.id]
    );
    if (existing.length) {
      sendJson(res, 409, { error: "昵称或邮箱已被其他账号使用。" });
      return;
    }
    await pool.query(`UPDATE ${tableName("users")} SET username = ?, email = ? WHERE id = ?`, [username, email, user.id]);
    await pool.query(
      `INSERT INTO ${tableName("user_data")} (user_id, data_key, data_value)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data_value = VALUES(data_value)`,
      [user.id, USER_DATA_KEYS.accountProfile, JSON.stringify(profile)]
    );
    const [rows] = await pool.query(
      `SELECT id, username, email, role, status, created_at, last_login_at FROM ${tableName("users")} WHERE id = ? LIMIT 1`,
      [user.id]
    );
    sendJson(res, 200, { user: publicUserWithProfile(rows[0], profile) });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function updateAuthPassword(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;

  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  const confirmPassword = String(body.confirmPassword || "");
  if (!currentPassword || !newPassword) {
    sendJson(res, 400, { error: "请填写当前密码和新密码。" });
    return;
  }
  if (newPassword.length < 8) {
    sendJson(res, 400, { error: "新密码至少需要 8 位。" });
    return;
  }
  if (newPassword !== confirmPassword) {
    sendJson(res, 400, { error: "两次输入的新密码不一致。" });
    return;
  }

  try {
    const pool = await getMysql();
    const [rows] = await pool.query(
      `SELECT id, password_salt, password_hash FROM ${tableName("users")} WHERE id = ? LIMIT 1`,
      [user.id]
    );
    const record = rows[0];
    if (!record || !verifyPassword(currentPassword, record.password_salt, record.password_hash)) {
      sendJson(res, 401, { error: "当前密码不正确。" });
      return;
    }
    const passwordData = hashPassword(newPassword);
    await pool.query(
      `UPDATE ${tableName("users")} SET password_salt = ?, password_hash = ? WHERE id = ?`,
      [passwordData.salt, passwordData.hash, user.id]
    );
    sendJson(res, 200, { ok: true });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
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

