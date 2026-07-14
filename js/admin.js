const ADMIN_LAST_ACCOUNT_STORAGE = "WENJIE_ADMIN_LAST_ACCOUNT";
const ADMIN_SIDEBAR_WIDTH_STORAGE = "WENJIE_ADMIN_SIDEBAR_WIDTH";
const ADMIN_ACTIVE_PANEL_STORAGE = "WENJIE_ADMIN_ACTIVE_PANEL";
const SIDEBAR_MIN_WIDTH = 224;
const SIDEBAR_MAX_WIDTH = 380;
const ADMIN_PANEL_TITLES = {
  overviewPanel: "运营总览",
  usersPanel: "用户管理",
  announcementPanel: "公告管理",
  securityPanel: "安全中心",
  statusPanel: "系统状态",
  auditPanel: "操作日志",
};

const state = {
  admin: null,
  users: [],
  selectedUserId: "",
  activePanel: "overviewPanel",
  usersPage: 1,
  usersPagination: null,
  selectedUserIds: new Set(),
  auditPage: 1,
  auditPagination: null,
  sessionsPage: 1,
  sessionsPagination: null,
  announcements: [],
  modalConfirm: null,
  modalKeepOpen: false,
};

const el = {
  adminApp: document.querySelector(".admin-app"),
  loginView: document.querySelector("#loginView"),
  dashboardView: document.querySelector("#dashboardView"),
  sidebarResizer: document.querySelector(".sidebar-resizer"),
  loginForm: document.querySelector("#loginForm"),
  loginAccount: document.querySelector("#loginAccount"),
  loginPassword: document.querySelector("#loginPassword"),
  loginMessage: document.querySelector("#loginMessage"),
  adminName: document.querySelector("#adminName"),
  logoutBtn: document.querySelector("#logoutBtn"),
  refreshBtn: document.querySelector("#refreshBtn"),
  panelTitle: document.querySelector("#panelTitle"),
  sidebarSummaryTitle: document.querySelector(".sidebar-summary strong"),
  overviewPanel: document.querySelector("#overviewPanel"),
  overviewStats: document.querySelector("#overviewStats"),
  attentionUsers: document.querySelector("#attentionUsers"),
  heavyUsers: document.querySelector("#heavyUsers"),
  signupTrend: document.querySelector("#signupTrend"),
  dataKeyStats: document.querySelector("#dataKeyStats"),
  usersPanel: document.querySelector("#usersPanel"),
  announcementPanel: document.querySelector("#announcementPanel"),
  announcementStatusFilter: document.querySelector("#announcementStatusFilter"),
  createAnnouncementBtn: document.querySelector("#createAnnouncementBtn"),
  announcementList: document.querySelector("#announcementList"),
  securityPanel: document.querySelector("#securityPanel"),
  statusPanel: document.querySelector("#statusPanel"),
  auditPanel: document.querySelector("#auditPanel"),
  usersBody: document.querySelector("#usersBody"),
  usersPager: document.querySelector("#usersPager"),
  detailPanel: document.querySelector("#detailPanel"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  roleFilter: document.querySelector("#roleFilter"),
  loginFilter: document.querySelector("#loginFilter"),
  dataFilter: document.querySelector("#dataFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  createUserBtn: document.querySelector("#createUserBtn"),
  exportUsersBtn: document.querySelector("#exportUsersBtn"),
  bulkBar: document.querySelector("#bulkBar"),
  bulkSummary: document.querySelector("#bulkSummary"),
  bulkEnableBtn: document.querySelector("#bulkEnableBtn"),
  bulkDisableBtn: document.querySelector("#bulkDisableBtn"),
  bulkClearDataBtn: document.querySelector("#bulkClearDataBtn"),
  bulkClearSelectionBtn: document.querySelector("#bulkClearSelectionBtn"),
  selectAllUsers: document.querySelector("#selectAllUsers"),
  securityCards: document.querySelector("#securityCards"),
  sessionSearchInput: document.querySelector("#sessionSearchInput"),
  sessionStatusFilter: document.querySelector("#sessionStatusFilter"),
  cleanupSessionsBtn: document.querySelector("#cleanupSessionsBtn"),
  sessionsBody: document.querySelector("#sessionsBody"),
  sessionsPager: document.querySelector("#sessionsPager"),
  systemCards: document.querySelector("#systemCards"),
  systemDetailGrid: document.querySelector("#systemDetailGrid"),
  auditSearchInput: document.querySelector("#auditSearchInput"),
  auditActionFilter: document.querySelector("#auditActionFilter"),
  exportAuditBtn: document.querySelector("#exportAuditBtn"),
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
  el.adminApp?.classList.remove("auth-pending");
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
  el.adminApp?.classList.remove("auth-pending");
  el.adminName.textContent = admin?.name || "管理员";
  el.loginView.hidden = true;
  el.dashboardView.hidden = false;
}

function getSavedPanel() {
  const panelId = localStorage.getItem(ADMIN_ACTIVE_PANEL_STORAGE) || "overviewPanel";
  return ADMIN_PANEL_TITLES[panelId] ? panelId : "overviewPanel";
}

async function checkSession() {
  try {
    const payload = await api("/api/admin/me");
    showDashboard(payload.user);
    switchPanel(getSavedPanel(), { persist: false });
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
    switchPanel(getSavedPanel(), { persist: false });
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
  const login = el.loginFilter.value;
  const data = el.dataFilter.value;
  const sort = el.sortSelect.value;
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (role) params.set("role", role);
  if (login) params.set("login", login);
  if (data) params.set("data", data);
  if (sort) params.set("sort", sort);
  params.set("page", String(state.usersPage));
  params.set("pageSize", "12");
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

function currentSessionsQuery() {
  const params = new URLSearchParams();
  const q = el.sessionSearchInput.value.trim();
  const status = el.sessionStatusFilter.value;
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  params.set("page", String(state.sessionsPage));
  params.set("pageSize", "12");
  return `?${params.toString()}`;
}

function currentAuditQuery() {
  const params = new URLSearchParams();
  const q = el.auditSearchInput.value.trim();
  const action = el.auditActionFilter.value;
  if (q) params.set("q", q);
  if (action) params.set("action", action);
  params.set("page", String(state.auditPage));
  params.set("pageSize", "12");
  return `?${params.toString()}`;
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
    el.usersBody.innerHTML = `<tr><td colspan="11" class="muted">暂无匹配用户</td></tr>`;
    renderBulkBar();
    return;
  }
  el.usersBody.innerHTML = state.users.map((user) => {
    const overview = user.overview || {};
    const checked = state.selectedUserIds.has(String(user.id)) ? "checked" : "";
    const risk = userRisk(user);
    return `
      <tr data-user-id="${escapeHtml(user.id)}" class="${String(user.id) === String(state.selectedUserId) ? "selected" : ""}">
        <td class="select-col"><input class="user-select-checkbox" type="checkbox" data-select-user-id="${escapeHtml(user.id)}" aria-label="选择 ${escapeHtml(user.name)}" ${checked} /></td>
        <td class="user-cell"><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.email)}</span></td>
        <td><span class="badge risk-${escapeHtml(risk.level)}">${escapeHtml(risk.text)}</span></td>
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

function userRisk(user) {
  const overview = user.overview || {};
  if (user.status === "disabled") return { level: "disabled", text: "已禁用" };
  if (Number(user.activeSessionCount || 0) > 0) return { level: "online", text: "在线" };
  if (!user.lastLoginAt) return { level: "warn", text: "从未登录" };
  const lastLogin = new Date(user.lastLoginAt).getTime();
  if (Number.isFinite(lastLogin) && Date.now() - lastLogin > 30 * 24 * 60 * 60 * 1000) {
    return { level: "warn", text: "30天未活跃" };
  }
  if (!overview.profileGenerated && Number(overview.dataKeyCount || 0) > 0) {
    return { level: "info", text: "画像待生成" };
  }
  return { level: "ok", text: "正常" };
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
  renderUserDetail(payload.user, payload.dataKeys || [], payload.adminNote || {});
}

function renderUserDetail(user, dataKeys, adminNote = {}) {
  const overview = user.overview || {};
  const tags = Array.isArray(adminNote.tags) ? adminNote.tags : [];
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
      <div class="metric"><span>有效会话</span><strong>${Number(user.activeSessionCount || 0)}</strong></div>
    </div>
    <div class="detail-list">
      <div><span>角色</span><strong>${user.role === "admin" ? "管理员" : "普通用户"}</strong></div>
      <div><span>注册时间</span><strong>${escapeHtml(formatDate(user.createdAt))}</strong></div>
      <div><span>最近登录</span><strong>${escapeHtml(formatDate(user.lastLoginAt))}</strong></div>
      <div><span>画像状态</span><strong>${overview.profileGenerated ? "已生成" : "未生成"}</strong></div>
      <div><span>数据键</span><strong>${Number(overview.dataKeyCount || dataKeys.length || 0)} 个</strong></div>
      <div><span>最近数据更新</span><strong>${escapeHtml(formatDate(overview.lastDataUpdatedAt))}</strong></div>
      <div><span>安全状态</span><strong>${escapeHtml(userRisk(user).text)}</strong></div>
    </div>
    <section class="admin-note-section">
      <h4>运营标签与内部备注</h4>
      <div class="tag-list">${tags.length ? tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") : `<em>暂无标签</em>`}</div>
      <p>${escapeHtml(adminNote.note || "暂无内部备注")}</p>
      <small>${adminNote.updatedAt ? `更新于 ${escapeHtml(formatDate(adminNote.updatedAt))}${adminNote.updatedBy ? ` · ${escapeHtml(adminNote.updatedBy)}` : ""}` : "仅管理员可见"}</small>
    </section>
    <div class="actions">
      <button class="action-btn" type="button" data-action="edit-note">✎ 编辑备注</button>
      <button class="action-btn" type="button" data-action="export-data">⇩ 导出数据</button>
      <button class="action-btn" type="button" data-action="toggle-status">${statusIcon} ${statusText}</button>
      <button class="action-btn" type="button" data-action="toggle-role">♚ ${roleText}</button>
      <button class="action-btn" type="button" data-action="reset-password">↺ 重置密码</button>
      <button class="action-btn" type="button" data-action="revoke-sessions">⇥ 强制下线</button>
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
  el.modalOverlay.querySelector(".modal-panel")?.classList.toggle("wide-modal", !!el.modalBody.querySelector(".announcement-editor"));
  el.modalMessage.textContent = "";
  el.modalConfirmBtn.textContent = confirmText;
  el.modalConfirmBtn.classList.toggle("danger-primary", danger);
  el.modalOverlay.hidden = false;
  setupAnnouncementEditor();
  window.setTimeout(() => {
    el.modalOverlay.querySelector("input, select, textarea, button")?.focus();
  }, 0);
}

function closeModal() {
  state.modalConfirm = null;
  state.modalKeepOpen = false;
  el.modalOverlay.hidden = true;
  el.modalOverlay.querySelector(".modal-panel")?.classList.remove("wide-modal");
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
  if (action === "edit-note") {
    const detail = await api(`/api/admin/users/${encodeURIComponent(user.id)}`);
    const note = detail.adminNote || {};
    showModal({
      title: "编辑运营备注",
      body: `
        <p class="modal-copy">为 <strong>${escapeHtml(user.name)}</strong> 添加管理员内部可见的标签和备注。</p>
        <label class="modal-field"><span>标签</span><input name="tags" type="text" autocomplete="off" placeholder="逗号分隔，例如：重点关注, 付费用户" value="${escapeHtml((note.tags || []).join(", "))}" /></label>
        <label class="modal-field"><span>内部备注</span><textarea name="note" rows="5" placeholder="仅管理员可见">${escapeHtml(note.note || "")}</textarea></label>
      `,
      confirmText: "保存",
      onConfirm: async () => {
        await api(`/api/admin/users/${user.id}/note`, {
          method: "PATCH",
          body: JSON.stringify({
            tags: modalField("tags").split(",").map((tag) => tag.trim()).filter(Boolean),
            note: modalField("note"),
          }),
        });
        await loadUserDetail(user.id);
      },
    });
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
  if (action === "revoke-sessions") {
    showModal({
      title: "强制用户下线",
      body: `<p class="modal-copy">确认撤销 <strong>${escapeHtml(user.name)}</strong> 的全部有效会话？该用户需要重新登录。</p>`,
      confirmText: "强制下线",
      danger: true,
      onConfirm: async () => {
        await api(`/api/admin/users/${user.id}/sessions`, { method: "DELETE" });
        await loadUsers();
        await loadSecuritySessions().catch(() => {});
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

function renderNamedUserList(root, users, emptyText) {
  root.innerHTML = users.length ? users.map((user) => `
    <button class="compact-action" type="button" data-jump-user-id="${escapeHtml(user.id)}">
      <strong>${escapeHtml(user.name)}</strong>
      <span>${escapeHtml(user.meta || user.email || "")}</span>
    </button>
  `).join("") : `<p class="muted">${escapeHtml(emptyText)}</p>`;
}

function renderSignupTrend(days) {
  const max = Math.max(1, ...days.map((item) => Number(item.count || 0)));
  el.signupTrend.innerHTML = days.length ? days.map((item) => {
    const count = Number(item.count || 0);
    return `
      <div class="trend-row">
        <span>${escapeHtml(item.day)}</span>
        <div class="trend-track"><i style="width: ${Math.max(4, Math.round((count / max) * 100))}%"></i></div>
        <strong>${count}</strong>
      </div>
    `;
  }).join("") : `<p class="muted">暂无新增数据</p>`;
}

async function loadOverview() {
  const payload = await api("/api/admin/overview");
  const users = payload.users || {};
  const activity = payload.activity || {};
  const data = payload.data || {};
  el.overviewStats.innerHTML = `
    <article class="status-card"><span>用户总数</span><strong>${Number(users.totalUsers || 0)}</strong><p class="muted">近 7 天新增 ${Number(users.newUsers7d || 0)}</p></article>
    <article class="status-card"><span>7 日活跃</span><strong>${Number(activity.activeUsers7d || 0)}</strong><p class="muted">今日活跃 ${Number(activity.activeUsers1d || 0)}</p></article>
    <article class="status-card"><span>待关注</span><strong>${Number(activity.attentionUsers || 0)}</strong><p class="muted">30 天未登录或从未登录</p></article>
    <article class="status-card"><span>学习数据</span><strong>${escapeHtml(formatBytes(data.dataBytes))}</strong><p class="muted">${Number(data.dataRows || 0)} 条记录</p></article>
  `;
  renderNamedUserList(el.attentionUsers, (payload.attentionUsers || []).map((user) => ({
    ...user,
    meta: user.lastLoginAt ? `最近登录 ${formatDate(user.lastLoginAt)}` : "从未登录",
  })), "暂无需要关注的用户");
  renderNamedUserList(el.heavyUsers, (payload.heavyUsers || []).map((user) => ({
    ...user,
    meta: `${formatBytes(user.dataBytes)} · ${Number(user.dataRows || 0)} 条数据`,
  })), "暂无学习数据");
  renderSignupTrend(payload.signupTrend || []);
  el.dataKeyStats.innerHTML = (payload.dataKeyStats || []).length ? payload.dataKeyStats.map((item) => `
    <div>
      <strong>${escapeHtml(item.key)}</strong>
      <span>${Number(item.rows || 0)} 条 · ${escapeHtml(formatBytes(item.bytes))}</span>
    </div>
  `).join("") : `<p class="muted">暂无数据键</p>`;
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

async function loadSecuritySessions() {
  const payload = await api(`/api/admin/sessions${currentSessionsQuery()}`);
  const sessions = payload.sessions || [];
  const summary = payload.summary || {};
  state.sessionsPagination = payload.pagination || null;
  el.securityCards.innerHTML = `
    <article class="status-card"><span>有效会话</span><strong>${Number(summary.activeSessions || 0)}</strong><p class="muted">${Number(summary.activeUsers || 0)} 个在线用户</p></article>
    <article class="status-card"><span>过期会话</span><strong>${Number(summary.expiredSessions || 0)}</strong><p class="muted">可一键清理</p></article>
    <article class="status-card"><span>管理员会话</span><strong>${Number(summary.adminSessions || 0)}</strong><p class="muted">含当前管理员</p></article>
    <article class="status-card"><span>最近创建</span><strong>${escapeHtml(formatDate(summary.latestSessionAt))}</strong><p class="muted">会话创建时间</p></article>
  `;
  el.sessionsBody.innerHTML = sessions.length ? sessions.map((session) => `
    <tr>
      <td class="user-cell"><strong>${escapeHtml(session.user?.name || "未知用户")}</strong><span>${escapeHtml(session.user?.email || "")}</span></td>
      <td><span class="badge ${escapeHtml(session.user?.role || "user")}">${session.user?.role === "admin" ? "管理员" : "用户"}</span></td>
      <td><span class="session-id">${escapeHtml(session.idPreview)}</span>${session.isCurrent ? `<span class="badge risk-online">当前</span>` : ""}</td>
      <td>${escapeHtml(formatDate(session.createdAt))}</td>
      <td>${escapeHtml(formatDate(session.expiresAt))}</td>
      <td><span class="badge ${session.expired ? "disabled" : "active"}">${session.expired ? "过期" : "有效"}</span></td>
      <td><button class="ghost-btn danger-text" type="button" data-revoke-session-id="${escapeHtml(session.id)}" ${session.isCurrent ? "disabled" : ""}>撤销</button></td>
    </tr>
  `).join("") : `<tr><td colspan="7" class="muted">暂无匹配会话</td></tr>`;
  renderPager(el.sessionsPager, state.sessionsPagination, "sessions");
}

function cleanupExpiredSessions() {
  showModal({
    title: "清理过期会话",
    body: `<p class="modal-copy">确认删除全部已过期会话？有效登录不会受影响。</p>`,
    confirmText: "清理",
    danger: true,
    onConfirm: async () => {
      await api("/api/admin/sessions/expired", { method: "DELETE" });
      await loadSecuritySessions();
      await loadOverview().catch(() => {});
    },
  });
}

function revokeSession(sessionId) {
  showModal({
    title: "撤销会话",
    body: `<p class="modal-copy">确认撤销该会话？对应用户需要重新登录。</p>`,
    confirmText: "撤销",
    danger: true,
    onConfirm: async () => {
      await api(`/api/admin/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
      await loadSecuritySessions();
      await loadUsers().catch(() => {});
    },
  });
}

async function loadAnnouncements() {
  const status = el.announcementStatusFilter.value;
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  const payload = await api(`/api/admin/announcements${suffix}`);
  state.announcements = payload.announcements || [];
  renderAnnouncements();
}

function renderAnnouncements() {
  el.announcementList.innerHTML = state.announcements.length ? state.announcements.map((item) => `
    <article class="announcement-card" data-announcement-id="${escapeHtml(item.id)}">
      <div>
        <div class="announcement-meta">
          <span class="badge ${escapeHtml(item.status)}">${escapeHtml(announcementStatusText(item.status))}</span>
          <span class="badge announce-${escapeHtml(item.level)}">${escapeHtml(announcementLevelText(item.level))}</span>
          <span>${escapeHtml(formatDate(item.updatedAt))}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <div class="announcement-markdown">${renderAnnouncementMarkdown(item.content)}</div>
        <small>${item.startsAt ? `开始 ${escapeHtml(formatDate(item.startsAt))}` : "立即生效"} · ${item.endsAt ? `结束 ${escapeHtml(formatDate(item.endsAt))}` : "长期有效"}</small>
      </div>
      <div class="announcement-actions">
        ${item.status === "published"
          ? `<button class="ghost-btn" type="button" data-announcement-action="archive">下架</button>`
          : `<button class="primary-btn compact-primary" type="button" data-announcement-action="publish">发布</button>`}
        <button class="ghost-btn" type="button" data-announcement-action="edit">编辑</button>
        <button class="ghost-btn danger-text" type="button" data-announcement-action="delete">删除</button>
      </div>
    </article>
  `).join("") : `<div class="empty-detail">暂无公告</div>`;
}

function renderAnnouncementInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, href) => {
      const rawHref = href.replace(/&amp;/g, "&");
      if (!/^(https?:\/\/|mailto:|\/|#)/i.test(rawHref)) return label;
      return `<a href="${escapeHtml(rawHref)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
}

function renderAnnouncementMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    html.push(`<ul>${listItems.map((item) => `<li>${renderAnnouncementInlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      listItems.push(listMatch[1]);
      continue;
    }
    flushList();
    if (!trimmed) continue;
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      html.push(`<h4>${renderAnnouncementInlineMarkdown(heading[2])}</h4>`);
      continue;
    }
    const quote = trimmed.match(/^>\s?(.+)$/);
    if (quote) {
      html.push(`<blockquote>${renderAnnouncementInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }
    html.push(`<p>${renderAnnouncementInlineMarkdown(trimmed)}</p>`);
  }
  flushList();
  return html.join("") || `<p class="muted">暂无公告内容</p>`;
}

function announcementStatusText(status) {
  return ({ draft: "草稿", published: "已发布", archived: "已归档" })[status] || status || "草稿";
}

function announcementLevelText(level) {
  return ({ info: "通知", success: "正常", warning: "提醒", danger: "紧急" })[level] || level || "通知";
}

function announcementFormBody(item = {}) {
  return `
    <p class="modal-hint">发布后会显示在已登录用户首页顶部；草稿不展示。可直接输入文字，也可以用下方按钮快速排版。</p>
    <div class="modal-grid">
      <label class="modal-field"><span>标题</span><input name="title" type="text" value="${escapeHtml(item.title || "")}" /></label>
      <label class="modal-field"><span>状态</span><select name="status">
        ${["draft", "published", "archived"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${announcementStatusText(status)}</option>`).join("")}
      </select></label>
      <label class="modal-field"><span>级别</span><select name="level">
        ${["info", "success", "warning", "danger"].map((level) => `<option value="${level}" ${item.level === level ? "selected" : ""}>${announcementLevelText(level)}</option>`).join("")}
      </select></label>
      <label class="modal-field"><span>开始时间</span><input name="startsAt" type="datetime-local" value="${escapeHtml(toDateTimeLocalValue(item.startsAt))}" /></label>
      <label class="modal-field"><span>结束时间</span><input name="endsAt" type="datetime-local" value="${escapeHtml(toDateTimeLocalValue(item.endsAt))}" /></label>
    </div>
    <section class="announcement-editor" aria-label="公告内容编辑器">
      <div class="announcement-toolbar" aria-label="公告排版工具">
        <button type="button" data-md-action="bold">加粗</button>
        <button type="button" data-md-action="heading">标题</button>
        <button type="button" data-md-action="list">列表</button>
        <button type="button" data-md-action="quote">引用</button>
        <button type="button" data-md-action="code">代码</button>
        <button type="button" data-md-action="link">链接</button>
      </div>
      <div class="announcement-editor-grid">
        <label class="modal-field"><span>公告内容</span><textarea name="content" rows="9" placeholder="直接输入公告内容，或用上方按钮快速排版。">${escapeHtml(item.content || "")}</textarea></label>
        <section class="announcement-preview-panel" aria-live="polite">
          <span>实时预览</span>
          <div class="announcement-markdown" data-announcement-preview></div>
        </section>
      </div>
    </section>
  `;
}

function setupAnnouncementEditor() {
  const editor = el.modalBody.querySelector(".announcement-editor");
  if (!editor) return;
  const textarea = editor.querySelector("textarea[name='content']");
  const preview = editor.querySelector("[data-announcement-preview]");
  if (!textarea || !preview) return;

  const updatePreview = () => {
    preview.innerHTML = renderAnnouncementMarkdown(textarea.value);
  };

  const replaceSelection = (before, after = "", fallback = "内容") => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || fallback;
    const next = `${before}${selected}${after}`;
    textarea.setRangeText(next, start, end, "end");
    textarea.focus();
    updatePreview();
  };

  const insertLinePrefix = (prefix, fallback = "内容") => {
    const start = textarea.selectionStart;
    const lineStart = textarea.value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(lineStart, end) || fallback;
    const lines = selected.split("\n").map((line) => `${prefix}${line || fallback}`);
    textarea.setRangeText(lines.join("\n"), lineStart, end, "end");
    textarea.focus();
    updatePreview();
  };

  editor.addEventListener("click", (event) => {
    const button = event.target.closest("[data-md-action]");
    if (!button) return;
    const action = button.getAttribute("data-md-action");
    if (action === "bold") replaceSelection("**", "**", "重点内容");
    if (action === "heading") insertLinePrefix("### ", "公告标题");
    if (action === "list") insertLinePrefix("- ", "列表项");
    if (action === "quote") insertLinePrefix("> ", "提示内容");
    if (action === "code") replaceSelection("`", "`", "关键词");
    if (action === "link") {
      const url = window.prompt("请输入链接地址", "https://");
      if (!url) return;
      replaceSelection("[", `](${url})`, "查看详情");
    }
  });

  textarea.addEventListener("input", updatePreview);
  updatePreview();
}

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function readAnnouncementForm() {
  return {
    title: modalField("title").trim(),
    content: modalField("content").trim(),
    level: modalField("level"),
    status: modalField("status"),
    startsAt: modalField("startsAt"),
    endsAt: modalField("endsAt"),
  };
}

function createAnnouncement() {
  showModal({
    title: "新建公告",
    body: announcementFormBody({ status: "draft", level: "info" }),
    confirmText: "创建",
    onConfirm: async () => {
      await api("/api/admin/announcements", {
        method: "POST",
        body: JSON.stringify(readAnnouncementForm()),
      });
      await loadAnnouncements();
    },
  });
}

function editAnnouncement(item) {
  showModal({
    title: "编辑公告",
    body: announcementFormBody(item),
    confirmText: "保存",
    onConfirm: async () => {
      await api(`/api/admin/announcements/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify(readAnnouncementForm()),
      });
      await loadAnnouncements();
    },
  });
}

