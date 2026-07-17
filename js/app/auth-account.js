const storageNative = {
  getItem: Storage.prototype.getItem,
  setItem: Storage.prototype.setItem,
  removeItem: Storage.prototype.removeItem,
};

function activeUserStorageId() {
  return state.activeUser?.id || "";
}

function scopedStorageKey(key, userId = activeUserStorageId()) {
  return userId && USER_SCOPED_STORAGE_KEYS.has(key)
    ? `LINGXI_USER_${encodeURIComponent(userId)}__${key}`
    : key;
}

function installUserStorageScope() {
  if (Storage.prototype.__lingxiScoped) return;
  Storage.prototype.getItem = function getItem(key) {
    return storageNative.getItem.call(this, scopedStorageKey(String(key)));
  };
  Storage.prototype.setItem = function setItem(key, value) {
    const baseKey = String(key);
    const result = storageNative.setItem.call(this, scopedStorageKey(baseKey), value);
    scheduleRemoteUserDataSave(baseKey, String(value));
    return result;
  };
  Storage.prototype.removeItem = function removeItem(key) {
    const baseKey = String(key);
    const result = storageNative.removeItem.call(this, scopedStorageKey(baseKey));
    scheduleRemoteUserDataDelete(baseKey);
    return result;
  };
  Object.defineProperty(Storage.prototype, "__lingxiScoped", { value: true });
}

function rawStorageGet(key) {
  return storageNative.getItem.call(localStorage, key);
}

function rawStorageSet(key, value) {
  storageNative.setItem.call(localStorage, key, value);
}

function rawStorageRemove(key) {
  storageNative.removeItem.call(localStorage, key);
}

function normalizeUsername(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 32);
}

function userIdFromName(name) {
  return normalizeUsername(name).toLowerCase();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 80);
}

function normalizeGithubUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (url.hostname.replace(/^www\./i, "").toLowerCase() !== "github.com") return "";
    const username = url.pathname.split("/").filter(Boolean)[0] || "";
    if (!/^[\w.-]+$/.test(username)) return "";
    return `https://github.com/${username}`;
  } catch {
    return "";
  }
}

function getStoredAuthMode() {
  return rawStorageGet(AUTH_MODE_STORAGE) === "login" ? "login" : "register";
}

async function apiJson(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
  }
  if (!res.ok) {
    throw new Error(data?.error || `请求失败：${res.status}`);
  }
  return data || {};
}

function persistActiveUserCache(user) {
  if (user) {
    rawStorageSet(ACTIVE_USER_STORAGE, String(user.id));
    rawStorageSet("WENJIE_ACTIVE_USER_CACHE", JSON.stringify(user));
  } else {
    rawStorageRemove(ACTIVE_USER_STORAGE);
    rawStorageRemove("WENJIE_ACTIVE_USER_CACHE");
  }
}

function readCachedUser() {
  try {
    const cached = JSON.parse(rawStorageGet("WENJIE_ACTIVE_USER_CACHE") || "null");
    return cached?.id ? cached : null;
  } catch {
    return null;
  }
}

function hydrateLocalUserData(data, userId = activeUserStorageId()) {
  if (!userId || !data || typeof data !== "object") return;
  state.remoteStorageHydrating = true;
  try {
    Object.entries(data).forEach(([key, value]) => {
      if (USER_SCOPED_STORAGE_KEYS.has(key)) {
        rawStorageSet(scopedStorageKey(key, userId), String(value ?? ""));
      }
    });
  } finally {
    state.remoteStorageHydrating = false;
  }
}

async function loadRemoteUserData() {
  const payload = await apiJson(USER_DATA_ENDPOINT, { method: "GET" });
  hydrateLocalUserData(payload.data || {});
}

async function syncCurrentLocalUserDataToRemote() {
  if (!state.activeUser) return;
  await Promise.all(Array.from(USER_SCOPED_STORAGE_KEYS).map(async (key) => {
    const value = rawStorageGet(scopedStorageKey(key));
    if (value == null) return;
    await apiJson(USER_DATA_ENDPOINT, {
      method: "PUT",
      body: JSON.stringify({ key, value }),
    });
  })).catch((e) => console.warn("迁移本地用户数据失败", e));
}

