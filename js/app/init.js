async function init() {
  if (window.Prism?.plugins?.autoloader) {
    Prism.plugins.autoloader.languages_path =
      "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/";
  }
  initTheme();
  await initAuth();
  initApiKeyModal();
  initFeedEventHandlers();
  initEventHandlers();
  initImageLightbox();
  initCopyDelegation();
  initComposer();
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
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
