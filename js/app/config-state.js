
const API_KEY_STORAGE = "LINGXI_API_KEY";
const THEME_STORAGE = "LINGXI_THEME";
const MESSAGES_STORAGE = "LINGXI_MESSAGES";
const CHAT_SESSIONS_STORAGE = "LINGXI_CHAT_SESSIONS";
const CHAT_SIDEBAR_WIDTH_STORAGE = "LINGXI_CHAT_SIDEBAR_WIDTH";
const STUDENT_PROFILE_STORAGE = "LINGXI_STUDENT_PROFILE";
const LEARNING_RESOURCES_STORAGE = "LINGXI_LEARNING_RESOURCES";
const STORED_MARKDOWN_FILES_STORAGE = "LINGXI_STORED_MARKDOWN_FILES";
const STORAGE_EDITOR_SPLIT_STORAGE = "LINGXI_STORAGE_EDITOR_SPLIT";
const MISTAKE_BOOK_STORAGE = "LINGXI_MISTAKE_BOOK";
const MISTAKE_BOOK_GROUP_STORAGE = "LINGXI_MISTAKE_BOOK_GROUP";
const LEARNING_PATH_TODO_STORAGE = "LINGXI_LEARNING_PATH_TODO";
const LEARNING_DEMANDS_STORAGE = "LINGXI_LEARNING_DEMANDS";
const LEARNING_PATH_LIBRARY_STORAGE = "LINGXI_LEARNING_PATH_LIBRARY";
const ACTIVE_PATH_CATEGORY_STORAGE = "LINGXI_ACTIVE_PATH_CATEGORY";
const LEARNING_BEHAVIOR_STORAGE = "LINGXI_LEARNING_BEHAVIOR";
const LEARNING_EFFECT_ASSESSMENT_STORAGE = "LINGXI_LEARNING_EFFECT_ASSESSMENT";
const ANNOUNCEMENT_READ_STORAGE = "LINGXI_ANNOUNCEMENT_READ";
const FAVORITE_COLLECTIONS_STORAGE = "LINGXI_FAVORITE_COLLECTIONS";
const AUTH_USERS_STORAGE = "LINGXI_AUTH_USERS";
const ACTIVE_USER_STORAGE = "LINGXI_ACTIVE_USER";
const AUTH_MODE_STORAGE = "LINGXI_AUTH_MODE";
const USER_SCOPED_STORAGE_KEYS = new Set([
  MESSAGES_STORAGE,
  CHAT_SESSIONS_STORAGE,
  CHAT_SIDEBAR_WIDTH_STORAGE,
  STUDENT_PROFILE_STORAGE,
  LEARNING_RESOURCES_STORAGE,
  STORED_MARKDOWN_FILES_STORAGE,
  STORAGE_EDITOR_SPLIT_STORAGE,
  MISTAKE_BOOK_STORAGE,
  MISTAKE_BOOK_GROUP_STORAGE,
  LEARNING_PATH_TODO_STORAGE,
  LEARNING_DEMANDS_STORAGE,
  LEARNING_PATH_LIBRARY_STORAGE,
  ACTIVE_PATH_CATEGORY_STORAGE,
  LEARNING_BEHAVIOR_STORAGE,
  LEARNING_EFFECT_ASSESSMENT_STORAGE,
  FAVORITE_COLLECTIONS_STORAGE,
]);


const CHAT_ENDPOINT = "/api/chat";
const VIDEO_ENDPOINT = "/api/video";
const AUTH_ENDPOINT = "/api/auth";
const USER_DATA_ENDPOINT = "/api/user-data";
const ANNOUNCEMENT_ENDPOINT = "/api/announcements";
const USE_BROWSER_API_KEY = /^https?:\/\//i.test(CHAT_ENDPOINT);
const RESOURCE_PAGE_UI_ENABLED = false;
const STORAGE_PAGE_UI_ENABLED = false;

const DEFAULT_MODEL = "gpt-4o-mini";

const PROFILE_FIELDS = [
  "major_background",
  "knowledge_foundation",
  "cognitive_style",
  "learning_goals",
  "error_patterns",
  "interaction_preference",
  "learning_habits",
  "motivation_emotion",
];

