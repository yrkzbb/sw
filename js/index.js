
const API_KEY_STORAGE = "LINGXI_API_KEY";
const THEME_STORAGE = "LINGXI_THEME";
const MESSAGES_STORAGE = "LINGXI_MESSAGES";
const STUDENT_PROFILE_STORAGE = "LINGXI_STUDENT_PROFILE";
const LEARNING_RESOURCES_STORAGE = "LINGXI_LEARNING_RESOURCES";
const STORED_MARKDOWN_FILES_STORAGE = "LINGXI_STORED_MARKDOWN_FILES";
const STORAGE_EDITOR_SPLIT_STORAGE = "LINGXI_STORAGE_EDITOR_SPLIT";
const MISTAKE_BOOK_STORAGE = "LINGXI_MISTAKE_BOOK";
const MISTAKE_BOOK_GROUP_STORAGE = "LINGXI_MISTAKE_BOOK_GROUP";
const LEARNING_PATH_TODO_STORAGE = "LINGXI_LEARNING_PATH_TODO";
const LEARNING_DEMANDS_STORAGE = "LINGXI_LEARNING_DEMANDS";
const LEARNING_PATH_LIBRARY_STORAGE = "LINGXI_LEARNING_PATH_LIBRARY";
const ACTIVE_PATH_CATEGORY_STORAGE = "LINGXI_ACTIVE_PATH_CATEGORY";
const LEARNING_BEHAVIOR_STORAGE = "LINGXI_LEARNING_BEHAVIOR";
const LEARNING_EFFECT_ASSESSMENT_STORAGE = "LINGXI_LEARNING_EFFECT_ASSESSMENT";


const CHAT_ENDPOINT = "/api/chat";
const VIDEO_ENDPOINT = "/api/video";
const USE_BROWSER_API_KEY = /^https?:\/\//i.test(CHAT_ENDPOINT);

const DEFAULT_MODEL = "gpt-4o-mini";

const PROFILE_FIELDS = [
  "major_background",
  "learning_goals",
  "knowledge_foundation",
  "cognitive_style",
  "learning_habits",
  "error_patterns",
  "interaction_preference",
  "motivation_emotion",
];

const PROFILE_FIELD_META = {
  major_background: { title: "专业背景", icon: "book" },
  learning_goals: { title: "学习目标", icon: "target" },
  knowledge_foundation: { title: "知识基础", icon: "layers" },
  cognitive_style: { title: "认知风格", icon: "spark" },
  learning_habits: { title: "学习习惯", icon: "clock" },
  error_patterns: { title: "易错点偏好", icon: "alert" },
  interaction_preference: { title: "互动偏好", icon: "chat" },
  motivation_emotion: { title: "情绪与动力", icon: "heart" },
};

const RESOURCE_AGENTS = [
  { id: "analysis", role: "需求分析师", task: "优先解析本次主题，只在相关时参考学习画像。", selectable: false },
  { id: "doc", type: "专业课程讲解文档", role: "知识文档 Agent", task: "生成完整、可直接阅读的知识正文文档。", selectable: true },
  { id: "mindmap", type: "知识点思维导图", role: "思维导图 Agent", task: "组织知识点结构和关联路径。", selectable: true },
  { id: "quiz", type: "不同类型练习题目", role: "练习命题 Agent", task: "设计基础、进阶、易错和应用题。", selectable: true },
  { id: "reading", type: "拓展阅读材料", role: "阅读拓展 Agent", task: "提供拓展阅读材料和检索关键词。", selectable: true },
  { id: "video", type: "多模态教学视频/动画", role: "多模态视频 Agent", task: "交付可播放教学视频；可接入视频 API 或数字人。", selectable: true },
  { id: "code", type: "代码类实操案例", role: "代码实操 Agent", task: "生成可运行实操案例和调试任务。", selectable: true },
  { id: "review", role: "审核整合 Agent", task: "统一难度、补齐资源并输出学习路径。", selectable: false },
];

const SELECTABLE_RESOURCE_AGENTS = RESOURCE_AGENTS.filter((agent) => agent.selectable);

const LEARNING_PROFILE_SYSTEM_PROMPT = `你是一个“对话式学习画像构建助手”。你的任务不是让学生填写表单，而是在自然对话中自然地了解学生，并持续维护一个动态学习画像。

你需要从学生的发言中抽取、推断并更新学习画像。画像至少包含以下 8 个维度：
1. 专业背景：学生的专业、年级、相关课程基础。
2. 学习目标：短期目标、长期目标、考试/项目/竞赛/就业需求。
3. 知识基础：已掌握内容、薄弱知识点、先修知识缺口。
4. 认知风格：偏好图解、类比、步骤推导、代码示例、案例驱动、先总后分等。
5. 学习习惯：学习频率、时间安排、复习方式、是否容易拖延。
6. 易错点与困难偏好：常见错误、容易混淆的概念、卡住的原因、畏难点。
7. 互动偏好：希望回答简洁还是详细，是否需要提问引导、练习题、总结卡片。
8. 情绪与动力状态：自信程度、焦虑点、兴趣点、成就感来源。

工作规则：
- 不要一次性问长表单。每轮最多自然追问 1 个关键问题。
- 如果学生已经给出足够信息，优先直接帮助学生学习，不要为了画像而打断学习。
- 对明确表达的信息标记为“确定”；对推断出的信息标记为“推测”；对缺失信息标记为“待补充”。
- 每个维度都可能包含多个子事实，不要因为确认了一个点就认为该维度已经完整。
- 如果同一维度出现多个信息点，请在 value 中用分号累积保留，例如“Java 循环较薄弱；希望深入学习 C++ 面向对象”。
- 当新信息与旧画像冲突时，优先相信最近、最具体的信息，并保留变化说明。
- 不要编造学生没有提供的信息。
- 画像应服务于教学：回答问题时要根据学生画像调整解释深度、例子类型、练习难度和反馈方式。
- 不要默认把完整画像展示给学生，除非学生要求查看。
- 如果学生要求查看画像，用清晰、友好的方式展示当前画像，并标注哪些是确定、推测、待补充。`;

const el = {
  root: document.querySelector("#app"),
  themeToggle: document.querySelector("#themeToggle"),
  home: document.querySelector("#home"),
  chat: document.querySelector("#chat"),
  profilePage: document.querySelector("#profilePage"),
  resourcePage: document.querySelector("#resourcePage"),
  pushPage: document.querySelector("#pushPage"),
  pathPage: document.querySelector("#pathPage"),
  assessmentPage: document.querySelector("#assessmentPage"),
  storagePage: document.querySelector("#storagePage"),
  mistakePage: document.querySelector("#mistakePage"),
  chatPageBtn: document.querySelector("#chatPageBtn"),
  profilePageBtn: document.querySelector("#profilePageBtn"),
  resourcePageBtn: document.querySelector("#resourcePageBtn"),
  pushPageBtn: document.querySelector("#pushPageBtn"),
  pathPageBtn: document.querySelector("#pathPageBtn"),
  assessmentPageBtn: document.querySelector("#assessmentPageBtn"),
  storagePageBtn: document.querySelector("#storagePageBtn"),
  mistakePageBtn: document.querySelector("#mistakePageBtn"),
  profileBackBtn: document.querySelector("#profileBackBtn"),
  profileVisual: document.querySelector("#profileVisual"),
  profileGrid: document.querySelector("#profileGrid"),
  profileMeta: document.querySelector("#profileMeta"),
  resourcePromptInput: document.querySelector("#resourcePromptInput"),
  generateResourcesBtn: document.querySelector("#generateResourcesBtn"),
  pushGenerateResourcesBtn: document.querySelector("#pushGenerateResourcesBtn"),
  pathGenerateResourcesBtn: document.querySelector("#pathGenerateResourcesBtn"),
  agentPipeline: document.querySelector("#agentPipeline"),
  learningPathPanel: document.querySelector("#learningPathPanel"),
  assessmentGrid: document.querySelector("#assessmentGrid"),
  generateAssessmentBtn: document.querySelector("#generateAssessmentBtn"),
  assessmentPullStatus: document.querySelector("#assessmentPullStatus"),
  pushGrid: document.querySelector("#pushGrid"),
  resourceGrid: document.querySelector("#resourceGrid"),
  storageGrid: document.querySelector("#storageGrid"),
  mistakeBookGrid: document.querySelector("#mistakeBookGrid"),
  storageModal: document.querySelector("#storageModal"),
  storageModalClose: document.querySelector("#storageModalClose"),
  storageEditTitle: document.querySelector("#storageEditTitle"),
  storageEditCategory: document.querySelector("#storageEditCategory"),
  storageEditContent: document.querySelector("#storageEditContent"),
  storageEditContentLabel: document.querySelector("#storageEditContentLabel"),
  storageEditorBody: document.querySelector("#storageEditorBody"),
  storageResizeHandle: document.querySelector("#storageResizeHandle"),
  storagePreview: document.querySelector("#storagePreview"),
  storagePreviewTools: document.querySelector("#storagePreviewTools"),
  storageSvgZoom: document.querySelector("#storageSvgZoom"),
  storageSaveFileBtn: document.querySelector("#storageSaveFileBtn"),
  storageDeleteFileBtn: document.querySelector("#storageDeleteFileBtn"),
  storageDownloadFileBtn: document.querySelector("#storageDownloadFileBtn"),
  pushDetailModal: document.querySelector("#pushDetailModal"),
  pushDetailClose: document.querySelector("#pushDetailClose"),
  pushDetailType: document.querySelector("#pushDetailType"),
  pushDetailTitle: document.querySelector("#pushDetailTitle"),
  pushDetailMeta: document.querySelector("#pushDetailMeta"),
  pushDetailBody: document.querySelector("#pushDetailBody"),
  composer: document.querySelector("#composer"),
  messages: document.querySelector("#messages"),
  input: document.querySelector("#input"),
  sendBtn: document.querySelector("#sendBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  uploadBtn: document.querySelector("#uploadBtn"),
  imageInput: document.querySelector("#imageInput"),
  imagePreview: document.querySelector("#imagePreview"),
  apiKeyModal: document.querySelector("#apiKeyModal"),
  keyBanner: document.querySelector("#keyBanner"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  saveApiKeyBtn: document.querySelector("#saveApiKeyBtn"),
  closeApiKeyBtn: document.querySelector("#closeApiKeyBtn"),
  imageLightbox: document.querySelector("#imageLightbox"),
  lightboxImage: document.querySelector("#lightboxImage"),
  lightboxClose: document.querySelector(".lightbox-close"),
  lightboxBackdrop: document.querySelector(".lightbox-backdrop"),
};

const state = {
  theme: "dark",
  apiKey: "",
  messages: [], 
  attachedFiles: [],
  attachedImages: [], 
  uiVersion: 0,

  isGenerating: false,
  abortController: null,
  typingInterval: null,
  typingBuffer: "",
  streamingDone: false,

  currentAssistant: null,
  studentProfile: null,
  profileUpdateInFlight: null,
  learningResources: null,
  learningPathLibrary: {},
  activePathCategory: "",
  learningDemandEvents: [],
  storedMarkdownFiles: [],
  mistakeBookItems: [],
  mistakeBookGroupBy: "category",
  activeStorageFileId: null,
  storageEditorSplit: 50,
  storageResizeActive: false,
  storageSvgZoom: 100,
  storageFullscreenZoom: 100,
  resourcesGenerating: false,
  selectedResourceAgents: [],
  learningPathTodoDone: {},
  learningBehaviorEvents: [],
  learningAssessment: null,
  assessmentGenerating: false,
  assessmentPull: {
    active: false,
    startY: 0,
    distance: 0,
    armed: false,
  },
  renderedVideoUrls: {},
};

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

function addExerciseToMistakeBook(exercise, resource) {
  if (!exercise) return;
  const exists = state.mistakeBookItems.some((item) => item.fingerprint === exercise.fingerprint);
  if (exists) {
    alert("这道题已经在错题本里了。");
    return;
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
  saveMistakeBookItems([item].concat(state.mistakeBookItems || []));
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
  if (state.activeStorageFileId && ids.has(state.activeStorageFileId)) closeStorageModal();
}

function storeAndDownloadResource(index) {
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
  const next = [file].concat(state.storedMarkdownFiles || []);
  saveStoredMarkdownFiles(next);
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

function renderAgentPipeline(status = "idle") {
  if (!el.agentPipeline) return;
  el.agentPipeline.innerHTML = RESOURCE_AGENTS.map((agent, index) => {
    const selected = state.selectedResourceAgents.includes(agent.id);
    const selectedSet = getSelectedResourceAgents();
    const inCurrentFlow = !agent.selectable || selectedSet.some((item) => item.id === agent.id);
    const running = status === "running" && inCurrentFlow;
    const done = status === "done" && inCurrentFlow;
    const disabled = agent.selectable ? "" : "locked";
    const cls = [done ? "done" : "", running ? "running" : "", selected ? "selected" : "", disabled].filter(Boolean).join(" ");
    const tag = agent.selectable ? "button" : "article";
    const attrs = agent.selectable
      ? `type="button" data-agent-id="${agent.id}" aria-pressed="${selected ? "true" : "false"}"`
      : "";
    return `
      <${tag} class="agent-card ${cls}" ${attrs}>
        <div class="agent-role"><span class="agent-dot" aria-hidden="true"></span>${escapeHtml(agent.role)}</div>
        <div class="agent-task">${escapeHtml(agent.task)}</div>
      </${tag}>
    `;
  }).join("");
}

function getSelectedResourceAgents() {
  if (!state.selectedResourceAgents.length) return SELECTABLE_RESOURCE_AGENTS;
  return SELECTABLE_RESOURCE_AGENTS.filter((agent) => state.selectedResourceAgents.includes(agent.id));
}

function toggleResourceAgent(agentId) {
  const agent = SELECTABLE_RESOURCE_AGENTS.find((item) => item.id === agentId);
  if (!agent || state.resourcesGenerating) return;
  if (state.selectedResourceAgents.includes(agentId)) {
    state.selectedResourceAgents = state.selectedResourceAgents.filter((id) => id !== agentId);
  } else {
    state.selectedResourceAgents = state.selectedResourceAgents.concat(agentId);
  }
  renderLearningResources();
}

function renderResourceMarkdown(markdown) {
  const wrap = document.createElement("div");
  wrap.className = "resource-body";
  let text = "";
  if (typeof markdown === "string") {
    text = markdown;
  } else if (Array.isArray(markdown)) {
    text = markdown.map((item) => `- ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n");
  } else if (markdown && typeof markdown === "object") {
    text = Object.entries(markdown)
      .map(([key, value]) => `### ${key}\n${Array.isArray(value) ? value.map((item) => `- ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n") : String(value)}`)
      .join("\n\n");
  }
  renderMarkdownInto(wrap, text);
  return wrap.innerHTML;
}

function parseJsonLike(value) {
  if (value && typeof value === "object") return value;
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function cleanVideoText(value, fallback = "") {
  return String(value || fallback || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+[.、)]\s*/gm, "")
    .replace(/(?:旁白|画面|视觉|字幕|互动提问|提问)\s*[:：]\s*/g, "")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimVideoText(value, maxLength) {
  const text = cleanVideoText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function sanitizeVideoUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.href);
    const host = url.hostname.toLowerCase();
    if (url.protocol === "blob:" || url.protocol === "data:") return raw;
    if (url.origin !== window.location.origin) return "";
    return url.href;
  } catch {
    return "";
  }
}

function hasExternalVideoPlaceholder(value) {
  const urls = [
    value?.video_url,
    value?.videoUrl,
    value?.url,
    value?.embed_url,
    value?.embedUrl,
    value?.digital_human_url,
    value?.avatar_url,
  ];
  return urls.some((item) => {
    const raw = String(item || "").trim();
    if (!raw) return false;
    try {
      const url = new URL(raw, window.location.href);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  });
}

function inferSceneTitle(scene, index) {
  const rawTitle = cleanVideoText(scene?.title || scene?.name || "");
  if (rawTitle && !/^要点\s*\d+$|^片段\s*\d+$|^分镜\s*\d+$/i.test(rawTitle)) {
    return trimVideoText(rawTitle, 18);
  }
  const text = cleanVideoText(scene?.narration || scene?.voiceover || scene?.speech || scene?.subtitle || scene?.visual || "");
  const match = text.match(/(?:定义|优势|应用|互动|总结|案例|目标|过程|方法|特点|误区|练习|复盘)[^，。；,.]{0,12}/);
  return trimVideoText(match?.[0] || `学习要点 ${index + 1}`, 18);
}

function normalizeVideoScenes(scenes, title) {
  const normalized = (Array.isArray(scenes) ? scenes : [])
    .map((scene, index) => ({
      title: inferSceneTitle(scene, index),
      narration: trimVideoText(scene?.narration || scene?.voiceover || scene?.speech || scene?.subtitle || scene?.description || scene?.visual || "", 58),
      visual: trimVideoText(scene?.visual || scene?.visuals || scene?.screen || scene?.animation || "关键词卡片与流程动画", 42),
      question: trimVideoText(scene?.question || scene?.interaction || "", 32),
    }))
    .filter((scene) => scene.title || scene.narration || scene.visual);
  if (normalized.length >= 4) return normalized.slice(0, 7);

  const topic = cleanVideoText(title || "本节主题");
  return [
    {
      title: "问题引入",
      narration: `这节课我们先弄清楚${topic}到底解决什么学习问题。`,
      visual: "普通教室中老师站在白板旁，用手势引出问题，学生视角看向老师和空白板",
      question: "",
    },
    {
      title: "核心定义",
      narration: "多模态学习不是简单堆材料，而是让不同感官线索互相补充。",
      visual: "老师在白板上画三个无字圆圈和连接箭头，边画边解释概念关系",
      question: "",
    },
    {
      title: "板书解释",
      narration: "图像帮助看结构，声音帮助跟节奏，互动能检查是否真正理解。",
      visual: "近景拍老师手部在白板上补充箭头和简洁符号，学生低头记录笔记",
      question: "",
    },
    {
      title: "具体例子",
      narration: "比如学语言时，视频场景、发音音频和即时练习可以互相配合。",
      visual: "老师指向白板上的无字流程图，桌面上有学生笔记本和练习卡片",
      question: "",
    },
    {
      title: "课堂提问",
      narration: "判断一个知识点适合哪种模态，是设计学习资源的关键一步。",
      visual: "老师面向镜头提问，学生视角看到白板上无字分支图和桌面笔记",
      question: "这个知识点最适合用哪两种方式解释？",
    },
    {
      title: "总结",
      narration: "好的多模态学习，是让解释更清楚、练习更及时，而不是堆素材。",
      visual: "老师回到白板前总结，学生笔记本上有简洁图形标记，画面稳定收束",
      question: "",
    },
  ];
}

function normalizeVideoResource(content, title = "教学视频") {
  const parsed = parseJsonLike(content);
  if (parsed) {
    const scenes = Array.isArray(parsed.scenes)
      ? parsed.scenes
      : Array.isArray(parsed.segments)
        ? parsed.segments
        : Array.isArray(parsed.shots)
          ? parsed.shots
          : [];
    const normalizedScenes = normalizeVideoScenes(scenes, parsed.title || title);
    return {
      title: cleanVideoText(parsed.title || title, title),
      duration: Math.min(18, Math.max(12, Number(parsed.duration || parsed.duration_seconds) || normalizedScenes.length * 3)),
      video_url: sanitizeVideoUrl(parsed.video_url || parsed.videoUrl || parsed.url),
      embed_url: sanitizeVideoUrl(parsed.embed_url || parsed.embedUrl || parsed.digital_human_url || parsed.avatar_url),
      provider: parsed.provider || parsed.video_provider || parsed.digital_human_provider || "本地视频渲染器",
      voice: parsed.voice || parsed.presenter || "教学旁白",
      scenes: normalizedScenes,
      external_placeholder: hasExternalVideoPlaceholder(parsed),
      raw: parsed,
    };
  }
  const text = resourcePlainText(content).replace(/\s+/g, " ").trim();
  const sentences = text
    .split(/[。！？.!?]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
  const scenes = normalizeVideoScenes((sentences.length ? sentences : [
    "建立主题背景，展示本节学习目标。",
    "拆解核心概念，用图文动画解释关键关系。",
    "结合例子演示应用过程。",
    "提出互动问题，引导学习者自测理解。",
    "总结关键点，给出后续练习方向。",
  ]).map((sentence, index) => ({
    title: index === 0 ? title : `要点 ${index + 1}`,
    narration: sentence,
    visual: "动态图形、关键词卡片、步骤高亮",
    question: index === 3 ? "你能用自己的话解释这一点吗？" : "",
  })), title);
  return { title: cleanVideoText(title, "教学视频"), duration: Math.min(18, Math.max(12, scenes.length * 3)), video_url: "", embed_url: "", provider: "本地视频渲染器", voice: "教学旁白", scenes, external_placeholder: false };
}

function renderVideoPreviewText(content, title) {
  const video = normalizeVideoResource(content, title);
  if (video.video_url) return `已生成可播放视频：${video.provider}，时长约 ${video.duration} 秒。`;
  if (video.embed_url) return `已接入数字人/第三方视频：${video.provider}，可直接打开播放。`;
  return `已准备 ${video.scenes.length} 个视频片段，可一键渲染为可播放 WebM 视频。`;
}

function renderVideoResource(content, title, resourceIndex) {
  const video = normalizeVideoResource(content, title);
  const hasDirectVideo = Boolean(video.video_url);
  const hasEmbed = Boolean(video.embed_url);
  const sceneList = video.scenes.slice(0, 6).map((scene, index) => `
    <li>
      <strong>${escapeHtml(scene.title || `片段 ${index + 1}`)}</strong>
      <span>${escapeHtml(scene.narration || scene.visual || "视频片段")}</span>
    </li>
  `).join("");
  return `
    <section class="video-resource" data-video-resource="${resourceIndex}">
      <div class="video-stage">
        ${
          hasDirectVideo
            ? `<video class="video-player" src="${escapeHtml(video.video_url)}" controls preload="metadata"></video>`
            : hasEmbed
              ? `<iframe class="video-embed" src="${escapeHtml(video.embed_url)}" title="${escapeHtml(video.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
              : `
                <video class="video-player" controls hidden></video>
                <canvas class="video-canvas" width="1280" height="720" aria-label="本地渲染教学视频预览"></canvas>
              `
        }
        <div class="video-caption-overlay" aria-hidden="true">
          <div class="video-caption-title">${escapeHtml(video.title || title || "教学视频")}</div>
          <div class="video-caption-text">${escapeHtml(video.scenes[0]?.narration || video.scenes[0]?.visual || "")}</div>
        </div>
      </div>
      <div class="video-actions">
        ${
          !hasDirectVideo && !hasEmbed
            ? `<button class="resource-toggle" type="button" data-render-video="${resourceIndex}">生成 AI 视频</button>
               <button class="resource-toggle" type="button" data-download-video="${resourceIndex}" disabled>下载视频</button>`
            : ""
        }
        ${hasDirectVideo ? `<a class="video-link-btn" href="${escapeHtml(video.video_url)}" target="_blank" rel="noreferrer">打开视频链接</a>` : ""}
        ${hasEmbed ? `<a class="video-link-btn" href="${escapeHtml(video.embed_url)}" target="_blank" rel="noreferrer">打开数字人视频</a>` : ""}
      </div>
      <button class="video-scenes-toggle" type="button" data-video-scenes-toggle aria-expanded="false">展开讲解要点</button>
      <ol class="video-scene-list" hidden>${sceneList}</ol>
      <div class="video-status" aria-live="polite">${hasDirectVideo || hasEmbed ? "视频已就绪。" : video.external_placeholder ? "已忽略模型编造的外部视频链接，请点击生成真实 AI 视频。" : "点击生成后会调用 AI 视频模型生成真实视频。"}</div>
    </section>
  `;
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const chars = Array.from(String(text || ""));
  const lines = [];
  let line = "";
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && chars.join("").length > lines.join("").length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(1, lines[lines.length - 1].length - 1))}…`;
  }
  lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
  return lines.length;
}

function drawVideoFrame(ctx, canvas, video, sceneIndex, progress) {
  const scale = Math.min(canvas.width / 1920, canvas.height / 1080);
  ctx.save();
  ctx.scale(scale, scale);
  const w = 1920;
  const h = 1080;
  const scene = video.scenes[sceneIndex] || video.scenes[0] || {};
  const palette = [
    ["#0f172a", "#1d4ed8", "#22c55e"],
    ["#111827", "#7c3aed", "#06b6d4"],
    ["#172554", "#0f766e", "#f59e0b"],
    ["#1f2937", "#be123c", "#38bdf8"],
  ][sceneIndex % 4];
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, palette[0]);
  bg.addColorStop(0.58, palette[1]);
  bg.addColorStop(1, palette[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(1440 + Math.sin(progress * Math.PI * 2) * 24, 210, 230, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(220, 870 + Math.cos(progress * Math.PI * 2) * 20, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const pad = 92;
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.font = "700 32px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(video.title || "教学视频", pad, 82);

  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.beginPath();
  ctx.roundRect(pad, 126, 128, 44, 22);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 24px system-ui, sans-serif";
  ctx.fillText(`${sceneIndex + 1}/${video.scenes.length}`, pad + 32, 156);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 86px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  wrapCanvasText(ctx, cleanVideoText(scene.title, "学习要点"), pad, 290, 980, 96, 2);

  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.font = "500 38px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  wrapCanvasText(ctx, cleanVideoText(scene.narration || scene.visual || "正在讲解本段内容"), pad, 430, 1030, 58, 3);

  const panelX = 1220;
  const panelY = 166;
  ctx.fillStyle = "rgba(8, 13, 24, 0.42)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, 450, 540, 32);
  ctx.fill();
  ctx.stroke();

  const modes = [
    ["文", "文本", "精确表达"],
    ["图", "图像", "结构关系"],
    ["声", "声音", "节奏提示"],
    ["问", "互动", "即时反馈"],
  ];
  modes.forEach((mode, index) => {
    const active = index === sceneIndex % modes.length;
    const y = panelY + 80 + index * 105;
    ctx.fillStyle = active ? "#34d399" : "rgba(255, 255, 255, 0.86)";
    ctx.beginPath();
    ctx.roundRect(panelX + 48, y - 38, 74, 74, 22);
    ctx.fill();
    ctx.fillStyle = active ? "#052e2b" : "#111827";
    ctx.font = "900 30px system-ui, sans-serif";
    ctx.fillText(mode[0], panelX + 70, y + 10);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 34px system-ui, sans-serif";
    ctx.fillText(mode[1], panelX + 154, y - 4);
    ctx.fillStyle = "rgba(255, 255, 255, 0.68)";
    ctx.font = "500 22px system-ui, sans-serif";
    ctx.fillText(mode[2], panelX + 154, y + 32);
  });

  if (scene.question) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.17)";
    ctx.beginPath();
    ctx.roundRect(pad, 710, 1040, 92, 28);
    ctx.fill();
    ctx.fillStyle = "#dffcf4";
    ctx.font = "800 32px system-ui, sans-serif";
    wrapCanvasText(ctx, `互动：${cleanVideoText(scene.question)}`, pad + 34, 767, 970, 42, 1);
  }

  const progressWidth = w - pad * 2;
  ctx.fillStyle = "rgba(255, 255, 255, 0.24)";
  ctx.fillRect(pad, h - 90, progressWidth, 12);
  ctx.fillStyle = "#34d399";
  ctx.fillRect(pad, h - 90, progressWidth * ((sceneIndex + progress) / Math.max(video.scenes.length, 1)), 12);
  ctx.restore();
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renderResourceVideo(index) {
  const resource = state.learningResources?.resources?.[index];
  if (!resource) return;
  const root = el.resourceGrid?.querySelector(`[data-video-resource="${index}"]`);
  const player = root?.querySelector(".video-player");
  const canvas = root?.querySelector(".video-canvas");
  const status = root?.querySelector(".video-status");
  const downloadBtn = root?.querySelector(`[data-download-video="${index}"]`);
  const renderBtn = root?.querySelector(`[data-render-video="${index}"]`);
  if (!(player instanceof HTMLVideoElement)) return;

  const video = normalizeVideoResource(resource.content || "", resource.title);
  if (renderBtn) renderBtn.disabled = true;
  if (downloadBtn) downloadBtn.disabled = true;
  if (status) status.textContent = "正在读取视频模型配置...";

  try {
    const config = await requestVideoJson({ action: "config" });
    const ok = confirm(
      [
        "即将调用付费 AI 视频生成 API。",
        "",
        `模型：${config.model || "未知"}`,
        `分辨率：${config.resolution || "未知"}`,
        `时长：约 ${config.duration || "未知"} 秒`,
        "",
        "提交任务后可能立即计费。确认生成吗？",
      ].join("\n")
    );
    if (!ok) {
      if (status) status.textContent = "已取消 AI 视频生成。";
      return;
    }

    if (status) status.textContent = "正在提交 AI 视频任务...";
    const start = await requestVideoJson({
      action: "generate",
      title: resource.title || video.title,
      scenes: video.scenes,
      prompt: buildAiVideoPrompt(video),
    });
    const taskId = start.task_id;
    if (!taskId && start.video_url) {
      applyGeneratedVideo(index, start.video_url, player, canvas, downloadBtn, status);
      return;
    }
    if (!taskId) throw new Error(start.error || "视频服务没有返回任务 ID");

    const maxPolls = 72;
    for (let i = 0; i < maxPolls; i += 1) {
      await waitMs(i === 0 ? 1200 : 5000);
      const data = await requestVideoJson({ action: "status", task_id: taskId });
      const taskStatus = String(data.task_status || "").toUpperCase();
      if (status) {
        status.textContent = `AI 视频生成中：${taskStatus || "RUNNING"}（${i + 1}/${maxPolls}）`;
      }
      if (data.video_url) {
        applyGeneratedVideo(index, data.video_url, player, canvas, downloadBtn, status);
        return;
      }
      if (["FAILED", "FAIL", "CANCELED", "CANCELLED", "UNKNOWN"].includes(taskStatus)) {
        throw new Error(data.error || `视频任务失败：${taskStatus}`);
      }
    }
    throw new Error("视频任务超时，请稍后再试或降低时长/分辨率");
  } catch (e) {
    console.error(e);
    if (status) status.textContent = `AI 视频生成失败：${String(e?.message || e)}`;
  } finally {
    if (renderBtn) renderBtn.disabled = false;
  }
}

function buildAiVideoPrompt(video) {
  return [
    "这是老师讲授知识点的课堂短片，不是教育科技宣传片。画面必须体现老师正在讲解、板书、指图、举例、向学生提问。",
    "画面尽量避免可读文字、字幕和 UI 字符；中文标题和讲解字幕将由网页前端叠加。",
    ...video.scenes
      .slice(0, 5)
      .map((scene, index) => `${index + 1}. ${scene.title}：${scene.visual || scene.narration}`),
  ].join("\n");
}

async function requestVideoJson(payload) {
  const res = await fetch(VIDEO_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `视频服务请求失败：${res.status}`);
  return data || {};
}

function applyGeneratedVideo(index, url, player, canvas, downloadBtn, status) {
  state.renderedVideoUrls[index] = url;
  player.src = url;
  player.hidden = false;
  if (canvas) canvas.hidden = true;
  setupVideoCaptionOverlay(index, player);
  player.play().catch(() => {});
  if (downloadBtn) downloadBtn.disabled = false;
  if (status) status.textContent = "AI 视频已生成，可播放或下载。";
}

function setupVideoCaptionOverlay(index, player) {
  const resource = state.learningResources?.resources?.[index];
  const root = el.resourceGrid?.querySelector(`[data-video-resource="${index}"]`);
  const titleEl = root?.querySelector(".video-caption-title");
  const textEl = root?.querySelector(".video-caption-text");
  if (!resource || !titleEl || !textEl) return;
  const video = normalizeVideoResource(resource.content || "", resource.title);
  const scenes = video.scenes.length ? video.scenes : normalizeVideoResource("", resource.title).scenes;
  titleEl.textContent = video.title || resource.title || "教学视频";
  const update = () => {
    const duration = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : scenes.length;
    const sceneIndex = Math.min(scenes.length - 1, Math.floor((player.currentTime / duration) * scenes.length));
    const scene = scenes[sceneIndex] || scenes[0];
    textEl.textContent = scene?.narration || scene?.visual || "";
  };
  player.removeEventListener("timeupdate", player._lingxiCaptionUpdate || (() => {}));
  player._lingxiCaptionUpdate = update;
  player.addEventListener("timeupdate", update);
  player.addEventListener("loadedmetadata", update, { once: true });
  update();
}

async function renderLocalResourceVideo(index) {
  const resource = state.learningResources?.resources?.[index];
  if (!resource) return;
  const root = el.resourceGrid?.querySelector(`[data-video-resource="${index}"]`);
  const canvas = root?.querySelector(".video-canvas");
  const player = root?.querySelector(".video-player");
  const status = root?.querySelector(".video-status");
  const downloadBtn = root?.querySelector(`[data-download-video="${index}"]`);
  const renderBtn = root?.querySelector(`[data-render-video="${index}"]`);
  if (!(canvas instanceof HTMLCanvasElement) || !(player instanceof HTMLVideoElement)) return;
  if (!window.MediaRecorder || !canvas.captureStream) {
    if (status) status.textContent = "当前浏览器不支持本地视频合成，请接入 video_url 或数字人 embed_url。";
    return;
  }

  const video = normalizeVideoResource(resource.content || "", resource.title);
  const scenes = video.scenes.length ? video.scenes : normalizeVideoResource("", resource.title).scenes;
  video.scenes = scenes;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (renderBtn) renderBtn.disabled = true;
  if (downloadBtn) downloadBtn.disabled = true;
  if (status) status.textContent = "正在合成视频 0%...";

  try {
    const frameRate = 12;
    const stream = canvas.captureStream(frameRate);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = () => reject(recorder.error || new Error("视频录制失败"));
    });
    recorder.start(1000);

    const durationSeconds = Math.min(18, Math.max(12, Number(video.duration) || scenes.length * 3));
    const totalFrames = Math.max(120, Math.round(durationSeconds * frameRate));
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      const wholeProgress = frameIndex / totalFrames;
      const sceneProgress = wholeProgress * scenes.length;
      const sceneIndex = Math.min(scenes.length - 1, Math.floor(sceneProgress));
      const frameProgress = sceneProgress - sceneIndex;
      drawVideoFrame(ctx, canvas, video, sceneIndex, frameProgress);
      if (status && frameIndex % 10 === 0) {
        status.textContent = `正在合成视频 ${Math.round(wholeProgress * 100)}%...`;
      }
      await waitMs(1000 / frameRate);
    }
    recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: "video/webm" });
    if (!blob.size) throw new Error("浏览器没有产出视频数据");
    if (state.renderedVideoUrls[index]) URL.revokeObjectURL(state.renderedVideoUrls[index]);
    const url = URL.createObjectURL(blob);
    state.renderedVideoUrls[index] = url;
    player.src = url;
    player.hidden = false;
    canvas.hidden = true;
    player.play().catch(() => {});
    if (downloadBtn) downloadBtn.disabled = false;
    if (status) status.textContent = "视频已生成，可播放或下载 WebM。";
  } catch (e) {
    console.error(e);
    if (status) status.textContent = `视频合成失败：${String(e?.message || e)}`;
  } finally {
    if (renderBtn) renderBtn.disabled = false;
  }
}

function downloadRenderedVideo(index) {
  const url = state.renderedVideoUrls[index];
  const resource = state.learningResources?.resources?.[index];
  if (!url || !resource) return;
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFilename(resource.title || "教学视频")}.mp4`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function inferCodeLanguage(text) {
  const source = String(text || "");
  if (/^\s*#include\s+<|int\s+main\s*\(|using\s+namespace\s+std|std::/.test(source)) return "cpp";
  if (/^\s*import\s+tensorflow|from\s+tensorflow|import\s+torch|from\s+torch|def\s+\w+\s*\(|print\s*\(|tf\.|model\.|layers\.|np\.|pd\./m.test(source)) return "python";
  if (/^\s*(const|let|var)\s+|function\s+\w+\s*\(|console\.log|=>/m.test(source)) return "javascript";
  if (/^\s*public\s+class|System\.out\.println|import\s+java\./m.test(source)) return "java";
  return "";
}

function codeFence(value, lang = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  const safeLang = sanitizePrismLang(lang || inferCodeLanguage(text));
  return `\`\`\`${safeLang}\n${text}\n\`\`\``;
}