async function updateAnnouncementStatus(item, status) {
  await api(`/api/admin/announcements/${encodeURIComponent(item.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: item.title,
      content: item.content,
      level: item.level,
      status,
      startsAt: item.startsAt ? toDateTimeLocalValue(item.startsAt) : "",
      endsAt: item.endsAt ? toDateTimeLocalValue(item.endsAt) : "",
    }),
  });
  await loadAnnouncements();
}

function deleteAnnouncement(item) {
  showModal({
    title: "删除公告",
    body: `<p class="modal-copy">确认删除公告 <strong>${escapeHtml(item.title)}</strong>？</p>`,
    confirmText: "删除",
    danger: true,
    onConfirm: async () => {
      await api(`/api/admin/announcements/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      await loadAnnouncements();
    },
  });
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
    export_users_csv: "导出用户 CSV",
    export_audit_csv: "导出审计 CSV",
    revoke_user_sessions: "强制用户下线",
    revoke_session: "撤销会话",
    cleanup_expired_sessions: "清理过期会话",
    update_user_note: "更新用户备注",
    create_announcement: "新建公告",
    update_announcement: "更新公告",
    delete_announcement: "删除公告",
    bulk_enable_user: "批量启用",
    bulk_disable_user: "批量禁用",
    bulk_clear_user_data: "批量清空数据",
  })[action] || action || "操作";
}

