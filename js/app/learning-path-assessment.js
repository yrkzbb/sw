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
    el.generateAssessmentBtn.textContent = state.assessmentGenerating ? "刷新中..." : "刷新复盘";
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
    ? "正在刷新复盘..."
    : armed
      ? "松开刷新复盘"
      : "下拉刷新复盘";
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
          ? list.map((item) => `<li>${escapeHtml(studentFriendlyAssessmentText(item))}</li>`).join("")
          : `<li>暂无足够线索，继续学习后可重新生成。</li>`}
      </ul>
    </section>
  `;
}

function studentFriendlyAssessmentText(text) {
  return String(text || "")
    .replace(/急需/g, "建议")
    .replace(/立即/g, "可以先")
    .replace(/建议学生进行/g, "可以先")
    .replace(/建议学生/g, "可以")
    .replace(/建议你进行/g, "可以先")
    .replace(/建议你/g, "可以")
    .replace(/建议进行/g, "可以先")
    .replace(/没有任何/g, "还没有")
    .replace(/未进行任何/g, "还没有开始")
    .replace(/极低/g, "刚起步")
    .replace(/不足/g, "还不够完整")
    .replace(/缺乏/g, "还缺少")
    .replace(/干预/g, "调整")
    .replace(/风险/g, "提醒")
    .replace(/薄弱/g, "待补")
    .replace(/学生/g, "你")
    .replace(/动机评估/g, "确认这轮为什么学、要学到哪一步")
    .replace(/知识评估/g, "起步检测")
    .replace(/诊断测试/g, "一两道起步题")
    .replace(/诊断题/g, "起步题")
    .replace(/学习效果/g, "学习情况")
    .replace(/评估/g, "复盘")
    .replace(/证据不足/g, "线索还不够")
    .replace(/证据/g, "线索")
    .replace(/用户/g, "你")
    .trim();
}

function assessmentTone(score) {
  const n = clampScore(score);
  if (n >= 80) {
    return {
      label: "节奏很好",
      title: "这轮学习已经比较稳了",
      summary: "你已经积累了不少有效线索，可以继续做迁移练习，把知识用到更真实的任务里。",
      mood: "steady",
    };
  }
  if (n >= 60) {
    return {
      label: "正在变稳",
      title: "你已经进入学习状态了",
      summary: "现在最有价值的是把已学内容通过练习和复盘固定下来，再根据错题调整下一轮资源。",
      mood: "growing",
    };
  }
  if (n >= 35) {
    return {
      label: "线索还不够",
      title: "先把下一步做小一点",
      summary: "当前不是学得不好，而是复盘还缺少足够的练习、路径完成和资料使用线索。先完成一两个小任务，复盘会更准。",
      mood: "warming",
    };
  }
  return {
    label: "刚刚开始",
    title: "我们先建立学习起点",
    summary: "现在适合先做诊断题、打开一份核心资料，并把不确定的题放进错题本，系统会据此继续调整计划。",
    mood: "start",
  };
}

function firstAssessmentItems(...groups) {
  return groups.flatMap((group) => normalizeAssessmentList(group)).filter(Boolean);
}

function renderStudentActionItems(items, fallback) {
  const list = firstAssessmentItems(items).slice(0, 4);
  const finalList = list.length ? list : fallback;
  return finalList.map((item, index) => `
    <li>
      <span>${index + 1}</span>
      <p>${escapeHtml(studentFriendlyAssessmentText(item))}</p>
    </li>
  `).join("");
}

function renderStudentEvidenceItems(evidence) {
  const items = [
    {
      label: "路径进度",
      value: `${evidence.path_progress.done}/${evidence.path_progress.total || 0}`,
      note: evidence.path_progress.total ? `已完成 ${evidence.path_progress.percent}%` : "生成资源后会出现待办",
    },
    {
      label: "资料使用",
      value: `${evidence.resource_usage.total}`,
      note: `${evidence.resources.generated_count} 类资料可用`,
    },
    {
      label: "错题复盘",
      value: `${evidence.mistake_performance.total}`,
      note: "越具体，建议越准",
    },
    {
      label: "学习提问",
      value: `${evidence.chat.user_question_count}`,
      note: "记录你的真实需求",
    },
  ];
  return items.map((item) => `
    <article>
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <em>${escapeHtml(item.note)}</em>
    </article>
  `).join("");
}

function studentDimensionName(name) {
  return String(name || "")
    .replace("学习投入", "提问与投入")
    .replace("路径执行", "计划推进")
    .replace("资源利用", "资料使用")
    .replace("练习反馈", "练习复盘")
    .replace("知识掌握", "掌握线索")
    .replace("动态优化", "计划调整");
}

function renderStudentDimensionCards(dimensions) {
  return dimensions.map((item) => `
    <article class="assessment-dimension">
      <div class="assessment-dimension-head">
        <strong>${escapeHtml(studentDimensionName(item.name))}</strong>
        <span>${item.score >= 70 ? "不错" : item.score >= 45 ? "补一点" : "先起步"}</span>
      </div>
      <div class="assessment-bar" aria-hidden="true"><div style="width: ${item.score}%"></div></div>
      <p>${escapeHtml(studentFriendlyAssessmentText(item.evidence))}</p>
      <em>${escapeHtml(studentFriendlyAssessmentText(item.action))}</em>
    </article>
  `).join("");
}

function renderAssessmentPage() {
  if (!el.assessmentGrid) return;
  updateAssessmentRefreshUi();
  const evidence = buildLearningEvidence();
  const assessment = state.learningAssessment || buildFallbackAssessment(evidence);
  const dimensions = normalizeDimensions(assessment.dimensions, []);
  const weakDimensions = dimensions.filter((item) => item.score < 70).slice(0, 3);
  const activeData = getActivePathData();
  const tone = assessmentTone(assessment.overall_score);
  const firstActions = firstAssessmentItems(
    assessment.plan_adjustments,
    assessment.resource_strategy,
    weakDimensions.map((item) => item.action)
  ).slice(0, 3);
  if (state.assessmentGenerating) {
    el.assessmentGrid.innerHTML = `
      <section class="assessment-hero">
        <div>
          <div class="resource-type">学习复盘</div>
          <h2>正在整理你的学习线索...</h2>
          <p>我在把最近的提问、练习、资料使用和路径待办整理成更清楚的下一步建议。</p>
        </div>
        <div class="assessment-pulse" aria-hidden="true"><span></span><span></span><span></span></div>
      </section>
    `;
    return;
  }
  el.assessmentGrid.innerHTML = `
    <section class="assessment-hero assessment-student-hero ${tone.mood}">
      <div>
        <div class="resource-type">这轮复盘</div>
        <h2>${escapeHtml(tone.title)}</h2>
        <p>${escapeHtml(tone.summary)}</p>
        <div class="assessment-meta">
          <span>更新时间：${escapeHtml(formatAssessmentTime(assessment.generated_at))}</span>
          <span>当前大类：${escapeHtml(activeData?.category || state.activePathCategory || "待生成路径")}</span>
        </div>
      </div>
      <div class="assessment-student-status">
        <span>${escapeHtml(tone.label)}</span>
        <strong>${clampScore(assessment.overall_score)}%</strong>
        <em>复盘线索完整度</em>
      </div>
    </section>
    <section class="assessment-focus-card">
      <div>
        <span>建议先做</span>
        <h3>${escapeHtml(studentFriendlyAssessmentText(firstActions[0] || "先完成当前路径里的一个小待办，再回来刷新复盘。"))}</h3>
        <p>${escapeHtml(tone.summary)}</p>
      </div>
      <button class="primary-btn" type="button" data-assessment-go-path>去看学习路径</button>
    </section>
    <section class="assessment-signal-grid">
      ${renderStudentEvidenceItems(evidence)}
    </section>
    <section class="assessment-panel assessment-dimensions">
      <div class="assessment-panel-head">
        <h3>为什么会这样建议</h3>
        <span>${dimensions.length} 个线索</span>
      </div>
      <div class="assessment-dimension-list">
        ${renderStudentDimensionCards(dimensions)}
      </div>
    </section>
    <div class="assessment-two-col">
      ${renderAssessmentList("已经做得不错的地方", assessment.strengths, "assessment-good")}
      ${renderAssessmentList("接下来先补一点", assessment.risks, "assessment-risk")}
    </div>
    <div class="assessment-two-col">
      ${renderAssessmentList("资源会怎么推给你", assessment.resource_strategy)}
      ${renderAssessmentList("学习计划怎么调整", assessment.plan_adjustments)}
    </div>
    ${renderAssessmentList("下次刷新前可以检查", assessment.next_checkpoints, "assessment-checkpoints")}
    ${weakDimensions.length ? `
      <section class="assessment-panel assessment-next-action">
        <h3>别急，先做最小一步</h3>
        <p>${escapeHtml(studentFriendlyAssessmentText(weakDimensions.map((item) => `${studentDimensionName(item.name)}：${item.action}`).join("；")))}</p>
        <button class="primary-btn" type="button" data-assessment-go-path>查看路径待办</button>
      </section>
    ` : ""}
  `;
}