const remoteSaveTimers = new Map();

function scheduleRemoteUserDataSave(key, value) {
  if (!state.activeUser || state.remoteStorageHydrating || !USER_SCOPED_STORAGE_KEYS.has(key)) return;
  window.clearTimeout(remoteSaveTimers.get(key));
  remoteSaveTimers.set(key, window.setTimeout(() => {
    remoteSaveTimers.delete(key);
    void apiJson(USER_DATA_ENDPOINT, {
      method: "PUT",
      body: JSON.stringify({ key, value }),
    }).catch((e) => console.warn("同步用户数据失败", e));
  }, 260));
}

function scheduleRemoteUserDataDelete(key) {
  if (!state.activeUser || state.remoteStorageHydrating || !USER_SCOPED_STORAGE_KEYS.has(key)) return;
  window.clearTimeout(remoteSaveTimers.get(key));
  remoteSaveTimers.delete(key);
  void apiJson(USER_DATA_ENDPOINT, {
    method: "DELETE",
    body: JSON.stringify({ key }),
  }).catch((e) => console.warn("删除云端用户数据失败", e));
}

function setAuthMode(mode) {
  state.authMode = mode === "register" ? "register" : "login";
  const isRegister = state.authMode === "register";
  rawStorageSet(AUTH_MODE_STORAGE, state.authMode);
  document.documentElement.classList.toggle("auth-boot-login", !isRegister);
  document.documentElement.classList.toggle("auth-boot-register", isRegister);
  el.authShell?.classList.toggle("right-panel-active", isRegister);
  if (el.authPassword) el.authPassword.autocomplete = isRegister ? "new-password" : "current-password";
  setAuthMessage("");
  setAuthLoginMessage("");
}

function setAuthMessage(message, type = "error") {
  if (!el.authMessage) return;
  el.authMessage.textContent = message;
  el.authMessage.classList.toggle("success", type === "success");
}

function setAuthLoginMessage(message, type = "error") {
  if (!el.authLoginMessage) return;
  el.authLoginMessage.textContent = message;
  el.authLoginMessage.classList.toggle("success", type === "success");
}

function setActiveUser(user) {
  state.activeUser = user || null;
  persistActiveUserCache(user);
  updateUserChrome();
}

function accountAccentGradient(accent = "teal") {
  const gradients = {
    teal: "linear-gradient(135deg, #4d7cff, #21d4a5)",
    blue: "linear-gradient(135deg, #2f80ed, #56ccf2)",
    violet: "linear-gradient(135deg, #7c5cff, #d59cff)",
    gold: "linear-gradient(135deg, #d59b35, #f2d16b)",
    rose: "linear-gradient(135deg, #e85d75, #ffb199)",
  };
  return gradients[accent] || gradients.teal;
}

function accountProfileFor(user = state.activeUser) {
  const profile = user?.profile || {};
  const avatarImage = /^data:image\/(png|jpe?g|webp);base64,/i.test(String(profile.avatarImage || ""))
    ? String(profile.avatarImage)
    : "";
  const photoWall = Array.isArray(profile.photoWall)
    ? profile.photoWall.filter((item) => /^data:image\/(png|jpe?g|webp);base64,/i.test(String(item || ""))).slice(0, 4)
    : [];
  const musicTrack = profile.musicTrack && /^data:audio\/(mpeg|mp3|wav|ogg|aac|mp4|webm);base64,/i.test(String(profile.musicTrack.src || ""))
    ? { title: String(profile.musicTrack.title || "我的音乐").slice(0, 80), src: profile.musicTrack.src }
    : null;
  return {
    avatarInitial: String(profile.avatarInitial || user?.name || "L").trim().slice(0, 2).toUpperCase(),
    avatarImage,
    bio: String(profile.bio || "个人学习空间").trim(),
    accent: profile.accent || "teal",
    theme: profile.theme || "system",
    defaultPage: profile.defaultPage || "chat",
    replyStyle: profile.replyStyle || "",
    githubUrl: normalizeGithubUrl(profile.githubUrl || ""),
    contactEmail: normalizeEmail(profile.contactEmail || ""),
    photoWall,
    musicTrack,
  };
}

