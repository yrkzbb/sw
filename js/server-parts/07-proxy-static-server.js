function copyUpstreamHeaders(upstream, res) {
  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "content-length") res.setHeader(key, value);
  });
  if (!res.getHeader("Content-Type")) {
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "text/event-stream");
  }
}

async function proxyChat(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!LINGXI_API_KEY) {
    sendJson(res, 500, {
      error:
        "Missing OPENAI_PROXY_API_KEY. Set it in .env or as an environment variable.",
    });
    return;
  }

  const controller = new AbortController();
  req.on("aborted", () => controller.abort());
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;

  let upstream;
  try {
    upstream = await fetch(OPENAI_PROXY_CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINGXI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (!res.headersSent) {
      const message = controller.signal.aborted
        ? "Request aborted"
        : `Proxy request failed: ${String(e?.message || e)}`;
      sendJson(res, controller.signal.aborted ? 499 : 502, { error: message });
    }
    return;
  }

  copyUpstreamHeaders(upstream, res);

  const webBody = upstream.body;
  if (!webBody) {
    res.end((await upstream.text().catch(() => "")) || "");
    return;
  }

  await pipeline(Readable.fromWeb(webBody), res).catch(() => {});
}

async function proxyVideo(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;

  if (VIDEO_PROVIDER === "dashscope_wan") {
    await proxyDashScopeWan(body, res);
    return;
  }

  if (!VIDEO_API_URL) {
    sendJson(res, 501, {
      error:
        "Missing LINGXI_VIDEO_API_URL. Set it to your video generation or digital human API endpoint.",
    });
    return;
  }

  try {
    const upstream = await fetch(VIDEO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(VIDEO_API_KEY ? { Authorization: `Bearer ${VIDEO_API_KEY}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const contentType = upstream.headers.get("content-type") || JSON_UTF8;
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", contentType);
    res.end(await upstream.text());
  } catch (e) {
    sendJson(res, 502, { error: `Video API request failed: ${String(e?.message || e)}` });
  }
}

function dashScopeBaseUrl() {
  if (DASHSCOPE_WORKSPACE_ID) {
    return `https://${DASHSCOPE_WORKSPACE_ID}.${DASHSCOPE_REGION}.maas.aliyuncs.com`;
  }
  return "https://dashscope.aliyuncs.com";
}

function dashScopeVideoSize() {
  const resolution = DASHSCOPE_VIDEO_RESOLUTION.toUpperCase();
  if (resolution === "720P") return "1280*720";
  if (resolution === "1080P") return "1920*1080";
  return "832*480";
}

function buildWanPrompt(body) {
  const scenes = Array.isArray(body.scenes) ? body.scenes : [];
  const sceneText = scenes
    .slice(0, 6)
    .map((scene, index) => {
      const title = String(scene?.title || `片段${index + 1}`).trim();
      const narration = String(scene?.narration || scene?.visual || "").trim();
      const visual = String(scene?.visual || "").trim();
      return `${index + 1}. ${title}：${visual || narration}`;
    })
    .join("；");
  const title = String(body.title || "教学视频").trim();
  const prompt = String(body.prompt || "").trim();
  return [
    `生成一段“老师正在讲授知识点”的短课视频，主题是“${title}”。`,
    "核心目标：让观众感觉自己正在听老师讲这一个知识点，而不是看教育科技广告。画面要有明确授课行为：老师讲解、指向白板/黑板、画示意图、拆解例子、学生视角听课。",
    "场景：真实普通教室、大学小课堂、辅导课桌面或线上课程录制间。老师 25-45 岁，穿日常教师风格服装或商务休闲服，不能穿学生校服，不能像广告模特摆拍。",
    "镜头语言：固定机位或轻微推拉。优先中景老师讲解、手部写板书、白板图示、学生笔记本视角、老师指点示意图。镜头要服务“讲清知识点”，不要炫技，不要宣传片剪辑。",
    "板书/图示：可以出现简洁几何图形、箭头、圆圈、流程框、手绘示意、公式形状和无字图表；尽量避免可读文字。中文标题和字幕会由网页前端叠加，不需要模型生成。",
    "画面节奏：开头老师引入概念，中间指向图示解释关系，结尾回到学生笔记或老师总结。保留下方字幕安全区，不要把主体放在底部 18%。",
    "硬性禁止：教育科技宣传片、品牌广告感、学生制服、校徽、夸张微笑摆拍、二次元、卡通、PPT整页展示、乱码文字、可读字幕、水印、logo、畸形手指、多人杂乱场景。",
    prompt ? `授课镜头补充：${prompt}` : "",
    sceneText ? `授课要点参考，只理解含义，不要把这些文字直接画进视频：${sceneText}` : "",
  ].filter(Boolean).join("\n");
}

async function proxyDashScopeWan(body, res) {
  if (!DASHSCOPE_API_KEY) {
    sendJson(res, 500, { error: "Missing DASHSCOPE_API_KEY in .env" });
    return;
  }

  const action = String(body.action || "generate");
  const baseUrl = dashScopeBaseUrl();
  try {
    if (action === "config") {
      sendJson(res, 200, {
        provider: "dashscope_wan",
        model: DASHSCOPE_VIDEO_MODEL,
        resolution: DASHSCOPE_VIDEO_RESOLUTION,
        duration: Math.min(15, Math.max(2, DASHSCOPE_VIDEO_DURATION || 5)),
        billing_notice: "这是付费视频生成 API，提交任务后可能立即计费。",
      });
      return;
    }

    if (action === "status") {
      const taskId = String(body.task_id || body.taskId || "").trim();
      if (!taskId) {
        sendJson(res, 400, { error: "Missing task_id" });
        return;
      }
      const upstream = await fetch(`${baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        },
      });
      const text = await upstream.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        sendJson(res, upstream.status, { error: text || upstream.statusText });
        return;
      }
      sendJson(res, upstream.status, normalizeDashScopeTask(json));
      return;
    }

    const prompt = buildWanPrompt(body);
    const upstream = await fetch(`${baseUrl}/api/v1/services/aigc/video-generation/video-synthesis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: DASHSCOPE_VIDEO_MODEL,
        input: { prompt },
        parameters: {
          size: dashScopeVideoSize(),
          duration: Math.min(15, Math.max(2, DASHSCOPE_VIDEO_DURATION || 5)),
          prompt_extend: true,
          watermark: false,
        },
      }),
    });
    const text = await upstream.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      sendJson(res, upstream.status, { error: text || upstream.statusText });
      return;
    }
    sendJson(res, upstream.status, normalizeDashScopeTask(json, { prompt }));
  } catch (e) {
    sendJson(res, 502, { error: `DashScope video request failed: ${String(e?.message || e)}` });
  }
}

