/* router.js — хеш-роутер и оболочка страницы (шапка, навигация, футер, панели) */
(function () {
  "use strict";

  var R = App.router = {};
  App.pages = App.pages || {};

  R.current = { name: "home", param: null };

  R.nav = [
    { route: "home", label: "Главная" },
    { route: "lessons", label: "Уроки" },
    { route: "tutor", label: "Провожатый" },
    { route: "progress", label: "Прогресс" },
    { route: "media", label: "Медиа" },
    { route: "plans", label: "Тарифы" },
    { route: "admin", label: "Админ" }
  ];

  R.go = function (route, param) {
    var hash = "#/" + route + (param != null && param !== "" ? "/" + param : "");
    if (location.hash === hash) R.render();
    else location.hash = hash;
  };

  R.parse = function () {
    var h = location.hash.replace(/^#\/?/, "");
    if (!h) return { name: "home", param: null };
    var parts = h.split("/");
    return { name: parts[0] || "home", param: parts[1] != null ? decodeURIComponent(parts[1]) : null };
  };

  R.register = function (name, page) { App.pages[name] = page; };

  function header() {
    var plan = ST.planDef();
    var info = App.usage.info();
    return '<header>' +
      '<div class="logo" role="link" tabindex="0" data-nav="home">ОГЭ<span>·</span>Информатика</div>' +
      '<div class="header-tools">' +
        '<button class="toggle" id="ringBtn" title="Лимит нейронки на сегодня">' + App.aiRing({ withText: true }) + '</button>' +
        '<button class="toggle" id="aiBtn" title="Открыть провожатого">AI</button>' +
        '<button class="toggle" id="themeBtn">Тема</button>' +
      '</div>' +
    '</header>';
  }

  function sidebar() {
    var cur = R.current.name;
    var html = '<aside><nav id="nav">';
    R.nav.forEach(function (item) {
      html += '<button data-nav="' + item.route + '"' + (cur === item.route ? ' class="active"' : "") + '>' + item.label + '</button>';
    });
    html += '</nav><div class="aside-foot">' +
      'Тариф: <b>' + App.util.esc(ST.planDef().name) + '</b><br>' +
      'Лимит сегодня: ' + App.util.fmt(info_left()) + ' токенов' +
      '</div></aside>';
    return html;
  }

  function info_left() { return App.usage.info().left; }

  R.render = function () {
    App.clearError();
    R.current = R.parse();
    var page = App.pages[R.current.name] || App.pages.notfound;
    var html;
    try {
      html = page.view(R.current.param) || "";
    } catch (e) {
      App.showError(e);
      html = '<div class="alert err">Страница не отрисовалась. Подробности выше.</div>';
    }
    var root = document.getElementById("root");
    var body = document.getElementById("pageBody");
    var head = document.getElementById("pageHeader");
    var side = document.getElementById("pageAside");
    if (head) head.innerHTML = header();
    if (side) side.innerHTML = sidebar();
    if (body) body.innerHTML = html;
    if (root) {
      var panels = document.getElementById("panels");
      if (panels && App.mountPanels) App.mountPanels(panels);
    }
    bindShell();
    try { if (page.bind) page.bind(R.current.param); } catch (e) { App.showError(e); }
    if (App.ai && App.ai.afterRender) App.ai.afterRender();
    window.scrollTo(0, 0);
  };

  var shellBound = false;
  function bindShell() {
    if (shellBound) return;
    shellBound = true;
    document.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-nav]");
      if (t) { ev.preventDefault(); R.go(t.getAttribute("data-nav")); return; }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && ev.target && ev.target.classList && ev.target.classList.contains("logo")) {
        R.go("home");
      }
    });
  }

  window.addEventListener("hashchange", function () { R.render(); });
})();
