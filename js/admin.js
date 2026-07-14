const ADMIN_LAST_ACCOUNT_STORAGE = "WENJIE_ADMIN_LAST_ACCOUNT";

const state = {
  admin: null,
  users: [],
  selectedUserId: "",
  activePanel: "usersPanel",
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
  usersBody: document.querySelector("#usersBody"),
  detailPanel: document.querySelector("#detailPanel"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  createUserBtn: document.querySelector("#createUserBtn"),
  systemCards: document.querySelector("#systemCards"),
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
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

async function loadUsers() {
  const payload = await api(`/api/admin/users${currentUsersQuery()}`);
  state.users = payload.users || [];
  renderUsers();
  if (state.selectedUserId) {
    const stillExists = state.users.some((user) => String(user.id) === String(state.selectedUserId));
    if (stillExists) await loadUserDetail(state.selectedUserId);
    else renderEmptyDetail();
  }
}

function renderUsers() {
  if (!state.users.length) {
    el.usersBody.innerHTML = `<tr><td colspan="9" class="muted">暂无匹配用户</td></tr>`;
    return;
  }
  el.usersBody.innerHTML = state.users.map((user) => {
    const overview = user.overview || {};
    return `
      <tr data-user-id="${escapeHtml(user.id)}" class="${String(user.id) === String(state.selectedUserId) ? "selected" : ""}">
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
      <button class="action-btn" type="button" data-action="toggle-status">${statusIcon} ${statusText}</button>
      <button class="action-btn" type="button" data-action="toggle-role">♚ ${roleText}</button>
      <button class="action-btn" type="button" data-action="reset-password">↺ 重置密码</button>
      <button class="action-btn danger" type="button" data-action="clear-data">⌫ 清空数据</button>
      <button class="action-btn danger" type="button" data-action="delete-user">× 删除账号</button>
    </div>
  `;
}

async function handleDetailAction(action) {
  if (!state.selectedUserId) return;
  const user = state.users.find((item) => String(item.id) === String(state.selectedUserId));
  if (!user) return;
  if (action === "toggle-status") {
    const next = user.status === "disabled" ? "active" : "disabled";
    await api(`/api/admin/users/${user.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    await loadUsers();
  }
  if (action === "toggle-role") {
    const next = user.role === "admin" ? "user" : "admin";
    const text = next === "admin" ? "设为管理员" : "降为普通用户";
    if (!window.confirm(`确认将 ${user.name} ${text}？`)) return;
    await api(`/api/admin/users/${user.id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role: next }),
    });
    await loadUsers();
  }
  if (action === "reset-password") {
    const input = window.prompt("输入新密码；留空则自动生成临时密码。", "");
    if (input === null) return;
    const payload = await api(`/api/admin/users/${user.id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password: input.trim() }),
    });
    window.alert(`新密码：${payload.temporaryPassword}`);
  }
  if (action === "clear-data") {
    if (!window.confirm(`确认清空 ${user.name} 的全部学习数据？账号本身会保留。`)) return;
    await api(`/api/admin/users/${user.id}/data`, { method: "DELETE" });
    await loadUsers();
  }
  if (action === "delete-user") {
    const confirmValue = window.prompt(`请输入 ${user.name} 或 ${user.email} 确认删除账号。`, "");
    if (!confirmValue) return;
    await api(`/api/admin/users/${user.id}`, {
      method: "DELETE",
      body: JSON.stringify({ confirm: confirmValue.trim() }),
    });
    renderEmptyDetail();
    await loadUsers();
  }
}

async function createUser() {
  const username = window.prompt("请输入新账号用户名。", "");
  if (!username) return;
  const email = window.prompt("请输入邮箱。", "");
  if (!email) return;
  const password = window.prompt("请输入初始密码，至少 8 位。", "");
  if (!password) return;
  const role = window.confirm("是否创建为管理员账号？\n确定：管理员\n取消：普通用户") ? "admin" : "user";
  const payload = await api("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({
      username: username.trim(),
      email: email.trim(),
      password,
      role,
      status: "active",
    }),
  });
  state.selectedUserId = String(payload.user?.id || "");
  await loadUsers();
  if (state.selectedUserId) await loadUserDetail(state.selectedUserId);
}

async function loadSystemStatus() {
  const payload = await api("/api/admin/status");
  const mysql = payload.mysql || {};
  const users = payload.users || {};
  const data = payload.data || {};
  el.systemCards.innerHTML = `
    <article class="status-card"><span>MySQL</span><strong>${mysql.connected ? "正常" : "异常"}</strong><p class="muted">${escapeHtml(mysql.error || "连接可用")}</p></article>
    <article class="status-card"><span>用户总数</span><strong>${Number(users.totalUsers || 0)}</strong><p class="muted">启用 ${Number(users.activeUsers || 0)}，禁用 ${Number(users.disabledUsers || 0)}</p></article>
    <article class="status-card"><span>管理员</span><strong>${Number(users.adminUsers || 0)}</strong><p class="muted">独立 role 管理</p></article>
    <article class="status-card"><span>数据总量</span><strong>${escapeHtml(formatBytes(data.dataBytes))}</strong><p class="muted">${Number(data.dataRows || 0)} 条用户数据</p></article>
  `;
}

async function refreshActivePanel() {
  if (state.activePanel === "usersPanel") await loadUsers();
  if (state.activePanel === "statusPanel") await loadSystemStatus();
}

function switchPanel(panelId) {
  state.activePanel = panelId;
  el.usersPanel.hidden = panelId !== "usersPanel";
  el.statusPanel.hidden = panelId !== "statusPanel";
  el.panelTitle.textContent = panelId === "statusPanel" ? "系统状态" : "用户管理";
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
el.searchInput.addEventListener("input", debounce(() => loadUsers().catch((err) => window.alert(String(err?.message || err)))));
el.statusFilter.addEventListener("change", () => loadUsers().catch((err) => window.alert(String(err?.message || err))));
el.usersBody.addEventListener("click", (e) => {
  const row = e.target.closest("[data-user-id]");
  if (row) loadUserDetail(row.getAttribute("data-user-id")).catch((err) => window.alert(String(err?.message || err)));
});
el.detailPanel.addEventListener("click", (e) => {
  const button = e.target.closest("[data-action]");
  if (button) handleDetailAction(button.getAttribute("data-action")).catch((err) => window.alert(String(err?.message || err)));
});
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => switchPanel(btn.getAttribute("data-panel")));
});

restoreLoginAccount();
syncLoginFieldState();
window.setTimeout(syncLoginFieldState, 100);
window.setTimeout(syncLoginFieldState, 500);
checkSession();
