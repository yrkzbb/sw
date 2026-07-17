# 灵犀 AI 对话助手

WPS 灵犀风格 AI 对话助手，HTML / CSS / JavaScript 实现。
  
---

## 一、项目基本信息

| 项目 | 内容 |
|------|------|
| **姓名** | 张书旋 |
| **学校** | 华中师范大学 |
| **学号** | 2023214382 |

---

## 二、开发任务索引

### 作业核心能力

- [x] **对话功能**：接入 OpenAI 兼容代理接口，真实在线问答；流式响应 + 打字机逐字显示；多轮上下文  
- [x] **用户 / AI 布局**：用户消息靠右，AI 靠左并带头像；进入对话后隐藏首页欢迎区与快捷卡片  
- [x] **首页**：欢迎标题与副标题；标题渐变色文字；4 张横向快捷建议卡片、异色图标；点击卡片即发 AI  
- [x] **Markdown 渲染**：标题、列表、表格、代码块、引用等在 AI 回复中正常显示  
- [x] **主题切换**：深色 / 浅色模式，`localStorage` 持久化，刷新后保持  
- [x] **底部输入区**：固定底部；有文字或附图时显示发送；图片上传与预览、放大；生成中可停止；清除对话回首页  
- [x] **代码块**：Prism 语法高亮；右上角复制  
- [x] **快捷键**：Enter 发送，Shift+Enter 换行；兼容中文输入法组字  

### 扩展与工程化

- [x] **对话历史持久化**（`LINGXI_MESSAGES`）：刷新恢复文字；带图消息保存 `imageUrls`以恢复缩略图  
- [x] **我的学习画像页面**（`LINGXI_STUDENT_PROFILE`）：从自然对话中抽取专业背景、学习目标、知识基础、认知风格、学习习惯、易错点、互动偏好、情绪动力等维度，并用卡片页随学随新展示  
- [x] **个性化学习路径规划和资源推送**（`LINGXI_LEARNING_PATH_LIBRARY` + `LINGXI_LEARNING_RESOURCES.path_basis` + `learning_path`）：依托多智能体协作，按知识大类保存多条学习路径；同类新需求会基于已有路径增量更新阶段、Todo 和资源推送，不会覆盖其他大类路径；路径页提供可勾选 Todo、完成进度、下一步提示  
- [x] **精准资源推送页**：顶部“推送”页面会按知识大类和学习路径阶段聚合系统生成资源，分组展示文档、视频、题库、实操案例、思维导图和拓展阅读，并标注推荐阶段与推荐理由  
- [x] **跨主题需求捕捉**（`LINGXI_LEARNING_DEMANDS`）：从对话提问、资源生成主题和错题知识点中提取学习需求，按 Java、前端、后端、数据结构、编译原理、多模态、计算机视觉、考研数学等知识大类沉淀需求轨迹；生成路径时优先围绕当前主题和同类历史需求动态调整，避免不同大类内容串味  
- [x] **真实多智能体资源生成**（`LINGXI_LEARNING_RESOURCES`）：需求分析师先独立调用，各资源 Agent 再并行独立生成，最后由审核整合 Agent 独立检查并规划路径；系统保存每一步的执行状态、中间产物摘要和审核反馈，不再由一次请求模拟全部角色。支持多选指定 Agent；付费 AI 视频不进入默认生成流程。
- [x] **可溯源高校教育资源检索**：教育资源检索 Agent 通过内置可信目录做本地相关性检索，覆盖国家高等教育智慧教育平台、中国大学 MOOC、学堂在线、MIT OCW、Stanford SEE 与 arXiv；结果记录来源机构、责任主体、链接、资源类型和可信度，并与 AI 生成内容明确区分。
- [x] **完整课程PDF知识库输入**：资源页支持上传最大 80MB 的高校课程电子书或讲义 PDF；系统自动检测文本层，扫描版自动调用中文 OCR，按页切分为带课程名、文档名、页码和解析方式的检索片段。知识库保存在 `.runtime/knowledge-base` 私有目录，不进入 Git；对话、需求分析、各资源 Agent 和审核 Agent 都会优先检索课程知识库，并要求标注具体 PDF 页码。
- [x] **文件存储页**（`LINGXI_STORED_MARKDOWN_FILES`）：知识文档 Agent 生成的讲解文档支持下载为 `.md`，思维导图支持导出 `.svg` 矢量图，并同步存入“存储”页面，按前端、后端、软件工程、多模态、计算机视觉、编译原理、考研数学、数据结构等知识大类自动归档；支持双击打开、编辑文件、大类改名和删除  
- [x] **API Key 管理**：`setup.html` 写入 `LINGXI_API_KEY`；支持导入 / 导出 `lingxi-key.json`；密钥不写进源码  
- [x] **可选本地代理**：`js/server.js`（Node）转发 `/api/chat`，Key 来自环境变量或 `lingxi-key.txt`  

