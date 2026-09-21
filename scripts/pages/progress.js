/* progress.js — прогресс: сводка, модули, слабые темы, экспорт и импорт */
(function () {
  "use strict";

  App.router.register("progress", {
    view: function () {
      var courseId = App.course.current();
      var courseDef = App.course.currentDef();
      var other = App.COURSES.filter(function (c) { return c.id !== courseId; })[0];
      var s = ST.summary(courseId);
      var otherS = other ? ST.summary(other.id) : null;
      var plan = ST.planDef();
      var info = App.usage.info();
      var act = ST.activity();
      var days = {};
      act.forEach(function (a) { days[a.d] = (days[a.d] || 0) + 1; });

      var html = '<button class="back" data-go="home">← На главную</button>' +
        App.course.tabsHtml("compact") +
        '<div class="kicker">' + App.util.esc(courseDef.kicker) + '</div><h2>Прогресс: ' + App.util.esc(courseDef.name) + '</h2>';

      html += '<div class="stat-grid">' +
        '<div class="stat-box"><div class="n">' + s.percent + "%</div><div class=\"l\">курса пройдено</div></div>" +
        '<div class="stat-box"><div class="n">' + s.finished + "</div><div class=\"l\">элементов из " + s.total + "</div></div>" +
        '<div class="stat-box"><div class="n">' + s.tasksDone + "</div><div class=\"l\">задач верно из " + s.tasksTotal + "</div></div>" +
        '<div class="stat-box"><div class="n">' + s.streak + "</div><div class=\"l\">дней подряд</div></div>" +
      "</div>";

      html += '<div class="card"><div class="kicker">Общий ход</div>' +
        '<div class="big-stat">' + s.percent + '<span>%</span></div>' +
        '<div class="bar" style="margin:12px 0"><i style="width:' + s.percent + '%"></i></div>' +
        '<div class="progress-row"><span>Осталось элементов</span><span class="val">' + (s.total - s.finished) + "</span></div>" +
        '<div class="progress-row"><span>Примерно времени до конца</span><span class="val">' + App.util.humanTime(s.minutesLeft) + "</span></div>" +
        '<div class="progress-row"><span>Входной тест</span><span class="val">' +
          (ST.test ? ST.test.score + " / " + ST.test.total : "не пройден") + "</span></div>" +
      "</div>";

      /* второй курс — виден рядом, чтобы прогресс не смешивался */
      if (other && otherS) {
        html += '<div class="card" style="margin-top:14px"><div class="kicker">Второй курс</div>' +
          '<div class="progress-row"><span><b>' + App.util.esc(other.name) + '</b></span>' +
            '<span class="val">' + otherS.finished + " / " + otherS.total + " · " + otherS.percent + '%</span></div>' +
          '<div class="bar" style="margin:10px 0"><i style="width:' + otherS.percent + '%"></i></div>' +
          '<div class="row"><button class="btn sm" data-course="' + other.id + '">Открыть курс «' +
            App.util.esc(other.short) + '»</button></div></div>';
      }

      html += '<h3>По модулям</h3>';
      Object.keys(s.byModule).forEach(function (m) {
        var b = s.byModule[m];
        var pct = b.total ? Math.round(b.finished / b.total * 100) : 0;
        html += '<div class="card"><div class="progress-row" style="border:none;padding-top:0">' +
          "<span><b>" + App.util.esc(m) + "</b></span>" +
          '<span class="val">' + b.finished + " / " + b.total + " · " + b.tasksDone + " / " + b.tasks + " задач</span></div>" +
          '<div class="bar"><i style="width:' + pct + '%"></i></div></div>';
      });

      /* ошибки: где больше всего неверных ответов */
      var wrong = [];
      ST.allLessons(courseId).forEach(function (l) {
        (l.tasks || []).forEach(function (t) {
          var a = ST.answerOf(t.id);
          if (a && !a.ok) wrong.push({ lesson: l, task: t });
        });
      });
      if (wrong.length) {
        html += "<h3>Где спотыкаешься (" + wrong.length + ")</h3>" +
          '<p class="tiny muted">Эти задачи решены неверно. Открой урок и нажми «Разбор».</p>' +
          '<div class="card">';
        wrong.slice(0, 12).forEach(function (w) {
          html += '<div class="progress-row"><span>' + App.util.esc(w.task.q.slice(0, 78)) + "</span>" +
            '<span class="val"><button class="btn sm ghost" data-go="lesson/' + w.lesson.id + '">урок №' + w.lesson.id + "</button></span></div>";
        });
        html += "</div>";
        if (wrong.length > 12) html += '<div class="tiny muted">Показаны первые 12 проблемных задач.</div>';
      }

      /* активность за 14 дней */
      var bars = "";
      var maxAct = 1;
      var d = new Date();
      var list = [];
      for (var i = 0; i < 14; i++) {
        var key = d.getFullYear() + "-" + App.util.pad(d.getMonth() + 1, 2) + "-" + App.util.pad(d.getDate(), 2);
        list.unshift(key);
        if ((days[key] || 0) > maxAct) maxAct = days[key];
        d.setDate(d.getDate() - 1);
      }
      list.forEach(function (k) {
        var n = days[k] || 0;
        var hgt = n ? Math.max(6, Math.round((n / maxAct) * 46)) : 2;
        bars += '<div title="' + k + ": элементов " + n + '" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end">' +
          '<div style="background:' + (n ? "var(--accent)" : "var(--line-soft)") + ";height:" + hgt + 'px"></div></div>';
      });
      html += '<h3>Активность за 14 дней</h3><div class="card">' +
        '<div style="display:flex;gap:4px;align-items:flex-end;height:48px">' + bars + "</div>" +
        '<div class="tiny muted" style="margin-top:8px">Высота столбика — сколько элементов закрыто в этот день.</div></div>';

      /* лимиты и тариф */
      html += '<h3>Нейронка и тариф</h3><div class="card">' +
        '<div class="row center" style="gap:16px;margin-bottom:10px">' + App.aiRing({ size: 56, stroke: 6 }) +
          "<div><b>" + App.util.fmt(info.left) + " токенов осталось</b><br>" +
          '<span class="tiny muted">из ' + App.util.fmt(info.limit) + " на сегодня · запросов: " + info.calls + "</span></div></div>" +
        '<div class="progress-row"><span>Тариф</span><span class="val">' + App.util.esc(plan.name) + "</span></div>" +
        '<div class="progress-row"><span>Доступные режимы</span><span class="val">' +
          plan.modes.map(function (m) { return App.AI_MODE(m).name; }).join(", ") + "</span></div>" +
        '<div class="row" style="margin-top:12px"><button class="btn sm" data-go="plans">Тарифы</button>' +
          '<button class="btn sm ghost" data-go="tutor">Провожатый</button></div>' +
      "</div>";

      /* бэкап */
      html += '<h3>Бэкап</h3><div class="card">' +
        '<p class="tiny muted">Прогресс хранится в этом браузере. Перед сменой устройства выгрузи файл и загрузи его на новом.</p>' +
        '<div class="row"><button class="btn sm" id="expBtn">Экспорт JSON</button>' +
        '<label class="btn sm ghost" style="cursor:pointer">Импорт JSON<input type="file" id="impFile" accept="application/json" style="display:none"></label>' +
        '<button class="btn sm danger" id="resetProgress">Сбросить прогресс</button></div>' +
        '<div id="backupMsg" class="tiny" style="margin-top:8px"></div>' +
      "</div>";
      return html;
    },

    bind: function () {
      var exp = document.getElementById("expBtn");
      if (exp) exp.addEventListener("click", function () {
        var data = App.storage.exportAll();
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "oge-progress-" + App.util.today() + ".json";
        a.click();
        document.getElementById("backupMsg").textContent = "Файл выгружен.";
      });
      var imp = document.getElementById("impFile");
      if (imp) imp.addEventListener("change", function () {
        var f = imp.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () {
          try {
            var n = App.storage.importAll(JSON.parse(r.result));
            document.getElementById("backupMsg").textContent = "Загружено записей: " + n + ". Обновляю страницу…";
            setTimeout(function () { location.reload(); }, 800);
          } catch (e) {
            document.getElementById("backupMsg").textContent = "Не получилось: " + e.message;
          }
        };
        r.readAsText(f);
      });
      var rst = document.getElementById("resetProgress");
      if (rst) rst.addEventListener("click", function () {
        if (!confirm("Сбросить уроки, задачи и результаты теста? Отменить будет нельзя.")) return;
        ST.reset("progress");
        App.router.render();
      });
    }
  });
})();
