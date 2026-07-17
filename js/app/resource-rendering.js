function renderLearningResources() {
  if (!state.pptThemes.length && !state.pptThemesLoading) void loadPptThemes();
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
    el.resourceGrid.innerHTML = `<div class="resource-empty">填写课程内容或学习需求后，点击“生成资源”。<br>${escapeHtml(flowText)}</div>`;
    return;
  }
  const visibleResources = data.resources.filter((item) => item.type !== "多模态教学视频/动画");
  if (!visibleResources.length) {
    el.resourceGrid.innerHTML = "";
    return;
  }
  el.resourceGrid.innerHTML = visibleResources.map((item, index) => {
    const completed = typeof isResourceCompleted === "function" && isResourceCompleted(item);
    const rawText = resourcePlainText(item.content || "");
    const isExerciseResource = item.type === "不同类型练习题目";
    const titleExercises = isExerciseResource ? normalizeExerciseList(item.title || "", data.topic || "") : [];
    const titleContainsQuestions = titleExercises.length > 0;
    const displayTitle = titleContainsQuestions
      ? `${String(data.topic || "课程").replace(/\s+/g, " ").trim().slice(0, 28)}练习题`
      : (item.title || "个性化资源");
    const contentExercises = isExerciseResource ? normalizeExerciseList(item.content || "", displayTitle) : [];
    const contentIsPolluted = isPollutedExerciseList(contentExercises);
    const exercises = titleExercises.length && (contentIsPolluted || !contentExercises.length)
      ? titleExercises
      : contentExercises;
    const exerciseSource = titleExercises.length && (contentIsPolluted || !contentExercises.length)
      ? item.title
      : item.content;
    const preview = item.type === "知识点思维导图"
      ? mindmapPreviewText(item.content || "", item.title)
      : isExerciseResource && exercises.length
        ? `已生成 ${exercises.length} 道题，覆盖 ${[...new Set(exercises.map((exercise) => exercise.difficulty))].join("、")}；每题含来源、答案和详解，可加入错题本。`
        : item.type === "多模态教学视频/动画"
          ? renderVideoPreviewText(item.content || "", item.title)
        : rawText.replace(/\s+/g, " ").trim().slice(0, 170);
    const bodyHtml = item.type === "知识点思维导图"
      ? renderMindmapResource(item.content || "", item.title)
      : isExerciseResource
        ? renderExerciseResource(exerciseSource, displayTitle, index)
        : item.type === "多模态教学视频/动画"
          ? renderVideoResource(item.content || "", item.title, index)
        : item.type === "代码类实操案例"
          ? renderCodePracticeResource(item.content || "")
          : renderResourceMarkdown(item.content || "");
    const presentationDownload = item.type === "教学演示文稿（PPT）" && item.download_url
      ? `<a class="resource-toggle resource-download" href="${escapeHtml(item.download_url)}" target="_blank" rel="noopener">下载 PPT</a>`
      : item.type === "教学演示文稿（PPT）" && item.ppt_task_id
        ? `<span class="resource-agent">PPT 正在生成，可继续浏览其他资源</span>`
        : item.type === "教学演示文稿（PPT）" && item.ppt_error
          ? `<span class="resource-agent">${escapeHtml(item.ppt_error)}</span>`
        : "";
    return `
    <article class="resource-card ${item.type === "知识点思维导图" ? "mindmap-resource-card" : ""}">
      <div class="resource-card-head">
        <div>
          <div class="resource-type">${escapeHtml(item.type || "学习资源")}</div>
          <div class="resource-title">${escapeHtml(displayTitle)}</div>
        </div>
        <div class="resource-agent">${escapeHtml((SELECTABLE_RESOURCE_AGENTS.find((agent) => agent.type === item.type)?.role || item.agent || "Agent").replace("课程讲解 Agent", "知识文档 Agent").replace("知识讲解 Agent", "知识文档 Agent"))}</div>
      </div>
      ${isExerciseResource ? "" : `<div class="resource-preview">${escapeHtml(preview || "点击展开查看完整内容")}${item.type !== "多模态教学视频/动画" && rawText.length > 170 ? "..." : ""}</div>`}
      <div class="resource-body" ${isExerciseResource ? "" : "hidden"}>${bodyHtml}</div>
      <button class="resource-toggle" type="button" data-resource-index="${index}" aria-expanded="${isExerciseResource ? "true" : "false"}">${isExerciseResource ? "收起题目" : "展开全文"}</button>
      <button class="resource-toggle resource-complete-btn ${completed ? "is-complete" : ""}" type="button" data-resource-complete-index="${index}">${completed ? "已完成" : "标记完成"}</button>
      ${
        item.type === "专业课程讲解文档"
          ? `<button class="resource-toggle resource-download" type="button" data-resource-download-index="${index}">下载 Markdown</button>`
          : ""
      }
      ${
        item.type === "不同类型练习题目"
          ? `<button class="resource-toggle resource-download" type="button" data-exercise-export-word="${index}">导出 Word</button>
             <button class="resource-toggle resource-download" type="button" data-exercise-export-json="${index}">导出 JSON</button>`
          : ""
      }
      ${presentationDownload}
    </article>
  `;
  }).join("");
}

