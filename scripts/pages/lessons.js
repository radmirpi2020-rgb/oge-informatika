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
    return '<div class="lesson-card' + (l.kind === "practice" ? " practice" : "") + '" data-lesson="' + l.id + '">' +
      '<div class="num">' + App.util.pad(l.id, 3) + "</div>" +
      '<div class="meta"><h3>' + App.util.esc(l.title) + engine + "</h3>" +
      '<p class="sub">' + App.util.esc(l.sub || "") + "</p></div>" +
      '<span class="status ' + st.cls + '">' + st.text + "</span></div>";
  }

  App.router.register("lessons", {
    view: function (param) {
      var all = ST.allLessons();
      var s = ST.summary();
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

      var html = '<div class="kicker">Всего ' + all.length + " элементов</div>" +
        "<h2>Уроки и практики</h2>" +
        '<p class="lead">' + s.lessons + " уроков и " + s.practices + " практик. Практики идут после каждых 2–3 уроков и проверяют, что ты реально понял." +
        " Пройдено: " + s.finished + " из " + s.total + " (" + s.percent + "%).</p>" +
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
        var currentModule = null;
        var shown = 0;
        list.forEach(function (l) {
          var m = l.module || "Прочее";
          if (m !== currentModule && f.module === "all") {
            currentModule = m;
            var byMod = ST.summary().byModule[m] || { total: 0, finished: 0 };
            html += '<div class="module-head"><h3>' + App.util.esc(m) + "</h3>" +
              '<span class="muted">' + byMod.finished + " из " + byMod.total + " пройдено</span></div>";
          }
          html += card(l, shown++);
        });
        if (shown > 1) {
          html += '<div class="tiny muted" style="margin-top:12px">Показано ' + shown + " из " + all.length + ".</div>";
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
      document.querySelectorAll("[data-lesson]").forEach(function (el) {
        el.addEventListener("click", function () { App.router.go("lesson", el.getAttribute("data-lesson")); });
      });
    }
  });
})();