function normalizeCodePracticeMarkdown(content) {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const entries = Object.entries(content);
    const sections = [];
    const labelMap = {
      task: "任务目标",
      task_description: "任务目标",
      description: "任务说明",
      input: "输入样例",
      output: "输出样例",
      expected_output: "期望输出",
      code: "代码示例",
      starter_code: "代码骨架",
      skeleton: "代码骨架",
      solution: "参考实现",
      reference_solution: "参考实现",
      run_hint: "运行/调试提示",
      run_command: "运行命令",
      tests: "测试用例",
      test_cases: "测试用例",
      debug_tips: "调试清单",
      challenges: "修改挑战",
    };
    entries.forEach(([key, value]) => {
      const title = labelMap[key] || key.replace(/_/g, " ");
      if (value == null || value === "") return;
      const isCodeKey = /code|solution|skeleton/i.test(key);
      const isRunKey = /run_command/i.test(key);
      if (Array.isArray(value)) {
        sections.push(`## ${title}\n${value.map((item) => `- ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n")}`);
      } else if (isCodeKey) {
        sections.push(`## ${title}\n${codeFence(value)}`);
      } else if (isRunKey) {
        sections.push(`## ${title}\n${codeFence(value, "bash")}`);
      } else {
        sections.push(`## ${title}\n${String(value).trim()}`);
      }
    });
    return sections.join("\n\n");
  }

  let text = resourcePlainText(content || "").trim();
  if (!text || /```/.test(text)) return text;
  const markers = [
    "加载数据集",
    "归一化",
    "构建模型",
    "编译模型",
    "训练模型",
    "评估模型",
  ];
  const hasBarePython = /(^|\n)\s*(import\s+\w+|from\s+\w+|[A-Za-z_][\w.]*\s*=|model\.(compile|fit|evaluate)\()/m.test(text);
  if (!hasBarePython) return text;
  const lines = text.split(/\n/);
  const output = [];
  let buffer = [];
  let forcedLang = "";
  function flushCode() {
    if (!buffer.length) return;
    output.push(codeFence(buffer.join("\n"), forcedLang));
    buffer = [];
    forcedLang = "";
  }
  for (const line of lines) {
    const trimmed = line.trim();
    const isHeading = markers.includes(trimmed) || /^#{1,4}\s/.test(trimmed) || /^(task|code|run_hint)\s*$/i.test(trimmed);
    const isCodeLine = /^\s*(import\s+\w+|from\s+\w+|pip\s+install|python\s+|[A-Za-z_][\w.]*\s*=|[\w(),\s]+\)\s*=|[A-Za-z_][\w.]*\(|\(|\)|\]|\[|,)/.test(line);
    if (isHeading) {
      flushCode();
      if (/^code$/i.test(trimmed)) forcedLang = "python";
      if (/^run_hint$/i.test(trimmed)) forcedLang = "bash";
      const titleMap = { task: "任务说明", code: "代码示例", run_hint: "运行/调试提示" };
      output.push(/^(task|code|run_hint)$/i.test(trimmed) ? `## ${titleMap[trimmed.toLowerCase()]}` : line);
    } else if (isCodeLine || buffer.length) {
      if (/^\s*(pip\s+install|python\s+)/.test(line)) forcedLang = "bash";
      buffer.push(line);
    } else {
      flushCode();
      output.push(line);
    }
  }
  flushCode();
  return output.join("\n");
}

function renderCodePracticeResource(content) {
  return renderResourceMarkdown(normalizeCodePracticeMarkdown(content));
}

function renderMindmapResource(content, title) {
  const data = normalizeMindmapContent(content, title);
  const branches = Array.isArray(data.branches) ? data.branches : [];
  const mapId = `mindmap-${Math.random().toString(16).slice(2)}`;
  const leftBranches = branches.filter((_, index) => index % 2 === 1);
  const rightBranches = branches.filter((_, index) => index % 2 === 0);
  const maxSide = Math.max(leftBranches.length, rightBranches.length, 2);
  const maxBranchChildren = Math.max(1, ...branches.map((branch) => Math.min((branch.children || []).length, 4)));
  const branchGap = Math.max(190, maxBranchChildren * 46 + 54);
  const height = Math.max(680, maxSide * branchGap + 160);
  const width = 1420;
  const center = { x: Math.round(width / 2), y: Math.round(height / 2), w: 290, h: 82 };
  const branchColors = ["mint", "blue", "pink", "yellow", "green", "violet", "cyan"];
  const paths = [];
  const nodes = [
    renderMindmapNode("center", data.center || title || "知识图谱", center.x - center.w / 2, center.y - center.h / 2, center.w, center.h, "center"),
  ];

  function layoutSide(sideBranches, side) {
    const isLeft = side === "left";
    const branchX = isLeft ? 470 : 950;
    const childX = isLeft ? 28 : 1222;
    const branchW = 240;
    const branchH = 58;
    const childW = 170;
    const childH = 34;
    const startY = center.y - ((sideBranches.length - 1) * branchGap) / 2;
    sideBranches.forEach((branch, index) => {
      const y = Math.round(startY + index * branchGap);
      const color = branchColors[index % branchColors.length];
      const branchLeft = isLeft ? branchX - branchW : branchX;
      const branchId = `${side}-branch-${index}`;
      nodes.push(renderMindmapNode(branchId, branch.title || "分支", branchLeft, y - branchH / 2, branchW, branchH, `branch ${color}`));
      paths.push(`<path data-from="center" data-to="${branchId}" />`);
      (branch.children || []).slice(0, 4).forEach((child, childIndex) => {
        const childY = y + (childIndex - Math.min((branch.children || []).length, 4) / 2 + 0.5) * 38;
        const childLeft = isLeft ? childX : childX;
        const childId = `${side}-branch-${index}-leaf-${childIndex}`;
        nodes.push(renderMindmapNode(childId, child, childLeft, childY - childH / 2, childW, childH, `leaf ${color}`));
        paths.push(`<path class="thin" data-from="${branchId}" data-to="${childId}" />`);
      });
    });
  }

  layoutSide(leftBranches, "left");
  layoutSide(rightBranches, "right");

  return `
    <div class="mindmap-view" data-mindmap-id="${mapId}">
      <div class="mindmap-toolbar">
        <label class="mindmap-width-control">宽度
          <input type="range" min="1320" max="1900" value="${width}" step="20" data-mindmap-width />
        </label>
        <button class="resource-toggle" type="button" data-mindmap-layout>整理布局</button>
        <button class="resource-toggle" type="button" data-mindmap-export>导出 SVG</button>
      </div>
      <div class="mindmap-canvas-wrap">
        <div class="mindmap-canvas" style="height:${height}px;width:${width}px;min-width:${width}px" data-mindmap-title="${escapeHtml(data.center || title || "知识图谱")}">
          <svg class="mindmap-lines" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
            ${paths.join("")}
          </svg>
          ${nodes.join("")}
        </div>
      </div>
      ${data.path ? `<div class="mindmap-path"><strong>复习路径：</strong>${escapeHtml(data.path)}</div>` : ""}
    </div>
  `;
}

