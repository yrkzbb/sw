const PptxGenJS = require("pptxgenjs");
const PRESENTATION_DIR = path.join(RUNTIME_DIR, "presentations");

function findPresentationValue(value, keys) {
  if (!value || typeof value !== "object") return "";
  for (const key of keys) {
    if (typeof value[key] === "string" && value[key]) return value[key];
  }
  for (const item of Object.values(value)) {
    const found = findPresentationValue(item, keys);
    if (found) return found;
  }
  return "";
}

async function feloRequest(pathname, options = {}) {
  const response = await fetch(`${FELO_API_BASE_URL}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${FELO_API_KEY}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.error || `Felo API 请求失败（${response.status}）`);
  return data || {};
}

function xfyunPptHeaders() {
  const timestamp = Math.floor(Date.now() / 1000);
  const md5 = crypto.createHash("md5").update(`${XFYUN_PPT_APP_ID}${timestamp}`).digest("hex");
  const signature = crypto.createHmac("sha1", XFYUN_PPT_API_SECRET).update(md5).digest("base64");
  return { appId: XFYUN_PPT_APP_ID, timestamp: String(timestamp), signature };
}

async function xfyunPptRequest(pathname, options = {}) {
  const response = await fetch(`${XFYUN_PPT_BASE_URL}${pathname}`, {
    ...options,
    headers: {
      ...xfyunPptHeaders(),
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || Number(data?.code || 0) !== 0) {
    throw new Error(data?.desc || data?.message || `讯飞 PPT API 请求失败（${response.status}）`);
  }
  return data || {};
}

async function createXfyunPresentationTask(body) {
  const topic = String(body.topic || body.title || "个性化学习资源").trim().slice(0, 100);
  const outline = textFromPresentationOutline(body.outline);
  const query = [
    `生成一份面向学习者的中文教学演示文稿，主题：${topic}。`,
    "要求 6-10 页，采用清晰专业的教学版式，包含封面、核心概念、示例或过程、易错点/练习、总结与下一步。",
    "每页聚焦一个结论，避免文字堆砌；自动配图并生成演讲备注。",
    `参考大纲：${JSON.stringify(outline)}`,
  ].join("\n").slice(0, 8000);
  const created = await xfyunPptRequest("/api/aippt/create", {
    method: "POST",
    body: JSON.stringify({ query, create_model: "text", theme: String(body.theme || "auto"), author: "问阶", is_card_note: true, is_cover_img: true, is_figure: true, language: "cn" }),
  });
  const taskId = String(created?.data?.sid || "").trim();
  if (!taskId) throw new Error("讯飞未返回 PPT 任务 sid");
  return { taskId, provider: "xfyun", status: "PENDING" };
}

async function listPresentationThemes(req, res) {
  setCors(res);
  const fallbackThemes = [
    { key: "purple", name: "紫影幽蓝" },
    { key: "green", name: "绿色主题" },
    { key: "lightblue", name: "清逸天蓝" },
    { key: "taupe", name: "质感之境" },
    { key: "blue", name: "星光夜影" },
    { key: "telecomRed", name: "炽热暖阳" },
    { key: "telecomGreen", name: "幻翠奇旅" },
  ];
  if (!XFYUN_PPT_APP_ID || !XFYUN_PPT_API_SECRET) {
    sendJson(res, 200, { themes: fallbackThemes, source: "fallback" });
    return;
  }
  try {
    const data = await xfyunPptRequest("/api/aippt/themeList");
    const themes = Array.isArray(data?.data)
      ? data.data.map((item) => ({ key: String(item.key || ""), name: String(item.name || item.key || ""), thumbnail: String(item.thumbnail || "") })).filter((item) => item.key)
      : fallbackThemes;
    sendJson(res, 200, { themes, source: "xfyun" });
  } catch (error) {
    sendJson(res, 200, { themes: fallbackThemes, source: "fallback", warning: String(error?.message || error) });
  }
}

async function getXfyunPresentationTask(taskId) {
  const progress = await xfyunPptRequest(`/api/aippt/progress?sid=${encodeURIComponent(taskId)}`);
  const data = progress?.data || {};
  const process = Number(data.process || 0);
  if (data.pptUrl) return { taskId, status: "COMPLETED", downloadUrl: data.pptUrl, provider: "xfyun", progress: process };
  if (data.errMsg) return { taskId, status: "FAILED", error: String(data.errMsg), provider: "xfyun", progress: process };
  return { taskId, status: "PROCESSING", provider: "xfyun", progress: process };
}

async function createFeloPresentationTask(body) {
  const topic = String(body.topic || body.title || "个性化学习资源").trim().slice(0, 100);
  const outline = textFromPresentationOutline(body.outline);
  const prompt = [
    `生成一份面向学习者的中文教学演示文稿，主题：${topic}。`,
    "使用清晰、专业、适合课堂讲授的版式；包含封面、核心概念、示例或过程、易错点/练习、总结与下一步。",
    "页数控制在 6-10 页，每页聚焦一个结论，避免堆砌文字。",
    `以下是已经由学习资源 Agent 生成的内容大纲：${JSON.stringify(outline)}`,
  ].join("\n");
  const created = await feloRequest("/v2/ppts", { method: "POST", body: JSON.stringify({ query: prompt }) });
  const taskId = findPresentationValue(created, ["task_id", "taskId", "id"]);
  if (!taskId) throw new Error("Felo 未返回 PPT 任务 ID");

  return { taskId, provider: "felo", status: "PENDING" };
}

async function getFeloPresentationTask(taskId) {
  const statusData = await feloRequest(`/v2/tasks/${encodeURIComponent(taskId)}/status`);
  const status = String(findPresentationValue(statusData, ["status", "task_status", "taskStatus"]) || "PENDING").toUpperCase();
  const directUrl = findPresentationValue(statusData, ["ppt_url", "pptUrl"]);
  if (directUrl) return { taskId, status: "COMPLETED", downloadUrl: directUrl, provider: "felo" };
  if (/COMPLETED|SUCCESS/.test(status)) {
    const historical = await feloRequest(`/v2/tasks/${encodeURIComponent(taskId)}/historical`);
    const downloadUrl = findPresentationValue(historical, ["ppt_url", "pptUrl"]);
    if (downloadUrl) return { taskId, status: "COMPLETED", downloadUrl, provider: "felo" };
    return { taskId, status: "PROCESSING", provider: "felo" };
  }
  if (/FAILED|FAILURE|CANCELLED|ERROR/.test(status)) {
    const historical = await feloRequest(`/v2/tasks/${encodeURIComponent(taskId)}/historical`).catch(() => ({}));
    return { taskId, status: "FAILED", error: findPresentationValue(historical, ["error_message", "error", "message"]) || "Felo PPT 任务失败", provider: "felo" };
  }
  return { taskId, status, provider: "felo" };
}

function presentationFileName(value) {
  const safe = String(value || "learning-presentation")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 56) || "learning-presentation";
  return `${safe}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.pptx`;
}

function textFromPresentationOutline(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return { slides: [{ title: "学习要点", bullets: value.split(/\n+/).filter(Boolean).slice(0, 5) }] };
    }
  }
  return value && typeof value === "object" ? value : {};
}

function normalizePresentationSlides(outline, topic) {
  const source = Array.isArray(outline?.slides) ? outline.slides : [];
  const slides = source
    .map((slide) => ({
      title: String(slide?.title || "").trim(),
      takeaway: String(slide?.takeaway || "").trim(),
      bullets: (Array.isArray(slide?.bullets) ? slide.bullets : []).map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5),
    }))
    .filter((slide) => slide.title || slide.bullets.length);
  if (slides.length) return slides.slice(0, 10);
  return [
    { title: topic, takeaway: "建立本主题的整体认识", bullets: ["理解核心概念", "识别关键步骤", "准备后续练习"] },
    { title: "核心概念", takeaway: "先掌握最关键的定义和边界", bullets: ["概念定义", "适用范围", "常见误区"] },
    { title: "学习总结", takeaway: "把知识转化为可执行的下一步", bullets: ["回顾重点", "完成练习", "记录疑问"] },
  ];
}

async function createPresentation(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  const body = await readJsonBody(req, BODY_LIMIT).catch((error) => {
    sendJson(res, 400, { error: `Bad presentation request: ${String(error?.message || error)}` });
    return null;
  });
  if (!body) return;

  const topic = String(body.topic || body.title || "个性化学习资源").trim().slice(0, 100);
  if (XFYUN_PPT_APP_ID && XFYUN_PPT_API_SECRET) {
    try {
      sendJson(res, 202, await createXfyunPresentationTask(body));
    } catch (error) {
      sendJson(res, 502, { error: `讯飞 PPT 生成失败：${String(error?.message || error)}` });
    }
    return;
  }
  if (FELO_API_KEY) {
    try {
      sendJson(res, 202, await createFeloPresentationTask(body));
    } catch (error) {
      sendJson(res, 502, { error: `Felo PPT 生成失败：${String(error?.message || error)}` });
    }
    return;
  }
  const outline = textFromPresentationOutline(body.outline);
  const slides = normalizePresentationSlides(outline, topic);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "问阶 AI 学习工作台";
  pptx.subject = topic;
  pptx.title = String(body.title || topic).slice(0, 120);
  pptx.company = "问阶";
  pptx.lang = "zh-CN";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "zh-CN",
  };

  const palette = { navy: "123047", teal: "2CB9A7", mist: "EAF7F5", ink: "1D3340", muted: "617985", white: "FFFFFF" };
  const addFooter = (slide, page) => {
    slide.addShape(pptx.ShapeType.line, { x: 0.6, y: 7.08, w: 12.1, h: 0, line: { color: "B6DCD7", width: 1 } });
    slide.addText("问阶 · 个性化学习资源", { x: 0.65, y: 7.15, w: 4, h: 0.2, fontFace: "Aptos", fontSize: 10, color: palette.muted });
    slide.addText(String(page), { x: 12.1, y: 7.15, w: 0.4, h: 0.2, align: "right", fontFace: "Aptos", fontSize: 10, color: palette.muted });
  };

  const cover = pptx.addSlide();
  cover.background = { color: palette.navy };
  cover.addShape(pptx.ShapeType.arc, { x: 9.5, y: -1.2, w: 5.1, h: 5.1, adjustPoint: 0.2, line: { color: palette.teal, transparency: 25, width: 2 } });
  cover.addText("AI LEARNING DECK", { x: 0.8, y: 0.9, w: 3.2, h: 0.35, fontFace: "Aptos", fontSize: 17, bold: true, color: "80E5D7", charSpace: 1.5 });
  cover.addText(topic, { x: 0.8, y: 1.55, w: 9.6, h: 1.2, fontFace: "Aptos Display", fontSize: 34, bold: true, color: palette.white, breakLine: false, fit: "shrink" });
  cover.addText(String(outline?.audience || "面向学习者的个性化讲解"), { x: 0.83, y: 3.05, w: 6.7, h: 0.4, fontFace: "Aptos", fontSize: 18, color: "D6EEEB" });
  cover.addText("由 PPT 生成 Agent 自动编排", { x: 0.83, y: 6.65, w: 4.5, h: 0.25, fontFace: "Aptos", fontSize: 12, color: "9FC7C2" });

  slides.forEach((item, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: index % 2 ? palette.white : "F7FBFA" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 7.5, line: { color: palette.teal, transparency: 100 }, fill: { color: palette.teal } });
    slide.addText(String(index + 1).padStart(2, "0"), { x: 0.65, y: 0.58, w: 0.65, h: 0.3, fontFace: "Aptos", fontSize: 14, bold: true, color: palette.teal });
    slide.addText(item.title || topic, { x: 1.35, y: 0.48, w: 10.8, h: 0.55, fontFace: "Aptos Display", fontSize: 28, bold: true, color: palette.ink, fit: "shrink" });
    if (item.takeaway) {
      slide.addText(item.takeaway, { x: 1.37, y: 1.22, w: 10.4, h: 0.4, fontFace: "Aptos", fontSize: 17, color: palette.muted, fit: "shrink" });
    }
    const bullets = item.bullets.length ? item.bullets : ["围绕本页主题梳理关键理解", "结合实例检验掌握情况", "把结论用于下一步练习"];
    slide.addShape(pptx.ShapeType.roundRect, { x: 1.35, y: 2.0, w: 7.4, h: 3.85, rectRadius: 0.08, line: { color: "C8E6E1", width: 1 }, fill: { color: palette.mist } });
    slide.addText(bullets.map((text) => ({ text, options: { bullet: { indent: 18 }, hanging: 4 } })), { x: 1.8, y: 2.45, w: 6.5, h: 2.9, fontFace: "Aptos", fontSize: 22, color: palette.ink, breakLine: true, paraSpaceAfterPt: 14, fit: "shrink", valign: "mid" });
    slide.addShape(pptx.ShapeType.ellipse, { x: 9.5, y: 2.15, w: 2.15, h: 2.15, line: { color: palette.teal, transparency: 45, width: 2 }, fill: { color: "D9F3EF", transparency: 25 } });
    slide.addText("关键\n要点", { x: 9.68, y: 2.76, w: 1.8, h: 0.7, align: "center", fontFace: "Aptos", fontSize: 18, bold: true, color: palette.teal, breakLine: false });
    addFooter(slide, index + 2);
  });

  fs.mkdirSync(PRESENTATION_DIR, { recursive: true });
  const filename = presentationFileName(body.title || topic);
  await pptx.writeFile({ fileName: path.join(PRESENTATION_DIR, filename) });
  sendJson(res, 201, { downloadUrl: `/api/presentations/${encodeURIComponent(filename)}`, filename, slideCount: slides.length + 1 });
}

async function getPresentationTask(req, res, taskId) {
  setCors(res);
  if (XFYUN_PPT_APP_ID && XFYUN_PPT_API_SECRET) {
    try {
      sendJson(res, 200, await getXfyunPresentationTask(taskId));
    } catch (error) {
      sendJson(res, 502, { error: `讯飞 PPT 状态查询失败：${String(error?.message || error)}` });
    }
    return;
  }
  if (!FELO_API_KEY) {
    sendJson(res, 404, { error: "Felo PPT 服务未配置" });
    return;
  }
  try {
    sendJson(res, 200, await getFeloPresentationTask(taskId));
  } catch (error) {
    sendJson(res, 502, { error: `Felo PPT 状态查询失败：${String(error?.message || error)}` });
  }
}

function downloadPresentation(req, res, filename) {
  const filePath = safeJoin(PRESENTATION_DIR, filename);
  if (!filePath || path.extname(filePath).toLowerCase() !== ".pptx" || !fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Presentation not found");
    return;
  }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`);
  fs.createReadStream(filePath).pipe(res);
}