function updateUserChrome() {
  const user = state.activeUser;
  document.documentElement.classList.toggle("auth-boot-user", !!user);
  document.documentElement.classList.toggle("auth-boot-guest", !user);
  if (el.userChip) el.userChip.hidden = !user;
  if (el.userNameLabel) el.userNameLabel.textContent = user?.name || "未登录";
  if (el.userBioLabel) el.userBioLabel.textContent = user ? accountProfileFor(user).bio : "个人学习空间";
  const avatar = el.userChip?.querySelector(".user-avatar");
  if (avatar) {
    const profile = accountProfileFor(user);
    avatar.style.background = accountAccentGradient(profile.accent);
    avatar.style.backgroundImage = profile.avatarImage ? `url("${profile.avatarImage}")` : "";
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
    avatar.textContent = profile.avatarImage ? "" : (profile.avatarInitial || "L");
  }
  if (el.authOverlay) el.authOverlay.hidden = !!user;
  if (el.userInfoPage && el.userInfoPage.hidden === false) {
    renderPersonalProfilePage();
  }
}

function setUserMenuOpen(open) {
  if (!el.userMenu || !el.userMenuBtn || !el.userProfileBtn) return;
  el.userMenu.hidden = !open;
  el.userMenuBtn.setAttribute("aria-expanded", String(open));
  el.userProfileBtn.setAttribute("aria-expanded", String(open));
}

function setAccountMessage(message = "", type = "error") {
  if (!el.accountMessage) return;
  el.accountMessage.textContent = message;
  el.accountMessage.classList.toggle("success", type === "success");
}

function syncAccountPreview() {
  const profile = accountProfileFor();
  const name = normalizeUsername(el.accountNameInput?.value || state.activeUser?.name || "");
  const bio = String(el.accountBioInput?.value || "个人学习空间").trim() || "个人学习空间";
  const initial = String(profile.avatarInitial || name || "L").trim().slice(0, 2).toUpperCase();
  const accent = profile.accent || "teal";
  if (el.accountPreviewName) el.accountPreviewName.textContent = name || "未命名";
  if (el.accountPreviewBio) el.accountPreviewBio.textContent = bio;
  if (el.accountPreviewAvatar) {
    el.accountPreviewAvatar.style.background = accountAccentGradient(accent);
    el.accountPreviewAvatar.style.backgroundImage = profile.avatarImage ? `url("${profile.avatarImage}")` : "";
    el.accountPreviewAvatar.style.backgroundSize = "cover";
    el.accountPreviewAvatar.style.backgroundPosition = "center";
    el.accountPreviewAvatar.textContent = profile.avatarImage ? "" : (initial || "L");
  }
}

function openAccountModal(section = "profile") {
  if (!state.activeUser || !el.accountModal) return;
  const profile = accountProfileFor();
  if (el.accountNameInput) el.accountNameInput.value = state.activeUser.name || "";
  if (el.accountEmailInput) el.accountEmailInput.value = state.activeUser.email || "";
  if (el.accountAvatarInput) el.accountAvatarInput.value = profile.avatarInitial || "";
  if (el.accountAccentInput) el.accountAccentInput.value = profile.accent || "teal";
  if (el.accountBioInput) el.accountBioInput.value = profile.bio || "";
  if (el.accountGithubInput) el.accountGithubInput.value = profile.githubUrl || "";
  if (el.accountContactEmailInput) el.accountContactEmailInput.value = profile.contactEmail || state.activeUser.email || "";
  if (el.accountThemeInput) el.accountThemeInput.value = profile.theme || "system";
  if (el.accountDefaultPageInput) el.accountDefaultPageInput.value = profile.defaultPage || "chat";
  if (el.accountReplyStyleInput) el.accountReplyStyleInput.value = profile.replyStyle || "";
  if (el.accountSecurityEmail) el.accountSecurityEmail.textContent = state.activeUser.email || "-";
  if (el.accountSecurityRole) el.accountSecurityRole.textContent = state.activeUser.role === "admin" ? "管理员" : "用户";
  clearAccountPasswordFields();
  setAccountMessage("");
  syncAccountPreview();
  el.accountModal.hidden = false;
  setUserMenuOpen(false);
  switchAccountSection(section);
}

