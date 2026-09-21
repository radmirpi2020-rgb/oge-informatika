/* admin.js — админка: пароль, уроки (правки поверх базы), AI, доступ ученика, бэкап, редполитика */
(function () {
  "use strict";

  var AP = App.admin;
  AP.tab = "lessons";
  AP.editId = null;
  AP.msg = "";

  function login() {
    return '<div class="kicker">Админка</div><h2>Вход</h2>' +
      '<p class="lead">Пароль по умолчанию — <b>admin</b>. Смени его сразу после входа.</p>' +
      '<div class="card" style="max-width:420px">' +
        '<div class="field"><label>Пароль</label><input type="password" id="admPass"></div>' +
        '<div class="row"><button class="btn" id="admLogin">Войти</button></div>' +
        '<div id="admErr" class="tiny" style="color:var(--err);margin-top:8px"></div>' +
      "</div>";
  }

  function tabs() {
    var items = [["lessons", "Уроки"], ["ai", "AI и лимиты"], ["student", "Ученик"], ["backup", "Бэкап"], ["help", "Справка"]];
    return '<div class="admin-tabs">' + items.map(function (t) {
      return '<button data-tab="' + t[0] + '"' + (AP.tab === t[0] ? ' class="active"' : "") + ">" + t[1] + "</button>";
    }).join("") + "</div>";
  }

  function lessonsTab() {
    var courseId = App.course.current();
    var courseDef = App.course.currentDef();
    var all = ST.allLessons(courseId);
    var ov = AP.overrides();
    var del = AP.deleted();
    var html = App.course.tabsHtml("compact") +
      '<div class="row" style="margin-bottom:14px">' +
      '<button class="btn sm" id="admAddLesson">+ Добавить урок</button>' +
      '<button class="btn sm ghost" id="admRestore">Вернуть базовые уроки (' + App.LESSONS.length + ")</button>" +
      '<button class="btn sm ghost" data-go="lessons">Посмотреть как ученик</button>' +
    "</div>";
    if (AP.msg) html += '<div class="alert ok">' + App.util.esc(AP.msg) + "</div>";

    /* контент живёт в базе (Payload + PostgreSQL) — править его надо в админке Payload */
    if (App.api && App.api.enabled) {
      var apiBase = App.api.base || "";
      html += '<div class="alert soft">Контент загружен из базы: <b>' +
        App.util.esc(App.dataSourceNote || apiBase) + '</b>.<br>' +
        'Уроки, модули и курсы редактируются в админке Payload: ' +
        '<a href="' + App.util.esc(apiBase) + '/admin" target="_blank" rel="noopener">' + App.util.esc(apiBase) + '/admin</a>. ' +
        'Правки здесь (в браузере) остаются локальными и базу не меняют. ' +
        'После правок в базе: <code>node tools/export-from-payload.js</code>, чтобы обновить снимок для офлайна.</div>';
    }

    html += '<div class="field"><input type="text" id="admSearch" placeholder="Поиск по названию или номеру"></div>';
    html += '<div class="tiny muted" style="margin-bottom:10px">Курс «' + App.util.esc(courseDef.name) + '»: ' + all.length +
      " элементов. Всего на сайте " + App.LESSONS.length +
      " · правок: " + Object.keys(ov).length + " · скрыто: " + del.length + "</div>";

    all.slice(0, 400).forEach(function (l) {
      var changed = !!ov[l.id];
      html += '<div class="admin-lesson-row' + (l.kind === "practice" ? " practice" : "") + '" data-search="' +
        App.util.esc((l.id + " " + l.title + " " + (l.sub || "")).toLowerCase()) + '">' +
        '<span class="num">' + App.util.pad(l.id, 3) + "</span>" +
        '<div class="info"><h4>' + App.util.esc(l.title) + (changed ? ' <span class="badge accent">правка</span>' : "") + "</h4>" +
        '<div class="sub">' + App.util.esc(l.module || "") + " · " + App.util.esc(l.sub || "") +
        " · задач: " + ((l.tasks || []).length) + (l.practice ? " · практика: " + l.practice.engine : "") + "</div></div>" +
        '<div class="tools">' +
          '<button class="tool-btn" data-view="' + l.id + '" title="Открыть">👁</button>' +
          '<button class="tool-btn" data-edit="' + l.id + '" title="Редактировать">✎</button>' +
          '<button class="tool-btn danger" data-del="' + l.id + '" title="Скрыть">✕</button>' +
        "</div></div>";
    });
    return html;
  }

  function editor(id) {
    var l = ST.lesson(id);
    if (!l) return '<div class="alert err">Урок не найден.</div>';
    return '<button class="back" id="admBack">← К списку</button>' +
      '<h2>Редактор: №' + l.id + "</h2>" +
      '<div class="card">' +
        '<div class="field"><label>Название</label><input type="text" id="edTitle" value="' + App.util.esc(l.title) + '"></div>' +
        '<div class="field"><label>Подзаголовок</label><input type="text" id="edSub" value="' + App.util.esc(l.sub || "") + '"></div>' +
        '<div class="row">' +
          '<div class="field" style="flex:1"><label>Модуль</label><input type="text" id="edModule" value="' + App.util.esc(l.module || "") + '"></div>' +
          '<div class="field" style="flex:1"><label>Минут</label><input type="number" id="edMin" value="' + (l.minutes || 7) + '" min="1" max="120"></div>' +
          '<div class="field" style="flex:1"><label>Тип</label><select id="edKind">' +
            '<option value="lesson"' + (l.kind !== "practice" ? " selected" : "") + ">урок</option>" +
            '<option value="practice"' + (l.kind === "practice" ? " selected" : "") + ">практика</option>" +
          "</select></div>" +
        "</div>" +
        '<div class="field"><label>Теория (разметка как в уроках: **жирный**, ~~~ пример ~~~, &gt; лайфхак, !! ошибка)</label>' +
          '<div class="md-toolbar">' +
            '<button class="md-btn" data-md="b" title="Жирный (Ctrl+B)"><b>Ж</b></button>' +
            '<button class="md-btn" data-md="i" title="Курсив (Ctrl+I)"><i>К</i></button>' +
            '<button class="md-btn" data-md="code" title="Код"><span class="mono">&lt;/&gt;</span></button>' +
            '<span class="md-sep"></span>' +
            '<button class="md-btn" data-md="hack">Лайфхак</button>' +
            '<button class="md-btn" data-md="err">Ошибка</button>' +
            '<button class="md-btn" data-md="ex">Пример</button>' +
          "</div>" +
          '<textarea id="edTheory">' + App.util.esc(l.theory || "") + "</textarea>" +
          '<details class="theory-preview-wrap"><summary>Живой предпросмотр</summary><div class="theory-preview" id="edPreview"></div></details>' +
        "</div>" +
        '<div class="row"><button class="btn" id="edSave">Сохранить правку</button>' +
          '<button class="btn ghost" id="edCancel">Отмена</button>' +
          '<button class="btn danger" id="edReset">Вернуть исходный текст</button></div>' +
      "</div>" +
      '<div class="card"><div class="kicker">Задачи (' + ((l.tasks || []).length) + ")</div>" +
        ((l.tasks || []).map(function (t, i) {
          return '<div class="progress-row"><span>' + (i + 1) + ". " + App.util.esc(String(t.q).slice(0, 90)) + "</span>" +
            '<span class="val">' + t.type + " · ответ: " + App.util.esc(String(t.answer)) + "</span></div>";
        }).join("") || '<div class="tiny muted">Задач нет — это практика.</div>') +
        '<div class="tiny muted" style="margin-top:10px">Задачи правятся в файлах уроков: data/lessons/*.js — так они не потеряются при смене устройства.</div>' +
      "</div>";
  }

  function aiTab() {
    var info = App.usage.info();
    var plan = ST.planDef();
    var key = App.storage.get(App.storage.KEYS.aiKeyOverride, "");
    var html = '<div class="card"><div class="kicker">Подключение</div>' +
      '<div class="progress-row"><span>Статус</span><span class="val">' +
        (App.ai.configured() ? "ключ есть" : "ключа нет") + "</span></div>" +
      '<div class="progress-row"><span>Источник ключа</span><span class="val">' + App.util.esc(App.ai.keySource()) + "</span></div>" +
      '<div class="progress-row"><span>Модель</span><span class="val">' +
        App.util.esc(App.storage.get("oge_ai_model", App.ai.CONFIG.model)) + "</span></div>" +
      '<div class="field" style="margin-top:14px"><label>Ключ DeepSeek (перекроет файл config/deepseek-key.js в этом браузере)</label>' +
        '<input type="password" id="admKey" value="' + App.util.esc(key) + '" placeholder="sk-..."></div>' +
      '<div class="field"><label>Модель</label><input type="text" id="admModel" value="' +
        App.util.esc(App.storage.get("oge_ai_model", App.ai.CONFIG.model)) + '"></div>' +
      '<div class="field"><label>Адрес API (если поставишь свой прокси — вставь его сюда)</label><input type="text" id="admEndpoint" value="' +
        App.util.esc(App.storage.get("oge_ai_endpoint", App.ai.CONFIG.endpoint)) + '"></div>' +
      '<div class="row"><button class="btn sm" id="admSaveAi">Сохранить</button>' +
        '<button class="btn sm ghost" id="admTestAi">Проверить связь</button>' +
        '<button class="btn sm danger" id="admClearKey">Убрать ключ из браузера</button></div>' +
      '<div id="admAiMsg" class="tiny" style="margin-top:10px"></div>' +
    "</div>";

    html += '<div class="card"><div class="kicker">Лимиты</div>' +
      '<div class="progress-row"><span>Тариф</span><span class="val">' + App.util.esc(plan.name) +
        (App.planAI(plan) ? "" : " (без нейронки)") + "</span></div>" +
      '<div class="progress-row"><span>Дневной лимит</span><span class="val">' +
        (App.planAI(plan) ? App.util.fmt(plan.dailyTokens) + " токенов" : "нейронка не входит") + "</span></div>" +
      '<div class="progress-row"><span>Бонус за прогресс</span><span class="val">+' + App.util.fmt(ST.bonusTokens()) + "</span></div>" +
      '<div class="progress-row"><span>Использовано сегодня</span><span class="val">' + App.util.fmt(info.used) + " (" + info.calls + " запросов)</span></div>" +
      '<div class="row" style="margin-top:12px">' +
        App.PLANS.map(function (p) {
          return '<button class="btn sm' + (p.id === plan.id ? "" : " ghost") + '" data-setplan="' + p.id + '">' +
            App.util.esc(p.name) + (p.price ? " · " + p.price + " ₽" : "") + "</button>";
        }).join("") +
        '<button class="btn sm ghost" id="admResetUsage">Сбросить расход дня</button>' +
      "</div>" +
      '<div class="tiny muted" style="margin-top:10px">Расход считается по ответам модели: prompt + completion. Кружок в шапке показывает остаток, ' +
      "а в тарифах без нейронки вместо кружка стоит прочерк.</div>" +
    "</div>";

    html += '<div class="card"><div class="kicker">Промокоды</div>' +
      '<div class="progress-row"><span>FULL30</span><span class="val">Полный курс на 30 дней</span></div>' +
      '<div class="progress-row"><span>MAX30</span><span class="val">Максимум на 30 дней</span></div>' +
      '<div class="progress-row"><span>SCHOOL</span><span class="val">Максимум на 90 дней</span></div>' +
      '<div class="tiny muted">Активируются учеником на странице «Тарифы». Меняются в scripts/pages/plans.js в объекте PROMOS.</div>' +
    "</div>";

    html += '<div class="card"><div class="kicker">Расход за 7 дней</div>' +
      App.usage.history(7).map(function (h) {
        return '<div class="progress-row"><span>' + h.date + "</span><span class=\"val\">" +
          App.util.fmt(h.tokens) + " токенов · " + h.calls + " запросов</span></div>";
      }).join("") +
    "</div>";
    return html;
  }

  function studentTab() {
    var s = ST.summary();
    var html = '<div class="stat-grid">' +
      '<div class="stat-box"><div class="n">' + s.percent + "%</div><div class=\"l\">курса</div></div>" +
      '<div class="stat-box"><div class="n">' + s.finished + "</div><div class=\"l\">элементов из " + s.total + "</div></div>" +
      '<div class="stat-box"><div class="n">' + s.tasksDone + "</div><div class=\"l\">задач верно</div></div>" +
      '<div class="stat-box"><div class="n">' + s.streak + "</div><div class=\"l\">дней подряд</div></div>" +
    "</div>";
    html += '<div class="card"><div class="kicker">По модулям</div>';
    Object.keys(s.byModule).forEach(function (m) {
      var b = s.byModule[m];
      html += '<div class="progress-row"><span>' + App.util.esc(m) + "</span><span class=\"val\">" +
        b.finished + " / " + b.total + "</span></div>";
    });
    html += "</div>";

    var wrong = [];
    ST.allLessons().forEach(function (l) {
      (l.tasks || []).forEach(function (t) {
        var a = ST.answerOf(t.id);
        if (a && !a.ok) wrong.push({ l: l, t: t, v: a.v });
      });
    });
    html += '<div class="card"><div class="kicker">Ошибки (' + wrong.length + ")</div>" +
      (wrong.slice(0, 25).map(function (w) {
        return '<div class="progress-row"><span>' + App.util.esc(String(w.t.q).slice(0, 70)) + "</span>" +
          '<span class="val">ответил: ' + App.util.esc(String(w.v).slice(0, 20)) + " · верно: " + App.util.esc(String(w.t.answer)) + "</span></div>";
      }).join("") || '<div class="tiny muted">Ошибок нет.</div>') +
    "</div>";

    html += '<div class="card"><div class="kicker">Активность</div>' +
      (ST.activity().slice(-20).reverse().map(function (a) {
        return '<div class="progress-row"><span>' + a.d + "</span><span class=\"val\">элемент №" + a.id + "</span></div>";
      }).join("") || '<div class="tiny muted">Пока пусто.</div>') +
    "</div>";
    return html;
  }

  function backupTab() {
    var html = '<div class="card"><div class="kicker">Данные</div>' +
      '<p class="tiny muted">Всё хранится в браузере (localStorage). Для переноса на другое устройство — выгрузи файл.</p>' +
      '<div class="row"><button class="btn sm" id="admExport">Экспорт всех данных</button>' +
      '<label class="btn sm ghost" style="cursor:pointer">Импорт<input type="file" id="admImport" accept="application/json" style="display:none"></label>' +
      '<button class="btn sm danger" id="admResetProgress">Сбросить прогресс ученика</button>' +
      '<button class="btn sm danger" id="admResetAi">Сбросить расход токенов</button>' +
      '<button class="btn sm danger" id="admResetAll">Полный сброс</button></div>' +
      '<div id="admBkMsg" class="tiny" style="margin-top:10px"></div>' +
    "</div>";
    html += '<div class="card"><div class="kicker">Пароль админки</div>' +
      '<div class="field"><label>Новый пароль</label><input type="password" id="admNewPass"></div>' +
      '<div class="row"><button class="btn sm" id="admSavePass">Сменить пароль</button>' +
        '<button class="btn sm ghost" id="admLogout">Выйти</button></div>' +
      '<div class="tiny muted" style="margin-top:8px">Пароль хранится в браузере. Это защита от случайных правок, а не от взлома: для живого сайта нужен сервер.</div>' +
    "</div>";
    return html;
  }

  function helpTab() {
    return '<div class="card"><div class="kicker">Как это устроено</div>' +
      '<div class="progress-row"><span>Уроки и задачи</span><span class="val">data/lessons/module-*.js</span></div>' +
      '<div class="progress-row"><span>Правки из админки</span><span class="val">localStorage (oge_lessons_custom)</span></div>' +
      '<div class="progress-row"><span>Тарифы и лимиты</span><span class="val">data/plans.js</span></div>' +
      '<div class="progress-row"><span>Нейронка</span><span class="val">scripts/ai/ai.js + ai-panel.js</span></div>' +
      '<div class="progress-row"><span>Ключ DeepSeek</span><span class="val">config/deepseek-key.js</span></div>' +
      '<div class="progress-row"><span>Практики</span><span class="val">scripts/practice/*</span></div>' +
    "</div>" +
    '<div class="card"><div class="kicker">Что делать перед живым запуском</div>' +
      '<ol style="padding-left:20px;font-size:14px;line-height:1.8">' +
        "<li>Спрятать ключ DeepSeek за прокси на своём сервере (иначе его заберут из кода страницы).</li>" +
        "<li>Добавить авторизацию и хранение прогресса на сервере, а не в браузере.</li>" +
        "<li>Подключить платежи (ЮKassa, CloudPayments) и вебхук, который включает тариф.</li>" +
        "<li>Проверить тексты уроков учителем-предметником: сейчас они сгенерированы и вычитаны, но проверка человеком обязательна.</li>" +
        "<li>Позиционировать как помощника: «готовит черновики, проверяет человек» — ответственность за результат экзамена на себя не брать.</li>" +
      "</ol></div>" +
    '<div class="card"><div class="kicker">Тексты</div><div class="tiny muted">Все тексты уроков лежат в data/lessons. Правь прямо в файлах — сайт подхватит после обновления страницы, сборка не нужна.</div></div>';
  }

  App.router.register("admin", {
    view: function () {
      if (!AP.hasSession()) return login();
      var body;
      if (AP.editId != null) body = editor(AP.editId);
      else if (AP.tab === "ai") body = aiTab();
      else if (AP.tab === "student") body = studentTab();
      else if (AP.tab === "backup") body = backupTab();
      else if (AP.tab === "help") body = helpTab();
      else body = lessonsTab();

      var head = '<div class="row center" style="justify-content:space-between;margin-bottom:12px">' +
        '<div><div class="kicker">Админка</div><h2 style="margin:0">Управление сайтом</h2></div>' +
        '<button class="btn sm ghost" id="admExit">Выйти</button></div>';
      return head + (AP.editId != null ? body : tabs() + body);
    },

    bind: function () {
      var pass = document.getElementById("admPass");
      if (pass) {
        var go = function () {
          if (AP.login(pass.value)) { AP.msg = ""; App.router.render(); }
          else document.getElementById("admErr").textContent = "Неверный пароль.";
        };
        document.getElementById("admLogin").addEventListener("click", go);
        pass.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
        return;
      }

      var exit = document.getElementById("admExit");
      if (exit) exit.addEventListener("click", function () { AP.logout(); App.router.render(); });

      document.querySelectorAll("[data-tab]").forEach(function (b) {
        b.addEventListener("click", function () { AP.tab = b.getAttribute("data-tab"); AP.msg = ""; App.router.render(); });
      });

      /* --- список уроков --- */
      document.querySelectorAll("[data-edit]").forEach(function (b) {
        b.addEventListener("click", function () { AP.editId = Number(b.getAttribute("data-edit")); App.router.render(); });
      });
      document.querySelectorAll("[data-view]").forEach(function (b) {
        b.addEventListener("click", function () { App.router.go("lesson", b.getAttribute("data-view")); });
      });
      document.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = Number(b.getAttribute("data-del"));
          if (!confirm("Скрыть элемент №" + id + " у учеников?")) return;
          AP.removeLesson(id);
          AP.msg = "Элемент №" + id + " скрыт.";
          App.router.render();
        });
      });
      var add = document.getElementById("admAddLesson");
      if (add) add.addEventListener("click", function () {
        var id = AP.nextId();
        AP.addLesson({
          id: id, module: "Свой урок", title: "Новый урок", sub: "Заполни название и теорию",
          kind: "lesson", minutes: 8, theory: "**Текст урока**\n\n> **Лайфхак.** \n\n!! **Ошибка.** ", tasks: []
        });
        AP.editId = id;
        App.router.render();
      });
      var restore = document.getElementById("admRestore");
      if (restore) restore.addEventListener("click", function () {
        if (!confirm("Вернуть все исходные уроки и удалить правки?")) return;
        AP.restoreAll();
        AP.msg = "Базовые уроки восстановлены.";
        App.router.render();
      });
      var search = document.getElementById("admSearch");
      if (search) search.addEventListener("input", function () {
        var q = search.value.toLowerCase().trim();
        document.querySelectorAll(".admin-lesson-row").forEach(function (row) {
          var hay = row.getAttribute("data-search") || "";
          row.style.display = !q || hay.indexOf(q) !== -1 ? "" : "none";
        });
      });

      /* --- редактор --- */
      var editBack = document.getElementById("admBack");
      if (editBack) editBack.addEventListener("click", function () { AP.editId = null; App.router.render(); });
      var save = document.getElementById("edSave");
      if (save) {
        var ta = document.getElementById("edTheory");
        var prev = document.getElementById("edPreview");
        var refresh = function () { prev.innerHTML = App.md.theory(ta.value); };
        refresh();
        ta.addEventListener("input", refresh);
        ta.addEventListener("keydown", function (e) {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
            e.preventDefault();
            wrap(ta, "**", "**", "жирный");
          }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
            e.preventDefault();
            wrap(ta, "*", "*", "курсив");
          }
        });
        document.querySelectorAll("[data-md]").forEach(function (b) {
          b.addEventListener("click", function () {
            var act = b.getAttribute("data-md");
            if (act === "b") wrap(ta, "**", "**", "жирный");
            else if (act === "i") wrap(ta, "*", "*", "курсив");
            else if (act === "code") wrap(ta, "`", "`", "код");
            else if (act === "hack") prefix(ta, "> **Лайфхак.** ");
            else if (act === "err") prefix(ta, "!! **Ошибка.** ");
            else if (act === "ex") block(ta, "~~~\n", "\n~~~");
            refresh();
          });
        });
        save.addEventListener("click", function () {
          AP.patch(AP.editId, {
            title: document.getElementById("edTitle").value,
            sub: document.getElementById("edSub").value,
            module: document.getElementById("edModule").value,
            minutes: Number(document.getElementById("edMin").value) || 7,
            kind: document.getElementById("edKind").value,
            theory: ta.value
          });
          AP.msg = "Правка сохранена (урок №" + AP.editId + ").";
          AP.editId = null;
          App.router.render();
        });
        document.getElementById("edCancel").addEventListener("click", function () { AP.editId = null; App.router.render(); });
        document.getElementById("edReset").addEventListener("click", function () {
          var base = null;
          App.LESSONS.forEach(function (l) { if (l.id === AP.editId) base = l; });
          if (!base) { alert("Этот урок создан вручную — вернуть нечего."); return; }
          var ov = AP.overrides();
          delete ov[AP.editId];
          AP.saveOverrides(ov);
          AP.msg = "Правка урока №" + AP.editId + " отменена.";
          App.router.render();
        });
      }

      /* --- AI --- */
      var saveAi = document.getElementById("admSaveAi");
      if (saveAi) saveAi.addEventListener("click", function () {
        var k = document.getElementById("admKey").value.trim();
        if (k) App.storage.set(App.storage.KEYS.aiKeyOverride, k);
        App.storage.set("oge_ai_model", document.getElementById("admModel").value.trim() || App.ai.CONFIG.model);
        App.storage.set("oge_ai_endpoint", document.getElementById("admEndpoint").value.trim() || App.ai.CONFIG.endpoint);
        document.getElementById("admAiMsg").textContent = "Сохранено. Ключ: " + App.ai.keySource() + ".";
      });
      var testAi = document.getElementById("admTestAi");
      if (testAi) testAi.addEventListener("click", function () {
        var msg = document.getElementById("admAiMsg");
        if (!App.ai.configured()) { msg.innerHTML = '<span style="color:var(--err)">Ключа нет — сохрани ключ выше или положи его в config/deepseek-key.js.</span>'; return; }
        msg.textContent = "Проверяю связь…";
        App.ai.chat([{ role: "user", content: "Ответь одним словом: работает" }], "eco", null).then(function (r) {
          msg.innerHTML = '<span style="color:var(--ok)">Связь есть. Ответ: ' + App.util.esc(r.text.slice(0, 60)) +
            " · токенов: " + (r.usage.total) + "</span>";
        }).catch(function (e) {
          msg.innerHTML = '<span style="color:var(--err)">Ошибка: ' + App.util.esc(e.message) + "</span>";
        });
      });
      var clearKey = document.getElementById("admClearKey");
      if (clearKey) clearKey.addEventListener("click", function () {
        App.storage.del(App.storage.KEYS.aiKeyOverride);
        document.getElementById("admAiMsg").textContent = "Ключ убран из браузера. Источник: " + App.ai.keySource() + ".";
      });
      document.querySelectorAll("[data-setplan]").forEach(function (b) {
        b.addEventListener("click", function () {
          ST.setPlan(b.getAttribute("data-setplan"));
          App.storage.del(App.storage.KEYS.aiMode);
          App.router.render();
        });
      });
      var resetUsage = document.getElementById("admResetUsage");
      if (resetUsage) resetUsage.addEventListener("click", function () {
        App.storage.del(App.storage.KEYS.usage);
        App.router.render();
      });

      /* --- бэкап --- */
      var exp = document.getElementById("admExport");
      if (exp) exp.addEventListener("click", function () {
        var blob = new Blob([JSON.stringify(App.storage.exportAll(), null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "oge-backup-" + App.util.today() + ".json";
        a.click();
      });
      var imp = document.getElementById("admImport");
      if (imp) imp.addEventListener("change", function () {
        var f = imp.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () {
          try {
            var n = App.storage.importAll(JSON.parse(r.result));
            document.getElementById("admBkMsg").textContent = "Загружено записей: " + n + ". Обновляю…";
            setTimeout(function () { location.reload(); }, 700);
          } catch (e) { document.getElementById("admBkMsg").textContent = "Ошибка: " + e.message; }
        };
        r.readAsText(f);
      });
      var rp = document.getElementById("admResetProgress");
      if (rp) rp.addEventListener("click", function () {
        if (!confirm("Сбросить прогресс ученика?")) return;
        ST.reset("progress");
        App.router.render();
      });
      var ra = document.getElementById("admResetAi");
      if (ra) ra.addEventListener("click", function () {
        if (!confirm("Сбросить расход токенов?")) return;
        ST.reset("ai");
        App.router.render();
      });
      var rall = document.getElementById("admResetAll");
      if (rall) rall.addEventListener("click", function () {
        if (!confirm("Полный сброс: прогресс, правки уроков, расход, переписка. Продолжить?")) return;
        ST.reset("all");
        AP.restoreAll();
        AP.logout();
        App.router.go("home");
      });
      var sp = document.getElementById("admSavePass");
      if (sp) sp.addEventListener("click", function () {
        var v = document.getElementById("admNewPass").value;
        if (v.length < 4) { alert("Пароль слишком короткий."); return; }
        AP.setPass(v);
        alert("Пароль изменён. Запомни его: восстановления нет.");
      });
      var lo = document.getElementById("admLogout");
      if (lo) lo.addEventListener("click", function () { AP.logout(); App.router.render(); });

      /* --- текстовая разметка --- */
      function wrap(ta, before, after, ph) {
        var s = ta.selectionStart, e = ta.selectionEnd;
        var sel = ta.value.slice(s, e) || ph;
        ta.value = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e);
        ta.selectionStart = s + before.length;
        ta.selectionEnd = s + before.length + sel.length;
        ta.focus();
      }
      function prefix(ta, text) {
        var s = ta.selectionStart;
        var ls = ta.value.lastIndexOf("\n", s - 1) + 1;
        ta.value = ta.value.slice(0, ls) + text + ta.value.slice(ls);
        ta.focus();
      }
      function block(ta, before, after) {
        var s = ta.selectionStart, e = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + before + ta.value.slice(s, e) + after + ta.value.slice(e);
        ta.focus();
      }
    }
  });
})();
