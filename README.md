# 问阶 · AI 学习工作台

面向高校学习场景的一体化 AI 学习平台。问阶将对话辅导、学习画像、个性化路径、多智能体资源生成、课程 PDF 知识库、学习社区和复盘评估整合在同一个工作台中，并提供账号体系与轻量管理后台。

> AI 生成内容仅用于学习辅助。涉及课程结论、论文引用和外部链接时，请以教材、教师或原始资料为准。

## 核心能力

- **AI 对话辅导**：支持流式回答、多轮上下文、图片输入、Markdown、代码高亮、停止生成与会话历史。
- **个性化学习**：从交互中持续更新学习画像，识别跨主题学习需求，并按知识大类维护可执行的阶段、Todo 和掌握证据。
- **多智能体资源生成**：需求分析、资源 Agent 并行生成、审核整合分阶段执行，可产出讲解文档、练习、案例、导图、拓展阅读和教学 PPT。
- **本地课程知识库**：上传最大 80 MB 的课程 PDF；文本型 PDF 直接解析，扫描版可通过中文 OCR 建库，并在回答中保留文档与页码来源。
- **资源推送与学习复盘**：将生成资源关联到学习路径，结合学习进度、错题和评估结果给出下一步建议。
- **学习社区**：支持动态、评论、关注、收藏、兴趣与通知等社交学习能力。
- **账号与管理后台**：MySQL 持久化用户、会话和学习数据；后台提供用户、公告、会话、安全、运营指标和审计日志管理。
- **响应式体验**：深浅主题、桌面端与移动端布局，以及个人主页、文件存储和收藏空间。

## 技术栈

| 层级 | 实现 |
| --- | --- |
| 前端 | 原生 HTML、CSS、JavaScript，Marked、Prism、HLS.js |
| 服务端 | Node.js 原生 HTTP 服务 |
| 数据库 | MySQL 8.x / 兼容版本，`mysql2` |
| AI 接口 | 讯飞星火 HTTP API |
| 文档处理 | `pdf-parse`、Poppler、Tesseract OCR、PptxGenJS |
| 可选服务 | 讯飞智能 PPT、讯飞虚拟人、阿里云百炼视频生成 |

## 快速开始

### 1. 环境要求

- Node.js 18+（需要原生 `fetch`）
- npm
- MySQL 8.x 或兼容数据库
- 已开通讯飞星火大模型服务并取得 API Password

扫描版 PDF 的 OCR 功能还需要安装 Poppler（提供 `pdftoppm`）和 Tesseract，以及 `chi_sim`、`eng` 语言包。视频转码功能需要 FFmpeg。这些依赖不影响基本对话和文本型 PDF 的使用。

### 2. 安装依赖

```bash
npm install
```

### 3. 创建数据库

```sql
CREATE DATABASE wenjie
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

服务首次连接时会自动创建所需数据表，无需手工导入 SQL。

### 4. 配置环境变量

```bash
cp .env.example .env
```

至少填写以下配置：

```dotenv
XFYUN_SPARK_API_PASSWORD=your_xfyun_api_password
XFYUN_SPARK_BASE_URL=https://spark-api-open.xf-yun.com/v1
XFYUN_SPARK_MODEL=4.0Ultra

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=wenjie_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=wenjie
```

数据库也可使用 `DATABASE_URL=mysql://user:password@host:3306/wenjie` 配置。完整的管理员、PPT、虚拟人和视频参数见 [`.env.example`](./.env.example)。请勿提交 `.env`、API Key 或数据库密码。

### 5. 启动

```bash
npm run dev
```

开发脚本默认监听 `http://localhost:4174`。生产式启动可使用：

```bash
npm start
```

此时端口由 `.env` 中的 `PORT` 决定；未配置时服务默认使用 `3000`。

启动后可访问：

- 用户端：`/`
- 管理端：`/admin`

如需首个管理员，在 `.env` 中设置 `ADMIN_BOOTSTRAP_USERNAME`、`ADMIN_BOOTSTRAP_EMAIL` 和 `ADMIN_BOOTSTRAP_PASSWORD`。服务启动时会创建该账号，或将同名账号提升为管理员。请在部署前更换示例密码。

## 常用命令

```bash
npm run dev                 # 以 4174 端口启动开发服务
npm start                   # 按 PORT 配置启动服务
npm run test:knowledge-base # 运行课程知识库检索评估
```

知识库评估用例位于 [`knowledge-base-tests/machine-learning-evaluation.json`](./knowledge-base-tests/machine-learning-evaluation.json)。评估依赖本地已经构建的对应课程知识库。

## 配置说明