function closeAccountModal() {
  if (el.accountModal) el.accountModal.hidden = true;
  setAccountMessage("");
  clearAccountPasswordFields();
}

function clearAccountPasswordFields() {
  if (el.accountCurrentPasswordInput) el.accountCurrentPasswordInput.value = "";
  if (el.accountNewPasswordInput) el.accountNewPasswordInput.value = "";
  if (el.accountConfirmPasswordInput) el.accountConfirmPasswordInput.value = "";
}

function switchAccountSection(section = "profile") {
  const nextSection = ["profile", "security"].includes(section) ? section : "profile";
  if (el.accountModal) el.accountModal.dataset.accountSection = nextSection;
  document.querySelectorAll("[data-account-section]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-account-section") === nextSection);
  });
  document.querySelectorAll("[data-account-panel]").forEach((panel) => {
    panel.hidden = panel.getAttribute("data-account-panel") !== nextSection;
  });
  const profileVisible = nextSection === "profile";
  if (el.accountTitle) {
    el.accountTitle.textContent = profileVisible ? "个人资料" : "账户安全";
  }
  if (el.accountSaveBtn) {
    el.accountSaveBtn.textContent = nextSection === "security" ? "保存安全设置" : "保存";
  }
  const profileCard = document.querySelector(".account-profile-card");
  const profileGrid = document.querySelector(".account-form-grid");
  if (profileCard) profileCard.hidden = !profileVisible;
  if (profileGrid) profileGrid.hidden = !profileVisible;
}

