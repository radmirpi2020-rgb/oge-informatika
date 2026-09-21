/* ai-panel.js — интерфейс провожатого: кнопка, панель чата, кружок лимита, модальное окно */
(function () {
  "use strict";

  var AI = App.ai;

  /* ---------- кружок лимита (как в GPT) ---------- */
  App.aiRing = function (opts) {
    opts = opts || {};
    var size = opts.size || 22;
    var stroke = opts.stroke || 3;
    var info = App.usage.info();
    var left = info.percent;                 // сколько осталось, %
    var r = (size - stroke) / 2;
    var c = 2 * Math.PI * r;
    var dash = c * (1 - left / 100);
    var cls = left > 50 ? "low" : left > 20 ? "warn" : "full";
    var html = '<span class="ring-wrap" style="--ring:' + size + 'px">' +
      '<svg class="limit-ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '">' +
        '<circle class="trk" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '"></circle>' +
        '<circle class="bar ' + cls + '" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" ' +
          'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + dash.toFixed(1) + '"></circle>' +
      "</svg>" +
      '<span class="ring-txt">' + Math.round(left) + "</span></span>";
    if (opts.withText) {
      html += '<span class="mono tiny" style="margin-left:6px">' + App.util.fmt(info.left) + "</span>";
    }
    return html;
  };

  App.showLimitModal = function () {
    var info = App.usage.info();
    var plan = ST.planDef();
    var byMode = App.usage.today().byMode || {};
    var hist = App.usage.history(7);
    var max = Math.max.apply(null, hist.map(function (h) { return h.tokens; }).concat([1]));
    var old = document.getElementById("limitModal");
    if (old) old.remove();
    var div = document.createElement("div");
    div.className = "modal show";
    div.id = "limitModal";
    var modeRows = App.AI_MODES.map(function (m) {
      var used = byMode[m.id] || 0;
      return '<div class="progress-row"><span>' + m.name + "</span><span class=\"val\">" + App.util.fmt(used) + " токенов</span></div>";
    }).join("");
    div.innerHTML =
      '<div class="inner">' +
        '<div class="row center" style="justify-content:space-between;margin-bottom:10px">' +
          '<b>Лимит нейронки на сегодня</b><button class="toggle" id="limClose">Закрыть</button>' +
        "</div>" +
        '<div class="row center" style="gap:16px;margin-bottom:12px">' +
          App.aiRing({ size: 64, stroke: 6 }) +
          "<div>" +
            '<div class="big-stat">' + App.util.fmt(info.left) + '<span> / ' + App.util.fmt(info.limit) + "</span></div>" +
            '<div class="tiny muted">осталось токенов, обновится ночью</div>' +
          "</div>" +
        "</div>" +
        '<div class="bar" style="margin-bottom:14px"><i style="width:' + info.percent + '%"></i></div>' +
        '<div class="progress-row"><span>Тариф</span><span class="val">' + App.util.esc(plan.name) + "</span></div>" +
        '<div class="progress-row"><span>Дневной лимит тарифа</span><span class="val">' + App.util.fmt(plan.dailyTokens) + "</span></div>" +
        '<div class="progress-row"><span>Бонус за прогресс</span><span class="val">+' + App.util.fmt(ST.bonusTokens()) + "</span></div>" +
        '<div class="progress-row"><span>Запросов сегодня</span><span class="val">' + info.calls + "</span></div>" +
        '<h3 style="margin-top:16px">Расход по режимам</h3>' + modeRows +
        '<h3>Последние 7 дней</h3><div class="tiny muted" style="display:flex;gap:4px;align-items:flex-end;height:60px">' +
          hist.map(function (h) {
            var hh = Math.round((h.tokens / max) * 56) + 4;
            return '<div title="' + h.date + ": " + h.tokens + ' токенов" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end">' +
              '<div style="background:var(--accent);height:' + hh + 'px"></div></div>';
          }).join("") +
        "</div>" +
        '<div class="row" style="margin-top:16px">' +
          '<button class="btn sm" data-go="plans">Тарифы и лимиты</button>' +
          (info.left < info.limit * 0.1 ? '<button class="btn sm ghost" data-go="plans">Повысить лимит</button>' : "") +
        "</div>" +
      "</div>";
    document.body.appendChild(div);
    div.addEventListener("click", function (e) {
      if (e.target === div || e.target.id === "limClose") div.remove();
    });
  };

  /* ---------- панель чата ---------- */
  var panel = null;

  function mdLite(text) {
    var s = App.util.esc(text);
    s = s.replace(/```([\s\S]*?)```/g, function (all, code) { return "<pre>" + code.replace(/^\n/, "") + "</pre>"; });
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/\n/g, "<br>");
    return s;
  }

  function buildPanel() {
    var div = document.createElement("div");
    div.className = "ai-panel";
    div.id = "aiPanel";
    div.innerHTML =
      '<div class="ai-head">' +
        App.aiRing({ size: 24, stroke: 3 }) +
        '<div class="t"><b>Провожатый</b><span id="aiStatus"></span></div>' +
        '<button id="aiClearHist" title="Очистить переписку">Очистить</button>' +
        '<button id="aiMin" title="Свернуть">—</button>' +
      "</div>" +
      '<div class="ai-modes" id="aiModes"></div>' +
      '<div class="ai-msgs" id="aiMsgs"></div>' +
      '<div class="ai-suggest" id="aiSuggest"></div>' +
      '<div class="ai-foot">' +
        '<textarea id="aiInput" rows="1" placeholder="Спроси что-нибудь по теме урока…"></textarea>' +
        '<button class="send" id="aiSend">Спросить</button>' +
      "</div>" +
      '<div class="ai-info" id="aiInfo"></div>';
    document.body.appendChild(div);
    return div;
  }

  function modeButtons() {
    var modesBox = panel.querySelector("#aiModes");
    var plan = ST.planDef();
    var cur = AI.mode();
    modesBox.innerHTML = App.AI_MODES.map(function (m) {
      var allowed = plan.modes.indexOf(m.id) !== -1;
      var gate = App.canUseMode(m.id);
      var title = allowed ? m.desc : "Доступно на тарифе выше: " + m.name;
      return '<button class="ai-mode' + (m.id === cur ? " sel" : "") + '" data-mode="' + m.id + '"' +
        (allowed ? "" : " disabled") + ' title="' + App.util.esc(title) + '">' +
        m.name + " · " + App.util.fmt(m.cost) + "</button>";
    }).join("");
    modesBox.querySelectorAll("[data-mode]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-mode");
        if (!AI.setMode(id)) return;
        modeButtons();
        infoLine();
        addSys("Режим: " + App.AI_MODE(id).name + ". " + App.AI_MODE(id).desc);
      });
    });
  }

  function infoLine() {
    if (!panel) return;
    var info = App.usage.info();
    var mode = App.AI_MODE(AI.mode());
    panel.querySelector("#aiStatus").textContent = AI.configured()
      ? "DeepSeek · " + mode.name
      : "локальный разбор · ключа нет";
    panel.querySelector("#aiInfo").innerHTML =
      "Осталось " + App.util.fmt(info.left) + " токенов из " + App.util.fmt(info.limit) +
      " · запросов: " + info.calls + " · режим: " + mode.name;
    var ring = panel.querySelector(".ring-wrap");
    if (ring) ring.outerHTML = App.aiRing({ size: 24, stroke: 3 });
    var headBtn = document.getElementById("ringBtn");
    if (headBtn) headBtn.innerHTML = App.aiRing({ withText: true });
  }

  function addMsg(role, text) {
    var box = panel.querySelector("#aiMsgs");
    var d = document.createElement("div");
    d.className = "ai-msg " + role;
    if (role === "bot") d.innerHTML = "<b>Провожатый:</b><br>" + mdLite(text);
    else if (role === "user") d.textContent = text;
    else d.innerHTML = mdLite(text);
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
  }
  function addSys(text) {
    var box = panel.querySelector("#aiMsgs");
    var d = document.createElement("div");
    d.className = "ai-msg sys";
    d.textContent = text;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }

  function suggestions() {
    var box = panel.querySelector("#aiSuggest");
    var ctx = AI.context();
    var items = [];
    if (ctx.lesson) {
      items.push(["Объясни тему", "Объясни тему урока «" + ctx.lesson.title + "» простыми словами, 4 строки."]);
      items.push(["Разбери ошибку", "Какие типичные ошибки делают в теме «" + ctx.lesson.title + "» и как их не допустить?"]);
      items.push(["Дай 2 задачи", "Дай две задачи по теме «" + ctx.lesson.title + "» с ответами, коротко."]);
    } else {
      items.push(["Что дальше?", "Что мне учить дальше?"]);
      items.push(["План на неделю", "Составь короткий план подготовки к ОГЭ по информатике на неделю."]);
    }
    items.push(["Лимит", "Сколько токенов у меня осталось?"]);
    box.innerHTML = items.map(function (it, i) {
      return '<button data-i="' + i + '"><b>' + App.util.esc(it[0]) + "</b>" + App.util.esc(it[1].slice(0, 70)) + "…</button>";
    }).join("");
    box.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        var it = items[Number(b.getAttribute("data-i"))];
        panel.querySelector("#aiInput").value = it[1];
        send();
      });
    });
  }

  function send() {
    var input = panel.querySelector("#aiInput");
    var q = input.value.trim();
    if (!q) return;
    input.value = "";
    addMsg("user", q);
    panel.querySelector("#aiSuggest").innerHTML = "";

    if (/лимит|токен|сколько остал/i.test(q)) {
      var info = App.usage.info();
      addMsg("bot", "Сегодня осталось " + App.util.fmt(info.left) + " токенов из " + App.util.fmt(info.limit) +
        ". Запросов сделано: " + info.calls + ". Лимит обновится ночью, плюс капает бонус за пройденные уроки.");
      return;
    }

    var typing = addMsg("bot", "");
    typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    var btn = panel.querySelector("#aiSend");
    btn.disabled = true;

    var res = AI.ask(q, {
      onChunk: function (chunk, full) { typing.innerHTML = "<b>Провожатый:</b><br>" + mdLite(full); panel.querySelector("#aiMsgs").scrollTop = 1e9; }
    });

    if (res.error) {
      typing.remove();
      addMsg("bot", "⚠️ " + res.error.message);
      if (res.error.code === "PLAN" || res.error.code === "BUDGET") {
        var chips = document.createElement("div");
        chips.className = "chips";
        chips.innerHTML = '<button data-go="plans">Посмотреть тарифы</button>' +
          '<button id="aiDownMode">Переключить на «Эконом»</button>';
        panel.querySelector("#aiMsgs").appendChild(chips);
        var dm = chips.querySelector("#aiDownMode");
        if (dm) dm.addEventListener("click", function () { AI.setMode("eco"); modeButtons(); infoLine(); addSys("Режим: Эконом"); });
      }
      btn.disabled = false;
      return;
    }
    if (res.local) {
      typing.innerHTML = "<b>Провожатый:</b><br>" + mdLite(res.local ? res.text : "");
      infoLine();
      btn.disabled = false;
      return;
    }

    res.then(function (r) {
      typing.innerHTML = "<b>Провожатый:</b><br>" + mdLite(r.text);
      var meta = document.createElement("div");
      meta.className = "tiny muted";
      meta.style.marginTop = "6px";
      meta.textContent = "−" + App.util.fmt(r.usage.total) + " токенов · осталось " + App.util.fmt(r.left) + " · " + (r.ms / 1000).toFixed(1) + " с";
      typing.appendChild(meta);
      panel.querySelector("#aiMsgs").scrollTop = 1e9;
      infoLine();
      btn.disabled = false;
    }).catch(function (e) {
      typing.innerHTML = "<b>Провожатый:</b><br>⚠️ " + App.util.esc(e.message || String(e));
      btn.disabled = false;
    });
  }

  AI.renderHistory = function () {
    if (!panel) return;
    var box = panel.querySelector("#aiMsgs");
    box.innerHTML = "";
    var h = AI.history();
    if (!h.length) {
      var ctx = AI.context();
      addMsg("bot", AI.configured()
        ? "Привет! Я помогу разобраться с темой " + (ctx.lesson ? "«" + ctx.lesson.title + "»" : "и подскажу, что делать дальше") +
          ". Спрашивай коротко — отвечу коротко."
        : "Ключ DeepSeek не подключён, поэтому я работаю в простом режиме: объясню тему урока, покажу лайфхаки и ошибки.\nКлюч кладётся в файл config/deepseek-key.js — одна строка window.DEEPSEEK_API_KEY = \"sk-...\";");
    } else {
      h.forEach(function (m) { addMsg(m.role === "user" ? "user" : "bot", m.content); });
    }
  };

  AI.open = function () {
    if (!panel) {
      panel = buildPanel();
      panel.querySelector("#aiMin").addEventListener("click", function () { panel.classList.remove("show"); });
      panel.querySelector("#aiClearHist").addEventListener("click", function () {
        AI.clearHistory(); AI.renderHistory(); addSys("Переписка очищена (лимит токенов уже потрачен и не возвращается).");
      });
      panel.querySelector("#aiSend").addEventListener("click", send);
      panel.querySelector("#aiInput").addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
      });
      AI.renderHistory();
    }
    panel.classList.add("show");
    modeButtons();
    infoLine();
    suggestions();
    setTimeout(function () {
      var i = panel.querySelector("#aiInput");
      if (i && window.innerWidth > 900) i.focus();
    }, 60);
  };

  AI.toggle = function () {
    var p = document.getElementById("aiPanel");
    if (p && p.classList.contains("show")) p.classList.remove("show");
    else AI.open();
  };

  AI.afterRender = function () {
    var fab = document.getElementById("aiFab");
    if (!fab) {
      fab = document.createElement("button");
      fab.className = "ai-fab";
      fab.id = "aiFab";
      fab.innerHTML = '<span class="dot' + (AI.configured() ? "" : " off") + '"></span> Провожатый';
      fab.addEventListener("click", function () { AI.toggle(); });
      document.body.appendChild(fab);
    }
    if (panel) { modeButtons(); infoLine(); }
  };
})();
