function tutorEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tutorCompactText(value, fallback = "暂未形成明确画像") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 42 ? `${text.slice(0, 42)}...` : text;
}

function tutorProfileItem(key) {
  return state.studentProfile?.[key] || {};
}

function tutorProfileSignals() {
  const foundation = tutorProfileItem("knowledge_foundation");
  const style = tutorProfileItem("cognitive_style");
  const errors = tutorProfileItem("error_patterns");
  const interaction = tutorProfileItem("interaction_preference");
  return [
    {
      label: "知识基础",
      value: tutorCompactText(foundation.value, "先按基础概念补齐关键前置知识"),
      confidence: foundation.confidence || "待补充",
    },
    {
      label: "认知风格",
      value: tutorCompactText(style.value, "优先使用步骤拆解、类比和图解"),
      confidence: style.confidence || "推测",
    },
    {
      label: "易错线索",
      value: tutorCompactText(errors.value, "重点标注容易混淆的判断点"),
      confidence: errors.confidence || "待补充",
    },
    {
      label: "互动偏好",
      value: tutorCompactText(interaction.value, "先讲清楚，再给一题即时练习"),
      confidence: interaction.confidence || "推测",
    },
  ];
}

function tutorKeyword(question, subject) {
  const cleaned = String(question || "")
    .replace(/[？?！!。,.，、；;：:\n\r]/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0];
  return cleaned || subject || "当前知识点";
}

function buildFallbackTutor(question, subject, depth) {
  const topic = tutorKeyword(question, subject);
  const need = String(question || "").trim() || `我想理解${topic}`;
  return {
    topic,
    badge: "结构化解答",
    sections: [
      {
        title: "把问题先落到一个可解的点",
        body: `你问的是“${need}”。我会先找出题目里的关键名词、成立条件和目标结论，再判断它更像概念理解、公式推导、代码调试还是解题步骤。`,
      },
      {
        title: "按当前深度拆解",
        body: `本次选择的是“${depth}”。所以讲解会先给定义，再给一个最小例子，最后列出易错点，而不是只给结论。`,
        bullets: [
          "定义：这个概念到底限制了什么。",
          "例子：用一组具体数据跑一遍。",
          "检查：换一个条件，看结论是否仍成立。",
        ],
      },
      {
        title: "下一步需要补充的信息",
        body: "为了生成更像老师现场答疑的版本，最好把题目原文、你卡住的步骤、已有解法或截图一起给出来。系统可以据此把泛化解释收窄到某一道题。",
      },
    ],
    guide: "你可以继续输入“我卡在第几步”或粘贴题目原文，我会把解答继续细化到推导过程。",
    diagramTitle: topic,
    diagramSteps: [
      { title: "定位概念", detail: "找关键词和成立条件" },
      { title: "跑通例子", detail: "用具体数据验证" },
      { title: "解释原因", detail: "说明每一步依据" },
      { title: "反例检查", detail: "看条件变化后是否成立" },
    ],
    videoScenes: [
      { time: "0-8s", text: `展示问题“${topic}”，圈出题目里的关键条件。` },
      { time: "8-28s", text: "用一个最小例子演示概念如何工作，避免只背定义。" },
      { time: "28-48s", text: "逐步解释为什么这一步可以推出下一步。" },
      { time: "48-60s", text: "给一个反例或变式题，检查是否真正理解。" },
    ],
  };
}

function buildTutorAnswer(question, subject, depth) {
  return buildFallbackTutor(question, subject, depth);
}

