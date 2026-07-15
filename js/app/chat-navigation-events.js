function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
    }
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
    }
  }
  return null;
}

function buildChatHeaders() {
  const headers = {
    "Content-Type": "application/json",
  };
  if (USE_BROWSER_API_KEY) headers.Authorization = `Bearer ${state.apiKey}`;
  return headers;
}

function buildLearningSystemMessage() {
  const profile = state.studentProfile || createEmptyProfile();
  return {
    role: "system",
    content:
      `${LEARNING_PROFILE_SYSTEM_PROMPT}\n\n当前已维护的学生画像 JSON：\n` +
      `${JSON.stringify(profile, null, 2)}\n\n` +
      "请基于该画像回答学生当前问题；本轮不要输出内部更新 JSON，除非学生明确要求查看画像。\n\n" +
      "回答规范：涉及数学、形式语言、算法公式、集合、上下标时，必须使用规范 Markdown 数学写法。行内公式用 $...$，独立公式用 $$...$$。例如写 $V_N$、$V_T$、$L=\\{a^n b^n c^n \\mid n \\ge 1\\}$、$\\alpha A \\beta \\to \\alpha \\gamma \\beta$，不要裸写 V_N、a^n 或把 LaTeX 源码当普通文本输出。除非用户明确要求代码，公式不要放进代码块。",
  };
}

function saveMessagesPersist() {
  try {
    localStorage.setItem(MESSAGES_STORAGE, JSON.stringify(state.messages));
  } catch (e) {
    console.warn("保存对话历史失败", e);
  }
}

function loadMessagesPersist() {
  try {
    const raw = localStorage.getItem(MESSAGES_STORAGE);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((m) => {
      if (!m || (m.role !== "user" && m.role !== "assistant")) return false;
      if (typeof m.content !== "string") return false;
      if (m.imageUrls != null) {
        if (!Array.isArray(m.imageUrls) || m.imageUrls.some((u) => typeof u !== "string")) {
          return false;
        }
      }
      return true;
    });
  } catch {
    return [];
  }
}

function renderMarkdownInto(container, markdownText) {
  const md = typeof marked !== "undefined" ? marked : window.marked;
  if (!md || typeof md.parse !== "function") {
    container.textContent = markdownText;
    return;
  }

  const renderer = new md.Renderer();
  renderer.code = (codeOrToken, infostring, escaped) => {
    let code, lang;
    if (codeOrToken && typeof codeOrToken === "object" && "text" in codeOrToken) {
      code = codeOrToken.text ?? codeOrToken.raw ?? "";
      lang = codeOrToken.lang ?? "";
      escaped = codeOrToken.escaped ?? false;
    } else {
      code = typeof codeOrToken === "string" ? codeOrToken : String(codeOrToken ?? "");
      lang = infostring ?? "";
    }
    const safeLang = sanitizePrismLang(lang);
    const className = safeLang ? `language-${safeLang}` : "";
    const safe = escaped ? code : escapeHtml(code);
    return `
      <div class="codeblock" role="group" aria-label="代码块">
        <div class="codeblock-toolbar">
          <button class="code-copy-btn" type="button" aria-label="复制代码">复制</button>
        </div>
        <pre><code class="${className}">${safe}</code></pre>
      </div>
    `;
  };

  md.setOptions({
    gfm: true,
    breaks: true,
    renderer,
  });

  try {
    container.innerHTML = md.parse(normalizeMarkdownMath(markdownText || ""));
  } catch (e) {
    console.error(e);
    container.textContent = markdownText || "";
    return;
  }
  if (window.Prism && typeof window.Prism.highlightAllUnder === "function") {
    window.Prism.highlightAllUnder(container);
  }
  renderMathInContainer(container);
  renderNakedExponentsInContainer(container);
}

function commitAssistantTurn(assistantPlainText, newHistory, uiVersion) {
  if (state.uiVersion !== uiVersion) {
    if (state.typingInterval) {
      clearInterval(state.typingInterval);
      state.typingInterval = null;
    }
    state.typingBuffer = "";
    state.currentAssistant = null;
    return;
  }
  state.messages = newHistory.concat([
    { role: "assistant", content: assistantPlainText },
  ]);
  const lastUser = [...newHistory].reverse().find((item) => item.role === "user");
  if (lastUser?.content) {
    recordLearningDemand("chat", lastUser.content, { content: assistantPlainText });
  }
  updateComposerPlaceholder();
  state.currentAssistant = null;
  saveMessagesPersist();
}

async function updateStudentProfileAfterTurn(userPersist, assistantText, uiVersion) {
  if (state.uiVersion !== uiVersion) return;
  state.profileUpdating = true;
  renderStudentProfile();
  const previousProfile = state.studentProfile || createEmptyProfile();
  const imageNote = userPersist.imageUrls?.length
    ? `本轮学生还上传了 ${userPersist.imageUrls.length} 张图片。`
    : "本轮学生未上传图片。";

  const updaterSystem = `你是学生画像 JSON 更新器。请只输出一个合法 JSON 对象，不要输出 Markdown、解释或代码块。

你需要根据“旧画像”和“本轮对话”更新学生画像。保留仍然有效的旧信息；新信息更具体或冲突时，以新信息为准，并在 evidence 或 last_updated_reason 中说明依据。
每个维度都可能由多个子事实组成，禁止因为确认了一个事实就把整个维度当作完全完整。
如果新信息与旧信息不冲突，应累积到同一字段中，而不是覆盖。例如知识基础可以同时包含“Java 循环薄弱；希望深入学习 C++ 面向对象；数据库基础待确认”。
confidence 只表示该字段中已有信息的可信度，不表示该维度已经 100% 完整。

必须严格使用以下字段：
major_background, learning_goals, knowledge_foundation, cognitive_style, learning_habits, error_patterns, interaction_preference, motivation_emotion, last_updated_reason。
前 8 个字段必须是对象，格式为 {"value": string, "confidence": "确定"|"推测"|"待补充", "evidence": string}。
缺失信息不要编造，使用空字符串和“待补充”。value 和 evidence 都要简洁，但可以用分号保留多个要点。`;

  const updaterUser = `旧画像：
${JSON.stringify(previousProfile, null, 2)}

本轮学生消息：
${userPersist.content}

${imageNote}

本轮助手回答：
${assistantText}

请输出更新后的完整学生画像 JSON。`;

  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: buildChatHeaders(),
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: updaterSystem },
          { role: "user", content: updaterUser },
        ],
        stream: false,
        temperature: 0.1,
      }),
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    const text = data?.choices?.[0]?.message?.content || "";
    const nextProfile = extractJsonObject(text);
    if (nextProfile) saveStudentProfile(nextProfile);
  } catch (e) {
    console.warn("更新学生画像失败", e);
  } finally {
    state.profileUpdating = false;
    renderStudentProfile();
  }
}