function normalizeDashScopeTask(json, extra = {}) {
  const output = json?.output || {};
  const results = output?.results || output?.video || {};
  const videoUrl =
    output.video_url ||
    output.videoUrl ||
    results.video_url ||
    results.url ||
    output.url ||
    "";
  return {
    provider: "dashscope_wan",
    raw: json,
    request_id: json?.request_id || json?.requestId || "",
    task_id: output.task_id || output.taskId || json?.task_id || json?.taskId || "",
    task_status: output.task_status || output.taskStatus || json?.task_status || json?.status || "",
    video_url: videoUrl,
    error: output.message || json?.message || json?.error?.message || "",
    ...extra,
  };
}

function serveStatic(req, res, pathname) {
  const reqPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = safeJoin(ROOT_DIR, decodeURIComponent(reqPath));
  if (!filePath) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }
    res.setHeader("Content-Type", getMimeType(filePath));
    const rs = fs.createReadStream(filePath);
    rs.on("error", () => {
      res.statusCode = 500;
      res.end("Read Error");
    });
    rs.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/api/auth/register" && req.method === "POST") {
      void registerUser(req, res);
      return;
    }
    if (url.pathname === "/api/auth/login" && req.method === "POST") {
      void loginUser(req, res);
      return;
    }
    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      void logoutUser(req, res);
      return;
    }
    if (url.pathname === "/api/auth/me" && req.method === "GET") {
      void getAuthMe(req, res);
      return;
    }
    if (url.pathname === "/api/auth/profile" && req.method === "PUT") {
      void updateAuthProfile(req, res);
      return;
    }
    if (url.pathname === "/api/auth/password" && req.method === "PUT") {
      void updateAuthPassword(req, res);
      return;
    }
    if (url.pathname === "/api/announcements" && req.method === "GET") {
      void getPublicAnnouncements(req, res);
      return;
    }
    if (url.pathname.startsWith("/api/admin/") && handleAdminRoute(req, res, url)) {
      return;
    }
    if (url.pathname === "/api/user-data" && req.method === "GET") {
      void getUserData(req, res);
      return;
    }
    if (url.pathname === "/api/user-data" && req.method === "PUT") {
      void saveUserData(req, res);
      return;
    }
    if (url.pathname === "/api/user-data" && req.method === "DELETE") {
      void deleteUserData(req, res);
      return;
    }
    if (url.pathname === "/api/chat" && (req.method === "POST" || req.method === "OPTIONS")) {
      void proxyChat(req, res);
      return;
    }
    if (url.pathname === "/api/video" && (req.method === "POST" || req.method === "OPTIONS")) {
      void proxyVideo(req, res);
      return;
    }
    if (url.pathname === "/admin") {
      serveStatic(req, res, "/admin.html");
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch {
    res.statusCode = 400;
    res.end("Bad Request");
  }
});

server.listen(PORT, () => {
  console.log(`[lingxi] Server listening on http://localhost:${PORT}`);
  console.log(`[lingxi] Proxy base URL: ${OPENAI_PROXY_BASE_URL}`);
  console.log(`[lingxi] Run from lingxi folder: node js/server.js`);
});
