function reloadUserWorkspace() {
  state.studentProfile = loadStudentProfile();
  state.learningDemandEvents = loadLearningDemandEvents();
  state.learningBehaviorEvents = loadLearningBehaviorEvents();
  state.learningPathLibrary = loadLearningPathLibrary();
  const persistedActivePathCategory = loadActivePathCategory();
  state.activePathCategory = persistedActivePathCategory;
  state.learningResources = loadLearningResources();
  if (state.learningResources?.resources?.length) upsertLearningPathLibrary(state.learningResources);
  if (persistedActivePathCategory && state.learningPathLibrary?.[persistedActivePathCategory]) {
    state.activePathCategory = persistedActivePathCategory;
  }
  state.learningPathTodoDone = loadLearningPathTodoDone();
  state.storedMarkdownFiles = loadStoredMarkdownFiles();
  state.mistakeBookItems = loadMistakeBookItems();
  state.mistakeBookGroupBy = loadMistakeBookGroupBy();
  state.learningAssessment = loadLearningAssessment();
  state.storageEditorSplit = loadStorageEditorSplit();
  applyStorageEditorSplit(state.storageEditorSplit);
  renderStudentProfile();
  renderLearningResources();
  renderStoragePage();
  renderMistakeBookPage();
  renderAssessmentPage();
  restorePersistedChat();
  restoreViewFromHash();
  initComposer();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizePrismLang(lang) {
  const s = String(lang || "").trim().split(/\s+/)[0];
  return s.replace(/[^\w-]/g, "");
}

function formatMathExpression(expression) {
  const replacements = {
    "\\alpha": "α",
    "\\beta": "β",
    "\\gamma": "γ",
    "\\delta": "δ",
    "\\epsilon": "ε",
    "\\varepsilon": "ε",
    "\\ge": "≥",
    "\\le": "≤",
    "\\neq": "≠",
    "\\to": "→",
    "\\rightarrow": "→",
    "\\mid": "|",
    "\\subset": "⊂",
    "\\subseteq": "⊆",
    "\\in": "∈",
    "\\notin": "∉",
    "\\emptyset": "∅",
    "\\varnothing": "∅",
    "\\cup": "∪",
    "\\cap": "∩",
    "\\forall": "∀",
    "\\exists": "∃",
  };
  let html = escapeHtml(String(expression || "").trim());
  Object.entries(replacements).forEach(([token, value]) => {
    html = html.replaceAll(escapeHtml(token), value);
  });
  html = html
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/\\text\{([^{}]+)\}/g, "$1")
    .replace(/-&gt;/g, "→")
    .replace(/&gt;=/g, "≥")
    .replace(/&lt;=/g, "≤")
    .replace(/\^(\{([^{}]+)\}|([A-Za-z0-9+\-=]+))/g, (_, __, group, simple) => `<sup>${group || simple}</sup>`)
    .replace(/_(\{([^{}]+)\}|([A-Za-z0-9+\-=]+))/g, (_, __, group, simple) => `<sub>${group || simple}</sub>`);
  return html.replace(/\s+/g, " ");
}

