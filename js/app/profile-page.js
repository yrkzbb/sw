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

const PROFILE_DEMO_ANSWERS = [
  {
    id: "rag-eval",
    title: "如何设计一个企业内部 RAG 知识库的评测体系？",
    summary: "我会把评测拆成检索质量、生成质量、事实一致性、权限安全和业务可用性五个层面，并分别设置离线评测与真实用户反馈指标。",
    extra: "离线侧建议保留黄金问答集、难例集和权限边界样本；线上侧记录无答案率、追问率、人工纠错率和引用点击率。评测不只看答案像不像，还要看它是否能被业务团队稳定信任。",
    model: "GPT-5",
    status: "已采纳",
    statusClass: "",
    likes: 128,
    comments: 24,
    collections: 61,
    time: "2 小时前",
    topics: ["RAG", "企业知识库", "模型评测"],
  },
  {
    id: "prompt-product",
    title: "产品经理如何写出可复用的 Prompt 模板？",
    summary: "好的 Prompt 模板应该包含角色、输入结构、约束、输出格式、质量标准和反例，重点是让团队成员能稳定复用，而不是只在一次对话里得到好答案。",
    extra: "我通常把模板拆成任务定义、上下文槽位、检查清单和输出 schema 四层。团队使用时只改变量，不改推理框架，这样更容易沉淀成工作流资产。",
    model: "Claude",
    status: "高赞",
    statusClass: "",
    likes: 96,
    comments: 18,
    collections: 44,
    time: "昨天",
    topics: ["Prompt Engineering", "产品设计", "AI 产品"],
  },
  {
    id: "ai-coding-review",
    title: "AI Coding 生成的代码应该怎么做人工审查？",
    summary: "建议先审边界条件、权限与数据流，再审可维护性和测试覆盖。AI 代码不要只看能不能跑，还要看是否符合项目已有约定。",
    extra: "审查清单可以固定为：输入校验、错误处理、异步状态、依赖边界、日志与隐私、测试缺口。对于关键路径，必须补一条能失败的测试。",
    model: "Gemini",
    status: "待完善",
    statusClass: "needs",
    likes: 42,
    comments: 9,
    collections: 17,
    time: "3 天前",
    topics: ["AI 编程", "代码审查", "工程实践"],
  },
];

function ensurePersonalProfileAnswers() {
  if (!Array.isArray(state.personalProfileAnswers) || state.personalProfileAnswers.length === 0) {
    state.personalProfileAnswers = PROFILE_DEMO_ANSWERS.map((item) => ({
      ...item,
      liked: false,
      collected: item.id === "rag-eval",
      expanded: false,
    }));
  }
  return state.personalProfileAnswers;
}

function renderPersonalProfileChrome() {
  const profile = accountProfileFor();
  const userName = state.activeUser?.name || "yrk";
  const handle = `@${normalizeUsername(userName) || "yrk"}`;
  const bio = profile.bio && profile.bio !== "个人学习空间"
    ? profile.bio
    : "关注 AI 产品设计、大模型应用与知识工作流，擅长把复杂问题拆成可执行方案。";
  const avatarText = profile.avatarInitial || String(userName || "YR").slice(0, 2).toUpperCase();
  const avatarGradient = accountAccentGradient(profile.accent);
  if (el.personalProfileName) el.personalProfileName.textContent = userName;
  if (el.personalProfileHandle) el.personalProfileHandle.textContent = handle;
  if (el.personalProfileBio) el.personalProfileBio.textContent = bio;
  [el.profileHeroAvatar, el.profileEditShortcut].forEach((node) => {
    if (!node) return;
    node.textContent = avatarText;
    node.style.background = avatarGradient;
  });
}

function contributionValues() {
  return [2, 4, 1, 5, 3, 6, 4, 7, 3, 2, 6, 9, 4, 5, 8, 6, 4, 7, 10, 5, 3, 6, 8, 7, 5, 9, 6, 4, 8, 11];
}

function renderProfileTrendChart() {
  if (!el.profileTrendChart) return;
  const values = contributionValues();
  const max = Math.max(...values);
  el.profileTrendChart.innerHTML = values.map((value, index) => {
    const height = Math.max(16, Math.round((value / max) * 82));
    const day = index + 1;
    const accepted = Math.max(0, Math.round(value * 0.32));
    return `<span class="trend-bar" style="height:${height}px" data-tip="7月${day}日：${value} 次贡献，${accepted} 次采纳"></span>`;
  }).join("");
}

function profileEmptyState(title, text, action = "") {
  return `
    <div class="profile-empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text)}</span>
      ${action ? `<button class="profile-follow-button" type="button">${escapeHtml(action)}</button>` : ""}
    </div>
  `;
}

