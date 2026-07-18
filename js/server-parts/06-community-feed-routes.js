const FEED_TYPES = new Set(["question", "answer", "thought", "article", "document", "video", "quiz"]);
const FEED_SORTS = new Set(["recommended", "latest", "hot", "follow"]);
const FEED_VIDEO_DIR = path.join(ROOT_DIR, "uploads", "feed-videos");
const FEED_VIDEO_LIMIT = 200 * 1024 * 1024;
const FEED_VIDEO_TYPES = new Map([
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["video/quicktime", ".mov"],
]);

async function uploadFeedVideo(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  const extension = FEED_VIDEO_TYPES.get(contentType);
  const length = Number(req.headers["content-length"] || 0);
  if (!extension) {
    sendJson(res, 415, { error: "仅支持 MP4、WebM 或 MOV 视频。" });
    return;
  }
  if (length > FEED_VIDEO_LIMIT) {
    sendJson(res, 413, { error: "视频不能超过 200 MB。" });
    return;
  }
  await fs.promises.mkdir(FEED_VIDEO_DIR, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
  const filePath = path.join(FEED_VIDEO_DIR, filename);
  let received = 0;
  const limiter = new (require("stream").Transform)({
    transform(chunk, encoding, callback) {
      received += chunk.length;
      if (received > FEED_VIDEO_LIMIT) callback(new Error("VIDEO_TOO_LARGE"));
      else callback(null, chunk);
    },
  });
  try {
    await pipeline(req, limiter, fs.createWriteStream(filePath, { flags: "wx" }));
    if (!received) throw new Error("EMPTY_VIDEO");
    sendJson(res, 201, { url: `/uploads/feed-videos/${filename}`, size: received, type: contentType });
  } catch (error) {
    await fs.promises.unlink(filePath).catch(() => {});
    sendJson(res, error.message === "VIDEO_TOO_LARGE" ? 413 : 400, {
      error: error.message === "VIDEO_TOO_LARGE" ? "视频不能超过 200 MB。" : "视频上传失败，请重试。",
    });
  }
}
const FEED_DEMO_AUTHORS = [
  { username: "Lin Chen", email: "lin.chen.feed@example.local" },
  { username: "Kai Ming", email: "kai.ming.feed@example.local" },
  { username: "Nora Xu", email: "nora.xu.feed@example.local" },
  { username: "Zoe Wang", email: "zoe.wang.feed@example.local" },
  { username: "Ethan Li", email: "ethan.li.feed@example.local" },
];
const FEED_DEMO_PASSWORD = process.env.FEED_DEMO_PASSWORD || "Computer@2026";
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
  {
    author: "Kai Ming",
    content_type: "quiz",
    title: "上下文有关文法基础题库",
    summary: "一组用于检查 1 型文法、非收缩性质和常见误区的练习题。",
    body: JSON.stringify({
      questions: [
        {
          type: "基础题",
          difficulty: "基础",
          knowledge: "1 型文法定义",
          source: "课程常见题型改编",
          question: "说明 1 型文法产生式的一般形式，并解释其中上下文的含义。",
          answer: "一般形式可写为 αAβ -> αγβ，其中 γ 非空。",
          explanation: "关键是非终结符 A 的改写依赖左右两侧上下文 α 和 β。答题时要说明上下文是符号串环境，不是日常语言中的语境。",
        },
        {
          type: "易错题",
          difficulty: "中等",
          knowledge: "非收缩性质",
          source: "课堂易错题改编",
          question: "判断产生式 AB -> a 是否满足 1 型文法的非收缩要求，并说明理由。",
          answer: "不满足。",
          explanation: "左部长度为 2，右部长度为 1，发生了收缩。1 型文法通常要求产生式右部长度不小于左部长度。",
        },
      ],
    }),
    category: "编译原理",
    tags: ["题库", "编译原理", "练习"],
    like_count: 12,
    comment_count: 3,
    favorite_count: 9,
    view_count: 168,
  },
  ...[
    ["Zoe Wang", "article", "从一次慢查询定位到合适索引的完整过程", "用 EXPLAIN、基数和回表次数逐步定位问题，并验证组合索引是否真正生效。", "先记录稳定复现的 SQL 与数据规模，再查看执行计划中的 type、rows 和 Extra。对 WHERE 与 ORDER BY 同时出现的场景，组合索引字段顺序应由等值条件、范围条件和排序需求共同决定。最后用冷缓存与热缓存分别压测，避免只凭一次执行时间下结论。", "数据库", ["MySQL", "索引", "性能优化"]],
    ["Ethan Li", "question", "为什么 Redis 缓存穿透不能只靠延长过期时间解决？", "不存在的键不会进入缓存，延长已有键的 TTL 并不能挡住持续打向数据库的无效请求。", "在商品详情接口中，攻击者随机请求不存在的商品 ID，导致每次都落到数据库。除了缓存空值，布隆过滤器、参数校验和限流分别适合在哪一层使用？如何处理布隆过滤器的误判？", "后端开发", ["Redis", "缓存穿透", "系统设计"]],
    ["Lin Chen", "answer", "答：布隆过滤器负责快速拒绝，空值缓存兜住短期漏网请求", "布隆过滤器适合放在缓存查询之前，空值缓存则能处理新增数据同步延迟和误判后的数据库查询。", "完整链路可以是：先做 ID 格式校验与限流，再查布隆过滤器；判定可能存在时查 Redis，未命中才访问数据库，并对不存在结果写入较短 TTL 的空值。数据新增时同步更新过滤器，删除时依赖版本重建或使用可删除结构。", "后端开发", ["Redis", "布隆过滤器", "高并发"]],
    ["Kai Ming", "document", "Git 团队协作规范速查表", "覆盖分支命名、提交粒度、变基边界、合并请求检查项和冲突处理原则。", "建议功能分支保持短生命周期；提交信息说明动机而非复述文件名；共享分支不要强制变基；合并前先同步目标分支并跑测试。处理冲突时逐块理解双方意图，解决后重新执行格式检查与测试，再提交合并结果。", "软件工程", ["Git", "团队协作", "代码审查"]],
    ["Nora Xu", "video", "Docker 入门：从镜像构建到容器运行", "通过实际操作理解 Dockerfile、镜像层、端口映射与容器生命周期。", "[[video:/uploads/feed-videos/docker-basics.mp4]]\n\n本视频演示如何编写基础 Dockerfile、构建镜像、启动容器并查看日志。建议边看边执行 docker build、docker run、docker ps 和 docker logs。", "云原生", ["Docker", "容器", "视频教程"]],
    ["Zoe Wang", "video", "Git 合并分支与解决冲突实战", "演示合并功能分支、识别冲突标记、保留正确改动并验证最终结果。", "[[video:/uploads/feed-videos/git-merge-conflicts.mp4]]\n\n本视频从 git merge 开始，逐步解释 HEAD 与传入分支的冲突标记，展示手工合并、git add、提交合并结果以及最后运行测试的完整流程。", "软件工程", ["Git", "合并冲突", "视频教程"]],
    ["Ethan Li", "thought", "写单元测试时，边界值往往比平均值更有信息量", "空集合、单元素、最大长度和非法输入更容易暴露实现假设。", "测试正常路径只能说明代码在熟悉输入下可运行。把输入域按等价类划分，再选择边界两侧的值，常常能用更少用例发现越界、溢出、空指针和状态遗漏。", "工程实践", ["单元测试", "边界条件", "测试设计"]],
    ["Lin Chen", "article", "HTTP 缓存协商：ETag 与 Last-Modified 怎么选", "强校验与时间校验各有适用场景，关键是资源变化语义和生成成本。", "Last-Modified 简单且便宜，但精度通常到秒，也无法识别内容回滚到相同时间的情况。ETag 可以基于内容哈希或版本号生成，更准确但需要计算成本。浏览器携带 If-None-Match 或 If-Modified-Since，服务端未变化时返回 304。", "计算机网络", ["HTTP", "缓存", "Web"]],
    ["Kai Ming", "question", "微服务一定比单体应用更适合高并发吗？", "拆分服务会带来独立扩缩容能力，也会引入网络、事务和观测复杂度。", "如果业务仍处于快速验证阶段，单体通过无状态部署、缓存和数据库优化也能支撑较高流量。判断是否拆分时，你们更看重团队规模、领域边界、故障隔离还是具体性能瓶颈？", "系统设计", ["微服务", "架构", "高并发"]],
    ["Nora Xu", "answer", "答：先用模块化单体建立边界，再让真实瓶颈决定拆分", "并发能力取决于可扩展设计和瓶颈位置，服务数量本身不是性能指标。", "可以先在单体内按领域隔离代码和数据访问，通过压测确认 CPU、数据库锁、热点缓存或外部依赖瓶颈。当某个模块确实需要独立发布、扩容或故障隔离时再拆出服务，同时补齐调用链、超时、重试、幂等和分布式事务治理。", "系统设计", ["微服务", "模块化", "性能测试"]],
    ["Zoe Wang", "article", "从进程到协程：并发模型的选择思路", "不同并发单元在隔离性、调度成本和编程复杂度之间做权衡。", "进程隔离强，适合故障边界明确或 CPU 密集任务；线程共享地址空间，通信方便但要处理同步；协程由运行时调度，适合大量 I/O 等待。选择时要先区分 CPU 密集与 I/O 密集，再看语言运行时和部署环境。", "操作系统", ["进程", "线程", "协程"]],
    ["Ethan Li", "document", "REST API 设计检查清单", "从资源命名、状态码、幂等性、分页、错误结构到版本兼容逐项检查。", "资源路径优先使用名词复数；GET 不产生副作用；PUT 与 DELETE 应具备幂等语义；创建成功返回 201 和资源位置；列表接口明确分页上限；错误响应包含稳定错误码与可读信息；破坏性变更通过新版本或兼容窗口发布。", "后端开发", ["REST", "API设计", "后端"]],
    ["Lin Chen", "thought", "代码注释最该解释的是被否决的简单方案", "复杂实现通常有历史原因，若不记录约束，后来的人很可能把 bug 优化回来。", "注释不必逐行翻译代码，而应说明看似多余的分支为何存在、依赖了什么外部约束、有哪些方案曾尝试但失败。配合测试用例，能让维护者放心修改。", "工程实践", ["代码质量", "注释", "可维护性"]],
    ["Kai Ming", "article", "B 树与 B+ 树为什么适合磁盘索引", "高分支因子降低树高，连续叶子链表又支持高效范围扫描。", "磁盘和页式存储的访问成本远高于内存比较。B+ 树内部节点只保存键和子指针，同一页能容纳更多分支；数据集中在叶子节点并按序相连，因此点查与范围查询都能保持较少 I/O。", "数据结构", ["B+树", "数据库", "数据结构"]],
    ["Nora Xu", "question", "JWT 过期前如何安全地撤销用户会话？", "纯无状态令牌难以即时失效，黑名单与短令牌加刷新令牌各有代价。", "用户修改密码、账号被禁用或设备丢失时，需要立即撤销访问权限。你们会选择 Redis 黑名单、用户令牌版本号，还是短期 access token 配合可撤销 refresh token？", "Web安全", ["JWT", "会话安全", "认证"]],
    ["Zoe Wang", "answer", "答：短期访问令牌配合服务端可撤销的刷新令牌更易治理", "让 access token 生命周期足够短，把设备、撤销和轮换状态放到 refresh token 记录中。", "刷新令牌建议只保存哈希，并绑定设备信息与过期时间；每次刷新执行轮换，旧令牌立即作废。高风险操作仍应实时查询用户状态或令牌版本号，这样能在无状态性能与即时撤销之间取得平衡。", "Web安全", ["JWT", "Refresh Token", "安全"]],
    ["Ethan Li", "article", "消息队列里的重复消费该如何正确处理", "可靠投递往往意味着至少一次，消费者必须以业务幂等保证最终结果。", "可以用业务唯一键、去重表或状态机约束重复写入。消费流程要考虑数据库提交成功但 ACK 失败的窗口；若同时更新数据库和发送新消息，可采用本地消息表或事务性 Outbox，再由后台任务可靠转发。", "分布式系统", ["消息队列", "幂等", "Outbox"]],
    ["Lin Chen", "document", "Linux 服务故障排查的五层路径", "从系统资源、进程状态、端口连接、应用日志到依赖服务逐层缩小范围。", "先用 uptime、free、df 确认机器是否健康；再检查进程和打开文件；随后查看端口监听、连接数量与 DNS；对照请求时间查应用日志；最后验证数据库、缓存和第三方接口。每一步都记录时间点，便于关联指标。", "运维", ["Linux", "故障排查", "可观测性"]],
    ["Kai Ming", "thought", "算法题复盘不要只抄最优解", "先写出自己在哪个决策点走偏，才能把答案转化为下次可调用的策略。", "我会记录暴力解的复杂度、导致超时的数据规模、最优解使用的关键性质，以及一个能区分两种思路的反例。隔几天只看题目重新实现，比阅读答案更能检验是否真正掌握。", "学习方法", ["算法", "错题复盘", "学习方法"]],
    ["Nora Xu", "article", "二分查找最容易忽略的循环不变量", "区间定义决定更新方式，闭区间与半开区间不能混用。", "若搜索区间定义为 [left, right]，循环条件使用 left <= right，排除 mid 后更新为 mid-1 或 mid+1；若定义为 [left, right)，循环使用 left < right。写代码前先写下目标值始终位于哪个区间，边界就不容易错。", "算法", ["二分查找", "循环不变量", "算法"]],
    ["Zoe Wang", "question", "Kubernetes Pod 一直 CrashLoopBackOff 应先看什么？", "重启退避只是现象，根因可能是启动命令、配置、探针、权限或依赖不可用。", "面对一个持续重启的 Pod，你会如何安排 kubectl get、describe、logs --previous 和临时调试容器的顺序？如果容器启动太快就退出，怎样保留现场？", "云原生", ["Kubernetes", "Pod", "故障排查"]],
    ["Ethan Li", "answer", "答：先看退出原因和上一次容器日志，再核对事件与探针", "describe 能给出退出码和事件，logs --previous 通常能保留崩溃前的关键输出。", "先 kubectl describe pod 查看 Last State、Exit Code 与 Events，再读取 --previous 日志。退出码 137 常见于 OOM 或强制终止；配置缺失则检查 ConfigMap、Secret 与挂载；若进程实际正常但探针失败，应核对端口、路径和初始延迟。", "云原生", ["Kubernetes", "日志", "排障"]],
    ["Lin Chen", "document", "机器学习实验可复现性清单", "固定随机性、保存数据版本、环境依赖、训练配置与评估脚本。", "记录数据集版本和划分哈希；为 Python、NumPy 与训练框架设置随机种子；锁定依赖与硬件信息；保存完整超参数、代码提交号和模型权重；评估时使用独立脚本并报告多次运行均值与方差。", "机器学习", ["机器学习", "可复现", "实验"]],
    ["Kai Ming", "article", "Transformer 自注意力的复杂度从哪里来", "序列长度的平方项来自每个 token 与所有 token 计算相关性。", "设序列长度为 n、特征维度为 d，QK 转置乘法和注意力权重乘 V 都包含 n×n 的中间矩阵，时间与显存随 n² 增长。长序列方案通常通过稀疏注意力、分块、低秩近似或线性化来降低开销。", "人工智能", ["Transformer", "注意力", "深度学习"]],
    ["Nora Xu", "thought", "前端性能优化先量化交互，再决定拆包还是缓存", "没有指标的优化容易把构建体积变小，却没有改善用户真正感受到的等待。", "先用真实设备测 LCP、INP 与 CLS，并在性能面板定位主线程长任务。首屏慢可能需要图片和关键资源优化，交互慢可能要减少同步计算或组件重渲染；代码分割只是工具之一。", "前端开发", ["Web性能", "Core Web Vitals", "前端"]],
    ["Zoe Wang", "article", "数据库事务隔离级别与常见并发现象", "理解脏读、不可重复读和幻读后，再结合数据库实现选择隔离级别。", "Read Committed 能避免脏读，但同一事务两次读取可能看到不同已提交值；Repeatable Read 通常通过 MVCC 保持快照一致。范围更新仍需关注间隙锁和死锁，隔离级别越高不等于业务就自动正确。", "数据库", ["事务", "MVCC", "MySQL"]],
    ["Ethan Li", "document", "代码评审提交前自检模板", "帮助作者在请求评审前确认范围、测试、兼容性、安全和回滚方案。", "说明变更目标和非目标；将大改动拆成可理解提交；附测试证据与关键截图；标出数据库迁移、配置和权限变化；检查日志是否泄露敏感信息；准备发布监控指标与回滚步骤。", "软件工程", ["代码评审", "工程规范", "质量保障"]],
    ["Lin Chen", "article", "一致性哈希如何减少节点扩缩容时的数据迁移", "把节点和键映射到同一哈希环，节点变化只影响相邻区间。", "普通取模在节点数变化后会让大多数键重新映射。一致性哈希让键沿环顺时针找到第一个节点，新增或删除节点主要迁移局部数据。虚拟节点能改善分布不均，并让不同容量节点配置不同权重。", "分布式系统", ["一致性哈希", "负载均衡", "分布式"]],
    ["Kai Ming", "question", "什么时候应该用 WebSocket，而不是轮询或 SSE？", "选择取决于通信方向、实时性、连接规模和基础设施支持。", "通知流通常只需要服务端推送，SSE 更简单；在线协作、游戏或双向控制需要 WebSocket。大家在代理超时、断线重连、消息顺序和水平扩展方面有哪些实践建议？", "计算机网络", ["WebSocket", "SSE", "实时通信"]],
    ["Nora Xu", "answer", "答：单向事件优先 SSE，真正高频双向交互再用 WebSocket", "SSE 基于 HTTP，自动重连和文本事件模型对通知、进度流很友好。", "WebSocket 适合客户端与服务端都频繁发消息的场景，但要自己处理心跳、重连、背压和跨节点广播。无论选择哪种，都应为消息增加递增 ID，让客户端重连后能够补齐或去重。", "计算机网络", ["WebSocket", "SSE", "架构选择"]],
  ].map(([author, content_type, title, summary, body, category, tags], index) => ({
    author, content_type, title, summary, body, category, tags,
    like_count: 8 + (index * 7) % 31,
    comment_count: 2 + (index * 3) % 8,
    favorite_count: 5 + (index * 5) % 19,
    view_count: 96 + index * 23,
  })),
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

function looksLikeFeedQuizBody(value = "") {
  const text = String(value || "");
  return /(?:^|\n)\s*(?:##\s*)?题目\s*\d*[:：]/.test(text)
    && /(?:^|\n)\s*答案[:：]/.test(text)
    && /(?:^|\n)\s*解析[:：]/.test(text);
}

function normalizeFeedPostInput(body) {
  const title = String(body.title || "").trim().replace(/\s+/g, " ").slice(0, 180);
  const text = String(body.body || body.content || "").trim().slice(0, 20000);
  const summary = String(body.summary || text.replace(/\s+/g, " ").slice(0, 180)).trim().slice(0, 320);
  const requestedType = String(body.contentType || body.content_type);
  const contentType = looksLikeFeedQuizBody(text) ? "quiz" : FEED_TYPES.has(requestedType) ? requestedType : "thought";
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

async function ensureFeedDemoComments(pool, postId, post, authors = []) {
  const target = Math.min(12, Math.max(0, Number(post.comment_count || 0)));
  if (!target) return;
  const [existing] = await pool.query(
    `SELECT COUNT(*) AS count FROM ${tableName("feed_comments")} WHERE post_id = ?`,
    [postId]
  );
  const current = Number(existing?.[0]?.count || 0);
  if (current >= target) return;
  const authorIds = authors.map((row) => row.id).filter(Boolean);
  if (!authorIds.length) return;
  const samples = [
    "这个点很有共鸣，尤其是记录失败原因这一步。",
    "我也遇到过类似问题，后面发现复盘比保存结果更重要。",
    "这个方法可以直接放到学习路径里当检查项。",
    "如果能补一个具体例子就更好理解了。",
    "赞同，约束条件记录下来之后，下次和 AI 协作会稳定很多。",
    "我会把这条收藏起来，后面做项目日志时参考。",
    "这里提到的边界条件很关键，很多问题就是漏在这里。",
    "感觉适合做成模板，每次迭代后填一次。",
    "这个思路对课程作业和项目实践都挺实用。",
    "我之前只记最终答案，确实很难复用。",
    "评论区有没有人试过把它接到错题本里？",
    "这个结论很清楚，建议再补一个反例。",
  ];
  for (let i = current; i < target; i += 1) {
    await pool.query(
      `INSERT INTO ${tableName("feed_comments")} (post_id, author_id, body, created_at)
       VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL ? MINUTE))`,
      [postId, authorIds[i % authorIds.length], samples[i % samples.length], (target - i) * 13]
    );
  }
  await pool.query(
    `UPDATE ${tableName("feed_posts")} p
        SET comment_count = (SELECT COUNT(*) FROM ${tableName("feed_comments")} c WHERE c.post_id = p.id)
      WHERE p.id = ?`,
    [postId]
  );
}

async function bootstrapFeedDemo(pool) {
  const passwordData = hashPassword(FEED_DEMO_PASSWORD);
  for (const author of FEED_DEMO_AUTHORS) {
    await pool.query(
      `INSERT INTO ${tableName("users")} (username, email, password_salt, password_hash)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE username = VALUES(username), password_salt = VALUES(password_salt), password_hash = VALUES(password_hash), status = 'active'`,
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
    let postId = existing[0]?.id;
    if (!postId) {
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
      postId = result.insertId;
    } else {
      await pool.query(
        `UPDATE ${tableName("feed_posts")}
            SET author_id = ?, content_type = ?, summary = ?, body = ?, category = ?, tags = CAST(? AS JSON), status = 'published'
          WHERE id = ?`,
        [authorId, post.content_type, post.summary, post.body, post.category, JSON.stringify(post.tags), postId]
      );
    }
    await ensureFeedDemoComments(pool, postId, post, authors);
    await updateFeedPostHeat(pool, postId);
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

function publicAccountProfileForAuthor(value) {
  const profile = parseStoredJson(value, {});
  const avatarImage = /^data:image\/(png|jpe?g|webp);base64,/i.test(String(profile.avatarImage || ""))
    ? String(profile.avatarImage)
    : "";
  const photoWall = Array.isArray(profile.photoWall)
    ? profile.photoWall.filter((item) => /^data:image\/(png|jpe?g|webp);base64,/i.test(String(item || ""))).slice(0, 4)
    : [];
  return {
    avatarInitial: String(profile.avatarInitial || "").trim().slice(0, 2).toUpperCase(),
    avatarImage,
    bio: String(profile.bio || "个人学习空间").trim().slice(0, 120),
    accent: profile.accent || "teal",
    photoWall,
  };
}

function publicFavoriteCollections(value) {
  const raw = parseStoredJson(value, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((folder) => folder?.visibility === "public")
    .map((folder) => ({
      id: String(folder?.id || "").slice(0, 80),
      name: String(folder?.name || "公开收藏夹").trim().slice(0, 32) || "公开收藏夹",
      description: String(folder?.description || "").trim().slice(0, 120),
      visibility: "public",
      postIds: Array.from(new Set(Array.isArray(folder?.postIds) ? folder.postIds.map((id) => String(id)) : [])).slice(0, 40),
      updatedAt: toIso(folder?.updatedAt || folder?.createdAt || new Date().toISOString()),
    }))
    .filter((folder) => folder.id);
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
  if (sort === "follow") {
    return posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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

async function recallFeedCandidates(pool, userId, signals, targetCount, contentType = "all") {
  const rowsById = new Map();
  const addRows = (rows) => {
    for (const row of rows) {
      if (!rowsById.has(String(row.id))) rowsById.set(String(row.id), row);
    }
  };
  const candidateLimit = Math.max(30, targetCount * 4);
  const typeSql = FEED_TYPES.has(contentType) ? "AND p.content_type = ?" : "";
  const typeParams = FEED_TYPES.has(contentType) ? [contentType] : [];

  const recallTags = signals.recallTags || [];
  if (recallTags.length) {
    const parts = [];
    const params = [];
    for (const tag of recallTags.slice(0, 8)) {
      parts.push("(p.tags LIKE ? OR p.category LIKE ? OR p.title LIKE ? OR p.summary LIKE ?)");
      const like = `%${tag}%`;
      params.push(like, like, like, like);
    }
    addRows(await fetchFeedRows(pool, userId, `${typeSql} AND (${parts.join(" OR ")})`, [...typeParams, ...params], "p.heat_score DESC, p.created_at DESC", candidateLimit, "interest"));
  }

  addRows(await fetchFeedRows(
    pool,
    userId,
    `${typeSql} AND EXISTS (SELECT 1 FROM ${tableName("feed_author_follows")} f WHERE f.follower_id = ? AND f.followee_id = p.author_id)`,
    [...typeParams, userId],
    "p.created_at DESC",
    candidateLimit,
    "follow"
  ));
  addRows(await fetchFeedRows(pool, userId, typeSql, typeParams, "p.heat_score DESC, p.created_at DESC", candidateLimit, "hot"));
  addRows(await fetchFeedRows(pool, userId, typeSql, typeParams, "p.created_at DESC", Math.max(20, targetCount * 2), "fresh"));

  return Array.from(rowsById.values());
}

async function queryFeedPosts(pool, userId, sort, page, limit, contentType = "all") {
  const offset = (page - 1) * limit;
  const signals = await loadFeedUserSignals(pool, userId);
  const typeSql = FEED_TYPES.has(contentType) ? "AND p.content_type = ?" : "";
  const typeParams = FEED_TYPES.has(contentType) ? [contentType] : [];
  if (sort === "recommended") {
    const candidates = await recallFeedCandidates(pool, userId, signals, offset + limit + 8, contentType);
    return rankFeedPosts(candidates.map((row) => publicFeedPost(row, signals)), sort).slice(offset, offset + limit);
  }
  if (sort === "follow") {
    const rows = await fetchFeedRows(
      pool,
      userId,
      `${typeSql} AND EXISTS (SELECT 1 FROM ${tableName("feed_author_follows")} f WHERE f.follower_id = ? AND f.followee_id = p.author_id)`,
      [...typeParams, userId],
      "p.created_at DESC",
      offset + limit,
      "follow"
    );
    return rankFeedPosts(rows.map((row) => publicFeedPost(row, signals)), sort).slice(offset, offset + limit);
  }
  const orderBy = sort === "latest" ? "p.created_at DESC" : "p.heat_score DESC, p.created_at DESC";
  const rows = await fetchFeedRows(pool, userId, typeSql, typeParams, orderBy, offset + limit, sort);
  return rankFeedPosts(rows.map((row) => publicFeedPost(row, signals)), sort).slice(offset, offset + limit);
}

async function getFeedList(req, res, url) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const pool = await getMysql();
    await bootstrapFeedDemo(pool);
    const sort = FEED_SORTS.has(url.searchParams.get("sort")) ? url.searchParams.get("sort") : "recommended";
    const contentType = FEED_TYPES.has(url.searchParams.get("type")) ? url.searchParams.get("type") : "all";
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(30, Math.max(5, Number(url.searchParams.get("limit") || 10)));
    const posts = await queryFeedPosts(pool, user.id, sort, page, limit, contentType);
    const [interestRows] = await pool.query(
      `SELECT tag, weight FROM ${tableName("feed_user_interests")} WHERE user_id = ? ORDER BY weight DESC, updated_at DESC LIMIT 12`,
      [user.id]
    );
    sendJson(res, 200, {
      sort,
      type: contentType,
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

async function getFeedFavorites(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const pool = await getMysql();
    await bootstrapFeedDemo(pool);
    const signals = await loadFeedUserSignals(pool, user.id);
    const rows = await fetchFeedRows(
      pool,
      user.id,
      `AND EXISTS (
        SELECT 1 FROM ${tableName("feed_post_interactions")} fav
         WHERE fav.user_id = ? AND fav.post_id = p.id AND fav.interaction_type = 'favorite'
      )`,
      [user.id],
      "p.updated_at DESC",
      80,
      "favorite"
    );
    sendJson(res, 200, { posts: rows.map((row) => publicFeedPost(row, signals)) });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
}

async function getFeedSocial(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const pool = await getMysql();
    const [followingRows] = await pool.query(
      `SELECT u.id, u.username, u.created_at,
              (SELECT COUNT(*) FROM ${tableName("feed_author_follows")} f2 WHERE f2.followee_id = u.id) AS follower_count,
              (SELECT COUNT(*) FROM ${tableName("feed_posts")} p WHERE p.author_id = u.id AND p.status = 'published') AS post_count
         FROM ${tableName("feed_author_follows")} f
         JOIN ${tableName("users")} u ON u.id = f.followee_id
        WHERE f.follower_id = ?
        ORDER BY f.created_at DESC
        LIMIT 80`,
      [user.id]
    );
    const [followerRows] = await pool.query(
      `SELECT u.id, u.username, u.created_at,
              EXISTS(
                SELECT 1 FROM ${tableName("feed_author_follows")} back
                 WHERE back.follower_id = ? AND back.followee_id = u.id
              ) AS followed,
              (SELECT COUNT(*) FROM ${tableName("feed_author_follows")} f2 WHERE f2.followee_id = u.id) AS follower_count,
              (SELECT COUNT(*) FROM ${tableName("feed_posts")} p WHERE p.author_id = u.id AND p.status = 'published') AS post_count
         FROM ${tableName("feed_author_follows")} f
         JOIN ${tableName("users")} u ON u.id = f.follower_id
        WHERE f.followee_id = ?
        ORDER BY f.created_at DESC
        LIMIT 80`,
      [user.id, user.id]
    );
    const publicSocialUser = (row, followed = true) => ({
      id: String(row.id),
      name: row.username || "社区用户",
      createdAt: toIso(row.created_at),
      followed: Boolean(followed),
      followers: Number(row.follower_count || 0),
      posts: Number(row.post_count || 0),
    });
    sendJson(res, 200, {
      following: followingRows.map((row) => publicSocialUser(row, true)),
      followers: followerRows.map((row) => publicSocialUser(row, row.followed)),
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
    await bootstrapFeedDemo(pool);
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

async function deleteFeedPost(req, res, postId) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const pool = await getMysql();
    const [existing] = await pool.query(
      `SELECT author_id FROM ${tableName("feed_posts")} WHERE id = ? AND status = 'published' LIMIT 1`,
      [postId]
    );
    if (!existing.length) {
      sendJson(res, 404, { error: "内容不存在或已删除。" });
      return;
    }
    if (String(existing[0].author_id) !== String(user.id)) {
      sendJson(res, 403, { error: "只能删除自己发布的内容。" });
      return;
    }
    await pool.query(
      `UPDATE ${tableName("feed_posts")} SET status = 'hidden', updated_at = NOW() WHERE id = ?`,
      [postId]
    );
    sendJson(res, 200, { ok: true, deleted: true, postId: String(postId) });
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
    await bootstrapFeedDemo(pool);
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
    const [authorDataRows] = await pool.query(
      `SELECT data_key, data_value FROM ${tableName("user_data")} WHERE user_id = ? AND data_key IN (?)`,
      [authorId, [USER_DATA_KEYS.accountProfile, USER_DATA_KEYS.favoriteCollections]]
    );
    const authorData = new Map(authorDataRows.map((row) => [row.data_key, row.data_value]));
    const profile = publicAccountProfileForAuthor(authorData.get(USER_DATA_KEYS.accountProfile));
    const collections = publicFavoriteCollections(authorData.get(USER_DATA_KEYS.favoriteCollections));
    const favoritePostIds = Array.from(new Set(collections.flatMap((folder) => folder.postIds))).slice(0, 80);
    const favoriteRows = favoritePostIds.length
      ? await fetchFeedRows(
          pool,
          user.id,
          "AND p.id IN (?)",
          [favoritePostIds],
          "p.created_at DESC",
          80,
          "favorite"
        )
      : [];
    const favoritePosts = new Map(favoriteRows.map((row) => {
      const post = publicFeedPost(row, signals);
      return [String(post.id), post];
    }));
    sendJson(res, 200, {
      author: {
        id: String(author.id),
        name: author.username,
        createdAt: toIso(author.created_at),
        followed: Boolean(author.followed),
        followers: Number(author.follower_count || 0),
        posts: Number(author.post_count || 0),
        profile,
      },
      posts: posts.map((row) => publicFeedPost(row, signals)),
      publicCollections: collections.map((folder) => ({
        ...folder,
        posts: folder.postIds.map((id) => favoritePosts.get(String(id))).filter(Boolean),
      })).filter((folder) => folder.posts.length),
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
