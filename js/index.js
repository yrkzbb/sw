
const API_KEY_STORAGE = "LINGXI_API_KEY";
const THEME_STORAGE = "LINGXI_THEME";
const MESSAGES_STORAGE = "LINGXI_MESSAGES";
const STUDENT_PROFILE_STORAGE = "LINGXI_STUDENT_PROFILE";
const LEARNING_RESOURCES_STORAGE = "LINGXI_LEARNING_RESOURCES";


const CHAT_ENDPOINT = "/api/chat";
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
  { role: "画像分析师", task: "读取学生画像，识别专业、课程、短板和学习目标。" },
  { role: "课程讲解 Agent", task: "生成个性化课程讲解文档。" },
  { role: "思维导图 Agent", task: "组织知识点结构和关联路径。" },
  { role: "练习命题 Agent", task: "设计基础、进阶、易错和应用题。" },
  { role: "阅读拓展 Agent", task: "提供拓展阅读材料和检索关键词。" },
  { role: "多模态脚本 Agent", task: "设计教学视频或动画分镜脚本。" },
  { role: "代码实操 Agent", task: "生成可运行实操案例和调试任务。" },
  { role: "审核整合 Agent", task: "统一难度、补齐多模态资源并输出学习路径。" },
];

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
  chatPageBtn: document.querySelector("#chatPageBtn"),
  profilePageBtn: document.querySelector("#profilePageBtn"),
  resourcePageBtn: document.querySelector("#resourcePageBtn"),
  profileBackBtn: document.querySelector("#profileBackBtn"),
  profileVisual: document.querySelector("#profileVisual"),
  profileGrid: document.querySelector("#profileGrid"),
  profileMeta: document.querySelector("#profileMeta"),
  resourcePromptInput: document.querySelector("#resourcePromptInput"),
  generateResourcesBtn: document.querySelector("#generateResourcesBtn"),
  agentPipeline: document.querySelector("#agentPipeline"),
  resourceGrid: document.querySelector("#resourceGrid"),
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
  resourcesGenerating: false,
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
    return data;
  } catch {
    return null;
  }
}

function saveLearningResources(data) {
  state.learningResources = data && Array.isArray(data.resources) ? data : null;
  try {
    if (state.learningResources) {
      localStorage.setItem(LEARNING_RESOURCES_STORAGE, JSON.stringify(state.learningResources));
    }
  } catch (e) {
    console.warn("保存学习资源失败", e);
  }
  renderLearningResources();
}

