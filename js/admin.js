const ADMIN_LAST_ACCOUNT_STORAGE = "WENJIE_ADMIN_LAST_ACCOUNT";

const state = {
  admin: null,
  users: [],
  selectedUserId: "",
  activePanel: "usersPanel",
  usersPage: 1,
  usersPagination: null,
  selectedUserIds: new Set(),
  auditPage: 1,
  auditPagination: null,
  modalConfirm: null,
  modalKeepOpen: false,
};

const el = {
  loginView: document.querySelector("#loginView"),
  dashboardView: document.querySelector("#dashboardView"),
  loginForm: document.querySelector("#loginForm"),
  loginAccount: document.querySelector("#loginAccount"),
  loginPassword: document.querySelector("#loginPassword"),
  loginMessage: document.querySelector("#loginMessage"),
  adminName: document.querySelector("#adminName"),
  logoutBtn: document.querySelector("#logoutBtn"),
  refreshBtn: document.querySelector("#refreshBtn"),
  panelTitle: document.querySelector("#panelTitle"),
  usersPanel: document.querySelector("#usersPanel"),
  statusPanel: document.querySelector("#statusPanel"),
  auditPanel: document.querySelector("#auditPanel"),
  usersBody: document.querySelector("#usersBody"),
  usersPager: document.querySelector("#usersPager"),
  detailPanel: document.querySelector("#detailPanel"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  roleFilter: document.querySelector("#roleFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  createUserBtn: document.querySelector("#createUserBtn"),
  bulkBar: document.querySelector("#bulkBar"),
  bulkSummary: document.querySelector("#bulkSummary"),
  bulkEnableBtn: document.querySelector("#bulkEnableBtn"),
  bulkDisableBtn: document.querySelector("#bulkDisableBtn"),
  bulkClearDataBtn: document.querySelector("#bulkClearDataBtn"),
  bulkClearSelectionBtn: document.querySelector("#bulkClearSelectionBtn"),
  selectAllUsers: document.querySelector("#selectAllUsers"),
  systemCards: document.querySelector("#systemCards"),
  systemDetailGrid: document.querySelector("#systemDetailGrid"),
  auditBody: document.querySelector("#auditBody"),
  auditPager: document.querySelector("#auditPager"),
  modalOverlay: document.querySelector("#modalOverlay"),
  modalEyebrow: document.querySelector("#modalEyebrow"),
  modalTitle: document.querySelector("#modalTitle"),
  modalBody: document.querySelector("#modalBody"),
  modalMessage: document.querySelector("#modalMessage"),
  modalCloseBtn: document.querySelector("#modalCloseBtn"),
  modalCancelBtn: document.querySelector("#modalCancelBtn"),
  modalConfirmBtn: document.querySelector("#modalConfirmBtn"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "从未";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `请求失败：${res.status}`);
  return data;
}

function showLogin(message = "", options = {}) {
  state.admin = null;
  if (options.clearFields) {
    el.loginAccount.value = "";
    el.loginPassword.value = "";
  } else {
    el.loginPassword.value = "";
    restoreLoginAccount();
  }
  syncLoginFieldState();
  el.loginView.hidden = false;
  el.dashboardView.hidden = true;
  el.loginMessage.textContent = message;
}

function showDashboard(admin) {
  state.admin = admin;
  el.adminName.textContent = admin?.name || "管理员";
  el.loginView.hidden = true;
  el.dashboardView.hidden = false;
}

async function checkSession() {
  try {
    const payload = await api("/api/admin/me");
    showDashboard(payload.user);
    await Promise.all([loadUsers(), loadSystemStatus()]);
  } catch {
    showLogin();
  }
}

async function login(e) {
  e.preventDefault();
  el.loginMessage.textContent = "";
  const account = el.loginAccount.value.trim();
  if (account) localStorage.setItem(ADMIN_LAST_ACCOUNT_STORAGE, account);
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        account,
        password: el.loginPassword.value,
      }),
    });
    const payload = await api("/api/admin/me");
    showDashboard(payload.user);
    el.loginPassword.value = "";
    await Promise.all([loadUsers(), loadSystemStatus()]);
  } catch (err) {
    showLogin(String(err?.message || err));
  }
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  showLogin("", { clearFields: true });
}