function answerCardTemplate(answer) {
  const topics = answer.topics.map((topic) => `<span>${escapeHtml(topic)}</span>`).join("");
  return `
    <article class="answer-card ${answer.expanded ? "expanded" : ""}" data-answer-id="${escapeHtml(answer.id)}">
      <h3>${escapeHtml(answer.title)}</h3>
      <p>${escapeHtml(answer.summary)}</p>
      <p class="answer-extra">${escapeHtml(answer.extra)}</p>
      <div class="answer-meta-row">
        <span class="answer-model">${escapeHtml(answer.model)}</span>
        <span class="answer-status ${answer.statusClass}">${escapeHtml(answer.status)}</span>
        <div class="answer-topic-tags">${topics}</div>
      </div>
      <div class="answer-card-foot">
        <span>${answer.likes} 赞 · ${answer.comments} 评论 · ${answer.collections} 收藏 · ${escapeHtml(answer.time)}</span>
        <div class="answer-actions">
          <button class="answer-action ${answer.liked ? "active" : ""}" type="button" data-answer-action="like">${answer.liked ? "已赞" : "点赞"}</button>
          <button class="answer-action ${answer.collected ? "active" : ""}" type="button" data-answer-action="collect">${answer.collected ? "已收藏" : "收藏"}</button>
          <button class="answer-action" type="button" data-answer-action="expand">${answer.expanded ? "收起摘要" : "展开摘要"}</button>
          <button class="answer-action" type="button">查看详情</button>
        </div>
      </div>
    </article>
  `;
}

function filteredProfileAnswers() {
  const answers = ensurePersonalProfileAnswers();
  const filter = state.personalProfileFilter;
  if (!filter) return answers;
  return answers.filter((answer) => answer.topics.some((topic) => topic.includes(filter) || filter.includes(topic)));
}

function renderProfileContentPanel() {
  if (!el.profileContentPanel) return;
  const tab = state.personalProfileTab;
  if (el.profileTabs) {
    el.profileTabs.querySelectorAll("[data-profile-tab]").forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-profile-tab") === tab);
      button.setAttribute("aria-selected", String(button.getAttribute("data-profile-tab") === tab));
    });
  }
  if (el.profileFilterNotice) {
    el.profileFilterNotice.hidden = !state.personalProfileFilter;
    el.profileFilterNotice.textContent = state.personalProfileFilter
      ? `正在筛选：${state.personalProfileFilter}。再次点击同一标签可取消筛选。`
      : "";
  }
  if (tab === "answers") {
    const answers = filteredProfileAnswers();
    el.profileContentPanel.innerHTML = answers.length
      ? answers.map(answerCardTemplate).join("")
      : profileEmptyState("还没有匹配的回答", "换一个标签，或去回答第一个相关问题。", "去回答问题");
    return;
  }
  const panels = {
    questions: [
      ["企业内部知识库如何定义“可信回答”？", "RAG · 质量评估 · 12 个回答"],
      ["AI 产品需求评审中哪些部分最适合交给模型先做？", "AI 产品 · 工作流 · 8 个回答"],
    ],
    collections: [
      ["企业知识库权限设计清单", "已收藏 · 昨天"],
      ["Claude 与 GPT-5 长上下文对比", "已收藏 · 3 天前"],
    ],
    notes: [
      ["RAG 评测框架：从检索命中到业务可用", "专栏 · 2,418 阅读"],
      ["Prompt 模板如何进入团队工作流", "笔记 · 928 阅读"],
    ],
    modelUsage: [
      ["GPT-5", "本周 46 次 · 偏复杂推理与代码审查"],
      ["Claude", "本周 21 次 · 偏产品分析与长文总结"],
      ["本地模型", "本周 8 次 · 偏隐私数据草稿"],
    ],
    prompts: [
      ["产品需求拆解模板", "目标、用户、场景、约束、验收标准"],
      ["代码审查清单模板", "边界条件、状态流、测试缺口、风险等级"],
      ["RAG 评测框架模板", "检索、生成、事实性、权限、业务反馈"],
    ],
  };
  const rows = panels[tab] || [];
  el.profileContentPanel.innerHTML = rows.length
    ? rows.map(([title, meta]) => `
      <article class="answer-card">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(meta)}</p>
      </article>
    `).join("")
    : profileEmptyState("这里还没有内容", "内容产生后会自动展示在这个列表里。");
}

function renderPersonalProfilePage() {
  renderPersonalProfileChrome();
  renderProfileTrendChart();
  renderProfileContentPanel();
}

function toggleProfileFilter(filter) {
  state.personalProfileFilter = state.personalProfileFilter === filter ? "" : filter;
  document.querySelectorAll("[data-profile-filter]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-profile-filter") === state.personalProfileFilter);
  });
  state.personalProfileTab = "answers";
  renderProfileContentPanel();
}

function handleProfileAnswerAction(button) {
  const card = button.closest("[data-answer-id]");
  const action = button.getAttribute("data-answer-action");
  if (!card || !action) return;
  const answer = ensurePersonalProfileAnswers().find((item) => item.id === card.getAttribute("data-answer-id"));
  if (!answer) return;
  if (action === "like") {
    answer.liked = !answer.liked;
    answer.likes += answer.liked ? 1 : -1;
  } else if (action === "collect") {
    answer.collected = !answer.collected;
    answer.collections += answer.collected ? 1 : -1;
  } else if (action === "expand") {
    answer.expanded = !answer.expanded;
  }
  renderProfileContentPanel();
}

