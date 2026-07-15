const FEED_ENDPOINT = "/api/feed";
const FEED_TYPE_LABELS = {
  question: "问题",
  answer: "答案",
  thought: "想法",
  article: "文章",
  document: "文档",
  video: "视频",
};
const FEED_TYPE_META = {
  question: { icon: "?", cls: "question", cover: "求解讨论" },
  answer: { icon: "A", cls: "answer", cover: "精选回答" },
  thought: { icon: "✦", cls: "thought", cover: "灵感想法" },
  article: { icon: "文", cls: "article", cover: "深度文章" },
  document: { icon: "页", cls: "document", cover: "知识文档" },
  video: { icon: "▶", cls: "video", cover: "视频笔记" },
};

function currentFeedPostById(id) {
  return state.feedPosts.find((item) => String(item.id) === String(id));
}

function upsertFeedPost(post) {
  if (!post?.id) return;
  const exists = state.feedPosts.some((item) => String(item.id) === String(post.id));
  state.feedPosts = exists
    ? state.feedPosts.map((item) => (String(item.id) === String(post.id) ? { ...item, ...post } : item))
    : [post].concat(state.feedPosts);
}

function feedTagsFromText(value) {
  const seen = new Set();
  return String(value || "")
    .split(/[,，#\s]+/)
    .map((item) => item.trim().replace(/^#/, "").slice(0, 32))
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function formatFeedTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function setFeedMessage(message = "", type = "error") {
  if (!el.feedComposerMessage) return;
  el.feedComposerMessage.textContent = message;
  el.feedComposerMessage.classList.toggle("success", type === "success");
}

function setFeedComposerOpen(open) {
  state.feedComposerOpen = Boolean(open);
  if (el.feedComposer) el.feedComposer.hidden = !state.feedComposerOpen;
  if (el.pushGenerateResourcesBtn) el.pushGenerateResourcesBtn.textContent = state.feedComposerOpen ? "收起发布" : "发布内容";
  if (state.feedComposerOpen) el.feedTitleInput?.focus();
}

async function loadFeed({ append = false } = {}) {
  if (!state.activeUser || state.feedLoading) return;
  state.feedLoading = true;
  renderFeedLoading();
  try {
    const page = append ? state.feedPage + 1 : 1;
    const query = new URLSearchParams({ sort: state.feedSort, page: String(page), limit: "10" });
    const payload = await apiJson(`${FEED_ENDPOINT}?${query.toString()}`, { method: "GET" });
    state.feedPage = payload.page || page;
    state.feedPosts = append ? state.feedPosts.concat(payload.posts || []) : (payload.posts || []);
    state.feedInterests = payload.interests || [];
    state.feedHasMore = Boolean(payload.hasMore);
    renderFeedPage();
  } catch (e) {
    if (el.pushGrid) {
      el.pushGrid.innerHTML = `<div class="resource-empty">${escapeHtml(e.message || "动态加载失败。")}</div>`;
    }
  } finally {
    state.feedLoading = false;
  }
}

async function loadFeedNotifications() {
  if (!state.activeUser) return;
  try {
    const payload = await apiJson("/api/feed/notifications", { method: "GET" });
    state.feedNotifications = payload.notifications || [];
    state.feedUnreadNotifications = payload.unread || 0;
    renderFeedNotifications();
  } catch {
  }
}

function renderFeedLoading() {
  if (!el.pushGrid || state.feedPosts.length) return;
  el.pushGrid.innerHTML = `<div class="resource-empty">正在加载社区动态...</div>`;
}

function renderPushPage() {
  updateFeedTabs();
  if (el.feedInterestInput && !el.feedInterestInput.value && state.feedInterests.length) {
    el.feedInterestInput.value = state.feedInterests.map((item) => item.tag).join("，");
  }
  renderFeedPage();
  if (!state.feedPosts.length) void loadFeed();
  void loadFeedNotifications();
}

function updateFeedTabs() {
  document.querySelectorAll("[data-feed-sort]").forEach((btn) => {
    const active = btn.getAttribute("data-feed-sort") === state.feedSort;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
}

function renderFeedPage() {
  if (!el.pushGrid) return;
  updateFeedTabs();
  const interestHtml = state.feedInterests.length
    ? `<div class="feed-interest-strip">${state.feedInterests.slice(0, 8).map((item) => `<span>#${escapeHtml(item.tag)}</span>`).join("")}</div>`
    : `<div class="feed-interest-strip"><span>还没有兴趣标签</span></div>`;
  const notificationHtml = renderFeedNotificationsHtml();
  if (!state.feedPosts.length) {
    el.pushGrid.innerHTML = `
      ${notificationHtml}
      ${interestHtml}
      <div class="resource-empty">还没有动态。发布第一条内容，或保存几个兴趣标签刷新推荐。</div>
    `;
    return;
  }
  el.pushGrid.innerHTML = `
    ${notificationHtml}
    ${interestHtml}
    <section class="feed-masonry" aria-label="社区动态列表">
      ${state.feedPosts.map(renderFeedCard).join("")}
    </section>
    <div class="feed-load-more-row">
      <button class="feed-load-more" type="button" data-feed-load-more ${state.feedHasMore ? "" : "disabled"}>
        ${state.feedHasMore ? "加载更多" : "没有更多了"}
      </button>
    </div>
  `;
}

function renderFeedNotificationsHtml() {
  const list = state.feedNotifications || [];
  if (!list.length) return "";
  return `
    <section class="feed-notice-strip">
      <button type="button" data-feed-notice-open>
        评论提醒 ${state.feedUnreadNotifications ? `<strong>${state.feedUnreadNotifications}</strong>` : ""}
      </button>
      <div>
        ${list.slice(0, 2).map((item) => `<span>${escapeHtml(item.message || "有新的评论")}</span>`).join("")}
      </div>
      <button type="button" data-feed-notice-read>已读</button>
    </section>
  `;
}

function renderFeedNotifications() {
  if (!el.pushGrid || el.pushPage?.hidden) return;
  const existing = el.pushGrid.querySelector(".feed-notice-strip");
  const html = renderFeedNotificationsHtml();
  if (existing) {
    if (html) existing.outerHTML = html;
    else existing.remove();
  } else if (html) {
    el.pushGrid.insertAdjacentHTML("afterbegin", html);
  }
}

function renderFeedCard(post) {
  const type = FEED_TYPE_LABELS[post.contentType] || "动态";
  const meta = FEED_TYPE_META[post.contentType] || FEED_TYPE_META.thought;
  const tags = (post.tags || []).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("");
  const reason = post.recommendationReasons || {};
  const reasonText = reason.followedAuthor
    ? "关注作者"
    : reason.interest > 0
      ? "兴趣匹配"
      : reason.profile > 0
        ? "画像匹配"
        : post.recallSource === "fresh"
          ? "新发布"
          : "热度上升";
  return `
    <article class="feed-card feed-card-${escapeHtml(meta.cls)}" data-feed-post-id="${escapeHtml(post.id)}" tabindex="0" role="button" aria-label="打开 ${escapeHtml(post.title)}">
      <div class="feed-cover" aria-hidden="true">
        <div>
          <span>${escapeHtml(meta.icon)}</span>
          <strong>${escapeHtml(meta.cover)}</strong>
        </div>
        ${post.contentType === "video" ? `<b class="feed-play-mark">▶</b>` : ""}
        ${post.contentType === "document" ? `<b class="feed-doc-mark">PDF</b>` : ""}
      </div>
      <div class="feed-card-main">
        <div class="feed-card-head">
          <span class="feed-type">${escapeHtml(type)}</span>
          ${post.category ? `<span class="feed-category">${escapeHtml(post.category)}</span>` : ""}
          <span class="feed-time">${escapeHtml(formatFeedTime(post.createdAt))}</span>
        </div>
        <h2>${escapeHtml(post.title)}</h2>
        <p>${escapeHtml(post.summary || post.body || "")}</p>
        <div class="feed-tags">${tags}</div>
        <div class="feed-author-row">
          <strong>${escapeHtml(post.author?.name || "社区用户")}</strong>
          <span>${escapeHtml(reasonText)} · 热度 ${Number(post.heatScore || 0).toFixed(1)}</span>
        </div>
      </div>
      <div class="feed-actions">
        <button type="button" data-feed-action="like" class="${post.liked ? "active" : ""}" aria-pressed="${post.liked ? "true" : "false"}">
          <span aria-hidden="true">♡</span>${post.likes || 0}
        </button>
        <button type="button" data-feed-action="favorite" class="${post.favorited ? "active" : ""}" aria-pressed="${post.favorited ? "true" : "false"}">
          <span aria-hidden="true">☆</span>${post.favorites || 0}
        </button>
        <button type="button" data-feed-action="comment">
          <span aria-hidden="true">↗</span>${post.comments || 0}
        </button>
        <button type="button" data-feed-action="follow" class="${post.author?.followed ? "active" : ""}" aria-pressed="${post.author?.followed ? "true" : "false"}">
          ${post.author?.followed ? "已关" : "关注"}
        </button>
      </div>
    </article>
  `;
}

function feedPostMarkdown(post) {
  const lines = [
    post.summary ? `> ${post.summary}` : "",
    "",
    post.body || post.summary || "",
  ].filter((line, index, arr) => line || arr[index - 1]);
  if (post.contentType === "video") {
    lines.push("", "### 视频要点", "- 这条内容当前以视频笔记卡片展示。", "- 后续接入真实视频资源时，可在这里嵌入播放器或播放链接。");
  }
  if (post.contentType === "document") {
    lines.push("", "### 文档信息", "- 这条内容当前以文档卡片展示。", "- 正文可继续扩展为完整 Markdown 文档、附件或知识库条目。");
  }
  return lines.join("\n");
}

function openFeedPostDetail(post) {
  if (!post || !el.pushDetailModal) return;
  el.pushDetailModal.classList.remove("profile-social-modal");
  const type = FEED_TYPE_LABELS[post.contentType] || "动态";
  const tags = (post.tags || []).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("");
  if (el.pushDetailType) el.pushDetailType.textContent = type;
  if (el.pushDetailTitle) el.pushDetailTitle.textContent = post.title || "动态详情";
  if (el.pushDetailMeta) {
    el.pushDetailMeta.innerHTML = `
      <button class="feed-author-link" type="button" data-feed-author-id="${escapeHtml(post.author?.id || "")}">${escapeHtml(post.author?.name || "社区用户")}</button>
      <span>${escapeHtml(formatFeedTime(post.createdAt))}</span>
      ${post.category ? `<span>${escapeHtml(post.category)}</span>` : ""}
      <span>热度 ${Number(post.heatScore || 0).toFixed(1)}</span>
      <span>赞 ${post.likes || 0}</span>
      <span>藏 ${post.favorites || 0}</span>
      <span>评 ${post.comments || 0}</span>
      ${tags}
    `;
  }
  if (el.pushDetailBody) {
    el.pushDetailBody.innerHTML = `
      <div class="feed-detail-content markdown-body"></div>
      <section class="feed-detail-comments" data-feed-comments-for="${escapeHtml(post.id)}">
        <div class="feed-comments-head">
          <h3>评论</h3>
          <span>大家都能看到这里的讨论</span>
        </div>
        <div class="feed-comment-list">正在加载评论...</div>
        <form class="feed-comment-form" data-feed-comment-form="${escapeHtml(post.id)}">
          <textarea name="comment" rows="3" placeholder="写下你的评论"></textarea>
          <button type="submit">发布评论</button>
        </form>
      </section>
    `;
    renderMarkdownInto(el.pushDetailBody.querySelector(".feed-detail-content"), feedPostMarkdown(post));
  }
  el.pushDetailModal.hidden = false;
  void loadFeedComments(post.id);
}

function renderFeedComments(postId, comments = []) {
  const wrap = el.pushDetailBody?.querySelector(".feed-detail-comments");
  if (!wrap) return;
  const list = wrap.querySelector(".feed-comment-list");
  if (!list) return;
  list.innerHTML = comments.length
    ? comments.map((comment) => `
        <article class="feed-comment-item">
          <button type="button" data-feed-author-id="${escapeHtml(comment.author?.id || "")}">${escapeHtml(comment.author?.name || "社区用户")}</button>
          <p>${escapeHtml(comment.body || "")}</p>
          <span>${escapeHtml(formatFeedTime(comment.createdAt))}</span>
        </article>
      `).join("")
    : `<div class="feed-comment-empty">还没有评论，来坐第一排。</div>`;
}

async function loadFeedComments(postId) {
  try {
    const payload = await apiJson(`/api/feed/posts/${encodeURIComponent(postId)}/comments`, { method: "GET" });
    renderFeedComments(postId, payload.comments || []);
  } catch (e) {
    renderFeedComments(postId, []);
  }
}

function renderFeedAuthorProfile(author, posts = []) {
  if (!el.pushDetailModal) return;
  el.pushDetailModal.classList.add("profile-social-modal");
  const authorName = author.name || "社区用户";
  const initials = String(authorName || "社").slice(0, 2).toUpperCase();
  if (el.pushDetailType) el.pushDetailType.textContent = "博主主页";
  if (el.pushDetailTitle) el.pushDetailTitle.textContent = authorName;
  if (el.pushDetailMeta) {
    el.pushDetailMeta.innerHTML = `
      <span>${author.posts || 0} 条动态</span>
      <span>${author.followers || 0} 位关注者</span>
      <button class="feed-author-link ${author.followed ? "active" : ""}" type="button" data-feed-author-follow="${escapeHtml(author.id)}">
        ${author.followed ? "已关注" : "关注博主"}
      </button>
    `;
  }
  if (el.pushDetailBody) {
    el.pushDetailBody.innerHTML = `
      <section class="feed-author-home">
        <div class="feed-author-identity-card">
          <div class="feed-author-avatar">${escapeHtml(initials)}</div>
          <div>
            <h3>${escapeHtml(authorName)}</h3>
            <p>@${escapeHtml(normalizeUsername(authorName) || "author")}</p>
          </div>
        </div>
        <div class="feed-author-welcome-card">
          <div class="feed-author-avatar feed-author-avatar-large">${escapeHtml(initials)}</div>
          <h3>Good Evening</h3>
          <p>I'm <strong>${escapeHtml(authorName)}</strong>, nice to meet you!</p>
          <span>这个主页会展示博主发布过的公开动态，关注后 TA 的内容会优先进入你的推荐候选集。</span>
        </div>
        <div class="feed-author-stat-card">
          <strong>${author.posts || 0}</strong>
          <span>公开动态</span>
        </div>
        <div class="feed-author-stat-card">
          <strong>${author.followers || 0}</strong>
          <span>关注者</span>
        </div>
        <section class="feed-author-posts" aria-label="博主动态">
          ${posts.length ? posts.map((post) => `
            <button type="button" data-feed-open-post="${escapeHtml(post.id)}">
              <strong>${escapeHtml(post.title)}</strong>
              <span>${escapeHtml(FEED_TYPE_LABELS[post.contentType] || "动态")} · ${escapeHtml(formatFeedTime(post.createdAt))}</span>
            </button>
          `).join("") : `<div class="feed-comment-empty">这个博主还没有公开动态。</div>`}
        </section>
      </section>
    `;
  }
  el.pushDetailModal.hidden = false;
}

async function openFeedAuthorProfile(authorId) {
  if (!authorId) return;
  if (typeof openPublicAuthorProfilePage === "function") {
    await openPublicAuthorProfilePage(authorId);
    return;
  }
  try {
    const payload = await apiJson(`/api/feed/authors/${encodeURIComponent(authorId)}`, { method: "GET" });
    (payload.posts || []).forEach(upsertFeedPost);
    renderFeedAuthorProfile(payload.author, payload.posts || []);
  } catch (e) {
    if (el.pushDetailBody) el.pushDetailBody.innerHTML = `<div class="feed-comment-empty">${escapeHtml(e.message || "作者主页加载失败。")}</div>`;
  }
}

function updateFeedPost(id, updater) {
  state.feedPosts = state.feedPosts.map((post) => (String(post.id) === String(id) ? updater({ ...post }) : post));
  renderFeedPage();
}

async function submitFeedPost(e) {
  e.preventDefault();
  const payload = {
    contentType: el.feedTypeInput?.value || "thought",
    title: el.feedTitleInput?.value || "",
    category: el.feedCategoryInput?.value || "",
    tags: feedTagsFromText(el.feedTagsInput?.value || ""),
    body: el.feedBodyInput?.value || "",
  };
  setFeedMessage("");
  try {
    await apiJson("/api/feed/posts", { method: "POST", body: JSON.stringify(payload) });
    if (el.feedTitleInput) el.feedTitleInput.value = "";
    if (el.feedBodyInput) el.feedBodyInput.value = "";
    setFeedComposerOpen(false);
    state.feedSort = "latest";
    await loadFeed();
  } catch (e) {
    setFeedMessage(e.message || "发布失败。");
  }
}

async function handleFeedAction(action, post) {
  if (!post) return;
  try {
    if (action === "like" || action === "favorite") {
      const payload = await apiJson(`/api/feed/posts/${encodeURIComponent(post.id)}/${action}`, { method: "POST" });
      updateFeedPost(post.id, (item) => {
        const key = action === "like" ? "liked" : "favorited";
        const countKey = action === "like" ? "likes" : "favorites";
        item[key] = Boolean(payload.active);
        item[countKey] = Math.max(0, Number(item[countKey] || 0) + (payload.active ? 1 : -1));
        item.heatScore = payload.heatScore ?? item.heatScore;
        return item;
      });
      if (action === "favorite") {
        if (payload.active && typeof addFavoriteToDefaultCollection === "function") {
          addFavoriteToDefaultCollection(post);
        } else if (!payload.active && typeof removeFavoriteFromAllCollections === "function") {
          removeFavoriteFromAllCollections(post.id);
        }
      }
      return;
    }
    if (action === "follow") {
      const payload = await apiJson(`/api/feed/authors/${encodeURIComponent(post.author.id)}/follow`, { method: "POST" });
      state.feedPosts = state.feedPosts.map((item) => (
        String(item.author?.id) === String(post.author.id)
          ? { ...item, author: { ...item.author, followed: Boolean(payload.active) } }
          : item
      ));
      if (typeof loadProfileSocialStats === "function") void loadProfileSocialStats(true);
      renderFeedPage();
      return;
    }
    if (action === "comment") {
      openFeedPostDetail(post);
      window.setTimeout(() => el.pushDetailBody?.querySelector(".feed-comment-form textarea")?.focus(), 80);
    }
  } catch (e) {
    if (el.pushGrid) {
      const note = document.createElement("div");
      note.className = "feed-toast";
      note.textContent = e.message || "操作失败。";
      el.pushGrid.prepend(note);
      window.setTimeout(() => note.remove(), 2400);
    }
  }
}

function initFeedEventHandlers() {
  document.querySelectorAll("[data-feed-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sort = btn.getAttribute("data-feed-sort");
      if (!sort || sort === state.feedSort) return;
      state.feedSort = sort;
      state.feedPage = 1;
      state.feedPosts = [];
      void loadFeed();
    });
  });
  el.pushGenerateResourcesBtn?.addEventListener("click", () => setFeedComposerOpen(!state.feedComposerOpen));
  el.feedComposer?.addEventListener("submit", submitFeedPost);
  el.feedComposer?.addEventListener("click", (e) => {
    if (e.target instanceof HTMLElement && e.target.closest("[data-feed-compose-close]")) {
      setFeedComposerOpen(false);
    }
  });
  el.feedInterestForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tags = feedTagsFromText(el.feedInterestInput?.value || "");
    try {
      const payload = await apiJson("/api/feed/interests", { method: "PUT", body: JSON.stringify({ tags }) });
      state.feedInterests = payload.interests || [];
      state.feedSort = "recommended";
      state.feedPosts = [];
      await loadFeed();
    } catch (err) {
      setFeedMessage(err.message || "兴趣标签保存失败。");
    }
  });
  el.pushGrid?.addEventListener("click", (e) => {
    const loadMore = e.target instanceof HTMLElement ? e.target.closest("[data-feed-load-more]") : null;
    if (loadMore) {
      void loadFeed({ append: true });
      return;
    }
    const noticeRead = e.target instanceof HTMLElement ? e.target.closest("[data-feed-notice-read]") : null;
    if (noticeRead) {
      void apiJson("/api/feed/notifications/read", { method: "POST" }).then(() => {
        state.feedUnreadNotifications = 0;
        state.feedNotifications = (state.feedNotifications || []).map((item) => ({ ...item, read: true }));
        renderFeedNotifications();
      });
      return;
    }
    const actionBtn = e.target instanceof HTMLElement ? e.target.closest("[data-feed-action]") : null;
    const card = e.target instanceof HTMLElement ? e.target.closest("[data-feed-post-id]") : null;
    const id = card?.getAttribute("data-feed-post-id");
    const post = currentFeedPostById(id);
    if (actionBtn) {
      void handleFeedAction(actionBtn.getAttribute("data-feed-action"), post);
      return;
    }
    openFeedPostDetail(post);
  });
  el.pushGrid?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target instanceof HTMLElement ? e.target.closest("[data-feed-post-id]") : null;
    if (!card) return;
    e.preventDefault();
    openFeedPostDetail(currentFeedPostById(card.getAttribute("data-feed-post-id")));
  });
  el.pushDetailModal?.addEventListener("click", (e) => {
    if (!(e.target instanceof HTMLElement)) return;
    const authorBtn = e.target.closest("[data-feed-author-id]");
    if (authorBtn) {
      void openFeedAuthorProfile(authorBtn.getAttribute("data-feed-author-id"));
      return;
    }
    const followBtn = e.target.closest("[data-feed-author-follow]");
    if (followBtn) {
      void apiJson(`/api/feed/authors/${encodeURIComponent(followBtn.getAttribute("data-feed-author-follow"))}/follow`, { method: "POST" })
        .then(() => {
          if (typeof loadProfileSocialStats === "function") void loadProfileSocialStats(true);
          return openFeedAuthorProfile(followBtn.getAttribute("data-feed-author-follow"));
        });
      return;
    }
    const postBtn = e.target.closest("[data-feed-open-post]");
    if (postBtn) {
      openFeedPostDetail(currentFeedPostById(postBtn.getAttribute("data-feed-open-post")));
    }
  });
  el.pushDetailModal?.addEventListener("submit", (e) => {
    const form = e.target instanceof HTMLElement ? e.target.closest("[data-feed-comment-form]") : null;
    if (!form) return;
    e.preventDefault();
    const postId = form.getAttribute("data-feed-comment-form");
    const textarea = form.querySelector("textarea");
    const body = textarea?.value.trim();
    if (!postId || !body) return;
    void apiJson(`/api/feed/posts/${encodeURIComponent(postId)}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }).then((payload) => {
      if (textarea) textarea.value = "";
      updateFeedPost(postId, (item) => {
        item.comments = Number(item.comments || 0) + 1;
        item.heatScore = payload.heatScore ?? item.heatScore;
        return item;
      });
      return loadFeedComments(postId);
    });
  });
}
