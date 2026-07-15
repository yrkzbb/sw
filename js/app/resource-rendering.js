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
    el.resourceGrid.innerHTML = `<div class="resource-empty">填写课程内容或学习需求后，点击“生成资源”。<br>${escapeHtml(flowText)}</div>`;
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
