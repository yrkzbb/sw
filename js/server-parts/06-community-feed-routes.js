const FEED_TYPES = new Set(["question", "answer", "thought", "article", "document", "video"]);
const FEED_SORTS = new Set(["recommended", "latest", "hot"]);
const FEED_DEMO_AUTHORS = [
  { username: "Lin Chen", email: "lin.chen.feed@example.local" },
  { username: "Kai Ming", email: "kai.ming.feed@example.local" },
  { username: "Nora Xu", email: "nora.xu.feed@example.local" },
];
const FEED_DEMO_POSTS = [
  {
    author: "Lin Chen",
    content_type: "question",
    title: "RAG 项目里如何判断切片粒度是否合适？",
    summary: "我在做课程知识库时发现召回片段有时太长，有时又丢上下文，想听听大家的评估办法。",
    body: "目前用章节标题做粗切，再按 600 字窗口滑动。问题是学生问具体概念时会混进太多背景；问跨章节问题时又经常缺依赖。你们会用哪些指标或人工样例来调切片？",
    category: "AI 应用",
    tags: ["RAG", "知识库", "模型评测"],
    like_count: 18,
    comment_count: 7,
    favorite_count: 12,
    view_count: 246,
  },
  {
    author: "Kai Ming",
    content_type: "article",
    title: "用错题本反推学习路径的一套小流程",
    summary: "把错题按概念、原因、修正证据三层拆开，再决定下一批资源应该推讲解、练习还是实操。",
    body: "我比较喜欢先看错误原因而不是题目类型：概念混淆补图解，步骤断裂补例题，迁移困难补项目小练习。这样推送资源时不会只看关键词，而是能看见学习者真正卡在哪一步。",
    category: "学习方法",
    tags: ["学习路径", "错题复盘", "数据分析"],
    like_count: 24,
    comment_count: 9,
    favorite_count: 16,
    view_count: 318,
  },
  {
    author: "Nora Xu",
    content_type: "thought",
    title: "AI Coding 里最值得记录的是“为什么改”",
    summary: "代码生成结果很容易保存，但真正能复用的是约束、权衡和失败原因。",
    body: "最近整理项目日志时发现，只存最终代码帮助有限。把每次提示词调整、测试失败、边界条件补充都记下来，下一次让模型协作会顺很多。",
    category: "工程实践",
    tags: ["AI Coding", "项目实践", "经验分享"],
    like_count: 31,
    comment_count: 11,
    favorite_count: 20,
    view_count: 402,
  },
  {
    author: "Lin Chen",
    content_type: "answer",
    title: "答：先用小样本问题集反查召回片段",
    summary: "不要一上来调 chunk 参数，先做 20-50 个真实问题，把命中片段、遗漏上下文和噪声来源标出来。",
    body: "我的做法是把问题分成定义、对比、步骤、跨章节四类。每类看 top3 片段是否覆盖关键句，再决定是改切片、加标题路径，还是做 query rewrite。这样比只盯相似度分数稳得多。",
    category: "AI 应用",
    tags: ["RAG", "模型评测", "经验分享"],
    like_count: 16,
    comment_count: 5,
    favorite_count: 14,
    view_count: 212,
  },
  {
    author: "Kai Ming",
    content_type: "document",
    title: "学习路径评估清单：从画像到资源推送",
    summary: "一页式文档模板：学习目标、基础薄弱点、资源证据、下一步动作和复盘周期。",
    body: "文档结构建议分五块：用户目标、已有基础、最近行为、错题证据、下一步资源。每次推荐资源时都要写清为什么推它，以及如何判断它已经起作用。",
    category: "学习方法",
    tags: ["学习路径", "文档模板", "复盘"],
    like_count: 29,
    comment_count: 8,
    favorite_count: 26,
    view_count: 356,
  },
  {
    author: "Nora Xu",
    content_type: "video",
    title: "3 分钟看懂 AI Coding 代码审查节奏",
    summary: "视频脚本拆成三段：先跑测试，再读边界条件，最后让模型解释它为什么这么改。",
    body: "短视频适合讲流程感：不要只展示生成结果，而是展示如何发现问题、怎么收窄上下文、如何验证修复。观众能学到的是协作节奏。",
    category: "工程实践",
    tags: ["AI Coding", "代码审查", "视频"],
    like_count: 37,
    comment_count: 13,
    favorite_count: 22,
    view_count: 528,
  },
];

