function copyUpstreamHeaders(upstream, res) {
  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "content-length") res.setHeader(key, value);
  });
  if (!res.getHeader("Content-Type")) {
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "text/event-stream");
  }
}

function chatMessagePlainText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => typeof part?.text === "string" ? part.text : "").join("\n");
}

function validateChatSafety(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length || messages.length > 80) return { ok: false, error: "消息数量不符合安全限制" };
  const oversized = messages.some((message) => chatMessagePlainText(message?.content).length > 60000);
  if (oversized) return { ok: false, error: "单条消息过长，请缩短内容后重试" };
  const lastUser = [...messages].reverse().find((message) => message?.role === "user");
  const text = chatMessagePlainText(lastUser?.content);
  const harmfulPatterns = [
    /(窃取|盗取|套取|获取).{0,12}(密码|验证码|token|cookie|密钥)|(钓鱼|木马).{0,12}(页面|脚本|邮件)/i,
    /(编写|制作|生成|提供).{0,12}(勒索软件|病毒|蠕虫|木马|恶意软件)/i,
    /(教我|步骤|教程|如何|怎么).{0,10}(制造炸弹|制作爆炸物|投毒|伤害他人)/i,
    /(教我|告诉我|步骤|最有效).{0,12}(自杀|自残|结束生命)/i,
    /(未成年|儿童|幼童).{0,12}(色情|性行为|裸照)/i,
  ];
  if (harmfulPatterns.some((pattern) => pattern.test(text))) {
    return { ok: false, error: "请求未通过内容安全审核，可改为防护、识别、合规分析或安全教育问题" };
  }
  return { ok: true };
}

