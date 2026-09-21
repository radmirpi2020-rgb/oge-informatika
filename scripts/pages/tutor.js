/* tutor.js — страница провожатого: чат на весь экран, контекст урока, расход токенов */
(function () {
  "use strict";

  function mdLite(text) {
    var s = App.util.esc(text);
    s = s.replace(/```([\s\S]*?)```/g, function (all, code) { return "<pre>" + code.replace(/^\n/, "") + "</pre>"; });
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/\n/g, "<br>");
    return s;
  }

  App.router.register("tutor", {
    view: function () {
      var ctx = App.ai.context();
      var info = App.usage.info();
      var plan = ST.planDef();
      var mode = App.AI_MODE(App.ai.mode());

      var html = '<div class="kicker">Нейронка-провожатый</div>' +
        "<h2>Спроси по-человечески — ответят коротко</h2>" +
        '<p class="lead">' + (App.ai.configured()
          ? "Подключён DeepSeek (" + App.util.esc(App.ai.keySource()) + "). Провожатый видит, какой урок у тебя открыт, и отвечает по делу."
          : "Ключ DeepSeek не подключён — пока работает простой режим: разбор темы урока, лайфхаки и типичные ошибки. Ключ кладётся в файл config/deepseek-key.js.") + "</p>";

      html += '<div class="tutor-grid"><div>' +
        '<div class="tutor-box">' +
          '<div class="ai-msgs" id="tMsgs" style="flex:1"></div>' +
          '<div class="ai-foot"><textarea id="tInput" rows="2" placeholder="Например: почему при переводе в двоичную остатки читают снизу вверх?"></textarea>' +
          '<button class="send" id="tSend">Спросить</button></div>' +
          '<div class="ai-info" id="tInfo"></div>' +
        "</div>" +
        '<div class="ai-starter">' +
          '<button data-q="Объясни простыми словами тему урока и дай один пример. Коротко."><b>Объясни тему</b>простыми словами с примером</button>' +
          '<button data-q="Какие ошибки чаще всего делают в этой теме и как их не допустить? Коротко, списком."><b>Ошибки</b>что чаще всего теряет баллы</button>' +
          '<button data-q="Дай две задачи по теме урока с ответами. Без длинных объяснений."><b>Задачи</b>две задачи с ответами</button>' +
          '<button data-q="Проверь моё решение и скажи, где ошибка: "><b>Проверить решение</b>вставь своё решение после двоеточия</button>' +
        "</div>" +
      "</div>" +

      '<div class="tutor-side">' +
        App.media.figure(App.media.imageById("mentor"), { className: "tutor-avatar", hideCaption: true }) +
        '<div style="margin-bottom:12px">' + App.media.voiceButton("greet", "Как я говорю") + "</div>" +
        '<div class="kicker">Лимит на сегодня</div>' +
        '<div class="row center" style="gap:14px;margin-bottom:10px">' + App.aiRing({ size: 56, stroke: 6 }) +
          "<div><b>" + App.util.fmt(info.left) + "</b><br><span class=\"tiny muted\">из " + App.util.fmt(info.limit) + "</span></div></div>" +
        '<div class="usage-line"><span>Использовано</span><span>' + App.util.fmt(info.used) + " токенов</span></div>" +
        '<div class="usage-line"><span>Запросов</span><span>' + info.calls + "</span></div>" +
        '<div class="usage-line"><span>Тариф</span><span>' + App.util.esc(plan.name) + "</span></div>" +
        "<h4 style=\"margin-top:16px\">Режим трат</h4>" +
        '<div id="tModes" style="display:flex;flex-direction:column;gap:6px"></div>' +
        '<div class="tiny muted" style="margin-top:8px">Текущий: <b>' + mode.name + "</b> — " + App.util.esc(mode.desc) + "</div>" +
        "<h4 style=\"margin-top:16px\">Контекст</h4>" +
        (ctx.lesson
          ? '<div class="tiny">№' + ctx.lesson.id + " «" + App.util.esc(ctx.lesson.title) + "»<br><span class=\"muted\">" +
            App.util.esc(ctx.lesson.module || "") + "</span><br>" +
            '<button class="btn sm ghost" style="margin-top:8px" data-go="lesson/' + ctx.lesson.id + '">Открыть урок</button></div>'
          : '<div class="tiny muted">Урок не открыт — провожатый ответит по общим вопросам.</div>') +
        '<div class="row" style="margin-top:16px">' +
          '<button class="btn sm ghost" id="tClear">Очистить переписку</button>' +
          '<button class="btn sm ghost" data-go="plans">Тарифы</button>' +
        "</div>" +
        '<div class="tiny muted" style="margin-top:12px">Расход считается по ответам DeepSeek: ' +
          "примерно 1 токен ≈ 3 символа русского текста.</div>" +
      "</div></div>";
      return html;
    },

    bind: function () {
      var box = document.getElementById("tMsgs");
      var input = document.getElementById("tInput");
      var btn = document.getElementById("tSend");

      function push(role, text) {
        var d = document.createElement("div");
        d.className = "ai-msg " + role;
        if (role === "bot") d.innerHTML = "<b>Провожатый:</b><br>" + mdLite(text);
        else d.textContent = text;
        box.appendChild(d);
        box.scrollTop = box.scrollHeight;
        return d;
      }

      var h = App.ai.history();
      if (!h.length) push("bot", App.ai.configured()
        ? "Здравствуй. Я провожатый: помогу разобраться с темой, проверю решение и скажу, что делать дальше. Спрашивай конкретно — отвечу коротко."
        : "Ключ DeepSeek не подключён, поэтому пока отвечаю в простом режиме: объясню тему урока, покажу лайфхаки и типичные ошибки. Ключ кладётся в config/deepseek-key.js.");
      else h.forEach(function (m) { push(m.role === "user" ? "user" : "bot", m.content); });

      function drawModes() {
        var plan = ST.planDef();
        var cur = App.ai.mode();
        var host = document.getElementById("tModes");
        host.innerHTML = App.AI_MODES.map(function (m) {
          var allowed = plan.modes.indexOf(m.id) !== -1;
          return '<button class="ai-mode' + (m.id === cur ? " sel" : "") + '" data-mode="' + m.id + '"' +
            (allowed ? "" : " disabled") + ">" + m.name + " · ≈" + App.util.fmt(m.cost) + " токенов</button>";
        }).join("");
        host.querySelectorAll("[data-mode]").forEach(function (b) {
          b.addEventListener("click", function () {
            if (App.ai.setMode(b.getAttribute("data-mode"))) { drawModes(); info(); }
          });
        });
      }

      function info() {
        var i = App.usage.info();
        var el = document.getElementById("tInfo");
        if (el) el.textContent = "Осталось " + App.util.fmt(i.left) + " токенов из " + App.util.fmt(i.limit) +
          " · запросов сегодня: " + i.calls + " · режим: " + App.AI_MODE(App.ai.mode()).name;
        var ring = document.querySelector(".tutor-side .ring-wrap");
        if (ring) ring.outerHTML = App.aiRing({ size: 56, stroke: 6 });
        var head = document.getElementById("ringBtn");
        if (head) head.innerHTML = App.aiRing({ withText: true });
      }

      function send() {
        var q = input.value.trim();
        if (!q) return;
        input.value = "";
        push("user", q);
        var typing = push("bot", "");
        typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
        btn.disabled = true;

        var res = App.ai.ask(q, {
          onChunk: function (c, full) { typing.innerHTML = "<b>Провожатый:</b><br>" + mdLite(full); box.scrollTop = 1e9; }
        });
        if (res.error) {
          typing.innerHTML = "<b>Провожатый:</b><br>⚠️ " + App.util.esc(res.error.message) +
            (res.error.code === "PLAN" || res.error.code === "BUDGET" ? '<br><button class="btn sm ghost" data-go="plans">Посмотреть тарифы</button>' : "");
          btn.disabled = false;
          info();
          return;
        }
        if (res.local) {
          typing.innerHTML = "<b>Провожатый:</b><br>" + mdLite(res.text);
          btn.disabled = false;
          info();
          return;
        }
        res.then(function (r) {
          typing.innerHTML = "<b>Провожатый:</b><br>" + mdLite(r.text) +
            '<div class="tiny muted" style="margin-top:6px">−' + App.util.fmt(r.usage.total) + " токенов · осталось " +
            App.util.fmt(r.left) + " · " + (r.ms / 1000).toFixed(1) + " с</div>";
          btn.disabled = false;
          info();
          box.scrollTop = 1e9;
        }).catch(function (e) {
          typing.innerHTML = "<b>Провожатый:</b><br>⚠️ " + App.util.esc(e.message || String(e));
          btn.disabled = false;
          info();
        });
      }

      btn.addEventListener("click", send);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
      });
      document.querySelectorAll(".ai-starter button").forEach(function (b) {
        b.addEventListener("click", function () {
          input.value = b.getAttribute("data-q");
          input.focus();
        });
      });
      var cl = document.getElementById("tClear");
      if (cl) cl.addEventListener("click", function () {
        App.ai.clearHistory();
        box.innerHTML = "";
        push("bot", "Переписка очищена. Спрашивай заново.");
      });

      drawModes();
      info();
    }
  });
})();
