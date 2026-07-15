async function loadAnnouncements() {
  if (!state.activeUser || !el.announcementCenter) return;
  try {
    const payload = await apiJson(ANNOUNCEMENT_ENDPOINT, { method: "GET" });
    renderAnnouncements(payload.announcements || []);
  } catch (e) {
    console.warn("加载公告失败", e);
  }
}

function announcementReadStorageKey() {
  return `${ANNOUNCEMENT_READ_STORAGE}:${state.activeUser?.id || "guest"}`;
}

function announcementReadKey(item) {
  return `${item.id}:${item.updatedAt || item.createdAt || ""}`;
}

function loadReadAnnouncements() {
  try {
    return new Set(JSON.parse(localStorage.getItem(announcementReadStorageKey()) || "[]"));
  } catch {
    return new Set();
  }
}

function saveReadAnnouncements(readSet) {
  localStorage.setItem(announcementReadStorageKey(), JSON.stringify([...readSet]));
}

function setAnnouncementPanelOpen(open) {
  if (!el.announcementPanel || !el.announcementToggle) return;
  el.announcementPanel.hidden = !open;
  el.announcementToggle.setAttribute("aria-expanded", String(open));
}

function markAnnouncementRead(id) {
  const item = state.announcements.find((announcement) => String(announcement.id) === String(id));
  if (!item) return;
  const readSet = loadReadAnnouncements();
  readSet.add(announcementReadKey(item));
  saveReadAnnouncements(readSet);
  renderAnnouncements(state.announcements);
}

function markAllAnnouncementsRead() {
  const readSet = loadReadAnnouncements();
  state.announcements.forEach((item) => readSet.add(announcementReadKey(item)));
  saveReadAnnouncements(readSet);
  state.showAllAnnouncements = false;
  renderAnnouncements(state.announcements);
}

function isAnnouncementActive(item) {
  const now = Date.now();
  const startsAt = item.startsAt ? new Date(item.startsAt).getTime() : 0;
  const endsAt = item.endsAt ? new Date(item.endsAt).getTime() : Infinity;
  return (!startsAt || startsAt <= now) && (!Number.isFinite(endsAt) || endsAt >= now);
}

function renderAnnouncements(announcements) {
  if (!el.announcementCenter) return;
  state.announcements = announcements;
  const readSet = loadReadAnnouncements();
  const visibleAnnouncements = announcements.filter(isAnnouncementActive);
  const unreadAnnouncements = visibleAnnouncements.filter((item) => !readSet.has(announcementReadKey(item)));
  const unreadCount = unreadAnnouncements.length;

  if (!announcements.length) {
    el.announcementCenter.hidden = true;
    setAnnouncementPanelOpen(false);
    return;
  }
  el.announcementCenter.hidden = false;
  el.announcementToggle?.classList.toggle("has-unread", unreadCount > 0);
  if (el.announcementUnreadCount) {
    el.announcementUnreadCount.hidden = unreadCount === 0;
    el.announcementUnreadCount.textContent = String(Math.min(99, unreadCount));
  }
  if (el.announcementSummary) {
    el.announcementSummary.textContent = state.showAllAnnouncements
      ? `${announcements.length} 条已发布`
      : (unreadCount ? `${unreadCount} 条未读` : "暂无未读公告");
  }
  if (el.announcementShowAll) {
    el.announcementShowAll.textContent = state.showAllAnnouncements ? "只看未读" : "查看全部";
  }
  if (!el.announcementList) return;
  const displayedAnnouncements = state.showAllAnnouncements ? announcements : unreadAnnouncements;
  if (!displayedAnnouncements.length) {
    el.announcementList.innerHTML = `
      <div class="announcement-empty">
        <strong>没有未读公告</strong>
        <span>已读公告可在“查看全部”中回看。</span>
      </div>
    `;
    return;
  }
  el.announcementList.innerHTML = displayedAnnouncements.map((item) => {
    const read = readSet.has(announcementReadKey(item));
    const active = isAnnouncementActive(item);
    return `
      <article class="announcement-item announcement-${escapeHtml(item.level || "info")} ${read ? "is-read" : "is-unread"} ${active ? "" : "is-inactive"}" data-announcement-id="${escapeHtml(item.id)}">
        <div class="announcement-item-head">
          <div>
            <strong>${escapeHtml(item.title || "公告")}</strong>
            <span>${active ? (read ? "已读" : "未读") : "未到展示时间或已过期"}</span>
          </div>
          ${read ? "" : `<button type="button" data-announcement-read="${escapeHtml(item.id)}">已读</button>`}
        </div>
        <div class="announcement-markdown">${renderAnnouncementMarkdown(item.content || "")}</div>
      </article>
    `;
  }).join("");
}

function renderAnnouncementInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, href) => {
      const rawHref = href.replace(/&amp;/g, "&");
      if (!/^(https?:\/\/|mailto:|\/|#)/i.test(rawHref)) return label;
      return `<a href="${escapeHtml(rawHref)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
}

function renderAnnouncementMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    html.push(`<ul>${listItems.map((item) => `<li>${renderAnnouncementInlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      listItems.push(listMatch[1]);
      continue;
    }
    flushList();
    if (!trimmed) continue;
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      html.push(`<h4>${renderAnnouncementInlineMarkdown(heading[2])}</h4>`);
      continue;
    }
    const quote = trimmed.match(/^>\s?(.+)$/);
    if (quote) {
      html.push(`<blockquote>${renderAnnouncementInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }
    html.push(`<p>${renderAnnouncementInlineMarkdown(trimmed)}</p>`);
  }
  flushList();
  return html.join("") || `<p>暂无公告内容</p>`;
}