function renderAuditActionOptions(actions) {
  const current = el.auditActionFilter.value;
  el.auditActionFilter.innerHTML = `<option value="">全部操作</option>${actions.map((action) => `
    <option value="${escapeHtml(action)}">${escapeHtml(auditActionText(action))}</option>
  `).join("")}`;
  el.auditActionFilter.value = actions.includes(current) ? current : "";
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

function downloadText(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportUsersCsv() {
  const res = await fetch(`/api/admin/users/export${currentUsersQuery()}`);
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      message = JSON.parse(text)?.error || message;
    } catch {
      /* keep raw text */
    }
    throw new Error(message || `请求失败：${res.status}`);
  }
  downloadText(`wenjie-users-${new Date().toISOString().slice(0, 10)}.csv`, text, "text/csv;charset=utf-8");
}

async function exportAuditCsv() {
  const res = await fetch(`/api/admin/audit-logs/export${currentAuditQuery()}`);
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      message = JSON.parse(text)?.error || message;
    } catch {
      /* keep raw text */
    }
    throw new Error(message || `请求失败：${res.status}`);
  }
  downloadText(`wenjie-audit-${new Date().toISOString().slice(0, 10)}.csv`, text, "text/csv;charset=utf-8");
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
  const payload = await api(`/api/admin/audit-logs${currentAuditQuery()}`);
  const logs = payload.logs || [];
  state.auditPagination = payload.pagination || null;
  renderAuditActionOptions(payload.actions || []);
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
  if (state.activePanel === "overviewPanel") await loadOverview();
  if (state.activePanel === "usersPanel") await loadUsers();
  if (state.activePanel === "announcementPanel") await loadAnnouncements();
  if (state.activePanel === "securityPanel") await loadSecuritySessions();
  if (state.activePanel === "statusPanel") await loadSystemStatus();
  if (state.activePanel === "auditPanel") await loadAuditLogs();
}