async function proxyChat(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!XFYUN_SPARK_API_PASSWORD) {
    sendJson(res, 500, {
      error:
        "Missing XFYUN_SPARK_API_PASSWORD. Set it in .env or as an environment variable.",
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
  const safety = validateChatSafety(body);
  if (!safety.ok) {
    sendJson(res, 400, { error: safety.error, code: "CONTENT_SAFETY_BLOCKED" });
    return;
  }

  let upstream;
  try {
    upstream = await fetch(XFYUN_SPARK_CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${XFYUN_SPARK_API_PASSWORD}`,
      },
      body: JSON.stringify({ ...body, model: XFYUN_SPARK_MODEL }),
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

const BILIBILI_EDUCATION_CATALOG = [
  { bvid: "BV1otokBpENn", keywords: "知识库 RAG 检索增强 向量数据库 大模型 AI" },
  { bvid: "BV1FUQ7YREDE", keywords: "知识库 RAG DeepSeek Ollama 本地部署 AI" },
  { bvid: "BV1AVfZY4Evf", keywords: "知识库 Coze 扣子 智能体 教程 AI" },
  { bvid: "BV1Fsd8YeExh", keywords: "RAG 知识库 LangChain 索引 工作原理 AI" },
  { bvid: "BV1jW411K7yg", keywords: "数据结构 算法 C 语言 链表 树 图 排序" },
  { bvid: "BV15E411V7S2", keywords: "数据结构 算法 大学 公开课 考研 408" },
  { bvid: "BV1tU411U7SF", keywords: "Java 数据结构 算法 编程 实战" },
  { bvid: "BV1iJ41137Vd", keywords: "数据库 SQL MySQL 关系型数据库 教程" },
  { bvid: "BV1hccSeJEUD", keywords: "RAG LangChain LlamaIndex 企业知识库 项目实战" },
  { bvid: "BV1rsSiYKEun", keywords: "AnythingLLM Ollama 本地 AI 知识库 零代码" },
];

function videoSearchTerms(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#]+/gu, " ");
  const words = normalized
    .split(/\s+/)
    .filter((item) => item.length > 1)
    .slice(0, 16);
  const compactChinese = normalized.replace(/[^\p{Script=Han}]/gu, "");
  const bigrams = [];
  for (let index = 0; index < compactChinese.length - 1 && bigrams.length < 40; index += 1) {
    bigrams.push(compactChinese.slice(index, index + 2));
  }
  return Array.from(new Set([...words, ...bigrams]));
}

function bilibiliSearchUrl(query) {
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`;
}

function bilibiliApiHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    Referer: "https://search.bilibili.com/",
    Accept: "application/json,text/plain,*/*",
  };
}

function formatVideoDuration(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = Math.floor(value % 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function normalizeVideoDurationText(value) {
  const parts = String(value || "").trim().split(":");
  if (parts.length < 2 || parts.some((part) => !/^\d+$/.test(part))) return String(value || "").trim();
  return parts.map((part, index) => index === 0 ? String(Number(part)) : part.padStart(2, "0")).join(":");
}

function formatVideoViews(value) {
  const count = Math.max(0, Number(value) || 0);
  if (count >= 10000) return `${(count / 10000).toFixed(count >= 100000 ? 1 : 2).replace(/\.0$/, "")} 万播放`;
  return `${count} 播放`;
}

function normalizeBilibiliImage(value) {
  const image = String(value || "").replace(/^\/\//, "https://").replace(/^http:\/\//, "https://");
  return image;
}

function stripBilibiliTitle(value) {
  return String(value || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
}

function normalizeBilibiliSearchItem(item) {
  const bvid = String(item?.bvid || "").trim();
  if (!bvid) return null;
  return {
    id: bvid,
    bvid,
    title: stripBilibiliTitle(item.title),
    author: String(item.author || item.up_name || "哔哩哔哩 UP 主"),
    duration: normalizeVideoDurationText(item.duration),
    views: formatVideoViews(item.play),
    url: `https://www.bilibili.com/video/${bvid}/`,
    cover: normalizeBilibiliImage(item.pic),
    source: "哔哩哔哩",
  };
}

async function fetchBilibiliSearchResults(query) {
  const endpoint = new URL("https://api.bilibili.com/x/web-interface/wbi/search/type");
  endpoint.searchParams.set("search_type", "video");
  endpoint.searchParams.set("keyword", query);
  endpoint.searchParams.set("page", "1");
  endpoint.searchParams.set("page_size", "8");
  const response = await fetch(endpoint, { headers: bilibiliApiHeaders(), signal: AbortSignal.timeout(6500) });
  if (!response.ok) return [];
  const payload = await response.json().catch(() => null);
  const rows = payload?.data?.result;
  return Array.isArray(rows) ? rows.map(normalizeBilibiliSearchItem).filter(Boolean).slice(0, 4) : [];
}

async function fetchBilibiliVideoDetail(entry) {
  const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(entry.bvid)}`, {
    headers: bilibiliApiHeaders(),
    signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const item = payload?.data;
  if (!item?.bvid || Number(item.state) < 0) return null;
  return {
    id: item.bvid,
    bvid: item.bvid,
    title: stripBilibiliTitle(item.title),
    author: String(item.owner?.name || "哔哩哔哩 UP 主"),
    duration: formatVideoDuration(item.duration),
    views: formatVideoViews(item.stat?.view),
    url: `https://www.bilibili.com/video/${item.bvid}/`,
    cover: normalizeBilibiliImage(item.pic),
    source: "哔哩哔哩",
  };
}

async function curatedBilibiliResults(query) {
  const terms = videoSearchTerms(query);
  const ranked = BILIBILI_EDUCATION_CATALOG.map((item, index) => ({
    ...item,
    score: terms.reduce((sum, term) => sum + (item.keywords.toLowerCase().includes(term) ? (term.length > 2 ? 8 : 3) : 0), 0) - index * 0.01,
  })).sort((a, b) => b.score - a.score).slice(0, 4);
  const details = await Promise.all(ranked.map((item) => fetchBilibiliVideoDetail(item).catch(() => null)));
  return details.filter(Boolean);
}

async function searchBilibiliEducation(req, res, url) {
  setCors(res);
  const query = String(url.searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!query) {
    sendJson(res, 400, { error: "缺少搜索关键词" });
    return;
  }
  const liveResults = await fetchBilibiliSearchResults(query).catch(() => []);
  const results = liveResults.length ? liveResults : await curatedBilibiliResults(query);
  sendJson(res, 200, {
    query,
    provider: liveResults.length ? "bilibili-live-search" : "bilibili-verified-catalog",
    realtime: Boolean(liveResults.length),
    notice: liveResults.length
      ? "已获取哔哩哔哩实时视频结果，点击卡片可直接播放。"
      : "实时搜索受平台访问限制，已返回经核验的具体视频；播放量与封面来自视频详情接口。",
    results,
  });
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

  const requestProvider = String(body.provider || VIDEO_PROVIDER || "").trim();
  if (requestProvider === "dashscope_wan") {
    await proxyDashScopeWan(body, res);
    return;
  }
  if (requestProvider === "xunfei_virtual_human" || requestProvider === "xunfei_vms") {
    await proxyXunfeiVms(body, res);
    return;
  }

  if (!VIDEO_API_URL) {
    sendJson(res, 501, {
      error:
        "Missing XUNFEI_DIGITAL_HUMAN_API_URL or LINGXI_VIDEO_API_URL. Set it to your digital human or video generation API endpoint.",
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

function xunfeiVmsUrl(pathname) {
  const date = new Date().toUTCString();
  const requestLine = `POST ${pathname} HTTP/1.1`;
  const signatureOrigin = `host: ${XUNFEI_VMS_HOST}\ndate: ${date}\n${requestLine}`;
  const signature = crypto
    .createHmac("sha256", XUNFEI_VMS_API_SECRET)
    .update(signatureOrigin)
    .digest("base64");
  const authorizationOrigin =
    `api_key="${XUNFEI_VMS_API_KEY}",algorithm="hmac-sha256",headers="host date request-line",signature="${signature}"`;
  const url = new URL(`${XUNFEI_VMS_BASE_URL}${pathname}`);
  url.searchParams.set("host", XUNFEI_VMS_HOST);
  url.searchParams.set("date", date);
  url.searchParams.set("authorization", Buffer.from(authorizationOrigin).toString("base64"));
  return url;
}

async function xunfeiVmsRequest(pathname, body) {
  const upstream = await fetch(xunfeiVmsUrl(pathname), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await upstream.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text || upstream.statusText };
  }
  if (!upstream.ok || Number(json?.header?.code || 0) !== 0) {
    const message = json?.header?.message || json?.message || json?.error || upstream.statusText;
    const err = new Error(`Xunfei VMS request failed: ${message}`);
    err.status = upstream.status;
    err.vmsCode = Number(json?.header?.code || 0);
    err.response = json;
    throw err;
  }
  return json;
}

function xunfeiBase64Text(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function decodeXunfeiPayloadText(item) {
  if (!item || typeof item !== "object") return "";
  const value = String(item.text || "").trim();
  if (!value) return "";
  if (String(item.encoding || "").toLowerCase() !== "utf8") return value;
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return value;
  }
}

const xunfeiHlsProcesses = new Map();
let xunfeiActiveSession = null;

function ensureHlsDir(streamId) {
  fs.mkdirSync(HLS_DIR, { recursive: true });
  const dir = safeJoin(HLS_DIR, streamId);
  if (!dir) throw new Error("Invalid HLS stream id");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeHlsUrl(streamId) {
  return `/api/video/hls/${encodeURIComponent(streamId)}/index.m3u8`;
}

function stopHlsTranscoder(streamId) {
  const item = xunfeiHlsProcesses.get(streamId);
  if (!item) return;
  xunfeiHlsProcesses.delete(streamId);
  item.process.kill("SIGTERM");
}

async function stopXunfeiActiveSession(commonHeader, skipSession = "") {
  const active = xunfeiActiveSession;
  if (!active?.session || active.session === skipSession) return;
  xunfeiActiveSession = null;
  if (active.hls_stream_id) stopHlsTranscoder(active.hls_stream_id);
  await xunfeiVmsRequest("/v1/private/vms2d_stop", {
    header: { ...commonHeader, session: active.session },
  }).catch(() => {});
}

function startHlsTranscoder(rtmpUrl, session) {
  if (!XUNFEI_VMS_TRANSCODE_HLS || !/^rtmp:\/\//i.test(String(rtmpUrl || ""))) return null;
  const streamId = crypto.createHash("sha1").update(`${session}:${rtmpUrl}:${Date.now()}`).digest("hex").slice(0, 16);
  const dir = ensureHlsDir(streamId);
  const playlistPath = path.join(dir, "index.m3u8");
  const args = [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-i",
    rtmpUrl,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-c:a",
    "aac",
    "-f",
    "hls",
    "-hls_time",
    "1",
    "-hls_list_size",
    "6",
    "-hls_flags",
    "delete_segments+append_list+independent_segments",
    "-hls_segment_filename",
    path.join(dir, "segment_%03d.ts"),
    playlistPath,
  ];
  const child = spawn(FFMPEG_BIN, args, { stdio: ["ignore", "ignore", "pipe"] });
  let lastError = "";
  child.stderr.on("data", (chunk) => {
    lastError = String(chunk).trim().slice(-1000);
  });
  child.on("exit", () => {
    xunfeiHlsProcesses.delete(streamId);
  });
  xunfeiHlsProcesses.set(streamId, {
    process: child,
    session,
    playlistPath,
    startedAt: Date.now(),
    get lastError() {
      return lastError;
    },
  });
  setTimeout(() => stopHlsTranscoder(streamId), 4 * 60 * 1000).unref?.();
  return {
    hls_stream_id: streamId,
    hls_url: makeHlsUrl(streamId),
  };
}

function normalizeXunfeiVms(startJson, ctrlJson) {
  const streamUrl =
    startJson?.header?.stream_url ||
    decodeXunfeiPayloadText(startJson?.payload?.stream_url) ||
    "";
  const session = startJson?.header?.session || ctrlJson?.header?.session || "";
  const hls = startHlsTranscoder(streamUrl, session) || {};
  xunfeiActiveSession = {
    session,
    hls_stream_id: hls.hls_stream_id || "",
    startedAt: Date.now(),
  };
  return {
    provider: "xunfei_virtual_human",
    session,
    sid: ctrlJson?.header?.sid || startJson?.header?.sid || "",
    stream_url: streamUrl,
    embed_url: streamUrl,
    ...hls,
    raw: {
      start: startJson,
      ctrl: ctrlJson,
    },
  };
}

function resolveXunfeiAvatarId(body) {
  const candidate = String(body.avatar_id || body.avatarId || body.avatar || "").trim();
  if (/^\d+$/.test(candidate)) return candidate;
  return XUNFEI_VMS_AVATAR_ID;
}

function resolveXunfeiVcn(body) {
  const candidate = String(body.vcn || body.voice || "").trim();
  if (/^x[34]_/i.test(candidate)) return candidate;
  return XUNFEI_VMS_VCN;
}

async function proxyXunfeiVms(body, res) {
  if (!XUNFEI_VMS_APP_ID || !XUNFEI_VMS_API_KEY || !XUNFEI_VMS_API_SECRET) {
    sendJson(res, 500, {
      error:
        "Missing XUNFEI_VMS_APP_ID, XUNFEI_VMS_API_KEY, or XUNFEI_VMS_API_SECRET in .env",
    });
    return;
  }

  const action = String(body.action || "generate").trim();
  const session = String(body.session || body.session_id || "").trim();
  const commonHeader = {
    app_id: XUNFEI_VMS_APP_ID,
    uid: String(body.uid || XUNFEI_VMS_UID || ""),
  };

  try {
    if (action === "ping" || action === "stop") {
      if (!session) {
        sendJson(res, 400, { error: "Missing session" });
        return;
      }
      const pathname = action === "ping" ? "/v1/private/vms2d_ping" : "/v1/private/vms2d_stop";
      const json = await xunfeiVmsRequest(pathname, {
        header: { ...commonHeader, session },
      });
      if (action === "stop" && body.hls_stream_id) stopHlsTranscoder(String(body.hls_stream_id));
      if (action === "stop" && xunfeiActiveSession?.session === session) xunfeiActiveSession = null;
      sendJson(res, 200, { provider: "xunfei_virtual_human", action, raw: json });
      return;
    }

    const text = String(body.text || body.input_text || body.script || "").trim();
    if (!text) {
      sendJson(res, 400, { error: "Missing text for Xunfei virtual human" });
      return;
    }

    await stopXunfeiActiveSession(commonHeader);

    const startJson = await xunfeiVmsRequest("/v1/private/vms2d_start", {
      header: commonHeader,
      parameter: {
        vmr: {
          stream: { protocol: String(body.protocol || XUNFEI_VMS_STREAM_PROTOCOL || "rtmp") },
          avatar_id: resolveXunfeiAvatarId(body),
          width: Number(body.width || XUNFEI_VMS_WIDTH || 1280),
          height: Number(body.height || XUNFEI_VMS_HEIGHT || 720),
        },
      },
    });

    const nextSession = startJson?.header?.session;
    if (!nextSession) {
      sendJson(res, 502, { error: "Xunfei VMS did not return a session", raw: startJson });
      return;
    }

    let ctrlJson;
    try {
      ctrlJson = await xunfeiVmsRequest("/v1/private/vms2d_ctrl", {
        header: { ...commonHeader, session: nextSession },
        parameter: {
          tts: {
            vcn: resolveXunfeiVcn(body),
            speed: Number(body.speed || XUNFEI_VMS_SPEED || 50),
            pitch: Number(body.pitch || XUNFEI_VMS_PITCH || 50),
            volume: Number(body.volume || XUNFEI_VMS_VOLUME || 50),
          },
        },
        payload: {
          text: {
            encoding: "utf8",
            status: 3,
            text: xunfeiBase64Text(text),
          },
        },
      });
    } catch (e) {
      await xunfeiVmsRequest("/v1/private/vms2d_stop", {
        header: { ...commonHeader, session: nextSession },
      }).catch(() => {});
      throw e;
    }

    sendJson(res, 200, normalizeXunfeiVms(startJson, ctrlJson));
  } catch (e) {
    sendJson(res, e.status || 502, {
      error: e.vmsCode === 11203
        ? "讯飞在线虚拟人当前 1 路通道被占用，请点停止后等待约 60 秒再试。"
        : String(e?.message || e),
      code: e.vmsCode || undefined,
      raw: e.response,
    });
  }
}

function serveHls(req, res, url) {
  setCors(res);
  const match = url.pathname.match(/^\/api\/video\/hls\/([a-f0-9]{16})\/([^/]+)$/);
  if (!match || req.method !== "GET") {
    sendJson(res, 404, { error: "HLS file not found" });
    return;
  }
  const streamId = match[1];
  const filename = match[2];
  if (!/^(index\.m3u8|segment_\d+\.ts)$/.test(filename)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  const filePath = safeJoin(HLS_DIR, `${streamId}/${filename}`);
  if (!filePath) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      const item = xunfeiHlsProcesses.get(streamId);
      sendJson(res, 404, {
        error: "HLS segment not ready",
        transcoding: Boolean(item),
        detail: item?.lastError || "",
      });
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", filename.endsWith(".m3u8") ? "no-store" : "no-cache");
    res.setHeader("Content-Type", getMimeType(filePath));
    fs.createReadStream(filePath).pipe(res);
  });
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
    if (url.pathname === "/api/feed" && req.method === "GET") {
      void getFeedList(req, res, url);
      return;
    }
    if (url.pathname === "/api/feed/favorites" && req.method === "GET") {
      void getFeedFavorites(req, res);
      return;
    }
    if (url.pathname === "/api/feed/social" && req.method === "GET") {
      void getFeedSocial(req, res);
      return;
    }
    if (url.pathname === "/api/feed/posts" && req.method === "POST") {
      void createFeedPost(req, res);
      return;
    }
    const feedPostMatch = url.pathname.match(/^\/api\/feed\/posts\/(\d+)$/);
    if (feedPostMatch && req.method === "GET") {
      void getFeedPost(req, res, feedPostMatch[1]);
      return;
    }
    if (feedPostMatch && req.method === "PUT") {
      void updateFeedPost(req, res, feedPostMatch[1]);
      return;
    }
    if (feedPostMatch && req.method === "DELETE") {
      void deleteFeedPost(req, res, feedPostMatch[1]);
      return;
    }
    if (url.pathname === "/api/feed/interests" && req.method === "PUT") {
      void updateFeedInterests(req, res);
      return;
    }
    if (url.pathname === "/api/feed/notifications" && req.method === "GET") {
      void getFeedNotifications(req, res);
      return;
    }
    if (url.pathname === "/api/feed/notifications/read" && req.method === "POST") {
      void markFeedNotificationsRead(req, res);
      return;
    }
    if (url.pathname === "/api/feed/videos" && req.method === "POST") {
      void uploadFeedVideo(req, res);
      return;
    }
    const feedCommentsMatch = url.pathname.match(/^\/api\/feed\/posts\/(\d+)\/comments$/);
    if (feedCommentsMatch && req.method === "GET") {
      void getFeedComments(req, res, feedCommentsMatch[1]);
      return;
    }
    const feedActionMatch = url.pathname.match(/^\/api\/feed\/posts\/(\d+)\/(like|favorite|comments)$/);
    if (feedActionMatch && (req.method === "POST")) {
      if (feedActionMatch[2] === "comments") {
        void createFeedComment(req, res, feedActionMatch[1]);
      } else {
        void toggleFeedInteraction(req, res, feedActionMatch[1], feedActionMatch[2]);
      }
      return;
    }
    const feedAuthorProfileMatch = url.pathname.match(/^\/api\/feed\/authors\/(\d+)$/);
    if (feedAuthorProfileMatch && req.method === "GET") {
      void getFeedAuthor(req, res, feedAuthorProfileMatch[1]);
      return;
    }
    const feedFollowMatch = url.pathname.match(/^\/api\/feed\/authors\/(\d+)\/follow$/);
    if (feedFollowMatch && req.method === "POST") {
      void toggleFeedFollow(req, res, feedFollowMatch[1]);
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
    if (url.pathname === "/api/resources/bilibili/search" && req.method === "GET") {
      void searchBilibiliEducation(req, res, url);
      return;
    }
    if (url.pathname === "/api/knowledge-base/upload" && req.method === "POST") {
      void uploadKnowledgeBase(req, res);
      return;
    }
    if (url.pathname === "/api/knowledge-base" && req.method === "GET") {
      getKnowledgeCatalog(req, res);
      return;
    }
    if (url.pathname === "/api/knowledge-base/search" && req.method === "GET") {
      searchKnowledgeRoute(req, res, url);
      return;
    }
    const knowledgeTaskMatch = url.pathname.match(/^\/api\/knowledge-base\/tasks\/([^/]+)$/);
    if (knowledgeTaskMatch && req.method === "GET") {
      getKnowledgeTask(req, res, decodeURIComponent(knowledgeTaskMatch[1]));
      return;
    }
    if (url.pathname === "/api/presentations" && (req.method === "POST" || req.method === "OPTIONS")) {
      void createPresentation(req, res);
      return;
    }
    if (url.pathname === "/api/presentation-themes" && req.method === "GET") {
      void listPresentationThemes(req, res);
      return;
    }
    const presentationTaskMatch = url.pathname.match(/^\/api\/presentations\/tasks\/([^/]+)$/);
    if (presentationTaskMatch && req.method === "GET") {
      void getPresentationTask(req, res, decodeURIComponent(presentationTaskMatch[1]));
      return;
    }
    const presentationMatch = url.pathname.match(/^\/api\/presentations\/([^/]+)$/);
    if (presentationMatch && req.method === "GET") {
      downloadPresentation(req, res, decodeURIComponent(presentationMatch[1]));
      return;
    }
    if (
      (url.pathname === "/api/video" || url.pathname === "/api/video/generate") &&
      (req.method === "POST" || req.method === "OPTIONS")
    ) {
      void proxyVideo(req, res);
      return;
    }
    if (url.pathname.startsWith("/api/video/hls/") && req.method === "GET") {
      serveHls(req, res, url);
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
  console.log(`[lingxi] XFYUN Spark base URL: ${XFYUN_SPARK_BASE_URL}`);
  console.log(`[lingxi] XFYUN Spark model: ${XFYUN_SPARK_MODEL}`);
  console.log(`[lingxi] Run from lingxi folder: node js/server.js`);
});