async function handleAccountProfileSubmit(event) {
  event.preventDefault();
  const section = el.accountModal?.dataset.accountSection || "profile";
  if (section === "security") {
    await handleAccountPasswordSubmit();
    return;
  }
  const currentProfile = accountProfileFor();
  const name = normalizeUsername(el.accountNameInput?.value);
  const email = normalizeEmail(el.accountEmailInput?.value);
  const avatarInitial = currentProfile.avatarInitial;
  const accent = currentProfile.accent || "teal";
  const bio = String(el.accountBioInput?.value || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const githubUrl = normalizeGithubUrl(el.accountGithubInput?.value || "");
  const contactEmail = normalizeEmail(el.accountContactEmailInput?.value || "");
  const theme = currentProfile.theme || "system";
  const defaultPage = currentProfile.defaultPage || "chat";
  const replyStyle = currentProfile.replyStyle || "";
  if (!name || name.length < 2) {
    setAccountMessage("昵称至少需要 2 个字符。");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setAccountMessage("请输入有效邮箱。");
    return;
  }
  if (el.accountGithubInput?.value && !githubUrl) {
    setAccountMessage("GitHub 链接格式应类似 https://github.com/username。");
    return;
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    setAccountMessage("请输入有效的联系邮箱。");
    return;
  }
  if (el.accountSaveBtn) el.accountSaveBtn.disabled = true;
  setAccountMessage("正在保存...", "success");
  try {
    const payload = await apiJson(`${AUTH_ENDPOINT}/profile`, {
      method: "PUT",
      body: JSON.stringify({
        name,
        email,
        profile: {
          avatarInitial,
          avatarImage: currentProfile.avatarImage,
          accent,
          bio,
          githubUrl,
          contactEmail,
          theme,
          defaultPage,
          replyStyle,
          photoWall: currentProfile.photoWall,
          musicTrack: currentProfile.musicTrack,
        },
      }),
    });
    setActiveUser(payload.user);
    applyAccountPreferences(payload.user?.profile);
    setAccountMessage("已保存。", "success");
    if (section === "profile") closeAccountModal();
  } catch (err) {
    setAccountMessage(String(err?.message || err));
  } finally {
    if (el.accountSaveBtn) el.accountSaveBtn.disabled = false;
  }
}

function applyAccountPreferences(profile = accountProfileFor()) {
  if (!profile) return;
  if (profile.theme === "light" || profile.theme === "dark") {
    document.body.dataset.theme = profile.theme;
    if (el.root) el.root.dataset.theme = profile.theme;
    localStorage.setItem(THEME_STORAGE, profile.theme);
  }
}

async function handleAccountPasswordSubmit() {
  const currentPassword = String(el.accountCurrentPasswordInput?.value || "");
  const newPassword = String(el.accountNewPasswordInput?.value || "");
  const confirmPassword = String(el.accountConfirmPasswordInput?.value || "");
  if (!currentPassword && !newPassword && !confirmPassword) {
    setAccountMessage("账户安全信息已查看，无需保存。", "success");
    return;
  }
  if (!currentPassword || !newPassword) {
    setAccountMessage("请填写当前密码和新密码。");
    return;
  }
  if (newPassword.length < 8) {
    setAccountMessage("新密码至少需要 8 位。");
    return;
  }
  if (newPassword !== confirmPassword) {
    setAccountMessage("两次输入的新密码不一致。");
    return;
  }
  if (el.accountSaveBtn) el.accountSaveBtn.disabled = true;
  setAccountMessage("正在更新密码...", "success");
  try {
    await apiJson(`${AUTH_ENDPOINT}/password`, {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    clearAccountPasswordFields();
    setAccountMessage("密码已更新。", "success");
  } catch (err) {
    setAccountMessage(String(err?.message || err));
  } finally {
    if (el.accountSaveBtn) el.accountSaveBtn.disabled = false;
  }
}

async function readPersistedUser() {
  try {
    const payload = await apiJson(`${AUTH_ENDPOINT}/me`, { method: "GET" });
    return payload.user || null;
  } catch {
    persistActiveUserCache(null);
    return null;
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const name = normalizeUsername(el.authUsername?.value);
  const email = normalizeEmail(el.authEmail?.value);
  const password = String(el.authPassword?.value || "");
  const confirmPassword = String(el.authConfirmPassword?.value || "");
  const id = userIdFromName(name);

  if (!name || !email || !password) {
    setAuthMessage("Please enter user, email and password.");
    return;
  }
  if (name.length < 2) {
    setAuthMessage("User name needs at least 2 characters.");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setAuthMessage("Please enter a valid email.");
    return;
  }
  if (password.length < 8) {
    setAuthMessage("Password needs at least 8 characters.");
    return;
  }
  if (password !== confirmPassword) {
    setAuthMessage("Passwords do not match.");
    return;
  }

  if (el.authSubmitBtn) el.authSubmitBtn.disabled = true;
  setAuthMessage("正在创建正式账号...", "success");
  try {
    const payload = await apiJson(`${AUTH_ENDPOINT}/register`, {
      method: "POST",
      body: JSON.stringify({ username: name, email, password, confirmPassword }),
    });
    setActiveUser(payload.user);
    await loadRemoteUserData();
    await syncCurrentLocalUserDataToRemote();
    await loadAnnouncements();
    setAuthMessage("注册成功，已进入你的学习空间。", "success");
    resetAuthForm();
    reloadUserWorkspace();
  } catch (err) {
    setAuthMessage(String(err?.message || err));
  } finally {
    if (el.authSubmitBtn) el.authSubmitBtn.disabled = false;
  }
}

async function handleAuthLoginSubmit(e) {
  e.preventDefault();
  const account = normalizeUsername(el.authLoginAccount?.value);
  const password = String(el.authLoginPassword?.value || "");

  if (!account || !password) {
    setAuthLoginMessage("Please enter account and password.");
    return;
  }

  if (el.authLoginSubmitBtn) el.authLoginSubmitBtn.disabled = true;
  setAuthLoginMessage("正在登录...", "success");
  try {
    const payload = await apiJson(`${AUTH_ENDPOINT}/login`, {
      method: "POST",
      body: JSON.stringify({ account, password }),
    });
    setActiveUser(payload.user);
    await loadRemoteUserData();
    await syncCurrentLocalUserDataToRemote();
    await loadAnnouncements();
    setAuthLoginMessage("登录成功。", "success");
    resetAuthForm();
    reloadUserWorkspace();
  } catch (err) {
    setAuthLoginMessage(String(err?.message || err));
  } finally {
    if (el.authLoginSubmitBtn) el.authLoginSubmitBtn.disabled = false;
  }
}

function resetAuthForm() {
  if (el.authUsername) el.authUsername.value = "";
  if (el.authEmail) el.authEmail.value = "";
  if (el.authPassword) el.authPassword.value = "";
  if (el.authConfirmPassword) el.authConfirmPassword.value = "";
  if (el.authLoginAccount) el.authLoginAccount.value = "";
  if (el.authLoginPassword) el.authLoginPassword.value = "";
}

async function logoutCurrentUser() {
  if (state.isGenerating && state.abortController) state.abortController.abort();
  await syncCurrentLocalUserDataToRemote();
  await apiJson(`${AUTH_ENDPOINT}/logout`, { method: "POST", body: "{}" }).catch(() => {});
  setActiveUser(null);
  renderAnnouncements([]);
  state.messages = [];
  state.chatSessions = [];
  state.activeChatId = "";
  state.attachedFiles = [];
  state.attachedImages = [];
  state.studentProfile = null;
  state.learningResources = null;
  state.learningPathLibrary = {};
  state.activePathCategory = "";
  state.learningDemandEvents = [];
  state.learningBehaviorEvents = [];
  state.learningAssessment = null;
  state.storedMarkdownFiles = [];
  state.mistakeBookItems = [];
  state.mistakeBookGroupBy = "category";
  resetAttachment();
  renderStudentProfile();
  renderLearningResources();
  renderStoragePage();
  renderMistakeBookPage();
  renderAssessmentPage();
  setAuthMode("login");
  showHome();
}

async function initAuth() {
  installUserStorageScope();
  setAuthMode(getStoredAuthMode());
  el.loginTab?.addEventListener("click", () => setAuthMode("login"));
  el.registerTab?.addEventListener("click", () => setAuthMode("register"));
  el.authForm?.addEventListener("submit", handleAuthSubmit);
  el.authLoginForm?.addEventListener("submit", handleAuthLoginSubmit);
  el.logoutBtn?.addEventListener("click", logoutCurrentUser);
  el.sideLogoutBtn?.addEventListener("click", logoutCurrentUser);
  el.userProfileBtn?.addEventListener("click", () => setUserMenuOpen(el.userMenu?.hidden !== false));
  el.userMenuBtn?.addEventListener("click", () => setUserMenuOpen(el.userMenu?.hidden !== false));
  el.userMenu?.addEventListener("click", (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest("[data-account-action]") : null;
    if (!button) return;
    const action = button.getAttribute("data-account-action");
    if (action === "profile") openAccountModal("profile");
    if (action === "logout") void logoutCurrentUser();
  });
  document.addEventListener("click", (event) => {
    if (!el.userChip || el.userMenu?.hidden) return;
    if (event.target instanceof Node && el.userChip.contains(event.target)) return;
    setUserMenuOpen(false);
  });
  el.accountProfileForm?.addEventListener("submit", handleAccountProfileSubmit);
  el.closeAccountModalBtn?.addEventListener("click", closeAccountModal);
  document.querySelectorAll("[data-account-section]").forEach((button) => {
    button.addEventListener("click", () => {
      setAccountMessage("");
      switchAccountSection(button.getAttribute("data-account-section") || "profile");
    });
  });
  el.accountModal?.addEventListener("click", (event) => {
    if (event.target === el.accountModal || event.target === el.accountModal?.querySelector(".account-modal-backdrop")) {
      closeAccountModal();
    }
  });
  [el.accountNameInput, el.accountBioInput].forEach((input) => {
    input?.addEventListener("input", syncAccountPreview);
    input?.addEventListener("change", syncAccountPreview);
  });
  const cachedUser = readCachedUser();
  if (cachedUser) setActiveUser(cachedUser);
  const user = await readPersistedUser();
  setActiveUser(user);
  if (user) {
    await loadRemoteUserData();
    await syncCurrentLocalUserDataToRemote();
    await loadAnnouncements();
  }
}
