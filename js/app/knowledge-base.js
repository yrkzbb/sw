let knowledgeBasePollTimer = null;

function renderKnowledgeBaseCatalog(items = []) {
  if (!el.knowledgeBaseList) return;
  if (!items.length) {
    el.knowledgeBaseList.innerHTML = `<div class="course-kb-empty">尚未导入课程文档。上传一门完整课程的电子书、教材或讲义后，系统会建立本地私有知识库。</div>`;
    return;
  }
  el.knowledgeBaseList.innerHTML = items.map((item) => `
    <article class="course-kb-card">
      <div><strong>${escapeHtml(item.course || item.title || "高校专业课程")}</strong><span>${escapeHtml(item.title || item.filename || "课程文档")}</span></div>
      <dl><div><dt>页数</dt><dd>${Number(item.page_count || 0)}</dd></div><div><dt>检索片段</dt><dd>${Number(item.chunk_count || 0)}</dd></div><div><dt>解析方式</dt><dd>${escapeHtml(item.extraction || "PDF")}</dd></div></dl>
      <em>本地私有知识库 · 已作为系统输入</em>
    </article>`).join("");
}

async function loadKnowledgeBaseCatalog() {
  if (!el.knowledgeBaseList) return [];
  try {
    const response = await fetch("/api/knowledge-base");
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "知识库加载失败");
    const items = Array.isArray(data?.items) ? data.items : [];
    renderKnowledgeBaseCatalog(items);
    return items;
  } catch (error) {
    el.knowledgeBaseList.innerHTML = `<div class="course-kb-empty">${escapeHtml(String(error?.message || error))}</div>`;
    return [];
  }
}

function renderKnowledgeBaseTask(task) {
  if (!el.knowledgeBaseTask) return;
  el.knowledgeBaseTask.hidden = false;
  const progress = Math.max(0, Math.min(100, Number(task?.progress || 0)));
  el.knowledgeBaseTask.innerHTML = `
    <div><strong>${escapeHtml(task?.originalName || "课程PDF")}</strong><em>${progress}%</em></div>
    <span>${escapeHtml(task?.message || "正在处理")}</span>
    <i><b style="width:${progress}%"></b></i>`;
}

async function pollKnowledgeBaseTask(taskId) {
  window.clearTimeout(knowledgeBasePollTimer);
  try {
    const response = await fetch(`/api/knowledge-base/tasks/${encodeURIComponent(taskId)}`);
    const task = await response.json().catch(() => null);
    if (!response.ok) throw new Error(task?.error || "知识库任务查询失败");
    renderKnowledgeBaseTask(task);
    if (task.status === "completed") {
      await loadKnowledgeBaseCatalog();
      return;
    }
    if (task.status === "failed") return;
    knowledgeBasePollTimer = window.setTimeout(() => void pollKnowledgeBaseTask(taskId), 1500);
  } catch (error) {
    renderKnowledgeBaseTask({ progress: 0, message: String(error?.message || error), status: "failed" });
  }
}

async function uploadKnowledgeBasePdf(file) {
  if (!file) return;
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return alert("请选择 PDF 文件");
  if (file.size > 80 * 1024 * 1024) return alert("PDF 文件不能超过 80MB");
  renderKnowledgeBaseTask({ originalName: file.name, progress: 0, message: "正在上传PDF" });
  try {
    const response = await fetch("/api/knowledge-base/upload", {
      method: "POST",
      headers: { "Content-Type": "application/pdf", "X-File-Name": encodeURIComponent(file.name) },
      body: file,
    });
    const task = await response.json().catch(() => null);
    if (!response.ok) throw new Error(task?.error || "PDF上传失败");
    renderKnowledgeBaseTask(task);
    void pollKnowledgeBaseTask(task.id);
  } catch (error) {
    renderKnowledgeBaseTask({ originalName: file.name, progress: 0, message: String(error?.message || error), status: "failed" });
  } finally {
    if (el.knowledgeBasePdfInput) el.knowledgeBasePdfInput.value = "";
  }
}

async function searchCourseKnowledge(query, limit = 6) {
  const text = String(query || "").trim();
  if (!text) return [];
  try {
    const response = await fetch(`/api/knowledge-base/search?q=${encodeURIComponent(text)}&limit=${limit}`);
    const data = await response.json().catch(() => null);
    return response.ok && Array.isArray(data?.results) ? data.results : [];
  } catch {
    return [];
  }
}

function formatCourseKnowledgeForPrompt(results = []) {
  if (!results.length) return "当前课程知识库没有召回相关片段。";
  return results.map((item, index) => [
    `[课程知识库片段 ${index + 1}]`,
    `课程：${item.course || "高校专业课程"}`,
    `文档：${item.title || "课程文档"}`,
    `位置：${item.page ? `PDF第${item.page}页` : item.section || "正文"}`,
    `内容：${item.text}`,
  ].join("\n")).join("\n\n");
}

function initKnowledgeBase() {
  el.knowledgeBasePdfInput?.addEventListener("change", () => void uploadKnowledgeBasePdf(el.knowledgeBasePdfInput.files?.[0]));
  void loadKnowledgeBaseCatalog();
}
