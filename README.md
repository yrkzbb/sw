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

---

## 附录：课程核心要求与实现对照

### A.1 首页

| 要求 | 实现说明 |
|------|----------|
| 欢迎标题与副标题 | `index.html`：`#home` 内 `.title`、`.subtitle` |
| 标题渐变色文字 | `css/index.css`：`.grad-text`（`background-clip: text`） |
| 4 张横向卡片、异色图标 | `index.html`：`.card-row`、`.suggest-card`、`.card-icon-1`～`4` |
| 点击卡片发 AI | `js/index.js`：`startIfNeededFromCard` → `generateAssistantFromUserText` |

### A.2 对话功能

| 要求 | 实现说明 |
|------|----------|
| OpenAI 兼容代理问答 | `js/index.js`：`CHAT_ENDPOINT`、`DEFAULT_MODEL` |
| 用户右 / AI 左带头像 | `css/index.css`：`.message-row.user`、`.avatar`；`createAvatarSvg()` |
| 流式 + 打字机 | `applyDashscopeSsePayload` + `setInterval`；结束 `renderMarkdownInto` |
| 隐藏欢迎区与卡片 | `ensureChatVisible()` |

### A.3 Markdown

| 要求 | 实现说明 |
|------|----------|
| 标题、表格、代码块、列表、引用等 | `marked` + `css/index.css` 中 `.markdown-body` |

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
│   ├── index.js                    # 主逻辑
│   └── server.js                   # 可选本地代理
└── css/
    └── index.css
```

## 使用方式

1. 在项目根目录创建 `.env`，配置 `OPENAI_PROXY_API_KEY`、`OPENAI_PROXY_BASE_URL`、`OPENAI_PROXY_MODEL`  
2. 运行 `node js/server.js`，打开本地服务地址  
