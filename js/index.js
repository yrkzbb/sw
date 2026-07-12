
const API_KEY_STORAGE = "LINGXI_API_KEY";
const THEME_STORAGE = "LINGXI_THEME";
const MESSAGES_STORAGE = "LINGXI_MESSAGES";
const STUDENT_PROFILE_STORAGE = "LINGXI_STUDENT_PROFILE";
const LEARNING_RESOURCES_STORAGE = "LINGXI_LEARNING_RESOURCES";
const STORED_MARKDOWN_FILES_STORAGE = "LINGXI_STORED_MARKDOWN_FILES";


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
  { id: "analysis", role: "需求分析师", task: "优先解析本次主题，只在相关时参考学习画像。", selectable: false },
  { id: "doc", type: "专业课程讲解文档", role: "知识文档 Agent", task: "生成完整、可直接阅读的知识正文文档。", selectable: true },
  { id: "mindmap", type: "知识点思维导图", role: "思维导图 Agent", task: "组织知识点结构和关联路径。", selectable: true },
  { id: "quiz", type: "不同类型练习题目", role: "练习命题 Agent", task: "设计基础、进阶、易错和应用题。", selectable: true },
  { id: "reading", type: "拓展阅读材料", role: "阅读拓展 Agent", task: "提供拓展阅读材料和检索关键词。", selectable: true },
  { id: "video", type: "多模态教学视频/动画", role: "多模态脚本 Agent", task: "设计教学视频或动画分镜脚本。", selectable: true },
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
  storagePage: document.querySelector("#storagePage"),
  chatPageBtn: document.querySelector("#chatPageBtn"),
  profilePageBtn: document.querySelector("#profilePageBtn"),
  resourcePageBtn: document.querySelector("#resourcePageBtn"),
  storagePageBtn: document.querySelector("#storagePageBtn"),
  profileBackBtn: document.querySelector("#profileBackBtn"),
  profileVisual: document.querySelector("#profileVisual"),
  profileGrid: document.querySelector("#profileGrid"),
  profileMeta: document.querySelector("#profileMeta"),
  resourcePromptInput: document.querySelector("#resourcePromptInput"),
  generateResourcesBtn: document.querySelector("#generateResourcesBtn"),
  agentPipeline: document.querySelector("#agentPipeline"),
  resourceGrid: document.querySelector("#resourceGrid"),
  storageGrid: document.querySelector("#storageGrid"),
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
  storedMarkdownFiles: [],
  resourcesGenerating: false,
  selectedResourceAgents: [],
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
    }
  } catch (e) {
    console.warn("保存学习资源失败", e);
  }
  renderLearningResources();
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
        category: categorizeKnowledge(`${item.title || ""} ${item.filename || ""}`, item.content || ""),
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
  }
  renderStoragePage();
}