function extractTutorJson(text) {
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

function normalizeTutorPayload(payload, question, subject, depth) {
  const fallback = buildFallbackTutor(question, subject, depth);
  if (!payload || typeof payload !== "object") return fallback;
  const sections = Array.isArray(payload.sections)
    ? payload.sections.slice(0, 6).map((section) => ({
      title: String(section?.title || "").trim(),
      body: String(section?.body || "").trim(),
      bullets: Array.isArray(section?.bullets)
        ? section.bullets.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5)
        : [],
      code: String(section?.code || "").trim(),
    })).filter((section) => section.title && section.body)
    : [];
  const diagramSteps = Array.isArray(payload.diagramSteps)
    ? payload.diagramSteps.slice(0, 6).map((step) => ({
      title: String(step?.title || "").trim(),
      detail: String(step?.detail || "").trim(),
    })).filter((step) => step.title && step.detail)
    : [];
  const videoScenes = Array.isArray(payload.videoScenes)
    ? payload.videoScenes.slice(0, 6).map((scene) => ({
      time: String(scene?.time || "").trim(),
      text: String(scene?.text || "").trim(),
    })).filter((scene) => scene.time && scene.text)
    : [];
  return {
    topic: String(payload.topic || fallback.topic).trim(),
    badge: String(payload.badge || "AI 生成").trim(),
    sections: sections.length ? sections : fallback.sections,
    guide: String(payload.guide || fallback.guide).trim(),
    diagramTitle: String(payload.diagramTitle || payload.topic || fallback.diagramTitle).trim(),
    diagramSteps: diagramSteps.length ? diagramSteps : fallback.diagramSteps,
    videoScenes: videoScenes.length ? videoScenes : fallback.videoScenes,
  };
}

