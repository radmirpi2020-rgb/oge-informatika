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
    { route: "account", label: "Аккаунт" },
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
    /* параметры запроса отрезаем: #/account?verify=abc — это ссылка из письма */
    var qi = h.indexOf("?");
    var parts = (qi === -1 ? h : h.slice(0, qi)).split("/");
    return { name: parts[0] || "home", param: parts[1] != null ? decodeURIComponent(parts[1]) : null };
  };

  /** параметры после «?»: #/account?verify=abc → { verify: "abc" } */
  R.query = function () {
    var h = location.hash.replace(/^#\/?/, "");
    var qi = h.indexOf("?");
    var out = {};
    if (qi === -1) return out;
    h.slice(qi + 1).split("&").forEach(function (pair) {
      if (!pair) return;
      var eq = pair.indexOf("=");
      var k = eq === -1 ? pair : pair.slice(0, eq);
      var v = eq === -1 ? "" : pair.slice(eq + 1);
      try { out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " ")); }
      catch (e) { out[k] = v; }
    });
    return out;
  };

  R.register = function (name, page) { App.pages[name] = page; };

  function header() {
    var plan = ST.planDef();
    var info = App.usage.info();
    var course = App.course.currentDef();
    return '<header>' +
      '<div class="logo" role="link" tabindex="0" data-nav="home">Информатика<span>·</span>' +
        App.util.esc(course.short) + '</div>' +
      '<div class="header-tools">' +
        '<button class="toggle" id="ringBtn" title="Лимит нейронки на сегодня">' + App.aiRing({ withText: true }) + '</button>' +
        '<button class="toggle" id="aiBtn" title="Открыть провожатого">AI</button>' +
        '<button class="toggle" id="themeBtn">Тема</button>' +
      '</div>' +
    '</header>';
  }

  function sidebar() {
    var cur = R.current.name;
    var html = '<aside>' + App.course.tabsHtml() + '<nav id="nav">';
    R.nav.forEach(function (item) {
      html += '<button data-nav="' + item.route + '"' + (cur === item.route ? ' class="active"' : "") + '>' + item.label + '</button>';
    });
    html += '</nav><div class="aside-foot">' +
      'Тариф: <b>' + App.util.esc(ST.planDef().name) + '</b><br>' +
      (App.planAI()
        ? 'Лимит сегодня: ' + App.util.fmt(info_left()) + ' токенов<br>'
        : 'Нейронка: <b>не входит</b><br>') +
      'Контент: ' + App.util.esc(App.dataSourceNote || "из файлов") +
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
      /* переключение курса: «Информатика 5–9 класс» ↔ «Подготовка к ОГЭ» */
      var c = ev.target.closest("[data-course]");
      if (c) {
        ev.preventDefault();
        App.course.set(c.getAttribute("data-course"));
        if (App.pageFilter) { App.pageFilter.module = "all"; App.pageFilter.kind = "all"; App.pageFilter.q = ""; }
        if (R.current.name === "home" || R.current.name === "notfound") R.go("lessons");
        else R.render();
        return;
      }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && ev.target && ev.target.classList && ev.target.classList.contains("logo")) {
        R.go("home");
      }
    });
  }

  window.addEventListener("hashchange", function () { R.render(); });
})();
