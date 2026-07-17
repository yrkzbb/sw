async function init() {
  if (window.Prism?.plugins?.autoloader) {
    Prism.plugins.autoloader.languages_path =
      "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/";
  }
  initTheme();
  restoreViewFromHash();
  await initAuth();
  initApiKeyModal();
  initFeedEventHandlers();
  initEventHandlers();
  initImageLightbox();
  initCopyDelegation();
  initComposer();
  initKnowledgeBase();
  if (state.activeUser) {
    reloadUserWorkspace();
  } else {
    renderStudentProfile();
    renderLearningResources();
    renderStoragePage();
    renderMistakeBookPage();
    renderAssessmentPage();
  }
  if (state.activeUser && shouldAutoRefreshAssessmentAfterReload() && !isAssessmentMobileViewport()) {
    window.setTimeout(() => {
      if (isAssessmentPageVisible()) void refreshLearningAssessment("desktop_browser_reload");
    }, 250);
  }
  document.documentElement.classList.remove(
    "route-boot-chat",
    "route-boot-profile",
    "route-boot-user-info",
    "route-boot-tutor",
    "route-boot-resources",
    "route-boot-push",
    "route-boot-path",
    "route-boot-assessment",
    "route-boot-storage",
    "route-boot-mistakes",
    "route-boot-home"
  );
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