| 配置组 | 关键变量 | 用途 |
| --- | --- | --- |
| AI 对话 | `XFYUN_SPARK_API_PASSWORD`、`XFYUN_SPARK_BASE_URL`、`XFYUN_SPARK_MODEL` | 必需，连接讯飞星火 HTTP API；默认模型为 `4.0Ultra` |
| MySQL | `DATABASE_URL` 或 `MYSQL_*` | 必需，账号、社区和学习数据持久化 |
| 会话 | `SESSION_TTL_DAYS`、`MYSQL_TABLE_PREFIX` | Cookie 有效期与数据表前缀 |
| 管理员 | `ADMIN_BOOTSTRAP_*` | 初始化首个管理员 |
| 智能 PPT | `XFYUN_PPT_*` | 可选，调用讯飞智能 PPT；未配置时可使用本地 PPTX 生成 |
| AI 视频 | `VIDEO_PROVIDER`、`DASHSCOPE_*`、`XUNFEI_VMS_*` | 可选，视频或虚拟人生成 |
| 本地工具 | `PDFTOPPM_BIN`、`TESSERACT_BIN`、`FFMPEG_BIN` | 可选，自定义外部命令路径 |

AI 视频通常会产生第三方费用，因此不属于默认资源生成流程。

## 系统工作流

```mermaid
flowchart LR
  U["学习需求 / 课程 PDF"] --> C["对话与需求识别"]
  K["本地课程知识库"] --> C
  C --> P["学习画像与分类路径"]
  P --> A["需求分析 Agent"]
  A --> R["资源 Agent 并行生成"]
  K --> R
  R --> Q["审核整合 Agent"]
  Q --> O["资源推送 / Todo / 复盘"]
  O --> P
```

资源生成不是一次请求模拟多个角色：系统依次执行需求分析、所选资源 Agent 和审核整合，并保存协作轨迹、阶段状态、中间摘要与审核反馈。单个资源 Agent 失败不会阻断其余结果。

## 项目结构

```text
.
├── index.html                     # 用户端入口
├── admin.html                     # 管理端入口
├── setup.html                     # 本地 API Key 辅助配置页
├── js/
│   ├── app/                       # 对话、画像、资源、路径、社区等前端模块
│   ├── server.js                  # 服务端组合入口
│   └── server-parts/              # 认证、数据、管理、社区、知识库和代理路由
├── css/                           # 用户端与管理端样式
├── assets/                        # 图标、音频与视频素材
├── scripts/                       # 知识库评估与竞赛文档生成脚本
├── knowledge-base-tests/          # 本地 RAG 评估数据
├── docs/competition/              # 软件杯项目文档源文件
├── 软件杯/                        # 演示材料与 LaTeX 源文件
└── output/                        # 已生成的演示与竞赛文档
```

运行时生成的知识库、PPT 和视频文件保存在 `.runtime/`。该目录包含用户私有内容，不应提交到版本库或直接对外共享。

## 数据与安全

- 密码使用随机盐哈希保存，不在数据库中存储明文。
- 登录态通过 HttpOnly Cookie 维持，禁用账号时会撤销该用户会话。
- 用户学习画像、对话、资源、路径、错题和收藏等数据以 MySQL 为正式数据源；浏览器缓存仅用于改善交互速度。
- 管理员操作会写入审计日志，后台可管理角色、状态、会话、公告和用户数据。
- 检索资源与 AI 生成资源在界面中分别标识；外部链接、论文引用和绝对化结论会经过内容安全检查。
- 课程 PDF 仅在本机 `.runtime/knowledge-base` 中解析和索引，使用者仍需遵守原文档的授权与版权要求。

进一步说明：

- [内容安全与防幻觉机制](./CONTENT_SAFETY.md)
- [AI 工具与生成内容使用声明](./AI_USAGE_DISCLOSURE.md)
- [第三方开源组件声明](./THIRD_PARTY_NOTICES.md)

## 浏览器与部署提示

- 前端会从 jsDelivr 加载 Marked 和 Prism，离线部署时需将这些资源改为本地托管。
- 生产环境建议在 Node 服务前配置 HTTPS 反向代理、请求限流和安全响应头，并使用权限受限的数据库账号。
- `.runtime/` 中可能包含用户上传文档和生成内容，应纳入私有备份与访问控制策略。
- 使用第三方 AI、PPT 或视频服务前，请确认其计费、数据处理与内容合规条款。

## 项目信息

| 项目 | 内容 |
| --- | --- |
| 作者 | 张书旋 |
| 学校 | 华中师范大学 |
| 学号 | 2023214382 |

本项目为课程与竞赛场景下的学习辅助系统原型。