function renderAgentPipeline(status = "idle") {
  if (!el.agentPipeline) return;
  el.agentPipeline.innerHTML = RESOURCE_AGENTS.map((agent, index) => {
    const running = status === "running" && index < RESOURCE_AGENTS.length - 1;
    const done = status === "done" || (status === "running" && index < 3);
    const cls = done ? "done" : running ? "running" : "";
    return `
      <article class="agent-card ${cls}">
        <div class="agent-role"><span class="agent-dot" aria-hidden="true"></span>${escapeHtml(agent.role)}</div>
        <div class="agent-task">${escapeHtml(agent.task)}</div>
      </article>
    `;
  }).join("");
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

function renderLearningResources() {
  if (!el.resourceGrid) return;
  renderAgentPipeline(state.resourcesGenerating ? "running" : state.learningResources ? "done" : "idle");
  if (state.resourcesGenerating) {
    el.resourceGrid.innerHTML = `<div class="resource-empty">多智能体正在协作生成个性化学习资料...</div>`;
    return;
  }
  const data = state.learningResources;
  if (!data?.resources?.length) {
    el.resourceGrid.innerHTML = `<div class="resource-empty">填写课程内容或学习需求后，点击“生成资源”。系统会结合当前学习画像生成至少 5 类个性化资料。</div>`;
    return;
  }
  el.resourceGrid.innerHTML = data.resources.map((item) => `
    <article class="resource-card">
      <div class="resource-card-head">
        <div>
          <div class="resource-type">${escapeHtml(item.type || "学习资源")}</div>
          <div class="resource-title">${escapeHtml(item.title || "个性化资源")}</div>
        </div>
        <div class="resource-agent">${escapeHtml(item.agent || "Agent")}</div>
      </div>
      <div class="resource-body">${renderResourceMarkdown(item.content || "")}</div>
    </article>
  `).join("");
}

async function generateLearningResources() {
  if (state.resourcesGenerating) return;
  if (USE_BROWSER_API_KEY && !ensureApiKey("未配置 API Key，请先配置后再生成资源")) return;
  const demand = (el.resourcePromptInput?.value || "").trim();
  if (!demand) {
    alert("请先输入课程内容、知识点或学习需求");
    return;
  }

  state.resourcesGenerating = true;
  renderLearningResources();
  const profile = state.studentProfile || createEmptyProfile();
  const system = `你是一个多智能体学习资源生成系统的总控 Agent。请模拟并整合多个角色智能体的协作结果，只输出合法 JSON，不要输出 Markdown 代码块。

必须体现这些智能体分工：
1. 画像分析师：解析学生专业、课程内容、知识短板和学习需求。
2. 课程讲解 Agent：生成专业课程讲解文档。
3. 思维导图 Agent：生成知识点思维导图。
4. 练习命题 Agent：生成不同类型练习题。
5. 阅读拓展 Agent：生成拓展阅读材料。
6. 多模态脚本 Agent：生成教学视频/动画脚本。
7. 代码实操 Agent：生成代码类实操案例。
8. 审核整合 Agent：检查个性化程度和学习路径。

输出 JSON 格式：
{
  "topic": string,
  "generated_at": string,
  "agents": [{"role": string, "contribution": string}],
  "resources": [
    {"type": "专业课程讲解文档", "title": string, "agent": "课程讲解 Agent", "content": string},
    {"type": "知识点思维导图", "title": string, "agent": "思维导图 Agent", "content": string},
    {"type": "不同类型练习题目", "title": string, "agent": "练习命题 Agent", "content": string},
    {"type": "拓展阅读材料", "title": string, "agent": "阅读拓展 Agent", "content": string},
    {"type": "多模态教学视频/动画", "title": string, "agent": "多模态脚本 Agent", "content": string},
    {"type": "代码类实操案例", "title": string, "agent": "代码实操 Agent", "content": string}
  ]
}

content 可以使用 Markdown；练习题必须包含基础题、易错题、迁移应用题；思维导图可用 Mermaid mindmap 或层级列表；视频/动画要包含分镜、旁白、画面元素和互动提问；代码案例要包含任务说明、代码骨架或完整示例、运行/调试提示。`;

  const user = `学生画像：
${JSON.stringify(profile, null, 2)}

学生提供的课程内容 / 知识短板 / 学习需求：
${demand}

请生成面向该学生的多智能体协作学习资源。`;

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
    saveLearningResources(parsed);
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
      "请基于该画像回答学生当前问题；本轮不要输出内部更新 JSON，除非学生明确要求查看画像。",
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
    container.innerHTML = md.parse(markdownText || "");
  } catch (e) {
    console.error(e);
    container.textContent = markdownText || "";
    return;
  }
  if (window.Prism && typeof window.Prism.highlightAllUnder === "function") {
    window.Prism.highlightAllUnder(container);
  }
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

function ensureChatVisible() {
  if (!el.chat || !el.home) return;
  if (el.profilePage) el.profilePage.hidden = true;
  if (el.resourcePage) el.resourcePage.hidden = true;
  el.home.hidden = true;
  el.chat.hidden = false;
  el.chatPageBtn?.classList.add("active");
  el.profilePageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
}

function setPageHash(hash) {
  if (window.location.hash === hash) return;
  window.history.replaceState(null, "", hash || `${window.location.pathname}${window.location.search}`);
}

function showHome() {
  state.messages = [];
  try {
    localStorage.removeItem(MESSAGES_STORAGE);
  } catch {
  }
  el.messages.innerHTML = "";
  if (el.chat) el.chat.hidden = true;
  if (el.profilePage) el.profilePage.hidden = true;
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.home) el.home.hidden = false;
  el.chatPageBtn?.classList.add("active");
  el.profilePageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  setPageHash("");
}

function showProfilePage() {
  if (!el.profilePage) return;
  if (el.home) el.home.hidden = true;
  if (el.chat) el.chat.hidden = true;
  if (el.resourcePage) el.resourcePage.hidden = true;
  el.profilePage.hidden = false;
  el.profilePageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  setPageHash("#profile");
  renderStudentProfile();
}

function showResourcePage() {
  if (!el.resourcePage) return;
  if (el.home) el.home.hidden = true;
  if (el.chat) el.chat.hidden = true;
  if (el.profilePage) el.profilePage.hidden = true;
  el.resourcePage.hidden = false;
  el.resourcePageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
  setPageHash("#resources");
  renderLearningResources();
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
  el.generateResourcesBtn?.addEventListener("click", () => void generateLearningResources());
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
  state.learningResources = loadLearningResources();
  renderStudentProfile();
  renderLearningResources();
  initTheme();
  initApiKeyModal();
  initEventHandlers();
  initImageLightbox();
  restorePersistedChat();
  restoreViewFromHash();
  initComposer();
  initCopyDelegation();
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
