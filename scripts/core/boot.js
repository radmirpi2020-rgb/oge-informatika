/* boot.js — старт: тема, навигация, первые страницы, маршрут по умолчанию */
(function () {
  "use strict";

  /* тема */
  function applyTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    App.storage.set(App.storage.KEYS.theme, mode);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", mode === "dark" ? "#0d0d0d" : "#f6f5f1");
    var btn = document.getElementById("themeBtn");
    if (btn) btn.textContent = mode === "dark" ? "Светлая" : "Тёмная";
  }

  App.toggleTheme = function () {
    var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    applyTheme(cur === "dark" ? "light" : "dark");
  };

  function boot() {
    applyTheme(App.storage.get(App.storage.KEYS.theme, null) ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

    document.addEventListener("click", function (ev) {
      var b = ev.target.closest("#themeBtn");
      if (b) App.toggleTheme();
      var r = ev.target.closest("#ringBtn");
      if (r) App.showLimitModal();
      var a = ev.target.closest("#aiBtn");
      if (a && App.ai) App.ai.toggle();
    });

    /* ссылки data-go="route/param" */
    document.addEventListener("click", function (ev) {
      var el = ev.target.closest("[data-go]");
      if (!el) return;
      ev.preventDefault();
      var v = el.getAttribute("data-go");
      var parts = String(v).split("/");
      App.router.go(parts[0], parts[1]);
    });

    if (!location.hash) location.hash = "#/home";
    App.router.render();

    /* если открыто не по file://, можно и без localStorage */
    if (!App.storage.get(App.storage.KEYS.usage, null)) {
      App.storage.set(App.storage.KEYS.usage, {});
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