function switchPanel(panelId, options = {}) {
  const nextPanel = ADMIN_PANEL_TITLES[panelId] ? panelId : "overviewPanel";
  const shouldPersist = options.persist !== false;
  if (shouldPersist) localStorage.setItem(ADMIN_ACTIVE_PANEL_STORAGE, nextPanel);
  state.activePanel = nextPanel;
  el.overviewPanel.hidden = nextPanel !== "overviewPanel";
  el.usersPanel.hidden = nextPanel !== "usersPanel";
  el.announcementPanel.hidden = nextPanel !== "announcementPanel";
  el.securityPanel.hidden = nextPanel !== "securityPanel";
  el.statusPanel.hidden = nextPanel !== "statusPanel";
  el.auditPanel.hidden = nextPanel !== "auditPanel";
  el.panelTitle.textContent = ADMIN_PANEL_TITLES[nextPanel];
  if (el.sidebarSummaryTitle) el.sidebarSummaryTitle.textContent = ADMIN_PANEL_TITLES[nextPanel];
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-panel") === nextPanel);
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

function clampSidebarWidth(width) {
  const viewportLimit = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, Math.floor(window.innerWidth * 0.36)));
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(viewportLimit, Math.round(width)));
}

function setSidebarWidth(width, persist = true) {
  if (!el.dashboardView) return;
  const nextWidth = clampSidebarWidth(width);
  el.dashboardView.style.setProperty("--admin-sidebar-width", `${nextWidth}px`);
  el.sidebarResizer?.setAttribute("aria-valuenow", String(nextWidth));
  if (persist) localStorage.setItem(ADMIN_SIDEBAR_WIDTH_STORAGE, String(nextWidth));
}