async function requestTutorAnswerFromModel(question, subject, depth) {
  const profile = state.studentProfile || createEmptyProfile();
  const system = `你是“问阶”的智能辅导智能体。你必须针对学生的具体问题给出可教学、可验证、不过度空泛的回答。

输出必须是一个合法 JSON 对象，不要 Markdown 代码块，不要额外解释。字段：
{
  "topic": "不超过 24 字的具体知识点",
  "badge": "不超过 8 字的状态标签",
  "sections": [
    {
      "title": "具体小标题",
      "body": "具体解释。必须包含题目相关的定义、条件、推理、例子或结论之一。",
      "bullets": ["可选，要点必须具体"],
      "code": "可选。代码、公式、树结构、表格型文本或推导过程"
    }
  ],
  "guide": "一个针对本题的检查题、下一步练习或追问建议",
  "diagramTitle": "图解中心节点文字",
  "diagramSteps": [{"title": "步骤名", "detail": "具体做什么"}],
  "videoScenes": [{"time": "0-8s", "text": "短视频这一段讲什么"}]
}

硬性要求：
- 不要输出“识别概念、例题推演、误区对比”这类可套到任何题上的空话，除非后面紧跟本题的具体内容。
- 如果题目有隐藏条件、反例、适用范围或常见误解，必须指出。
- sections 至少 4 段：定位问题、核心解释、具体例子/推导、易错点/检查。
- diagramSteps 4 到 6 个，每个 detail 都要和本题有关。
- videoScenes 4 到 6 段，每段都要能直接作为讲解分镜。
- 学生画像只用于调整讲解深度和表达方式，不能替代答题内容。`;
  const user = `学生问题：${question || "学生还没有输入具体问题"}
学科：${subject}
讲解深度：${depth}
学生画像 JSON：
${JSON.stringify(profile, null, 2)}

请生成通用智能辅导结果。`;
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
      temperature: 0.35,
    }),
  });
  if (!res.ok) throw new Error(`智能辅导生成失败：${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || data?.message?.content || data?.content || "";
  const parsed = extractTutorJson(content);
  if (!parsed) throw new Error("智能辅导返回格式异常，请重试。");
  return normalizeTutorPayload(parsed, question, subject, depth);
}

function renderTutorSignals() {
  if (!el.tutorSignalList) return;
  el.tutorSignalList.innerHTML = tutorProfileSignals().map((signal) => `
    <div class="tutor-signal-item">
      <span>${tutorEscapeHtml(signal.label)}</span>
      <strong>${tutorEscapeHtml(signal.value)}</strong>
      <em>${tutorEscapeHtml(signal.confidence)}</em>
    </div>
  `).join("");
}

function renderTutorOutputs(payload = null) {
  if (!payload) {
    if (el.tutorAnswerBadge) el.tutorAnswerBadge.textContent = "待生成";
    if (el.tutorTextAnswer) {
      el.tutorTextAnswer.innerHTML = `
        <article class="tutor-answer-section">
          <h3>输入一个具体问题</h3>
          <p>系统会调用智能辅导体生成针对本题的解释、例子、推导、易错点和检查题。</p>
        </article>
      `;
    }
    if (el.tutorDiagram) {
      el.tutorDiagram.innerHTML = `
        <div class="tutor-diagram-node main">等待问题</div>
        <div class="tutor-diagram-line"></div>
        <div class="tutor-diagram-grid">
          <div><b>1</b><span>分析题意</span><small>由模型读取具体问题后生成</small></div>
          <div><b>2</b><span>组织图解</span><small>输出和题目相关的步骤</small></div>
        </div>
      `;
    }
    if (el.tutorVideoScript) {
      el.tutorVideoScript.innerHTML = `
        <ol>
          <li><strong>等待</strong><span>输入问题后生成短视频讲解分镜。</span></li>
        </ol>
      `;
    }
    return;
  }
  const data = payload;
  if (el.tutorAnswerBadge) el.tutorAnswerBadge.textContent = data.badge || "已生成";
  if (el.tutorTextAnswer) {
    const sections = (data.sections || []).map((section) => `
      <article class="tutor-answer-section">
        <h3>${tutorEscapeHtml(section.title)}</h3>
        <p>${tutorEscapeHtml(section.body)}</p>
        ${section.code ? `<pre><code>${tutorEscapeHtml(section.code)}</code></pre>` : ""}
        ${Array.isArray(section.bullets) && section.bullets.length ? `
          <ul>${section.bullets.map((item) => `<li>${tutorEscapeHtml(item)}</li>`).join("")}</ul>
        ` : ""}
      </article>
    `).join("");
    el.tutorTextAnswer.innerHTML = `
      ${sections}
      <div class="tutor-next-step">${tutorEscapeHtml(data.guide)}</div>
    `;
  }
  if (el.tutorDiagram) {
    const steps = (data.diagramSteps || []).map((step, index) => `
      <div><b>${index + 1}</b><span>${tutorEscapeHtml(step.title)}</span><small>${tutorEscapeHtml(step.detail)}</small></div>
    `).join("");
    el.tutorDiagram.innerHTML = `
      <div class="tutor-diagram-node main">${tutorEscapeHtml(data.diagramTitle || data.topic)}</div>
      <div class="tutor-diagram-line"></div>
      <div class="tutor-diagram-grid">${steps}</div>
    `;
  }
  if (el.tutorVideoScript) {
    const scenes = data.videoScenes || [];
    el.tutorVideoScript.innerHTML = `
      <ol>
        ${scenes.map((scene) => `<li><strong>${tutorEscapeHtml(scene.time)}</strong><span>${tutorEscapeHtml(scene.text)}</span></li>`).join("")}
      </ol>
    `;
  }
}

function renderIntelligentTutorPage() {
  renderTutorSignals();
  renderTutorOutputs();
}

function setTutorGenerating(isGenerating) {
  const button = el.tutorForm?.querySelector(".tutor-submit-btn");
  if (button) {
    button.disabled = Boolean(isGenerating);
    button.textContent = isGenerating ? "生成中..." : "生成辅导";
  }
  if (el.tutorAnswerBadge) el.tutorAnswerBadge.textContent = isGenerating ? "生成中" : el.tutorAnswerBadge.textContent;
}

function renderTutorError(message) {
  if (el.tutorAnswerBadge) el.tutorAnswerBadge.textContent = "未生成";
  if (el.tutorTextAnswer) {
    el.tutorTextAnswer.innerHTML = `
      <article class="tutor-answer-section">
        <h3>这次没有生成成功</h3>
        <p>${tutorEscapeHtml(message || "智能辅导接口暂时不可用，请稍后重试。")}</p>
      </article>
    `;
  }
}

async function handleTutorSubmit(event) {
  event.preventDefault();
  const question = el.tutorQuestionInput?.value || "";
  const subject = el.tutorSubjectInput?.value || "计算机基础";
  const depth = el.tutorDepthInput?.value || "从基础概念讲起";
  if (!question.trim()) {
    renderTutorError("请先输入一个具体问题、题目原文或你卡住的步骤。");
    return;
  }
  renderTutorSignals();
  setTutorGenerating(true);
  try {
    const payload = await requestTutorAnswerFromModel(question, subject, depth);
    renderTutorOutputs(payload);
    if (typeof recordLearningBehavior === "function") {
      recordLearningBehavior("tutor_question", {
        category: subject,
        title: payload.topic,
        detail: question,
      });
    }
  } catch (error) {
    console.error(error);
    renderTutorError(error?.message || "智能辅导生成失败，请稍后重试。");
  } finally {
    setTutorGenerating(false);
  }
}