function currentUsersQuery() {
  const params = new URLSearchParams();
  const q = el.searchInput.value.trim();
  const status = el.statusFilter.value;
  const role = el.roleFilter.value;
  const sort = el.sortSelect.value;
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (role) params.set("role", role);
  if (sort) params.set("sort", sort);
  params.set("page", String(state.usersPage));
  params.set("pageSize", "12");
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

async function loadUsers() {
  const payload = await api(`/api/admin/users${currentUsersQuery()}`);
  state.users = payload.users || [];
  state.usersPagination = payload.pagination || null;
  renderUsers();
  renderUsersPager();
  if (state.selectedUserId) {
    const stillExists = state.users.some((user) => String(user.id) === String(state.selectedUserId));
    if (stillExists) await loadUserDetail(state.selectedUserId);
    else renderEmptyDetail();
  }
}

function renderPager(root, pagination, pageAction) {
  if (!root || !pagination) return;
  const page = Number(pagination.page || 1);
  const totalPages = Number(pagination.totalPages || 1);
  const total = Number(pagination.total || 0);
  root.innerHTML = `
    <div class="pager-summary">共 ${total} 条，第 ${page} / ${totalPages} 页</div>
    <div class="pager-actions">
      <button class="ghost-btn" type="button" data-page-action="${pageAction}" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一页</button>
      <button class="ghost-btn" type="button" data-page-action="${pageAction}" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>下一页</button>
    </div>
  `;
}

function renderUsersPager() {
  renderPager(el.usersPager, state.usersPagination, "users");
}

function renderUsers() {
  if (!state.users.length) {
    el.usersBody.innerHTML = `<tr><td colspan="10" class="muted">暂无匹配用户</td></tr>`;
    renderBulkBar();
    return;
  }
  el.usersBody.innerHTML = state.users.map((user) => {
    const overview = user.overview || {};
    const checked = state.selectedUserIds.has(String(user.id)) ? "checked" : "";
    return `
      <tr data-user-id="${escapeHtml(user.id)}" class="${String(user.id) === String(state.selectedUserId) ? "selected" : ""}">
        <td class="select-col"><input class="user-select-checkbox" type="checkbox" data-select-user-id="${escapeHtml(user.id)}" aria-label="选择 ${escapeHtml(user.name)}" ${checked} /></td>
        <td class="user-cell"><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.email)}</span></td>
        <td><span class="badge ${escapeHtml(user.role)}">${user.role === "admin" ? "管理员" : "用户"}</span></td>
        <td><span class="badge ${escapeHtml(user.status)}">${user.status === "disabled" ? "禁用" : "启用"}</span></td>
        <td>${escapeHtml(formatDate(user.createdAt))}</td>
        <td>${escapeHtml(formatDate(user.lastLoginAt))}</td>
        <td>${Number(overview.conversationCount || 0)}</td>
        <td>${Number(overview.mistakeCount || 0)}</td>
        <td>${Number(overview.resourceCount || 0)}</td>
        <td><span class="badge ${overview.profileGenerated ? "yes" : "no"}">${overview.profileGenerated ? "已生成" : "未生成"}</span></td>
      </tr>
    `;
  }).join("");
  renderBulkBar();
}

function renderBulkBar() {
  const count = state.selectedUserIds.size;
  el.bulkBar.hidden = count === 0;
  el.bulkSummary.textContent = `已选择 ${count} 个用户`;
  const currentIds = state.users.map((user) => String(user.id));
  const currentChecked = currentIds.length > 0 && currentIds.every((id) => state.selectedUserIds.has(id));
  el.selectAllUsers.checked = currentChecked;
  el.selectAllUsers.indeterminate = !currentChecked && currentIds.some((id) => state.selectedUserIds.has(id));
}

function renderEmptyDetail() {
  state.selectedUserId = "";
  el.detailPanel.innerHTML = `<div class="empty-detail">选择一个用户查看详情</div>`;
  renderUsers();
}

async function loadUserDetail(userId) {
  state.selectedUserId = String(userId);
  renderUsers();
  const payload = await api(`/api/admin/users/${encodeURIComponent(userId)}`);
  renderUserDetail(payload.user, payload.dataKeys || []);
}

function renderUserDetail(user, dataKeys) {
  const overview = user.overview || {};
  const statusText = user.status === "disabled" ? "启用用户" : "禁用用户";
  const statusIcon = user.status === "disabled" ? "✓" : "⊘";
  const roleText = user.role === "admin" ? "设为普通用户" : "设为管理员";
  el.detailPanel.innerHTML = `
    <div class="detail-head">
      <div>
        <h3>${escapeHtml(user.name)}</h3>
        <p>${escapeHtml(user.email)}</p>
      </div>
      <span class="badge ${escapeHtml(user.status)}">${user.status === "disabled" ? "禁用" : "启用"}</span>
    </div>
    <div class="metric-grid">
      <div class="metric"><span>对话数量</span><strong>${Number(overview.conversationCount || 0)}</strong></div>
      <div class="metric"><span>错题数量</span><strong>${Number(overview.mistakeCount || 0)}</strong></div>
      <div class="metric"><span>资源数量</span><strong>${Number(overview.resourceCount || 0)}</strong></div>
      <div class="metric"><span>数据量</span><strong>${escapeHtml(formatBytes(overview.dataBytes))}</strong></div>
    </div>
    <div class="detail-list">
      <div><span>角色</span><strong>${user.role === "admin" ? "管理员" : "普通用户"}</strong></div>
      <div><span>注册时间</span><strong>${escapeHtml(formatDate(user.createdAt))}</strong></div>
      <div><span>最近登录</span><strong>${escapeHtml(formatDate(user.lastLoginAt))}</strong></div>
      <div><span>画像状态</span><strong>${overview.profileGenerated ? "已生成" : "未生成"}</strong></div>
      <div><span>数据键</span><strong>${Number(overview.dataKeyCount || dataKeys.length || 0)} 个</strong></div>
      <div><span>最近数据更新</span><strong>${escapeHtml(formatDate(overview.lastDataUpdatedAt))}</strong></div>
    </div>
    <div class="actions">
      <button class="action-btn" type="button" data-action="export-data">⇩ 导出数据</button>
      <button class="action-btn" type="button" data-action="toggle-status">${statusIcon} ${statusText}</button>
      <button class="action-btn" type="button" data-action="toggle-role">♚ ${roleText}</button>
      <button class="action-btn" type="button" data-action="reset-password">↺ 重置密码</button>
      <button class="action-btn danger" type="button" data-action="clear-data">⌫ 清空数据</button>
      <button class="action-btn danger" type="button" data-action="delete-user">× 删除账号</button>
    </div>
    <section class="data-key-section">
      <h4>数据键</h4>
      <div class="data-key-list">
        ${dataKeys.length ? dataKeys.map((item) => `
          <div>
            <strong>${escapeHtml(item.key)}</strong>
            <span>${escapeHtml(formatBytes(item.bytes))} · ${escapeHtml(formatDate(item.updatedAt))}</span>
          </div>
        `).join("") : `<p class="muted">暂无学习数据</p>`}
      </div>
    </section>
  `;
}

function modalField(name) {
  return el.modalOverlay.querySelector(`[name="${name}"]`)?.value || "";
}

function showModal({ title, eyebrow = "ADMIN ACTION", body, confirmText = "确认", danger = false, onConfirm }) {
  state.modalConfirm = onConfirm;
  state.modalKeepOpen = false;
  el.modalEyebrow.textContent = eyebrow;
  el.modalTitle.textContent = title;
  el.modalBody.innerHTML = body;
  el.modalMessage.textContent = "";
  el.modalConfirmBtn.textContent = confirmText;
  el.modalConfirmBtn.classList.toggle("danger-primary", danger);
  el.modalOverlay.hidden = false;
  window.setTimeout(() => {
    el.modalOverlay.querySelector("input, select, textarea, button")?.focus();
  }, 0);
}

function closeModal() {
  state.modalConfirm = null;
  state.modalKeepOpen = false;
  el.modalOverlay.hidden = true;
  el.modalBody.innerHTML = "";
  el.modalMessage.textContent = "";
}

async function confirmModal() {
  if (!state.modalConfirm) return;
  el.modalMessage.textContent = "";
  el.modalConfirmBtn.disabled = true;
  try {
    await state.modalConfirm();
    if (state.modalKeepOpen) {
      state.modalKeepOpen = false;
    } else {
      closeModal();
    }
  } catch (err) {
    el.modalMessage.textContent = String(err?.message || err);
  } finally {
    el.modalConfirmBtn.disabled = false;
  }
}

async function handleDetailAction(action) {
  if (!state.selectedUserId) return;
  const user = state.users.find((item) => String(item.id) === String(state.selectedUserId));
  if (!user) return;
  if (action === "export-data") {
    await exportUserData(user);
  }
  if (action === "toggle-status") {
    const next = user.status === "disabled" ? "active" : "disabled";
    showModal({
      title: next === "disabled" ? "禁用用户" : "启用用户",
      body: `<p class="modal-copy">确认${next === "disabled" ? "禁用" : "启用"} <strong>${escapeHtml(user.name)}</strong>？${next === "disabled" ? "禁用后该用户会被退出登录。" : ""}</p>`,
      confirmText: next === "disabled" ? "禁用" : "启用",
      danger: next === "disabled",
      onConfirm: async () => {
        await api(`/api/admin/users/${user.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: next }),
        });
        await loadUsers();
      },
    });
  }
  if (action === "toggle-role") {
    const next = user.role === "admin" ? "user" : "admin";
    const text = next === "admin" ? "设为管理员" : "降为普通用户";
    showModal({
      title: text,
      body: `<p class="modal-copy">确认将 <strong>${escapeHtml(user.name)}</strong> ${text}？</p>`,
      confirmText: "确认",
      onConfirm: async () => {
        await api(`/api/admin/users/${user.id}/role`, {
          method: "PATCH",
          body: JSON.stringify({ role: next }),
        });
        await loadUsers();
      },
    });
  }
  if (action === "reset-password") {
    showModal({
      title: "重置密码",
      body: `
        <p class="modal-copy">为 <strong>${escapeHtml(user.name)}</strong> 设置新密码。留空会自动生成临时密码。</p>
        <label class="modal-field"><span>新密码</span><input name="password" type="text" autocomplete="off" placeholder="至少 8 位，留空自动生成" /></label>
      `,
      confirmText: "重置",
      onConfirm: async () => {
        const payload = await api(`/api/admin/users/${user.id}/reset-password`, {
          method: "POST",
          body: JSON.stringify({ password: modalField("password").trim() }),
        });
        state.modalKeepOpen = true;
        el.modalEyebrow.textContent = "RESULT";
        el.modalTitle.textContent = "新密码已生成";
        el.modalBody.innerHTML = `<p class="modal-copy">请记录临时密码：</p><div class="secret-result">${escapeHtml(payload.temporaryPassword)}</div>`;
        el.modalConfirmBtn.textContent = "我已记录";
        el.modalConfirmBtn.classList.remove("danger-primary");
        state.modalConfirm = async () => {};
      },
    });
  }
  if (action === "clear-data") {
    showModal({
      title: "清空用户数据",
      body: `<p class="modal-copy">确认清空 <strong>${escapeHtml(user.name)}</strong> 的全部学习数据？账号本身会保留。</p>`,
      confirmText: "清空数据",
      danger: true,
      onConfirm: async () => {
        await api(`/api/admin/users/${user.id}/data`, { method: "DELETE" });
        await loadUsers();
      },
    });
  }
  if (action === "delete-user") {
    showModal({
      title: "删除账号",
      body: `
        <p class="modal-copy">删除 <strong>${escapeHtml(user.name)}</strong> 会同时删除该账号全部会话和学习数据。</p>
        <label class="modal-field"><span>输入用户名或邮箱确认</span><input name="confirm" type="text" autocomplete="off" /></label>
      `,
      confirmText: "删除账号",
      danger: true,
      onConfirm: async () => {
        await api(`/api/admin/users/${user.id}`, {
          method: "DELETE",
          body: JSON.stringify({ confirm: modalField("confirm").trim() }),
        });
        renderEmptyDetail();
        await loadUsers();
      },
    });
  }
}

async function createUser() {
  showModal({
    title: "新增账号",
    body: `
      <div class="modal-grid">
        <label class="modal-field"><span>用户名</span><input name="username" type="text" autocomplete="off" /></label>
        <label class="modal-field"><span>邮箱</span><input name="email" type="email" autocomplete="off" /></label>
        <label class="modal-field"><span>初始密码</span><input name="password" type="text" autocomplete="off" placeholder="至少 8 位" /></label>
        <label class="modal-field"><span>角色</span><select name="role"><option value="user">普通用户</option><option value="admin">管理员</option></select></label>
      </div>
    `,
    confirmText: "创建",
    onConfirm: async () => {
      const payload = await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          username: modalField("username").trim(),
          email: modalField("email").trim(),
          password: modalField("password"),
          role: modalField("role"),
          status: "active",
        }),
      });
      state.selectedUserId = String(payload.user?.id || "");
      state.usersPage = 1;
      await loadUsers();
      if (state.selectedUserId) await loadUserDetail(state.selectedUserId);
    },
  });
}

async function loadSystemStatus() {
  const payload = await api("/api/admin/status");
  const mysql = payload.mysql || {};
  const users = payload.users || {};
  const data = payload.data || {};
  const recentLogins = payload.recentLogins || [];
  const recentAuditLogs = payload.recentAuditLogs || [];
  el.systemCards.innerHTML = `
    <article class="status-card"><span>MySQL</span><strong>${mysql.connected ? "正常" : "异常"}</strong><p class="muted">${escapeHtml(mysql.error || "连接可用")}</p></article>
    <article class="status-card"><span>用户总数</span><strong>${Number(users.totalUsers || 0)}</strong><p class="muted">启用 ${Number(users.activeUsers || 0)}，禁用 ${Number(users.disabledUsers || 0)}</p></article>
    <article class="status-card"><span>管理员</span><strong>${Number(users.adminUsers || 0)}</strong><p class="muted">独立 role 管理</p></article>
    <article class="status-card"><span>数据总量</span><strong>${escapeHtml(formatBytes(data.dataBytes))}</strong><p class="muted">${Number(data.dataRows || 0)} 条用户数据</p></article>
  `;
  el.systemDetailGrid.innerHTML = `
    <section class="status-section">
      <h3>最近登录</h3>
      <div class="compact-list">
        ${recentLogins.length ? recentLogins.map((user) => `
          <div><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(formatDate(user.lastLoginAt))}</span></div>
        `).join("") : `<p class="muted">暂无登录记录</p>`}
      </div>
    </section>
    <section class="status-section">
      <h3>最近操作</h3>
      <div class="compact-list">
        ${recentAuditLogs.length ? recentAuditLogs.map(renderAuditListItem).join("") : `<p class="muted">暂无操作日志</p>`}
      </div>
    </section>
  `;
}

function auditActionText(action) {
  return ({
    create_user: "新增账号",
    disable_user: "禁用用户",
    enable_user: "启用用户",
    set_user_role: "调整角色",
    reset_password: "重置密码",
    clear_user_data: "清空数据",
    delete_user: "删除账号",
    export_user_data: "导出数据",
    bulk_enable_user: "批量启用",
    bulk_disable_user: "批量禁用",
    bulk_clear_user_data: "批量清空数据",
  })[action] || action || "操作";
}

function renderAuditListItem(log) {
  return `
    <div>
      <strong>${escapeHtml(auditActionText(log.action))}</strong>
      <span>${escapeHtml(log.admin_username || "未知管理员")} → ${escapeHtml(log.target_username || "已删除用户")} · ${escapeHtml(formatDate(log.created_at))}</span>
    </div>
  `;
}

function renderAuditDetail(detail) {
  const value = typeof detail === "string" ? detail : JSON.stringify(detail || {});
  return value === "{}" ? "" : value;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportUserData(user) {
  const payload = await api(`/api/admin/users/${encodeURIComponent(user.id)}/export`);
  const safeName = String(user.name || user.id).replace(/[^\w.-]+/g, "_");
  downloadJson(`wenjie-user-${safeName}-${new Date().toISOString().slice(0, 10)}.json`, payload);
  await loadAuditLogs().catch(() => {});
}

function selectedUserList() {
  return [...state.selectedUserIds];
}

async function runBulkAction(action) {
  const ids = selectedUserList();
  if (!ids.length) return;
  const titleMap = {
    enable: "批量启用用户",
    disable: "批量禁用用户",
    clear_data: "批量清空数据",
  };
  const copyMap = {
    enable: `确认启用已选择的 ${ids.length} 个用户？`,
    disable: `确认禁用已选择的 ${ids.length} 个用户？禁用后这些用户会被退出登录。`,
    clear_data: `确认清空已选择的 ${ids.length} 个用户的全部学习数据？账号本身会保留。`,
  };
  showModal({
    title: titleMap[action],
    body: `<p class="modal-copy">${copyMap[action]}</p>`,
    confirmText: action === "clear_data" ? "清空数据" : "确认",
    danger: action !== "enable",
    onConfirm: async () => {
      await api("/api/admin/users/bulk", {
        method: "POST",
        body: JSON.stringify({ action, userIds: ids }),
      });
      state.selectedUserIds.clear();
      await loadUsers();
      await loadSystemStatus().catch(() => {});
    },
  });
}

async function loadAuditLogs() {
  const payload = await api(`/api/admin/audit-logs?page=${state.auditPage}&pageSize=12`);
  const logs = payload.logs || [];
  state.auditPagination = payload.pagination || null;
  el.auditBody.innerHTML = logs.length ? logs.map((log) => `
    <tr>
      <td>${escapeHtml(formatDate(log.created_at))}</td>
      <td>${escapeHtml(log.admin_username || "未知管理员")}</td>
      <td>${escapeHtml(auditActionText(log.action))}</td>
      <td>${escapeHtml(log.target_username || "已删除用户")}</td>
      <td class="audit-detail">${escapeHtml(renderAuditDetail(log.detail))}</td>
    </tr>
  `).join("") : `<tr><td colspan="5" class="muted">暂无操作日志</td></tr>`;
  renderPager(el.auditPager, state.auditPagination, "audit");
}

async function refreshActivePanel() {
  if (state.activePanel === "usersPanel") await loadUsers();
  if (state.activePanel === "statusPanel") await loadSystemStatus();
  if (state.activePanel === "auditPanel") await loadAuditLogs();
}

function switchPanel(panelId) {
  state.activePanel = panelId;
  el.usersPanel.hidden = panelId !== "usersPanel";
  el.statusPanel.hidden = panelId !== "statusPanel";
  el.auditPanel.hidden = panelId !== "auditPanel";
  el.panelTitle.textContent = panelId === "statusPanel" ? "系统状态" : panelId === "auditPanel" ? "操作日志" : "用户管理";
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-panel") === panelId);
  });
  refreshActivePanel().catch((err) => window.alert(String(err?.message || err)));
}

function debounce(fn, wait = 260) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

function syncLoginFieldState() {
  document.querySelectorAll(".login-box input").forEach((input) => {
    input.closest(".login-box")?.classList.toggle("filled", !!input.value);
  });
}

function restoreLoginAccount() {
  const account = localStorage.getItem(ADMIN_LAST_ACCOUNT_STORAGE) || "";
  if (account && !el.loginAccount.value) el.loginAccount.value = account;
}

el.loginForm.addEventListener("submit", login);
el.loginAccount.addEventListener("input", syncLoginFieldState);
el.loginPassword.addEventListener("input", syncLoginFieldState);
el.loginAccount.addEventListener("change", syncLoginFieldState);
el.loginPassword.addEventListener("change", syncLoginFieldState);
el.logoutBtn.addEventListener("click", logout);
el.refreshBtn.addEventListener("click", () => refreshActivePanel().catch((err) => window.alert(String(err?.message || err))));
el.createUserBtn.addEventListener("click", () => createUser().catch((err) => window.alert(String(err?.message || err))));
el.searchInput.addEventListener("input", debounce(() => {
  state.usersPage = 1;
  loadUsers().catch((err) => window.alert(String(err?.message || err)));
}));
el.statusFilter.addEventListener("change", () => {
  state.usersPage = 1;
  loadUsers().catch((err) => window.alert(String(err?.message || err)));
});
el.roleFilter.addEventListener("change", () => {
  state.usersPage = 1;
  loadUsers().catch((err) => window.alert(String(err?.message || err)));
});
el.sortSelect.addEventListener("change", () => {
  state.usersPage = 1;
  loadUsers().catch((err) => window.alert(String(err?.message || err)));
});
el.usersBody.addEventListener("click", (e) => {
  const checkbox = e.target.closest("[data-select-user-id]");
  if (checkbox) {
    const id = String(checkbox.getAttribute("data-select-user-id") || "");
    if (checkbox.checked) state.selectedUserIds.add(id);
    else state.selectedUserIds.delete(id);
    renderBulkBar();
    return;
  }
  const row = e.target.closest("[data-user-id]");
  if (row) loadUserDetail(row.getAttribute("data-user-id")).catch((err) => window.alert(String(err?.message || err)));
});
el.selectAllUsers.addEventListener("change", () => {
  state.users.forEach((user) => {
    const id = String(user.id);
    if (el.selectAllUsers.checked) state.selectedUserIds.add(id);
    else state.selectedUserIds.delete(id);
  });
  renderUsers();
});
el.bulkEnableBtn.addEventListener("click", () => runBulkAction("enable").catch((err) => window.alert(String(err?.message || err))));
el.bulkDisableBtn.addEventListener("click", () => runBulkAction("disable").catch((err) => window.alert(String(err?.message || err))));
el.bulkClearDataBtn.addEventListener("click", () => runBulkAction("clear_data").catch((err) => window.alert(String(err?.message || err))));
el.bulkClearSelectionBtn.addEventListener("click", () => {
  state.selectedUserIds.clear();
  renderUsers();
});
document.addEventListener("click", (e) => {
  const pagerBtn = e.target.closest("[data-page-action]");
  if (!pagerBtn || pagerBtn.disabled) return;
  const page = Number(pagerBtn.getAttribute("data-page") || 1);
  if (pagerBtn.getAttribute("data-page-action") === "users") {
    state.usersPage = page;
    loadUsers().catch((err) => window.alert(String(err?.message || err)));
  }
  if (pagerBtn.getAttribute("data-page-action") === "audit") {
    state.auditPage = page;
    loadAuditLogs().catch((err) => window.alert(String(err?.message || err)));
  }
});
el.detailPanel.addEventListener("click", (e) => {
  const button = e.target.closest("[data-action]");
  if (button) handleDetailAction(button.getAttribute("data-action")).catch((err) => window.alert(String(err?.message || err)));
});
el.modalCloseBtn.addEventListener("click", closeModal);
el.modalCancelBtn.addEventListener("click", closeModal);
el.modalConfirmBtn.addEventListener("click", confirmModal);
el.modalOverlay.addEventListener("click", (e) => {
  if (e.target === el.modalOverlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !el.modalOverlay.hidden) closeModal();
});
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => switchPanel(btn.getAttribute("data-panel")));
});

restoreLoginAccount();
syncLoginFieldState();
window.setTimeout(syncLoginFieldState, 100);
window.setTimeout(syncLoginFieldState, 500);
checkSession();
