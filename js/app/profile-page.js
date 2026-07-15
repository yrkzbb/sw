function profileIconSvg(icon) {
  const attrs = 'viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"';
  const paths = {
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />',
    target: '<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" />',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" />',
    spark: '<path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2Z" />',
    clock: '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />',
    alert: '<path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />',
    chat: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />',
  };
  return `<svg ${attrs}>${paths[icon] || paths.book}</svg>`;
}

function confidenceClass(confidence) {
  if (confidence === "确定") return "sure";
  if (confidence === "推测") return "guess";
  return "missing";
}

function profileScore(item) {
  if (!item || !item.value) return 18;
  const value = String(item.value || "").trim();
  const evidence = String(item.evidence || "").trim();
  const facts = value
    .split(/[;；。,.，、\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const distinctFacts = Math.min(Math.max(facts.length, 1), 5);
  const confidenceBase = item.confidence === "确定" ? 34 : item.confidence === "推测" ? 24 : 12;
  const richness = Math.min(value.length, 90) * 0.28 + Math.min(evidence.length, 80) * 0.16;
  const coverage = distinctFacts * 8;
  const score = Math.round(confidenceBase + richness + coverage);
  return Math.max(18, Math.min(score, 88));
}

function radarPoint(cx, cy, radius, index, total, score = 100) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  const scaled = radius * (score / 100);
  return {
    x: cx + Math.cos(angle) * scaled,
    y: cy + Math.sin(angle) * scaled,
  };
}

function radarPolygon(points) {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function renderProfileVisual(profile) {
  if (!el.profileVisual) return;
  const cx = 160;
  const cy = 145;
  const radius = 94;
  const levels = [0.25, 0.5, 0.75, 1];
  const fieldData = PROFILE_FIELDS.map((key) => {
    const meta = PROFILE_FIELD_META[key];
    const item = profile[key] || {};
    const score = profileScore(item);
    return { key, meta, item, score };
  });
  const total = fieldData.length;
  const average = Math.round(fieldData.reduce((sum, item) => sum + item.score, 0) / total);
  const sureCount = fieldData.filter((item) => item.item.confidence === "确定").length;
  const pendingCount = fieldData.filter((item) => !item.item.value).length;
  const areaPoints = fieldData.map((item, index) =>
    radarPoint(cx, cy, radius, index, total, item.score)
  );
  const grid = levels.map((level) => {
    const points = fieldData.map((_, index) => radarPoint(cx, cy, radius * level, index, total));
    return `<polygon class="radar-grid" points="${radarPolygon(points)}" />`;
  }).join("");
  const axes = fieldData.map((_, index) => {
    const end = radarPoint(cx, cy, radius, index, total);
    return `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}" />`;
  }).join("");
  const labels = fieldData.map((item, index) => {
    const point = radarPoint(cx, cy, radius + 25, index, total);
    return `<text class="radar-label" x="${point.x.toFixed(1)}" y="${point.y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${escapeHtml(item.meta.title)}</text>`;
  }).join("");
  const dots = areaPoints.map((point) =>
    `<circle class="radar-dot" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4" />`
  ).join("");
  const rows = fieldData.map((item) => `
    <div class="profile-score-row">
      <div class="profile-score-name">${escapeHtml(item.meta.title)}</div>
      <div class="profile-score-track" aria-hidden="true">
        <div class="profile-score-fill" style="width: ${item.score}%"></div>
      </div>
      <div class="profile-score-num">${item.score}</div>
    </div>
  `).join("");

  el.profileVisual.innerHTML = `
    <section class="profile-radar-panel" aria-label="学习画像雷达图">
      <div class="profile-panel-title">画像清晰度雷达</div>
      <div class="profile-panel-subtitle">根据每个维度已收集的信息数量、证据和可信度生成，不代表能力水平。</div>
      <svg class="profile-radar" viewBox="0 0 320 270" role="img" aria-label="学习画像八维雷达图">
        ${grid}
        ${axes}
        <polygon class="radar-area" points="${radarPolygon(areaPoints)}" />
        ${dots}
        ${labels}
      </svg>
      <div class="profile-summary">
        <div class="profile-summary-item">
          <div class="profile-summary-value">${average}</div>
          <div class="profile-summary-label">综合清晰度</div>
        </div>
        <div class="profile-summary-item">
          <div class="profile-summary-value">${sureCount}</div>
          <div class="profile-summary-label">确定维度</div>
        </div>
        <div class="profile-summary-item">
          <div class="profile-summary-value">${pendingCount}</div>
          <div class="profile-summary-label">待补充维度</div>
        </div>
      </div>
    </section>
    <section class="profile-score-panel" aria-label="画像维度评分">
      <div class="profile-panel-title">维度覆盖度</div>
      <div class="profile-panel-subtitle">分数越高，代表该维度已收集到更多不同信息点。</div>
      <div class="profile-score-list">${rows}</div>
    </section>
  `;
}

function renderStudentProfile() {
  if (!el.profileGrid) return;
  const profile = state.studentProfile || createEmptyProfile();
  renderProfileVisual(profile);
  const cards = PROFILE_FIELDS.map((key) => {
    const meta = PROFILE_FIELD_META[key];
    const item = profile[key] || {};
    const confidence = item.confidence || "待补充";
    const value = item.value || "还没有足够信息";
    const evidence = item.evidence || "继续对话后，我会从你的表达中补充这一项。";
    return `
      <article class="profile-card">
        <div class="profile-card-head">
          <div class="profile-card-title">${escapeHtml(meta.title)}</div>
          <div class="profile-card-icon" aria-hidden="true">${profileIconSvg(meta.icon)}</div>
        </div>
        <div class="profile-chip ${confidenceClass(confidence)}">${escapeHtml(confidence)}</div>
        <div class="profile-value ${item.value ? "" : "empty"}">${escapeHtml(value)}</div>
        <div class="profile-evidence">${escapeHtml(evidence)}</div>
      </article>
    `;
  }).join("");
  el.profileGrid.innerHTML = cards;
  if (el.profileMeta) {
    const reason = profile.last_updated_reason || "画像会根据对话持续更新";
    const status = state.profileUpdating ? "正在根据最新对话更新画像..." : reason;
    el.profileMeta.textContent = status;
  }
}

function renderPersonalProfileChrome() {
  const profile = accountProfileFor();
  const userName = state.activeUser?.name || "yrk";
  const handle = `@${normalizeUsername(userName) || "yrk"}`;
  const bio = profile.bio && profile.bio !== "个人学习空间"
    ? profile.bio
    : "关注 AI 产品设计、大模型应用与知识工作流，擅长把复杂问题拆成可执行方案。";
  const avatarText = profile.avatarInitial || String(userName || "YR").slice(0, 2).toUpperCase();
  const avatarGradient = accountAccentGradient(profile.accent);
  if (el.personalProfileName) el.personalProfileName.textContent = userName;
  if (el.personalProfileHandle) el.personalProfileHandle.textContent = handle;
  if (el.personalProfileBio) el.personalProfileBio.textContent = bio;
  const inlineName = document.querySelector("#personalProfileInlineName");
  if (inlineName) inlineName.textContent = userName;
  const greeting = document.querySelector(".wiki-welcome-card h2");
  if (greeting) greeting.textContent = currentProfileGreeting();
  [el.profileHeroAvatar, el.profileEditShortcut, document.querySelector(".wiki-avatar-large")].forEach((node) => {
    if (!node) return;
    node.style.background = avatarGradient;
    node.style.backgroundImage = profile.avatarImage ? `url("${profile.avatarImage}")` : "";
    node.style.backgroundSize = "cover";
    node.style.backgroundPosition = "center";
    node.textContent = profile.avatarImage ? "" : avatarText;
  });
  renderWikiDateTime();
  renderWikiSummaryCards();
  renderWikiPhotoWall();
  renderWikiMusicCard();
}

function saveAccountProfilePatch(patch) {
  if (!state.activeUser) return Promise.resolve(null);
  const profile = accountProfileFor();
  return apiJson(`${AUTH_ENDPOINT}/profile`, {
    method: "PUT",
    body: JSON.stringify({
      name: state.activeUser.name,
      email: state.activeUser.email,
      profile: {
        avatarInitial: profile.avatarInitial,
        avatarImage: profile.avatarImage,
        accent: profile.accent,
        bio: profile.bio,
        theme: profile.theme,
        defaultPage: profile.defaultPage,
        replyStyle: profile.replyStyle,
        photoWall: profile.photoWall,
        musicTrack: profile.musicTrack,
        ...patch,
      },
    }),
  }).then((payload) => {
    setActiveUser(payload.user);
    renderPersonalProfileChrome();
    return payload;
  });
}

function resizeProfileAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//i.test(file.type || "")) {
      reject(new Error("请选择图片文件。"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败。"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("图片解析失败。"));
      image.onload = () => {
        const size = 360;
        const side = Math.min(image.width, image.height);
        const sx = Math.max(0, Math.round((image.width - side) / 2));
        const sy = Math.max(0, Math.round((image.height - side) / 2));
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("图片处理失败。"));
          return;
        }
        ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/webp", 0.84));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

async function saveProfileAvatarImage(file) {
  try {
    const avatarImage = await resizeProfileAvatar(file);
    await saveAccountProfilePatch({ avatarImage });
    showProfileSaveStatus(".wiki-welcome-card", "头像已保存");
  } catch (e) {
    showProfileSaveStatus(".wiki-welcome-card", String(e?.message || e), "error");
  }
}

function startProfileBioEdit() {
  if (!el.personalProfileBio || el.personalProfileBio.closest(".wiki-bio-editor")) return;
  const current = el.personalProfileBio.textContent || "";
  const form = document.createElement("form");
  form.className = "wiki-bio-editor";
  form.innerHTML = `
    <textarea maxlength="80" rows="3">${escapeHtml(current)}</textarea>
    <div>
      <button type="button" data-profile-bio-cancel>取消</button>
      <button type="submit">保存</button>
    </div>
  `;
  el.personalProfileBio.replaceWith(form);
  const textarea = form.querySelector("textarea");
  textarea?.focus();
  textarea?.select();
}

async function saveProfileBioEdit(form) {
  const textarea = form.querySelector("textarea");
  const bio = String(textarea?.value || "").trim().replace(/\s+/g, " ").slice(0, 80) || "个人学习空间";
  try {
    await saveAccountProfilePatch({ bio });
    const node = document.createElement("p");
    node.id = "personalProfileBio";
    node.className = "wiki-bio";
    node.title = "点击编辑自我介绍";
    node.textContent = bio === "个人学习空间"
      ? "关注 AI 产品设计、大模型应用与知识工作流，擅长把复杂问题拆成可执行方案。"
      : bio;
    form.replaceWith(node);
    el.personalProfileBio = node;
    showProfileSaveStatus(".wiki-welcome-card", "简介已保存");
  } catch (e) {
    showProfileSaveStatus(".wiki-welcome-card", String(e?.message || e), "error");
  }
}

function cancelProfileBioEdit(form) {
  const profile = accountProfileFor();
  const node = document.createElement("p");
  node.id = "personalProfileBio";
  node.className = "wiki-bio";
  node.title = "点击编辑自我介绍";
  node.textContent = profile.bio && profile.bio !== "个人学习空间"
    ? profile.bio
    : "关注 AI 产品设计、大模型应用与知识工作流，擅长把复杂问题拆成可执行方案。";
  form.replaceWith(node);
  el.personalProfileBio = node;
}

function currentProfileGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "Still Awake";
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function renderWikiPhotoWall() {
  const grid = document.querySelector(".wiki-polaroid-grid");
  if (!grid) return;
  const photos = accountProfileFor().photoWall || [];
  grid.innerHTML = Array.from({ length: 4 }, (_, index) => {
    const src = photos[index];
    return `<span class="${src ? "has-photo" : ""}">${src ? `<img src="${escapeHtml(src)}" alt="" />` : ""}</span>`;
  }).join("");
}

function showProfileSaveStatus(cardSelector, message, type = "success") {
  const card = document.querySelector(cardSelector);
  if (!card) return;
  let status = card.querySelector(".wiki-save-status");
  if (!status) {
    status = document.createElement("span");
    status.className = "wiki-save-status";
    card.appendChild(status);
  }
  status.textContent = message;
  status.classList.toggle("error", type === "error");
  status.classList.toggle("pending", type === "pending");
  status.hidden = false;
  window.clearTimeout(Number(status.dataset.timer || 0));
  if (type !== "pending") {
    const timer = window.setTimeout(() => {
      status.hidden = true;
    }, 2200);
    status.dataset.timer = String(timer);
  }
}

function resizeProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//i.test(file.type || "")) {
      reject(new Error("请选择图片文件。"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败。"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("图片解析失败。"));
      image.onload = () => {
        const maxSide = 900;
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("图片处理失败。"));
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/webp", 0.82));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

async function saveProfilePhotoWall(files) {
  if (!state.activeUser) return;
  const selected = Array.from(files || []).slice(0, 4);
  if (!selected.length) return;
  const profile = accountProfileFor();
  showProfileSaveStatus(".wiki-photo-card", "保存中...", "pending");
  try {
    const photoWall = await Promise.all(selected.map(resizeProfilePhoto));
    const payload = await apiJson(`${AUTH_ENDPOINT}/profile`, {
      method: "PUT",
      body: JSON.stringify({
        name: state.activeUser.name,
        email: state.activeUser.email,
        profile: { ...profile, photoWall },
      }),
    });
    setActiveUser(payload.user);
    renderPersonalProfileChrome();
    showProfileSaveStatus(".wiki-photo-card", "照片墙已保存");
  } catch (err) {
    console.warn("照片墙保存失败", err);
    showProfileSaveStatus(".wiki-photo-card", String(err?.message || "照片墙保存失败"), "error");
  }
}

const DEFAULT_PROFILE_MUSIC_TRACK = {
  title: "花海 - 周杰伦",
  src: "./assets/audio/huahai-default.mp3",
  isDefault: true,
};

let profileMusicAudio = null;

function currentProfileMusicTrack() {
  return accountProfileFor().musicTrack || DEFAULT_PROFILE_MUSIC_TRACK;
}

function renderWikiMusicCard() {
  const track = currentProfileMusicTrack();
  const titleNode = document.querySelector("#profileMusicTitle");
  const button = document.querySelector("#profileMusicButton");
  const progress = document.querySelector("#profileMusicProgress");
  const hasTrack = Boolean(track?.src);
  if (titleNode) titleNode.textContent = hasTrack ? track.title : "添加音乐";
  if (button) {
    const playing = profileMusicAudio && !profileMusicAudio.paused && profileMusicAudio.dataset.src === track?.src;
    button.textContent = hasTrack ? (playing ? "Ⅱ" : "▶") : "＋";
    button.setAttribute("aria-label", hasTrack ? (playing ? "暂停音乐" : "播放音乐") : "上传音乐");
    button.title = track?.isDefault ? "播放默认音乐；点击歌名可更换" : "播放音乐；点击歌名可更换";
  }
  if (progress) {
    const pct = profileMusicAudio?.duration
      ? Math.min(100, Math.max(0, (profileMusicAudio.currentTime / profileMusicAudio.duration) * 100))
      : 0;
    progress.style.setProperty("--music-progress", `${pct}%`);
  }
}

function audioFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^audio\//i.test(file.type || "")) {
      reject(new Error("请选择音频文件。"));
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      reject(new Error("音频文件不能超过 6MB。"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("音频读取失败。"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

async function saveProfileMusicTrack(file) {
  if (!state.activeUser || !file) return;
  const profile = accountProfileFor();
  showProfileSaveStatus(".wiki-music-card", "保存中...", "pending");
  try {
    const src = await audioFileToDataUrl(file);
    const title = String(file.name || "我的音乐").replace(/\.[^.]+$/, "").slice(0, 80) || "我的音乐";
    const payload = await apiJson(`${AUTH_ENDPOINT}/profile`, {
      method: "PUT",
      body: JSON.stringify({
        name: state.activeUser.name,
        email: state.activeUser.email,
        profile: { ...profile, musicTrack: { title, src } },
      }),
    });
    setActiveUser(payload.user);
    renderPersonalProfileChrome();
    showProfileSaveStatus(".wiki-music-card", "音乐已保存");
  } catch (err) {
    showProfileSaveStatus(".wiki-music-card", String(err?.message || "音乐保存失败"), "error");
  }
}

function toggleProfileMusic() {
  const track = currentProfileMusicTrack();
  if (!track?.src) {
    const input = document.querySelector("#profileMusicInput");
    if (input instanceof HTMLInputElement) input.click();
    return;
  }
  if (!profileMusicAudio || profileMusicAudio.dataset.src !== track.src) {
    profileMusicAudio?.pause();
    profileMusicAudio = new Audio(track.src);
    profileMusicAudio.dataset.src = track.src;
    profileMusicAudio.addEventListener("timeupdate", renderWikiMusicCard);
    profileMusicAudio.addEventListener("ended", renderWikiMusicCard);
    profileMusicAudio.addEventListener("pause", renderWikiMusicCard);
    profileMusicAudio.addEventListener("play", renderWikiMusicCard);
  }
  if (profileMusicAudio.paused) {
    void profileMusicAudio.play().catch(() => {
      const input = document.querySelector("#profileMusicInput");
      if (input instanceof HTMLInputElement) input.click();
    });
  } else {
    profileMusicAudio.pause();
  }
  renderWikiMusicCard();
}

function renderWikiDateTime() {
  const now = new Date();
  const timeNode = document.querySelector(".wiki-digital-time");
  if (timeNode) {
    timeNode.textContent = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const head = document.querySelector(".wiki-calendar-head");
  if (head) {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    head.textContent = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${weekdays[now.getDay()]}`;
  }
  document.querySelectorAll(".wiki-calendar-grid .today").forEach((node) => node.classList.remove("today"));
  const dayNodes = Array.from(document.querySelectorAll(".wiki-calendar-grid em"));
  const match = dayNodes.find((node) => Number(node.textContent) === now.getDate());
  match?.classList.add("today");
}

function formatWikiDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatWikiFullDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月${String(date.getDate()).padStart(2, "0")}日`;
}

function wikiPublicPosts() {
  return Array.isArray(state.personalProfilePosts) ? state.personalProfilePosts : [];
}

function wikiStoredDocs() {
  return Array.isArray(state.storedMarkdownFiles) ? state.storedMarkdownFiles : [];
}

function wikiResources() {
  return Array.isArray(state.learningResources?.resources) ? state.learningResources.resources : [];
}

function wikiPathEntries() {
  return Object.entries(state.learningPathLibrary || {}).map(([category, data]) => ({
    category,
    topic: data?.topic || category,
    resources: Array.isArray(data?.resources) ? data.resources : [],
    updatedAt: data?.updatedAt || data?.createdAt || "",
  }));
}

function renderWikiSummaryCards() {
  const posts = wikiPublicPosts();
  const docs = wikiStoredDocs();
  const paths = wikiPathEntries();
  const resources = wikiResources();
  const latest = posts[0] || docs[0] || null;
  const latestCard = document.querySelector(".wiki-latest-card");
  if (latestCard) {
    latestCard.innerHTML = latest
      ? `
        <span>最新内容</span>
        <strong>${escapeHtml(latest.title || latest.filename || "未命名内容")}</strong>
        <p>${escapeHtml(latest.summary || latest.category || latest.type || "来自你的工作区")}</p>
        <time>${escapeHtml(formatWikiDate(latest.createdAt || latest.addedAt || latest.updatedAt || Date.now()))}</time>
      `
      : `<span>最新内容</span><strong>还没有公开内容</strong><p>发布动态或保存文档后会出现在这里。</p>`;
  }
  const recommend = paths[0] || resources[0] || null;
  const recommendCard = document.querySelector(".wiki-recommend-card");
  if (recommendCard) {
    recommendCard.innerHTML = recommend
      ? `
        <span>随机推荐</span>
        <strong>${escapeHtml(recommend.topic || recommend.title || recommend.category || "学习资源")}</strong>
        <p>${escapeHtml(recommend.category || recommend.type || "来自你的学习路径和资源库")}</p>
        <small>${resources.length} 个资源 · ${paths.length} 条路径</small>
      `
      : `<span>随机推荐</span><strong>暂无推荐</strong><p>生成学习资源后会自动沉淀到这里。</p>`;
  }
  const love = document.querySelector(".wiki-love-card span");
  if (love) {
    const likes = posts.reduce((sum, post) => sum + Number(post.likes || 0), 0);
    love.textContent = String(likes || docs.length || 0);
  }
}

function profilePostMatchesFilter(post, filter) {
  const needle = String(filter || "").trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    post?.title,
    post?.summary,
    post?.category,
    post?.contentType,
    ...(Array.isArray(post?.tags) ? post.tags : []),
  ].map((item) => String(item || "").toLowerCase());
  return haystack.some((item) => item === needle || item.includes(needle));
}

function profilePostFilterTags() {
  const counts = new Map();
  wikiPublicPosts().forEach((post) => {
    const values = [
      ...(Array.isArray(post?.tags) ? post.tags : []),
      post?.category,
    ];
    values.forEach((value) => {
      const tag = String(value || "").trim().replace(/^#/, "");
      if (!tag) return;
      const key = tag.toLowerCase();
      const existing = counts.get(key) || { tag, count: 0 };
      existing.count += 1;
      counts.set(key, existing);
    });
  });
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"))
    .slice(0, 8)
    .map((item) => item.tag);
}

function renderProfileFilterTags() {
  if (!el.profileSkillTags) return;
  const tags = profilePostFilterTags();
  if (state.personalProfileFilter && !tags.some((tag) => tag.toLowerCase() === state.personalProfileFilter.toLowerCase())) {
    state.personalProfileFilter = "";
  }
  el.profileSkillTags.hidden = tags.length === 0;
  el.profileSkillTags.innerHTML = tags.map((tag) => `
    <button type="button" data-profile-filter="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
  `).join("");
}

async function loadPersonalProfileRemoteData() {
  if (!state.activeUser?.id || state.personalProfileLoading) return;
  state.personalProfileLoading = true;
  try {
    const payload = await apiJson(`/api/feed/authors/${encodeURIComponent(state.activeUser.id)}`, { method: "GET" });
    state.personalProfilePosts = payload.posts || [];
    state.personalProfileStats = payload.author || null;
    renderPersonalProfileChrome();
    renderProfileContentPanel();
  } catch (e) {
    console.warn("加载个人主页动态失败", e);
  } finally {
    state.personalProfileLoading = false;
  }
}

function contributionValues() {
  return [2, 4, 1, 5, 3, 6, 4, 7, 3, 2, 6, 9, 4, 5, 8, 6, 4, 7, 10, 5, 3, 6, 8, 7, 5, 9, 6, 4, 8, 11];
}

function renderProfileTrendChart() {
  if (!el.profileTrendChart) return;
  const values = contributionValues();
  const max = Math.max(...values);
  el.profileTrendChart.innerHTML = values.map((value, index) => {
    const height = Math.max(16, Math.round((value / max) * 82));
    const day = index + 1;
    const accepted = Math.max(0, Math.round(value * 0.32));
    return `<span class="trend-bar" style="height:${height}px" data-tip="7月${day}日：${value} 次贡献，${accepted} 次采纳"></span>`;
  }).join("");
}

function profileEmptyState(title, text, action = "") {
  return `
    <div class="profile-empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text)}</span>
      ${action ? `<button class="profile-follow-button" type="button">${escapeHtml(action)}</button>` : ""}
    </div>
  `;
}

function profileArchiveDate(post) {
  const date = new Date(post?.createdAt || post?.updatedAt || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function profileArchiveWeek(date) {
  const cursor = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = cursor.getUTCDay() || 7;
  cursor.setUTCDate(cursor.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(cursor.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((cursor - yearStart) / 86400000) + 1) / 7);
  return { year: cursor.getUTCFullYear(), week };
}

function profileArchiveTags(post) {
  const tags = Array.isArray(post?.tags)
    ? post.tags.map((tag) => String(tag || "").trim().replace(/^#/, "")).filter(Boolean)
    : [];
  return tags.length ? tags : ["未打标签"];
}

function profileArchivePrimaryTag(post) {
  const tags = profileArchiveTags(post).filter((tag) => tag !== "未打标签");
  const label = tags[0] || String(post?.category || "").trim();
  return label ? `#${label.replace(/^#/, "")}` : "";
}

function profileArchiveGroups(posts) {
  const mode = state.personalArchiveGroup || "year";
  const groups = new Map();
  const pushGroup = (key, title, sortValue, post) => {
    if (!groups.has(key)) groups.set(key, { key, title, sortValue, posts: [] });
    groups.get(key).posts.push(post);
  };

  posts.forEach((post) => {
    const date = profileArchiveDate(post);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    if (mode === "day") {
      pushGroup(`${year}-${month}-${day}`, formatWikiFullDate(date), date.getTime(), post);
      return;
    }
    if (mode === "week") {
      const info = profileArchiveWeek(date);
      pushGroup(`${info.year}-W${info.week}`, `${info.year}年第${info.week}周`, info.year * 100 + info.week, post);
      return;
    }
    if (mode === "month") {
      pushGroup(`${year}-${month}`, `${year}年${month}月`, year * 100 + Number(month), post);
      return;
    }
    if (mode === "category") {
      const category = String(post?.category || "").trim() || "未分类";
      pushGroup(`category:${category}`, category, category, post);
      return;
    }
    if (mode === "tag") {
      profileArchiveTags(post).forEach((tag) => {
        pushGroup(`tag:${tag}`, tag === "未打标签" ? "未打标签" : `#${tag}`, tag, post);
      });
      return;
    }
    pushGroup(String(year), `${year}年`, year, post);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      posts: group.posts.sort((a, b) => profileArchiveDate(b) - profileArchiveDate(a)),
    }))
    .sort((a, b) => {
      if (typeof a.sortValue === "number" && typeof b.sortValue === "number") return b.sortValue - a.sortValue;
      return String(a.sortValue).localeCompare(String(b.sortValue), "zh-CN");
    });
}

function renderProfileArchiveTabs(show) {
  if (!el.profileArchiveTabs) return;
  el.profileArchiveTabs.hidden = !show;
  el.profileArchiveTabs.querySelectorAll("[data-profile-archive]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-profile-archive") === (state.personalArchiveGroup || "year"));
  });
}

function renderProfileArchiveGroup(group) {
  return `
    <section class="wiki-archive-group">
      <header>
        <h3>${escapeHtml(group.title)}</h3>
        <span></span>
        <small>${group.posts.length} 篇文章</small>
      </header>
      <div class="wiki-archive-list">
        ${group.posts.map((post) => `
          <button class="wiki-archive-item" type="button" data-profile-post-id="${escapeHtml(post.id)}">
            <time>${escapeHtml(formatWikiDate(post.createdAt || post.updatedAt))}</time>
            <span aria-hidden="true"></span>
            <strong>${escapeHtml(post.title || "未命名动态")}</strong>
            <em>${escapeHtml(profileArchivePrimaryTag(post))}</em>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function profilePostHeadings(post) {
  const body = String(post?.body || "");
  return body.split(/\n+/)
    .map((line) => line.match(/^\s{0,3}#{1,3}\s+(.+)$/)?.[1]?.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function profileRenderMarkdownText(markdownText) {
  const host = document.createElement("div");
  if (typeof renderMarkdownInto === "function") {
    renderMarkdownInto(host, markdownText || "");
    return host.innerHTML;
  }
  return String(markdownText || "")
    .split(/\n{2,}/)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function renderProfilePostDetail(post, editable = false) {
  const headings = profilePostHeadings(post);
  const tags = profileArchiveTags(post).filter((tag) => tag !== "未打标签");
  const fullDate = formatWikiFullDate(post.createdAt || post.updatedAt) || "";
  return `
    <article class="wiki-post-reader">
      <div class="wiki-post-main wiki-glass">
        <button class="wiki-post-back" type="button" data-profile-back-archive>返回归档</button>
        <header>
          <h1>${escapeHtml(post.title || "未命名动态")}</h1>
          <time>${escapeHtml(fullDate)}</time>
          <div class="wiki-post-tags">
            ${(tags.length ? tags : [post.category || "未分类"]).filter(Boolean).map((tag) => `<span>#${escapeHtml(String(tag).replace(/^#/, ""))}</span>`).join("")}
          </div>
        </header>
        <div class="wiki-post-body markdown-body">${profileRenderMarkdownText(post.body || post.summary || "")}</div>
      </div>
      <aside class="wiki-post-side">
        <section class="wiki-post-side-card wiki-glass">
          <strong>摘要</strong>
          <p>${escapeHtml(post.summary || "暂无摘要")}</p>
        </section>
        <section class="wiki-post-side-card wiki-glass">
          <strong>目录</strong>
          ${headings.length
            ? headings.map((heading) => `<span>${escapeHtml(heading)}</span>`).join("")
            : `<span>${escapeHtml(post.title || "正文")}</span>`}
        </section>
        <section class="wiki-post-side-card wiki-glass">
          <strong>信息</strong>
          <span>${escapeHtml(post.category || "未分类")}</span>
          <span>${Number(post.likes || 0)} 赞 · ${Number(post.comments || 0)} 评论</span>
          <span>热度 ${Number(post.heatScore || 0).toFixed(1)}</span>
        </section>
        ${editable ? `<button class="wiki-post-edit-action" type="button" data-profile-edit-post>编辑文章</button>` : ""}
      </aside>
    </article>
  `;
}

function renderProfilePostEditor(post) {
  return `
    <form class="wiki-post-editor wiki-glass" data-profile-post-editor>
      <div class="wiki-post-editor-head">
        <button type="button" data-profile-cancel-edit>取消</button>
        <strong>编辑文章</strong>
        <button type="submit">保存</button>
      </div>
      <label>
        <span>标题</span>
        <input name="title" value="${escapeHtml(post.title || "")}" required minlength="4" />
      </label>
      <label>
        <span>摘要</span>
        <textarea name="summary" rows="3">${escapeHtml(post.summary || "")}</textarea>
      </label>
      <div class="wiki-post-editor-grid">
        <label>
          <span>类型</span>
          <select name="contentType">
            ${["thought", "article", "question", "answer", "document", "video"].map((type) =>
              `<option value="${type}" ${post.contentType === type ? "selected" : ""}>${type}</option>`
            ).join("")}
          </select>
        </label>
        <label>
          <span>分类</span>
          <input name="category" value="${escapeHtml(post.category || "")}" />
        </label>
        <label>
          <span>标签</span>
          <input name="tags" value="${escapeHtml(profileArchiveTags(post).filter((tag) => tag !== "未打标签").join(", "))}" />
        </label>
      </div>
      <label>
        <span>正文</span>
        <textarea name="body" rows="16" required minlength="10">${escapeHtml(post.body || "")}</textarea>
      </label>
      <p class="wiki-post-editor-status" data-profile-editor-status></p>
    </form>
  `;
}

function renderProfilePostView() {
  const post = state.personalProfileSelectedPost;
  if (el.profileEditButton) {
    el.profileEditButton.textContent = state.personalProfilePostEditable && state.personalProfileView === "detail" ? "编辑文章" : "编辑";
  }
  if (!post) {
    el.profileContentPanel.innerHTML = profileEmptyState("文章加载中", "正在读取这篇文章。");
    return;
  }
  renderProfileArchiveTabs(false);
  if (el.profileSkillTags) el.profileSkillTags.hidden = true;
  if (state.personalProfileView === "editing") {
    el.profileContentPanel.innerHTML = renderProfilePostEditor(post);
    return;
  }
  el.profileContentPanel.innerHTML = renderProfilePostDetail(post, state.personalProfilePostEditable);
}

async function openProfilePost(postId) {
  if (!postId) return;
  state.personalProfileView = "detail";
  state.personalProfileSelectedPostId = String(postId);
  const cached = wikiPublicPosts().find((post) => String(post.id) === String(postId));
  state.personalProfileSelectedPost = cached || null;
  state.personalProfilePostEditable = cached ? String(cached.author?.id) === String(state.activeUser?.id) : false;
  renderProfileContentPanel();
  try {
    const payload = await apiJson(`/api/feed/posts/${encodeURIComponent(postId)}`, { method: "GET" });
    state.personalProfileSelectedPost = payload.post || cached || null;
    state.personalProfilePostEditable = Boolean(payload.editable);
    renderProfileContentPanel();
  } catch (e) {
    el.profileContentPanel.innerHTML = profileEmptyState("文章打不开", String(e?.message || e));
  }
}

async function saveProfilePostEdit(form) {
  const post = state.personalProfileSelectedPost;
  if (!post) return;
  const status = form.querySelector("[data-profile-editor-status]");
  if (status) status.textContent = "保存中...";
  const formData = new FormData(form);
  const payload = {
    title: String(formData.get("title") || ""),
    summary: String(formData.get("summary") || ""),
    body: String(formData.get("body") || ""),
    category: String(formData.get("category") || ""),
    contentType: String(formData.get("contentType") || "article"),
    tags: String(formData.get("tags") || ""),
  };
  try {
    const result = await apiJson(`/api/feed/posts/${encodeURIComponent(post.id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    state.personalProfileSelectedPost = result.post || { ...post, ...payload };
    state.personalProfilePostEditable = Boolean(result.editable);
    const index = state.personalProfilePosts.findIndex((item) => String(item.id) === String(post.id));
    if (index >= 0 && result.post) state.personalProfilePosts[index] = result.post;
    state.personalProfileView = "detail";
    renderPersonalProfileChrome();
    renderProfileContentPanel();
  } catch (e) {
    if (status) status.textContent = String(e?.message || e);
  }
}

function renderProfileContentPanel() {
  if (!el.profileContentPanel) return;
  if (state.personalProfileView === "detail" || state.personalProfileView === "editing") {
    renderProfilePostView();
    return;
  }
  if (el.profileEditButton) el.profileEditButton.textContent = "编辑";
  const tab = state.personalProfileTab;
  const isArticleArchive = tab === "answers";
  renderProfileArchiveTabs(isArticleArchive);
  renderProfileFilterTags();
  if (el.profileSkillTags) el.profileSkillTags.hidden = true;
  if (el.profileTabs) {
    el.profileTabs.querySelectorAll("[data-profile-tab]").forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-profile-tab") === tab);
      button.setAttribute("aria-selected", String(button.getAttribute("data-profile-tab") === tab));
    });
  }
  document.querySelectorAll(".wiki-float-nav [data-profile-tab]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-profile-tab") === tab);
  });
  document.querySelectorAll("[data-profile-filter]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-profile-filter") === state.personalProfileFilter);
  });
  if (el.profileFilterNotice) {
    el.profileFilterNotice.hidden = true;
    el.profileFilterNotice.textContent = state.personalProfileFilter
      ? `正在筛选：${state.personalProfileFilter}。再次点击同一标签可取消筛选。`
      : "";
  }
  if (tab === "answers") {
    const posts = wikiPublicPosts().filter((post) => profilePostMatchesFilter(post, state.personalProfileFilter));
    if (!posts.length) {
      el.profileContentPanel.innerHTML = state.personalProfileFilter
        ? profileEmptyState("没有匹配的文章", `这组内容里没有 #${state.personalProfileFilter} 标签。再次点击标签可取消筛选。`)
        : profileEmptyState("还没有公开文章", "去推送页发布问题、文章、文档或视频后，会自动进入这里。", "去发布内容");
      return;
    }
    el.profileContentPanel.innerHTML = profileArchiveGroups(posts).map(renderProfileArchiveGroup).join("");
    return;
  }
  if (tab === "questions") {
    const projects = wikiPathEntries();
    if (!projects.length) {
      el.profileContentPanel.innerHTML = profileEmptyState("还没有项目", "生成学习资源或学习路径后，会按知识大类生成项目卡。");
      return;
    }
    el.profileContentPanel.innerHTML = `
      <div class="wiki-project-grid">
        ${projects.map((project) => `
          <article class="wiki-project-card">
            <h3>${escapeHtml(project.category)} <span>${escapeHtml(formatWikiDate(project.updatedAt) || "")}</span></h3>
            <p><strong>${escapeHtml(project.topic || project.category)}</strong></p>
            <p>${project.resources.length} 个资源沉淀在这条学习路径中。</p>
          </article>
        `).join("")}
      </div>
    `;
    return;
  }
  if (tab === "collections") {
    const profile = state.studentProfile || createEmptyProfile();
    const facts = PROFILE_FIELDS.map((key) => profile[key]?.value).filter(Boolean).slice(0, 4);
    el.profileContentPanel.innerHTML = `
      <article class="wiki-about-card">
        <h3>Hi! I'm ${escapeHtml(state.activeUser?.name || "yrk")}</h3>
        <p>${escapeHtml(accountProfileFor().bio || "这个主页会随着你的账号资料、学习画像和公开动态自动更新。")}</p>
        ${facts.length ? facts.map((fact) => `<p>${escapeHtml(fact)}</p>`).join("") : `<p>继续对话和生成资源后，学习画像中的关键信息会出现在这里。</p>`}
      </article>
    `;
    return;
  }
  if (tab === "notes" || tab === "prompts") {
    const shares = wikiStoredDocs().map((doc) => ({
      title: doc.title || doc.filename || "未命名文档",
      tag: doc.category || "文档",
      meta: `${String(doc.content || "").length} 字符 · ${formatWikiDate(doc.updatedAt || doc.addedAt)}`,
    })).concat(wikiResources().map((resource) => ({
      title: resource.title || "学习资源",
      tag: resource.type || "资源",
      meta: state.learningResources?.topic || "当前资源库",
    }))).slice(0, 8);
    if (!shares.length) {
      el.profileContentPanel.innerHTML = profileEmptyState("还没有分享资源", "保存文档或生成学习资源后，会自动成为可展示的分享卡。");
      return;
    }
    el.profileContentPanel.innerHTML = `
      <div class="wiki-share-grid">
        ${shares.map(({ title, tag, meta }) => `
          <article class="wiki-share-card">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(tag)}</p>
            <p>${escapeHtml(meta)}</p>
          </article>
        `).join("")}
      </div>
    `;
    return;
  }
  el.profileContentPanel.innerHTML = profileEmptyState("这里还没有内容", "内容产生后会自动展示在这个列表里。");
}

function setWikiArchiveMode(open) {
  el.userInfoPage?.classList.toggle("wiki-archive-mode", Boolean(open));
}

function renderPersonalProfilePage() {
  renderPersonalProfileChrome();
  renderProfileTrendChart();
  renderProfileContentPanel();
  void loadPersonalProfileRemoteData();
}

function toggleProfileFilter(filter) {
  state.personalProfileFilter = state.personalProfileFilter === filter ? "" : filter;
  document.querySelectorAll("[data-profile-filter]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-profile-filter") === state.personalProfileFilter);
  });
  state.personalProfileTab = "answers";
  renderProfileContentPanel();
}

function handleProfileAnswerAction() {
  renderProfileContentPanel();
}