function renderMindmapNode(id, label, x, y, w, h, className) {
  return `<div class="mindmap-node ${className}" data-node-id="${id}" style="left:${x}px;top:${y}px;width:${w}px;min-height:${h}px" title="拖拽移动节点">${escapeHtml(label)}</div>`;
}

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function toMindmapData(value, fallbackTitle) {
  const data = parseMaybeJson(value);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const center = data.center || data["中心主题"] || data.root || data["根节点"] || fallbackTitle || "知识图谱";
  const rawBranches = data.branches || data["一级分支"] || data.children || data["分支"];
  let branches = [];
  if (Array.isArray(rawBranches)) {
    branches = rawBranches.map((branch) => {
      if (typeof branch === "string") return { title: branch, children: [] };
      const title = branch.title || branch.name || branch["标题"] || branch["名称"] || branch["一级节点"] || "分支";
      const children = branch.children || branch.nodes || branch["二级节点"] || branch["子节点"] || [];
      return { title, children: normalizeMindmapChildren(children) };
    });
  } else if (rawBranches && typeof rawBranches === "object") {
    branches = Object.entries(rawBranches).map(([title, children]) => ({
      title,
      children: normalizeMindmapChildren(children),
    }));
  }
  const path = data.path || data["复习路径"] || data.review_path || data["学习路径"] || "";
  return branches.length ? { center, branches, path } : null;
}

function normalizeMindmapChildren(children) {
  if (Array.isArray(children)) {
    return children.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return item.title || item.name || item["标题"] || item["名称"] || JSON.stringify(item);
      return String(item);
    }).filter(Boolean);
  }
  if (children && typeof children === "object") {
    if (Array.isArray(children["二级节点"])) return normalizeMindmapChildren(children["二级节点"]);
    if (Array.isArray(children["子节点"])) return normalizeMindmapChildren(children["子节点"]);
    return Object.entries(children).map(([key, value]) => {
      if (Array.isArray(value)) return `${key}：${value.join("、")}`;
      return `${key}：${String(value)}`;
    });
  }
  return children ? [String(children)] : [];
}

function mindmapPreviewText(content, title) {
  const data = normalizeMindmapContent(content, title);
  const branches = Array.isArray(data.branches) ? data.branches : [];
  const names = branches.map((branch) => branch.title).filter(Boolean).slice(0, 6).join("、");
  return `${data.center || title || "知识图谱"}：${branches.length} 个一级分支${names ? `（${names}）` : ""}`;
}

function updateMindmapLines(canvas) {
  if (!canvas) return;
  const nodes = Object.fromEntries([...canvas.querySelectorAll(".mindmap-node")].map((node) => {
    const x = parseFloat(node.style.left) || 0;
    const y = parseFloat(node.style.top) || 0;
    const w = node.offsetWidth || parseFloat(node.style.width) || 120;
    const h = node.offsetHeight || parseFloat(node.style.minHeight) || 34;
    return [node.dataset.nodeId, { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }];
  }));
  canvas.querySelectorAll(".mindmap-lines path").forEach((path) => {
    const from = nodes[path.dataset.from];
    const to = nodes[path.dataset.to];
    if (!from || !to) return;
    const fromRight = to.cx > from.cx;
    const sx = from.cx + (fromRight ? from.w / 2 : -from.w / 2);
    const sy = from.cy;
    const tx = to.cx + (fromRight ? -to.w / 2 : to.w / 2);
    const ty = to.cy;
    const mid = Math.max(70, Math.abs(tx - sx) * 0.45);
    path.setAttribute("d", `M ${sx} ${sy} C ${sx + (fromRight ? mid : -mid)} ${sy}, ${tx + (fromRight ? -mid : mid)} ${ty}, ${tx} ${ty}`);
  });
}

function initMindmapCanvases(root = document) {
  root.querySelectorAll(".mindmap-canvas").forEach(updateMindmapLines);
}

function autoLayoutMindmapCanvas(canvas, preferredWidth) {
  if (!canvas) return;
  const width = Math.max(1320, Math.round(preferredWidth || canvas.offsetWidth || 1420));
  const centerNode = canvas.querySelector('[data-node-id="center"]');
  const sides = ["left", "right"];
  const branchGroups = Object.fromEntries(sides.map((side) => {
    const branches = [...canvas.querySelectorAll(`.mindmap-node[data-node-id^="${side}-branch-"]:not([data-node-id*="-leaf-"])`)]
      .sort((a, b) => Number(a.dataset.nodeId.match(/branch-(\d+)/)?.[1] || 0) - Number(b.dataset.nodeId.match(/branch-(\d+)/)?.[1] || 0));
    return [side, branches];
  }));
  const maxSide = Math.max(branchGroups.left.length, branchGroups.right.length, 2);
  const maxChildren = Math.max(1, ...sides.flatMap((side) => branchGroups[side].map((branch) => {
    const id = branch.dataset.nodeId;
    return canvas.querySelectorAll(`.mindmap-node[data-node-id^="${id}-leaf-"]`).length;
  })));
  const branchGap = Math.max(190, maxChildren * 46 + 54);
  const height = Math.max(680, maxSide * branchGap + 160);
  const centerW = centerNode?.offsetWidth || 290;
  const centerH = centerNode?.offsetHeight || 82;
  const centerX = Math.round(width / 2);
  const centerY = Math.round(height / 2);
  const branchW = 240;
  const branchH = 58;
  const childW = 170;
  const childH = 34;
  const sideInset = 28;
  const leftBranchRight = Math.max(455, centerX - 240);
  const rightBranchLeft = Math.min(width - 455, centerX + 240);
  const rightChildLeft = width - sideInset - childW;

  canvas.style.width = `${width}px`;
  canvas.style.minWidth = `${width}px`;
  canvas.style.height = `${height}px`;
  const svg = canvas.querySelector(".mindmap-lines");
  svg?.setAttribute("viewBox", `0 0 ${width} ${height}`);
  if (centerNode) {
    centerNode.style.left = `${centerX - centerW / 2}px`;
    centerNode.style.top = `${centerY - centerH / 2}px`;
  }

  sides.forEach((side) => {
    const isLeft = side === "left";
    const branches = branchGroups[side];
    const startY = centerY - ((branches.length - 1) * branchGap) / 2;
    branches.forEach((branch, index) => {
      const y = Math.round(startY + index * branchGap);
      branch.style.left = `${isLeft ? leftBranchRight - branchW : rightBranchLeft}px`;
      branch.style.top = `${y - branchH / 2}px`;
      branch.style.width = `${branchW}px`;
      branch.style.minHeight = `${branchH}px`;
      const children = [...canvas.querySelectorAll(`.mindmap-node[data-node-id^="${branch.dataset.nodeId}-leaf-"]`)]
        .sort((a, b) => Number(a.dataset.nodeId.match(/leaf-(\d+)/)?.[1] || 0) - Number(b.dataset.nodeId.match(/leaf-(\d+)/)?.[1] || 0));
      children.forEach((child, childIndex) => {
        const childY = y + (childIndex - children.length / 2 + 0.5) * 46;
        child.style.left = `${isLeft ? sideInset : rightChildLeft}px`;
        child.style.top = `${childY - childH / 2}px`;
        child.style.width = `${childW}px`;
        child.style.minHeight = `${childH}px`;
      });
    });
  });
  updateMindmapLines(canvas);
}