---

## 三、核心技术实现

简要说明关键逻辑的实现思路：

1. **流式对话与打字机**  
   使用 `fetch` 读取 `ReadableStream`，按 SSE 的 `data:` 行解析增量文本，写入缓冲区；用 `setInterval` 逐字显示，流结束后将完整字符串交给 `marked` 渲染，再写入消息历史。

2. **多模态与历史拼装**  
   用户消息在持久化结构中可为 `{ role, content, imageUrls? }`。调用 API 时通过 `userMessageContentForApi` / `toApiMessages` 将带图历史展开为 OpenAI 兼容的 `content` 数组（文本 + `image_url`），与当前用户输入合并；使用 `prior` 与 `newHistory` 分离，避免同一条用户消息在请求体中重复。

3. **Markdown 与代码安全**  
   配置 `marked`（GFM、`breaks`）；自定义 `renderer.code` 以兼容 v14 的 token 对象，输出转义后的 HTML，交由 Prism 高亮；正文样式集中在 `.markdown-body`。

4. **主题与本地数据**  
   通过 `document.body` / `#app` 的 `data-theme` 切换 CSS 变量；主题键 `LINGXI_THEME`、对话与 Key 仅存浏览器本地，满足「密钥不进仓库」的要求。

5. **动态学生画像**
   每轮对话主请求会带入当前 `LINGXI_STUDENT_PROFILE`，回答完成后后台发起一次非流式画像更新请求，只保存结构化 JSON；顶部“画像”页面会用 8 张卡片展示当前画像，并在画像更新后自动刷新。

6. **个性化学习路径规划与资源推送**
   顶部“路径”页面是学习路径中心，不和资源生成列表混在同一个页面。系统会按知识大类维护路径库：例如 Java、数据结构、多模态、编译原理可以各自拥有独立学习路径，顶部大类标签可切换查看。生成资源时，总控 Agent 必须输出 `path_basis` 和 `learning_path`：`path_basis` 综合分析学生专业、学习进度、知识掌握、学习偏好和资源策略；`learning_path` 每个阶段包含学习目标、建议时长、顺序理由、具体步骤、可执行 Todo、掌握证据和推荐资源。同一大类再次生成时，会把已有路径传给模型作为 `existing_category_path`，要求模型增删改查 Todo 和阶段，而不是清零重写；不同大类不会互相覆盖。

   同时，系统会维护 `LINGXI_LEARNING_DEMANDS` 需求轨迹：普通对话中的学习提问、资源页输入的主题、错题本沉淀的知识点都会归入对应知识大类。资源生成时会把“当前主题大类、同类近期需求、全局近期需求、错题主题”等信号传给模型，路径页也会展示“当前需求识别”和同类需求标签，方便检查系统是否抓准了本次需求。

   顶部“推送”页面独立展示资源推送结果。它会读取当前知识大类路径，把 `learning_path` 各阶段中的资源推荐理由与实际生成的资源卡关联起来，按文档、视频、题库、实操、导图、阅读等类型分组展示，说明每个资源适合哪个阶段、为什么适合当前学生画像和学习进度。

7. **多智能体资源生成与来源追踪**
   顶部“资源”页面以学生本次输入的课程/短板/需求为主上下文，学习画像只用于调整难度和讲解风格。一次生成依次执行“需求分析 Agent 独立调用 → 所选资源 Agent 并行独立调用 → 审核整合 Agent 独立调用”，并保存 `collaboration_trace`、各 Agent 中间产物摘要、失败状态与审核反馈。单个资源 Agent 失败不会中断其他 Agent。

   教育资源检索 Agent 不调用大模型，而是从维护的可信高校与学术平台目录中做本地轻量 RAG，输出来源机构、作者/责任主体、URL、资源类型、可信度和检索时间。资源卡使用“检索资源 · 可溯源”或“AI 生成资源”徽标明确标示来源。AI 视频属于可选的高成本扩展能力，不进入默认资源 Agent 列表，也不会因普通资源生成而产生视频费用。