async function loadPptThemes() {
  state.pptThemesLoading = true;
  try {
    const response = await fetch("/api/presentation-themes");
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "PPT 模板加载失败");
    state.pptThemes = Array.isArray(data?.themes) ? data.themes : [];
    if (!el.pptThemeSelect) return;
    const selected = el.pptThemeSelect.value || "auto";
    el.pptThemeSelect.innerHTML = [
      '<option value="auto">智能匹配模板</option>',
      ...state.pptThemes.map((theme) => `<option value="${escapeHtml(theme.key)}">${escapeHtml(theme.name || theme.key)}</option>`),
    ].join("");
    el.pptThemeSelect.value = state.pptThemes.some((theme) => theme.key === selected) ? selected : "auto";
    renderPptThemePreviewPicker();
  } catch (error) {
    console.warn("PPT 模板加载失败", error);
  } finally {
    state.pptThemesLoading = false;
  }
}

function pptThemeClass(themeKey) {
  return `ppt-theme-${String(themeKey || "auto").replace(/[^a-zA-Z0-9_-]/g, "") || "auto"}`;
}

function renderPptThemePreviewPicker() {
  if (!el.pptThemePreviewBtn || !el.pptThemePreviewPanel || !el.pptThemeSelect) return;
  const selectedKey = el.pptThemeSelect.value || "auto";
  const themes = [{ key: "auto", name: "智能匹配模板" }, ...state.pptThemes];
  const selected = themes.find((theme) => theme.key === selectedKey) || themes[0];
  el.pptThemePreviewBtn.innerHTML = `
    <span class="ppt-theme-preview-swatch ${pptThemeClass(selected.key)}" aria-hidden="true"></span>
    <span class="ppt-theme-preview-copy"><b>${escapeHtml(selected.name || selected.key)}</b><small>点击预览并选择</small></span>
    <span class="ppt-theme-preview-arrow" aria-hidden="true">⌄</span>`;
  el.pptThemePreviewPanel.innerHTML = `
    <div class="ppt-theme-preview-head"><div><b>选择 PPT 模板</b><span>所见即生成风格</span></div><button type="button" data-ppt-theme-close aria-label="关闭模板预览">×</button></div>
    <div class="ppt-theme-preview-grid">${themes.map((theme) => {
      const isSelected = theme.key === selectedKey;
      const thumbnail = String(theme.thumbnail || "").trim();
      const visual = thumbnail
        ? `<img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(theme.name || theme.key)} 模板预览">`
        : `<span class="ppt-theme-card-art ${pptThemeClass(theme.key)}" aria-hidden="true"><i></i><em>${escapeHtml(theme.key === "auto" ? "AI" : "PPT")}</em><strong>${escapeHtml(theme.name || theme.key)}</strong></span>`;
      return `<button class="ppt-theme-card ${isSelected ? "is-selected" : ""}" type="button" data-ppt-theme-key="${escapeHtml(theme.key)}" aria-pressed="${isSelected}">${visual}<span>${escapeHtml(theme.name || theme.key)}</span>${isSelected ? "<b>已选</b>" : ""}</button>`;
    }).join("")}</div>`;
  el.pptThemePreviewPanel.querySelector("[data-ppt-theme-close]")?.addEventListener("click", closePptThemePreview);
  el.pptThemePreviewPanel.querySelectorAll("[data-ppt-theme-key]").forEach((card) => {
    card.addEventListener("click", () => {
      setPptTheme(card.getAttribute("data-ppt-theme-key"));
      closePptThemePreview();
    });
  });
}

function setPptTheme(themeKey) {
  if (!el.pptThemeSelect) return;
  const normalizedKey = String(themeKey || "auto");
  const valid = normalizedKey === "auto" || state.pptThemes.some((theme) => theme.key === normalizedKey);
  el.pptThemeSelect.value = valid ? normalizedKey : "auto";
  renderPptThemePreviewPicker();
}

function closePptThemePreview() {
  if (!el.pptThemePreviewPanel) return;
  el.pptThemePreviewPanel.hidden = true;
  el.pptThemePreviewBtn?.setAttribute("aria-expanded", "false");
}

el.pptThemePreviewBtn?.addEventListener("click", () => {
  const panel = el.pptThemePreviewPanel;
  if (!panel) return;
  const willOpen = panel.hidden;
  panel.hidden = !willOpen;
  el.pptThemePreviewBtn.setAttribute("aria-expanded", String(willOpen));
});

renderPptThemePreviewPicker();

async function pollPresentationTask(resource) {
  const taskId = String(resource?.ppt_task_id || "").trim();
  if (!taskId) return;
  for (let attempt = 0; attempt < 96; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      const response = await fetch(`/api/presentations/tasks/${encodeURIComponent(taskId)}`);
      const task = await response.json().catch(() => null);
      if (!response.ok) throw new Error(task?.error || "PPT 状态查询失败");
      resource.ppt_status = task?.status || "PROCESSING";
      if (task?.downloadUrl) {
        resource.download_url = task.downloadUrl;
        resource.ppt_task_id = "";
        resource.ppt_status = "COMPLETED";
        saveLearningResources(state.learningResources);
        return;
      }
      if (task?.status === "FAILED") {
        resource.ppt_task_id = "";
        resource.ppt_status = "FAILED";
        resource.ppt_error = task.error || "PPT 生成失败";
        saveLearningResources(state.learningResources);
        return;
      }
    } catch (error) {
      console.warn("PPT 任务状态查询失败，将继续重试", error);
    }
  }
  resource.ppt_status = "TIMEOUT";
  resource.ppt_error = "PPT 生成时间较长，请稍后重新生成。";
  resource.ppt_task_id = "";
  saveLearningResources(state.learningResources);
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
  const exerciseBlueprint = typeof getExerciseBlueprint === "function" ? getExerciseBlueprint() : {};
  const exerciseTotal = Object.values(exerciseBlueprint).reduce((sum, count) => sum + count, 0);
  if (selectedAgents.some((agent) => agent.id === "quiz") && exerciseTotal < 1) {
    state.resourcesGenerating = false;
    renderLearningResources();
    alert("练习命题 Agent 至少需要设置 1 道题");
    return;
  }
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
3. 思维导图 Agent：生成结构化知识图谱，不是普通列表。
4. 练习命题 Agent：生成系统化题组，包含经典题、中等题、难题和易错题，每题必须有答案详解与来源。
5. 阅读拓展 Agent：生成拓展阅读材料。
6. 代码实操 Agent：生成代码类实操案例。
7. PPT 生成 Agent：生成教学演示文稿大纲与讲授要点。
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
路径规划必须体现多智能体协同：需求分析 Agent 负责识别主题与知识大类，画像诊断 Agent 负责结合专业背景、进度、掌握情况和偏好，资源编排 Agent 负责把本次生成的资源分配到阶段，练习复盘 Agent 负责用错题和完成证据修正后续阶段，动态优化 Agent 负责同类路径增量更新。
path_basis 必须先综合分析：
1. major_analysis：学生专业/年级/课程背景如何影响本主题学习切入点。
2. progress_analysis：结合当前对话轮次、资源生成状态、错题/练习线索推断学习进度；如果信息不足，要说明仍需通过哪些行为继续校准。
3. mastery_analysis：结合知识基础、易错点、题目表现或对话暴露的问题，判断已掌握、薄弱和待验证内容。
4. preference_analysis：结合认知风格、学习习惯、互动偏好，决定讲解、导图、视频、题库、实操的使用顺序。
5. resource_strategy：说明系统生成的个性化资源如何被分阶段推送，而不是简单罗列资源。
learning_path 必须基于 path_basis 和本次生成的 resources 规划科学、动态的学习步骤和顺序。必须包含 4-6 个阶段，每个阶段写清学习目标、建议时长、order_reason（为什么这个阶段排在这里）、steps（阶段说明）、todos（3-5 个可执行待办，每个待办有完成证据）、掌握证据，并在 resources 中精准推送本次已生成的文档、视频、题库、实操案例或拓展阅读；推荐理由必须绑定“该阶段目标 + 学生画像依据 + 具体资源标题”。每个阶段都要说明它如何使用前一阶段证据来调整下一阶段；如果学习进度或掌握情况信息不足，阶段中要安排诊断任务来动态修正后续路径。
如果 learningSignals.existing_category_path 存在，说明该知识大类已有学习路径。此时必须做“增量更新”：保留仍然有效的阶段和 Todo，针对本次新需求增删改查 Todo、调整顺序理由和资源推送；不要把同类路径完全清零重写。只有当本次主题明显换到新知识大类时，才生成新的大类路径。

content 可以使用 Markdown。数学表达式必须使用 Markdown 数学写法：行内公式用“美元符号包围的 LaTeX”，独立公式用“双美元符号包围的 LaTeX”；禁止裸写纯文本公式，例如 a 的 n 次幂、n 大于等于 1、上下文相关产生式箭头等，应写成 LaTeX 公式形式。除非是程序代码或文法产生式列表，不要把数学公式放进代码块。
最高优先级规则：用户本次输入的主题是资源生成的主主题。学生画像只能用于调整解释深度、难度、例子风格和练习梯度，不能把画像里的旧主题硬塞进资源标题或正文。除非用户本次明确提到，禁止把不相关的前端、Java、C++ 等旧画像内容混入“多模态”等新主题。
重要：专业课程讲解文档必须是“知识正文”，不是大纲，也不是“如何学习/如何讲解这个知识”的方法论。它必须像对话页直接回答用户问题一样，把用户指定主题本身讲清楚，并用 Markdown 组织为可阅读正文。任何主题都禁止输出“对象、规则、作用”“知识结构”“学习路径”“如何拆解一个知识点”这类通用方法论来冒充知识内容；如果不确定主题细节，也要基于主题本身给出具体概念、规则、例子和边界，不能转写成学习建议。正文控制在约 1300-1700 个中文字符，目标约 1500 字；不能少到只有提纲，也不要写成长篇论文。禁止出现“这份文档会先...”“学习这个主题时可以...”“一个合格的讲解文档应该...”这类元话术。
如果主题是编程语言基础，知识文档必须围绕语言知识点本身展开，必须包含：语法形式、执行流程、关键变量/下标/边界含义、至少 3 段可运行或接近可运行的代码示例、输出解释、常见异常或 bug、适用场景与易错点。
如果主题是编译原理、文法、1 型文法、上下文有关文法，知识文档必须讲：乔姆斯基层次、1 型文法定义、产生式形式 $\\alpha A \\beta \\to \\alpha \\gamma \\beta$、非收缩性质、$S \\to \\varepsilon$ 例外、与上下文无关文法区别、上下文有关语言、线性有界自动机、典型语言 $a^n b^n c^n$、判断文法类型的易错点。
如果主题是算法、数据结构或具体算法名（例如 Floyd、Dijkstra、动态规划、最短路），知识文档必须围绕该算法本身展开，必须包含：问题定义、输入输出、状态/变量含义、核心转移或关键步骤、正确性直觉、复杂度、手推例题、代码示例、易错点。禁止输出与该算法无关的多模态、前端或通用学习法内容。
思维导图必须有中心主题、5-7 个一级分支、每个分支 3 个具体二级节点，并给出一条复习路径。禁止输出“子节点：定义/应用/计算方法”这类空泛占位词；每个节点必须是具体知识点或题型，例如“等价无穷小替换”“洛必达法则适用条件”“定积分几何应用”。优先输出结构清晰的层级内容。
练习命题 Agent 必须严格按照用户指定的题型与题量生成，共 ${exerciseTotal} 道：
${Object.entries(exerciseBlueprint).map(([type, count]) => `- ${type}：${count} 道`).join("\n")}
数量为 0 的题型不得生成；type 字段必须使用上述题型名称。单选题提供 A-D 四个选项且只有一个正确答案；多选题提供 A-D 四个选项并明确全部正确选项；判断题写明“正确/错误”；填空题标明空格；简答题和应用题给出评分要点或步骤。
练习命题 Agent 的 content 必须输出 JSON 字符串，格式为：
{"questions":[{"type":"单选题/多选题/判断题/填空题/简答题/应用题","difficulty":"基础/中等/难题","knowledge":"对应知识点","source":"经典教材题型改编/课程常见题型/历年考试题型改编/面试常见题型改编等，不要编造具体书名页码","question":"题干（选择题选项也写在这里）","answer":"标准答案","explanation":"分步骤详解，说明为什么这样做、易错点和检查方法"}]}
题目难度需合理覆盖基础、中等和难题。每道题 explanation 至少 80 个中文字符，不能只有一句话。题目优先选择经典题型或课程常见题型改编，并在 source 字段标注来源类型。
阅读拓展 Agent 的 content 必须输出“可执行资源清单”，不能写泛泛介绍性短文。必须包含这些小节：
1. 教材/书：至少 2 本具体书名，尽量写作者，并说明先读哪些章节或主题。
2. 课程/视频：至少 1 个具体课程、公开视频、课程主页或视频合集，给出 URL；如果不确定具体视频链接，给课程主页或检索关键词。
3. 论文/报告/综述：如果输出论文，必须同时包含经典论文和 2022 年以来的近四年前沿论文。技术/前沿主题至少给 2 篇经典论文或综述、至少 3 篇 2022 年以来论文；写清题名、年份、URL/DOI/arXiv，并说明先读哪里。基础课程主题若不适合论文，可给经典教材章节代替，但不要伪造论文。
4. 官方文档/网站/数据集/工具：至少 2 个可点击 URL，例如官方文档、数据集官网、工具文档、在线可视化网站。
5. 检索关键词：给中文和英文关键词各 5 个以上。
禁止只写“应用广泛、未来重要、建议阅读相关资料、可查找相关论文”这类空话；每条资源都要说明“为什么看”和“先看哪里”。
链接纪律：严禁编造课程短链、DOI、arXiv 编号或官方文档路径。只有在你确定 URL 真实存在时才输出精确链接；不确定时，输出稳定官网首页、课程主页、论文标题加检索关键词，或 Google Scholar/arXiv/Papers with Code 的搜索建议。不要输出 John Doe、Jane Smith 这类占位作者。
代码实操 Agent 的 content 必须输出“可运行实训卡”，不能只贴一段完整代码。必须包含这些小节：
1. 任务目标：说明要实现什么、练到什么能力。
2. 输入/输出样例：给可手算的小样例、期望输出或断言。
3. 代码骨架：包含 TODO，让学生先补全；如果给参考答案，要单独放在“参考实现”小节。
4. 运行命令：明确语言和命令，例如 g++ main.cpp -std=c++17 -O2 && ./a.out、python main.py、node main.js。
5. 测试用例：至少 3 个，覆盖基础、边界、易错场景。
6. 调试清单：列出常见 bug、应该打印哪些中间变量、如何判断哪里错。
7. 修改挑战：至少 2 个变式任务，例如改输入方式、增加边界处理、换一种算法或数据结构。
代码必须能独立运行，不能依赖不存在的文件；如果主题不是编程题，也要设计一个最小可运行实验或伪代码验证任务。
PPT 生成 Agent 的 content 必须是 JSON 字符串，格式为：
{"audience":"学习者","slides":[{"title":"页面标题","takeaway":"本页要传达的结论","bullets":["要点 1","要点 2","要点 3"],"speaker_note":"讲授提示"}]}
PPT 至少 6 页、最多 10 页，包含封面、核心概念、关键过程或例题、易错点/练习、总结与下一步。每页只讲一个明确观点，bullets 控制在 3-5 条，每条不超过 30 个中文字符。不得编造数据、引用或案例。`;

  const learningSignals = {
    progress_summary: buildLearningProgressSummary([]),
    practice_performance: typeof summarizePracticePerformance === "function" ? summarizePracticePerformance() : null,
    resource_usage: typeof summarizeResourceUsage === "function" ? summarizeResourceUsage() : null,
    current_demand_category: demandCategory,
    demand_trace: summarizeDemandEvents(demand),
    path_evidence_sources: typeof collectPathEvidenceSources === "function"
      ? collectPathEvidenceSources({
          category: demandCategory,
          topic: demand,
          resources: state.learningResources?.resources || [],
        })
      : null,
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
    exercise_blueprint: exerciseBlueprint,
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
    const presentation = normalized.resources.find((item) => item.type === "教学演示文稿（PPT）");
    if (presentation) {
      const presentationRes = await fetch("/api/presentations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: normalized.topic || demand, title: presentation.title, outline: presentation.content, theme: el.pptThemeSelect?.value || "auto" }),
      });
      if (presentationRes.ok) {
        const presentationData = await presentationRes.json();
        presentation.download_url = presentationData.downloadUrl || "";
        presentation.ppt_task_id = presentationData.taskId || "";
        presentation.ppt_status = presentationData.status || (presentation.download_url ? "COMPLETED" : "PROCESSING");
      } else {
        const errorData = await presentationRes.json().catch(() => null);
        presentation.ppt_status = "FAILED";
        presentation.ppt_error = errorData?.error || "PPT 文件生成失败，请稍后重试。";
      }
    }
    saveLearningResources(normalized);
    if (presentation?.ppt_task_id) void pollPresentationTask(presentation);
    recordLearningBehavior("resource_generated", {
      category: normalized.category,
      topic: normalized.topic,
      title: demand,
      meta: { resourceCount: normalized.resources.length },
    });
    if (typeof requestStudentProfileRefreshFromActivity === "function") {
      requestStudentProfileRefreshFromActivity("resource_generated", {
        category: normalized.category,
        topic: normalized.topic,
        title: demand,
        resourceCount: normalized.resources.length,
      });
    }
  } catch (e) {
    console.error(e);
    el.resourceGrid.innerHTML = `<div class="resource-empty">资源生成失败：${escapeHtml(String(e?.message || e))}</div>`;
  } finally {
    state.resourcesGenerating = false;
    renderLearningResources();
  }
}
