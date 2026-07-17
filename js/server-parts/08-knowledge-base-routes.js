const pdfParse = require("pdf-parse");
const KNOWLEDGE_BASE_DIR = path.join(RUNTIME_DIR, "knowledge-base");
const KNOWLEDGE_TASKS = new Map();
fs.mkdirSync(KNOWLEDGE_BASE_DIR, { recursive: true });

function knowledgeSafeName(value) {
  return String(value || "course-book.pdf").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120) || "course-book.pdf";
}

function readRawBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("PDF 文件过大，当前上限为 80MB"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function writeKnowledgeMeta(dir, meta) {
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));
}

function runKnowledgeCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} 执行失败：${stderr.slice(-500)}`)));
  });
}

function chunkKnowledgeText(text, source) {
  const clean = String(text || "").replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}/).map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
  const chunks = [];
  let buffer = "";
  for (const paragraph of paragraphs) {
    if (buffer && buffer.length + paragraph.length > 1100) {
      chunks.push({ ...source, text: buffer, length: buffer.length });
      buffer = `${buffer.slice(-160)} ${paragraph}`;
    } else {
      buffer = buffer ? `${buffer}\n${paragraph}` : paragraph;
    }
  }
  if (buffer) chunks.push({ ...source, text: buffer, length: buffer.length });
  return chunks;
}

async function ocrScannedPdf(pdfPath, dir, task) {
  const pagesDir = path.join(dir, "ocr-pages");
  fs.mkdirSync(pagesDir, { recursive: true });
  task.stage = "rendering";
  task.message = "扫描版PDF正在转换为OCR页面";
  await runKnowledgeCommand(process.env.PDFTOPPM_BIN || "pdftoppm", ["-jpeg", "-r", "135", pdfPath, path.join(pagesDir, "page")]);
  const pageFiles = fs.readdirSync(pagesDir).filter((name) => /\.jpg$/i.test(name)).sort();
  const pageChunks = new Array(pageFiles.length);
  let processed = 0;
  async function recognizePage(index) {
    const pageNumber = index + 1;
    const imagePath = path.join(pagesDir, pageFiles[index]);
    const outputBase = path.join(pagesDir, `text-${String(pageNumber).padStart(4, "0")}`);
    await runKnowledgeCommand(process.env.TESSERACT_BIN || "tesseract", [imagePath, outputBase, "-l", "chi_sim+eng", "--psm", "6"]);
    const textPath = `${outputBase}.txt`;
    const text = fs.existsSync(textPath) ? fs.readFileSync(textPath, "utf-8") : "";
    pageChunks[index] = chunkKnowledgeText(text, { page: pageNumber, section: `PDF第${pageNumber}页`, extraction: "ocr" });
    fs.rmSync(imagePath, { force: true });
    fs.rmSync(textPath, { force: true });
    processed += 1;
    task.stage = "ocr";
    task.progress = Math.max(2, Math.round((processed / pageFiles.length) * 94));
    task.message = `已识别 ${processed}/${pageFiles.length} 页`;
  }
  const concurrency = Math.max(1, Math.min(8, Number(process.env.KNOWLEDGE_OCR_CONCURRENCY || 6)));
  for (let start = 0; start < pageFiles.length; start += concurrency) {
    await Promise.all(pageFiles.slice(start, start + concurrency).map((_, offset) => recognizePage(start + offset)));
  }
  fs.rmSync(pagesDir, { recursive: true, force: true });
  return pageChunks.flat();
}

async function buildPdfKnowledgeBase(taskId, dir, pdfPath, originalName) {
  const task = KNOWLEDGE_TASKS.get(taskId);
  try {
    task.status = "processing";
    task.stage = "extracting";
    task.message = "正在检测PDF文本层";
    const parsed = await pdfParse(fs.readFileSync(pdfPath));
    let chunks = [];
    if (String(parsed.text || "").replace(/\s/g, "").length > 1500) {
      chunks = chunkKnowledgeText(parsed.text, { page: null, section: "PDF正文", extraction: "text-layer" });
      task.progress = 80;
    } else {
      task.message = "检测到扫描版PDF，切换中文OCR";
      chunks = await ocrScannedPdf(pdfPath, dir, task);
    }
    chunks = chunks.map((chunk, index) => ({ id: `${taskId}-${index + 1}`, ...chunk }));
    fs.writeFileSync(path.join(dir, "chunks.json"), JSON.stringify(chunks));
    const meta = {
      id: taskId,
      title: originalName.replace(/\.pdf$/i, ""),
      filename: originalName,
      course: /机器学习/.test(originalName) ? "机器学习" : "高校专业课程",
      document_type: "课程电子书PDF",
      page_count: parsed.numpages || 0,
      chunk_count: chunks.length,
      extraction: chunks.some((item) => item.extraction === "ocr") ? "OCR" : "PDF文本层",
      private_local_source: true,
      course_structure: /机器学习/.test(originalName) ? {
        level: "高校计算机/人工智能专业核心课程",
        suggested_hours: 64,
        prerequisites: ["高等数学", "线性代数", "概率论与数理统计", "Python程序设计"],
        learning_outcomes: ["理解机器学习基本概念与模型评估方法", "掌握监督学习与无监督学习主要算法", "能够完成模型训练、调参与误差分析", "理解学习理论、概率图模型与强化学习基础"],
        chapters: ["绪论", "模型评估与选择", "线性模型", "决策树", "神经网络", "支持向量机", "贝叶斯分类器", "集成学习", "聚类", "降维与度量学习", "特征选择与稀疏学习", "计算学习理论", "半监督学习", "概率图模型", "规则学习", "强化学习"],
        suggested_labs: ["西瓜数据集模型评估", "线性与逻辑回归", "决策树构建与剪枝", "神经网络分类实验", "支持向量机核函数比较", "集成学习与聚类综合实验"],
        assessment: { exercises: "章节练习与错题复盘", labs: "6个课程实验", final_project: "完成一个端到端机器学习项目" },
      } : null,
      created_at: new Date().toISOString(),
    };
    writeKnowledgeMeta(dir, meta);
    task.status = "completed";
    task.stage = "completed";
    task.progress = 100;
    task.message = `知识库构建完成，共 ${chunks.length} 个检索片段`;
    task.meta = meta;
  } catch (error) {
    task.status = "failed";
    task.stage = "failed";
    task.message = String(error?.message || error);
  }
}

function listKnowledgeBases() {
  return fs.readdirSync(KNOWLEDGE_BASE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const metaPath = path.join(KNOWLEDGE_BASE_DIR, entry.name, "meta.json");
      if (!fs.existsSync(metaPath)) return null;
      try { return JSON.parse(fs.readFileSync(metaPath, "utf-8")); } catch { return null; }
    }).filter(Boolean);
}

function knowledgeTokens(value) {
  const stopwords = new Set(["什么", "如何", "怎么", "解释", "基本", "过程", "含义", "核心", "步骤", "为什么", "使用", "区别", "判断", "介绍", "其中", "进行"]);
  const text = String(value || "").toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, " ");
  const words = text.split(/\s+/).filter((item) => item.length > 1 && !stopwords.has(item));
  const latin = text.match(/[a-z][a-z0-9+#-]{1,}/g) || [];
  const chinese = [...text.matchAll(/[\u4e00-\u9fff]{2,}/g)].flatMap((match) => {
    const word = match[0];
    return [word, ...Array.from({ length: Math.max(0, word.length - 1) }, (_, index) => word.slice(index, index + 2))];
  });
  return [...new Set([...words, ...latin, ...chinese].filter((item) => !stopwords.has(item)))];
}

function searchLocalKnowledge(query, limit = 6) {
  const tokens = knowledgeTokens(query);
  const results = [];
  for (const base of listKnowledgeBases()) {
    const chunksPath = path.join(KNOWLEDGE_BASE_DIR, base.id, "chunks.json");
    if (!fs.existsSync(chunksPath)) continue;
    let chunks = [];
    try { chunks = JSON.parse(fs.readFileSync(chunksPath, "utf-8")); } catch { continue; }
    for (const chunk of chunks) {
      const haystack = `${base.course} ${base.title} ${chunk.section || ""} ${chunk.text}`.toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? Math.min(5, token.length) : 0), 0);
      if (score >= 6) results.push({ score, knowledge_base: base.id, course: base.course, title: base.title, page: chunk.page, section: chunk.section, text: chunk.text.slice(0, 1400), extraction: chunk.extraction });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(12, limit)));
}

async function uploadKnowledgeBase(req, res) {
  setCors(res);
  const buffer = await readRawBody(req, 80 * 1024 * 1024).catch((error) => {
    sendJson(res, 400, { error: String(error?.message || error) });
    return null;
  });
  if (!buffer) return;
  if (buffer.slice(0, 4).toString() !== "%PDF") return sendJson(res, 400, { error: "只支持有效PDF文件" });
  const originalName = knowledgeSafeName(decodeURIComponent(String(req.headers["x-file-name"] || "course-book.pdf")));
  const taskId = crypto.randomUUID();
  const dir = path.join(KNOWLEDGE_BASE_DIR, taskId);
  fs.mkdirSync(dir, { recursive: true });
  const pdfPath = path.join(dir, "source.pdf");
  fs.writeFileSync(pdfPath, buffer);
  const task = { id: taskId, status: "queued", stage: "queued", progress: 0, message: "已上传，等待解析", originalName };
  KNOWLEDGE_TASKS.set(taskId, task);
  setImmediate(() => void buildPdfKnowledgeBase(taskId, dir, pdfPath, originalName));
  sendJson(res, 202, task);
}

function getKnowledgeTask(req, res, taskId) {
  const task = KNOWLEDGE_TASKS.get(taskId);
  if (!task) return sendJson(res, 404, { error: "知识库任务不存在或服务已重启" });
  sendJson(res, 200, task);
}

function getKnowledgeCatalog(req, res) {
  sendJson(res, 200, { items: listKnowledgeBases() });
}

function searchKnowledgeRoute(req, res, url) {
  const query = String(url.searchParams.get("q") || "").trim();
  if (!query) return sendJson(res, 400, { error: "缺少检索问题" });
  sendJson(res, 200, { query, results: searchLocalKnowledge(query, Number(url.searchParams.get("limit") || 6)) });
}
