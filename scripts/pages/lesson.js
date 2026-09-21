/* lesson.js — страница урока: теория, задачи, интерактивная практика, навигация */
(function () {
  "use strict";

  function taskHtml(t, n) {
    var saved = ST.answerOf(t.id);
    var html = '<div class="task" data-task="' + t.id + '">' +
      '<div class="label">Задача ' + n + "</div>" +
      '<p class="qt">' + App.md.inline(t.q) + "</p>";
    if (t.type === "choice") {
      html += '<div class="opts">' + (t.options || []).map(function (o, i) {
        return '<label class="opt' + (saved && saved.ok && Number(t.answer) === i ? " correct" : "") + '">' +
          '<input type="radio" name="' + t.id + '" value="' + i + '"' + (saved && Number(saved.v) === i ? " checked" : "") + "> " +
          App.md.inline(o) + "</label>";
      }).join("") + "</div>";
    } else {
      html += '<input type="text" value="' + App.util.esc(saved ? saved.v : "") + '" placeholder="Ответ">';
    }
    html += '<div class="row"><button class="btn sm" data-check="' + t.id + '">Проверить</button>' +
      '<button class="btn sm ghost" data-exp="' + t.id + '">Разбор</button></div>' +
      '<div class="feedback' + (saved && saved.ok ? " show ok" : "") + '">' + (saved && saved.ok ? "✓ решено верно" : "") + "</div>" +
      '<div class="explain"><b>Разбор:</b> ' + App.md.inline(t.explain || "—") + "</div>" +
      "</div>";
    return html;
  }

  App.router.register("lesson", {
    view: function (param) {
      var id = Number(param);
      var l = ST.lesson(id);
      if (!l) return '<button class="back" data-go="lessons">← К урокам</button><div class="alert err">Урок не найден.</div>';

      App.storage.set(App.storage.KEYS.lastLesson, l.id);
      var all = ST.allLessons();
      var idx = ST.lessonIndex(l.id);
      var prev = idx > 0 ? all[idx - 1] : null;
      var next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
      var st = ST.lessonStats(l);
      var isPractice = l.kind === "practice";

      var html = '<button class="back" data-go="lessons">← К урокам</button>' +
        '<div class="breadcrumbs"><span>' + App.util.esc(l.module || "") + "</span><span>·</span>" +
        (isPractice ? "практика" : "урок") + " №" + l.id + "<span>·</span>" + (l.minutes || 7) + " мин</div>" +
        "<h1>" + App.util.esc(l.title) + "</h1>" +
        '<p class="lead">' + App.util.esc(l.sub || "") + "</p>" +
        App.media.figure(App.media.forLesson(l), { hideCaption: false });

      if (st.finished) {
        html += '<div class="alert ok">Элемент пройден. Можно вернуться позже и повторить.</div>';
      }

      if (l.theory && !isPractice) {
        html += '<div class="card" id="theoryBox">' + App.md.theory(l.theory) + "</div>";
      } else if (l.theory && isPractice) {
        html += '<div class="alert soft">' + App.md.theory(l.theory) + "</div>";
      }

      if (isPractice && l.practice) {
        html += '<div class="practical">' +
          '<div class="practical-head"><span class="practical-badge">Практика</span><h3>' + App.util.esc(l.title) + "</h3></div>" +
          '<div class="practical-intro">' + App.util.esc(l.practice.brief || "") + "</div>" +
          '<div id="practiceHost"></div>' +
          "</div>" +
          '<div class="row" style="margin:8px 0 18px">' +
            '<button class="btn ghost" id="askAiPractice">Спросить провожатого</button>' +
            '<button class="btn ghost" id="markDone"' + (st.finished ? " disabled" : "") + ">Отметить как пройденное</button>" +
          "</div>";
      }

      if (l.tasks && l.tasks.length) {
        html += "<h3>Задачи · " + l.tasks.length + "</h3>" +
          '<p class="tiny muted">Реши все — урок закроется сам. Кнопка «Разбор» объясняет ход решения.</p>';
        l.tasks.forEach(function (t, i) { html += taskHtml(t, i + 1); });
        html += '<div class="row" style="margin:14px 0 18px">' +
          '<button class="btn ghost" id="askAiLesson">Спросить провожатого</button>' +
          '<button class="btn" id="markDone2"' + (st.finished ? " disabled" : "") + ">Отметить урок как пройденный</button>" +
        "</div>";
      } else if (!isPractice) {
        html += '<div class="row" style="margin:14px 0 18px"><button class="btn" id="markDone2"' +
          (st.finished ? " disabled" : "") + ">Отметить урок как пройденный</button></div>";
      }

      html += '<div class="card"><div class="progress-row"><span>Прогресс по элементу</span>' +
        '<span class="val">' + st.done + " / " + st.total + " задач</span></div>" +
        '<div class="bar" style="margin:10px 0"><i style="width:' + st.percent + '%"></i></div>' +
        '<div class="row">' +
          (prev ? '<button class="btn sm ghost" data-go="lesson/' + prev.id + '">← ' + App.util.esc(prev.title.slice(0, 34)) + "</button>" : "") +
          (next ? '<button class="btn sm" data-go="lesson/' + next.id + '">' + App.util.esc(next.title.slice(0, 34)) + " →</button>" : "") +
        "</div></div>";
      return html;
    },

    bind: function (param) {
      var id = Number(param);
      var l = ST.lesson(id);
      if (!l) return;

      /* задачи */
      document.querySelectorAll(".task").forEach(function (box) {
        var taskId = box.getAttribute("data-task");
        var task = (l.tasks || []).filter(function (t) { return t.id === taskId; })[0];
        if (!task) return;
        var fb = box.querySelector(".feedback");
        var check = function () {
          var ok;
          if (task.type === "choice") {
            var sel = box.querySelector("input[type=radio]:checked");
            if (!sel) { fb.className = "feedback show err"; fb.textContent = "Выбери вариант"; return; }
            ok = Number(sel.value) === Number(task.answer);
            box.querySelectorAll(".opt").forEach(function (o, i) {
              o.classList.remove("correct", "wrong");
              if (i === Number(task.answer)) o.classList.add("correct");
              if (i === Number(sel.value) && !ok) o.classList.add("wrong");
            });
            ST.markAnswer(taskId, ok, sel.value);
          } else {
            var inp = box.querySelector("input[type=text]");
            ok = App.util.checkAnswer(inp.value, task.answer);
            ST.markAnswer(taskId, ok, inp.value);
          }
          fb.className = "feedback show " + (ok ? "ok" : "err");
          fb.textContent = ok ? "✓ верно" : "✗ не так";
          if (ok) {
            var all = l.tasks || [];
            var done = all.filter(function (t) { var a = ST.answerOf(t.id); return a && a.ok; }).length;
            if (done === all.length) finish(true);
          }
        };
        box.querySelector("[data-check]").addEventListener("click", check);
        box.querySelector("[data-exp]").addEventListener("click", function () {
          var ex = box.querySelector(".explain");
          ex.classList.toggle("show");
        });
        var inp2 = box.querySelector("input[type=text]");
        if (inp2) inp2.addEventListener("keydown", function (e) { if (e.key === "Enter") check(); });
        box.querySelectorAll("input[type=radio]").forEach(function (r) {
          r.addEventListener("change", function () { /* выбор отмечается при проверке */ });
        });
      });

      /* практика */
      var host = document.getElementById("practiceHost");
      if (host && l.practice) {
        var engine = App.PRACTICE[l.practice.engine];
        if (!engine) {
          host.innerHTML = '<div class="alert err">Движок практики «' + App.util.esc(l.practice.engine) + '» не подключён.</div>';
        } else {
          try {
            engine.mount(host, l.practice.config || {}, {
              lesson: l,
              onSolved: function () { finish(true); }
            });
          } catch (e) {
            App.showError(e);
            host.innerHTML = '<div class="alert err">Практика не запустилась: ' + App.util.esc(e.message) + "</div>";
          }
        }
      }

      function finish(silent) {
        if (ST.completed[l.id]) return;
        ST.finishLesson(l.id);
        document.querySelectorAll("#markDone, #markDone2").forEach(function (b) { b.disabled = true; });
        if (!silent) App.router.render();
        else {
          var note = document.createElement("div");
          note.className = "alert ok";
          note.textContent = "✓ Элемент засчитан как пройденный. Не забудь про следующий шаг!";
          var main = document.querySelector("main");
          if (main) main.insertBefore(note, main.querySelector("h1").nextSibling);
        }
      }

      ["markDone", "markDone2"].forEach(function (bid) {
        var b = document.getElementById(bid);
        if (b) b.addEventListener("click", function () { finish(false); });
      });

      ["askAiPractice", "askAiLesson"].forEach(function (bid) {
        var b = document.getElementById(bid);
        if (b) b.addEventListener("click", function () {
          App.ai.open();
          var input = document.getElementById("aiInput");
          if (input) {
            input.value = "Объясни коротко, что нужно сделать в «" + l.title + "» и с чего начать.";
            input.focus();
          }
        });
      });
    }
  });
})();
