function renderAgentPipeline(status = "idle") {
  if (!el.agentPipeline) return;
  const selectedSet = getSelectedResourceAgents();
  const quizEnabled = state.selectedResourceAgents.includes("quiz");
  if (el.exerciseBlueprintPanel) el.exerciseBlueprintPanel.hidden = !quizEnabled;
  el.agentPipeline.innerHTML = SELECTABLE_RESOURCE_AGENTS.map((agent) => {
    const selected = state.selectedResourceAgents.includes(agent.id);
    const inCurrentFlow = selectedSet.some((item) => item.id === agent.id);
    const progress = (state.resourceAgentProgress || []).find((item) => item.role === agent.role);
    const running = progress?.status === "running" || progress?.status === "retrying" || (status === "running" && inCurrentFlow && !progress);
    const done = progress?.status === "completed" || (status === "done" && inCurrentFlow);
    const failed = progress?.status === "failed";
    const cls = [done ? "done" : "", running ? "running" : "", selected ? "selected" : ""].filter(Boolean).join(" ");
    return `
      <button class="agent-card ${cls}" type="button" data-agent-id="${agent.id}" aria-pressed="${selected ? "true" : "false"}">
        <div class="agent-role"><span class="agent-dot" aria-hidden="true"></span>${escapeHtml(agent.role)}</div>
        ${agent.task ? `<div class="agent-task">${escapeHtml(progress?.detail || agent.task)}</div>` : ""}
        ${progress ? `<div class="agent-live-status ${failed ? "is-failed" : ""}">${escapeHtml(progress.status === "retrying" ? `正在重试（第 ${progress.attempt} 次）` : progress.status === "completed" ? "已完成" : progress.status === "failed" ? "已降级跳过" : "生成中")}</div>` : ""}
      </button>
    `;
  }).join("");
}

function updateResourceAgentProgress(role, status, detail = "", attempt = 1) {
  const current = Array.isArray(state.resourceAgentProgress) ? state.resourceAgentProgress.slice() : [];
  const index = current.findIndex((item) => item.role === role);
  const next = { role, status, detail, attempt, updated_at: new Date().toISOString() };
  if (index >= 0) current[index] = { ...current[index], ...next };
  else current.push(next);
  state.resourceAgentProgress = current;
  renderAgentPipeline(state.resourcesGenerating ? "running" : "done");
  if (state.resourcesGenerating && el.resourceGrid) renderResourceGenerationProgress();
}

function getSelectedResourceAgents() {
  if (!state.selectedResourceAgents.length) return SELECTABLE_RESOURCE_AGENTS;
  return SELECTABLE_RESOURCE_AGENTS.filter((agent) => state.selectedResourceAgents.includes(agent.id));
}

const HIGHER_EDUCATION_RESOURCE_CATALOG = [
  {
    title: "国家高等教育智慧教育平台",
    provider: "中华人民共和国教育部",
    author: "教育部",
    url: "https://higher.smartedu.cn/",
    kind: "国家级高等教育课程平台",
    trust: "权威",
    keywords: "高校 本科 研究生 精品课程 计算机 人工智能 数学 电子信息 通识",
    note: "优先检索国家级一流本科课程和高校共享课程，可按学校、学科与课程筛选。",
  },
  {
    title: "中国大学 MOOC",
    provider: "高等教育出版社与网易",
    author: "入驻高校课程团队",
    url: "https://www.icourse163.org/",
    kind: "高校公开课程平台",
    trust: "较高",
    keywords: "大学慕课 计算机 程序设计 数据结构 算法 人工智能 高等数学 编译原理 电子信息",
    note: "进入平台后使用本次主题检索，优先选择标有开课学校、教师和课程大纲的资源。",
  },
  {
    title: "学堂在线",
    provider: "清华大学发起",
    author: "入驻高校课程团队",
    url: "https://www.xuetangx.com/",
    kind: "高校在线课程平台",
    trust: "较高",
    keywords: "清华 高校 计算机 人工智能 软件工程 数据结构 算法 数学 电子信息 在线课程",
    note: "适合补充国内高校课程视频、章节测验与课程讲义。",
  },
  {
    title: "MIT OpenCourseWare",
    provider: "Massachusetts Institute of Technology",
    author: "MIT faculty",
    url: "https://ocw.mit.edu/",
    kind: "高校开放课程",
    trust: "权威",
    keywords: "computer science algorithms programming artificial intelligence mathematics electrical engineering course notes assignments",
    note: "可检索英文课程讲义、作业、考试与课程日程，适合作为进阶材料。",
  },
  {
    title: "Stanford Engineering Everywhere",
    provider: "Stanford University",
    author: "Stanford Engineering faculty",
    url: "https://see.stanford.edu/",
    kind: "高校工程课程",
    trust: "权威",
    keywords: "computer science artificial intelligence machine learning programming algorithms engineering",
    note: "适合计算机、人工智能与工程类主题的课程视频和讲义。",
  },
  {
    title: "arXiv",
    provider: "Cornell University",
    author: "论文作者",
    url: "https://arxiv.org/",
    kind: "开放学术论文库",
    trust: "需同行评议核验",
    keywords: "artificial intelligence machine learning multimodal computer vision natural language processing algorithms research paper survey",
    note: "适合前沿主题检索；预印本不等于已同行评议，使用时应核对版本与发表信息。",
  },
];