8. **课程电子书知识库与本地 RAG**
   用户可以直接上传课程 PDF。数字版 PDF 使用文本层解析；扫描版 PDF 自动使用 `pdftoppm + Tesseract chi_sim` 做逐页中文 OCR。系统把正文按约 1100 字符切分，并保留页码、课程、文档、提取方式等元数据。检索采用本地关键词与中文二元词相关度排序，召回片段会注入对话和多智能体上下文。回答应使用“课程文档：文档名，PDF第 N 页”标注来源；知识库未覆盖的内容标记为“AI扩展”。

   当前本地测试知识库使用用户提供的周志华《机器学习》PDF。电子书仅在用户本地私有目录中解析和索引，不随仓库提交、不对外提供下载，也不替代合法购买、授权和引用要求。

   课程知识库检索测试数据位于 `knowledge-base-tests/machine-learning-evaluation.json`，覆盖模型评估、线性模型、决策树、神经网络、支持向量机、贝叶斯分类、集成学习、聚类、降维和强化学习等知识点，并检查页码引用与“AI扩展”标记。

8. **Markdown 文档下载与存储**
   知识文档卡片提供“下载 Markdown”按钮，点击后会在浏览器本地下载 `.md` 文件，并把同一份文档写入 `LINGXI_STORED_MARKDOWN_FILES`。顶部“存储”页面按知识大类分组展示已保存文档，支持再次下载。

---

## 附录：课程核心要求与实现对照

### A.1 首页

| 要求 | 实现说明 |
|------|----------|
| 欢迎标题与副标题 | `index.html`：`#home` 内 `.title`、`.subtitle` |
| 标题渐变色文字 | `css/index-parts/base-navigation-profile.css` / `visual-refresh.css`：`.grad-text` |
| 4 张横向卡片、异色图标 | `index.html`：`.card-row`、`.suggest-card`、`.card-icon-1`～`4` |
| 点击卡片发 AI | `js/app/chat-navigation-events.js`：`startIfNeededFromCard` → `generateAssistantFromUserText` |

### A.2 对话功能

| 要求 | 实现说明 |
|------|----------|
| OpenAI 兼容代理问答 | `js/app/config-state.js`：`CHAT_ENDPOINT`、`DEFAULT_MODEL` |
| 用户右 / AI 左带头像 | `css/index-parts/storage-mindmap-chat-profile.css`：`.message-row.user`、`.avatar`；`createAvatarSvg()` |
| 流式 + 打字机 | `applyDashscopeSsePayload` + `setInterval`；结束 `renderMarkdownInto` |
| 隐藏欢迎区与卡片 | `ensureChatVisible()` |

### A.3 Markdown

| 要求 | 实现说明 |
|------|----------|
| 标题、表格、代码块、列表、引用等 | `marked` + `css/index-parts/storage-mindmap-chat-profile.css` 中 `.markdown-body` |

### A.4 主题

| 要求 | 实现说明 |
|------|----------|
| 深/浅色、刷新保持 | `data-theme`、`LINGXI_THEME`、`initTheme` |

### A.5 底部输入区

| 要求 | 实现说明 |
|------|----------|
| 固定底部 | `.composer` `position: fixed` |
| 有内容才显示发送 | `updateSendButton()` |
| 图片上传与预览 | `#imageInput`、`#imagePreview`、lightbox |
| 停止生成 | `#stopBtn`、`AbortController` |
| 清除回首页 | `#clearBtn`、`showHome()` |

### A.6 其他细节

| 要求 | 实现说明 |
|------|----------|
| 代码高亮与复制 | Prism autoloader、`renderer.code`、`initCopyDelegation` |
| Enter / Shift+Enter | `textarea` `keydown`；`isComposing` / `229` |

---

## 附录：目录结构

```
lingxi/
├── index.html                      # 主页面
├── README.md                       # 本文档               
├── 张书旋_2023214382_灵犀.mp4       # 演示视频
├── setup.html                      # API Key 配置页
├── assets/
├   ├── ***.png
├── js/
│   ├── index.js                    # 前端拆分说明入口
│   ├── app/
│   │   ├── config-state.js         # 常量、DOM 引用、全局状态
│   │   ├── auth-account.js         # 注册登录、账户资料和用户数据同步
│   │   ├── announcements.js        # 公告中心
│   │   ├── content-storage.js      # Markdown、学习数据、存储页和错题本
│   │   ├── resources.js            # 资源生成、视频、思维导图和兜底资源
│   │   ├── learning-path-assessment.js # 学习路径、推送和复盘评估
│   │   ├── resource-rendering.js   # 资源卡片渲染
│   │   ├── profile-page.js         # 学习画像和个人主页
│   │   ├── chat-navigation-events.js # 对话、页面切换和事件绑定
│   │   └── init.js                 # 应用初始化
│   ├── server.js                   # 服务端片段加载入口
│   └── server-parts/
│       ├── 01-env-db-config.js     # 环境变量、数据库初始化和配置
│       ├── 02-http-auth-core.js    # HTTP 工具、Cookie、密码和会话核心
│       ├── 03-auth-user-data.js    # 登录注册、个人资料和用户数据 API
│       ├── 04-admin-users.js       # 管理员用户管理
│       ├── 05-admin-system-audit.js # 系统状态、运营总览、会话和审计日志
│       ├── 06-announcements-admin-routes.js # 公告和管理员路由分发
│       └── 07-proxy-static-server.js # AI 代理、视频代理、静态资源和启动
└── css/
    ├── index.css                   # 样式分层入口
    └── index-parts/
        ├── base-navigation-profile.css
        ├── learning-resources-assessment.css
        ├── storage-mindmap-chat-profile.css
        ├── chat-modals-setup-responsive.css
        ├── visual-refresh.css
        └── auth-account.css
```

