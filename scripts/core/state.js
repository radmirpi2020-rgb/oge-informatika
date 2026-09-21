/* state.js — прогресс ученика, ответы, тариф, серия дней */
(function () {
  "use strict";

  var ST = App.state = {};
  /* страницы и нейронка обращаются к состоянию как к ST, поэтому выкладываем его в window */
  window.ST = ST;

  ST.answers = App.storage.get(App.storage.KEYS.answers, {}) || {};
  ST.completed = App.storage.get(App.storage.KEYS.completed, {}) || {};
  ST.test = App.storage.get(App.storage.KEYS.test, null);
  ST.plan = App.storage.get(App.storage.KEYS.plan, "free") || "free";
  ST.promo = App.storage.get(App.storage.KEYS.promo, null);
  ST.practice = App.storage.get(App.storage.KEYS.practice, {}) || {};

  ST.saveAnswers = function () { App.storage.set(App.storage.KEYS.answers, ST.answers); };
  ST.saveCompleted = function () { App.storage.set(App.storage.KEYS.completed, ST.completed); };
  ST.saveTest = function () { App.storage.set(App.storage.KEYS.test, ST.test); };
  ST.savePlan = function () { App.storage.set(App.storage.KEYS.plan, ST.plan); };
  ST.savePractice = function () { App.storage.set(App.storage.KEYS.practice, ST.practice); };

  /* ---------- доступ к урокам ---------- */

  ST.overrides = function () { return App.storage.get(App.storage.KEYS.lessons, {}) || {}; };

  /** урок с учётом правок из админки */
  ST.lesson = function (id) {
    id = Number(id);
    var base = null;
    for (var i = 0; i < App.LESSONS.length; i++) if (App.LESSONS[i].id === id) { base = App.LESSONS[i]; break; }
    var ov = ST.overrides()[id];
    if (!base && ov) return ov;
    if (!base) return null;
    if (!ov) return base;
    var merged = {};
    Object.keys(base).forEach(function (k) { merged[k] = base[k]; });
    Object.keys(ov).forEach(function (k) { merged[k] = ov[k]; });
    return merged;
  };

  /** видимый список уроков: базовые + добавленные вручную − удалённые.
      course — "base", "oge" или ничего (все курсы сразу). */
  ST.allLessons = function (course) {
    var ov = ST.overrides();
    var deleted = App.storage.get("oge_lessons_deleted", []) || [];
    var list = [];
    App.LESSONS.forEach(function (l) {
      if (deleted.indexOf(l.id) !== -1) return;
      if (course && App.course.ofLesson(l) !== course) return;
      list.push(ST.lesson(l.id));
    });
    Object.keys(ov).forEach(function (k) {
      var id = Number(k);
      var exists = App.LESSONS.some(function (l) { return l.id === id; });
      if (exists || deleted.indexOf(id) !== -1) return;
      if (course && App.course.ofLesson(ov[k]) !== course) return;
      list.push(ov[k]);
    });
    list.sort(function (a, b) { return a.id - b.id; });
    return list;
  };

  ST.lessonIndex = function (id, course) {
    var list = ST.allLessons(course);
    for (var i = 0; i < list.length; i++) if (list[i].id === Number(id)) return i;
    return -1;
  };

  /* ---------- ответы и завершение ---------- */

  ST.markAnswer = function (taskId, ok, value) {
    ST.answers[taskId] = { ok: !!ok, v: value == null ? "" : String(value).slice(0, 120), at: Date.now() };
    ST.saveAnswers();
  };

  ST.answerOf = function (taskId) { return ST.answers[taskId] || null; };

  ST.lessonStats = function (lesson) {
    if (!lesson) return { total: 0, done: 0, percent: 0, finished: false };
    var tasks = lesson.tasks || [];
    var done = 0;
    tasks.forEach(function (t) { var a = ST.answers[t.id]; if (a && a.ok) done++; });
    var finished = !!ST.completed[lesson.id];
    var percent = tasks.length ? Math.round(done / tasks.length * 100) : (finished ? 100 : 0);
    return { total: tasks.length, done: done, percent: percent, finished: finished };
  };

  ST.finishLesson = function (id) {
    ST.completed[id] = { at: Date.now() };
    ST.saveCompleted();
    ST.touchStreak();
    ST.pushActivity(id);
    /* запоминаем раздел: при следующем входе в список уроков он будет раскрыт */
    var l = ST.lesson(id);
    if (l) ST.rememberModule(l.course || "base", l.module);
  };

  /* ---------- активность и серия дней ---------- */

  ST.pushActivity = function (lessonId) {
    var log = App.storage.get("oge_activity", []) || [];
    log.push({ d: App.util.today(), id: lessonId, at: Date.now() });
    if (log.length > 500) log = log.slice(-500);
    App.storage.set("oge_activity", log);
  };

  ST.activity = function () { return App.storage.get("oge_activity", []) || []; };

  /* ---------- последний раздел (модуль), в котором работал ученик ----------

     Нужен для списка уроков: разделы там свёрнуты, и открывается тот,
     в котором ученик работал последним, а не всегда первый. */

  function lastModuleKey(course) { return "oge_last_module_" + (course || "base"); }

  ST.lastModule = function (course) {
    return App.storage.get(lastModuleKey(course), "") || "";
  };

  ST.rememberModule = function (course, moduleName) {
    if (!moduleName) return;
    App.storage.set(lastModuleKey(course), String(moduleName));
    /* в сессии держим все открытые разделы — чтобы ученик мог раскрыть несколько */
    var open = ST.openModules();
    if (open.indexOf(String(moduleName)) === -1) open.push(String(moduleName));
    ST.setOpenModules(open);
  };

  /** открытые вручную разделы текущей сессии */
  ST.openModules = function () {
    try { return JSON.parse(sessionStorage.getItem("oge_open_modules") || "[]") || []; }
    catch (e) { return []; }
  };

  ST.setOpenModules = function (list) {
    try { sessionStorage.setItem("oge_open_modules", JSON.stringify((list || []).slice(-20))); }
    catch (e) { /* приватный режим — просто не запоминаем */ }
  };

  /** забыть последний раздел: тогда список снова откроет первый */
  ST.forgetLastModule = function (course) {
    App.storage.del(lastModuleKey(course));
  };

  ST.forgetModules = function () { ST.setOpenModules([]); };

  ST.touchStreak = function () {
    var today = App.util.today();
    var last = App.storage.get(App.storage.KEYS.streakDay, null);
    var streak = App.storage.get(App.storage.KEYS.streak, 0) || 0;
    if (last === today) return streak;
    var y = new Date(); y.setDate(y.getDate() - 1);
    var yStr = y.getFullYear() + "-" + App.util.pad(y.getMonth() + 1, 2) + "-" + App.util.pad(y.getDate(), 2);
    streak = (last === yStr) ? streak + 1 : 1;
    App.storage.set(App.storage.KEYS.streakDay, today);
    App.storage.set(App.storage.KEYS.streak, streak);
    return streak;
  };

  ST.streak = function () {
    var today = App.util.today();
    var last = App.storage.get(App.storage.KEYS.streakDay, null);
    if (!last) return 0;
    if (last === today) return App.storage.get(App.storage.KEYS.streak, 0) || 0;
    var y = new Date(); y.setDate(y.getDate() - 1);
    var yStr = y.getFullYear() + "-" + App.util.pad(y.getMonth() + 1, 2) + "-" + App.util.pad(y.getDate(), 2);
    return last === yStr ? (App.storage.get(App.storage.KEYS.streak, 0) || 0) : 0;
  };

  /* ---------- сводка прогресса ---------- */

  /** сводка прогресса. course — "base", "oge" или ничего (все курсы вместе) */
  ST.summary = function (course) {
    var list = ST.allLessons(course);
    var lessons = 0, practices = 0, tasksTotal = 0, tasksDone = 0, finished = 0, minutes = 0;
    list.forEach(function (l) {
      if (l.kind === "practice") practices++; else lessons++;
      var s = ST.lessonStats(l);
      tasksTotal += s.total; tasksDone += s.done;
      if (s.finished) finished++;
      minutes += l.minutes || 7;
    });
    var percent = list.length ? Math.round(finished / list.length * 100) : 0;
    var byModule = {};
    list.forEach(function (l) {
      var m = l.module || "Прочее";
      if (!byModule[m]) byModule[m] = { total: 0, finished: 0, tasks: 0, tasksDone: 0 };
      byModule[m].total++;
      var s = ST.lessonStats(l);
      byModule[m].tasks += s.total; byModule[m].tasksDone += s.done;
      if (s.finished) byModule[m].finished++;
    });
    return {
      lessons: lessons, practices: practices, total: list.length,
      tasksTotal: tasksTotal, tasksDone: tasksDone,
      finished: finished, percent: percent,
      minutes: minutes, minutesLeft: Math.round(minutes * (1 - percent / 100)),
      streak: ST.streak(), byModule: byModule
    };
  };

  /** следующий незакрытый урок — «продолжить обучение» (в рамках курса) */
  ST.nextLesson = function (course) {
    var list = ST.allLessons(course);
    for (var i = 0; i < list.length; i++) if (!ST.completed[list[i].id]) return list[i];
    return null;
  };

  /* ---------- тариф и лимиты ---------- */

  ST.planDef = function () {
    var id = ST.promo && ST.promo.plan ? ST.promo.plan : ST.plan;
    for (var i = 0; i < App.PLANS.length; i++) if (App.PLANS[i].id === id) return App.PLANS[i];
    return App.PLANS[0];
  };

  ST.bonusTokens = function () {
    /* бонус за прогресс: до 40 000 токенов сверх дневного лимита.
       В тарифах без нейронки бонус не нужен — там нечего расходовать. */
    if (!App.planAI()) return 0;
    var s = ST.summary();
    return Math.min(40000, s.finished * 1000);
  };

  ST.dailyTokens = function () { return ST.planDef().dailyTokens + ST.bonusTokens(); };

  ST.setPlan = function (id) {
    ST.plan = id;
    ST.savePlan();
  };

  ST.reset = function (what) {
    if (what === "progress" || what === "all") {
      ST.answers = {}; ST.completed = {}; ST.test = null; ST.practice = {};
      ST.saveAnswers(); ST.saveCompleted(); ST.saveTest(); ST.savePractice();
      App.storage.del("oge_activity");
    }
    if (what === "lessons" || what === "all") {
      App.storage.del(App.storage.KEYS.lessons);
      App.storage.del("oge_lessons_deleted");
    }
    if (what === "ai" || what === "all") {
      App.storage.del(App.storage.KEYS.usage);
      App.storage.del(App.storage.KEYS.aiHistory);
    }
  };
})();