function normalizeFeedTags(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[,，#\s]+/);
  const seen = new Set();
  return source
    .map((item) => String(item || "").trim().replace(/^#/, "").slice(0, 32))
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function normalizeFeedPostInput(body) {
  const title = String(body.title || "").trim().replace(/\s+/g, " ").slice(0, 180);
  const text = String(body.body || body.content || "").trim().slice(0, 20000);
  const summary = String(body.summary || text.replace(/\s+/g, " ").slice(0, 180)).trim().slice(0, 320);
  const contentType = FEED_TYPES.has(String(body.contentType || body.content_type)) ? String(body.contentType || body.content_type) : "thought";
  return {
    contentType,
    title,
    summary,
    body: text,
    category: String(body.category || "").trim().replace(/\s+/g, " ").slice(0, 80),
    tags: normalizeFeedTags(body.tags),
  };
}

function parseFeedTags(value) {
  if (Array.isArray(value)) return normalizeFeedTags(value);
  try {
    return normalizeFeedTags(JSON.parse(value || "[]"));
  } catch {
    return [];
  }
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function calculateFeedHeat(post) {
  const createdAt = new Date(post.created_at || post.createdAt || Date.now()).getTime();
  const ageHours = Math.max(0, (Date.now() - createdAt) / 36e5);
  const activity =
    Number(post.like_count || 0) * 3 +
    Number(post.comment_count || 0) * 4 +
    Number(post.favorite_count || 0) * 5 +
    Number(post.view_count || 0) * 0.4 +
    8;
  return Number((activity / Math.pow(ageHours + 2, 1.15)).toFixed(4));
}

async function updateFeedPostHeat(pool, postId) {
  const [rows] = await pool.query(
    `SELECT id, like_count, comment_count, favorite_count, view_count, created_at
       FROM ${tableName("feed_posts")}
      WHERE id = ? LIMIT 1`,
    [postId]
  );
  if (!rows.length) return 0;
  const heat = calculateFeedHeat(rows[0]);
  await pool.query(`UPDATE ${tableName("feed_posts")} SET heat_score = ? WHERE id = ?`, [heat, postId]);
  return heat;
}

async function bootstrapFeedDemo(pool) {
  const passwordData = hashPassword(crypto.randomBytes(16).toString("hex"));
  for (const author of FEED_DEMO_AUTHORS) {
    await pool.query(
      `INSERT INTO ${tableName("users")} (username, email, password_salt, password_hash)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE username = VALUES(username)`,
      [author.username, author.email, passwordData.salt, passwordData.hash]
    );
  }
  const [authors] = await pool.query(
    `SELECT id, username FROM ${tableName("users")} WHERE email IN (?)`,
    [FEED_DEMO_AUTHORS.map((item) => item.email)]
  );
  const byName = new Map(authors.map((row) => [row.username, row.id]));
  for (const post of FEED_DEMO_POSTS) {
    const authorId = byName.get(post.author);
    if (!authorId) continue;
    const [existing] = await pool.query(
      `SELECT id FROM ${tableName("feed_posts")} WHERE title = ? LIMIT 1`,
      [post.title]
    );
    if (existing.length) continue;
    const [result] = await pool.query(
      `INSERT INTO ${tableName("feed_posts")}
       (author_id, content_type, title, summary, body, category, tags, like_count, comment_count, favorite_count, view_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? HOUR))`,
      [
        authorId,
        post.content_type,
        post.title,
        post.summary,
        post.body,
        post.category,
        JSON.stringify(post.tags),
        post.like_count,
        post.comment_count,
        post.favorite_count,
        post.view_count,
        3 + Math.floor(Math.random() * 72),
      ]
    );
    await updateFeedPostHeat(pool, result.insertId);
  }
}

async function loadFeedInterestMap(pool, userId) {
  const [rows] = await pool.query(
    `SELECT tag, weight FROM ${tableName("feed_user_interests")} WHERE user_id = ?`,
    [userId]
  );
  return new Map(rows.map((row) => [String(row.tag).toLowerCase(), Number(row.weight || 0)]));
}

function flattenFeedSignalText(value, depth = 0) {
  if (depth > 4 || value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => flattenFeedSignalText(item, depth + 1)).join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value).map((item) => flattenFeedSignalText(item, depth + 1)).join(" ");
  }
  return "";
}

async function loadFeedUserSignals(pool, userId) {
  const interestMap = await loadFeedInterestMap(pool, userId);
  const keys = [
    USER_DATA_KEYS.profile,
    USER_DATA_KEYS.accountProfile,
    USER_DATA_KEYS.resources,
    USER_DATA_KEYS.pathLibrary,
    "LINGXI_LEARNING_BEHAVIOR",
    "LINGXI_MISTAKE_BOOK",
  ];
  const [rows] = await pool.query(
    `SELECT data_key, data_value FROM ${tableName("user_data")} WHERE user_id = ? AND data_key IN (?)`,
    [userId, keys]
  );
  const textParts = [];
  for (const row of rows) {
    const parsed = parseStoredJson(row.data_value, row.data_value);
    textParts.push(flattenFeedSignalText(parsed));
  }
  return {
    interestMap,
    profileText: textParts.join(" ").toLowerCase(),
    recallTags: buildFeedRecallTags(interestMap, textParts.join(" ")),
  };
}

function buildFeedRecallTags(interestMap, text) {
  const seeded = Array.from(interestMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
  const commonTags = [
    "RAG", "AI Coding", "学习路径", "模型评测", "数据分析", "知识库", "错题复盘",
    "项目实践", "代码审查", "视频", "文档模板", "复盘", "经验分享",
  ];
  const lower = String(text || "").toLowerCase();
  const profileTags = commonTags.filter((tag) => lower.includes(tag.toLowerCase()));
  return normalizeFeedTags(seeded.concat(profileTags)).slice(0, 10);
}

async function bumpFeedInterests(pool, userId, tags, delta = 1) {
  for (const tag of normalizeFeedTags(tags)) {
    await pool.query(
      `INSERT INTO ${tableName("feed_user_interests")} (user_id, tag, weight)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE weight = LEAST(20, weight + VALUES(weight)), updated_at = CURRENT_TIMESTAMP`,
      [userId, tag, delta]
    );
  }
}

function scoreFeedProfileMatch(row, tags, profileText) {
  if (!profileText) return 0;
  let score = 0;
  for (const tag of tags) {
    const needle = tag.toLowerCase();
    if (needle && profileText.includes(needle)) score += 1.8;
  }
  const category = String(row.category || "").trim().toLowerCase();
  if (category && profileText.includes(category)) score += 1.2;
  const titleWords = normalizeFeedTags(`${row.title || ""} ${row.summary || ""}`);
  for (const word of titleWords.slice(0, 10)) {
    const needle = word.toLowerCase();
    if (needle.length >= 2 && profileText.includes(needle)) score += 0.35;
  }
  return score;
}

function publicFeedPost(row, signals = {}) {
  const tags = parseFeedTags(row.tags);
  const interestMap = signals.interestMap || new Map();
  const tagScore = tags.reduce((sum, tag) => sum + (interestMap.get(tag.toLowerCase()) || 0), 0);
  const profileScore = scoreFeedProfileMatch(row, tags, signals.profileText || "");
  const followBoost = row.author_followed ? 18 : 0;
  const recommendationScore = Number(row.heat_score || 0) + tagScore * 6 + profileScore * 5 + followBoost;
  return {
    id: String(row.id),
    contentType: row.content_type,
    title: row.title,
    summary: row.summary,
    body: row.body,
    category: row.category || "",
    tags,
    author: {
      id: String(row.author_id),
      name: row.author_name || "社区用户",
      followed: Boolean(row.author_followed),
    },
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    heatScore: Number(row.heat_score || 0),
    recallSource: row.recall_source || "hot",
    recommendationScore,
    recommendationReasons: {
      heat: Number(row.heat_score || 0),
      interest: Number(tagScore.toFixed(2)),
      profile: Number(profileScore.toFixed(2)),
      followedAuthor: Boolean(row.author_followed),
    },
    likes: Number(row.like_count || 0),
    comments: Number(row.comment_count || 0),
    favorites: Number(row.favorite_count || 0),
    views: Number(row.view_count || 0),
    liked: Boolean(row.liked),
    favorited: Boolean(row.favorited),
  };
}

function publicFeedComment(row) {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    body: row.body,
    createdAt: toIso(row.created_at),
    author: {
      id: String(row.author_id),
      name: row.author_name || "社区用户",
    },
  };
}

function rankFeedPosts(posts, sort) {
  if (sort === "latest") {
    return posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  if (sort === "hot") {
    return posts.sort((a, b) => b.heatScore - a.heatScore || new Date(b.createdAt) - new Date(a.createdAt));
  }
  return posts.sort((a, b) => b.recommendationScore - a.recommendationScore || b.heatScore - a.heatScore);
}

async function fetchFeedRows(pool, userId, whereSql, params, orderBy, limit, recallSource) {
  const [rows] = await pool.query(
    `SELECT p.*, u.username AS author_name,
            ? AS recall_source,
            EXISTS(
              SELECT 1 FROM ${tableName("feed_post_interactions")} i
               WHERE i.user_id = ? AND i.post_id = p.id AND i.interaction_type = 'like'
            ) AS liked,
            EXISTS(
              SELECT 1 FROM ${tableName("feed_post_interactions")} i
               WHERE i.user_id = ? AND i.post_id = p.id AND i.interaction_type = 'favorite'
            ) AS favorited,
            EXISTS(
              SELECT 1 FROM ${tableName("feed_author_follows")} f
               WHERE f.follower_id = ? AND f.followee_id = p.author_id
            ) AS author_followed
       FROM ${tableName("feed_posts")} p
       JOIN ${tableName("users")} u ON u.id = p.author_id
      WHERE p.status = 'published' ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ?`,
    [recallSource, userId, userId, userId, ...params, limit]
  );
  return rows;
}

async function recallFeedCandidates(pool, userId, signals, targetCount) {
  const rowsById = new Map();
  const addRows = (rows) => {
    for (const row of rows) {
      if (!rowsById.has(String(row.id))) rowsById.set(String(row.id), row);
    }
  };
  const candidateLimit = Math.max(30, targetCount * 4);

  const recallTags = signals.recallTags || [];
  if (recallTags.length) {
    const parts = [];
    const params = [];
    for (const tag of recallTags.slice(0, 8)) {
      parts.push("(p.tags LIKE ? OR p.category LIKE ? OR p.title LIKE ? OR p.summary LIKE ?)");
      const like = `%${tag}%`;
      params.push(like, like, like, like);
    }
    addRows(await fetchFeedRows(pool, userId, `AND (${parts.join(" OR ")})`, params, "p.heat_score DESC, p.created_at DESC", candidateLimit, "interest"));
  }

  addRows(await fetchFeedRows(
    pool,
    userId,
    `AND EXISTS (SELECT 1 FROM ${tableName("feed_author_follows")} f WHERE f.follower_id = ? AND f.followee_id = p.author_id)`,
    [userId],
    "p.created_at DESC",
    candidateLimit,
    "follow"
  ));
  addRows(await fetchFeedRows(pool, userId, "", [], "p.heat_score DESC, p.created_at DESC", candidateLimit, "hot"));
  addRows(await fetchFeedRows(pool, userId, "", [], "p.created_at DESC", Math.max(20, targetCount * 2), "fresh"));

  return Array.from(rowsById.values());
}

async function queryFeedPosts(pool, userId, sort, page, limit) {
  const offset = (page - 1) * limit;
  const signals = await loadFeedUserSignals(pool, userId);
  if (sort === "recommended") {
    const candidates = await recallFeedCandidates(pool, userId, signals, offset + limit + 8);
    return rankFeedPosts(candidates.map((row) => publicFeedPost(row, signals)), sort).slice(offset, offset + limit);
  }
  const orderBy = sort === "latest" ? "p.created_at DESC" : "p.heat_score DESC, p.created_at DESC";
  const rows = await fetchFeedRows(pool, userId, "", [], orderBy, offset + limit, sort);
  return rankFeedPosts(rows.map((row) => publicFeedPost(row, signals)), sort).slice(offset, offset + limit);
}

async function getFeedList(req, res, url) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const pool = await getMysql();
    await bootstrapFeedDemo(pool);
    const sort = FEED_SORTS.has(url.searchParams.get("sort")) ? url.searchParams.get("sort") : "recommended";
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(30, Math.max(5, Number(url.searchParams.get("limit") || 10)));
    const posts = await queryFeedPosts(pool, user.id, sort, page, limit);
    const [interestRows] = await pool.query(
      `SELECT tag, weight FROM ${tableName("feed_user_interests")} WHERE user_id = ? ORDER BY weight DESC, updated_at DESC LIMIT 12`,
      [user.id]
    );
    sendJson(res, 200, {
      sort,
      page,
      limit,
      hasMore: posts.length === limit,
      interests: interestRows.map((row) => ({ tag: row.tag, weight: Number(row.weight || 0) })),
      posts,
    });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function createFeedPost(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;
  const post = normalizeFeedPostInput(body);
  if (!post.title || post.title.length < 4) {
    sendJson(res, 400, { error: "标题至少需要 4 个字符。" });
    return;
  }
  if (!post.body || post.body.length < 10) {
    sendJson(res, 400, { error: "正文至少需要 10 个字符。" });
    return;
  }
  try {
    const pool = await getMysql();
    const [result] = await pool.query(
      `INSERT INTO ${tableName("feed_posts")}
       (author_id, content_type, title, summary, body, category, tags, heat_score)
       VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?)`,
      [user.id, post.contentType, post.title, post.summary, post.body, post.category, JSON.stringify(post.tags), calculateFeedHeat({})]
    );
    await bumpFeedInterests(pool, user.id, post.tags, 0.6);
    const posts = await queryFeedPosts(pool, user.id, "latest", 1, 1);
    sendJson(res, 201, { post: posts.find((item) => item.id === String(result.insertId)) || null });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function getFeedPost(req, res, postId) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const pool = await getMysql();
    const signals = await loadFeedUserSignals(pool, user.id);
    const rows = await fetchFeedRows(pool, user.id, "AND p.id = ?", [postId], "p.created_at DESC", 1, "detail");
    if (!rows.length) {
      sendJson(res, 404, { error: "文章不存在或已下线。" });
      return;
    }
    await pool.query(
      `UPDATE ${tableName("feed_posts")} SET view_count = view_count + 1 WHERE id = ?`,
      [postId]
    );
    const heat = await updateFeedPostHeat(pool, postId);
    const post = publicFeedPost({ ...rows[0], heat_score: heat, view_count: Number(rows[0].view_count || 0) + 1 }, signals);
    sendJson(res, 200, { post, editable: String(post.author.id) === String(user.id) });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function updateFeedPost(req, res, postId) {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;
  const post = normalizeFeedPostInput(body);
  if (!post.title || post.title.length < 4) {
    sendJson(res, 400, { error: "标题至少需要 4 个字符。" });
    return;
  }
  if (!post.body || post.body.length < 10) {
    sendJson(res, 400, { error: "正文至少需要 10 个字符。" });
    return;
  }
  try {
    const pool = await getMysql();
    const [existing] = await pool.query(
      `SELECT author_id FROM ${tableName("feed_posts")} WHERE id = ? AND status = 'published' LIMIT 1`,
      [postId]
    );
    if (!existing.length) {
      sendJson(res, 404, { error: "文章不存在或已下线。" });
      return;
    }
    if (String(existing[0].author_id) !== String(user.id)) {
      sendJson(res, 403, { error: "只能编辑自己发布的文章。" });
      return;
    }
    await pool.query(
      `UPDATE ${tableName("feed_posts")}
          SET content_type = ?, title = ?, summary = ?, body = ?, category = ?, tags = CAST(? AS JSON), updated_at = NOW()
        WHERE id = ?`,
      [post.contentType, post.title, post.summary, post.body, post.category, JSON.stringify(post.tags), postId]
    );
    await bumpFeedInterests(pool, user.id, post.tags, 0.8);
    await updateFeedPostHeat(pool, postId);
    await getFeedPost(req, res, postId);
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function toggleFeedInteraction(req, res, postId, interactionType) {
  const user = await requireUser(req, res);
  if (!user) return;
  if (!["like", "favorite"].includes(interactionType)) {
    sendJson(res, 400, { error: "不支持的互动类型。" });
    return;
  }
  try {
    const pool = await getMysql();
    const [existing] = await pool.query(
      `SELECT 1 FROM ${tableName("feed_post_interactions")} WHERE user_id = ? AND post_id = ? AND interaction_type = ? LIMIT 1`,
      [user.id, postId, interactionType]
    );
    const active = !existing.length;
    if (active) {
      await pool.query(
        `INSERT IGNORE INTO ${tableName("feed_post_interactions")} (user_id, post_id, interaction_type) VALUES (?, ?, ?)`,
        [user.id, postId, interactionType]
      );
    } else {
      await pool.query(
        `DELETE FROM ${tableName("feed_post_interactions")} WHERE user_id = ? AND post_id = ? AND interaction_type = ?`,
        [user.id, postId, interactionType]
      );
    }
    const countColumn = interactionType === "like" ? "like_count" : "favorite_count";
    await pool.query(
      `UPDATE ${tableName("feed_posts")} p
          SET ${countColumn} = (
            SELECT COUNT(*) FROM ${tableName("feed_post_interactions")} i
             WHERE i.post_id = p.id AND i.interaction_type = ?
          )
        WHERE p.id = ?`,
      [interactionType, postId]
    );
    const [postRows] = await pool.query(`SELECT tags FROM ${tableName("feed_posts")} WHERE id = ? LIMIT 1`, [postId]);
    if (active && postRows.length) await bumpFeedInterests(pool, user.id, parseFeedTags(postRows[0].tags), interactionType === "favorite" ? 2.2 : 1.3);
    const heat = await updateFeedPostHeat(pool, postId);
    sendJson(res, 200, { active, heatScore: heat });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function createFeedComment(req, res, postId) {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;
  const text = String(body.body || body.comment || "").trim().slice(0, 1000);
  if (text.length < 2) {
    sendJson(res, 400, { error: "评论至少需要 2 个字符。" });
    return;
  }
  try {
    const pool = await getMysql();
    const [result] = await pool.query(
      `INSERT INTO ${tableName("feed_comments")} (post_id, author_id, body) VALUES (?, ?, ?)`,
      [postId, user.id, text]
    );
    await pool.query(
      `UPDATE ${tableName("feed_posts")} p
          SET comment_count = (SELECT COUNT(*) FROM ${tableName("feed_comments")} c WHERE c.post_id = p.id)
        WHERE p.id = ?`,
      [postId]
    );
    const [postRows] = await pool.query(
      `SELECT id, author_id, title, tags FROM ${tableName("feed_posts")} WHERE id = ? LIMIT 1`,
      [postId]
    );
    if (postRows.length) {
      await bumpFeedInterests(pool, user.id, parseFeedTags(postRows[0].tags), 1.6);
      if (String(postRows[0].author_id) !== String(user.id)) {
        await pool.query(
          `INSERT INTO ${tableName("feed_notifications")}
           (user_id, actor_id, post_id, comment_id, notification_type, message)
           VALUES (?, ?, ?, ?, 'comment', ?)`,
          [
            postRows[0].author_id,
            user.id,
            postId,
            result.insertId,
            `${user.username || "有人"} 评论了你的动态《${String(postRows[0].title || "").slice(0, 60)}》`,
          ]
        );
      }
    }
    const heat = await updateFeedPostHeat(pool, postId);
    const [comments] = await pool.query(
      `SELECT c.*, u.username AS author_name
         FROM ${tableName("feed_comments")} c
         JOIN ${tableName("users")} u ON u.id = c.author_id
        WHERE c.id = ? LIMIT 1`,
      [result.insertId]
    );
    sendJson(res, 201, { ok: true, heatScore: heat, comment: publicFeedComment(comments[0]) });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function getFeedComments(req, res, postId) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const pool = await getMysql();
    const [rows] = await pool.query(
      `SELECT c.*, u.username AS author_name
         FROM ${tableName("feed_comments")} c
         JOIN ${tableName("users")} u ON u.id = c.author_id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
        LIMIT 80`,
      [postId]
    );
    sendJson(res, 200, { comments: rows.map(publicFeedComment) });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function toggleFeedFollow(req, res, authorId) {
  const user = await requireUser(req, res);
  if (!user) return;
  if (String(user.id) === String(authorId)) {
    sendJson(res, 400, { error: "不能关注自己。" });
    return;
  }
  try {
    const pool = await getMysql();
    const [existing] = await pool.query(
      `SELECT 1 FROM ${tableName("feed_author_follows")} WHERE follower_id = ? AND followee_id = ? LIMIT 1`,
      [user.id, authorId]
    );
    const active = !existing.length;
    if (active) {
      await pool.query(`INSERT IGNORE INTO ${tableName("feed_author_follows")} (follower_id, followee_id) VALUES (?, ?)`, [user.id, authorId]);
      const [tagRows] = await pool.query(
        `SELECT tags FROM ${tableName("feed_posts")} WHERE author_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 5`,
        [authorId]
      );
      for (const row of tagRows) await bumpFeedInterests(pool, user.id, parseFeedTags(row.tags), 0.8);
    } else {
      await pool.query(`DELETE FROM ${tableName("feed_author_follows")} WHERE follower_id = ? AND followee_id = ?`, [user.id, authorId]);
    }
    sendJson(res, 200, { active });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function getFeedAuthor(req, res, authorId) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const pool = await getMysql();
    const [authorRows] = await pool.query(
      `SELECT u.id, u.username, u.created_at,
              EXISTS(
                SELECT 1 FROM ${tableName("feed_author_follows")} f
                 WHERE f.follower_id = ? AND f.followee_id = u.id
              ) AS followed,
              (SELECT COUNT(*) FROM ${tableName("feed_author_follows")} f WHERE f.followee_id = u.id) AS follower_count,
              (SELECT COUNT(*) FROM ${tableName("feed_posts")} p WHERE p.author_id = u.id AND p.status = 'published') AS post_count
         FROM ${tableName("users")} u
        WHERE u.id = ? LIMIT 1`,
      [user.id, authorId]
    );
    if (!authorRows.length) {
      sendJson(res, 404, { error: "作者不存在。" });
      return;
    }
    const posts = await fetchFeedRows(
      pool,
      user.id,
      "AND p.author_id = ?",
      [authorId],
      "p.created_at DESC",
      12,
      "author"
    );
    const signals = await loadFeedUserSignals(pool, user.id);
    const author = authorRows[0];
    sendJson(res, 200, {
      author: {
        id: String(author.id),
        name: author.username,
        createdAt: toIso(author.created_at),
        followed: Boolean(author.followed),
        followers: Number(author.follower_count || 0),
        posts: Number(author.post_count || 0),
      },
      posts: posts.map((row) => publicFeedPost(row, signals)),
    });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function getFeedNotifications(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const pool = await getMysql();
    const [rows] = await pool.query(
      `SELECT n.*, a.username AS actor_name, p.title AS post_title
         FROM ${tableName("feed_notifications")} n
         LEFT JOIN ${tableName("users")} a ON a.id = n.actor_id
         LEFT JOIN ${tableName("feed_posts")} p ON p.id = n.post_id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT 20`,
      [user.id]
    );
    const unread = rows.filter((row) => !row.read_at).length;
    sendJson(res, 200, {
      unread,
      notifications: rows.map((row) => ({
        id: String(row.id),
        type: row.notification_type,
        message: row.message,
        read: Boolean(row.read_at),
        createdAt: toIso(row.created_at),
        postId: row.post_id ? String(row.post_id) : "",
        commentId: row.comment_id ? String(row.comment_id) : "",
        actor: row.actor_id ? { id: String(row.actor_id), name: row.actor_name || "社区用户" } : null,
        postTitle: row.post_title || "",
      })),
    });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function markFeedNotificationsRead(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const pool = await getMysql();
    await pool.query(
      `UPDATE ${tableName("feed_notifications")} SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL`,
      [user.id]
    );
    sendJson(res, 200, { ok: true });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function updateFeedInterests(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = await readJsonBody(req, BODY_LIMIT).catch((e) => {
    sendJson(res, 400, { error: `Bad request body: ${String(e?.message || e)}` });
    return null;
  });
  if (!body) return;
  const tags = normalizeFeedTags(body.tags);
  try {
    const pool = await getMysql();
    await pool.query(`DELETE FROM ${tableName("feed_user_interests")} WHERE user_id = ?`, [user.id]);
    await bumpFeedInterests(pool, user.id, tags, 5);
    sendJson(res, 200, { interests: tags.map((tag) => ({ tag, weight: 5 })) });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}