function hasLooseMath(text) {
  return /\\(?:alpha|beta|gamma|delta|epsilon|varepsilon|to|rightarrow|ge|le|neq|mid|in|notin|subset|subseteq|emptyset|varnothing|cup|cap|forall|exists)|(?<![A-Za-z0-9_])[A-Za-z](?:[_^]\{?[A-Za-z0-9+\-=]+\}?)+|[A-Z]\s*=\s*\\?\{/.test(text || "");
}

function renderLooseMathInTextNode(node) {
  const text = node.nodeValue || "";
  if (!hasLooseMath(text)) return;
  const pattern = /([A-Z]\s*=\s*\\?\{[^。；，,\n]+\\?\}|\\(?:alpha|beta|gamma|delta|epsilon|varepsilon|to|rightarrow|ge|le|neq|mid|in|notin|subset|subseteq|emptyset|varnothing|cup|cap|forall|exists)|(?<![A-Za-z0-9_])[A-Za-z](?:[_^]\{?[A-Za-z0-9+\-=]+\}?)+)/g;
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  text.replace(pattern, (match, _all, offset) => {
    if (offset > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
    const span = document.createElement("span");
    span.className = "math math-inline";
    span.innerHTML = formatMathExpression(match);
    fragment.appendChild(span);
    lastIndex = offset + match.length;
    return match;
  });
  if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  node.parentNode?.replaceChild(fragment, node);
}

function renderMathInContainer(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest("pre, code, textarea, script, style")) return NodeFilter.FILTER_REJECT;
      return /\\\(|\\\[|\$/.test(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  const mathRegex = /(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g;
  textNodes.forEach((node) => {
    const text = node.nodeValue || "";
    if (!mathRegex.test(text)) return;
    mathRegex.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    text.replace(mathRegex, (match, _all, offset) => {
      if (offset > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
      const isDisplay = match.startsWith("$$") || match.startsWith("\\[");
      const raw = match.startsWith("$$")
        ? match.slice(2, -2)
        : match.startsWith("$")
          ? match.slice(1, -1)
          : match.slice(2, -2);
      const span = document.createElement("span");
      span.className = isDisplay ? "math math-display" : "math math-inline";
      span.innerHTML = formatMathExpression(raw);
      fragment.appendChild(span);
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    node.parentNode?.replaceChild(fragment, node);
  });
}

function renderNakedExponentsInContainer(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest("pre, code, textarea, script, style, .math")) return NodeFilter.FILTER_REJECT;
      return /(?<![A-Za-z0-9_])[A-Za-z][_^]\{?[A-Za-z0-9+\-=]+\}?/.test(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => {
    renderLooseMathInTextNode(node);
  });
}

function renderInlineMathText(text) {
  const source = String(text || "");
  const mathRegex = /(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g;
  let html = "";
  let lastIndex = 0;
  source.replace(mathRegex, (match, _all, offset) => {
    html += escapeHtml(source.slice(lastIndex, offset));
    const raw = match.startsWith("$$")
      ? match.slice(2, -2)
      : match.startsWith("$")
        ? match.slice(1, -1)
        : match.slice(2, -2);
    html += `<span class="math math-inline">${formatMathExpression(raw)}</span>`;
    lastIndex = offset + match.length;
    return match;
  });
  html += escapeHtml(source.slice(lastIndex));
  return html
    .replace(/(?<![A-Za-z0-9_])([A-Za-z])\^(\{([^{}]+)\}|([A-Za-z0-9+\-=]+))/g, (_, base, __, group, simple) => `<span class="math math-inline">${base}<sup>${group || simple}</sup></span>`)
    .replace(/(?<![A-Za-z0-9_])([A-Za-z])_(\{([^{}]+)\}|([A-Za-z0-9+\-=]+))/g, (_, base, __, group, simple) => `<span class="math math-inline">${base}<sub>${group || simple}</sub></span>`)
    .replace(/\\alpha/g, '<span class="math math-inline">α</span>')
    .replace(/\\beta/g, '<span class="math math-inline">β</span>')
    .replace(/\\gamma/g, '<span class="math math-inline">γ</span>')
    .replace(/\\to|-&gt;/g, "→")
    .replace(/\\ge|&gt;=/g, "≥")
    .replace(/\\le|&lt;=/g, "≤")
    .replace(/\\mid/g, "|");
}

function normalizeMarkdownMath(markdownText) {
  const normalized = String(markdownText || "").replace(/```(?:text)?\s*\n([^`\n]*(?:\^[A-Za-z0-9]|_[A-Za-z0-9]|>=|<=|->|→|⊂|[A-Z]\s*=)[^`\n]*)\n```/g, (_match, body) => {
    const expression = String(body || "").trim();
    if (!expression || expression.length > 160) return _match;
    const latex = expression
      .replace(/\|/g, "\\mid")
      .replace(/>=/g, "\\ge")
      .replace(/<=/g, "\\le")
      .replace(/->/g, "\\to");
    return `$$${latex}$$`;
  });
  return normalized.replace(/(^|[：:，,；;\s])([A-Z]\s*=\s*\\?\{[^。\n]+?\\?\})(?=$|[。；;\n])/g, (_match, lead, expression) => `${lead}$${expression}$`);
}

function scrollMessagesToBottom() {
  if (!el.messages) return;
  el.messages.scrollTop = el.messages.scrollHeight;
}

function createEmptyProfile() {
  const profile = {};
  for (const key of PROFILE_FIELDS) {
    profile[key] = {
      value: "",
      confidence: "待补充",
      evidence: "",
    };
  }
  profile.last_updated_reason = "尚未开始画像更新";
  return profile;
}

function normalizeProfile(input) {
  const source = input && typeof input === "object" ? input : {};
  const profile = createEmptyProfile();
  for (const key of PROFILE_FIELDS) {
    const item = source[key] && typeof source[key] === "object" ? source[key] : {};
    const confidence = ["确定", "推测", "待补充"].includes(item.confidence)
      ? item.confidence
      : "待补充";
    profile[key] = {
      value: typeof item.value === "string" ? item.value : "",
      confidence,
      evidence: typeof item.evidence === "string" ? item.evidence : "",
    };
  }
  if (typeof source.last_updated_reason === "string") {
    profile.last_updated_reason = source.last_updated_reason;
  }
  return profile;
}

function loadStudentProfile() {
  try {
    const raw = localStorage.getItem(STUDENT_PROFILE_STORAGE);
    if (!raw) return createEmptyProfile();
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return createEmptyProfile();
  }
}

function saveStudentProfile(profile) {
  state.studentProfile = normalizeProfile(profile);
  try {
    localStorage.setItem(STUDENT_PROFILE_STORAGE, JSON.stringify(state.studentProfile));
  } catch (e) {
    console.warn("保存学生画像失败", e);
  }
  renderStudentProfile();
  if (typeof renderProfileContentPanel === "function" && state.personalProfileTab === "notes" && !state.publicProfile) {
    renderProfileContentPanel();
  }
}

function loadLearningResources() {
  try {
    const raw = localStorage.getItem(LEARNING_RESOURCES_STORAGE);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.resources)) return null;
    return normalizeGeneratedResources(data, data.topic || "");
  } catch {
    return null;
  }
}

function saveLearningResources(data) {
  state.learningResources = data && Array.isArray(data.resources) ? data : null;
  try {
    if (state.learningResources) {
      localStorage.setItem(LEARNING_RESOURCES_STORAGE, JSON.stringify(state.learningResources));
      upsertLearningPathLibrary(state.learningResources);
    }
  } catch (e) {
    console.warn("保存学习资源失败", e);
  }
  renderLearningResources();
  renderPushPage();
  renderAssessmentPage();
}

function normalizePathCategory(category) {
  return String(category || "其他").trim() || "其他";
}

function inferPathCategory(pathData) {
  if (!pathData) return "其他";
  const titleText = [
    pathData.demand_source?.primary,
    pathData.topic,
    pathData.title,
    ...(Array.isArray(pathData.resources) ? pathData.resources.map((item) => item.title || item.type || "") : []),
  ].filter(Boolean).join(" ");
  const contentText = [
    titleText,
    ...(Array.isArray(pathData.resources) ? pathData.resources.map((item) => resourcePlainText(item.content || "")).slice(0, 2) : []),
  ].join(" ");
  return categorizeKnowledge(titleText, contentText);
}

function loadLearningPathLibrary() {
  try {
    const data = JSON.parse(localStorage.getItem(LEARNING_PATH_LIBRARY_STORAGE) || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return migrateLearningPathLibrary(data);
  } catch {
    return {};
  }
}

function migrateLearningPathLibrary(library) {
  const next = {};
  for (const [key, value] of Object.entries(library || {})) {
    const inferred = inferPathCategory(value);
    const category = normalizePathCategory(inferred && inferred !== "其他" ? inferred : (value?.category || key));
    next[category] = {
      ...(next[category] || {}),
      ...value,
      category,
    };
  }
  return next;
}

function saveLearningPathLibrary() {
  try {
    localStorage.setItem(LEARNING_PATH_LIBRARY_STORAGE, JSON.stringify(state.learningPathLibrary || {}));
  } catch (e) {
    console.warn("保存学习路径库失败", e);
  }
}

function reindexLearningPathLibrary() {
  const library = state.learningPathLibrary || {};
  const entries = Object.entries(library);
  if (!entries.length) return;
  const next = {};
  const keyMap = {};
  let changed = false;
  for (const [key, value] of entries) {
    const inferred = inferPathCategory(value);
    const category = normalizePathCategory(inferred && inferred !== "其他" ? inferred : (value?.category || key));
    keyMap[key] = category;
    if (category !== key || value?.category !== category) changed = true;
    const candidate = { ...value, category };
    const existing = next[category];
    const existingTime = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
    const candidateTime = candidate?.updatedAt ? new Date(candidate.updatedAt).getTime() : 0;
    if (!existing || candidateTime >= existingTime) {
      next[category] = candidate;
    }
  }
  if (!changed) return;
  state.learningPathLibrary = next;
  if (state.activePathCategory && keyMap[state.activePathCategory]) {
    state.activePathCategory = keyMap[state.activePathCategory];
    try {
      localStorage.setItem(ACTIVE_PATH_CATEGORY_STORAGE, state.activePathCategory);
    } catch {
    }
  }
  saveLearningPathLibrary();
}

function loadActivePathCategory() {
  try {
    return localStorage.getItem(ACTIVE_PATH_CATEGORY_STORAGE) || "";
  } catch {
    return "";
  }
}

function setActivePathCategory(category) {
  state.activePathCategory = normalizePathCategory(category);
  try {
    localStorage.setItem(ACTIVE_PATH_CATEGORY_STORAGE, state.activePathCategory);
  } catch {
  }
  renderLearningPathPanel();
  renderPushPage();
}

function upsertLearningPathLibrary(pathData) {
  if (!pathData?.resources?.length) return;
  const inferred = inferPathCategory(pathData);
  const category = normalizePathCategory(inferred && inferred !== "其他" ? inferred : pathData.category);
  const previous = state.learningPathLibrary?.[category] || {};
  state.learningPathLibrary = {
    ...(state.learningPathLibrary || {}),
    [category]: {
      ...previous,
      ...pathData,
      category,
      updatedAt: new Date().toISOString(),
      revision: (Number(previous.revision) || 0) + 1,
    },
  };
  state.activePathCategory = category;
  try {
    localStorage.setItem(ACTIVE_PATH_CATEGORY_STORAGE, category);
  } catch {
  }
  saveLearningPathLibrary();
}

function loadLearningPathTodoDone() {
  try {
    const data = JSON.parse(localStorage.getItem(LEARNING_PATH_TODO_STORAGE) || "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function saveLearningPathTodoDone() {
  try {
    localStorage.setItem(LEARNING_PATH_TODO_STORAGE, JSON.stringify(state.learningPathTodoDone || {}));
  } catch (e) {
    console.warn("保存学习路径待办状态失败", e);
  }
}

function loadStoredMarkdownFiles() {
  try {
    const raw = localStorage.getItem(STORED_MARKDOWN_FILES_STORAGE);
    const data = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => item && item.content && item.filename)
      .map((item) => ({
        ...item,
        category: item.categoryLocked
          ? (item.category || "其他")
          : categorizeKnowledge(`${item.title || ""} ${item.filename || ""}`, item.content || ""),
      }));
  } catch {
    return [];
  }
}

function saveStoredMarkdownFiles(files) {
  state.storedMarkdownFiles = Array.isArray(files) ? files : [];
  try {
    localStorage.setItem(STORED_MARKDOWN_FILES_STORAGE, JSON.stringify(state.storedMarkdownFiles));
  } catch (e) {
    console.warn("保存 Markdown 文件库失败", e);
    alert("保存失败：浏览器本地存储空间可能已满，请先删除一些旧文件后再试。");
    return false;
  }
  renderStoragePage();
  return true;
}

function loadMistakeBookItems() {
  try {
    const raw = localStorage.getItem(MISTAKE_BOOK_STORAGE);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveMistakeBookItems(items) {
  state.mistakeBookItems = Array.isArray(items) ? items : [];
  try {
    localStorage.setItem(MISTAKE_BOOK_STORAGE, JSON.stringify(state.mistakeBookItems));
  } catch (e) {
    console.warn("保存错题本失败", e);
    alert("错题本保存失败，可能是浏览器本地存储空间不足。");
    return false;
  }
  renderMistakeBookPage();
  renderAssessmentPage();
  return true;
}

async function addExerciseToMistakeBook(exercise, resource) {
  if (!exercise) return;
  const exists = state.mistakeBookItems.some((item) => item.fingerprint === exercise.fingerprint);
  if (exists) {
    alert("这道题已经在错题本里了。");
    return null;
  }
  const item = {
    id: `mistake-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    fingerprint: exercise.fingerprint,
    topic: resource?.title || "练习题",
    category: exercise.knowledge || categorizeKnowledge(resource?.title || "", `${exercise.question} ${exercise.explanation}`),
    difficulty: exercise.difficulty || "中等",
    type: exercise.type || "练习题",
    source: exercise.source || "经典题型改编",
    question: exercise.question || "",
    answer: exercise.answer || "",
    explanation: exercise.explanation || "",
    addedAt: new Date().toISOString(),
  };
  const folderId = typeof openFavoriteCollectionPicker === "function"
    ? await openFavoriteCollectionPicker({
      title: "错题收藏到哪个收藏夹？",
      detail: item.question || item.topic || "不选择时会放到默认收藏夹。",
      kind: "mistake",
    })
    : "default";
  const saved = saveMistakeBookItems([item].concat(state.mistakeBookItems || []));
  if (saved && typeof addItemToFavoriteCollection === "function") {
    addItemToFavoriteCollection("mistake", item.id, folderId);
  }
  return item;
}

function loadLearningDemandEvents() {
  try {
    const data = JSON.parse(localStorage.getItem(LEARNING_DEMANDS_STORAGE) || "[]");
    return Array.isArray(data) ? data.slice(0, 80) : [];
  } catch {
    return [];
  }
}

function saveLearningDemandEvents() {
  try {
    localStorage.setItem(LEARNING_DEMANDS_STORAGE, JSON.stringify((state.learningDemandEvents || []).slice(0, 80)));
  } catch (e) {
    console.warn("保存学习需求轨迹失败", e);
  }
}

function loadLearningBehaviorEvents() {
  try {
    const data = JSON.parse(localStorage.getItem(LEARNING_BEHAVIOR_STORAGE) || "[]");
    return Array.isArray(data) ? data.slice(0, 160) : [];
  } catch {
    return [];
  }
}

function saveLearningBehaviorEvents() {
  try {
    localStorage.setItem(LEARNING_BEHAVIOR_STORAGE, JSON.stringify((state.learningBehaviorEvents || []).slice(0, 160)));
  } catch (e) {
    console.warn("保存学习行为轨迹失败", e);
  }
}

function recordLearningBehavior(type, detail = {}) {
  const event = {
    id: `behavior-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    category: detail.category || "",
    topic: detail.topic || "",
    title: detail.title || "",
    meta: detail.meta || {},
    createdAt: new Date().toISOString(),
  };
  state.learningBehaviorEvents = [event].concat(state.learningBehaviorEvents || []).slice(0, 160);
  saveLearningBehaviorEvents();
  renderAssessmentPage();
}

function loadLearningAssessment() {
  try {
    const raw = localStorage.getItem(LEARNING_EFFECT_ASSESSMENT_STORAGE);
    if (!raw) return null;
    return normalizeLearningAssessment(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveLearningAssessment(assessment) {
  state.learningAssessment = normalizeLearningAssessment(assessment);
  try {
    localStorage.setItem(LEARNING_EFFECT_ASSESSMENT_STORAGE, JSON.stringify(state.learningAssessment));
  } catch (e) {
    console.warn("保存学习效果评估失败", e);
  }
  renderAssessmentPage();
}

function isLikelyLearningDemand(text) {
  const s = String(text || "").trim();
  if (s.length < 4) return false;
  if (/^(你好|hello|hi|谢谢|ok|好的|嗯|啊|test)$/i.test(s)) return false;
  return /学|讲|解释|分析|题|作业|考试|复习|知识|课程|算法|代码|文档|视频|导图|资源|练习|怎么|为什么|如何|帮我|生成|规划|路径|java|python|c\+\+|html|css|react|vue|数据库|编译|文法|多模态|视觉|数学|floyd|dijkstra/i.test(s);
}

function compactDemandText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function recordLearningDemand(source, text, extra = {}) {
  const demand = compactDemandText(text);
  if (!isLikelyLearningDemand(demand)) return;
  const category = extra.category || categorizeKnowledge(demand, `${demand} ${extra.content || ""}`);
  const event = {
    id: `demand-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    source,
    demand,
    category,
    topic: extra.topic || demand,
    createdAt: new Date().toISOString(),
  };
  const deduped = (state.learningDemandEvents || []).filter((item) =>
    !(item.source === event.source && item.demand === event.demand && item.category === event.category)
  );
  state.learningDemandEvents = [event].concat(deduped).slice(0, 80);
  saveLearningDemandEvents();
}

function summarizeDemandEvents(currentDemand = "") {
  const currentCategory = categorizeKnowledge(currentDemand, currentDemand);
  const events = state.learningDemandEvents || [];
  const sameCategory = events.filter((item) => item.category === currentCategory).slice(0, 8);
  const recent = events.slice(0, 10);
  const categoryCounts = events.reduce((acc, item) => {
    const key = item.category || "其他";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    current_category: currentCategory,
    category_counts: categoryCounts,
    same_category_recent: sameCategory.map((item) => ({
      source: item.source,
      demand: item.demand,
      topic: item.topic,
      created_at: item.createdAt,
    })),
    global_recent: recent.map((item) => ({
      source: item.source,
      category: item.category,
      demand: item.demand,
      created_at: item.createdAt,
    })),
  };
}

function deleteMistakeBookItem(id) {
  saveMistakeBookItems((state.mistakeBookItems || []).filter((item) => item.id !== id));
  if (typeof removeItemFromFavoriteCollection === "function") {
    loadFavoriteCollections();
    state.favoriteCollections = state.favoriteCollections.map((folder) => ({
      ...folder,
      mistakeIds: (folder.mistakeIds || []).filter((itemId) => String(itemId) !== String(id)),
    }));
    saveFavoriteCollections();
  }
}

function loadMistakeBookGroupBy() {
  try {
    const value = localStorage.getItem(MISTAKE_BOOK_GROUP_STORAGE);
    return ["category", "difficulty", "type", "month"].includes(value) ? value : "category";
  } catch {
    return "category";
  }
}

function setMistakeBookGroupBy(groupBy) {
  if (!["category", "difficulty", "type", "month"].includes(groupBy)) return;
  state.mistakeBookGroupBy = groupBy;
  try {
    localStorage.setItem(MISTAKE_BOOK_GROUP_STORAGE, groupBy);
  } catch {
    /* ignore */
  }
  renderMistakeBookPage();
}

function getMistakeGroupLabel(item, groupBy) {
  if (groupBy === "difficulty") return item.difficulty || "未标难度";
  if (groupBy === "type") return item.type || "练习题";
  if (groupBy === "month") {
    const date = item.addedAt ? new Date(item.addedAt) : null;
    if (!date || Number.isNaN(date.getTime())) return "未知时间";
    return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月`;
  }
  return item.category || "其他";
}

function renderMistakeGroupTabs(items) {
  const modes = [
    { id: "category", label: "按知识点" },
    { id: "difficulty", label: "按难度" },
    { id: "type", label: "按题型" },
    { id: "month", label: "按时间" },
  ];
  const categories = new Set(items.map((item) => item.category || "其他")).size;
  const difficulties = new Set(items.map((item) => item.difficulty || "未标难度")).size;
  const types = new Set(items.map((item) => item.type || "练习题")).size;
  return `
    <div class="mistake-overview">
      <div class="mistake-stat">
        <span>错题总数</span>
        <strong>${items.length}</strong>
      </div>
      <div class="mistake-stat">
        <span>知识点</span>
        <strong>${categories}</strong>
      </div>
      <div class="mistake-stat">
        <span>难度层级</span>
        <strong>${difficulties}</strong>
      </div>
      <div class="mistake-stat">
        <span>题型</span>
        <strong>${types}</strong>
      </div>
      <div class="mistake-tabs" role="tablist" aria-label="错题本分类方式">
        ${modes.map((mode) => `
          <button class="mistake-tab ${state.mistakeBookGroupBy === mode.id ? "active" : ""}" type="button" role="tab" aria-selected="${state.mistakeBookGroupBy === mode.id ? "true" : "false"}" data-mistake-groupby="${mode.id}">
            ${mode.label}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function categorizeKnowledge(title, content) {
  const titleText = `${title || ""}`.toLowerCase();
  const contentText = `${content || ""}`.toLowerCase();
  const programmingLanguageTopic =
    /(编程语言|程序设计|语法|函数|方法|变量|类型|类|对象|接口|模块|库|包|框架|依赖|环境|解释器|编译器|运行时|异常|线程|泛型|装饰器|迭代器|数组|循环|条件语句|import|package|library|framework|runtime|compiler)/i.test(titleText) &&
    /(python|java|javascript|typescript|c\+\+|cpp|c语言|c 语言|c#|go语言|golang|rust|swift|kotlin|php|ruby|node|npm|maven|gradle|cargo|pip|conda|jupyter)/i.test(titleText);
  if (programmingLanguageTopic) return "编程语言";

  const strongTitleRules = [
    ["编译原理", /编译原理|文法|语法分析|词法分析|乔姆斯基|chomsky|type-?1|1型|一型|上下文有关|context.?sensitive/],
    ["数据结构", /floyd|弗洛伊德|dijkstra|最短路|图论|动态规划|dp|算法|数据结构|链表|栈|队列|树|堆|排序|查找|并查集/],
    ["编程语言", /python|java|javascript|typescript|c\+\+|cpp|c语言|c 语言|c#|go语言|golang|rust|swift|kotlin|php|ruby|node|编程语言|程序设计/],
    ["多模态", /多模态|multimodal|图文|文本.*图像|图像.*文本|音频|视频|clip|vlm/],
    ["计算机视觉", /计算机视觉|图像识别|目标检测|分割|opencv|cnn|视觉/],
    ["前端", /前端|html|css|javascript|typescript|react|vue|浏览器|dom|页面/],
    ["后端", /后端|node|express|spring|django|flask|api|服务器|数据库|mysql|redis/],
    ["软件工程", /软件工程|需求分析|设计模式|uml|测试|架构|项目管理|敏捷/],
    ["考研数学", /考研数学|高等数学|线性代数|概率论|微积分|极限|导数|积分/],
    ["人工智能", /人工智能|机器学习|深度学习|神经网络|大模型|llm|transformer/],
  ];
  const titleHit = strongTitleRules.find(([, regex]) => regex.test(titleText));
  if (titleHit) return titleHit[0];

  const rules = [
    ["编译原理", /编译原理|文法|语法分析|词法分析|乔姆斯基|chomsky|type-?1|1型|一型|上下文有关|context.?sensitive|产生式|非收缩|线性有界/],
    ["前端", /前端|html|css|javascript|typescript|react|vue|浏览器|dom|页面/],
    ["编程语言", /python|java|javascript|typescript|c\+\+|cpp|c语言|c 语言|c#|go语言|golang|rust|swift|kotlin|php|ruby|node|npm|maven|gradle|cargo|pip|conda|jupyter|编程语言|程序设计/],
    ["数据结构", /floyd|弗洛伊德|dijkstra|最短路|图论|动态规划|dp|算法|数据结构|链表|栈|队列|树|堆|排序|查找|并查集/],
    ["后端", /后端|node|express|spring|django|flask|api|服务器|数据库|mysql|redis/],
    ["软件工程", /软件工程|需求分析|设计模式|uml|测试|架构|项目管理|敏捷/],
    ["多模态", /多模态|multimodal|图文|文本.*图像|图像.*文本|音频|视频|clip|vlm/],
    ["计算机视觉", /计算机视觉|图像识别|目标检测|分割|opencv|cnn|视觉/],
    ["考研数学", /考研数学|高等数学|线性代数|概率论|微积分|极限|导数|积分/],
    ["人工智能", /人工智能|机器学习|深度学习|神经网络|大模型|llm|transformer/],
  ];
  const found = rules.find(([, regex]) => regex.test(contentText));
  return found ? found[0] : "其他";
}

function safeFilename(name) {
  return String(name || "知识文档")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "知识文档";
}

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "未知日期";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadMarkdownFile(file) {
  const mime = file.mimeType || (String(file.filename || "").endsWith(".svg") ? "image/svg+xml;charset=utf-8" : "text/markdown;charset=utf-8");
  const blob = new Blob([file.content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function updateStoragePreview() {
  if (!el.storagePreview || !el.storageEditContent) return;
  const content = el.storageEditContent.value || "";
  if (isSvgContent(content)) {
    if (el.storagePreviewTools) el.storagePreviewTools.hidden = false;
    el.storagePreview.classList.add("svg-preview");
    el.storagePreview.innerHTML = `<div class="storage-svg-stage" style="transform:scale(${state.storageSvgZoom / 100})">${sanitizeSvgContent(content)}</div>`;
    return;
  }
  if (el.storagePreviewTools) el.storagePreviewTools.hidden = true;
  el.storagePreview.classList.remove("svg-preview");
  renderMarkdownInto(el.storagePreview, content);
}

function markStorageEditorDirty() {
  if (!el.storageSaveFileBtn) return;
  el.storageSaveFileBtn.textContent = "保存修改";
  el.storageSaveFileBtn.disabled = false;
}

function isSvgContent(content) {
  return /^\s*<svg[\s>]/i.test(content || "");
}

function sanitizeSvgContent(content) {
  return String(content || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
}

function setStorageSvgZoom(value) {
  state.storageSvgZoom = Math.min(220, Math.max(40, Number(value) || 100));
  if (el.storageSvgZoom) el.storageSvgZoom.value = String(state.storageSvgZoom);
  updateStoragePreview();
}

function ensureStorageSvgFullscreen() {
  let viewer = document.querySelector("#storageSvgFullscreen");
  if (viewer) return viewer;
  viewer = document.createElement("div");
  viewer.id = "storageSvgFullscreen";
  viewer.className = "storage-svg-fullscreen";
  viewer.hidden = true;
  viewer.innerHTML = `
    <div class="storage-svg-fullscreen-head">
      <div>
        <div class="storage-modal-kicker">SVG 全屏预览</div>
        <div class="storage-svg-fullscreen-title">思维导图</div>
      </div>
      <div class="storage-svg-fullscreen-tools">
        <button class="storage-mini-btn" type="button" data-fullscreen-zoom="out">缩小</button>
        <input class="storage-svg-zoom" type="range" min="30" max="260" value="100" step="10" data-fullscreen-zoom-range aria-label="全屏 SVG 缩放" />
        <button class="storage-mini-btn" type="button" data-fullscreen-zoom="in">放大</button>
        <button class="storage-mini-btn" type="button" data-fullscreen-zoom="reset">重置</button>
        <button class="storage-mini-btn" type="button" data-fullscreen-close>退出全屏</button>
      </div>
    </div>
    <div class="storage-svg-fullscreen-body">
      <div class="storage-svg-fullscreen-stage"></div>
    </div>
  `;
  document.body.appendChild(viewer);
  viewer.addEventListener("click", (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (target?.hasAttribute("data-fullscreen-close")) {
      closeStorageSvgFullscreen();
      return;
    }
    const action = target?.closest("[data-fullscreen-zoom]")?.getAttribute("data-fullscreen-zoom");
    if (!action) return;
    if (action === "in") setStorageFullscreenZoom(state.storageFullscreenZoom + 20);
    if (action === "out") setStorageFullscreenZoom(state.storageFullscreenZoom - 20);
    if (action === "reset") setStorageFullscreenZoom(100);
  });
  viewer.querySelector("[data-fullscreen-zoom-range]")?.addEventListener("input", (e) => {
    const range = e.target instanceof HTMLInputElement ? e.target : null;
    if (range) setStorageFullscreenZoom(range.value);
  });
  return viewer;
}

function setStorageFullscreenZoom(value) {
  state.storageFullscreenZoom = Math.min(260, Math.max(30, Number(value) || 100));
  const viewer = document.querySelector("#storageSvgFullscreen");
  const range = viewer?.querySelector("[data-fullscreen-zoom-range]");
  const stage = viewer?.querySelector(".storage-svg-fullscreen-stage");
  if (range instanceof HTMLInputElement) range.value = String(state.storageFullscreenZoom);
  if (stage instanceof HTMLElement) stage.style.transform = `scale(${state.storageFullscreenZoom / 100})`;
}

function fitStorageFullscreenSvg() {
  const viewer = document.querySelector("#storageSvgFullscreen");
  const body = viewer?.querySelector(".storage-svg-fullscreen-body");
  const svg = viewer?.querySelector(".storage-svg-fullscreen-stage svg");
  if (!(body instanceof HTMLElement) || !(svg instanceof SVGElement)) return;
  const svgWidth = Number(svg.getAttribute("width")) || svg.viewBox.baseVal.width || svg.getBoundingClientRect().width || 1200;
  const svgHeight = Number(svg.getAttribute("height")) || svg.viewBox.baseVal.height || svg.getBoundingClientRect().height || 700;
  const scaleX = (body.clientWidth - 44) / svgWidth;
  const scaleY = (body.clientHeight - 44) / svgHeight;
  const scale = Math.min(1.35, Math.max(0.3, Math.min(scaleX, scaleY)));
  setStorageFullscreenZoom(Math.round(scale * 100));
}

function openStorageSvgFullscreen() {
  if (!el.storageEditContent || !isSvgContent(el.storageEditContent.value)) return;
  const viewer = ensureStorageSvgFullscreen();
  const title = el.storageEditTitle?.value?.trim() || getActiveStorageFile()?.title || "思维导图";
  const titleNode = viewer.querySelector(".storage-svg-fullscreen-title");
  const stage = viewer.querySelector(".storage-svg-fullscreen-stage");
  if (titleNode) titleNode.textContent = title;
  if (stage) stage.innerHTML = sanitizeSvgContent(el.storageEditContent.value);
  viewer.hidden = false;
  document.body.classList.add("fullscreen-preview-open");
  requestAnimationFrame(fitStorageFullscreenSvg);
}

function closeStorageSvgFullscreen() {
  const viewer = document.querySelector("#storageSvgFullscreen");
  if (viewer) viewer.hidden = true;
  document.body.classList.remove("fullscreen-preview-open");
}

function loadStorageEditorSplit() {
  const raw = Number(localStorage.getItem(STORAGE_EDITOR_SPLIT_STORAGE));
  return Number.isFinite(raw) ? Math.min(72, Math.max(28, raw)) : 50;
}

function applyStorageEditorSplit(value) {
  state.storageEditorSplit = Math.min(72, Math.max(28, Number(value) || 50));
  if (el.storageEditorBody) {
    el.storageEditorBody.style.setProperty("--editor-left", `${state.storageEditorSplit}%`);
  }
}

function updateStorageEditorSplitFromPointer(clientX) {
  if (!el.storageEditorBody) return;
  const rect = el.storageEditorBody.getBoundingClientRect();
  if (!rect.width) return;
  const percent = ((clientX - rect.left) / rect.width) * 100;
  applyStorageEditorSplit(percent);
}

function openStorageFile(file) {
  if (!file || !el.storageModal) return;
  state.activeStorageFileId = file.id;
  const title = file.title || file.filename || "编辑文档";
  const modalTitle = document.querySelector("#storageModalTitle");
  if (modalTitle) modalTitle.textContent = title;
  if (el.storageEditTitle) el.storageEditTitle.value = file.title || "";
  if (el.storageEditCategory) el.storageEditCategory.value = file.category || "";
  if (el.storageEditContent) el.storageEditContent.value = file.content || "";
  if (el.storageEditContentLabel) el.storageEditContentLabel.textContent = isSvgContent(file.content) ? "SVG 内容" : "Markdown 内容";
  if (el.storageDownloadFileBtn) el.storageDownloadFileBtn.textContent = isSvgContent(file.content) ? "下载 SVG" : "下载 Markdown";
  state.storageSvgZoom = 100;
  if (el.storageSvgZoom) el.storageSvgZoom.value = "100";
  if (el.storageSaveFileBtn) {
    el.storageSaveFileBtn.textContent = "保存修改";
    el.storageSaveFileBtn.disabled = false;
  }
  updateStoragePreview();
  applyStorageEditorSplit(state.storageEditorSplit);
  el.storageModal.hidden = false;
}

function closeStorageModal() {
  state.activeStorageFileId = null;
  closeStorageSvgFullscreen();
  if (el.storageModal) el.storageModal.hidden = true;
}

function getActiveStorageFile() {
  return state.storedMarkdownFiles.find((item) => item.id === state.activeStorageFileId) || null;
}

function saveActiveStorageFile() {
  const file = getActiveStorageFile();
  if (!file || !el.storageEditTitle || !el.storageEditCategory || !el.storageEditContent) {
    alert("没有找到当前正在编辑的文件，请重新打开文件后再保存。");
    return;
  }
  const title = el.storageEditTitle.value.trim() || file.title || "知识文档";
  const category = el.storageEditCategory.value.trim() || categorizeKnowledge(title, el.storageEditContent.value);
  const updated = {
    ...file,
    title,
    category,
    categoryLocked: true,
    content: el.storageEditContent.value,
    filename: isSvgContent(el.storageEditContent.value) ? `${safeFilename(title)}.svg` : `${safeFilename(title)}.md`,
    mimeType: isSvgContent(el.storageEditContent.value) ? "image/svg+xml;charset=utf-8" : "text/markdown;charset=utf-8",
    updatedAt: new Date().toISOString(),
  };
  const saved = saveStoredMarkdownFiles(state.storedMarkdownFiles.map((item) => item.id === updated.id ? updated : item));
  if (!saved) return;
  openStorageFile(updated);
  if (el.storageSaveFileBtn) {
    el.storageSaveFileBtn.textContent = "已保存";
    el.storageSaveFileBtn.disabled = true;
    setTimeout(() => {
      if (!el.storageSaveFileBtn || state.activeStorageFileId !== updated.id) return;
      el.storageSaveFileBtn.textContent = "保存修改";
      el.storageSaveFileBtn.disabled = false;
    }, 1100);
  }
}

function deleteStorageFile(fileId) {
  const file = state.storedMarkdownFiles.find((item) => item.id === fileId);
  if (!file) return;
  if (!confirm(`确定删除文件“${file.title || file.filename}”吗？`)) return;
  saveStoredMarkdownFiles(state.storedMarkdownFiles.filter((item) => item.id !== fileId));
  if (typeof removeItemFromFavoriteCollection === "function") {
    loadFavoriteCollections();
    state.favoriteCollections = state.favoriteCollections.map((folder) => ({
      ...folder,
      fileIds: (folder.fileIds || []).filter((id) => String(id) !== String(fileId)),
    }));
    saveFavoriteCollections();
  }
  if (state.activeStorageFileId === fileId) closeStorageModal();
}

function renameStorageCategory(category) {
  const nextName = prompt("新的知识大类名称", category);
  if (!nextName) return;
  const trimmed = nextName.trim();
  if (!trimmed || trimmed === category) return;
  saveStoredMarkdownFiles(state.storedMarkdownFiles.map((file) => (
    (file.category || "其他") === category ? { ...file, category: trimmed, categoryLocked: true, updatedAt: new Date().toISOString() } : file
  )));
}

function deleteStorageCategory(category) {
  const files = state.storedMarkdownFiles.filter((file) => (file.category || "其他") === category);
  if (!files.length) return;
  if (!confirm(`确定删除“${category}”大类及其中 ${files.length} 个文件吗？`)) return;
  const ids = new Set(files.map((file) => file.id));
  saveStoredMarkdownFiles(state.storedMarkdownFiles.filter((file) => !ids.has(file.id)));
  if (typeof removeItemFromFavoriteCollection === "function") {
    loadFavoriteCollections();
    state.favoriteCollections = state.favoriteCollections.map((folder) => ({
      ...folder,
      fileIds: (folder.fileIds || []).filter((id) => !ids.has(id)),
    }));
    saveFavoriteCollections();
  }
  if (state.activeStorageFileId && ids.has(state.activeStorageFileId)) closeStorageModal();
}

async function storeAndDownloadResource(index) {
  const item = state.learningResources?.resources?.[index];
  if (!item) return;
  const content = resourcePlainText(item.content || "");
  if (!content.trim()) return;
  const title = item.title || "知识文档";
  const file = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    type: item.type || "专业课程讲解文档",
    agent: "知识文档 Agent",
    category: categorizeKnowledge(title, content),
    categoryLocked: false,
    filename: `${safeFilename(title)}.md`,
    content,
    createdAt: new Date().toISOString(),
  };
  const folderId = typeof openFavoriteCollectionPicker === "function"
    ? await openFavoriteCollectionPicker({
      title: "文档收藏到哪个收藏夹？",
      detail: title,
      kind: "file",
    })
    : "default";
  const next = [file].concat(state.storedMarkdownFiles || []);
  const saved = saveStoredMarkdownFiles(next);
  if (saved && typeof addItemToFavoriteCollection === "function") {
    addItemToFavoriteCollection("file", file.id, folderId);
  }
  recordLearningBehavior("storage_saved", {
    category: file.category,
    topic: title,
    title,
    meta: { type: file.type },
  });
  if (typeof requestStudentProfileRefreshFromActivity === "function") {
    requestStudentProfileRefreshFromActivity("storage_saved", {
      category: file.category,
      title,
      preview: compactProfileEvidenceText(content, 240),
    });
  }
  downloadMarkdownFile(file);
}

function renderStoragePage() {
  if (!el.storageGrid) return;
  const files = state.storedMarkdownFiles || [];
  if (!files.length) {
    el.storageGrid.innerHTML = `<div class="resource-empty">还没有存储的 Markdown 文档。在资源页点击知识文档的“下载 Markdown”，文件会同时保存到这里。</div>`;
    return;
  }
  const groups = files.reduce((map, file) => {
    const key = file.category || "其他";
    if (!map[key]) map[key] = [];
    map[key].push(file);
    return map;
  }, {});
  el.storageGrid.innerHTML = Object.entries(groups).map(([category, items]) => `
    <section class="storage-group">
      <div class="storage-group-head">
        <div class="storage-category">${escapeHtml(category)}</div>
        <div class="storage-group-actions">
          <span class="storage-count">${items.length} 个文件</span>
          <button class="storage-mini-btn" type="button" data-storage-action="rename-category" data-storage-category="${escapeHtml(category)}">改名</button>
          <button class="storage-mini-btn danger" type="button" data-storage-action="delete-category" data-storage-category="${escapeHtml(category)}">删除大类</button>
        </div>
      </div>
      <div class="storage-file-list">
        ${items.map((file) => `
          <article class="storage-file-card" data-storage-file-id="${escapeHtml(file.id)}" tabindex="0" title="双击打开">
            <div>
              <div class="storage-file-title">${escapeHtml(file.title)}</div>
              <div class="storage-file-meta">${escapeHtml(file.filename)} · ${escapeHtml(new Date(file.createdAt).toLocaleString())}</div>
            </div>
            <div class="storage-file-actions">
              <button class="resource-toggle storage-download-btn" type="button" data-storage-action="open-file" data-storage-id="${escapeHtml(file.id)}">打开</button>
              <button class="resource-toggle storage-download-btn" type="button" data-storage-action="download-file" data-storage-id="${escapeHtml(file.id)}">下载</button>
              <button class="storage-mini-btn danger" type="button" data-storage-action="delete-file" data-storage-id="${escapeHtml(file.id)}">删除</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
}

function renderMistakeBookPage() {
  if (!el.mistakeBookGrid) return;
  const items = state.mistakeBookItems || [];
  if (!items.length) {
    el.mistakeBookGrid.innerHTML = `<div class="resource-empty">还没有错题。展开练习题卡片后，点击“加入错题本”，这里会记录题目、答案详解、来源和加入日期。</div>`;
    return;
  }
  const groups = items.reduce((map, item) => {
    const key = getMistakeGroupLabel(item, state.mistakeBookGroupBy);
    if (!map[key]) map[key] = [];
    map[key].push(item);
    return map;
  }, {});
  el.mistakeBookGrid.innerHTML = renderMistakeGroupTabs(items) + Object.entries(groups).map(([category, group]) => `
    <section class="mistake-group">
      <div class="storage-group-head">
        <div>
          <div class="storage-category">${escapeHtml(category)}</div>
          <div class="storage-count">${group.length} 条复盘项</div>
        </div>
      </div>
      <div class="mistake-list">
        ${group.map((item) => `
          <article class="mistake-card">
            <div class="exercise-card-head">
              <div>
                <div class="exercise-meta">
                  <span>${escapeHtml(item.type || "练习题")}</span>
                  <span>${escapeHtml(item.difficulty || "中等")}</span>
                  <span>${escapeHtml(formatDateTime(item.addedAt))} 加入</span>
                </div>
                <h3>${renderInlineMathText(item.question || "未命名题目")}</h3>
              </div>
              <button class="storage-mini-btn danger" type="button" data-mistake-delete="${escapeHtml(item.id)}">删除</button>
            </div>
            <div class="exercise-source">来源：${escapeHtml(item.source || "经典题型改编")}</div>
            <div class="exercise-answer"><strong>答案：</strong>${renderInlineMathText(item.answer || "待补充")}</div>
            <div class="exercise-explanation markdown-body">${renderResourceMarkdown(item.explanation || "暂无详解")}</div>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
}