function tokenizeEducationQuery(value) {
  return [...new Set(String(value || "").toLowerCase()
    .replace(/[^\p{L}\p{N}+#]+/gu, " ")
    .split(/\s+/)
    .flatMap((token) => token.length > 2 && /[\u4e00-\u9fff]/.test(token)
      ? [token, ...Array.from({ length: token.length - 1 }, (_, index) => token.slice(index, index + 2))]
      : [token])
    .filter((token) => token.length > 1))];
}

function retrieveHigherEducationResources(query, limit = 5) {
  const tokens = tokenizeEducationQuery(`${query} ${categorizeKnowledge(query, query)}`);
  return HIGHER_EDUCATION_RESOURCE_CATALOG
    .map((item) => {
      const haystack = `${item.title} ${item.provider} ${item.kind} ${item.keywords} ${item.note}`.toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? (token.length > 3 ? 3 : 1) : 0), 0)
        + (/教育|课程|学习|高校/.test(query) && /课程|高校/.test(item.kind) ? 2 : 0);
      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score || (a.trust === "权威" ? -1 : 1))
    .slice(0, limit);
}

function buildRetrievedEducationResource(query) {
  const matches = retrieveHigherEducationResources(query);
  const content = [
    `# “${query}”高校教育资源检索结果`,
    "",
    "> 以下条目来自系统维护的可信资源目录，属于“检索资源”，不是 AI 编造的课程或论文。平台内的具体课程仍需按主题二次筛选。",
    "",
    ...matches.flatMap((item, index) => [
      `## ${index + 1}. [${item.title}](${item.url})`,
      `- 来源机构：${item.provider}`,
      `- 作者/责任主体：${item.author}`,
      `- 资源类型：${item.kind}`,
      `- 可信度：${item.trust}`,
      `- 推荐理由：${item.note}`,
      `- 与当前主题的检索相关度：${item.score > 4 ? "高" : item.score > 1 ? "中" : "基础入口"}`,
      "",
    ]),
    "## 使用与核验建议",
    "- 优先选择展示开课高校、主讲教师、课程大纲和更新时间的条目。",
    "- 论文类资源应继续核对 DOI、正式发表版本和同行评议状态。",
    "- 引用时记录课程名、教师/作者、机构、链接与访问日期。",
  ].join("\n");
  return {
    type: "高校教育资源检索",
    title: `${query} · 可信高校资源`,
    agent: "教育资源检索 Agent",
    origin: "retrieved",
    provenance: {
      method: "本地可信目录相关性检索",
      retrieved_at: new Date().toISOString(),
      source_count: matches.length,
      verified_catalog: true,
    },
    sources: matches.map(({ title, provider, author, url, kind, trust }) => ({ title, provider, author, url, kind, trust })),
    content,
  };
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

function getExerciseBlueprint() {
  const blueprint = {};
  el.exerciseBlueprintPanel?.querySelectorAll("[data-exercise-type]").forEach((input) => {
    const type = input.getAttribute("data-exercise-type");
    blueprint[type] = Math.max(0, Math.min(20, Number.parseInt(input.value, 10) || 0));
  });
  return Object.keys(blueprint).length ? blueprint : (state.exerciseBlueprint || {});
}

function updateExerciseBlueprint() {
  state.exerciseBlueprint = getExerciseBlueprint();
  const total = Object.values(state.exerciseBlueprint).reduce((sum, count) => sum + count, 0);
  if (el.exerciseBlueprintTotal) el.exerciseBlueprintTotal.textContent = `共 ${total} 题`;
}

function safeDownloadName(value, fallback = "练习题") {
  return String(value || fallback).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || fallback;
}

function isPollutedExerciseList(exercises) {
  return exercises.some((exercise) => {
    const combined = `${exercise?.question || ""} ${exercise?.knowledge || ""} ${exercise?.answer || ""}`;
    return /["“]?questions["”]?\s*:|\\?"type\\?"\s*:|\\?"question\\?"\s*:/.test(combined)
      || String(exercise?.question || "").length > 800
      || String(exercise?.knowledge || "").length > 300;
  });
}

function getResourceExerciseList(resource, fallbackTitle = "") {
  const contentExercises = normalizeExerciseList(resource?.content || "", fallbackTitle || resource?.title);
  const titleExercises = normalizeExerciseList(resource?.title || "", fallbackTitle);
  return titleExercises.length && (!contentExercises.length || isPollutedExerciseList(contentExercises))
    ? titleExercises
    : contentExercises;
}

function downloadBlobFile(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadExerciseJson(resource) {
  const questions = getResourceExerciseList(resource, resource?.title);
  if (!questions.length) return alert("当前题库没有可导出的题目");
  const payload = {
    title: resource.title || "练习题",
    exported_at: new Date().toISOString(),
    question_count: questions.length,
    questions: questions.map(({ fingerprint, ...question }) => question),
  };
  downloadBlobFile(`${safeDownloadName(resource.title)}.json`, new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: "application/json;charset=utf-8" }
  ));
}

function downloadExerciseWord(resource) {
  const questions = getResourceExerciseList(resource, resource?.title);
  if (!questions.length) return alert("当前题库没有可导出的题目");
  const questionHtml = questions.map((question, index) => `
    <section class="question">
      <h2>${index + 1}. [${escapeHtml(question.type)} · ${escapeHtml(question.difficulty)}] ${escapeHtml(question.question)}</h2>
      <p class="meta">知识点：${escapeHtml(question.knowledge || "综合知识")}　来源：${escapeHtml(question.source)}</p>
      <div><b>答案：</b>${escapeHtml(question.answer || "见解析")}</div>
      <div class="explanation"><b>解析：</b>${escapeHtml(question.explanation)}</div>
    </section>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(resource.title || "练习题")}</title>
    <style>body{font-family:"Microsoft YaHei",Arial,sans-serif;line-height:1.7;color:#172033;margin:36px}h1{text-align:center}.summary{text-align:center;color:#64748b;margin-bottom:28px}.question{page-break-inside:avoid;border-bottom:1px solid #dbe3ec;padding:0 0 20px;margin:0 0 22px}h2{font-size:16px}.meta{font-size:12px;color:#64748b}.explanation{background:#f5f8fb;padding:12px;margin-top:10px}</style>
    </head><body><h1>${escapeHtml(resource.title || "练习题")}</h1><p class="summary">共 ${questions.length} 题 · 含标准答案与详解</p>${questionHtml}</body></html>`;
  downloadBlobFile(`${safeDownloadName(resource.title)}.doc`, new Blob(
    ["\ufeff", html],
    { type: "application/msword;charset=utf-8" }
  ));
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

async function storeAndDownloadMindmapSvg(canvas) {
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
  const folderId = typeof openFavoriteCollectionPicker === "function"
    ? await openFavoriteCollectionPicker({
      title: "思维导图收藏到哪个收藏夹？",
      detail: file.title,
      kind: "file",
    })
    : "default";
  const saved = saveStoredMarkdownFiles([file].concat(state.storedMarkdownFiles || []));
  if (saved && typeof addItemToFavoriteCollection === "function") {
    addItemToFavoriteCollection("file", file.id, folderId);
  }
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
  }).filter((item) => item.question && item.question.length > 4);
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
      ${exercises.map((exercise, index) => {
        const result = typeof getExercisePracticeResult === "function" ? getExercisePracticeResult(exercise.fingerprint) : null;
        return `
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
          <div class="exercise-result-row" aria-label="练习结果记录">
            <button class="exercise-result-btn ${result === "correct" ? "active" : ""}" type="button" data-practice-result="${resourceIndex}:${index}:correct">做对了</button>
            <button class="exercise-result-btn ${result === "incorrect" ? "active" : ""}" type="button" data-practice-result="${resourceIndex}:${index}:incorrect">做错了</button>
            <span>${result === "correct" ? "已记录正确" : result === "incorrect" ? "已记录错误" : "记录后会进入学习效果评估"}</span>
          </div>
          <div class="exercise-source">来源：${escapeHtml(exercise.source)}</div>
          <details class="exercise-detail" open>
            <summary>答案与详解</summary>
            <div class="exercise-answer"><strong>答案：</strong>${renderInlineMathText(exercise.answer || "见解析")}</div>
            <div class="exercise-explanation markdown-body">${renderResourceMarkdown(exercise.explanation)}</div>
          </details>
        </article>
      `;
      }).join("")}
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
  if (/二分查找|binary\s*search/i.test(topic)) {
    return `# ${title || "二分查找算法详解"}

> 本文由本地可靠内容兜底生成，确保模型偶发输出异常时仍可继续学习。

## 1. 核心思想
二分查找用于**有序序列**。每次比较中间元素，并排除一半不可能包含目标值的区间，因此搜索范围会持续减半。

## 2. 边界约定
推荐使用左闭右闭区间 \`[left, right]\`：
- 初始值：\`left = 0\`，\`right = n - 1\`
- 循环条件：\`left <= right\`
- 中点：\`mid = left + Math.floor((right - left) / 2)\`
- 目标较大：\`left = mid + 1\`
- 目标较小：\`right = mid - 1\`

## 3. 循环不变量
每轮循环开始时，如果目标存在，它一定仍在当前搜索区间中。更新左右边界时必须排除已经比较过的 \`mid\`，否则可能出现死循环。

## 4. JavaScript 示例
\`\`\`js
function binarySearch(list, target) {
  let left = 0;
  let right = list.length - 1;
  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (list[mid] === target) return mid;
    if (list[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}
\`\`\`

## 5. 复杂度
- 时间复杂度：\`O(log n)\`
- 迭代写法空间复杂度：\`O(1)\`

## 6. 常见错误
1. 在无序数组上直接使用二分查找。
2. 混用左闭右闭和左闭右开区间。
3. 更新边界时没有跳过 \`mid\`。
4. 忽略空数组、单元素数组和重复元素。

## 7. 自测
分别测试：空数组、目标在首位、目标在末位、目标不存在、存在重复元素。`;
  }
  return `# ${title || topic || "知识文档"}

> 本文由本地学习提纲兜底生成。模型内容暂不可用时，可先按这份结构继续学习。

## 学习目标
- 能用自己的话解释“${topic}”的核心概念。
- 能列出适用条件、关键步骤与常见错误。
- 能完成一个最小示例，并说明结果。

## 建议路径
1. 明确定义和适用范围。
2. 把过程拆成可检查的步骤。
3. 用正例、反例和边界情况验证理解。
4. 完成基础题后记录错因，再做一次迁移练习。

## 自测问题
- 这个主题解决什么问题？
- 使用它需要满足哪些前提？
- 哪一步最容易出错？
- 如何判断自己已经真正掌握？`;
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
    const titleExercises = normalizeExerciseList(quiz.title, data.topic || demand);
    const contentExercises = normalizeExerciseList(quiz.content, quiz.title);
    if (titleExercises.length) quiz.content = quiz.title;
    if (titleExercises.length || /^[{[]/.test(String(quiz.title || "").trim())) {
      const topic = String(data.topic || demand || "课程").replace(/\s+/g, " ").trim().slice(0, 28);
      quiz.title = `${topic}练习题`;
    }
    const subjectText = `${demand || ""} ${quiz.title || ""}`.trim();
    const exercises = normalizeExerciseList(quiz.content, quiz.title);
    const weakExercises = !exercises.length || exercises.some((item) => !item.answer || !item.explanation);
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
  const presentation = resources.find((item) => item.type === "教学演示文稿（PPT）");
  if (presentation) {
    presentation.agent = "PPT 生成 Agent";
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