async function copyCodeBlock(codeEl) {
  const text = codeEl?.innerText ?? "";
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

function setGeneratingUI(isGenerating) {
  state.isGenerating = isGenerating;
  el.stopBtn.hidden = !isGenerating;
  el.sendBtn.hidden = isGenerating || !hasAnyComposerContent();
}

function hasAnyComposerContent() {
  const text = (el.input.value || "").trim();
  return text.length > 0 || state.attachedFiles.length > 0;
}

function updateSendButton() {
  if (state.isGenerating) return;
  el.sendBtn.hidden = !hasAnyComposerContent();
}

function adjustTextareaHeight() {
  el.input.style.height = "auto";
  const max = 120;
  const next = Math.min(max, el.input.scrollHeight);
  el.input.style.height = `${next}px`;
}

function setComposerVisible(visible) {
  if (el.composer) el.composer.hidden = !visible;
}

function ensureChatVisible() {
  if (!el.chat || !el.home) return;
  setComposerVisible(true);
  if (el.profilePage) el.profilePage.hidden = true;
  if (el.userInfoPage) el.userInfoPage.hidden = true;
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  el.home.hidden = true;
  el.chat.hidden = false;
  el.chatPageBtn?.classList.add("active");
  el.profilePageBtn?.classList.remove("active");
  el.userInfoPageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  el.pushPageBtn?.classList.remove("active");
  el.pathPageBtn?.classList.remove("active");
  el.assessmentPageBtn?.classList.remove("active");
  el.storagePageBtn?.classList.remove("active");
  el.mistakePageBtn?.classList.remove("active");
}

function setPageHash(hash) {
  if (window.location.hash === hash) return;
  window.history.replaceState(null, "", hash || `${window.location.pathname}${window.location.search}`);
}

const USER_INFO_ROUTE_BY_TAB = {
  answers: "blog",
  questions: "projects",
  collections: "about",
  notes: "share",
  prompts: "account",
};

const USER_INFO_TAB_BY_ROUTE = Object.fromEntries(
  Object.entries(USER_INFO_ROUTE_BY_TAB).map(([tab, route]) => [route, tab]),
);
USER_INFO_TAB_BY_ROUTE.blogroll = "prompts";

function userInfoRouteForTab(tab) {
  return USER_INFO_ROUTE_BY_TAB[tab] || USER_INFO_ROUTE_BY_TAB.answers;
}

function userInfoHashFor(tab = "answers", options = {}) {
  const route = userInfoRouteForTab(tab);
  const postId = options.postId ? encodeURIComponent(String(options.postId)) : "";
  if (route === "blog" && postId) return `#user-info/blog/${postId}`;
  const group = options.group || "";
  const query = route === "blog" && group && group !== "year" ? `?group=${encodeURIComponent(group)}` : "";
  return `#user-info/${route}${query}`;
}

function setUserInfoArchiveRoute(tab = "answers", group = "") {
  setPageHash(userInfoHashFor(tab, { group }));
}

function parseUserInfoHash(hash) {
  const raw = String(hash || "").replace(/^#user-info\/?/, "");
  if (!raw) return { mode: "home" };
  const [pathPart, queryPart = ""] = raw.split("?");
  const parts = pathPart.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  const route = parts[0] || "blog";
  if (route === "blog" && parts[1]) return { mode: "post", postId: parts[1] };
  const params = new URLSearchParams(queryPart);
  return {
    mode: "archive",
    tab: USER_INFO_TAB_BY_ROUTE[route] || "answers",
    group: params.get("group") || "",
  };
}

function showHome() {
  setComposerVisible(true);
  state.messages = [];
  try {
    localStorage.removeItem(MESSAGES_STORAGE);
  } catch {
  }
  el.messages.innerHTML = "";
  if (el.chat) el.chat.hidden = true;
  if (el.profilePage) el.profilePage.hidden = true;
  if (el.userInfoPage) el.userInfoPage.hidden = true;
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  if (el.home) el.home.hidden = false;
  el.chatPageBtn?.classList.add("active");
  el.profilePageBtn?.classList.remove("active");
  el.userInfoPageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  el.pushPageBtn?.classList.remove("active");
  el.pathPageBtn?.classList.remove("active");
  el.assessmentPageBtn?.classList.remove("active");
  el.storagePageBtn?.classList.remove("active");
  el.mistakePageBtn?.classList.remove("active");
  setPageHash("");
}

function showProfilePage() {
  if (!el.profilePage) return;
  setComposerVisible(false);
  if (el.home) el.home.hidden = true;
  if (el.chat) el.chat.hidden = true;
  if (el.userInfoPage) el.userInfoPage.hidden = true;
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  el.profilePage.hidden = false;
  el.profilePageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.userInfoPageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  el.pushPageBtn?.classList.remove("active");
  el.pathPageBtn?.classList.remove("active");
  el.assessmentPageBtn?.classList.remove("active");
  el.storagePageBtn?.classList.remove("active");
  el.mistakePageBtn?.classList.remove("active");
  setPageHash("#profile");
  renderStudentProfile();
}

function showUserInfoPage(options = {}) {
  if (!el.userInfoPage) return;
  const mode = options.mode || "home";
  setComposerVisible(false);
  if (el.home) el.home.hidden = true;
  if (el.chat) el.chat.hidden = true;
  if (el.profilePage) el.profilePage.hidden = true;
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  el.userInfoPage.hidden = false;
  el.userInfoPageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  el.pushPageBtn?.classList.remove("active");
  el.pathPageBtn?.classList.remove("active");
  el.assessmentPageBtn?.classList.remove("active");
  el.storagePageBtn?.classList.remove("active");
  el.mistakePageBtn?.classList.remove("active");
  if (mode === "home") {
    state.personalProfileView = "archive";
    state.personalProfileSelectedPostId = "";
    state.personalProfileSelectedPost = null;
    state.personalProfilePostEditable = false;
    if (options.updateHash !== false) setPageHash("#user-info");
    setWikiArchiveMode(false);
  } else if (mode === "post") {
    state.personalProfileTab = "answers";
    state.personalProfileView = "detail";
    state.personalProfileSelectedPostId = String(options.postId || "");
    if (options.updateHash !== false) setPageHash(userInfoHashFor("answers", { postId: options.postId }));
    setWikiArchiveMode(true);
  } else {
    state.personalProfileTab = options.tab || state.personalProfileTab || "answers";
    state.personalProfileFilter = "";
    state.personalProfileView = "archive";
    state.personalProfileSelectedPostId = "";
    state.personalProfileSelectedPost = null;
    state.personalProfilePostEditable = false;
    if (options.group) state.personalArchiveGroup = options.group;
    if (options.updateHash !== false) {
      setPageHash(userInfoHashFor(state.personalProfileTab, { group: state.personalArchiveGroup }));
    }
    setWikiArchiveMode(true);
  }
  renderPersonalProfilePage();
  if (mode === "post" && options.postId) {
    void openProfilePost(options.postId);
  }
}

function showResourcePage() {
  if (!el.resourcePage) return;
  setComposerVisible(false);
  if (el.home) el.home.hidden = true;
  if (el.chat) el.chat.hidden = true;
  if (el.profilePage) el.profilePage.hidden = true;
  if (el.userInfoPage) el.userInfoPage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  el.resourcePage.hidden = false;
  el.resourcePageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
  el.userInfoPageBtn?.classList.remove("active");
  el.pushPageBtn?.classList.remove("active");
  el.pathPageBtn?.classList.remove("active");
  el.assessmentPageBtn?.classList.remove("active");
  el.storagePageBtn?.classList.remove("active");
  el.mistakePageBtn?.classList.remove("active");
  setPageHash("#resources");
  renderLearningResources();
}

function showPushPage() {
  if (!el.pushPage) return;
  setComposerVisible(false);
  if (el.home) el.home.hidden = true;
  if (el.chat) el.chat.hidden = true;
  if (el.profilePage) el.profilePage.hidden = true;
  if (el.userInfoPage) el.userInfoPage.hidden = true;
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  el.pushPage.hidden = false;
  el.pushPageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
  el.userInfoPageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  el.pathPageBtn?.classList.remove("active");
  el.assessmentPageBtn?.classList.remove("active");
  el.storagePageBtn?.classList.remove("active");
  el.mistakePageBtn?.classList.remove("active");
  setPageHash("#push");
  renderPushPage();
}

function showPathPage() {
  if (!el.pathPage) return;
  setComposerVisible(false);
  if (el.home) el.home.hidden = true;
  if (el.chat) el.chat.hidden = true;
  if (el.profilePage) el.profilePage.hidden = true;
  if (el.userInfoPage) el.userInfoPage.hidden = true;
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  el.pathPage.hidden = false;
  el.pathPageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
  el.userInfoPageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  el.pushPageBtn?.classList.remove("active");
  el.assessmentPageBtn?.classList.remove("active");
  el.storagePageBtn?.classList.remove("active");
  el.mistakePageBtn?.classList.remove("active");
  setPageHash("#path");
  renderLearningPathPanel();
}

function showAssessmentPage() {
  if (!el.assessmentPage) return;
  setComposerVisible(false);
  if (el.home) el.home.hidden = true;
  if (el.chat) el.chat.hidden = true;
  if (el.profilePage) el.profilePage.hidden = true;
  if (el.userInfoPage) el.userInfoPage.hidden = true;
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  el.assessmentPage.hidden = false;
  el.assessmentPageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
  el.userInfoPageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  el.pushPageBtn?.classList.remove("active");
  el.pathPageBtn?.classList.remove("active");
  el.storagePageBtn?.classList.remove("active");
  el.mistakePageBtn?.classList.remove("active");
  setPageHash("#assessment");
  renderAssessmentPage();
}

function showStoragePage() {
  if (!el.storagePage) return;
  setComposerVisible(false);
  if (el.home) el.home.hidden = true;
  if (el.chat) el.chat.hidden = true;
  if (el.profilePage) el.profilePage.hidden = true;
  if (el.userInfoPage) el.userInfoPage.hidden = true;
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  el.storagePage.hidden = false;
  el.storagePageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
  el.userInfoPageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  el.pushPageBtn?.classList.remove("active");
  el.pathPageBtn?.classList.remove("active");
  el.assessmentPageBtn?.classList.remove("active");
  el.mistakePageBtn?.classList.remove("active");
  setPageHash("#storage");
  renderStoragePage();
}

function showMistakePage() {
  if (!el.mistakePage) return;
  setComposerVisible(false);
  if (el.home) el.home.hidden = true;
  if (el.chat) el.chat.hidden = true;
  if (el.profilePage) el.profilePage.hidden = true;
  if (el.userInfoPage) el.userInfoPage.hidden = true;
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  el.mistakePage.hidden = false;
  el.mistakePageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
  el.userInfoPageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  el.pushPageBtn?.classList.remove("active");
  el.pathPageBtn?.classList.remove("active");
  el.assessmentPageBtn?.classList.remove("active");
  el.storagePageBtn?.classList.remove("active");
  setPageHash("#mistakes");
  renderMistakeBookPage();
}

function showChatPage() {
  setPageHash("#chat");
  if (state.messages.length > 0) {
    ensureChatVisible();
  } else {
    showHome();
  }
}

function restoreViewFromHash() {
  if (window.location.hash === "#profile") {
    showProfilePage();
  } else if (window.location.hash === "#user-info" || window.location.hash.startsWith("#user-info/")) {
    const route = parseUserInfoHash(window.location.hash);
    if (route.mode === "post") {
      showUserInfoPage({ mode: "post", postId: route.postId, updateHash: false });
    } else if (route.mode === "archive") {
      showUserInfoPage({ mode: "archive", tab: route.tab, group: route.group, updateHash: false });
    } else {
      showUserInfoPage({ updateHash: false });
    }
  } else if (window.location.hash === "#resources") {
    showResourcePage();
  } else if (window.location.hash === "#push") {
    showPushPage();
  } else if (window.location.hash === "#path") {
    showPathPage();
  } else if (window.location.hash === "#assessment") {
    showAssessmentPage();
  } else if (window.location.hash === "#storage") {
    showStoragePage();
  } else if (window.location.hash === "#mistakes") {
    showMistakePage();
  } else if (window.location.hash === "#chat" && state.messages.length > 0) {
    ensureChatVisible();
  }
}

function createAvatarSvg() {
  return `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
      <path d="M12 2a7 7 0 0 1 7 7c0 6-7 13-7 13S5 15 5 9a7 7 0 0 1 7-7Z" opacity="0.85"/>
      <path d="M9.2 10.3c.8-1.3 2.1-2 3.6-1.7" stroke-linecap="round"/>
      <path d="M8.7 14.1c1.1.9 2.8 1.2 4.7.7" stroke-linecap="round"/>
    </svg>
  `;
}

function appendUserMessage(markdownText, attachedImagesPreview) {
  const row = document.createElement("div");
  row.className = "message-row user";

  const bubble = document.createElement("div");
  bubble.className = "bubble user-bubble";
  const textEl = document.createElement("div");
  textEl.className = "typing-text";
  textEl.textContent = markdownText;
  bubble.appendChild(textEl);

  if (attachedImagesPreview?.length) {
    const previewWrap = document.createElement("div");
    previewWrap.style.display = "flex";
    previewWrap.style.gap = "10px";
    previewWrap.style.marginTop = "10px";
    for (const img of attachedImagesPreview) {
      const i = document.createElement("img");
      i.src = img.previewUrl;
      i.style.width = "92px";
      i.style.height = "92px";
      i.style.objectFit = "cover";
      i.style.borderRadius = "14px";
      i.style.border = "1px solid rgba(255,255,255,0.12)";
      previewWrap.appendChild(i);
    }
    bubble.appendChild(previewWrap);
  }

  row.appendChild(bubble);
  el.messages.appendChild(row);
  scrollMessagesToBottom();
}

/** @param {{ restored?: boolean, markdownText?: string }} [opts] */
function appendAssistantMessage(opts = {}) {
  const { restored = false, markdownText = "" } = opts;
  const row = document.createElement("div");
  row.className = "message-row";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.innerHTML = createAvatarSvg();

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const typingEl = document.createElement("div");
  typingEl.className = "typing-text";
  if (restored) {
    typingEl.hidden = true;
  } else {
    typingEl.textContent = "";
  }

  const markdownEl = document.createElement("div");
  markdownEl.className = "markdown-body";
  markdownEl.hidden = !restored;
  if (restored) renderMarkdownInto(markdownEl, markdownText || "");

  bubble.appendChild(typingEl);
  bubble.appendChild(markdownEl);
  row.appendChild(avatar);
  row.appendChild(bubble);

  el.messages.appendChild(row);
  scrollMessagesToBottom();

  return { row, bubble, typingEl, markdownEl };
}

function restorePersistedChat() {
  const list = loadMessagesPersist();
  if (list.length === 0) return;

  state.messages = list;
  el.messages.innerHTML = "";

  for (const m of list) {
    if (m.role === "user") {
      const previews = (m.imageUrls || []).map((url) => ({ previewUrl: url }));
      appendUserMessage(m.content, previews);
    } else {
      appendAssistantMessage({ restored: true, markdownText: m.content });
    }
  }

  ensureChatVisible();
  updateComposerPlaceholder();
  updateSendButton();
  scrollMessagesToBottom();
}

async function fileToDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/** 将持久化后的 user 消息（可选 imageUrls）转成 API 的 content */
function userMessageContentForApi(m) {
  if (m.role !== "user") return m.content;
  const urls = m.imageUrls;
  if (!urls?.length) return m.content;
  return [
    { type: "text", text: m.content },
    ...urls.map((url) => ({ type: "image_url", image_url: { url } })),
  ];
}

function toApiMessages(history, lastUserContent) {
  const base = history.map((m) => ({
    role: m.role,
    content: userMessageContentForApi(m),
  }));
  return base.concat([{ role: "user", content: lastUserContent }]);
}

function updateComposerPlaceholder() {
  if (state.messages.length === 0) {
    el.input.placeholder = "有问题尽管问我";
  } else {
    el.input.placeholder = "输入消息...";
  }
}

function resetAttachment() {
  state.attachedFiles = [];
  state.attachedImages = [];
  if (el.imagePreview) {
    el.imagePreview.innerHTML = "";
    el.imagePreview.classList.remove("has-preview");
    el.imagePreview.setAttribute("aria-hidden", "true");
  }
  if (el.imageInput) {
    el.imageInput.value = "";
  }
}

function renderAttachmentPreview() {
  if (!el.imagePreview) return;
  el.imagePreview.innerHTML = "";

  if (!state.attachedImages.length) {
    el.imagePreview.classList.remove("has-preview");
    el.imagePreview.setAttribute("aria-hidden", "true");
    return;
  }

  el.imagePreview.classList.add("has-preview");
  el.imagePreview.setAttribute("aria-hidden", "false");

  for (let i = 0; i < state.attachedImages.length; i++) {
    const img = state.attachedImages[i];
    const wrap = document.createElement("div");
    wrap.className = "preview-thumb-wrap";

    const node = document.createElement("img");
    node.src = img.previewUrl;
    node.alt = `用户上传的图片 ${i + 1}`;
    node.loading = "eager";
    node.className = "preview-thumb";
    node.dataset.previewUrl = img.previewUrl;
    node.title = "点击放大预览";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "preview-thumb-remove";
    removeBtn.setAttribute("aria-label", "移除图片");
    removeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    removeBtn.dataset.index = String(i);

    wrap.appendChild(node);
    wrap.appendChild(removeBtn);
    el.imagePreview.appendChild(wrap);
  }
}

function removeAttachedImageAtIndex(index) {
  const i = Number(index);
  if (i < 0 || i >= state.attachedImages.length) return;
  try {
    URL.revokeObjectURL(state.attachedImages[i].previewUrl);
  } catch {
  }
  state.attachedImages.splice(i, 1);
  state.attachedFiles.splice(i, 1);
  renderAttachmentPreview();
  updateSendButton();
}

function openImageLightbox(src) {
  if (!el.imageLightbox || !el.lightboxImage) return;
  el.lightboxImage.src = src;
  el.lightboxImage.alt = "预览";
  el.imageLightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeImageLightbox() {
  if (!el.imageLightbox) return;
  el.imageLightbox.hidden = true;
  document.body.style.overflow = "";
}

function updateTopNavVisibility() {
  if (!el.root) return;
  const currentY = window.scrollY || 0;
  const delta = currentY - state.lastScrollY;
  const shouldHide = currentY > 170 && delta > 6;
  const shouldShow = currentY < 80 || delta < -6;
  if (shouldHide && !state.navHidden) {
    state.navHidden = true;
    document.body.classList.add("nav-hidden");
  } else if (shouldShow && state.navHidden) {
    state.navHidden = false;
    document.body.classList.remove("nav-hidden");
  }
  state.lastScrollY = currentY;
}

/** 将 DashScope/OpenAI 兼容流式 data 行解析进 typingBuffer */
function applyDashscopeSsePayload(payload) {
  if (payload === "[DONE]") {
    state.streamingDone = true;
    return;
  }
  let j;
  try {
    j = JSON.parse(payload);
  } catch {
    return;
  }
  const deltaText = j?.choices?.[0]?.delta?.content;
  if (typeof deltaText === "string" && deltaText.length) state.typingBuffer += deltaText;
  if (j?.choices?.[0]?.finish_reason) state.streamingDone = true;

  if (j?.type === "response.output_text.delta" && typeof j.delta === "string") {
    state.typingBuffer += j.delta;
  } else if (j?.type === "response.completed") {
    state.streamingDone = true;
  }
}

async function generateAssistantFromUserText(
  userText,
  attachedFiles,
  attachedImagesPreview = []
) {
  if (!state.apiKey) state.apiKey = localStorage.getItem(API_KEY_STORAGE) || "";
  if (USE_BROWSER_API_KEY && !state.apiKey) throw new Error("Missing API Key");

  const uiVersion = state.uiVersion;

  ensureChatVisible();

  appendUserMessage(userText, attachedImagesPreview);
  const assistant = appendAssistantMessage();

  state.currentAssistant = {
    typingEl: assistant.typingEl,
    markdownEl: assistant.markdownEl,
    fullText: "",
  };

  const prior = state.messages.slice();

  let userContentForApi = userText;
  let dataUrls = [];
  if (attachedFiles?.length) {
    try {
      dataUrls = await Promise.all(attachedFiles.map(fileToDataUrl));
      userContentForApi = [
        { type: "text", text: userText },
        ...dataUrls.map((url) => ({ type: "image_url", image_url: { url } })),
      ];
    } catch {
      userContentForApi = userText;
    }
  }

  const userPersist = { role: "user", content: userText };
  if (dataUrls.length) userPersist.imageUrls = dataUrls;
  const newHistory = prior.concat([userPersist]);

  const apiMessages = toApiMessages(prior, userContentForApi);

  state.isGenerating = true;
  el.stopBtn.hidden = false;
  el.sendBtn.hidden = true;

  
  state.typingBuffer = "";
  state.streamingDone = false;

  const typingSpeedMs = 6;

  function startTypingLoop() {
    if (state.typingInterval) return;
    state.typingInterval = setInterval(() => {
      if (!state.currentAssistant) return;
      if (state.typingBuffer.length > 0) {
        const ch = state.typingBuffer[0];
        state.typingBuffer = state.typingBuffer.slice(1);
        state.currentAssistant.fullText += ch;
        state.currentAssistant.typingEl.textContent = state.currentAssistant.fullText;
        scrollMessagesToBottom();
      } else if (state.streamingDone) {
        clearInterval(state.typingInterval);
        state.typingInterval = null;
        const ca = state.currentAssistant;
        if (!ca) return;
        const full = ca.fullText;
        ca.typingEl.hidden = true;
        ca.markdownEl.hidden = false;
        renderMarkdownInto(ca.markdownEl, full);
        commitAssistantTurn(full, newHistory, uiVersion);
        state.profileUpdateInFlight = updateStudentProfileAfterTurn(
          userPersist,
          full,
          uiVersion
        );
      }
    }, typingSpeedMs);
  }

  startTypingLoop();

  state.abortController = new AbortController();
  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: buildChatHeaders(),
      signal: state.abortController.signal,
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [buildLearningSystemMessage(), ...apiMessages],
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`API 请求失败：${res.status} ${text}`.trim());
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n");
      buffer = parts.pop() || "";

      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        applyDashscopeSsePayload(payload);
      }

      if (state.streamingDone) break;
    }

    state.streamingDone = true;
  } catch (err) {
    if (state.abortController?.signal?.aborted) {
      state.streamingDone = true;
      if (state.typingInterval) {
        clearInterval(state.typingInterval);
        state.typingInterval = null;
      }
      const ca = state.currentAssistant;
      if (ca) {
        const full = (ca.fullText || "") + state.typingBuffer;
        state.typingBuffer = "";
        ca.fullText = full;
        ca.typingEl.hidden = true;
        ca.markdownEl.hidden = false;
        renderMarkdownInto(ca.markdownEl, full);
        commitAssistantTurn(full, newHistory, uiVersion);
      }
    } else {
      state.streamingDone = true;
      if (state.typingInterval) {
        clearInterval(state.typingInterval);
        state.typingInterval = null;
      }
      el.stopBtn.hidden = true;
      el.sendBtn.hidden = false;
      console.error(err);
      const errText = `请求出错：${String(err?.message || err)}`;
      const ca = state.currentAssistant;
      if (ca) {
        ca.typingEl.textContent = errText;
        ca.typingEl.hidden = false;
        ca.markdownEl.hidden = true;
        commitAssistantTurn(errText, newHistory, uiVersion);
      }
    }
  } finally {
    state.isGenerating = false;
    state.abortController = null;
    el.stopBtn.hidden = true;
    updateSendButton();
  }
}