function categorizeKnowledge(title, content) {
  const titleText = `${title || ""}`.toLowerCase();
  const contentText = `${content || ""}`.toLowerCase();
  const strongTitleRules = [
    ["编译原理", /编译原理|文法|语法分析|词法分析|乔姆斯基|chomsky|type-?1|1型|一型|上下文有关|context.?sensitive/],
    ["数据结构", /floyd|弗洛伊德|dijkstra|最短路|图论|动态规划|dp|算法|数据结构|链表|栈|队列|树|堆|排序|查找|并查集/],
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
    ["数据结构", /floyd|弗洛伊德|dijkstra|最短路|图论|动态规划|dp|算法|数据结构|链表|栈|队列|树|堆|排序|查找|并查集/],
    ["前端", /前端|html|css|javascript|typescript|react|vue|浏览器|dom|页面/],
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

function downloadMarkdownFile(file) {
  const blob = new Blob([file.content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        <div class="storage-count">${items.length} 个文件</div>
      </div>
      <div class="storage-file-list">
        ${items.map((file) => `
          <article class="storage-file-card">
            <div>
              <div class="storage-file-title">${escapeHtml(file.title)}</div>
              <div class="storage-file-meta">${escapeHtml(file.filename)} · ${escapeHtml(new Date(file.createdAt).toLocaleString())}</div>
            </div>
            <button class="resource-toggle storage-download-btn" type="button" data-storage-id="${escapeHtml(file.id)}">下载</button>
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

function resourcePlainText(markdown) {
  if (typeof markdown === "string") return markdown;
  if (Array.isArray(markdown)) {
    return markdown.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("\n");
  }
  if (markdown && typeof markdown === "object") return JSON.stringify(markdown);
  return "";
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

\`\`\`text
G = (V_N, V_T, P, S)
\`\`\`

其中 \(V_N\) 是非终结符集合，\(V_T\) 是终结符集合，\(P\) 是产生式集合，\(S\) 是开始符号。1 型文法对产生式有严格限制：产生式一般形如

\`\`\`text
α A β -> α γ β
\`\`\`

这里 \(A\) 是非终结符，\(α\)、\(β\) 是上下文，\(γ\) 是非空符号串。含义是：只有当 \(A\) 出现在左上下文 \(α\) 和右上下文 \(β\) 之间时，才允许把 \(A\) 改写成 \(γ\)。这就是“上下文有关”的来源。

## 2. 非收缩性质
1 型文法常用一个等价限制来判断：产生式右部长度不能小于左部长度，即

\`\`\`text
|右部| >= |左部|
\`\`\`

所以它也常被称为**非收缩文法**。例如：

\`\`\`text
AB -> aBC
A  -> aA
\`\`\`

这些产生式不会让句型长度变短。相反，下面这种产生式通常不符合 1 型文法：

\`\`\`text
AB -> a
\`\`\`

因为左部长度是 2，右部长度是 1，发生了收缩。唯一常见例外是开始符号推出空串 \(S -> ε\)，但一般要求 \(S\) 不出现在任何产生式右部。

## 3. 与 0、2、3 型文法的区别
乔姆斯基层次可以粗略理解为：

\`\`\`text
3 型文法 ⊂ 2 型文法 ⊂ 1 型文法 ⊂ 0 型文法
\`\`\`

3 型文法对应正则语言，通常能被有限自动机识别。2 型文法对应上下文无关语言，常用于描述程序语言中的括号匹配、表达式嵌套等结构。1 型文法比 2 型更强，因为它能表达“多个部分数量相等”这类需要跨区域约束的语言。0 型文法最强，对产生式限制最少，对应图灵机可识别语言。

一个典型例子是：

\`\`\`text
L = { a^n b^n c^n | n >= 1 }
\`\`\`

这个语言要求 a、b、c 的数量三者相等。上下文无关文法可以方便地处理 \(a^n b^n\)，但同时约束三段数量相等就超出了 2 型文法的能力范围；1 型文法可以通过上下文相关的改写规则表达这种约束。

## 4. 产生式直觉
1 型文法的关键不是“随便替换一个符号”，而是“在指定上下文中替换一个符号”。例如：

\`\`\`text
a B c -> a b c
\`\`\`

这条规则表示：只有当 \(B\) 左边是 \(a\)、右边是 \(c\) 时，才可以把 \(B\) 改成 \(b\)。如果句型中只有 \(d B c\)，就不能使用这条规则。这个限制让文法可以表达更精细的依赖关系。

在编译原理中，很多程序语言的核心语法可以用上下文无关文法描述，比如表达式、语句块、函数调用等。但有些约束不是纯 CFG 能自然表达的，例如“变量使用前必须声明”“函数调用参数个数与声明一致”“某些标识符类型必须匹配”。这些约束往往体现了上下文依赖。实际编译器通常不会直接用 1 型文法完整描述它们，而是把 CFG 用于语法分析，再用语义分析、符号表和类型检查处理这些上下文约束。

## 5. 与线性有界自动机的关系
1 型文法生成的语言称为**上下文有关语言**。它与线性有界自动机（Linear Bounded Automaton, LBA）等价：一个语言是上下文有关语言，当且仅当它能被某个线性有界自动机识别。所谓线性有界，是指自动机可使用的工作带长度受输入长度的线性函数限制。

这个结论说明 1 型文法的能力很强，但仍然受到空间限制。它比有限自动机、下推自动机强，也比不受限制的图灵机弱。

## 6. 常见判断方法
判断一个文法是不是 1 型文法，重点看产生式：

1. 左部不能只有终结符，通常必须包含至少一个非终结符。
2. 右部长度不能小于左部长度。
3. 如果出现 \(S -> ε\)，要检查开始符号 \(S\) 是否出现在任何产生式右部。
4. 如果产生式体现 \(αAβ -> αγβ\)，要能说明 \(A\) 的改写依赖左右上下文。

例如：

\`\`\`text
S -> aSBC
S -> abc
CB -> BC
bB -> bb
bC -> bc
cC -> cc
\`\`\`

这类规则常用于构造 \(a^n b^n c^n\) 一类语言。它的思想是先生成数量相关的符号，再通过交换和替换规则把非终结符逐步整理成终结符串。

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
  if (isGrammarDemand(topic)) return buildTypeOneGrammarDocument(demand, title);
  if (isAlgorithmDemand(topic)) {
    const isFloyd = /floyd|弗洛伊德|多源最短路|全源最短路|全点对最短/i.test(topic);
    const name = isFloyd ? "Floyd 算法" : topic;
    const formula = isFloyd
      ? "dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])"
      : "把大问题拆成可复用的状态，并用状态转移式描述“当前答案如何由更小规模答案得到”。";
    const scenario = isFloyd
      ? "已知一个带权图中若干顶点之间的直接距离，要求任意两个顶点之间的最短距离。例如城市交通网中每条路有通行时间，系统要快速回答任意城市 A 到城市 B 的最短耗时。"
      : "面对一个有明确输入、输出和约束的问题，需要设计一套可重复执行的步骤，使程序能在有限时间内得到正确答案。";
    const code = isFloyd
      ? `const INF = Number.POSITIVE_INFINITY;
const dist = graph.map(row => row.slice());

for (let k = 0; k < n; k++) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (dist[i][k] + dist[k][j] < dist[i][j]) {
        dist[i][j] = dist[i][k] + dist[k][j];
      }
    }
  }
}`
      : `function solve(input) {
  // 1. 明确状态或关键变量
  // 2. 写出状态转移或核心操作
  // 3. 按正确顺序遍历并输出答案
}`;
    return `# ${name}详解

## 1. 问题定义
${name}是一类围绕“${topic}”的算法知识。算法的核心不在于背名称，而在于明确它处理的输入、要得到的输出、关键变量的含义，以及每一步更新为什么保持正确。

## 2. 核心问题
${name}要解决的问题可以先放进一个具体场景中理解：${scenario} 算法的目标不是随便找一条路径或一个可行答案，而是在所有可能方案中找到满足条件的最优结果。对 ${name} 来说，理解“问题边界”尤其关键：哪些信息一开始已知，哪些信息需要通过迭代不断变得更优。

## 3. 状态含义与转移思想
${isFloyd ? "Floyd 的核心状态是 `dist[i][j]`，表示当前已知的从顶点 `i` 到顶点 `j` 的最短距离。初始化时，如果 `i` 和 `j` 有直接边，就填边权；如果没有直接边，就填无穷大；自己到自己通常填 0。" : "算法题通常需要先定义状态或关键变量。状态不是随便起名的变量，而是对“当前阶段已经求出的答案”的精确描述。"}

关键转移可以写成：

\`\`\`text
${formula}
\`\`\`

${isFloyd ? "这个式子的意思是：当允许经过中间点 `k` 时，从 `i` 到 `j` 的最短路，要么保持原来的 `dist[i][j]`，要么变成 `i -> k -> j` 这条新路线。如果后者更短，就更新答案。三层循环中的 `k` 放在最外层非常重要，因为它表示“当前允许使用的中转点范围”正在逐步扩大。" : "这个式子背后的思想是：不要一次性枚举所有可能，而是把新答案建立在旧答案之上。每一步更新都应该能解释清楚“为什么不会漏掉正确答案”。"}

## 4. 例题拆解
假设有 4 个点 A、B、C、D。A 到 B 为 3，B 到 C 为 2，A 到 C 为 10。开始时，A 到 C 的已知距离是 10。但当算法检查 B 作为中转点时，会发现 A 到 B 再到 C 的距离是 3 + 2 = 5，比原来的 10 更短，于是把 A 到 C 更新为 5。这个过程展示了 ${name} 的本质：不断尝试“是否通过某个中转点能让答案更好”。

## 5. 代码实现
\`\`\`js
${code}
\`\`\`

写代码时要注意初始化矩阵，尤其是无边时的无穷大、自己到自己的 0，以及输入中可能存在重边时要保留更小边权。循环顺序也不能随意调整，特别是 Floyd 中必须先枚举中转点 \`k\`，再枚举起点和终点。

## 6. 复杂度与适用场景
${isFloyd ? "Floyd 的时间复杂度是 O(n^3)，空间复杂度通常是 O(n^2)。它适合顶点数不太大、但需要查询任意两点最短路的场景。如果只求单源最短路，通常会考虑 Dijkstra 或 Bellman-Ford；如果图非常大，Floyd 往往会超时。" : "分析算法时要同时看时间复杂度和空间复杂度。时间复杂度回答“要做多少步”，空间复杂度回答“要额外存多少数据”。选择算法时，必须结合数据范围。"}

## 7. 常见误区与易错点
- 把 ${name} 当成背诵模板，不理解状态含义，导致换个题面就不会做。
- 初始化错误：无边没有设为无穷大，自己到自己没有设为 0，或重边没有取最小值。
- 循环顺序错误：尤其是 Floyd 中把 \`k\` 放到内层，会破坏“逐步允许中转点”的含义。
- 忽略数据范围：顶点数过大时仍然使用 O(n^3) 算法，容易超时。

## 8. 小结
掌握 ${name} 的关键，是把“状态表示”和“转移公式”讲清楚。你可以用一句话记住：${isFloyd ? "Floyd 通过逐步放开可用中转点，更新任意两点之间的最短距离。" : "算法通过清晰的状态定义和有依据的转移步骤，把复杂问题拆成可执行的程序过程。"} 学完后建议自己手推一个 3 到 4 个点的小图，再写代码验证结果，这样比只看公式更稳。`;
  }

  return `# ${title || topic || "知识文档"}

## 1. 核心定义
“${topic}”需要先从对象、规则和作用三个层面理解。对象指这个知识点处理的实体或问题范围；规则指它内部必须遵守的定义、公式、步骤或限制；作用指它在课程、题目或项目中能解决的具体问题。

## 2. 知识结构
这个知识点通常包含三个组成部分：基础概念、运行机制和应用边界。基础概念回答“它是什么”，运行机制回答“它如何工作”，应用边界回答“什么时候能用、什么时候不能用”。理解这三部分后，才能把知识从名词记忆转成可迁移的判断能力。

## 3. 具体示例
一个知识点可以被拆成如下信息结构：

1. 先找出它要解决的核心问题。
2. 再列出它涉及的关键对象、输入信息和输出结果。
3. 最后通过一个具体场景观察它如何发挥作用。

\`\`\`text
主题：${topic}
输入：学习材料、题目条件或项目需求中给出的已知信息
过程：识别关键概念，套用规则或方法，检查限制条件
输出：答案、方案、解释、代码结果或可复用的学习结论
\`\`\`

这个结构不是学习建议，而是知识本身的组成方式：任何可使用的知识点，都必须能说明它接收什么条件、执行什么规则、产出什么结果。

## 4. 常见误区与易错点
- 只背概念，不做例子：知道定义但不会应用，通常说明缺少场景化练习。
- 只看答案，不复盘过程：建议每道题都写出“我卡在哪里、为什么卡住、下次如何判断”。
- 概念之间迁移混乱：相邻概念名字相似，但适用场景、输入输出和评价标准不同，不能机械照搬。
- 缺少可观察案例：每学一个知识点，都应该配一个能观察现象、修改条件、对比结果的小案例。

## 5. 小结
围绕“${topic}”学习时，请用“概念解释 -> 示例拆解 -> 易错复盘 -> 迁移练习”的顺序推进。等你能用自己的话说清楚它解决什么问题、关键步骤是什么、常见错误在哪里，就说明你已经开始具备迁移应用能力。`;
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
    const demandText = subjectText.toLowerCase();
    const genericMultimodalLeak = !/多模态|multimodal/.test(demandText) && /图片、文字、音频|不同模态|图像内容、文本描述|多模态/.test(contentText);
    const metaNarration = /这份文档会先|这份文档围绕|学习这个主题时|一个合格的讲解文档|可以按下面的方式拆解一个新主题|不是课程目录|讲解型学习材料/.test(contentText);
    const algorithmMissingCore = isAlgorithmDemand(subjectText) && !/状态|转移|复杂度|代码|例题|示例/.test(contentText);
    const grammarMissingCore = isGrammarDemand(subjectText) && !/上下文有关|非收缩|乔姆斯基|线性有界|产生式/.test(contentText);
    const tooShort = contentText.length < 1200 || !/常见误区|易错|例题|示例|小结|性质|定义/.test(contentText) || genericMultimodalLeak || metaNarration || algorithmMissingCore || grammarMissingCore;
    if (tooShort) {
      doc.content = buildFallbackKnowledgeDocument(subjectText.trim(), doc.title);
    }
  }
  return { ...data, resources };
}

function renderLearningResources() {
  if (!el.resourceGrid) return;
  renderAgentPipeline(state.resourcesGenerating ? "running" : state.learningResources ? "done" : "idle");
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
    const preview = rawText.replace(/\s+/g, " ").trim().slice(0, 170);
    return `
    <article class="resource-card">
      <div class="resource-card-head">
        <div>
          <div class="resource-type">${escapeHtml(item.type || "学习资源")}</div>
          <div class="resource-title">${escapeHtml(item.title || "个性化资源")}</div>
        </div>
        <div class="resource-agent">${escapeHtml((SELECTABLE_RESOURCE_AGENTS.find((agent) => agent.type === item.type)?.role || item.agent || "Agent").replace("课程讲解 Agent", "知识文档 Agent").replace("知识讲解 Agent", "知识文档 Agent"))}</div>
      </div>
      <div class="resource-preview">${escapeHtml(preview || "点击展开查看完整内容")}${rawText.length > 170 ? "..." : ""}</div>
      <div class="resource-body" hidden>${renderResourceMarkdown(item.content || "")}</div>
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

  state.resourcesGenerating = true;
  renderLearningResources();
  const profile = state.studentProfile || createEmptyProfile();
  const selectedAgents = getSelectedResourceAgents();
  const resourceSchema = selectedAgents
    .map((agent) => `    {"type": "${agent.type}", "title": string, "agent": "${agent.role}", "content": string}`)
    .join(",\n");
  const selectedAgentRules = selectedAgents
    .map((agent) => `- ${agent.role}：必须生成 1 个“${agent.type}”。`)
    .join("\n");
  const system = `你是一个多智能体学习资源生成系统的总控 Agent。请模拟并整合多个角色智能体的协作结果，只输出合法 JSON，不要输出 Markdown 代码块。

必须体现这些智能体分工：
1. 需求分析师：解析本次输入的课程主题、知识短板和学习需求；只在相关时参考学生画像。
2. 知识文档 Agent：生成完整、可直接阅读的专业课程知识正文文档。
3. 思维导图 Agent：生成知识点思维导图。
4. 练习命题 Agent：生成不同类型练习题。
5. 阅读拓展 Agent：生成拓展阅读材料。
6. 多模态脚本 Agent：生成教学视频/动画脚本。
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
  "resources": [
${resourceSchema}
  ]
}

resources 中只能包含本次用户选择的资源类型；如果用户没有选择 Agent，则生成完整 6 类资源。

content 可以使用 Markdown。
最高优先级规则：用户本次输入的主题是资源生成的主主题。学生画像只能用于调整解释深度、难度、例子风格和练习梯度，不能把画像里的旧主题硬塞进资源标题或正文。除非用户本次明确提到，禁止把不相关的前端、Java、C++ 等旧画像内容混入“多模态”等新主题。
重要：专业课程讲解文档必须是“知识正文”，不是大纲，也不是“如何学习/如何讲解这个知识”的方法论。它必须直接讲用户指定知识点本身：定义、背景、规则/公式/结构、工作机制、例子、性质、应用边界、易错点、小结。正文控制在约 1300-1700 个中文字符，目标约 1500 字；不能少到只有提纲，也不要写成长篇论文。禁止出现“这份文档会先...”“学习这个主题时可以...”“一个合格的讲解文档应该...”这类元话术。
如果主题是编译原理、文法、1 型文法、上下文有关文法，知识文档必须讲：乔姆斯基层次、1 型文法定义、产生式形式 αAβ -> αγβ、非收缩性质、S -> ε 例外、与上下文无关文法区别、上下文有关语言、线性有界自动机、典型语言 a^n b^n c^n、判断文法类型的易错点。
如果主题是算法、数据结构或具体算法名（例如 Floyd、Dijkstra、动态规划、最短路），知识文档必须围绕该算法本身展开，必须包含：问题定义、输入输出、状态/变量含义、核心转移或关键步骤、正确性直觉、复杂度、手推例题、代码示例、易错点。禁止输出与该算法无关的多模态、前端或通用学习法内容。
练习题必须包含基础题、易错题、迁移应用题；思维导图可用 Mermaid mindmap 或层级列表；视频/动画要包含分镜、旁白、画面元素和互动提问；代码案例要包含任务说明、代码骨架或完整示例、运行/调试提示。`;

  const user = `本次资源生成主题，必须优先围绕它展开：
${demand}

学生画像（仅用于调节难度、风格和个性化提示；如果与本次主题无关，请忽略，不要混入资源内容）：
${JSON.stringify(profile, null, 2)}

请生成围绕“${demand}”的多智能体协作学习资源。`;

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
    saveLearningResources(normalizeGeneratedResources(parsed, demand));
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
  if (el.storagePage) el.storagePage.hidden = true;
  el.home.hidden = true;
  el.chat.hidden = false;
  el.chatPageBtn?.classList.add("active");
  el.profilePageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  el.storagePageBtn?.classList.remove("active");
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
  if (el.storagePage) el.storagePage.hidden = true;
  if (el.home) el.home.hidden = false;
  el.chatPageBtn?.classList.add("active");
  el.profilePageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  el.storagePageBtn?.classList.remove("active");
  setPageHash("");
}

function showProfilePage() {
  if (!el.profilePage) return;
  if (el.home) el.home.hidden = true;
  if (el.chat) el.chat.hidden = true;
  if (el.resourcePage) el.resourcePage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  el.profilePage.hidden = false;
  el.profilePageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  el.storagePageBtn?.classList.remove("active");
  setPageHash("#profile");
  renderStudentProfile();
}

function showResourcePage() {
  if (!el.resourcePage) return;
  if (el.home) el.home.hidden = true;
  if (el.chat) el.chat.hidden = true;
  if (el.profilePage) el.profilePage.hidden = true;
  if (el.storagePage) el.storagePage.hidden = true;
  el.resourcePage.hidden = false;
  el.resourcePageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
  el.storagePageBtn?.classList.remove("active");
  setPageHash("#resources");
  renderLearningResources();
}

function showStoragePage() {
  if (!el.storagePage) return;
  if (el.home) el.home.hidden = true;
  if (el.chat) el.chat.hidden = true;
  if (el.profilePage) el.profilePage.hidden = true;
  if (el.resourcePage) el.resourcePage.hidden = true;
  el.storagePage.hidden = false;
  el.storagePageBtn?.classList.add("active");
  el.chatPageBtn?.classList.remove("active");
  el.profilePageBtn?.classList.remove("active");
  el.resourcePageBtn?.classList.remove("active");
  setPageHash("#storage");
  renderStoragePage();
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
  } else if (window.location.hash === "#storage") {
    showStoragePage();
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
  el.storagePageBtn?.addEventListener("click", showStoragePage);
  el.generateResourcesBtn?.addEventListener("click", () => void generateLearningResources());
  el.agentPipeline?.addEventListener("click", (e) => {
    const btn = e.target instanceof HTMLElement ? e.target.closest("[data-agent-id]") : null;
    const id = btn?.getAttribute("data-agent-id");
    if (id) toggleResourceAgent(id);
  });
  el.resourceGrid?.addEventListener("click", (e) => {
    const downloadBtn = e.target instanceof HTMLElement ? e.target.closest("[data-resource-download-index]") : null;
    if (downloadBtn) {
      const index = Number(downloadBtn.getAttribute("data-resource-download-index"));
      if (Number.isInteger(index)) storeAndDownloadResource(index);
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
  });
  el.storageGrid?.addEventListener("click", (e) => {
    const btn = e.target instanceof HTMLElement ? e.target.closest("[data-storage-id]") : null;
    const id = btn?.getAttribute("data-storage-id");
    const file = state.storedMarkdownFiles.find((item) => item.id === id);
    if (file) downloadMarkdownFile(file);
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
  state.learningResources = loadLearningResources();
  state.storedMarkdownFiles = loadStoredMarkdownFiles();
  renderStudentProfile();
  renderLearningResources();
  renderStoragePage();
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