function exportMindmapSvg(canvas) {
  if (!canvas) return "";
  updateMindmapLines(canvas);
  const width = Math.round(canvas.offsetWidth || 1320);
  const height = Math.round(canvas.offsetHeight || 620);
  const paths = [...canvas.querySelectorAll(".mindmap-lines path")].map((path) => {
    const cls = path.classList.contains("thin") ? " thin" : "";
    return `<path class="${cls.trim()}" d="${escapeHtml(path.getAttribute("d") || "")}" />`;
  }).join("");
  const nodes = [...canvas.querySelectorAll(".mindmap-node")].map((node) => {
    const x = parseFloat(node.style.left) || 0;
    const y = parseFloat(node.style.top) || 0;
    const w = node.offsetWidth || parseFloat(node.style.width) || 120;
    const h = node.offsetHeight || parseFloat(node.style.minHeight) || 40;
    const label = escapeHtml(node.textContent.trim());
    const bg = getComputedStyle(node).backgroundColor;
    const color = getComputedStyle(node).color;
    const fontSize = parseFloat(getComputedStyle(node).fontSize) || 13;
    return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${bg}" stroke="rgba(40,50,80,.18)" /><foreignObject x="${x}" y="${y}" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="height:${h}px;display:flex;align-items:center;justify-content:center;text-align:center;font:800 ${fontSize}px Arial;color:${color};padding:6px;box-sizing:border-box;">${label}</div></foreignObject></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<style>path{fill:none;stroke:rgba(49,54,75,.58);stroke-width:2.2;stroke-linecap:round}.thin{stroke-width:1.3;stroke:rgba(49,54,75,.38)}</style>
<rect width="100%" height="100%" fill="#ffffff"/>
${paths}
${nodes}
</svg>`;
}

function storeAndDownloadMindmapSvg(canvas) {
  const svg = exportMindmapSvg(canvas);
  if (!svg) return;
  const title = canvas.dataset.mindmapTitle || "思维导图";
  const file = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: `${title} 矢量图`,
    type: "思维导图矢量图",
    agent: "思维导图 Agent",
    category: categorizeKnowledge(title, svg),
    categoryLocked: false,
    filename: `${safeFilename(title)}.svg`,
    mimeType: "image/svg+xml;charset=utf-8",
    content: svg,
    createdAt: new Date().toISOString(),
  };
  const saved = saveStoredMarkdownFiles([file].concat(state.storedMarkdownFiles || []));
  if (saved) downloadMarkdownFile(file);
}

function normalizeMindmapContent(content, title) {
  const parsed = toMindmapData(content, title);
  if (parsed) return parsed;
  const text = resourcePlainText(content);
  const center = title || text.match(/根节点[:：]\s*(.+)/)?.[1] || "知识图谱";
  if (!isPoorMindmap(text)) {
    const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const branches = [];
    let current = null;
    for (const line of lines) {
      const clean = line.replace(/^[-*#\s]+/, "").replace(/^子节点[:：]\s*/, "").replace(/^分支[:：]\s*/, "");
      if (!clean || /^mindmap$/i.test(clean) || /^root/i.test(clean)) continue;
      if (/^[一二三四五六七八九十\d]+[.、]|：|:$/.test(clean) || branches.length === 0) {
        current = { title: clean.replace(/[:：]$/, ""), children: [] };
        branches.push(current);
      } else if (current) {
        current.children.push(clean);
      }
    }
    if (branches.length >= 3) return { center, branches: branches.slice(0, 6), path: "先抓主干概念，再补典型题型，最后用错题回查薄弱分支。" };
  }
  return buildFallbackMindmap(center);
}

function isPoorMindmap(text) {
  if (!text || text.length < 80) return true;
  if (/子节点[:：]\s*(定义|应用|计算方法|规则)/.test(text)) return true;
  const repeated = (text.match(/子节点[:：]/g) || []).length;
  return repeated >= 5 && !/[├└→]|Mermaid|:::|复习路径|关联/.test(text);
}

function buildFallbackMindmap(topic) {
  const isMath = /高等数学|高数|微积分|大学.*数学|考研数学|极限|导数|积分/.test(topic || "");
  if (isMath) {
    return {
      center: topic || "大学高等数学复习",
      branches: [
        { title: "函数与极限", children: ["函数性质：单调性、奇偶性、周期性", "极限计算：等价无穷小、洛必达、夹逼", "连续性：间断点分类、闭区间性质"] },
        { title: "导数与微分", children: ["导数定义与几何意义", "求导法则：复合、隐函数、参数方程", "应用：单调性、极值、凹凸性、渐近线"] },
        { title: "一元积分", children: ["不定积分：换元、分部、常见凑微分", "定积分：性质、变上限函数", "应用：面积、体积、物理量"] },
        { title: "多元函数", children: ["偏导数与全微分", "多元复合函数求导", "极值与条件极值"] },
        { title: "级数与微分方程", children: ["数项级数敛散性判别", "幂级数收敛域与展开", "一阶/二阶常微分方程解法"] },
        { title: "易错回查", children: ["先判定义域和条件", "计算题检查等价替换范围", "应用题先画量和变量关系"] },
      ],
      path: "极限 -> 导数 -> 积分 -> 多元函数 -> 级数/微分方程；每章按“定义、公式、典型题、易错点”复习。",
    };
  }
  return {
    center: topic || "知识点复习",
    branches: [
      { title: "核心定义", children: ["概念边界", "关键对象", "适用条件"] },
      { title: "基本规则", children: ["公式或语法", "步骤流程", "限制条件"] },
      { title: "典型例题", children: ["基础题", "变式题", "综合题"] },
      { title: "易错点", children: ["混淆概念", "条件遗漏", "计算或推理错误"] },
      { title: "应用场景", children: ["课程作业", "考试题型", "项目实践"] },
    ],
    path: "先定义，再规则，再例题，最后用易错点反向检查。",
  };
}

function resourcePlainText(markdown) {
  if (typeof markdown === "string") return markdown;
  if (Array.isArray(markdown)) {
    return markdown.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("\n");
  }
  if (markdown && typeof markdown === "object") return JSON.stringify(markdown);
  return "";
}

function normalizeExerciseList(content, title) {
  const parsed = parseMaybeJson(content);
  const rawItems = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? (parsed.questions || parsed.exercises || parsed.items || parsed["题目"] || parsed["练习题"] || [])
      : [];
  if (Array.isArray(rawItems) && rawItems.length) {
    return rawItems.map((item, index) => normalizeExerciseItem(item, index, title)).filter((item) => item.question);
  }
  const text = resourcePlainText(content);
  const objectMatches = [...text.matchAll(/\{[^{}]*(?:"题目"|"question")[^{}]*\}/g)].map((match) => parseMaybeJson(match[0]));
  if (objectMatches.length) {
    return objectMatches.map((item, index) => normalizeExerciseItem(item, index, title)).filter((item) => item.question);
  }
  const blocks = text.split(/\n(?=#{1,4}\s|(?:基础题|中等题|难题|易错题|迁移应用题|经典题|第\s*\d+\s*题|\d+[.、]\s))/).map((item) => item.trim()).filter(Boolean);
  return blocks.map((block, index) => {
    const lines = block.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const joined = lines.join("\n");
    const question = (joined.match(/(?:题目|问题)[:：]\s*([\s\S]*?)(?=\n(?:答案|解析|详解|来源|难度|知识点)[:：]|$)/)?.[1] || lines[0] || "").replace(/^#+\s*/, "");
    const answer = joined.match(/答案[:：]\s*([\s\S]*?)(?=\n(?:解析|详解|来源|难度|知识点)[:：]|$)/)?.[1] || "";
    const explanation = joined.match(/(?:解析|详解)[:：]\s*([\s\S]*?)(?=\n(?:来源|难度|知识点)[:：]|$)/)?.[1] || "";
    const source = joined.match(/来源[:：]\s*(.+)/)?.[1] || "";
    const difficulty = joined.match(/难度[:：]\s*(.+)/)?.[1] || inferExerciseDifficulty(joined, index);
    const type = joined.match(/类型[:：]\s*(.+)/)?.[1] || inferExerciseType(joined, index);
    return normalizeExerciseItem({ question, answer, explanation, source, difficulty, type }, index, title);
  }).filter((item) => item.question && item.question.length > 8);
}

function normalizeExerciseItem(item, index, title) {
  if (typeof item === "string") return normalizeExerciseItem({ question: item }, index, title);
  if (!item || typeof item !== "object") return null;
  const question = item.question || item["题目"] || item.prompt || item["问题"] || "";
  const answer = item.answer || item["答案"] || item.solution || "";
  const explanation = item.explanation || item["详解"] || item.analysis || item["解析"] || item["解题过程"] || "";
  const difficulty = item.difficulty || item["难度"] || inferExerciseDifficulty(`${question} ${explanation}`, index);
  const type = item.type || item["类型"] || inferExerciseType(`${question} ${explanation}`, index);
  const source = item.source || item["来源"] || item.origin || "经典题型改编";
  const knowledge = item.knowledge || item["知识点"] || item.topic || title || "";
  const normalized = {
    question: String(question || "").trim(),
    answer: String(answer || "").trim(),
    explanation: String(explanation || answer || "暂无详解，建议先尝试作答后补充推导过程。").trim(),
    difficulty: String(difficulty || "中等").trim(),
    type: String(type || "练习题").trim(),
    source: String(source || "经典题型改编").trim(),
    knowledge: String(knowledge || "").trim(),
  };
  normalized.fingerprint = `${normalized.question}|${normalized.answer}`.slice(0, 260);
  return normalized;
}

function inferExerciseDifficulty(text, index) {
  if (/难题|拔高|综合|证明|构造|迁移/.test(text)) return "难题";
  if (/中等|进阶|应用/.test(text) || index >= 2) return "中等";
  return "基础";
}

function inferExerciseType(text, index) {
  if (/易错/.test(text)) return "易错题";
  if (/迁移|应用|综合/.test(text)) return "迁移应用题";
  if (/难题|拔高/.test(text)) return "难题";
  if (index === 0) return "基础题";
  return "经典题";
}

function renderExerciseResource(content, title, resourceIndex) {
  const exercises = normalizeExerciseList(content, title);
  if (!exercises.length) return renderResourceMarkdown(content);
  return `
    <div class="exercise-grid">
      ${exercises.map((exercise, index) => `
        <article class="exercise-card">
          <div class="exercise-card-head">
            <div>
              <div class="exercise-meta">
                <span>${escapeHtml(exercise.type)}</span>
                <span>${escapeHtml(exercise.difficulty)}</span>
                <span>${escapeHtml(exercise.knowledge || title || "综合知识")}</span>
              </div>
              <h3>${escapeHtml(index + 1)}. ${renderInlineMathText(exercise.question)}</h3>
            </div>
            <button class="resource-toggle add-mistake-btn" type="button" data-add-mistake="${resourceIndex}:${index}">加入错题本</button>
          </div>
          <div class="exercise-source">来源：${escapeHtml(exercise.source)}</div>
          <details class="exercise-detail" open>
            <summary>答案与详解</summary>
            <div class="exercise-answer"><strong>答案：</strong>${renderInlineMathText(exercise.answer || "见解析")}</div>
            <div class="exercise-explanation markdown-body">${renderResourceMarkdown(exercise.explanation)}</div>
          </details>
        </article>
      `).join("")}
    </div>
  `;
}

function isAlgorithmDemand(demand) {
  return /算法|floyd|dijkstra|最短路|动态规划|dp|图论|排序|查找|数据结构|链表|栈|队列|树|堆|并查集/i.test(demand || "");
}

function isGrammarDemand(demand) {
  return /编译原理|文法|语法|乔姆斯基|chomsky|type-?1|1型|一型|上下文有关|context.?sensitive/i.test(demand || "");
}

function buildTypeOneGrammarDocument(demand, title) {
  const topic = demand || title || "编译原理中的 1 型文法";
  return `# 编译原理中的 1 型文法详解

## 1. 定义
1 型文法也叫**上下文有关文法**（Context-Sensitive Grammar, CSG），是乔姆斯基层次结构中的第二层，表达能力强于 2 型文法（上下文无关文法），弱于 0 型文法（短语结构文法）。它用来描述一些必须依赖左右上下文才能改写的语言结构。

一个文法通常写成四元组：

$$G = (V_N, V_T, P, S)$$

其中 $V_N$ 是非终结符集合，$V_T$ 是终结符集合，$P$ 是产生式集合，$S$ 是开始符号。1 型文法对产生式有严格限制：产生式一般形如

$$\\alpha A \\beta \\to \\alpha \\gamma \\beta$$

这里 $A$ 是非终结符，$\\alpha$、$\\beta$ 是上下文，$\\gamma$ 是非空符号串。含义是：只有当 $A$ 出现在左上下文 $\\alpha$ 和右上下文 $\\beta$ 之间时，才允许把 $A$ 改写成 $\\gamma$。这就是“上下文有关”的来源。

## 2. 非收缩性质
1 型文法常用一个等价限制来判断：产生式右部长度不能小于左部长度，即

$$|右部| \\ge |左部|$$

所以它也常被称为**非收缩文法**。例如：

\`\`\`text
AB -> aBC
A  -> aA
\`\`\`

这些产生式不会让句型长度变短。相反，下面这种产生式通常不符合 1 型文法：

\`\`\`text
AB -> a
\`\`\`

因为左部长度是 2，右部长度是 1，发生了收缩。唯一常见例外是开始符号推出空串 $S \\to \\varepsilon$，但一般要求 $S$ 不出现在任何产生式右部。

## 3. 与 0、2、3 型文法的区别
乔姆斯基层次可以粗略理解为：

$$3\\text{ 型文法} \\subset 2\\text{ 型文法} \\subset 1\\text{ 型文法} \\subset 0\\text{ 型文法}$$

3 型文法对应正则语言，通常能被有限自动机识别。2 型文法对应上下文无关语言，常用于描述程序语言中的括号匹配、表达式嵌套等结构。1 型文法比 2 型更强，因为它能表达“多个部分数量相等”这类需要跨区域约束的语言。0 型文法最强，对产生式限制最少，对应图灵机可识别语言。

一个典型例子是：

$$L = \\{ a^n b^n c^n \\mid n \\ge 1 \\}$$

这个语言要求 a、b、c 的数量三者相等。上下文无关文法可以方便地处理 $a^n b^n$，但同时约束三段数量相等就超出了 2 型文法的能力范围；1 型文法可以通过上下文相关的改写规则表达这种约束。

## 4. 产生式直觉
1 型文法的关键不是“随便替换一个符号”，而是“在指定上下文中替换一个符号”。例如：

\`\`\`text
a B c -> a b c
\`\`\`

这条规则表示：只有当 $B$ 左边是 $a$、右边是 $c$ 时，才可以把 $B$ 改成 $b$。如果句型中只有 $d B c$，就不能使用这条规则。这个限制让文法可以表达更精细的依赖关系。

在编译原理中，很多程序语言的核心语法可以用上下文无关文法描述，比如表达式、语句块、函数调用等。但有些约束不是纯 CFG 能自然表达的，例如“变量使用前必须声明”“函数调用参数个数与声明一致”“某些标识符类型必须匹配”。这些约束往往体现了上下文依赖。实际编译器通常不会直接用 1 型文法完整描述它们，而是把 CFG 用于语法分析，再用语义分析、符号表和类型检查处理这些上下文约束。

## 5. 与线性有界自动机的关系
1 型文法生成的语言称为**上下文有关语言**。它与线性有界自动机（Linear Bounded Automaton, LBA）等价：一个语言是上下文有关语言，当且仅当它能被某个线性有界自动机识别。所谓线性有界，是指自动机可使用的工作带长度受输入长度的线性函数限制。

这个结论说明 1 型文法的能力很强，但仍然受到空间限制。它比有限自动机、下推自动机强，也比不受限制的图灵机弱。

## 6. 常见判断方法
判断一个文法是不是 1 型文法，重点看产生式：

1. 左部不能只有终结符，通常必须包含至少一个非终结符。
2. 右部长度不能小于左部长度。
3. 如果出现 $S \\to \\varepsilon$，要检查开始符号 $S$ 是否出现在任何产生式右部。
4. 如果产生式体现 $\\alpha A \\beta \\to \\alpha \\gamma \\beta$，要能说明 $A$ 的改写依赖左右上下文。

例如：

\`\`\`text
S -> aSBC
S -> abc
CB -> BC
bB -> bb
bC -> bc
cC -> cc
\`\`\`

这类规则常用于构造 $a^n b^n c^n$ 一类语言。它的思想是先生成数量相关的符号，再通过交换和替换规则把非终结符逐步整理成终结符串。

## 7. 易错点
- 把 1 型文法误认为“只能有一个非终结符在左部”。这是 2 型文法的典型限制，不是 1 型文法的限制。
- 只看产生式形式，忽略长度约束。只要发生收缩，通常就不是 1 型文法。
- 把“上下文有关”理解成自然语言里的上下文。这里的上下文是形式语言中的符号串环境，即左侧和右侧符号对改写是否可用产生限制。
- 认为编译器一定直接用 1 型文法做语法分析。实际工程中更常见的是 CFG 负责语法结构，语义分析负责上下文约束。

## 8. 小结
1 型文法的核心是：产生式受上下文限制，并且通常不允许句型长度缩短。它能描述比上下文无关文法更复杂的依赖关系，例如多段符号数量一致。学习它时要抓住三个关键词：**上下文限制、非收缩、线性有界自动机等价**。`;
}

function buildFallbackKnowledgeDocument(demand, title) {
  const topic = demand || title || "当前学习主题";
  return `# ${title || topic || "知识文档"}

模型这次没有返回可用的知识正文。

请重新生成，或在对话页直接提问“${topic}”。系统不会再用“知识结构/学习方法论”模板冒充该主题的知识点内容。`;
}

function buildFallbackExercises(topic) {
  const subject = topic || "当前知识点";
  const grammar = isGrammarDemand(subject);
  const algorithm = isAlgorithmDemand(subject);
  if (grammar) {
    return {
      questions: [
        { type: "基础题", difficulty: "基础", knowledge: "1 型文法定义", source: "经典教材题型改编", question: "说明 1 型文法的产生式形式，并解释为什么它被称为上下文有关文法。", answer: "一般形式为 $\\alpha A \\beta \\to \\alpha \\gamma \\beta$，其中 $\\gamma$ 非空。", explanation: "关键是看非终结符 $A$ 的改写是否依赖左右两侧上下文 $\\alpha$ 和 $\\beta$。如果只有在特定左、右环境中才能把 $A$ 改写成 $\\gamma$，就体现了上下文有关性。答题时不要只写形式，还要解释 $A$、上下文和非空串的含义。" },
        { type: "基础题", difficulty: "基础", knowledge: "非收缩性质", source: "课程常见题型", question: "判断产生式 `AB -> aBC` 是否满足 1 型文法的非收缩要求，并说明理由。", answer: "满足。", explanation: "左部长度为 2，右部长度为 3，右部没有比左部短，因此不发生收缩。非收缩性质要求每条产生式通常满足右部长度大于或等于左部长度，唯一常见例外是开始符号推出空串且开始符号不出现在右部。" },
        { type: "中等题", difficulty: "中等", knowledge: "文法类型判断", source: "历年考试题型改编", question: "判断 `S -> aSBC | abc, CB -> BC, bB -> bb, bC -> bc, cC -> cc` 更接近哪类文法，并给出判断依据。", answer: "更接近 1 型文法。", explanation: "这些产生式左部可以含多个符号，且整体不缩短句型长度，能够通过符号交换和替换构造 $a^n b^n c^n$ 这类需要三段数量同步的语言。它不是 2 型文法的典型形式，因为 2 型文法要求左部只能是单个非终结符。" },
        { type: "中等题", difficulty: "中等", knowledge: "乔姆斯基层次", source: "经典教材题型改编", question: "为什么语言 $L=\\{a^n b^n c^n \\mid n \\ge 1\\}$ 通常不能由上下文无关文法生成？", answer: "因为它需要同时约束三段符号数量相等。", explanation: "上下文无关文法擅长处理单栈结构，例如 $a^n b^n$ 的两段匹配；但 $a^n b^n c^n$ 要同时保证 a、b、c 三段数量一致，需要跨多个区域维护依赖，这超出了单栈能力。1 型文法或线性有界自动机可以表达这种约束。" },
        { type: "难题", difficulty: "难题", knowledge: "构造思想", source: "综合题型改编", question: "简述构造 $a^n b^n c^n$ 的 1 型文法时，为什么常出现 `CB -> BC` 这类交换规则。", answer: "用于把生成过程中暂存的符号调整到正确顺序。", explanation: "构造时常先生成数量相关的 B、C，再通过交换规则把 B 移到 b 区域、C 移到 c 区域。`CB -> BC` 不改变长度，符合非收缩要求，同时逐步整理句型顺序。答题时要说明它不是随意交换，而是为最终形成 a、b、c 三段连续结构服务。" },
        { type: "难题", difficulty: "难题", knowledge: "自动机对应关系", source: "课程拔高题改编", question: "说明 1 型文法与线性有界自动机的关系，并解释“线性有界”的限制。", answer: "1 型文法生成的语言与线性有界自动机可识别语言等价。", explanation: "线性有界自动机可以看作工作空间受输入长度线性限制的图灵机。这个限制让它比下推自动机更强，能处理上下文有关语言；但又弱于无限制图灵机。回答时要点出等价关系和空间受限两点。" },
        { type: "易错题", difficulty: "中等", knowledge: "易混概念", source: "课堂易错题改编", question: "“上下文有关文法就是自然语言中要联系上下文理解”这句话对吗？", answer: "不准确。", explanation: "形式语言里的上下文是符号串环境，指某个非终结符左右两侧的符号会限制它能否改写。它不是阅读理解里的语境。这个题容易错在把日常语言的上下文和形式文法的上下文混为一谈。" },
        { type: "迁移应用题", difficulty: "难题", knowledge: "编译器语义约束", source: "工程应用题改编", question: "变量必须先声明再使用，这类约束为什么通常不直接交给上下文无关文法处理？", answer: "因为它依赖符号表和程序上下文，工程上通常由语义分析处理。", explanation: "上下文无关文法适合描述语句结构和嵌套关系，但变量是否声明、类型是否匹配、函数参数个数是否一致，需要跨位置记录信息。实际编译器通常先用 CFG 做语法分析，再通过符号表和类型检查处理这些上下文依赖。" },
      ],
    };
  }
  const base = algorithm ? "算法" : subject;
  return {
    questions: [
      { type: "基础题", difficulty: "基础", knowledge: base, source: "课程常见题型", question: `用一句话说明“${subject}”解决的核心问题。`, answer: "先明确输入、输出和目标，再描述核心方法。", explanation: "这类题考查概念边界。不要背名词，要说清它处理什么输入、要得到什么输出、关键过程是什么。回答时可按“对象 -> 目标 -> 方法”的顺序组织。" },
      { type: "基础题", difficulty: "基础", knowledge: base, source: "经典教材题型改编", question: `列出学习“${subject}”时至少三个必须检查的条件。`, answer: "定义条件、适用范围、输入规模或边界情况。", explanation: "多数知识点出错不是因为不会公式，而是忽略条件。检查条件可以防止把方法套到不适用场景。题目要求列条件，因此答案应覆盖定义、适用范围和边界，而不是只写一个概念。" },
      { type: "中等题", difficulty: "中等", knowledge: base, source: "课程作业题型改编", question: `给一个小例子说明“${subject}”的关键步骤。`, answer: "用 3 到 5 步展示输入如何变成输出。", explanation: "中等题重点在过程表达。你需要把抽象知识放进一个具体例子中，展示每一步依据。详解时要说明每步为什么合法，以及如果条件变化结果会怎样变化。" },
      { type: "中等题", difficulty: "中等", knowledge: base, source: "历年考试题型改编", question: `比较“${subject}”与一个相邻概念的区别。`, answer: "从适用对象、关键条件和输出结果三方面比较。", explanation: "比较题常见于考试。不要只写“概念不同”，要用表格式思路回答：对象不同、条件不同、步骤不同、结果不同。这样能避免在选择题或简答题里被相似术语干扰。" },
      { type: "难题", difficulty: "难题", knowledge: base, source: "综合题型改编", question: `设计一个综合场景，说明什么时候不能直接使用“${subject}”。`, answer: "当前提条件不满足或输入规模不适合时不能直接使用。", explanation: "难题考查边界意识。一个方法不仅要知道什么时候能用，也要知道什么时候不能用。回答时先给反例，再指出违反了哪个前提，最后说明应改用什么补充方法或先做什么预处理。" },
      { type: "难题", difficulty: "难题", knowledge: base, source: "拔高题改编", question: `如果题目条件稍作变化，“${subject}”的解法需要如何调整？`, answer: "重新检查状态、约束和目标，必要时更换方法。", explanation: "迁移类难题不是套模板，而是看条件变化影响了哪一环。详解应先定位变化点，再说明原方法哪一步失效，最后给出修正方案。这个过程能训练真正的应用能力。" },
      { type: "易错题", difficulty: "中等", knowledge: base, source: "课堂易错题改编", question: `学习“${subject}”时最容易犯的一个错误是什么？如何避免？`, answer: "常见错误是只记结论不验条件；避免方法是每次先写前提和边界。", explanation: "易错题的价值在于复盘。答题时不要只写错因，还要写预防动作，例如先列条件、画图、代入小例子、检查单位或复杂度。这样才能把错题转成下次可执行的提醒。" },
      { type: "迁移应用题", difficulty: "难题", knowledge: base, source: "项目/面试常见题型改编", question: `把“${subject}”应用到一个真实项目或考试综合题中，你会如何组织解题步骤？`, answer: "先抽象问题，再匹配知识点，最后验证结果。", explanation: "迁移应用题要求把知识从课本搬到真实场景。步骤应包括：识别问题类型、抽取关键条件、选择方法、执行推导或实现、用边界样例验证。详解的重点是说明为什么选择该方法，而不只是给结果。" },
    ],
  };
}

function buildFallbackCodePractice(topic) {
  const subject = topic || "当前知识点";
  const lca = /最近公共祖先|lowest common ancestor|\bLCA\b/i.test(subject);
  const floyd = /floyd|弗洛伊德|多源最短路|全源最短路|全点对最短/i.test(subject);

  if (lca) {
    return `# 二叉树最近公共祖先实训卡

## 1. 任务目标
实现一个 C++17 程序，在给定二叉树中寻找两个节点的最近公共祖先（Lowest Common Ancestor, LCA）。完成后你应该能解释递归函数的返回值含义，并能处理“一个节点本身就是祖先”的情况。

## 2. 输入/输出样例
本实训用代码内构造二叉树，树结构如下：

\`\`\`text
        3
      /   \\
     5     1
    / \\   / \\
   6   2 0   8
      / \\
     7   4
\`\`\`

测试用例：

| p | q | 期望 LCA |
|---|---|---|
| 5 | 1 | 3 |
| 5 | 4 | 5 |
| 6 | 4 | 5 |

## 3. 先补全代码骨架
\`\`\`cpp
#include <iostream>
#include <vector>
using namespace std;

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    explicit TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p, TreeNode* q) {
    // TODO 1: 空树、命中 p、命中 q 时直接返回 root
    // TODO 2: 递归查找左子树和右子树
    // TODO 3: 如果左右两边都找到了，当前 root 就是最近公共祖先
    // TODO 4: 否则返回非空的一边
    return nullptr;
}

int main() {
    TreeNode* root = new TreeNode(3);
    root->left = new TreeNode(5);
    root->right = new TreeNode(1);
    root->left->left = new TreeNode(6);
    root->left->right = new TreeNode(2);
    root->right->left = new TreeNode(0);
    root->right->right = new TreeNode(8);
    root->left->right->left = new TreeNode(7);
    root->left->right->right = new TreeNode(4);

    vector<pair<TreeNode*, TreeNode*>> tests = {
        {root->left, root->right},
        {root->left, root->left->right->right},
        {root->left->left, root->left->right->right},
    };
    vector<int> expected = {3, 5, 5};

    for (size_t i = 0; i < tests.size(); ++i) {
        TreeNode* ans = lowestCommonAncestor(root, tests[i].first, tests[i].second);
        cout << "case " << i + 1 << ": got="
             << (ans ? ans->val : -1)
             << ", expected=" << expected[i] << endl;
    }
}
\`\`\`

## 4. 参考实现
\`\`\`cpp
TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p, TreeNode* q) {
    if (root == nullptr || root == p || root == q) return root;

    TreeNode* left = lowestCommonAncestor(root->left, p, q);
    TreeNode* right = lowestCommonAncestor(root->right, p, q);

    if (left != nullptr && right != nullptr) return root;
    return left != nullptr ? left : right;
}
\`\`\`

## 5. 运行命令
\`\`\`bash
g++ lca.cpp -std=c++17 -O2 && ./a.out
\`\`\`

期望输出：

\`\`\`text
case 1: got=3, expected=3
case 2: got=5, expected=5
case 3: got=5, expected=5
\`\`\`

## 6. 调试清单
- 如果输出为空，先检查递归出口是否写了 \`root == nullptr\`。
- 如果 \`p=5, q=4\` 输出 3，说明你没有正确处理“一个节点是另一个节点祖先”的情况。
- 如果左右子树都找到目标，却返回了左/右子树，说明缺少 \`left && right -> root\` 这一步。

## 7. 修改挑战
1. 把程序改成从数组层序构造二叉树。
2. 改写成二叉搜索树的 LCA，并比较为什么 BST 可以利用大小关系。
3. 加入“节点不存在”的检测：只有 p 和 q 都存在时才返回 LCA，否则返回空。`;
  }

  if (floyd) {
    return `# Floyd 算法实训卡

## 1. 任务目标
实现 Floyd-Warshall 算法，计算带权图中任意两点之间的最短距离，并能输出一条具体最短路径。

## 2. 输入/输出样例
\`\`\`text
顶点数 n = 4
边：
0 -> 1, 权重 3
1 -> 2, 权重 2
0 -> 2, 权重 10
2 -> 3, 权重 4
期望：0 到 2 的最短距离为 5，路径为 0 -> 1 -> 2
\`\`\`

## 3. 先补全代码骨架
\`\`\`cpp
#include <iostream>
#include <vector>
using namespace std;

const int INF = 1e9;

int main() {
    int n = 4;
    vector<vector<int>> dist(n, vector<int>(n, INF));
    vector<vector<int>> nxt(n, vector<int>(n, -1));

    for (int i = 0; i < n; ++i) {
        dist[i][i] = 0;
        nxt[i][i] = i;
    }

    auto addEdge = [&](int u, int v, int w) {
        dist[u][v] = min(dist[u][v], w);
        nxt[u][v] = v;
    };

    addEdge(0, 1, 3);
    addEdge(1, 2, 2);
    addEdge(0, 2, 10);
    addEdge(2, 3, 4);

    // TODO: Floyd 三层循环，k 必须放在最外层

    cout << "0 到 2 的最短距离: " << dist[0][2] << endl;
    return 0;
}
\`\`\`

## 4. 参考实现核心
\`\`\`cpp
for (int k = 0; k < n; ++k) {
    for (int i = 0; i < n; ++i) {
        for (int j = 0; j < n; ++j) {
            if (dist[i][k] == INF || dist[k][j] == INF) continue;
            if (dist[i][k] + dist[k][j] < dist[i][j]) {
                dist[i][j] = dist[i][k] + dist[k][j];
                nxt[i][j] = nxt[i][k];
            }
        }
    }
}
\`\`\`

## 5. 运行命令
\`\`\`bash
g++ floyd.cpp -std=c++17 -O2 && ./a.out
\`\`\`

## 6. 测试用例
| 起点 | 终点 | 期望距离 |
|---|---|---|
| 0 | 2 | 5 |
| 0 | 3 | 9 |
| 3 | 0 | 不可达 |

## 7. 调试清单
- \`dist[i][i]\` 必须初始化为 0。
- 无边要设成 INF，且相加前要判断是否为 INF，避免溢出。
- \`k\` 必须在最外层，它表示当前允许使用的中转点集合。

## 8. 修改挑战
1. 输出完整路径，而不只是最短距离。
2. 加入负边测试，并检测负环。
3. 把邻接矩阵输入改成从标准输入读取。`;
  }

  return `# ${subject}代码实训卡

## 1. 任务目标
围绕“${subject}”完成一个最小可运行程序。目标不是只看答案，而是完成“读题 -> 写骨架 -> 跑样例 -> 查错误 -> 做变式”的完整过程。

## 2. 输入/输出样例
\`\`\`text
输入：给定一个小规模样例，能手算结果
输出：程序打印计算结果，并与期望值对比
\`\`\`

## 3. 代码骨架
\`\`\`cpp
#include <iostream>
using namespace std;

int main() {
    // TODO 1: 定义输入数据
    // TODO 2: 实现核心逻辑
    // TODO 3: 打印结果并和期望值比较
    cout << "TODO" << endl;
    return 0;
}
\`\`\`

## 4. 运行命令
\`\`\`bash
g++ main.cpp -std=c++17 -O2 && ./a.out
\`\`\`

## 5. 测试用例
| 用例 | 目的 | 期望 |
|---|---|---|
| 基础样例 | 验证主流程 | 输出与手算一致 |
| 边界样例 | 验证空输入/最小规模 | 不崩溃 |
| 易错样例 | 验证特殊条件 | 能解释结果 |

## 6. 调试清单
- 先确认输入是否和题意一致。
- 再打印中间变量，观察核心状态是否按预期变化。
- 最后检查边界条件和复杂度。

## 7. 修改挑战
1. 增加 2 个自定义测试用例。
2. 把固定输入改成标准输入。
3. 写一句话解释核心算法为什么正确。`;
}

function isPoorCodePractice(content) {
  const text = resourcePlainText(content);
  const plain = text.replace(/\s+/g, " ").trim();
  if (plain.length < 700) return true;
  const hasCode = /```(?:cpp|c\+\+|c|python|py|java|js|javascript|ts|typescript|bash|sh)?[\s\S]*?```/.test(text);
  const hasRun = /(运行命令|编译|g\+\+|gcc|python\s|node\s|javac|mvn|npm|cargo|go run)/i.test(text);
  const hasTests = /(测试用例|输入\/输出|输入输出|期望输出|expected|case\s*\d|边界)/i.test(text);
  const hasPractice = /(代码骨架|TODO|补全|参考实现|调试清单|修改挑战|扩展任务)/i.test(text);
  return !hasCode || !hasRun || !hasTests || !hasPractice;
}

function buildFallbackReadingMaterials(topic) {
  const subject = topic || "当前知识点";
  const isMultimodal = /多模态|multimodal|跨模态|vision-language|视觉语言|图文|音视频|模态融合/i.test(subject);
  const isVision = /计算机视觉|computer vision|图像|目标检测|图像分类|opencv|cnn|卷积|视觉|cv\b/i.test(subject);
  const isGrammar = isGrammarDemand(subject);
  const isAlgorithm = isAlgorithmDemand(subject);

  if (isMultimodal) {
    return `# 多模态学习拓展阅读清单

## 1. 经典基础 / 入门综述
- Tadas Baltrušaitis, Chaitanya Ahuja, Louis-Philippe Morency, [Multimodal Machine Learning: A Survey and Taxonomy](https://arxiv.org/abs/1705.09406)：先读 abstract、introduction 和 taxonomy 部分，用它建立 representation、translation、alignment、fusion、co-learning 五条主线。
- Yao-Hung Hubert Tsai et al., [Multimodal Transformer for Unaligned Multimodal Language Sequences](https://arxiv.org/abs/1906.00295)：重点看 crossmodal attention，适合理解文本、语音、视觉序列未对齐时怎么融合。
- Alec Radford et al., [Learning Transferable Visual Models From Natural Language Supervision](https://arxiv.org/abs/2103.00020)：CLIP 论文，重点看图文对比学习和 zero-shot transfer。

## 2. 2022 年以来前沿论文
- Jean-Baptiste Alayrac et al., [Flamingo: a Visual Language Model for Few-Shot Learning](https://arxiv.org/abs/2204.14198)：看视觉语言模型如何用少样本提示完成图文任务。
- Junnan Li et al., [BLIP-2: Bootstrapping Language-Image Pre-training](https://arxiv.org/abs/2301.12597)：重点看 Q-Former 如何连接冻结视觉编码器和大语言模型。
- Haotian Liu et al., [Visual Instruction Tuning](https://arxiv.org/abs/2304.08485)：LLaVA 论文，适合理解视觉指令微调和多模态对话模型。
- Rohit Girdhar et al., [ImageBind: One Embedding Space To Bind Them All](https://arxiv.org/abs/2305.05665)：理解图像、文本、音频、深度、热成像、IMU 等多模态如何进入同一 embedding space。

## 3. 课程 / 视频
- [Stanford CS231n: Deep Learning for Computer Vision](https://cs231n.stanford.edu/)：补视觉编码器、CNN、Transformer、检测分割等基础。
- [CS231n YouTube 公开视频合集](https://www.youtube.com/playlist?list=PLoROMvodv4rOmsNzYBMe0gJY2XS8AQg16)：先看 CNN、visual recognition、detection 相关课，再看多模态论文会顺很多。

## 4. 官方文档 / 实操入口
- [Hugging Face Transformers: Image-text-to-text](https://huggingface.co/docs/transformers/main/en/tasks/image_text_to_text)：可直接跑视觉语言模型推理，适合把“图像+文本输入”落到代码。
- [OpenAI CLIP GitHub](https://github.com/openai/CLIP)：看 CLIP 的官方代码和 zero-shot 分类示例。
- [Awesome Multimodal Machine Learning](https://github.com/pliang279/awesome-multimodal-ml)：按 topics 查论文、数据集和代码，适合继续扩展阅读。

## 5. 数据集 / 任务入口
- [COCO Dataset](https://cocodataset.org/)：图像字幕、目标检测、分割等视觉语言任务常用数据源。
- [Hugging Face Visual Question Answering task](https://huggingface.co/tasks/visual-question-answering)：了解 VQA 任务、模型和数据集入口。

## 6. 检索关键词
- 中文：多模态学习、跨模态检索、模态融合、视觉语言模型、图文对比学习、视觉问答、多模态 Transformer、CLIP。
- 英文：multimodal learning, multimodal fusion, cross-modal retrieval, vision-language model, contrastive language-image pretraining, visual question answering, crossmodal attention, multimodal transformer.`;
  }

  if (isVision) {
    return `# 计算机视觉拓展阅读清单

## 1. 系统课程 / 视频
- [Stanford CS231n: Deep Learning for Computer Vision](https://cs231n.stanford.edu/)：先看课程主页的 Course Description、Schedule 和 Useful Notes；适合建立图像分类、卷积网络、检测、分割的主线。
- [CS231n YouTube 公开视频合集](https://www.youtube.com/playlist?list=PLoROMvodv4rOmsNzYBMe0gJY2XS8AQg16)：建议从 Image Classification、CNN、Object Detection 三类视频开始看，边看边记模型输入输出和评价指标。

## 2. 教材 / 书
- Richard Szeliski, *Computer Vision: Algorithms and Applications, 2nd ed.*：官网 https://szeliski.org/Book/ 。先读第 1 章概览，再按需要读图像形成、特征、匹配、分割和识别章节。
- Rafael C. Gonzalez, Richard E. Woods, *Digital Image Processing*：适合补图像处理基础，重点看灰度变换、滤波、边缘检测、形态学这些传统视觉基础。
- Ian Goodfellow, Yoshua Bengio, Aaron Courville, *Deep Learning*：官网 https://www.deeplearningbook.org/ 。如果 CNN 训练和反向传播不稳，先补第 6、7、9 章。

## 3. 官方文档 / 实操网站
- [OpenCV Tutorials](https://docs.opencv.org/4.x/d9/df8/tutorial_root.html)：按 Image Processing、Feature2D、Camera Calibration、DNN 模块做小实验。
- [PyTorch Vision 文档](https://pytorch.org/vision/stable/index.html)：查 torchvision datasets、models、transforms；适合把理论模型跑起来。
- [COCO Dataset](https://cocodataset.org/)：了解 detection、keypoints、panoptic segmentation 等任务和数据格式。
- [ImageNet](https://www.image-net.org/)：理解大规模图像分类基准和 ILSVRC 传统。

## 4. 经典论文
- Alex Krizhevsky, Ilya Sutskever, Geoffrey Hinton, [ImageNet Classification with Deep Convolutional Neural Networks](https://papers.nips.cc/paper_files/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html)：读网络结构、ReLU、dropout、数据增强为什么有效。
- Kaiming He et al., [Deep Residual Learning for Image Recognition](https://arxiv.org/abs/1512.03385)：重点看 residual connection 如何解决深层网络训练困难。
- Alexey Dosovitskiy et al., [An Image is Worth 16x16 Words](https://arxiv.org/abs/2010.11929)：了解 Vision Transformer 如何把图像切成 patch 序列。

## 5. 2022 年以来前沿论文
- Zhuang Liu et al., [A ConvNet for the 2020s](https://arxiv.org/abs/2201.03545)：ConvNeXt 论文，适合比较现代卷积网络和 Transformer 的设计取舍。
- Alexander Kirillov et al., [Segment Anything](https://arxiv.org/abs/2304.02643)：理解基础视觉模型、提示式分割和大规模分割数据。
- Maxime Oquab et al., [DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193)：看自监督视觉特征如何用于下游任务。

## 6. 检索关键词
- 中文：图像分类、目标检测、语义分割、实例分割、卷积神经网络、视觉 Transformer、特征提取、数据增强。
- 英文：image classification, object detection, semantic segmentation, instance segmentation, convolutional neural network, Vision Transformer, feature extraction, data augmentation.`;
  }

  if (isGrammar) {
    return `# 编译原理 / 形式语言拓展阅读清单

## 1. 教材 / 书
- Alfred V. Aho, Monica S. Lam, Ravi Sethi, Jeffrey D. Ullman, *Compilers: Principles, Techniques, and Tools*：俗称龙书；读词法分析、语法分析、上下文无关文法、语义分析章节。
- John E. Hopcroft, Rajeev Motwani, Jeffrey D. Ullman, *Introduction to Automata Theory, Languages, and Computation*：适合系统理解乔姆斯基层次、自动机和形式语言。
- Michael Sipser, *Introduction to the Theory of Computation*：读上下文无关语言、可判定性和复杂性相关章节。

## 2. 在线课程 / 笔记
- [Stanford CS143 Compilers](https://web.stanford.edu/class/cs143/)：看课程资料中的 lexical analysis、parsing、semantic analysis。
- [Crafting Interpreters](https://craftinginterpreters.com/)：适合用动手实现理解语法、解析器和解释器结构。

## 3. 进一步检索关键词
- 中文：乔姆斯基层次、上下文有关文法、上下文无关文法、线性有界自动机、非收缩文法、语法分析。
- 英文：Chomsky hierarchy, context-sensitive grammar, context-free grammar, linear bounded automaton, noncontracting grammar, parsing.`;
  }

  if (isAlgorithm) {
    return `# 算法 / 数据结构拓展阅读清单

## 1. 教材 / 书
- Thomas H. Cormen et al., *Introduction to Algorithms*：适合作为系统教材，读图算法、动态规划、贪心、复杂度分析。
- Robert Sedgewick, Kevin Wayne, *Algorithms, 4th Edition*：配套网站 https://algs4.cs.princeton.edu/ ，适合用 Java 示例理解基础数据结构和图算法。
- Steven S. Skiena, *The Algorithm Design Manual*：适合从问题建模和题型归纳角度学习。

## 2. 网站 / 可视化
- [CP-Algorithms](https://cp-algorithms.com/)：查图论、动态规划、字符串、数论模板和证明。
- [VisuAlgo](https://visualgo.net/)：用动画理解排序、图遍历、最短路、最小生成树等过程。
- [OI Wiki](https://oi-wiki.org/)：中文资料较全，适合查算法定义、模板和例题。

## 3. 检索关键词
- 中文：时间复杂度、状态转移、图论最短路、动态规划、贪心算法、数据结构模板。
- 英文：time complexity, recurrence relation, shortest path, dynamic programming, greedy algorithm, graph algorithms.`;
  }

  return `# ${subject}拓展阅读清单

## 1. 推荐查找的资源类型
- 教材：优先找该领域本科或研究生课程常用教材，阅读定义、例题和章节小结。
- 课程 / 视频：优先找大学公开课、官方文档、课程主页，而不是只看碎片短视频。
- 论文 / 综述：如果主题偏前沿，先检索 survey、tutorial、review，再读代表性论文。
- 实操文档：如果主题能编程或实验，优先找官方文档、示例仓库和数据集说明。

## 2. 可直接使用的检索入口
- Google Scholar：https://scholar.google.com/
- arXiv：https://arxiv.org/
- Papers with Code：https://paperswithcode.com/
- GitHub Topics：https://github.com/topics

## 3. 检索关键词
- 中文：${subject} 教材、${subject} 公开课、${subject} 综述、${subject} 经典论文、${subject} 实验。
- 英文：${subject} textbook, ${subject} course, ${subject} survey, ${subject} tutorial, ${subject} benchmark.`;
}

function isPoorReadingMaterial(content) {
  const text = resourcePlainText(content).replace(/\s+/g, " ").trim();
  if (text.length < 520) return true;
  const hasConcreteSource = /(https?:\/\/|www\.|arxiv|doi|DOI|论文|paper|教材|书|课程|视频|YouTube|官网|官方文档|dataset|数据集|GitHub|《|[*][^*]+[*])/.test(text);
  const hasActionableSections = /(书|教材|课程|视频|论文|网站|官方文档|数据集|检索关键词|关键词)/.test(text);
  const genericOnly = /应用范围不断扩大|未来发挥越来越重要|广泛的应用前景|不断发展|建议进一步阅读相关资料|可以阅读相关书籍|查找相关论文/.test(text);
  const knownBad = /John Doe|Jane Smith|Coursera多模态机器学习|coursera\.org\/learn\/multimodal-machine-learning|arXiv:1906\.04230|1906\.04230|TNNLS\.2018\.2871234|tensorflow\.org\/guide\/multimodal/.test(text);
  return !hasConcreteSource || !hasActionableSections || genericOnly || knownBad;
}

function normalizeGeneratedResources(data, demand) {
  if (!data || !Array.isArray(data.resources)) return data;
  const resources = data.resources.map((item) => ({ ...item }));
  const agentByType = Object.fromEntries(
    SELECTABLE_RESOURCE_AGENTS.map((agent) => [agent.type, agent.role])
  );
  for (const item of resources) {
    if (agentByType[item.type]) item.agent = agentByType[item.type];
  }
  const doc = resources.find((item) => item.type === "专业课程讲解文档") || resources[0];
  if (doc && doc.type === "专业课程讲解文档") {
    doc.agent = "知识文档 Agent";
    const contentText = typeof doc.content === "string" ? doc.content : JSON.stringify(doc.content || "");
    const subjectText = `${demand || ""} ${doc.title || ""}`;
    if (contentText.trim().length < 120) {
      doc.content = buildFallbackKnowledgeDocument(subjectText.trim(), doc.title);
    }
  }
  const mindmap = resources.find((item) => item.type === "知识点思维导图");
  if (mindmap) {
    mindmap.agent = "思维导图 Agent";
    const subjectText = `${demand || ""} ${mindmap.title || ""}`;
    const contentText = resourcePlainText(mindmap.content);
    const parsedMindmap = toMindmapData(mindmap.content, mindmap.title);
    if (!parsedMindmap && isPoorMindmap(contentText)) {
      mindmap.content = buildFallbackMindmap(subjectText.trim() || mindmap.title);
    }
  }
  const quiz = resources.find((item) => item.type === "不同类型练习题目");
  if (quiz) {
    quiz.agent = "练习命题 Agent";
    const subjectText = `${demand || ""} ${quiz.title || ""}`.trim();
    const exercises = normalizeExerciseList(quiz.content, quiz.title);
    const weakExercises = exercises.length < 8 || exercises.some((item) => !item.answer || !item.explanation || item.explanation.length < 60);
    if (weakExercises) {
      quiz.content = buildFallbackExercises(subjectText || quiz.title || "当前知识点");
    }
  }
  const reading = resources.find((item) => item.type === "拓展阅读材料");
  if (reading) {
    reading.agent = "阅读拓展 Agent";
    const subjectText = `${demand || ""} ${reading.title || ""}`.trim();
    const knownTopic = /多模态|multimodal|跨模态|vision-language|视觉语言|计算机视觉|computer vision|opencv|编译原理|文法|算法|数据结构|floyd|dijkstra|动态规划|最短路/i.test(subjectText);
    if (knownTopic || isPoorReadingMaterial(reading.content)) {
      reading.content = buildFallbackReadingMaterials(subjectText || reading.title || "当前知识点");
    }
  }
  const code = resources.find((item) => item.type === "代码类实操案例");
  if (code) {
    code.agent = "代码实操 Agent";
    const subjectText = `${demand || ""} ${code.title || ""}`.trim();
    if (isPoorCodePractice(code.content)) {
      code.content = buildFallbackCodePractice(subjectText || code.title || "当前知识点");
    }
  }
  const demandCategory = categorizeKnowledge(
    `${demand || ""} ${data.topic || ""}`,
    `${demand || ""} ${data.topic || ""} ${resources.map((item) => item.title || item.type || "").join(" ")}`
  );
  const demandTrace = summarizeDemandEvents(demand || data.topic || "");
  return {
    ...data,
    category: data.category && data.category !== "其他" ? data.category : demandCategory,
    demand_trace: data.demand_trace || demandTrace,
    demand_source: data.demand_source || {
      primary: demand || data.topic || "",
      category: demandCategory,
      generated_at: new Date().toISOString(),
    },
    path_basis: normalizePathBasis(data.path_basis || data.learning_analysis || data.analysis_basis, resources, {
      category: demandCategory,
      topic: demand || data.topic || "",
    }),
    learning_path: normalizeLearningPath(data.learning_path || data.path_plan || data.path, demand, resources),
    resources,
  };
}

function profileText(field, fallback = "") {
  const value = state.studentProfile?.[field]?.value;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function summarizeProfileForPath() {
  const parts = [
    profileText("major_background"),
    profileText("knowledge_foundation"),
    profileText("learning_habits"),
    profileText("cognitive_style"),
  ].filter(Boolean);
  return parts.length ? parts.join("；") : "画像信息较少，先采用诊断-讲解-练习-迁移的稳妥节奏。";
}

function buildLearningProgressSummary(resources = []) {
  const completedTurns = state.messages.filter((item) => item.role === "assistant").length;
  const userQuestions = state.messages.filter((item) => item.role === "user").length;
  const mistakeCount = Array.isArray(state.mistakeBookItems) ? state.mistakeBookItems.length : 0;
  const resourceTypes = resources.map((item) => item.type).filter(Boolean);
  const generatedText = resourceTypes.length
    ? `已生成 ${resourceTypes.length} 类资源：${resourceTypes.join("、")}`
    : "尚未生成系统资源";
  return [
    userQuestions ? `已有 ${userQuestions} 轮学习提问` : "对话轮次较少",
    completedTurns ? `完成 ${completedTurns} 次 AI 辅导反馈` : "暂未形成连续辅导记录",
    mistakeCount ? `错题本沉淀 ${mistakeCount} 条复盘项` : "错题本暂未记录复盘项",
    generatedText,
  ].join("；");
}

function sameKnowledgeCategory(text, category, topic = "") {
  const s = String(text || "").trim();
  if (!s) return false;
  if (topic && s.includes(topic)) return true;
  return categorizeKnowledge(s, s) === category;
}

function normalizePathBasis(value, resources = [], context = {}) {
  const profile = state.studentProfile || createEmptyProfile();
  const basis = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const category = context.category || categorizeKnowledge(context.topic || "", context.topic || "");
  const topic = context.topic || "";
  const profileMastery = profile.knowledge_foundation?.value || "";
  const topicProfileMastery = sameKnowledgeCategory(profileMastery, category, topic) ? profileMastery : "";
  return {
    major_analysis: String(
      basis.major_analysis ||
      basis.major ||
      profile.major_background?.value ||
      "专业背景暂未充分确认，路径先采用通用课程学习节奏，并在后续对话中动态修正。"
    ),
    progress_analysis: String(
      basis.progress_analysis ||
      basis.progress ||
      buildLearningProgressSummary(resources)
    ),
    mastery_analysis: String(
      basis.mastery_analysis ||
      basis.mastery ||
      topicProfileMastery ||
      `暂未发现与“${topic || category || "当前主题"}”直接相关的掌握证据；不会把其他知识大类的画像信息混入本路径，需要通过诊断题、错题和后续对话继续校准。`
    ),
    preference_analysis: String(
      basis.preference_analysis ||
      basis.preference ||
      [profile.cognitive_style?.value, profile.interaction_preference?.value, profile.learning_habits?.value].filter(Boolean).join("；") ||
      "学习偏好暂不明确，默认组合讲解、导图、练习和实操。"
    ),
    resource_strategy: String(
      basis.resource_strategy ||
      basis.strategy ||
      "路径会按阶段调用已生成资源：先用文档和导图建构概念，再用题库检测掌握，最后用视频、拓展阅读或实操完成迁移。"
    ),
  };
}

function normalizeResourcePushList(value, resources = []) {
  const fromValue = Array.isArray(value)
    ? value.map((item) => {
        if (typeof item === "string") return { type: item, title: item, reason: "匹配当前阶段目标" };
        return {
          type: String(item?.type || item?.resource_type || item?.name || "学习资源"),
          title: String(item?.title || item?.name || item?.type || "推荐资源"),
          reason: String(item?.reason || item?.why || item?.match_reason || "匹配当前阶段目标"),
        };
      })
    : [];
  if (fromValue.length) return fromValue.slice(0, 4);
  return resources.slice(0, 3).map((item) => ({
    type: item.type || "学习资源",
    title: item.title || "个性化资源",
    reason: "系统已按本阶段需要生成，可直接配套使用",
  }));
}

function normalizeTodoList(item, index) {
  const rawTodos = Array.isArray(item?.todos)
    ? item.todos
    : Array.isArray(item?.todo)
      ? item.todo
      : Array.isArray(item?.steps)
        ? item.steps
        : String(item?.action || item?.task || "").split(/[；;\n]/);
  const todos = rawTodos.map((todo, todoIndex) => {
    if (typeof todo === "string") {
      return {
        label: todo.trim(),
        evidence: "",
      };
    }
    return {
      label: String(todo?.label || todo?.task || todo?.title || todo?.step || `任务 ${todoIndex + 1}`).trim(),
      evidence: String(todo?.evidence || todo?.check || todo?.output || todo?.done_when || "").trim(),
    };
  }).filter((todo) => todo.label);
  if (todos.length) return todos.slice(0, 6);
  return [
    { label: `完成阶段 ${index + 1} 的核心学习任务`, evidence: "能说明本阶段学到了什么" },
  ];
}

function normalizeLearningPath(pathValue, demand, resources = []) {
  const raw = Array.isArray(pathValue)
    ? pathValue
    : Array.isArray(pathValue?.steps)
      ? pathValue.steps
      : Array.isArray(pathValue?.stages)
        ? pathValue.stages
        : [];
  const normalized = raw.map((item, index) => ({
    stage: String(item?.stage || item?.title || `阶段 ${index + 1}`).trim(),
    goal: String(item?.goal || item?.objective || item?.description || "完成当前学习目标").trim(),
    duration: String(item?.duration || item?.time || item?.suggested_time || "30-45 分钟").trim(),
    order_reason: String(item?.order_reason || item?.why_now || item?.sequence_reason || "承接上一阶段结果，降低认知负荷并逐步提高任务难度").trim(),
    steps: Array.isArray(item?.steps)
      ? item.steps.map((step) => String(step).trim()).filter(Boolean)
      : String(item?.action || item?.task || "").split(/[；;\n]/).map((step) => step.trim()).filter(Boolean),
    todos: normalizeTodoList(item, index),
    mastery: String(item?.mastery || item?.checkpoint || item?.evidence || "能独立复述要点并完成配套练习").trim(),
    resources: normalizeResourcePushList(item?.resources || item?.resource_push || item?.recommended_resources, resources),
  })).filter((item) => item.stage || item.goal || item.steps.length);
  if (normalized.length) return normalized.slice(0, 6);

  const topic = String(demand || "当前主题").trim() || "当前主题";
  const profileHint = summarizeProfileForPath();
  const resourceByType = Object.fromEntries(resources.map((item) => [item.type, item]));
  const pick = (...types) => types.map((type) => resourceByType[type]).filter(Boolean);
  return [
    {
      stage: "诊断定位",
      goal: `明确“${topic}”的先修基础、薄弱环节和学习偏好`,
      duration: "10-15 分钟",
      order_reason: "先诊断再学习，避免把时间花在已经掌握或暂时不相关的内容上。",
      steps: [
        "先浏览画像摘要和需求分析，确认本次学习目标",
        "用一两道基础题检测术语、公式或核心规则是否卡住",
        `按画像调整节奏：${profileHint}`,
      ],
      todos: [
        { label: "确认本次主题和最终学习目标", evidence: "能用一句话说清本轮要解决的问题" },
        { label: "完成 1-2 道基础诊断题", evidence: "知道自己卡在概念、步骤还是应用" },
        { label: "标记最需要补的知识点", evidence: "写下 1-2 个薄弱点" },
      ],
      mastery: "能说清自己最需要补的 1-2 个点，并知道后续学习顺序",
      resources: normalizeResourcePushList([], pick("不同类型练习题目", "专业课程讲解文档")),
    },
    {
      stage: "概念建构",
      goal: "建立核心概念、结构关系和易错边界",
      duration: "35-45 分钟",
      order_reason: "诊断后先补概念框架，再进入题目和实操，能减少反复试错。",
      steps: [
        "先读专业课程讲解文档，标出定义、步骤和常见误区",
        "再看思维导图，把分支关系整理成自己的笔记",
        "遇到抽象内容时优先用例题或图示回到具体场景",
      ],
      todos: [
        { label: "阅读讲解文档并划出定义、规则和易错点", evidence: "能复述核心定义" },
        { label: "查看思维导图并整理 5 个关键节点", evidence: "能说明节点之间的关系" },
        { label: "用自己的例子解释一个抽象概念", evidence: "例子与概念能对应起来" },
      ],
      mastery: "能不看资料复述主干知识，并解释至少 2 个易错点",
      resources: normalizeResourcePushList([], pick("专业课程讲解文档", "知识点思维导图", "多模态教学视频/动画")),
    },
    {
      stage: "分层练习",
      goal: "按基础、进阶、易错、应用逐级巩固",
      duration: "45-60 分钟",
      order_reason: "概念形成后用题目验证掌握程度，再根据错题动态调整后续资源。",
      steps: [
        "先完成基础题和经典题，确保规则能正确套用",
        "再做中等题和难题，记录卡住的步骤",
        "把错题加入错题本，复盘错误原因和检查方法",
      ],
      todos: [
        { label: "完成基础题和经典题", evidence: "基础题能稳定做对" },
        { label: "挑战中等题或难题并记录卡点", evidence: "写下卡住步骤" },
        { label: "把错题加入错题本并写复盘原因", evidence: "能说出错误类型和修正方法" },
      ],
      mastery: "基础题正确率稳定，能对错题写出原因和修正方案",
      resources: normalizeResourcePushList([], pick("不同类型练习题目", "代码类实操案例")),
    },
    {
      stage: "迁移应用",
      goal: "把知识迁移到案例、项目或实操任务中",
      duration: "40-70 分钟",
      order_reason: "最后用案例或实操检查能否脱离讲解材料解决真实任务。",
      steps: [
        "完成代码实操或案例任务，先补 TODO 再看参考实现",
        "用测试用例验证边界情况，记录调试过程",
        "从拓展阅读中选择 1 个资源继续加深理解",
      ],
      todos: [
        { label: "完成实操案例或最小实验", evidence: "能独立运行或讲清实验结果" },
        { label: "验证至少 3 个测试或边界情况", evidence: "知道结果是否符合预期" },
        { label: "选择 1 个拓展资源继续阅读", evidence: "记录下一步深入方向" },
      ],
      mastery: "能独立完成一个小案例，并说明它对应的知识点",
      resources: normalizeResourcePushList([], pick("代码类实操案例", "拓展阅读材料")),
    },
  ];
}

function pathTodoKey(topic, stageIndex, todoIndex, label) {
  const raw = `${topic || "topic"}::${stageIndex}::${todoIndex}::${label || ""}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `path_${Math.abs(hash)}`;
}

function getPathTodoStats(path, topic) {
  const todos = [];
  path.forEach((stage, stageIndex) => {
    (stage.todos || []).forEach((todo, todoIndex) => {
      const key = pathTodoKey(topic, stageIndex, todoIndex, todo.label);
      todos.push({ key, stage, stageIndex, todo, todoIndex, done: Boolean(state.learningPathTodoDone[key]) });
    });
  });
  const done = todos.filter((item) => item.done).length;
  const next = todos.find((item) => !item.done);
  return {
    total: todos.length,
    done,
    percent: todos.length ? Math.round((done / todos.length) * 100) : 0,
    next,
  };
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function percent(value, total) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function summarizeLearningPathProgress() {
  const categories = getPathCategories();
  const byCategory = categories.map((category) => {
    const data = state.learningPathLibrary?.[category];
    const path = normalizeLearningPath(data?.learning_path, data?.topic, data?.resources || []);
    const stats = getPathTodoStats(path, category);
    return {
      category,
      topic: data?.topic || category,
      total: stats.total,
      done: stats.done,
      percent: stats.percent,
      next: stats.next ? `${stats.next.stage.stage} - ${stats.next.todo.label}` : "",
    };
  });
  const total = byCategory.reduce((sum, item) => sum + item.total, 0);
  const done = byCategory.reduce((sum, item) => sum + item.done, 0);
  return {
    total,
    done,
    percent: percent(done, total),
    by_category: byCategory,
  };
}

function summarizeResourceUsage() {
  const events = state.learningBehaviorEvents || [];
  const usageEvents = events.filter((item) =>
    ["resource_open", "resource_download", "push_open", "video_render", "storage_open", "storage_download"].includes(item.type)
  );
  const typeCounts = usageEvents.reduce((acc, item) => {
    const key = item.meta?.resourceType || item.type || "学习资源";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const recent = usageEvents.slice(0, 10).map((item) => ({
    type: item.type,
    title: item.title,
    category: item.category,
    created_at: item.createdAt,
  }));
  return {
    total: usageEvents.length,
    type_counts: typeCounts,
    recent,
  };
}

function summarizeMistakePerformance() {
  const items = state.mistakeBookItems || [];
  const byCategory = items.reduce((acc, item) => {
    const key = item.category || "其他";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const byDifficulty = items.reduce((acc, item) => {
    const key = item.difficulty || "未标难度";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const recent = items.slice(0, 8).map((item) => ({
    topic: item.topic,
    category: item.category,
    difficulty: item.difficulty,
    type: item.type,
    question: String(item.question || "").slice(0, 120),
    added_at: item.addedAt,
  }));
  return {
    total: items.length,
    by_category: byCategory,
    by_difficulty: byDifficulty,
    recent,
  };
}

function buildLearningEvidence() {
  const pathProgress = summarizeLearningPathProgress();
  const resourceUsage = summarizeResourceUsage();
  const mistakePerformance = summarizeMistakePerformance();
  const messageCount = state.messages.length;
  const userQuestionCount = state.messages.filter((item) => item.role === "user").length;
  const assistantReplyCount = state.messages.filter((item) => item.role === "assistant").length;
  const generatedResources = state.learningResources?.resources || [];
  const categories = getPathCategories();
  const activeData = getActivePathData();
  const demandTrace = summarizeDemandEvents(activeData?.topic || state.learningResources?.topic || "");
  const recentBehavior = (state.learningBehaviorEvents || []).slice(0, 16).map((item) => ({
    type: item.type,
    category: item.category,
    topic: item.topic,
    title: item.title,
    created_at: item.createdAt,
  }));
  return {
    generated_at: new Date().toISOString(),
    profile: state.studentProfile || createEmptyProfile(),
    chat: {
      message_count: messageCount,
      user_question_count: userQuestionCount,
      assistant_reply_count: assistantReplyCount,
    },
    demands: demandTrace,
    path_progress: pathProgress,
    resource_usage: resourceUsage,
    mistake_performance: mistakePerformance,
    resources: {
      current_topic: state.learningResources?.topic || "",
      current_category: state.learningResources?.category || "",
      generated_count: generatedResources.length,
      generated_types: generatedResources.map((item) => item.type).filter(Boolean),
      path_categories: categories,
      active_path_topic: activeData?.topic || "",
      active_path_category: activeData?.category || state.activePathCategory || "",
    },
    recent_behavior: recentBehavior,
  };
}

function normalizeAssessmentList(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return source.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8);
}

function normalizeDimensions(value, fallback) {
  const source = Array.isArray(value) && value.length ? value : fallback;
  return source.map((item, index) => ({
    name: String(item?.name || item?.dimension || `维度 ${index + 1}`).trim(),
    score: clampScore(item?.score),
    level: String(item?.level || item?.status || "").trim() || (clampScore(item?.score) >= 80 ? "稳定" : clampScore(item?.score) >= 60 ? "发展中" : "需干预"),
    evidence: String(item?.evidence || item?.reason || "暂无足够证据，需要继续跟踪学习行为。").trim(),
    action: String(item?.action || item?.suggestion || "继续收集学习证据并安排诊断任务。").trim(),
  })).slice(0, 6);
}

function normalizeLearningAssessment(input) {
  const data = input && typeof input === "object" ? input : {};
  const fallback = buildFallbackAssessment(buildLearningEvidence());
  const dimensions = normalizeDimensions(data.dimensions, fallback.dimensions);
  const overall = clampScore(data.overall_score ?? Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / Math.max(1, dimensions.length)));
  return {
    generated_at: String(data.generated_at || new Date().toISOString()),
    overall_score: overall,
    overall_level: String(data.overall_level || fallback.overall_level || (overall >= 80 ? "学习效果稳定" : overall >= 60 ? "正在形成有效学习闭环" : "需要加强诊断与练习反馈")),
    summary: String(data.summary || fallback.summary || "系统已根据当前学习证据生成评估。"),
    dimensions,
    strengths: normalizeAssessmentList(data.strengths, fallback.strengths),
    risks: normalizeAssessmentList(data.risks, fallback.risks),
    resource_strategy: normalizeAssessmentList(data.resource_strategy, fallback.resource_strategy),
    plan_adjustments: normalizeAssessmentList(data.plan_adjustments, fallback.plan_adjustments),
    next_checkpoints: normalizeAssessmentList(data.next_checkpoints, fallback.next_checkpoints),
  };
}

function buildFallbackAssessment(evidence) {
  const chatScore = clampScore(35 + Math.min(30, evidence.chat.user_question_count * 6) + Math.min(20, Object.keys(evidence.demands.category_counts || {}).length * 5));
  const pathScore = clampScore(evidence.path_progress.percent || (evidence.path_progress.total ? 30 : 18));
  const resourceScore = clampScore(30 + Math.min(45, evidence.resource_usage.total * 9) + Math.min(15, evidence.resources.generated_count * 3));
  const practiceScore = clampScore(50 + Math.min(20, evidence.mistake_performance.total * 4) - Math.min(25, evidence.mistake_performance.total * 2) + Math.min(20, evidence.path_progress.done * 3));
  const adaptationScore = clampScore(35 + Math.min(30, evidence.resources.path_categories.length * 10) + Math.min(25, evidence.recent_behavior.length * 2));
  const dimensions = [
    {
      name: "学习投入",
      score: chatScore,
      evidence: `累计 ${evidence.chat.user_question_count} 轮学习提问，沉淀 ${Object.keys(evidence.demands.category_counts || {}).length} 个知识大类需求。`,
      action: chatScore >= 70 ? "保持连续提问，把问题拆到具体知识点和题型。" : "增加明确学习目标和课后追问，帮助系统更准确识别需求。",
    },
    {
      name: "路径执行",
      score: pathScore,
      evidence: `学习路径待办完成 ${evidence.path_progress.done}/${evidence.path_progress.total} 项，整体进度 ${evidence.path_progress.percent}%。`,
      action: pathScore >= 70 ? "继续按阶段推进，并在完成后生成下一轮资源。" : "优先完成当前路径的前 2 个待办，补足评估证据。",
    },
    {
      name: "资源利用",
      score: resourceScore,
      evidence: `已生成 ${evidence.resources.generated_count} 类资源，记录到 ${evidence.resource_usage.total} 次资源使用行为。`,
      action: resourceScore >= 70 ? "把高频资源与错题复盘绑定，形成闭环。" : "先打开题库、讲解文档或导图，并把关键资料保存到存储页。",
    },
    {
      name: "练习反馈",
      score: practiceScore,
      evidence: `错题本当前有 ${evidence.mistake_performance.total} 条复盘项。`,
      action: evidence.mistake_performance.total ? "按错题大类安排二次练习，关注相同错误是否复现。" : "完成诊断题并把不确定题加入错题本，避免只看不练。",
    },
    {
      name: "动态优化",
      score: adaptationScore,
      evidence: `系统已维护 ${evidence.resources.path_categories.length} 个路径大类和 ${evidence.recent_behavior.length} 条近期行为证据。`,
      action: "每次完成阶段待办后重新生成评估，用结果调整资源推送顺序。",
    },
  ];
  const overall = clampScore(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  const weakCategories = Object.entries(evidence.mistake_performance.by_category || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);
  const nextPath = evidence.path_progress.by_category.find((item) => item.next)?.next || "";
  return {
    generated_at: evidence.generated_at,
    overall_score: overall,
    overall_level: overall >= 80 ? "学习效果稳定" : overall >= 60 ? "正在形成有效学习闭环" : "需要加强诊断与练习反馈",
    summary: "当前评估基于本地学习行为、路径完成度、资源使用与错题记录生成；接入 API 后会由大模型给出更细的诊断文本。",
    dimensions,
    strengths: [
      evidence.resources.generated_count ? "已经具备可用于动态推送的学习资源池。" : "可以先通过资源页建立个性化资源池。",
      evidence.path_progress.total ? "学习路径已可跟踪阶段完成度。" : "生成资源后会自动形成学习路径。",
    ],
    risks: [
      evidence.mistake_performance.total ? `错题集中在：${weakCategories.join("、") || "待进一步分类"}。` : "练习反馈证据不足，难以判断真实掌握度。",
      evidence.path_progress.percent < 50 ? "路径待办完成度偏低，学习计划还没有形成稳定执行节奏。" : "需要持续复盘，避免完成待办后不做迁移练习。",
    ],
    resource_strategy: [
      weakCategories.length ? `优先推送 ${weakCategories[0]} 的题库、讲解文档和错题复盘任务。` : "先推送诊断题和核心讲解文档，建立掌握度基线。",
      evidence.resource_usage.total ? "保留已打开资源，下一轮增加与错题主题匹配的练习。" : "将文档/导图放在前置推送，再衔接题库与实操。",
    ],
    plan_adjustments: [
      nextPath ? `下一步先完成：${nextPath}` : "先生成或更新一个学习路径，再按待办推进。",
      "每完成一组练习后立即更新错题本，并重新生成评估。",
    ],
    next_checkpoints: [
      "本轮结束后能否复述核心概念和常见错误。",
      "基础题正确率是否稳定，错题原因是否能被归类。",
      "是否完成至少一个迁移应用或实操任务。",
    ],
  };
}

function updateAssessmentRefreshUi() {
  if (el.generateAssessmentBtn) {
    el.generateAssessmentBtn.disabled = Boolean(state.assessmentGenerating);
    el.generateAssessmentBtn.textContent = state.assessmentGenerating ? "刷新中..." : "刷新评估";
  }
}

async function refreshLearningAssessment(source = "manual") {
  recordLearningBehavior("assessment_refresh", {
    category: state.activePathCategory,
    topic: getActivePathData()?.topic || state.learningResources?.topic || "",
    title: source,
  });
  await generateLearningAssessment();
}

async function generateLearningAssessment() {
  if (state.assessmentGenerating) return;
  const evidence = buildLearningEvidence();
  state.assessmentGenerating = true;
  updateAssessmentRefreshUi();
  renderAssessmentPage();
  const fallback = buildFallbackAssessment(evidence);
  if (USE_BROWSER_API_KEY && !state.apiKey) state.apiKey = localStorage.getItem(API_KEY_STORAGE) || "";
  if (USE_BROWSER_API_KEY && !state.apiKey) {
    saveLearningAssessment(fallback);
    state.assessmentGenerating = false;
    updateAssessmentRefreshUi();
    renderAssessmentPage();
    return;
  }
  const system = `你是学习效果评估与个性化学习优化 Agent。只输出合法 JSON，不要 Markdown 代码块。
你要基于学习行为、练习测试、资源使用反馈、错题记录、路径完成度和学生画像，做多维度精准评估，并给出动态资源推送策略和学习计划调整。

输出 JSON 格式：
{
  "generated_at": string,
  "overall_score": number,
  "overall_level": string,
  "summary": string,
  "dimensions": [{"name": string, "score": number, "level": string, "evidence": string, "action": string}],
  "strengths": [string],
  "risks": [string],
  "resource_strategy": [string],
  "plan_adjustments": [string],
  "next_checkpoints": [string]
}

规则：
- dimensions 必须覆盖学习投入、知识掌握、练习反馈、资源利用、路径执行、动态优化中的至少 5 个。
- 每个 score 为 0-100，evidence 必须引用输入证据，不要编造不存在的测试成绩。
- resource_strategy 要说明资源推送如何根据评估结果变化，例如先推题库、视频、导图、文档、实操或错题复盘。
- plan_adjustments 要能直接改学习路径和下一步行动。
- 如果证据不足，要明确说明缺口，并安排诊断题、错题记录或阶段待办来补证据。`;
  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: buildChatHeaders(),
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `学习证据包：\n${JSON.stringify(evidence, null, 2)}` },
        ],
        stream: false,
        temperature: 0.25,
      }),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => "评估生成失败"));
    const data = await res.json().catch(() => null);
    const parsed = extractJsonObject(data?.choices?.[0]?.message?.content || "");
    if (!parsed) throw new Error("模型未返回有效评估 JSON");
    saveLearningAssessment(parsed);
  } catch (e) {
    console.warn("大模型评估失败，使用本地评估兜底", e);
    saveLearningAssessment({
      ...fallback,
      summary: `${fallback.summary}（大模型评估暂不可用，已使用本地规则兜底。）`,
    });
  } finally {
    state.assessmentGenerating = false;
    updateAssessmentRefreshUi();
    renderAssessmentPage();
  }
}

function getPathCategories() {
  reindexLearningPathLibrary();
  return Object.keys(state.learningPathLibrary || {})
    .filter((category) => state.learningPathLibrary?.[category]?.resources?.length)
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function getActivePathData() {
  const categories = getPathCategories();
  if (!state.activePathCategory || !categories.includes(state.activePathCategory)) {
    state.activePathCategory =
      (state.learningResources?.category && state.learningPathLibrary?.[state.learningResources.category] ? state.learningResources.category : "") ||
      Object.keys(state.learningPathLibrary || {})[0] ||
      categories[0] ||
      "";
  }
  return state.activePathCategory ? state.learningPathLibrary?.[state.activePathCategory] || null : null;
}

function renderPathCategoryTabs(activeCategory) {
  const categories = getPathCategories();
  if (!categories.length) return "";
  return `
    <div class="path-category-tabs" role="tablist" aria-label="学习路径知识大类">
      ${categories.map((category) => {
        const data = state.learningPathLibrary?.[category];
        const count = (state.learningDemandEvents || []).filter((item) => item.category === category).length;
        return `
          <button class="path-category-tab ${category === activeCategory ? "active" : ""}" type="button" role="tab" aria-selected="${category === activeCategory ? "true" : "false"}" data-path-category="${escapeHtml(category)}">
            <span>${escapeHtml(category)}</span>
            <em>${data ? "已生成路径" : `${count || 1} 条需求`}</em>
          </button>
        `;
      }).join("")}
    </div>
    <div class="path-category-note">这里只显示已生成学习路径的大类；新的学习主题生成资源后，会自动加入这里。</div>
  `;
}

function renderLearningPathPanel() {
  if (!el.learningPathPanel) return;
  const activeData = getActivePathData();
  const data = activeData || state.learningResources;
  const activeCategory = normalizePathCategory(data?.category || state.activePathCategory || "");
  if (state.resourcesGenerating) {
    el.learningPathPanel.innerHTML = `
      ${renderPathCategoryTabs(activeCategory)}
      <div class="learning-path-empty">正在整合画像、学习进度和资源类型，生成动态学习路径...</div>
    `;
    return;
  }
  if (!data?.resources?.length) {
    el.learningPathPanel.innerHTML = `
      ${renderPathCategoryTabs(activeCategory)}
      <div class="learning-path-empty">生成资源后，这里会按知识大类保存学习路径；同类问题会更新原路径，不会覆盖其他大类。</div>
    `;
    return;
  }
  const path = normalizeLearningPath(data.learning_path, data.topic, data.resources);
  if (!data.category || data.category === "其他") {
    data.category = inferPathCategory(data);
  }
  const todoScope = normalizePathCategory(data.category || data.topic);
  const todoStats = getPathTodoStats(path, todoScope);
  const basis = normalizePathBasis(data.path_basis, data.resources, {
    category: data.category,
    topic: data.topic,
  });
  const demandTrace = data.demand_trace || summarizeDemandEvents(data.topic || "");
  const sameCategoryDemands = Array.isArray(demandTrace.same_category_recent)
    ? demandTrace.same_category_recent.slice(0, 5)
    : [];
  const categoryCounts = demandTrace.category_counts && typeof demandTrace.category_counts === "object"
    ? Object.entries(demandTrace.category_counts).slice(0, 6)
    : [];
  if (
    data.category &&
    basis.mastery_analysis &&
    !sameKnowledgeCategory(basis.mastery_analysis, data.category, data.topic || "") &&
    !/暂未|没有|尚未|需要通过|未发现/.test(basis.mastery_analysis)
  ) {
    basis.mastery_analysis = `暂未发现与“${data.topic || data.category}”直接相关的掌握证据；已过滤其他知识大类的画像信息，需要通过诊断题、错题和后续对话继续校准。`;
  }
  const basisItems = [
    ["专业分析", basis.major_analysis],
    ["学习进度", basis.progress_analysis],
    ["掌握情况", basis.mastery_analysis],
    ["学习偏好", basis.preference_analysis],
    ["资源策略", basis.resource_strategy],
  ];
  el.learningPathPanel.innerHTML = `
    ${renderPathCategoryTabs(activeCategory)}
    <section class="learning-path-card">
      <div class="learning-path-head">
        <div>
          <div class="resource-type">动态个性化学习路径</div>
          <div class="learning-current-label">当前路径</div>
          <h2 class="learning-path-title">${escapeHtml(data.topic || "当前学习主题")}</h2>
        </div>
        <div class="learning-path-badge">大模型综合规划 · ${path.length} 个阶段</div>
      </div>
      <div class="learning-demand-panel">
        <div class="learning-demand-head">
          <strong>当前需求识别</strong>
          <span>${escapeHtml(data.category || demandTrace.current_category || "其他")}</span>
        </div>
        <div class="learning-demand-primary">${escapeHtml(data.demand_source?.primary || data.topic || "当前学习主题")}</div>
        <div class="learning-demand-chips">
          ${sameCategoryDemands.length
            ? sameCategoryDemands.map((item) => `<span title="${escapeHtml(item.source || "")}">${escapeHtml(item.demand)}</span>`).join("")
            : `<span>暂无同类历史需求，后续对话和资源生成会继续沉淀。</span>`}
        </div>
        <div class="learning-category-chips">
          ${categoryCounts.map(([category, count]) => `<span>${escapeHtml(category)} · ${count}</span>`).join("")}
        </div>
      </div>
      <div class="learning-path-basis">
        ${basisItems.map(([label, text]) => `
          <article class="learning-basis-item">
            <div>${escapeHtml(label)}</div>
            <p>${escapeHtml(text)}</p>
          </article>
        `).join("")}
      </div>
      <div class="learning-progress-panel">
        <div class="learning-progress-head">
          <div>
            <strong>执行进度</strong>
            <span>${todoStats.done}/${todoStats.total} 个待办已完成</span>
          </div>
          <b>${todoStats.percent}%</b>
        </div>
        <div class="learning-progress-track">
          <div style="width: ${todoStats.percent}%"></div>
        </div>
        <div class="learning-next-step">
          下一步：${todoStats.next ? `${escapeHtml(todoStats.next.stage.stage)} - ${escapeHtml(todoStats.next.todo.label)}` : "本轮学习路径已完成，可以重新生成资源更新下一轮路径。"}
        </div>
      </div>
      <div class="learning-path-steps">
        ${path.map((item, index) => `
          <article class="learning-path-step">
            <div class="learning-step-index">${index + 1}</div>
            <div class="learning-step-body">
              <div class="learning-step-head">
                <h3>${escapeHtml(item.stage)}</h3>
                <span>${escapeHtml(item.duration)}</span>
              </div>
              <p>${escapeHtml(item.goal)}</p>
              <div class="learning-order-reason">顺序理由：${escapeHtml(item.order_reason || "承接上一阶段结果，逐步提高难度。")}</div>
              <div class="learning-todo-list">
                ${(item.todos || []).map((todo, todoIndex) => {
                  const key = pathTodoKey(todoScope, index, todoIndex, todo.label);
                  const checked = Boolean(state.learningPathTodoDone[key]);
                  return `
                    <label class="learning-todo-item ${checked ? "done" : ""}">
                      <input type="checkbox" data-path-todo="${escapeHtml(key)}" ${checked ? "checked" : ""} />
                      <span>
                        <strong>${escapeHtml(todo.label)}</strong>
                        ${todo.evidence ? `<em>完成证据：${escapeHtml(todo.evidence)}</em>` : ""}
                      </span>
                    </label>
                  `;
                }).join("")}
              </div>
              <div class="learning-mastery">掌握证据：${escapeHtml(item.mastery)}</div>
              <div class="learning-push-list">
                ${normalizeResourcePushList(item.resources, data.resources).map((resource) => `
                  <span class="learning-push-chip" title="${escapeHtml(resource.reason)}">${escapeHtml(resource.type)} · ${escapeHtml(resource.title)}</span>
                `).join("")}
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function resourceTypeLabel(type) {
  if (/文档/.test(type || "")) return "文档";
  if (/视频|动画/.test(type || "")) return "视频";
  if (/练习|题目|题库/.test(type || "")) return "题库";
  if (/实操|代码/.test(type || "")) return "实操";
  if (/导图/.test(type || "")) return "导图";
  if (/阅读/.test(type || "")) return "阅读";
  return type || "资源";
}

function collectPushedResources(pathData) {
  if (!pathData?.resources?.length) return [];
  const path = normalizeLearningPath(pathData.learning_path, pathData.topic, pathData.resources);
  const reasonMap = new Map();
  path.forEach((stage, stageIndex) => {
    (stage.resources || []).forEach((resource) => {
      const key = `${resource.type || ""}::${resource.title || ""}`;
      const list = reasonMap.get(key) || [];
      list.push({
        stage: stage.stage || `阶段 ${stageIndex + 1}`,
        reason: resource.reason || "匹配当前阶段学习目标",
      });
      reasonMap.set(key, list);
    });
  });
  return pathData.resources.map((resource, index) => {
    const directKey = `${resource.type || ""}::${resource.title || ""}`;
    const byType = [...reasonMap.entries()]
      .filter(([key]) => key.startsWith(`${resource.type || ""}::`))
      .flatMap(([, value]) => value);
    const reasons = reasonMap.get(directKey) || byType;
    const text = resourcePlainText(resource.content || "");
    return {
      ...resource,
      index,
      label: resourceTypeLabel(resource.type),
      reasons: reasons.length ? reasons : [{
        stage: "综合推荐",
        reason: "与当前知识大类、画像偏好和已生成学习资源匹配",
      }],
      preview: text.replace(/\s+/g, " ").trim().slice(0, 150),
    };
  });
}

function renderPushResourceBody(resource) {
  if (!resource) return "";
  if (resource.type === "知识点思维导图") return renderMindmapResource(resource.content || "", resource.title);
  if (resource.type === "不同类型练习题目") return renderExerciseResource(resource.content || "", resource.title, resource.index);
  if (resource.type === "多模态教学视频/动画") return renderVideoResource(resource.content || "", resource.title, resource.index);
  if (resource.type === "代码类实操案例") return renderCodePracticeResource(resource.content || "");
  return renderResourceMarkdown(resource.content || "");
}

function openPushResourceDetail(resourceIndex) {
  const activeData = getActivePathData();
  const resource = collectPushedResources(activeData).find((item) => item.index === resourceIndex);
  if (!resource || !el.pushDetailModal) return;
  const meta = [
    resource.label || resource.type,
    resource.agent || "智能体推荐",
    activeData?.category ? `大类：${activeData.category}` : "",
  ].filter(Boolean);
  el.pushDetailType.textContent = resource.type || "学习资源";
  el.pushDetailTitle.textContent = resource.title || "资源详情";
  el.pushDetailMeta.innerHTML = `
    ${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    ${resource.reasons?.length ? `<div class="push-detail-reasons">${resource.reasons.slice(0, 3).map((reason) => `
      <p><strong>${escapeHtml(reason.stage)}</strong>${escapeHtml(reason.reason)}</p>
    `).join("")}</div>` : ""}
  `;
  el.pushDetailBody.innerHTML = renderPushResourceBody(resource);
  el.pushDetailModal.hidden = false;
  initMindmapCanvases(el.pushDetailBody);
}

function closePushResourceDetail() {
  if (!el.pushDetailModal) return;
  el.pushDetailModal.hidden = true;
  if (el.pushDetailBody) el.pushDetailBody.innerHTML = "";
}

function renderPushPage() {
  if (!el.pushGrid) return;
  const activeData = getActivePathData();
  if (!activeData?.resources?.length) {
    el.pushGrid.innerHTML = `
      ${renderPathCategoryTabs(state.activePathCategory)}
      <div class="resource-empty">还没有可推送资源。先去“资源”页生成一个主题，系统会按知识大类沉淀资源并在这里推送。</div>
    `;
    return;
  }
  const pushed = collectPushedResources(activeData);
  const grouped = pushed.reduce((acc, item) => {
    const key = item.label;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const groupOrder = ["文档", "视频", "题库", "实操", "导图", "阅读"];
  const groupEntries = Object.entries(grouped).sort(([a], [b]) => {
    const ia = groupOrder.indexOf(a);
    const ib = groupOrder.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  el.pushGrid.innerHTML = `
    ${renderPathCategoryTabs(activeData.category)}
    <section class="push-summary">
      <div>
        <div class="resource-type">当前推送大类</div>
        <h2>${escapeHtml(activeData.category || "当前大类")} · ${escapeHtml(activeData.topic || "学习资源")}</h2>
      </div>
      <div class="push-summary-stat">${pushed.length} 个资源 · ${groupEntries.length} 类内容</div>
    </section>
    ${groupEntries.map(([label, items]) => `
      <section class="push-group">
        <div class="push-group-head">
          <h3>${escapeHtml(label)}</h3>
          <span>${items.length} 个推荐</span>
        </div>
        <div class="push-card-grid">
          ${items.map((item) => `
            <article class="push-card" data-push-resource-index="${item.index}" tabindex="0" role="button" aria-label="打开 ${escapeHtml(item.title || "学习资源")}">
              <div class="push-card-head">
                <span>${escapeHtml(item.type || item.label)}</span>
                <b>${escapeHtml(item.agent || "智能体推荐")}</b>
              </div>
              <h4>${escapeHtml(item.title || "个性化资源")}</h4>
              <p>${escapeHtml(item.preview || "该资源已根据当前画像和路径阶段生成。")}</p>
              <div class="push-reason-list">
                ${item.reasons.slice(0, 3).map((reason) => `
                  <div><strong>${escapeHtml(reason.stage)}</strong>${escapeHtml(reason.reason)}</div>
                `).join("")}
              </div>
              <button class="push-open-btn" type="button" data-push-open-index="${item.index}">打开资源</button>
            </article>
          `).join("")}
        </div>
      </section>
    `).join("")}
  `;
}

function formatAssessmentTime(value) {
  if (!value) return "尚未生成";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isAssessmentMobileViewport() {
  return window.matchMedia?.("(max-width: 620px), (pointer: coarse)")?.matches || false;
}

function setAssessmentPullStatus(distance = 0, armed = false, refreshing = false) {
  if (!el.assessmentPullStatus) return;
  const visible = distance > 0 || refreshing;
  el.assessmentPullStatus.hidden = !visible;
  el.assessmentPullStatus.classList.toggle("armed", Boolean(armed));
  el.assessmentPullStatus.classList.toggle("refreshing", Boolean(refreshing));
  el.assessmentPullStatus.style.setProperty("--pull-distance", `${Math.min(72, Math.max(0, distance))}px`);
  el.assessmentPullStatus.textContent = refreshing
    ? "正在刷新评估..."
    : armed
      ? "松开刷新评估"
      : "下拉刷新评估";
}

function resetAssessmentPullStatus(delay = 0) {
  window.setTimeout(() => {
    state.assessmentPull = {
      active: false,
      startY: 0,
      distance: 0,
      armed: false,
    };
    setAssessmentPullStatus(0, false, false);
  }, delay);
}

function isAssessmentPageVisible() {
  return Boolean(el.assessmentPage && !el.assessmentPage.hidden);
}

function shouldAutoRefreshAssessmentAfterReload() {
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  return window.location.hash === "#assessment" && nav?.type === "reload";
}

function renderAssessmentList(title, items, className = "") {
  const list = normalizeAssessmentList(items);
  return `
    <section class="assessment-panel ${className}">
      <h3>${escapeHtml(title)}</h3>
      <ul>
        ${list.length
          ? list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
          : `<li>暂无足够证据，继续学习后可重新生成。</li>`}
      </ul>
    </section>
  `;
}

function renderAssessmentPage() {
  if (!el.assessmentGrid) return;
  updateAssessmentRefreshUi();
  const evidence = buildLearningEvidence();
  const assessment = state.learningAssessment || buildFallbackAssessment(evidence);
  const dimensions = normalizeDimensions(assessment.dimensions, []);
  const weakDimensions = dimensions.filter((item) => item.score < 70).slice(0, 3);
  const activeData = getActivePathData();
  const pathProgress = evidence.path_progress;
  const resourceUsage = evidence.resource_usage;
  const mistakeTotal = evidence.mistake_performance.total;
  if (state.assessmentGenerating) {
    el.assessmentGrid.innerHTML = `
      <section class="assessment-hero">
        <div>
          <div class="resource-type">大模型学习评估</div>
          <h2>正在分析学习行为与练习反馈...</h2>
          <p>系统正在整合画像、对话、资源使用、错题本和路径待办，生成下一轮动态优化建议。</p>
        </div>
        <div class="assessment-score-ring"><span>AI</span><small>分析中</small></div>
      </section>
    `;
    return;
  }
  el.assessmentGrid.innerHTML = `
    <section class="assessment-hero">
      <div>
        <div class="resource-type">综合学习效果</div>
        <h2>${escapeHtml(assessment.overall_level)}</h2>
        <p>${escapeHtml(assessment.summary)}</p>
        <div class="assessment-meta">
          <span>更新时间：${escapeHtml(formatAssessmentTime(assessment.generated_at))}</span>
          <span>当前大类：${escapeHtml(activeData?.category || state.activePathCategory || "待生成路径")}</span>
        </div>
      </div>
      <div class="assessment-score-ring" style="--score: ${clampScore(assessment.overall_score)}">
        <span>${clampScore(assessment.overall_score)}</span>
        <small>综合分</small>
      </div>
    </section>
    <section class="assessment-signal-grid">
      <article>
        <span>路径完成</span>
        <strong>${pathProgress.done}/${pathProgress.total}</strong>
        <em>${pathProgress.percent}%</em>
      </article>
      <article>
        <span>资源使用</span>
        <strong>${resourceUsage.total}</strong>
        <em>${evidence.resources.generated_count} 类资源</em>
      </article>
      <article>
        <span>练习反馈</span>
        <strong>${mistakeTotal}</strong>
        <em>错题/疑惑</em>
      </article>
      <article>
        <span>学习互动</span>
        <strong>${evidence.chat.user_question_count}</strong>
        <em>提问轮次</em>
      </article>
    </section>
    <section class="assessment-panel assessment-dimensions">
      <div class="assessment-panel-head">
        <h3>多维度评估</h3>
        <span>${dimensions.length} 个维度</span>
      </div>
      <div class="assessment-dimension-list">
        ${dimensions.map((item) => `
          <article class="assessment-dimension">
            <div class="assessment-dimension-head">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${item.score}</span>
            </div>
            <div class="assessment-bar"><div style="width: ${item.score}%"></div></div>
            <div class="assessment-level">${escapeHtml(item.level)}</div>
            <p>${escapeHtml(item.evidence)}</p>
            <em>${escapeHtml(item.action)}</em>
          </article>
        `).join("")}
      </div>
    </section>
    <div class="assessment-two-col">
      ${renderAssessmentList("优势信号", assessment.strengths, "assessment-good")}
      ${renderAssessmentList("风险与薄弱点", assessment.risks, "assessment-risk")}
    </div>
    <div class="assessment-two-col">
      ${renderAssessmentList("动态资源推送策略", assessment.resource_strategy)}
      ${renderAssessmentList("学习计划调整", assessment.plan_adjustments)}
    </div>
    ${renderAssessmentList("下一次检查点", assessment.next_checkpoints, "assessment-checkpoints")}
    ${weakDimensions.length ? `
      <section class="assessment-panel assessment-next-action">
        <h3>建议立即优化</h3>
        <p>${escapeHtml(weakDimensions.map((item) => `${item.name}：${item.action}`).join("；"))}</p>
        <button class="primary-btn" type="button" data-assessment-go-path>查看路径待办</button>
      </section>
    ` : ""}
  `;
}

function renderLearningResources() {
  if (!el.resourceGrid) return;
  renderAgentPipeline(state.resourcesGenerating ? "running" : state.learningResources ? "done" : "idle");
  renderLearningPathPanel();
  const selectedAgents = getSelectedResourceAgents();
  const flowText = state.selectedResourceAgents.length
    ? `当前将生成：${selectedAgents.map((agent) => agent.type).join("、")}`
    : "当前未选择具体 Agent，将默认走完整资源生成流程。";
  if (state.resourcesGenerating) {
    el.resourceGrid.innerHTML = `<div class="resource-empty">多智能体正在协作生成个性化学习资料...<br>${escapeHtml(flowText)}</div>`;
    return;
  }
  const data = state.learningResources;
  if (!data?.resources?.length) {
    el.resourceGrid.innerHTML = `<div class="resource-empty">填写课程内容或学习需求后，点击“生成资源”。系统会优先围绕你本次输入的主题生成资料，画像只用于调整难度和讲解风格。<br>${escapeHtml(flowText)}</div>`;
    return;
  }
  el.resourceGrid.innerHTML = data.resources.map((item, index) => {
    const rawText = resourcePlainText(item.content || "");
    const exercises = item.type === "不同类型练习题目" ? normalizeExerciseList(item.content || "", item.title) : [];
    const preview = item.type === "知识点思维导图"
      ? mindmapPreviewText(item.content || "", item.title)
      : item.type === "不同类型练习题目" && exercises.length
        ? `已生成 ${exercises.length} 道题，覆盖 ${[...new Set(exercises.map((exercise) => exercise.difficulty))].join("、")}；每题含来源、答案和详解，可加入错题本。`
        : item.type === "多模态教学视频/动画"
          ? renderVideoPreviewText(item.content || "", item.title)
        : rawText.replace(/\s+/g, " ").trim().slice(0, 170);
    const bodyHtml = item.type === "知识点思维导图"
      ? renderMindmapResource(item.content || "", item.title)
      : item.type === "不同类型练习题目"
        ? renderExerciseResource(item.content || "", item.title, index)
        : item.type === "多模态教学视频/动画"
          ? renderVideoResource(item.content || "", item.title, index)
        : item.type === "代码类实操案例"
          ? renderCodePracticeResource(item.content || "")
          : renderResourceMarkdown(item.content || "");
    return `
    <article class="resource-card ${item.type === "知识点思维导图" ? "mindmap-resource-card" : ""}">
      <div class="resource-card-head">
        <div>
          <div class="resource-type">${escapeHtml(item.type || "学习资源")}</div>
          <div class="resource-title">${escapeHtml(item.title || "个性化资源")}</div>
        </div>
        <div class="resource-agent">${escapeHtml((SELECTABLE_RESOURCE_AGENTS.find((agent) => agent.type === item.type)?.role || item.agent || "Agent").replace("课程讲解 Agent", "知识文档 Agent").replace("知识讲解 Agent", "知识文档 Agent"))}</div>
      </div>
      <div class="resource-preview">${escapeHtml(preview || "点击展开查看完整内容")}${item.type !== "多模态教学视频/动画" && rawText.length > 170 ? "..." : ""}</div>
      <div class="resource-body" hidden>${bodyHtml}</div>
      <button class="resource-toggle" type="button" data-resource-index="${index}" aria-expanded="false">展开全文</button>
      ${
        item.type === "专业课程讲解文档"
          ? `<button class="resource-toggle resource-download" type="button" data-resource-download-index="${index}">下载 Markdown</button>`
          : ""
      }
    </article>
  `;
  }).join("");
}

async function generateLearningResources() {
  if (state.resourcesGenerating) return;
  if (USE_BROWSER_API_KEY && !ensureApiKey("未配置 API Key，请先配置后再生成资源")) return;
  const demand = (el.resourcePromptInput?.value || "").trim();
  if (!demand) {
    alert("请先输入课程内容、知识点或学习需求");
    return;
  }
  const demandCategory = categorizeKnowledge(demand, demand);
  recordLearningDemand("resource", demand, { category: demandCategory, topic: demand });

  state.resourcesGenerating = true;
  renderLearningResources();
  const profile = state.studentProfile || createEmptyProfile();
  const selectedAgents = getSelectedResourceAgents();
  const resourceSchema = selectedAgents
    .map((agent) => agent.id === "video"
      ? `    {"type": "${agent.type}", "title": string, "agent": "${agent.role}", "content": {"provider": string, "video_url": string, "embed_url": string, "duration_seconds": number, "voice": string, "scenes": [{"title": string, "narration": string, "visual": string, "question": string}]}}`
      : `    {"type": "${agent.type}", "title": string, "agent": "${agent.role}", "content": string}`)
    .join(",\n");
  const selectedAgentRules = selectedAgents
    .map((agent) => `- ${agent.role}：必须生成 1 个“${agent.type}”。`)
    .join("\n");
  const system = `你是一个多智能体学习资源生成系统的总控 Agent。请模拟并整合多个角色智能体的协作结果，只输出合法 JSON，不要输出 Markdown 代码块。

必须体现这些智能体分工：
1. 需求分析师：解析本次输入的课程主题、知识短板和学习需求；只在相关时参考学生画像。
2. 知识文档 Agent：生成完整、可直接阅读的专业课程知识正文文档。
3. 思维导图 Agent：生成结构化知识图谱，不是普通列表。
4. 练习命题 Agent：生成系统化题组，包含经典题、中等题、难题和易错题，每题必须有答案详解与来源。
5. 阅读拓展 Agent：生成拓展阅读材料。
6. 多模态视频 Agent：生成可交给视频模型的导演级结构化 brief，并由系统交付可播放视频。禁止只输出分镜脚本正文。
7. 代码实操 Agent：生成代码类实操案例。
8. 审核整合 Agent：检查个性化程度和学习路径。

本次用户选择参与资源输出的 Agent：
${selectedAgentRules}
需求分析师和审核整合 Agent 始终参与编排与质量检查，但不需要在 resources 中单独输出资源卡。

输出 JSON 格式：
{
  "topic": string,
  "generated_at": string,
  "agents": [{"role": string, "contribution": string}],
  "path_basis": {
    "major_analysis": string,
    "progress_analysis": string,
    "mastery_analysis": string,
    "preference_analysis": string,
    "resource_strategy": string
  },
  "learning_path": [
    {
      "stage": string,
      "goal": string,
      "duration": string,
      "order_reason": string,
      "steps": [string],
      "todos": [{"label": string, "evidence": string}],
      "mastery": string,
      "resources": [{"type": string, "title": string, "reason": string}]
    }
  ],
  "resources": [
${resourceSchema}
  ]
}

resources 中只能包含本次用户选择的资源类型；如果用户没有选择 Agent，则生成完整 6 类资源。
path_basis 和 learning_path 是“学习路径规划 Agent”的核心产物，不能写成静态模板。
path_basis 必须先综合分析：
1. major_analysis：学生专业/年级/课程背景如何影响本主题学习切入点。
2. progress_analysis：结合当前对话轮次、资源生成状态、错题/练习线索推断学习进度；如果信息不足，要说明仍需通过哪些行为继续校准。
3. mastery_analysis：结合知识基础、易错点、题目表现或对话暴露的问题，判断已掌握、薄弱和待验证内容。
4. preference_analysis：结合认知风格、学习习惯、互动偏好，决定讲解、导图、视频、题库、实操的使用顺序。
5. resource_strategy：说明系统生成的个性化资源如何被分阶段推送，而不是简单罗列资源。
learning_path 必须基于 path_basis 和本次生成的 resources 规划科学、动态的学习步骤和顺序。必须包含 4-6 个阶段，每个阶段写清学习目标、建议时长、order_reason（为什么这个阶段排在这里）、steps（阶段说明）、todos（3-5 个可执行待办，每个待办有完成证据）、掌握证据，并在 resources 中精准推送本次已生成的文档、视频、题库、实操案例或拓展阅读；推荐理由必须绑定“该阶段目标 + 学生画像依据 + 具体资源标题”。如果学习进度或掌握情况信息不足，阶段中要安排诊断任务来动态修正后续路径。
如果 learningSignals.existing_category_path 存在，说明该知识大类已有学习路径。此时必须做“增量更新”：保留仍然有效的阶段和 Todo，针对本次新需求增删改查 Todo、调整顺序理由和资源推送；不要把同类路径完全清零重写。只有当本次主题明显换到新知识大类时，才生成新的大类路径。

content 可以使用 Markdown。数学表达式必须使用 Markdown 数学写法：行内公式用“美元符号包围的 LaTeX”，独立公式用“双美元符号包围的 LaTeX”；禁止裸写纯文本公式，例如 a 的 n 次幂、n 大于等于 1、上下文相关产生式箭头等，应写成 LaTeX 公式形式。除非是程序代码或文法产生式列表，不要把数学公式放进代码块。
最高优先级规则：用户本次输入的主题是资源生成的主主题。学生画像只能用于调整解释深度、难度、例子风格和练习梯度，不能把画像里的旧主题硬塞进资源标题或正文。除非用户本次明确提到，禁止把不相关的前端、Java、C++ 等旧画像内容混入“多模态”等新主题。
重要：专业课程讲解文档必须是“知识正文”，不是大纲，也不是“如何学习/如何讲解这个知识”的方法论。它必须像对话页直接回答用户问题一样，把用户指定主题本身讲清楚，并用 Markdown 组织为可阅读正文。任何主题都禁止输出“对象、规则、作用”“知识结构”“学习路径”“如何拆解一个知识点”这类通用方法论来冒充知识内容；如果不确定主题细节，也要基于主题本身给出具体概念、规则、例子和边界，不能转写成学习建议。正文控制在约 1300-1700 个中文字符，目标约 1500 字；不能少到只有提纲，也不要写成长篇论文。禁止出现“这份文档会先...”“学习这个主题时可以...”“一个合格的讲解文档应该...”这类元话术。
如果主题是编程语言基础，知识文档必须围绕语言知识点本身展开，必须包含：语法形式、执行流程、关键变量/下标/边界含义、至少 3 段可运行或接近可运行的代码示例、输出解释、常见异常或 bug、适用场景与易错点。
如果主题是编译原理、文法、1 型文法、上下文有关文法，知识文档必须讲：乔姆斯基层次、1 型文法定义、产生式形式 $\\alpha A \\beta \\to \\alpha \\gamma \\beta$、非收缩性质、$S \\to \\varepsilon$ 例外、与上下文无关文法区别、上下文有关语言、线性有界自动机、典型语言 $a^n b^n c^n$、判断文法类型的易错点。
如果主题是算法、数据结构或具体算法名（例如 Floyd、Dijkstra、动态规划、最短路），知识文档必须围绕该算法本身展开，必须包含：问题定义、输入输出、状态/变量含义、核心转移或关键步骤、正确性直觉、复杂度、手推例题、代码示例、易错点。禁止输出与该算法无关的多模态、前端或通用学习法内容。
思维导图必须有中心主题、5-7 个一级分支、每个分支 3 个具体二级节点，并给出一条复习路径。禁止输出“子节点：定义/应用/计算方法”这类空泛占位词；每个节点必须是具体知识点或题型，例如“等价无穷小替换”“洛必达法则适用条件”“定积分几何应用”。优先输出结构清晰的层级内容。
练习命题 Agent 的 content 必须输出 JSON 字符串，格式为：
{"questions":[{"type":"基础题/经典题/中等题/难题/易错题/迁移应用题","difficulty":"基础/中等/难题","knowledge":"对应知识点","source":"经典教材题型改编/课程常见题型/历年考试题型改编/面试常见题型改编等，不要编造具体书名页码","question":"题干","answer":"标准答案","explanation":"分步骤详解，说明为什么这样做、易错点和检查方法"}]}
题量不少于 8 道：至少 2 道基础题、2 道中等题、2 道难题、1 道易错题、1 道迁移应用题。每道题 explanation 至少 80 个中文字符，不能只有一句话。题目优先选择经典题型或课程常见题型改编，并在 source 字段标注来源类型。
阅读拓展 Agent 的 content 必须输出“可执行资源清单”，不能写泛泛介绍性短文。必须包含这些小节：
1. 教材/书：至少 2 本具体书名，尽量写作者，并说明先读哪些章节或主题。
2. 课程/视频：至少 1 个具体课程、公开视频、课程主页或视频合集，给出 URL；如果不确定具体视频链接，给课程主页或检索关键词。
3. 论文/报告/综述：如果输出论文，必须同时包含经典论文和 2022 年以来的近四年前沿论文。技术/前沿主题至少给 2 篇经典论文或综述、至少 3 篇 2022 年以来论文；写清题名、年份、URL/DOI/arXiv，并说明先读哪里。基础课程主题若不适合论文，可给经典教材章节代替，但不要伪造论文。
4. 官方文档/网站/数据集/工具：至少 2 个可点击 URL，例如官方文档、数据集官网、工具文档、在线可视化网站。
5. 检索关键词：给中文和英文关键词各 5 个以上。
禁止只写“应用广泛、未来重要、建议阅读相关资料、可查找相关论文”这类空话；每条资源都要说明“为什么看”和“先看哪里”。
链接纪律：严禁编造课程短链、DOI、arXiv 编号或官方文档路径。只有在你确定 URL 真实存在时才输出精确链接；不确定时，输出稳定官网首页、课程主页、论文标题加检索关键词，或 Google Scholar/arXiv/Papers with Code 的搜索建议。不要输出 John Doe、Jane Smith 这类占位作者。
多模态教学视频/动画的 content 必须输出结构化对象，不要输出 Markdown 字符串，更不要只给“分镜脚本”。它要服务真实视频生成模型，因此必须区分“画面 brief”和“字幕/旁白 brief”：
1. 本流程不会由模型直接调用外部视频服务；严禁编造 video_url、embed_url、digital_human_url 或任何外部 URL。默认 video_url 和 embed_url 必须为空字符串。
2. 如果系统已经提供真实视频生成 API 返回值，才允许填入可直接播放的 video_url，并保留 provider、duration_seconds、voice。
3. 如果系统已经提供真实数字人或第三方托管播放器返回值，才允许填入 embed_url 或 digital_human_url。
4. 默认情况下必须返回 scenes 数组，系统会把 scenes 交给真实视频生成 API。每个 scene 要包含 title、narration、visual、question。
5. visual 必须是“老师讲知识点”的课堂镜头指令，围绕授课动作写：老师引入概念、指向白板图示、手写符号、拆解例题、学生做笔记、老师提问。不要写宣传片镜头，不要写泛泛科技感画面，不要写要出现在画面中的文字。例如写“老师在白板上画三个无字圆圈并用箭头连接，解释不同学习通道如何互补”，不要写“屏幕显示‘多模态学习’”。
6. narration 是前端字幕/旁白文本，不会交给视频模型绘制；每段控制在 28-45 个中文字符，必须像老师在讲课，解释知识点本身，不要空泛鸡汤。
7. question 是可选互动提问，短而具体。
8. scenes 的结构建议按“问题引入、核心定义、板书/图示解释、具体例子、课堂提问、总结”组织；如果时长短，至少包含引入、定义、例子、总结。
scene 字段必须是干净短文本：title 不能写“要点 1/片段 2/分镜 3”这类占位标题；narration 不要包含 Markdown 标记、引号、列表编号或“旁白：/画面：”标签。
视频资源卡最终交付的是播放器和可下载视频，不是分镜文档；scenes 是给视频生成和字幕叠加使用的数据。
代码实操 Agent 的 content 必须输出“可运行实训卡”，不能只贴一段完整代码。必须包含这些小节：
1. 任务目标：说明要实现什么、练到什么能力。
2. 输入/输出样例：给可手算的小样例、期望输出或断言。
3. 代码骨架：包含 TODO，让学生先补全；如果给参考答案，要单独放在“参考实现”小节。
4. 运行命令：明确语言和命令，例如 g++ main.cpp -std=c++17 -O2 && ./a.out、python main.py、node main.js。
5. 测试用例：至少 3 个，覆盖基础、边界、易错场景。
6. 调试清单：列出常见 bug、应该打印哪些中间变量、如何判断哪里错。
7. 修改挑战：至少 2 个变式任务，例如改输入方式、增加边界处理、换一种算法或数据结构。
代码必须能独立运行，不能依赖不存在的文件；如果主题不是编程题，也要设计一个最小可运行实验或伪代码验证任务。`;

  const learningSignals = {
    progress_summary: buildLearningProgressSummary([]),
    current_demand_category: demandCategory,
    demand_trace: summarizeDemandEvents(demand),
    existing_category_path: state.learningPathLibrary?.[demandCategory]
      ? {
          topic: state.learningPathLibrary[demandCategory].topic,
          updated_at: state.learningPathLibrary[demandCategory].updatedAt,
          path_basis: state.learningPathLibrary[demandCategory].path_basis,
          learning_path: state.learningPathLibrary[demandCategory].learning_path,
        }
      : null,
    selected_resource_agents: selectedAgents.map((agent) => ({
      type: agent.type,
      role: agent.role,
      task: agent.task,
    })),
    message_count: state.messages.length,
    mistake_count: Array.isArray(state.mistakeBookItems) ? state.mistakeBookItems.length : 0,
    mistake_topics: Array.isArray(state.mistakeBookItems)
      ? [...new Set(state.mistakeBookItems.map((item) => item.knowledge || item.category || item.source).filter(Boolean))].slice(0, 8)
      : [],
  };

  const user = `本次资源生成主题，必须优先围绕它展开：
${demand}

学生画像（仅用于调节难度、风格和个性化提示；如果与本次主题无关，请忽略，不要混入资源内容）：
${JSON.stringify(profile, null, 2)}

学习动态信号（用于 path_basis 与 learning_path，不要原样抄写，要综合判断）：
${JSON.stringify(learningSignals, null, 2)}

请生成围绕“${demand}”的多智能体协作学习资源，并把“个性化学习路径”作为系统生成资源后的动态规划产物输出。`;

  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: buildChatHeaders(),
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        stream: false,
        temperature: 0.45,
      }),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => "资源生成失败"));
    const data = await res.json().catch(() => null);
    const text = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJsonObject(text);
    if (!parsed?.resources?.length) throw new Error("模型未返回有效资源 JSON");
    const normalized = normalizeGeneratedResources(parsed, demand);
    saveLearningResources(normalized);
    recordLearningBehavior("resource_generated", {
      category: normalized.category,
      topic: normalized.topic,
      title: demand,
      meta: { resourceCount: normalized.resources.length },
    });
  } catch (e) {
    console.error(e);
    el.resourceGrid.innerHTML = `<div class="resource-empty">资源生成失败：${escapeHtml(String(e?.message || e))}</div>`;
  } finally {
    state.resourcesGenerating = false;
    renderLearningResources();
  }
}

function profileIconSvg(icon) {
  const attrs = 'viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"';
  const paths = {
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />',
    target: '<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" />',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" />',
    spark: '<path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2Z" />',
    clock: '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />',
    alert: '<path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />',
    chat: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />',
  };
  return `<svg ${attrs}>${paths[icon] || paths.book}</svg>`;
}

function confidenceClass(confidence) {
  if (confidence === "确定") return "sure";
  if (confidence === "推测") return "guess";
  return "missing";
}

function profileScore(item) {
  if (!item || !item.value) return 18;
  const value = String(item.value || "").trim();
  const evidence = String(item.evidence || "").trim();
  const facts = value
    .split(/[;；。,.，、\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const distinctFacts = Math.min(Math.max(facts.length, 1), 5);
  const confidenceBase = item.confidence === "确定" ? 34 : item.confidence === "推测" ? 24 : 12;
  const richness = Math.min(value.length, 90) * 0.28 + Math.min(evidence.length, 80) * 0.16;
  const coverage = distinctFacts * 8;
  const score = Math.round(confidenceBase + richness + coverage);
  return Math.max(18, Math.min(score, 88));
}

function radarPoint(cx, cy, radius, index, total, score = 100) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  const scaled = radius * (score / 100);
  return {
    x: cx + Math.cos(angle) * scaled,
    y: cy + Math.sin(angle) * scaled,
  };
}

function radarPolygon(points) {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function renderProfileVisual(profile) {
  if (!el.profileVisual) return;
  const cx = 160;
  const cy = 145;
  const radius = 94;
  const levels = [0.25, 0.5, 0.75, 1];
  const fieldData = PROFILE_FIELDS.map((key) => {
    const meta = PROFILE_FIELD_META[key];
    const item = profile[key] || {};
    const score = profileScore(item);
    return { key, meta, item, score };
  });
  const total = fieldData.length;
  const average = Math.round(fieldData.reduce((sum, item) => sum + item.score, 0) / total);
  const sureCount = fieldData.filter((item) => item.item.confidence === "确定").length;
  const pendingCount = fieldData.filter((item) => !item.item.value).length;
  const areaPoints = fieldData.map((item, index) =>
    radarPoint(cx, cy, radius, index, total, item.score)
  );
  const grid = levels.map((level) => {
    const points = fieldData.map((_, index) => radarPoint(cx, cy, radius * level, index, total));
    return `<polygon class="radar-grid" points="${radarPolygon(points)}" />`;
  }).join("");
  const axes = fieldData.map((_, index) => {
    const end = radarPoint(cx, cy, radius, index, total);
    return `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}" />`;
  }).join("");
  const labels = fieldData.map((item, index) => {
    const point = radarPoint(cx, cy, radius + 25, index, total);
    return `<text class="radar-label" x="${point.x.toFixed(1)}" y="${point.y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${escapeHtml(item.meta.title)}</text>`;
  }).join("");
  const dots = areaPoints.map((point) =>
    `<circle class="radar-dot" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4" />`
  ).join("");
  const rows = fieldData.map((item) => `
    <div class="profile-score-row">
      <div class="profile-score-name">${escapeHtml(item.meta.title)}</div>
      <div class="profile-score-track" aria-hidden="true">
        <div class="profile-score-fill" style="width: ${item.score}%"></div>
      </div>
      <div class="profile-score-num">${item.score}</div>
    </div>
  `).join("");

  el.profileVisual.innerHTML = `
    <section class="profile-radar-panel" aria-label="学习画像雷达图">
      <div class="profile-panel-title">画像清晰度雷达</div>
      <div class="profile-panel-subtitle">根据每个维度已收集的信息数量、证据和可信度生成，不代表能力水平。</div>
      <svg class="profile-radar" viewBox="0 0 320 270" role="img" aria-label="学习画像八维雷达图">
        ${grid}
        ${axes}
        <polygon class="radar-area" points="${radarPolygon(areaPoints)}" />
        ${dots}
        ${labels}
      </svg>
      <div class="profile-summary">
        <div class="profile-summary-item">
          <div class="profile-summary-value">${average}</div>
          <div class="profile-summary-label">综合清晰度</div>
        </div>
        <div class="profile-summary-item">
          <div class="profile-summary-value">${sureCount}</div>
          <div class="profile-summary-label">确定维度</div>
        </div>
        <div class="profile-summary-item">
          <div class="profile-summary-value">${pendingCount}</div>
          <div class="profile-summary-label">待补充维度</div>
        </div>
      </div>
    </section>
    <section class="profile-score-panel" aria-label="画像维度评分">
      <div class="profile-panel-title">维度覆盖度</div>
      <div class="profile-panel-subtitle">分数越高，代表该维度已收集到更多不同信息点。</div>
      <div class="profile-score-list">${rows}</div>
    </section>
  `;
}

function renderStudentProfile() {
  if (!el.profileGrid) return;
  const profile = state.studentProfile || createEmptyProfile();
  renderProfileVisual(profile);
  const cards = PROFILE_FIELDS.map((key) => {
    const meta = PROFILE_FIELD_META[key];
    const item = profile[key] || {};
    const confidence = item.confidence || "待补充";
    const value = item.value || "还没有足够信息";
    const evidence = item.evidence || "继续对话后，我会从你的表达中补充这一项。";
    return `
      <article class="profile-card">
        <div class="profile-card-head">
          <div class="profile-card-title">${escapeHtml(meta.title)}</div>
          <div class="profile-card-icon" aria-hidden="true">${profileIconSvg(meta.icon)}</div>
        </div>
        <div class="profile-chip ${confidenceClass(confidence)}">${escapeHtml(confidence)}</div>
        <div class="profile-value ${item.value ? "" : "empty"}">${escapeHtml(value)}</div>
        <div class="profile-evidence">${escapeHtml(evidence)}</div>
      </article>
    `;
  }).join("");
  el.profileGrid.innerHTML = cards;
  if (el.profileMeta) {
    const reason = profile.last_updated_reason || "画像会根据对话持续更新";
    const status = state.profileUpdating ? "正在根据最新对话更新画像..." : reason;
    el.profileMeta.textContent = status;
  }
}

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
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  if (el.home) el.home.hidden = false;
  el.chatPageBtn?.classList.add("active");
  el.profilePageBtn?.classList.remove("active");
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
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  el.profilePage.hidden = false;
  el.profilePageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  el.pushPageBtn?.classList.remove("active");
  el.pathPageBtn?.classList.remove("active");
  el.assessmentPageBtn?.classList.remove("active");
  el.storagePageBtn?.classList.remove("active");
  el.mistakePageBtn?.classList.remove("active");
  setPageHash("#profile");
  renderStudentProfile();
}

function showResourcePage() {
  if (!el.resourcePage) return;
  setComposerVisible(false);
  if (el.home) el.home.hidden = true;
  if (el.chat) el.chat.hidden = true;
  if (el.profilePage) el.profilePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  el.resourcePage.hidden = false;
  el.resourcePageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
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
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  el.pushPage.hidden = false;
  el.pushPageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
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
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  el.pathPage.hidden = false;
  el.pathPageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
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
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  el.assessmentPage.hidden = false;
  el.assessmentPageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
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
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.mistakePage) el.mistakePage.hidden = true;
  el.storagePage.hidden = false;
  el.storagePageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
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
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.pushPage) el.pushPage.hidden = true;
  if (el.pathPage) el.pathPage.hidden = true;
  if (el.assessmentPage) el.assessmentPage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  el.mistakePage.hidden = false;
  el.mistakePageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
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

function startIfNeededFromCard(promptText) {
  if (!promptText) return;
  if (state.isGenerating) return;
  if (!ensureApiKey("未配置 API Key，请打开 setup.html 保存到本地（键名：LINGXI_API_KEY）"))
    return;
  el.input.value = "";
  adjustTextareaHeight();
  resetAttachment();
  ensureChatVisible();
  void generateAssistantFromUserText(promptText, []);
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

  el.profilePageBtn?.addEventListener("click", showProfilePage);
  el.chatPageBtn?.addEventListener("click", showChatPage);
  el.resourcePageBtn?.addEventListener("click", showResourcePage);
  el.pushPageBtn?.addEventListener("click", showPushPage);
  el.pushGenerateResourcesBtn?.addEventListener("click", showResourcePage);
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
  el.profileBackBtn?.addEventListener("click", showChatPage);
  window.addEventListener("hashchange", restoreViewFromHash);

  
  document.querySelectorAll(".suggest-card[data-prompt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prompt = btn.getAttribute("data-prompt");
      startIfNeededFromCard(prompt);
    });
  });

  
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

function init() {
  if (window.Prism?.plugins?.autoloader) {
    Prism.plugins.autoloader.languages_path =
      "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/";
  }
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
  initTheme();
  initApiKeyModal();
  initEventHandlers();
  initImageLightbox();
  restorePersistedChat();
  restoreViewFromHash();
  initComposer();
  initCopyDelegation();
  if (shouldAutoRefreshAssessmentAfterReload() && !isAssessmentMobileViewport()) {
    window.setTimeout(() => {
      if (isAssessmentPageVisible()) void refreshLearningAssessment("desktop_browser_reload");
    }, 250);
  }
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