function ensureApiKey(alertMsg) {
  if (!USE_BROWSER_API_KEY) return true;
  if (!state.apiKey) state.apiKey = localStorage.getItem(API_KEY_STORAGE) || "";
  if (state.apiKey) return true;
  alert(alertMsg);
  return false;
}

async function sendCurrentInput() {
  const text = (el.input.value || "").trim();
  if (!text && state.attachedFiles.length === 0) return;

  if (state.isGenerating) return;

  if (
    !ensureApiKey(
      "未配置 API Key，请打开 setup.html 保存到本地（键名：LINGXI_API_KEY），并刷新页面"
    )
  )
    return;

  if (el.apiKeyModal) el.apiKeyModal.hidden = true;

  
  const attachedFiles = state.attachedFiles.slice();
  const attachedImagesPreview = state.attachedImages.slice();
  recordLearningBehavior("chat_question", {
    category: categorizeKnowledge(text, text),
    topic: text,
    title: compactDemandText(text || "图片学习问题"),
    meta: { imageCount: attachedFiles.length },
  });

  
  el.input.value = "";
  adjustTextareaHeight();
  resetAttachment();
  updateSendButton();

  
  await generateAssistantFromUserText(
    text || "（已上传图片，等待我处理）",
    attachedFiles,
    attachedImagesPreview
  );
}