function initSidebarResize() {
  if (!el.sidebarResizer || !el.dashboardView) return;

  el.sidebarResizer.setAttribute("aria-valuemin", String(SIDEBAR_MIN_WIDTH));
  el.sidebarResizer.setAttribute("aria-valuemax", String(SIDEBAR_MAX_WIDTH));
  const savedWidth = Number(localStorage.getItem(ADMIN_SIDEBAR_WIDTH_STORAGE) || 0);
  if (savedWidth) setSidebarWidth(savedWidth, false);

  const resizeToPointer = (event) => {
    const dashboardRect = el.dashboardView.getBoundingClientRect();
    setSidebarWidth(event.clientX - dashboardRect.left);
  };

  el.sidebarResizer.addEventListener("pointerdown", (event) => {
    if (window.innerWidth <= 1080) return;
    event.preventDefault();
    document.body.classList.add("resizing-sidebar");
    el.sidebarResizer.setPointerCapture?.(event.pointerId);
    resizeToPointer(event);

    const stopResize = () => {
      document.body.classList.remove("resizing-sidebar");
      window.removeEventListener("pointermove", resizeToPointer);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };

    window.addEventListener("pointermove", resizeToPointer);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  });

  el.sidebarResizer.addEventListener("keydown", (event) => {
    const currentWidth = Number(getComputedStyle(el.dashboardView).getPropertyValue("--admin-sidebar-width").replace("px", "")) || 286;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setSidebarWidth(currentWidth - 16);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setSidebarWidth(currentWidth + 16);
    }
    if (event.key === "Home") {
      event.preventDefault();
      setSidebarWidth(SIDEBAR_MIN_WIDTH);
    }
    if (event.key === "End") {
      event.preventDefault();
      setSidebarWidth(SIDEBAR_MAX_WIDTH);
    }
  });

  window.addEventListener("resize", () => {
    const currentWidth = Number(getComputedStyle(el.dashboardView).getPropertyValue("--admin-sidebar-width").replace("px", "")) || 286;
    setSidebarWidth(currentWidth, false);
  });
}