const PROFILE_FIELD_META = {
  major_background: { title: "专业", icon: "book" },
  learning_goals: { title: "学习目标", icon: "target" },
  knowledge_foundation: { title: "知识基础", icon: "layers" },
  cognitive_style: { title: "认知风格", icon: "spark" },
  error_patterns: { title: "易错点", icon: "alert" },
  interaction_preference: { title: "学习偏好", icon: "chat" },
  learning_habits: { title: "学习节奏", icon: "clock" },
  motivation_emotion: { title: "兴趣方向", icon: "heart" },
};

const RESOURCE_AGENTS = [
  { id: "analysis", role: "需求分析师", task: "", selectable: false },
  { id: "retrieval", type: "拓展阅读与教育资源", role: "阅读扩展 Agent", task: "从可信高校课程与学术平台整理拓展阅读材料并标注来源。", selectable: true, local: true },
  { id: "doc", type: "专业课程讲解文档", role: "知识文档 Agent", task: "生成完整、可直接阅读的知识正文文档。", selectable: true },
  { id: "mindmap", type: "知识点思维导图", role: "思维导图 Agent", task: "组织知识点结构和关联路径。", selectable: true },
  { id: "learning-path", type: "个性化学习路径", role: "学习路径 Agent", task: "结合当前问题与学习画像规划循序渐进的学习步骤。", selectable: true },
  { id: "quiz", type: "不同类型练习题目", role: "练习命题 Agent", task: "设计基础、进阶、易错和应用题。", selectable: true },
  { id: "reading", type: "拓展阅读材料", role: "阅读拓展 Agent", task: "提供拓展阅读材料和检索关键词。", selectable: false },
  { id: "code", type: "代码类实操案例", role: "代码实操 Agent", task: "生成可运行实操案例和调试任务。", selectable: true },
  { id: "ppt", type: "教学演示文稿（PPT）", role: "PPT 生成 Agent", task: "生成可下载的教学演示文稿。", selectable: true },
  { id: "review", role: "审核整合 Agent", task: "", selectable: false },
];

const SELECTABLE_RESOURCE_AGENTS = RESOURCE_AGENTS.filter((agent) => agent.selectable);

const LEARNING_PROFILE_SYSTEM_PROMPT = `你是一个“对话式学习画像构建助手”。你的任务不是让学生填写表单，而是在自然对话中自然地了解学生，并持续维护一个动态学习画像。

你需要从学生的发言中抽取、推断并更新学习画像。画像至少包含以下 8 个维度：
1. 专业：学生的专业、年级与主修方向。
2. 知识基础：已掌握内容、薄弱知识点与先修知识缺口。
3. 认知风格：偏好图解、类比、步骤推导、代码示例、案例驱动、先总后分等。
4. 学习目标：短期目标、长期目标、考试、项目、竞赛或就业需求。
5. 易错点：常见错误、容易混淆的概念、卡住的原因与畏难点。
6. 学习偏好：希望回答简洁还是详细，是否需要提问引导、练习题、总结卡片。
7. 学习节奏：学习频率、时间安排、复习方式与是否容易拖延。
8. 兴趣方向：感兴趣的主题、愿意深入的领域与持续学习的动力来源。

工作规则：
- 不要一次性问长表单。每轮最多自然追问 1 个关键问题。
- 如果学生已经给出足够信息，优先直接帮助学生学习，不要为了画像而打断学习。
- 对明确表达的信息标记为“确定”；对推断出的信息标记为“推测”；对缺失信息标记为“待补充”。
- 每个维度都可能包含多个子事实，不要因为确认了一个点就认为该维度已经完整。
- 如果同一维度出现多个信息点，请在 value 中用分号累积保留，例如“Java 循环较薄弱；希望深入学习 C++ 面向对象”。
- 当新信息与旧画像冲突时，优先相信最近、最具体的信息，并保留变化说明。
- 不要编造学生没有提供的信息。
- 画像应服务于教学：回答问题时要根据学生画像调整解释深度、例子类型、练习难度和反馈方式。
- 不要默认把完整画像展示给学生，除非学生要求查看。
- 如果学生要求查看画像，用清晰、友好的方式展示当前画像，并标注哪些是确定、推测、待补充。`;