function initEventHandlers() {
  
  if (el.themeToggle) {
    el.themeToggle.addEventListener("click", () => {
      const next = state.theme === "dark" ? "light" : "dark";
      state.theme = next;
      document.body.dataset.theme = next;
      if (el.root) el.root.dataset.theme = next;
      localStorage.setItem(THEME_STORAGE, next);
    });
  }

  el.announcementToggle?.addEventListener("click", () => {
    setAnnouncementPanelOpen(el.announcementPanel?.hidden !== false);
  });
  el.announcementShowAll?.addEventListener("click", () => {
    state.showAllAnnouncements = !state.showAllAnnouncements;
    renderAnnouncements(state.announcements);
  });
  el.announcementMarkAllRead?.addEventListener("click", markAllAnnouncementsRead);
  el.announcementList?.addEventListener("click", (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest("[data-announcement-read]") : null;
    if (!button) return;
    event.stopPropagation();
    markAnnouncementRead(button.getAttribute("data-announcement-read"));
  });
  document.addEventListener("click", (event) => {
    if (!el.announcementCenter || el.announcementCenter.hidden || el.announcementPanel?.hidden) return;
    if (event.target instanceof Node && el.announcementCenter.contains(event.target)) return;
    setAnnouncementPanelOpen(false);
  });

  el.profilePageBtn?.addEventListener("click", showProfilePage);
  el.userInfoPageBtn?.addEventListener("click", showUserInfoPage);
  el.profileEditShortcut?.addEventListener("click", () => showUserInfoPage());
  el.profileHeroAvatar?.addEventListener("click", () => {
    const input = document.querySelector("#profileAvatarImageInput");
    if (input instanceof HTMLInputElement) input.click();
  });
  el.profileTabs?.addEventListener("click", (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest("[data-profile-tab]") : null;
    if (!button) return;
    showUserInfoPage({ mode: "archive", tab: button.getAttribute("data-profile-tab") || "answers" });
  });
  el.userInfoPage?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const floatTabButton = target?.closest(".wiki-float-nav [data-profile-tab]");
    if (floatTabButton) {
      showUserInfoPage({ mode: "archive", tab: floatTabButton.getAttribute("data-profile-tab") || "answers" });
      return;
    }
    const postButton = target?.closest("[data-profile-post-id]");
    if (postButton) {
      showUserInfoPage({ mode: "post", postId: postButton.getAttribute("data-profile-post-id") });
      return;
    }
    const socialButton = target?.closest("[data-profile-social]");
    if (socialButton) {
      openProfileSocialLink(socialButton.getAttribute("data-profile-social") || "");
      return;
    }
    if (target?.closest("[data-open-account-profile]")) {
      openAccountModal("profile");
      return;
    }
    if (target?.closest("[data-open-account-security]")) {
      openAccountModal("security");
      return;
    }
    if (target?.closest("[data-profile-back-archive]")) {
      showUserInfoPage({ mode: "archive", tab: state.personalProfileTab || "answers" });
      return;
    }
    if (target?.closest("[data-profile-edit-post]")) {
      state.personalProfileView = "editing";
      renderProfileContentPanel();
      return;
    }
    if (target?.closest("[data-profile-delete-post]")) {
      void deleteProfilePost();
      return;
    }
    if (target?.closest("[data-profile-cancel-edit]")) {
      state.personalProfileView = "detail";
      renderProfileContentPanel();
      return;
    }
    if (target?.closest(".wiki-avatar-large")) {
      const input = document.querySelector("#profileAvatarImageInput");
      if (input instanceof HTMLInputElement) input.click();
      return;
    }
    if (target?.closest("#personalProfileBio")) {
      startProfileBioEdit();
      return;
    }
    const bioCancel = target?.closest("[data-profile-bio-cancel]");
    if (bioCancel) {
      const form = bioCancel.closest(".wiki-bio-editor");
      if (form) cancelProfileBioEdit(form);
      return;
    }
    const archiveButton = target?.closest("[data-profile-archive]");
    if (archiveButton) {
      showUserInfoPage({
        mode: "archive",
        tab: "answers",
        group: archiveButton.getAttribute("data-profile-archive") || "year",
      });
      return;
    }
    if (target?.closest("#profileMusicButton")) {
      toggleProfileMusic();
      return;
    }
    if (target?.closest(".wiki-music-card div")) {
      const input = document.querySelector("#profileMusicInput");
      if (input instanceof HTMLInputElement) input.click();
      return;
    }
    if (target?.closest(".wiki-photo-card")) {
      const input = document.querySelector("#profilePhotoWallInput");
      if (input instanceof HTMLInputElement) input.click();
      return;
    }
    if (target?.closest(".wiki-write-btn")) {
      showPushPage();
      setFeedComposerOpen(true);
      return;
    }
    const filterButton = target?.closest("[data-profile-filter]");
    if (filterButton) {
      toggleProfileFilter(filterButton.getAttribute("data-profile-filter") || "");
      return;
    }
    const answerButton = target?.closest("[data-answer-action]");
    if (answerButton) {
      handleProfileAnswerAction(answerButton);
    }
  });
  el.userInfoPage?.addEventListener("submit", (event) => {
    const form = event.target instanceof HTMLElement ? event.target.closest("[data-profile-post-editor]") : null;
    const bioForm = event.target instanceof HTMLElement ? event.target.closest(".wiki-bio-editor") : null;
    if (form) {
      event.preventDefault();
      void saveProfilePostEdit(form);
      return;
    }
    if (bioForm) {
      event.preventDefault();
      void saveProfileBioEdit(bioForm);
    }
  });
  document.querySelector("#profileAvatarImageInput")?.addEventListener("change", (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    void saveProfileAvatarImage(input?.files?.[0]).finally(() => {
      if (input) input.value = "";
    });
  });
  document.querySelector("#profilePhotoWallInput")?.addEventListener("change", (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    void saveProfilePhotoWall(input?.files).finally(() => {
      if (input) input.value = "";
    });
  });
  document.querySelector("#profileMusicInput")?.addEventListener("change", (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    void saveProfileMusicTrack(input?.files?.[0]).finally(() => {
      if (input) input.value = "";
    });
  });
  el.chatPageBtn?.addEventListener("click", showChatPage);
  el.resourcePageBtn?.addEventListener("click", showResourcePage);
  el.pushPageBtn?.addEventListener("click", showPushPage);
  el.pathPageBtn?.addEventListener("click", showPathPage);
  el.pathGenerateResourcesBtn?.addEventListener("click", showResourcePage);
  el.assessmentPageBtn?.addEventListener("click", showAssessmentPage);
  el.generateAssessmentBtn?.addEventListener("click", () => void refreshLearningAssessment("desktop_button"));
  el.assessmentPage?.addEventListener("touchstart", (e) => {
    if (!isAssessmentMobileViewport() || !isAssessmentPageVisible() || state.assessmentGenerating) return;
    if (window.scrollY > 2 || e.touches.length !== 1) return;
    state.assessmentPull = {
      active: true,
      startY: e.touches[0].clientY,
      distance: 0,
      armed: false,
    };
  }, { passive: true });
  el.assessmentPage?.addEventListener("touchmove", (e) => {
    if (!state.assessmentPull.active || e.touches.length !== 1) return;
    const distance = Math.max(0, e.touches[0].clientY - state.assessmentPull.startY);
    if (distance <= 0) return;
    state.assessmentPull.distance = distance;
    state.assessmentPull.armed = distance >= 74;
    setAssessmentPullStatus(distance, state.assessmentPull.armed, false);
    if (distance > 8) e.preventDefault();
  }, { passive: false });
  el.assessmentPage?.addEventListener("touchend", () => {
    if (!state.assessmentPull.active) return;
    const armed = state.assessmentPull.armed;
    if (armed) {
      setAssessmentPullStatus(72, true, true);
      void refreshLearningAssessment("mobile_pull").finally(() => resetAssessmentPullStatus(420));
    } else {
      resetAssessmentPullStatus();
    }
  });
  el.assessmentPage?.addEventListener("touchcancel", () => {
    resetAssessmentPullStatus();
  });
  el.assessmentGrid?.addEventListener("click", (e) => {
    const btn = e.target instanceof HTMLElement ? e.target.closest("[data-assessment-go-path]") : null;
    if (btn) showPathPage();
  });
  el.learningPathPanel?.addEventListener("change", (e) => {
    const input = e.target instanceof HTMLInputElement ? e.target : null;
    if (!input || !input.matches("[data-path-todo]")) return;
    const key = input.getAttribute("data-path-todo");
    if (!key) return;
    if (input.checked) {
      state.learningPathTodoDone[key] = true;
      recordLearningBehavior("path_todo_done", {
        category: state.activePathCategory,
        topic: getActivePathData()?.topic || "",
        title: key,
      });
    } else {
      delete state.learningPathTodoDone[key];
      recordLearningBehavior("path_todo_reopen", {
        category: state.activePathCategory,
        topic: getActivePathData()?.topic || "",
        title: key,
      });
    }
    saveLearningPathTodoDone();
    renderLearningPathPanel();
  });
  el.learningPathPanel?.addEventListener("click", (e) => {
    const btn = e.target instanceof HTMLElement ? e.target.closest("[data-path-category]") : null;
    if (!btn) return;
    const category = btn.getAttribute("data-path-category");
    if (category) setActivePathCategory(category);
  });
  el.pushGrid?.addEventListener("click", (e) => {
    const btn = e.target instanceof HTMLElement ? e.target.closest("[data-path-category]") : null;
    if (btn) {
      const category = btn.getAttribute("data-path-category");
      if (category) setActivePathCategory(category);
      return;
    }
    const openBtn = e.target instanceof HTMLElement ? e.target.closest("[data-push-open-index], [data-push-resource-index]") : null;
    if (!openBtn) return;
    const index = Number(openBtn.getAttribute("data-push-open-index") || openBtn.getAttribute("data-push-resource-index"));
    if (Number.isInteger(index)) {
      const activeData = getActivePathData();
      const resource = activeData?.resources?.[index];
      recordLearningBehavior("push_open", {
        category: activeData?.category,
        topic: activeData?.topic,
        title: resource?.title || "",
        meta: { resourceType: resource?.type || "" },
      });
      openPushResourceDetail(index);
    }
  });
  el.pushGrid?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target instanceof HTMLElement ? e.target.closest("[data-push-resource-index]") : null;
    if (!card) return;
    e.preventDefault();
    const index = Number(card.getAttribute("data-push-resource-index"));
    if (Number.isInteger(index)) {
      const activeData = getActivePathData();
      const resource = activeData?.resources?.[index];
      recordLearningBehavior("push_open", {
        category: activeData?.category,
        topic: activeData?.topic,
        title: resource?.title || "",
        meta: { resourceType: resource?.type || "" },
      });
      openPushResourceDetail(index);
    }
  });
  el.pushDetailClose?.addEventListener("click", closePushResourceDetail);
  el.pushDetailModal?.addEventListener("click", (e) => {
    if (!(e.target instanceof HTMLElement)) return;
    if (e.target.hasAttribute("data-push-detail-close")) {
      closePushResourceDetail();
      return;
    }
    const sceneToggle = e.target.closest("[data-video-scenes-toggle]");
    if (sceneToggle) {
      const videoResource = sceneToggle.closest(".video-resource");
      const list = videoResource?.querySelector(".video-scene-list");
      if (list) {
        const expanded = sceneToggle.getAttribute("aria-expanded") === "true";
        list.hidden = expanded;
        sceneToggle.setAttribute("aria-expanded", String(!expanded));
        sceneToggle.textContent = expanded ? "展开讲解要点" : "收起讲解要点";
      }
      return;
    }
    const mistakeBtn = e.target.closest("[data-add-mistake]");
    if (mistakeBtn) {
      const [resourceIndexRaw, exerciseIndexRaw] = String(mistakeBtn.getAttribute("data-add-mistake") || "").split(":");
      const resourceIndex = Number(resourceIndexRaw);
      const exerciseIndex = Number(exerciseIndexRaw);
      const activeData = getActivePathData();
      const resource = activeData?.resources?.[resourceIndex];
      const exercise = normalizeExerciseList(resource?.content || "", resource?.title || "")[exerciseIndex];
      if (exercise) {
        addExerciseToMistakeBook(exercise, resource);
        recordLearningBehavior("mistake_added", {
          category: exercise.knowledge || resource?.category || activeData?.category,
          topic: resource?.title || "",
          title: exercise.question || "",
          meta: { difficulty: exercise.difficulty || "", type: exercise.type || "" },
        });
        mistakeBtn.textContent = "已加入错题本";
      }
    }
  });
  el.storagePageBtn?.addEventListener("click", showStoragePage);
  el.mistakePageBtn?.addEventListener("click", showMistakePage);
  el.generateResourcesBtn?.addEventListener("click", () => void generateLearningResources());
  el.agentPipeline?.addEventListener("click", (e) => {
    const btn = e.target instanceof HTMLElement ? e.target.closest("[data-agent-id]") : null;
    const id = btn?.getAttribute("data-agent-id");
    if (id) toggleResourceAgent(id);
  });
  el.resourceGrid?.addEventListener("click", (e) => {
    if (e.target instanceof HTMLElement && e.target.closest("[data-mindmap-export], [data-mindmap-layout]")) return;
    const renderVideoBtn = e.target instanceof HTMLElement ? e.target.closest("[data-render-video]") : null;
    if (renderVideoBtn) {
      const index = Number(renderVideoBtn.getAttribute("data-render-video"));
      if (Number.isInteger(index)) {
        const resource = state.learningResources?.resources?.[index];
        recordLearningBehavior("video_render", {
          category: state.learningResources?.category,
          topic: state.learningResources?.topic,
          title: resource?.title || "",
          meta: { resourceType: resource?.type || "" },
        });
        void renderResourceVideo(index);
      }
      return;
    }
    const downloadVideoBtn = e.target instanceof HTMLElement ? e.target.closest("[data-download-video]") : null;
    if (downloadVideoBtn) {
      const index = Number(downloadVideoBtn.getAttribute("data-download-video"));
      if (Number.isInteger(index)) downloadRenderedVideo(index);
      return;
    }
    const sceneToggle = e.target instanceof HTMLElement ? e.target.closest("[data-video-scenes-toggle]") : null;
    if (sceneToggle) {
      const videoResource = sceneToggle.closest(".video-resource");
      const list = videoResource?.querySelector(".video-scene-list");
      if (list) {
        const expanded = sceneToggle.getAttribute("aria-expanded") === "true";
        list.hidden = expanded;
        sceneToggle.setAttribute("aria-expanded", String(!expanded));
        sceneToggle.textContent = expanded ? "展开讲解要点" : "收起讲解要点";
      }
      return;
    }
    const downloadBtn = e.target instanceof HTMLElement ? e.target.closest("[data-resource-download-index]") : null;
    if (downloadBtn) {
      const index = Number(downloadBtn.getAttribute("data-resource-download-index"));
      if (Number.isInteger(index)) {
        const resource = state.learningResources?.resources?.[index];
        recordLearningBehavior("resource_download", {
          category: state.learningResources?.category,
          topic: state.learningResources?.topic,
          title: resource?.title || "",
          meta: { resourceType: resource?.type || "" },
        });
        storeAndDownloadResource(index);
      }
      return;
    }
    const mistakeBtn = e.target instanceof HTMLElement ? e.target.closest("[data-add-mistake]") : null;
    if (mistakeBtn) {
      const [resourceIndexRaw, exerciseIndexRaw] = String(mistakeBtn.getAttribute("data-add-mistake") || "").split(":");
      const resourceIndex = Number(resourceIndexRaw);
      const exerciseIndex = Number(exerciseIndexRaw);
      const resource = state.learningResources?.resources?.[resourceIndex];
      const exercise = normalizeExerciseList(resource?.content || "", resource?.title || "")[exerciseIndex];
      if (exercise) {
        addExerciseToMistakeBook(exercise, resource);
        recordLearningBehavior("mistake_added", {
          category: exercise.knowledge || state.learningResources?.category,
          topic: resource?.title || "",
          title: exercise.question || "",
          meta: { difficulty: exercise.difficulty || "", type: exercise.type || "" },
        });
        mistakeBtn.textContent = "已加入错题本";
      }
      return;
    }
    const btn = e.target instanceof HTMLElement ? e.target.closest(".resource-toggle") : null;
    if (!btn) return;
    const card = btn.closest(".resource-card");
    const body = card?.querySelector(".resource-body");
    const preview = card?.querySelector(".resource-preview");
    if (!body || !preview) return;
    const expanded = btn.getAttribute("aria-expanded") === "true";
    body.hidden = expanded;
    preview.hidden = !expanded;
    btn.setAttribute("aria-expanded", String(!expanded));
    btn.textContent = expanded ? "展开全文" : "收起";
    if (!expanded) {
      const cards = Array.from(el.resourceGrid?.querySelectorAll(".resource-card") || []);
      const index = cards.indexOf(card);
      const resource = state.learningResources?.resources?.[index];
      recordLearningBehavior("resource_open", {
        category: state.learningResources?.category,
        topic: state.learningResources?.topic,
        title: resource?.title || "",
        meta: { resourceType: resource?.type || "" },
      });
      initMindmapCanvases(body);
    }
  });
  el.resourceGrid?.addEventListener("input", (e) => {
    const slider = e.target instanceof HTMLElement ? e.target.closest("[data-mindmap-width]") : null;
    if (!slider) return;
    const canvas = slider.closest(".mindmap-view")?.querySelector(".mindmap-canvas");
    const value = Number(slider.value);
    if (canvas && Number.isFinite(value)) {
      autoLayoutMindmapCanvas(canvas, value);
    }
  });
  el.resourceGrid?.addEventListener("click", (e) => {
    const exportBtn = e.target instanceof HTMLElement ? e.target.closest("[data-mindmap-export]") : null;
    const layoutBtn = e.target instanceof HTMLElement ? e.target.closest("[data-mindmap-layout]") : null;
    if (!exportBtn && !layoutBtn) return;
    const canvas = (exportBtn || layoutBtn).closest(".mindmap-view")?.querySelector(".mindmap-canvas");
    if (layoutBtn && canvas) {
      autoLayoutMindmapCanvas(canvas);
      return;
    }
    if (canvas) storeAndDownloadMindmapSvg(canvas);
  });
  el.resourceGrid?.addEventListener("pointerdown", (e) => {
    const node = e.target instanceof HTMLElement ? e.target.closest(".mindmap-node") : null;
    if (!node) return;
    const canvas = node.closest(".mindmap-canvas");
    if (!canvas) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const baseX = parseFloat(node.style.left) || 0;
    const baseY = parseFloat(node.style.top) || 0;
    node.setPointerCapture?.(e.pointerId);
    node.classList.add("dragging");
    const move = (event) => {
      node.style.left = `${baseX + event.clientX - startX}px`;
      node.style.top = `${baseY + event.clientY - startY}px`;
      updateMindmapLines(canvas);
    };
    const up = () => {
      node.classList.remove("dragging");
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
  });
  el.storageGrid?.addEventListener("click", (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    const actionEl = target?.closest("[data-storage-action]");
    const action = actionEl?.getAttribute("data-storage-action");
    if (!action) return;
    const category = actionEl.getAttribute("data-storage-category");
    const id = actionEl.getAttribute("data-storage-id");
    const file = state.storedMarkdownFiles.find((item) => item.id === id);
    if (action === "rename-category" && category) renameStorageCategory(category);
    if (action === "delete-category" && category) deleteStorageCategory(category);
    if (action === "open-file" && file) {
      recordLearningBehavior("storage_open", { category: file.category, title: file.title || file.filename });
      openStorageFile(file);
    }
    if (action === "download-file" && file) {
      recordLearningBehavior("storage_download", { category: file.category, title: file.title || file.filename });
      downloadMarkdownFile(file);
    }
    if (action === "delete-file" && id) deleteStorageFile(id);
  });
  el.storageGrid?.addEventListener("dblclick", (e) => {
    const card = e.target instanceof HTMLElement ? e.target.closest("[data-storage-file-id]") : null;
    const id = card?.getAttribute("data-storage-file-id");
    const file = state.storedMarkdownFiles.find((item) => item.id === id);
    if (file) {
      recordLearningBehavior("storage_open", { category: file.category, title: file.title || file.filename });
      openStorageFile(file);
    }
  });
  el.storageGrid?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const card = e.target instanceof HTMLElement ? e.target.closest("[data-storage-file-id]") : null;
    const id = card?.getAttribute("data-storage-file-id");
    const file = state.storedMarkdownFiles.find((item) => item.id === id);
    if (file) {
      recordLearningBehavior("storage_open", { category: file.category, title: file.title || file.filename });
      openStorageFile(file);
    }
  });
  el.mistakeBookGrid?.addEventListener("click", (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    const groupBy = target?.closest("[data-mistake-groupby]")?.getAttribute("data-mistake-groupby");
    if (groupBy) {
      setMistakeBookGroupBy(groupBy);
      return;
    }
    const id = target?.closest("[data-mistake-delete]")?.getAttribute("data-mistake-delete") || null;
    if (id) deleteMistakeBookItem(id);
  });
  el.storageModalClose?.addEventListener("click", closeStorageModal);
  el.storageModal?.addEventListener("click", (e) => {
    if (e.target instanceof HTMLElement && e.target.hasAttribute("data-storage-close")) closeStorageModal();
  });
  el.storageEditTitle?.addEventListener("input", markStorageEditorDirty);
  el.storageEditCategory?.addEventListener("input", markStorageEditorDirty);
  el.storageEditContent?.addEventListener("input", () => {
    markStorageEditorDirty();
    updateStoragePreview();
  });
  el.storageSvgZoom?.addEventListener("input", () => setStorageSvgZoom(el.storageSvgZoom.value));
  el.storagePreviewTools?.addEventListener("click", (e) => {
    const action = e.target instanceof HTMLElement ? e.target.closest("[data-svg-zoom]")?.getAttribute("data-svg-zoom") : null;
    if (!action) return;
    if (action === "in") setStorageSvgZoom(state.storageSvgZoom + 20);
    if (action === "out") setStorageSvgZoom(state.storageSvgZoom - 20);
    if (action === "reset") setStorageSvgZoom(100);
    if (action === "fullscreen") openStorageSvgFullscreen();
  });
  el.storageSaveFileBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    saveActiveStorageFile();
  });
  el.storageDownloadFileBtn?.addEventListener("click", () => {
    const file = getActiveStorageFile();
    if (file) {
      recordLearningBehavior("storage_download", { category: file.category, title: file.title || file.filename });
      downloadMarkdownFile(file);
    }
  });
  el.storageDeleteFileBtn?.addEventListener("click", () => {
    const file = getActiveStorageFile();
    if (file) deleteStorageFile(file.id);
  });
  el.storageResizeHandle?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    state.storageResizeActive = true;
    el.storageResizeHandle?.setPointerCapture?.(e.pointerId);
    updateStorageEditorSplitFromPointer(e.clientX);
  });
  el.storageResizeHandle?.addEventListener("pointermove", (e) => {
    if (!state.storageResizeActive) return;
    updateStorageEditorSplitFromPointer(e.clientX);
  });
  el.storageResizeHandle?.addEventListener("pointerup", () => {
    if (!state.storageResizeActive) return;
    state.storageResizeActive = false;
    localStorage.setItem(STORAGE_EDITOR_SPLIT_STORAGE, String(state.storageEditorSplit));
  });
  el.storageResizeHandle?.addEventListener("dblclick", () => {
    applyStorageEditorSplit(50);
    localStorage.setItem(STORAGE_EDITOR_SPLIT_STORAGE, "50");
  });
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const fullscreen = document.querySelector("#storageSvgFullscreen");
    if (fullscreen && !fullscreen.hidden) {
      closeStorageSvgFullscreen();
      return;
    }
    if (el.storageModal && !el.storageModal.hidden) closeStorageModal();
  });
  window.addEventListener("resize", () => {
    const fullscreen = document.querySelector("#storageSvgFullscreen");
    if (fullscreen && !fullscreen.hidden) requestAnimationFrame(fitStorageFullscreenSvg);
  });
  window.addEventListener("scroll", updateTopNavVisibility, { passive: true });
  el.profileBackBtn?.addEventListener("click", showChatPage);
  window.addEventListener("hashchange", restoreViewFromHash);

  el.input.addEventListener("input", () => {
    adjustTextareaHeight();
    updateSendButton();
    updateComposerPlaceholder();
  });

  el.input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    
    if (e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    void sendCurrentInput();
  });

  el.sendBtn.addEventListener("click", () => {
    void sendCurrentInput();
  });

  
  el.imagePreview.addEventListener("click", (e) => {
    const removeBtn = e.target instanceof HTMLElement ? e.target.closest(".preview-thumb-remove") : null;
    if (removeBtn) {
      e.stopPropagation();
      const idx = removeBtn.dataset.index;
      if (idx != null) removeAttachedImageAtIndex(idx);
      return;
    }
    const img = e.target instanceof HTMLImageElement ? e.target : null;
    if (!img || !img.classList.contains("preview-thumb")) return;
    const src = img.dataset.previewUrl || img.src;
    if (src) openImageLightbox(src);
  });

  
  el.imageInput.addEventListener("change", async () => {
    const files = Array.from(el.imageInput.files || []);
    if (!files.length) {
      resetAttachment();
      updateSendButton();
      return;
    }

    state.attachedFiles = files;
    state.attachedImages = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    renderAttachmentPreview();
    updateSendButton();

    
    el.imageInput.value = "";
  });

  
  el.clearBtn.addEventListener("click", () => {
    if (state.isGenerating && state.abortController) state.abortController.abort();
    state.uiVersion += 1;
    showHome();
    resetAttachment();
    updateSendButton();
    updateComposerPlaceholder();
  });

  
  el.stopBtn.addEventListener("click", () => {
    if (!state.abortController) return;
    
    state.typingBuffer = "";
    if (state.typingInterval) {
      clearInterval(state.typingInterval);
      state.typingInterval = null;
    }
    state.streamingDone = true;
    state.abortController.abort();
  });
}