## 使用方式

1. 安装依赖：`npm install`
2. 在 MySQL 中创建数据库，例如：`CREATE DATABASE wenjie CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
3. 在项目根目录创建 `.env`，配置 `OPENAI_PROXY_API_KEY`、`OPENAI_PROXY_BASE_URL`、`OPENAI_PROXY_MODEL`，并配置正式版账号系统所需的 `DATABASE_URL` 或 `MYSQL_HOST` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE`
4. 如需 AI 视频，配置 `VIDEO_PROVIDER=dashscope_wan`、`DASHSCOPE_API_KEY`、`DASHSCOPE_WORKSPACE_ID`、`DASHSCOPE_REGION`
5. 运行 `npm run dev` 或 `node js/server.js`，打开本地服务地址

## 合规、安全与第三方声明

- [第三方开源组件声明](./THIRD_PARTY_NOTICES.md)
- [AI 工具与生成内容使用声明](./AI_USAGE_DISCLOSURE.md)
- [内容安全与防幻觉机制](./CONTENT_SAFETY.md)

系统会明确区分“检索资源”和“AI 生成资源”，并对输入、Agent 输出、论文引用、外部链接和绝对化学术结论执行分层检查。AI 生成内容仅用于学习辅助，重要事实和引用仍应回到教材、教师或原始文献核验。

## 正式版账号系统

注册、登录和个人学习数据已经改为服务端持久化：

- `wj_users`：保存用户名、邮箱、加盐哈希后的密码
- `wj_sessions`：保存登录会话，浏览器通过 HttpOnly Cookie 保持登录态
- `wj_user_data`：按用户保存学习画像、资源、路径、错题本、对话历史等个人数据

服务启动后会自动创建以上数据表。密码不会明文写入数据库；前端仍会使用浏览器缓存提升页面响应速度，但登录凭证和正式数据来源以 MySQL 为准。

## 轻量管理员端

访问 `/admin` 可进入管理员端。管理员账号和普通账号使用同一张 `wj_users` 表，但通过 `role` 区分：

- `role`：`user` / `admin`
- `status`：`active` / `disabled`
- `last_login_at`：最近登录时间

服务启动时会自动给旧表补齐以上字段。可在 `.env` 中配置 `ADMIN_BOOTSTRAP_USERNAME`、`ADMIN_BOOTSTRAP_EMAIL`、`ADMIN_BOOTSTRAP_PASSWORD` 创建首个管理员；如果同名用户已存在，会自动提升为 `admin` 并启用。

当前管理员端包含：

- 运营总览：用户总数、近 7 天新增、日/周活跃、待关注用户、数据占用排行、最近 14 天新增趋势和数据键分布
- 新增普通用户或管理员账号
- 查看所有注册用户、注册时间、最近登录时间、风险状态和有效会话数，并支持搜索、角色/状态/活跃度/学习数据筛选、排序和分页
- 按当前筛选条件导出用户 CSV
- 查看用户数据概览：对话数量、错题数量、资源数量、画像是否已生成
- 为用户维护管理员内部可见的运营标签和备注
- 在用户详情中查看有效会话数，并可强制撤销该用户全部有效会话
- 多选用户后批量启用、批量禁用或批量清空学习数据
- 导出单个用户的学习数据 JSON，用户详情中可查看数据键清单
- 将普通用户设为管理员，或将管理员降为普通用户
- 禁用/启用用户，禁用后会清理该用户会话并阻止登录
- 重置用户密码，可手动输入或生成临时密码
- 清空某个用户的学习数据
- 删除账号，需输入用户名或邮箱二次确认
- 公告管理：创建、编辑、发布、归档和删除公告；用户端会展示当前有效公告
- 安全中心：查看有效/过期会话、在线用户数、管理员会话数，可撤销单个会话或清理全部过期会话
- 查看系统状态：MySQL 连接、用户总数、管理员数、用户数据总量、最近登录和最近操作
- 记录管理员操作日志，包括新增账号、启用/禁用、角色调整、重置密码、清空数据、导出、公告管理、备注维护、撤销会话和删除账号，并支持按管理员/对象搜索、操作类型筛选和 CSV 导出
