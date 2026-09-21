/* lessons.js — список уроков: модули, фильтры, прогресс по каждому элементу */
(function () {
  "use strict";

  App.pageFilter = { kind: "all", module: "all", q: "" };

  function statusOf(l) {
    var s = ST.lessonStats(l);
    if (s.finished) return { text: "пройден", cls: "done" };
    if (l.kind === "practice") return { text: s.total ? s.done + " / " + s.total : "практика", cls: s.done ? "partial" : "" };
    if (s.done > 0) return { text: s.done + " / " + s.total, cls: "partial" };
    return { text: "не начат", cls: "" };
  }

  function card(l, idx) {
    var st = statusOf(l);
    var engine = l.practice && l.practice.engine ? '<span class="kind-mark">' + App.util.esc(l.practice.engine) + "</span>" : "";
    var mode = l.oge && l.oge.modeLabel ? '<span class="kind-mark">' + App.util.esc(l.oge.modeLabel) + "</span>" : "";
    return '<div class="lesson-card' + (l.kind === "practice" ? " practice" : "") + '" data-lesson="' + l.id + '">' +
      '<div class="num">' + App.util.pad(l.id, 3) + "</div>" +
      '<div class="meta"><h3>' + App.util.esc(l.title) + engine + mode + "</h3>" +
      '<p class="sub">' + App.util.esc(l.sub || "") + "</p></div>" +
      '<span class="status ' + st.cls + '">' + st.text + "</span></div>";
  }

  App.router.register("lessons", {
    view: function (param) {
      var courseId = App.course.current();
      var courseDef = App.course.currentDef();
      var isOge = courseId === "oge";
      var all = ST.allLessons(courseId);
      var s = ST.summary(courseId);
      var f = App.pageFilter;
      if (param === "practice") f.kind = "practice";

      var list = all.filter(function (l) {
        if (f.kind === "lesson" && l.kind === "practice") return false;
        if (f.kind === "practice" && l.kind !== "practice") return false;
        if (f.module !== "all" && (l.module || "Прочее") !== f.module) return false;
        if (f.q) {
          var hay = (l.title + " " + (l.sub || "") + " " + (l.module || "")).toLowerCase();
          if (hay.indexOf(f.q.toLowerCase()) === -1) return false;
        }
        return true;
      });

      var modules = [];
      all.forEach(function (l) {
        var m = l.module || "Прочее";
        if (modules.indexOf(m) === -1) modules.push(m);
      });

      var shortN = 0;
      if (isOge) all.forEach(function (l) { if (l.oge && l.oge.shortTrack) shortN++; });

      var html = App.course.tabsHtml("compact") +
        '<div class="kicker">' + App.util.esc(courseDef.kicker) + ' · всего ' + all.length + " элементов</div>" +
        "<h2>" + App.util.esc(courseDef.name) + "</h2>" +
        '<p class="lead">' + App.util.esc(courseDef.note) +
          " Пройдено: " + s.finished + " из " + s.total + " (" + s.percent + "%)." +
          (isOge ? " Уроки делятся по режиму: симуляция в сайте, вживую в настоящей программе (LibreOffice, Кумир, Python) и полный вариант на 150 минут. Короткий трек — " + shortN + " уроков." : "") +
        "</p>" +
        '<div class="bar" style="margin-bottom:16px"><i style="width:' + s.percent + '%"></i></div>';

      html += '<div class="card" style="padding:12px 14px">' +
        '<div class="field" style="margin-bottom:10px"><input type="text" id="fltQ" placeholder="Поиск по названию и теме" value="' + App.util.esc(f.q) + '"></div>' +
        '<div class="row">' +
          ["all:Все", "lesson:Только уроки", "practice:Только практики"].map(function (x) {
            var id = x.split(":")[0];
            return '<button class="btn sm' + (f.kind === id ? "" : " ghost") + '" data-kind="' + id + '">' + x.split(":")[1] + "</button>";
          }).join("") +
        "</div>" +
        '<div class="row" style="margin-top:10px">' +
          '<select id="fltModule" style="max-width:100%;border:1px solid var(--line);background:var(--bg);color:var(--fg);padding:10px 12px;font:inherit;font-size:14px;min-height:44px">' +
            '<option value="all">Все модули</option>' +
            modules.map(function (m) {
              return '<option value="' + App.util.esc(m) + '"' + (f.module === m ? " selected" : "") + ">" + App.util.esc(m) + "</option>";
            }).join("") +
          "</select>" +
        "</div>" +
      "</div>";

      if (!list.length) {
        html += '<div class="alert soft">Ничего не найдено. Сбрось фильтры или измени запрос.</div>';
      } else {
        /* Разделы свёрнуты, как папки: открыт тот, в котором ученик работал последним,
           а если он ещё ничего не делал — первый. Стрелка раскрывает и закрывает. */
        var isFiltered = f.module !== "all" || f.kind !== "all" || !!f.q;
        var remembered = ST.lastModule(courseId);
        var openNow = ST.openModules();
        var groups = [];
        var index = {};
        list.forEach(function (l) {
          var m = l.module || "Прочее";
          if (!index[m]) { index[m] = { name: m, items: [] }; groups.push(index[m]); }
          index[m].items.push(l);
        });

        groups.forEach(function (g, i) {
          var byMod = (ST.summary(courseId).byModule || {})[g.name] || { total: g.items.length, finished: 0 };
          var open = isFiltered
            ? true
            : (g.name === remembered) || (index[g.name] && openNow.indexOf(g.name) !== -1) || (!remembered && i === 0);
          var done = byMod.finished || 0;
          html += '<section class="module' + (open ? " open" : "") + '" data-module="' + App.util.esc(g.name) + '">' +
            '<button class="module-head" type="button" aria-expanded="' + (open ? "true" : "false") + '">' +
              '<span class="arrow" aria-hidden="true">▸</span>' +
              '<span class="module-title">' + App.util.esc(g.name) + "</span>" +
              '<span class="module-meta">' + g.items.length + " " + App.util.plural(g.items.length, "элемент", "элемента", "элементов") +
                " · " + done + " из " + (byMod.total || g.items.length) + " пройдено</span>" +
            "</button>" +
            '<div class="module-body">' +
              g.items.map(function (l) { return card(l); }).join("") +
            "</div>" +
          "</section>";
        });

        if (list.length > 1) {
          html += '<div class="tiny muted" style="margin-top:12px">Показано ' + list.length + " из " + all.length +
            ". Разделы открываются стрелкой: сейчас раскрыт тот, где ты работал последним.</div>";
        }
      }
      return html;
    },
    bind: function () {
      var q = document.getElementById("fltQ");
      if (q) {
        q.addEventListener("input", function () {
          App.pageFilter.q = q.value;
          var pos = q.selectionStart;
          App.router.render();
          setTimeout(function () {
            var q2 = document.getElementById("fltQ");
            if (q2) { q2.focus(); q2.setSelectionRange(pos, pos); }
          }, 0);
        });
      }
      var sel = document.getElementById("fltModule");
      if (sel) sel.addEventListener("change", function () { App.pageFilter.module = sel.value; App.router.render(); });
      document.querySelectorAll("[data-kind]").forEach(function (b) {
        b.addEventListener("click", function () {
          App.pageFilter.kind = b.getAttribute("data-kind");
          App.router.render();
        });
      });

      /* стрелка у раздела: раскрыть или закрыть */
      document.querySelectorAll(".module > .module-head").forEach(function (head) {
        head.addEventListener("click", function () {
          var box = head.parentNode;
          var name = box.getAttribute("data-module") || "";
          var willOpen = !box.classList.contains("open");
          box.classList.toggle("open", willOpen);
          head.setAttribute("aria-expanded", willOpen ? "true" : "false");
          /* запоминаем выбор: открытые разделы помним в сессии, последний — в браузере */
          var open = ST.openModules().filter(function (m) { return m !== name; });
          if (willOpen) {
            open.push(name);
            ST.rememberModule(App.course.current(), name);
          } else if (ST.lastModule(App.course.current()) === name) {
            ST.forgetLastModule(App.course.current());
          }
          ST.setOpenModules(open);
        });
      });

      document.querySelectorAll("[data-lesson]").forEach(function (el) {
        el.addEventListener("click", function () { App.router.go("lesson", el.getAttribute("data-lesson")); });
      });
    }
  });
})();