const el = {
  root: document.querySelector("#app"),
  themeToggle: document.querySelector("#themeToggle"),
  home: document.querySelector("#home"),
  chat: document.querySelector("#chat"),
  profilePage: document.querySelector("#profilePage"),
  userInfoPage: document.querySelector("#userInfoPage"),
  resourcePage: document.querySelector("#resourcePage"),
  pushPage: document.querySelector("#pushPage"),
  pathPage: document.querySelector("#pathPage"),
  assessmentPage: document.querySelector("#assessmentPage"),
  storagePage: document.querySelector("#storagePage"),
  mistakePage: document.querySelector("#mistakePage"),
  chatPageBtn: document.querySelector("#chatPageBtn"),
  profilePageBtn: document.querySelector("#profilePageBtn"),
  userInfoPageBtn: document.querySelector("#userInfoPageBtn"),
  resourcePageBtn: document.querySelector("#resourcePageBtn"),
  pushPageBtn: document.querySelector("#pushPageBtn"),
  pathPageBtn: document.querySelector("#pathPageBtn"),
  assessmentPageBtn: document.querySelector("#assessmentPageBtn"),
  storagePageBtn: document.querySelector("#storagePageBtn"),
  mistakePageBtn: document.querySelector("#mistakePageBtn"),
  profileBackBtn: document.querySelector("#profileBackBtn"),
  profileVisual: document.querySelector("#profileVisual"),
  profileGrid: document.querySelector("#profileGrid"),
  profileMeta: document.querySelector("#profileMeta"),
  resourcePromptInput: document.querySelector("#resourcePromptInput"),
  knowledgeBasePdfInput: document.querySelector("#knowledgeBasePdfInput"),
  knowledgeBaseTask: document.querySelector("#knowledgeBaseTask"),
  knowledgeBaseList: document.querySelector("#knowledgeBaseList"),
  storageKnowledgeFolder: document.querySelector("#storageKnowledgeFolder"),
  storageKnowledgeFolderBtn: document.querySelector("#storageKnowledgeFolderBtn"),
  storageKnowledgeFolderBody: document.querySelector("#storageKnowledgeFolderBody"),
  storageKnowledgeCount: document.querySelector("#storageKnowledgeCount"),
  pptThemeSelect: document.querySelector("#pptThemeSelect"),
  pptThemePreviewBtn: document.querySelector("#pptThemePreviewBtn"),
  pptThemePreviewPanel: document.querySelector("#pptThemePreviewPanel"),
  generateResourcesBtn: document.querySelector("#generateResourcesBtn"),
  pushGenerateResourcesBtn: document.querySelector("#pushGenerateResourcesBtn"),
  feedComposer: document.querySelector("#feedComposer"),
  feedTypeInput: document.querySelector("#feedTypeInput"),
  feedCategoryInput: document.querySelector("#feedCategoryInput"),
  feedTitleInput: document.querySelector("#feedTitleInput"),
  feedTagsInput: document.querySelector("#feedTagsInput"),
  feedBodyInput: document.querySelector("#feedBodyInput"),
  feedVideoUploadPanel: document.querySelector("#feedVideoUploadPanel"),
  feedVideoInput: document.querySelector("#feedVideoInput"),
  feedVideoUploadStatus: document.querySelector("#feedVideoUploadStatus"),
  feedComposerMessage: document.querySelector("#feedComposerMessage"),
  feedMarkdownToolbar: document.querySelector("#feedMarkdownToolbar"),
  feedMarkdownPreview: document.querySelector("#feedMarkdownPreview"),
  feedPreviewTitle: document.querySelector("#feedPreviewTitle"),
  feedComposeWordCount: document.querySelector("#feedComposeWordCount"),
  feedComposeReadTime: document.querySelector("#feedComposeReadTime"),
  feedPublishBtn: document.querySelector("#feedPublishBtn"),
  pathGenerateResourcesBtn: document.querySelector("#pathGenerateResourcesBtn"),
  agentPipeline: document.querySelector("#agentPipeline"),
  exerciseBlueprintPanel: document.querySelector("#exerciseBlueprintPanel"),
  exerciseBlueprintTotal: document.querySelector("#exerciseBlueprintTotal"),
  learningPathPanel: document.querySelector("#learningPathPanel"),
  assessmentGrid: document.querySelector("#assessmentGrid"),
  generateAssessmentBtn: document.querySelector("#generateAssessmentBtn"),
  assessmentPullStatus: document.querySelector("#assessmentPullStatus"),
  pushGrid: document.querySelector("#pushGrid"),
  resourceGrid: document.querySelector("#resourceGrid"),
  storageGrid: document.querySelector("#storageGrid"),
  mistakeBookGrid: document.querySelector("#mistakeBookGrid"),
  storageModal: document.querySelector("#storageModal"),
  storageModalClose: document.querySelector("#storageModalClose"),
  storageEditTitle: document.querySelector("#storageEditTitle"),
  storageEditCategory: document.querySelector("#storageEditCategory"),
  storageEditContent: document.querySelector("#storageEditContent"),
  storageEditContentLabel: document.querySelector("#storageEditContentLabel"),
  storageEditorBody: document.querySelector("#storageEditorBody"),
  storageResizeHandle: document.querySelector("#storageResizeHandle"),
  storagePreview: document.querySelector("#storagePreview"),
  storagePreviewTools: document.querySelector("#storagePreviewTools"),
  storageSvgZoom: document.querySelector("#storageSvgZoom"),
  storageSaveFileBtn: document.querySelector("#storageSaveFileBtn"),
  storageDeleteFileBtn: document.querySelector("#storageDeleteFileBtn"),
  storageDownloadFileBtn: document.querySelector("#storageDownloadFileBtn"),
  pushDetailModal: document.querySelector("#pushDetailModal"),
  pushDetailClose: document.querySelector("#pushDetailClose"),
  pushDetailType: document.querySelector("#pushDetailType"),
  pushDetailTitle: document.querySelector("#pushDetailTitle"),
  pushDetailMeta: document.querySelector("#pushDetailMeta"),
  pushDetailBody: document.querySelector("#pushDetailBody"),
  composer: document.querySelector("#composer"),
  messages: document.querySelector("#messages"),
  chatSessionList: document.querySelector("#chatSessionList"),
  newChatBtn: document.querySelector("#newChatBtn"),
  profileBuilderBtn: document.querySelector("#profileBuilderBtn"),
  profileBuilderModal: document.querySelector("#profileBuilderModal"),
  profileBuilderCloseBtn: document.querySelector("#profileBuilderCloseBtn"),
  profileBuilderProgressText: document.querySelector("#profileBuilderProgressText"),
  profileBuilderProgressBar: document.querySelector("#profileBuilderProgressBar"),
  profileBuilderConversation: document.querySelector("#profileBuilderConversation"),
  profileBuilderChoices: document.querySelector("#profileBuilderChoices"),
  profileBuilderManualForm: document.querySelector("#profileBuilderManualForm"),
  profileBuilderManualInput: document.querySelector("#profileBuilderManualInput"),
  profileBuilderLaterBtn: document.querySelector("#profileBuilderLaterBtn"),
  profileBuilderDoneBtn: document.querySelector("#profileBuilderDoneBtn"),
  chatSidebarResizeHandle: document.querySelector("#chatSidebarResizeHandle"),
  input: document.querySelector("#input"),
  sendBtn: document.querySelector("#sendBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  uploadBtn: document.querySelector("#uploadBtn"),
  imageInput: document.querySelector("#imageInput"),
  imagePreview: document.querySelector("#imagePreview"),
  chatAgentToolbar: document.querySelector("#chatAgentToolbar"),
  chatAgentSelection: document.querySelector("#chatAgentSelection"),
  chatAgentOptions: document.querySelector("#chatAgentOptions"),
  chatPptOptions: document.querySelector("#chatPptOptions"),
  chatPptThemeGrid: document.querySelector("#chatPptThemeGrid"),
  chatPptThemeLabel: document.querySelector("#chatPptThemeLabel"),
  chatQuizOptions: document.querySelector("#chatQuizOptions"),
  chatQuizTotal: document.querySelector("#chatQuizTotal"),
  apiKeyModal: document.querySelector("#apiKeyModal"),
  keyBanner: document.querySelector("#keyBanner"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  saveApiKeyBtn: document.querySelector("#saveApiKeyBtn"),
  closeApiKeyBtn: document.querySelector("#closeApiKeyBtn"),
  imageLightbox: document.querySelector("#imageLightbox"),
  lightboxImage: document.querySelector("#lightboxImage"),
  lightboxClose: document.querySelector(".lightbox-close"),
  lightboxBackdrop: document.querySelector(".lightbox-backdrop"),
  authOverlay: document.querySelector("#authOverlay"),
  authShell: document.querySelector("#authShell"),
  authForm: document.querySelector("#authForm"),
  authLoginForm: document.querySelector("#authLoginForm"),
  authUsername: document.querySelector("#authUsername"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authConfirmPassword: document.querySelector("#authConfirmPassword"),
  authLoginAccount: document.querySelector("#authLoginAccount"),
  authLoginPassword: document.querySelector("#authLoginPassword"),
  authMessage: document.querySelector("#authMessage"),
  authLoginMessage: document.querySelector("#authLoginMessage"),
  authSubmitBtn: document.querySelector("#authSubmitBtn"),
  authLoginSubmitBtn: document.querySelector("#authLoginSubmitBtn"),
  loginTab: document.querySelector("#loginTab"),
  registerTab: document.querySelector("#registerTab"),
  userChip: document.querySelector("#userChip"),
  userProfileBtn: document.querySelector("#userProfileBtn"),
  userMenuBtn: document.querySelector("#userMenuBtn"),
  userMenu: document.querySelector("#userMenu"),
  userNameLabel: document.querySelector("#userNameLabel"),
  userBioLabel: document.querySelector("#userBioLabel"),
  logoutBtn: document.querySelector("#logoutBtn"),
  sideLogoutBtn: document.querySelector("#sideLogoutBtn"),
  accountModal: document.querySelector("#accountModal"),
  accountProfileForm: document.querySelector("#accountProfileForm"),
  closeAccountModalBtn: document.querySelector("#closeAccountModalBtn"),
  accountSaveBtn: document.querySelector("#accountSaveBtn"),
  accountMessage: document.querySelector("#accountMessage"),
  accountTitle: document.querySelector("#accountTitle"),
  accountNameInput: document.querySelector("#accountNameInput"),
  accountEmailInput: document.querySelector("#accountEmailInput"),
  accountGithubInput: document.querySelector("#accountGithubInput"),
  accountContactEmailInput: document.querySelector("#accountContactEmailInput"),
  accountAvatarInput: document.querySelector("#accountAvatarInput"),
  accountAccentInput: document.querySelector("#accountAccentInput"),
  accountBioInput: document.querySelector("#accountBioInput"),
  accountThemeInput: document.querySelector("#accountThemeInput"),
  accountDefaultPageInput: document.querySelector("#accountDefaultPageInput"),
  accountReplyStyleInput: document.querySelector("#accountReplyStyleInput"),
  accountCurrentPasswordInput: document.querySelector("#accountCurrentPasswordInput"),
  accountNewPasswordInput: document.querySelector("#accountNewPasswordInput"),
  accountConfirmPasswordInput: document.querySelector("#accountConfirmPasswordInput"),
  accountSecurityEmail: document.querySelector("#accountSecurityEmail"),
  accountSecurityRole: document.querySelector("#accountSecurityRole"),
  accountPreviewAvatar: document.querySelector("#accountPreviewAvatar"),
  accountPreviewName: document.querySelector("#accountPreviewName"),
  accountPreviewBio: document.querySelector("#accountPreviewBio"),
  personalProfileName: document.querySelector("#personalProfileName"),
  personalProfileHandle: document.querySelector("#personalProfileHandle"),
  personalProfileBio: document.querySelector("#personalProfileBio"),
  profileHeroAvatar: document.querySelector("#profileHeroAvatar"),
  profileEditButton: document.querySelector("#profileEditButton"),
  profileEditShortcut: document.querySelector("#profileEditShortcut"),
  profileOwnHomeBtn: document.querySelector("#profileOwnHomeBtn"),
  profilePublicFollowBtn: document.querySelector("#profilePublicFollowBtn"),
  profileTabs: document.querySelector("#profileTabs"),
  profileContentPanel: document.querySelector("#profileContentPanel"),
  profileTrendChart: document.querySelector("#profileTrendChart"),
  profileSkillTags: document.querySelector("#profileSkillTags"),
  profileArchiveTabs: document.querySelector("#profileArchiveTabs"),
  profileFilterNotice: document.querySelector("#profileFilterNotice"),
  announcementCenter: document.querySelector("#announcementCenter"),
  announcementToggle: document.querySelector("#announcementToggle"),
  announcementUnreadCount: document.querySelector("#announcementUnreadCount"),
  announcementPanel: document.querySelector("#announcementPanel"),
  announcementSummary: document.querySelector("#announcementSummary"),
  announcementShowAll: document.querySelector("#announcementShowAll"),
  announcementMarkAllRead: document.querySelector("#announcementMarkAllRead"),
  announcementList: document.querySelector("#announcementList"),
};

const state = {
  theme: "dark",
  apiKey: "",
  authMode: "login",
  authUsers: [],
  activeUser: null,
  announcements: [],
  feedSort: "recommended",
  feedType: "all",
  feedPage: 1,
  feedPosts: [],
  feedInterests: [],
  feedNotifications: [],
  feedUnreadNotifications: 0,
  feedHasMore: false,
  feedLoading: false,
  feedComposerOpen: false,
  feedComposePane: "edit",
  feedReturnContext: null,
  showAllAnnouncements: false,
  remoteStorageHydrating: false,
  messages: [], 
  chatSessions: [],
  activeChatId: "",
  chatSidebarWidth: 230,
  chatSidebarResize: null,
  attachedFiles: [],
  attachedImages: [], 
  selectedChatAgentIds: [],
  chatPptTheme: "auto",
  chatPptThemesRequested: false,
  chatExerciseBlueprint: { 单选题: 2, 多选题: 1, 判断题: 1, 填空题: 2, 简答题: 2, 应用题: 2 },
  activeChatAgentOption: "",
  knowledgeBaseItemCount: 0,
  uiVersion: 0,
  personalProfileTab: "answers",
  personalArchiveGroup: "year",
  personalProfileFilter: "",
  personalProfileView: "archive",
  personalProfileSelectedPostId: "",
  personalProfileSelectedPost: null,
  personalProfilePostEditable: false,
  personalProfilePosts: [],
  personalProfileStats: null,
  publicProfile: null,
  personalProfileLoading: false,
  favoriteCollections: [],
  favoritePosts: [],
  favoriteCollectionsLoading: false,
  favoriteSelectedCollectionId: "",
  profileSocial: {
    following: [],
    followers: [],
  },
  profileSocialLoading: false,
  profileSocialLoaded: false,

  isGenerating: false,
  abortController: null,
  typingInterval: null,
  typingBuffer: "",
  streamingDone: false,

  currentAssistant: null,
  studentProfile: null,
  profileUpdateInFlight: null,
  profileRefreshTimer: null,
  learningResources: null,
  learningPathLibrary: {},
  activePathCategory: "",
  activePathStageIndex: 0,
  learningDemandEvents: [],
  storedMarkdownFiles: [],
  mistakeBookItems: [],
  mistakeBookGroupBy: "category",
  activeStorageFileId: null,
  storageEditorSplit: 50,
  storageResizeActive: false,
  storageSvgZoom: 100,
  storageFullscreenZoom: 100,
  resourcesGenerating: false,
  resourceAgentProgress: [],
  exerciseBlueprint: { 单选题: 2, 多选题: 1, 判断题: 1, 填空题: 2, 简答题: 2, 应用题: 2 },
  pptThemes: [],
  pptThemesLoading: false,
  lastScrollY: 0,
  navHidden: false,
  selectedResourceAgents: [],
  learningPathTodoDone: {},
  learningBehaviorEvents: [],
  learningAssessment: null,
  assessmentGenerating: false,
  assessmentPull: {
    active: false,
    startY: 0,
    distance: 0,
    armed: false,
  },
  renderedVideoUrls: {},
};