el.loginForm.addEventListener("submit", login);
el.loginAccount.addEventListener("input", syncLoginFieldState);
el.loginPassword.addEventListener("input", syncLoginFieldState);
el.loginAccount.addEventListener("change", syncLoginFieldState);
el.loginPassword.addEventListener("change", syncLoginFieldState);
el.logoutBtn.addEventListener("click", logout);
el.refreshBtn.addEventListener("click", () => refreshActivePanel().catch((err) => window.alert(String(err?.message || err))));
el.createUserBtn.addEventListener("click", () => createUser().catch((err) => window.alert(String(err?.message || err))));
el.exportUsersBtn.addEventListener("click", () => exportUsersCsv().catch((err) => window.alert(String(err?.message || err))));
el.createAnnouncementBtn.addEventListener("click", () => createAnnouncement());
el.announcementStatusFilter.addEventListener("change", () => loadAnnouncements().catch((err) => window.alert(String(err?.message || err))));
el.announcementList.addEventListener("click", (e) => {
  const button = e.target.closest("[data-announcement-action]");
  const card = e.target.closest("[data-announcement-id]");
  if (!button || !card) return;
  const item = state.announcements.find((announcement) => String(announcement.id) === String(card.getAttribute("data-announcement-id")));
  if (!item) return;
  const action = button.getAttribute("data-announcement-action");
  if (action === "publish") updateAnnouncementStatus(item, "published").catch((err) => window.alert(String(err?.message || err)));
  if (action === "archive") updateAnnouncementStatus(item, "archived").catch((err) => window.alert(String(err?.message || err)));
  if (action === "edit") editAnnouncement(item);
  if (action === "delete") deleteAnnouncement(item);
});
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
el.loginFilter.addEventListener("change", () => {
  state.usersPage = 1;
  loadUsers().catch((err) => window.alert(String(err?.message || err)));
});
el.dataFilter.addEventListener("change", () => {
  state.usersPage = 1;
  loadUsers().catch((err) => window.alert(String(err?.message || err)));
});
el.sortSelect.addEventListener("change", () => {
  state.usersPage = 1;
  loadUsers().catch((err) => window.alert(String(err?.message || err)));
});
el.sessionSearchInput.addEventListener("input", debounce(() => {
  state.sessionsPage = 1;
  loadSecuritySessions().catch((err) => window.alert(String(err?.message || err)));
}));
el.sessionStatusFilter.addEventListener("change", () => {
  state.sessionsPage = 1;
  loadSecuritySessions().catch((err) => window.alert(String(err?.message || err)));
});
el.cleanupSessionsBtn.addEventListener("click", () => cleanupExpiredSessions());
el.sessionsBody.addEventListener("click", (e) => {
  const button = e.target.closest("[data-revoke-session-id]");
  if (!button || button.disabled) return;
  revokeSession(button.getAttribute("data-revoke-session-id"));
});
el.auditSearchInput.addEventListener("input", debounce(() => {
  state.auditPage = 1;
  loadAuditLogs().catch((err) => window.alert(String(err?.message || err)));
}));
el.auditActionFilter.addEventListener("change", () => {
  state.auditPage = 1;
  loadAuditLogs().catch((err) => window.alert(String(err?.message || err)));
});
el.exportAuditBtn.addEventListener("click", () => exportAuditCsv().catch((err) => window.alert(String(err?.message || err))));
el.overviewPanel.addEventListener("click", (e) => {
  const button = e.target.closest("[data-jump-user-id]");
  if (!button) return;
  switchPanel("usersPanel");
  loadUserDetail(button.getAttribute("data-jump-user-id")).catch((err) => window.alert(String(err?.message || err)));
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
  if (pagerBtn.getAttribute("data-page-action") === "sessions") {
    state.sessionsPage = page;
    loadSecuritySessions().catch((err) => window.alert(String(err?.message || err)));
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
initSidebarResize();
window.setTimeout(syncLoginFieldState, 100);
window.setTimeout(syncLoginFieldState, 500);
checkSession();