function initApiKeyModal() {
  if (!USE_BROWSER_API_KEY) {
    if (el.apiKeyModal) el.apiKeyModal.hidden = true;
    if (el.keyBanner) el.keyBanner.hidden = true;
    return;
  }
  
  state.apiKey = localStorage.getItem(API_KEY_STORAGE) || "";
  if (state.apiKey) {
    if (el.apiKeyModal) el.apiKeyModal.hidden = true;
    if (el.keyBanner) el.keyBanner.hidden = true;
  } else {
    if (el.apiKeyModal) el.apiKeyModal.hidden = true;
    if (el.keyBanner) el.keyBanner.hidden = false;
  }

  
  el.apiKeyModal?.addEventListener("click", (e) => {
    const btn = e.target instanceof HTMLElement ? e.target.closest("button") : null;
    if (!btn || !(btn instanceof HTMLElement)) return;

    if (btn.id === "saveApiKeyBtn") {
      try {
        const v = (el.apiKeyInput?.value || "").trim();
        if (!v) {
          alert("请输入 API Key");
          return;
        }
        localStorage.setItem(API_KEY_STORAGE, v);
        state.apiKey = v;
        if (el.apiKeyModal) el.apiKeyModal.hidden = true;
        if (el.keyBanner) el.keyBanner.hidden = true;
      } catch (err) {
        alert(`保存失败：${String(err?.message || err)}`);
      }
      return;
    }

    if (btn.id === "closeApiKeyBtn" && el.apiKeyModal) {
      el.apiKeyModal.hidden = true;
    }
  });
}

function initTheme() {
  const stored = localStorage.getItem(THEME_STORAGE);
  state.theme = stored || "dark";
  document.body.dataset.theme = state.theme;
  if (el.root) el.root.dataset.theme = state.theme;
}

function initComposer() {
  adjustTextareaHeight();
  updateComposerPlaceholder();
  updateSendButton();
}

function initImageLightbox() {
  if (el.lightboxClose) {
    el.lightboxClose.addEventListener("click", closeImageLightbox);
  }
  if (el.lightboxBackdrop) {
    el.lightboxBackdrop.addEventListener("click", closeImageLightbox);
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el.imageLightbox && !el.imageLightbox.hidden) {
      closeImageLightbox();
    }
  });
}

function initCopyDelegation() {
  document.addEventListener("click", async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("code-copy-btn")) return;

    const codeBlock = target.closest(".codeblock");
    const codeEl = codeBlock?.querySelector("code");
    await copyCodeBlock(codeEl);

    const prev = target.textContent;
    target.textContent = "已复制";
    setTimeout(() => {
      target.textContent = prev;
    }, 900);
  });
}
