/* storage.js — ключи localStorage и безопасное чтение/запись */
(function () {
  "use strict";
  var S = App.storage = {};

  S.KEYS = {
    test: "oge_test",
    completed: "oge_completed",
    answers: "oge_answers",
    lessons: "oge_lessons_custom",   // переопределения уроков из админки
    adminPass: "oge_admin_pass",
    theme: "oge_theme",
    plan: "oge_plan",
    usage: "oge_ai_usage",           // расход токенов по дням
    aiMode: "oge_ai_mode",
    aiHistory: "oge_ai_history",
    aiKeyOverride: "oge_ai_key",
    lastLesson: "oge_last_lesson",
    streak: "oge_streak",
    streakDay: "oge_streak_day",
    promo: "oge_promo",
    practice: "oge_practice_state"   // сохранённые решения практик
  };

  S.get = function (key, def) {
    try {
      var v = localStorage.getItem(key);
      if (v === null) return def;
      var parsed = JSON.parse(v);
      return parsed === null ? def : parsed;
    } catch (e) { return def; }
  };

  S.set = function (key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  };

  S.del = function (key) {
    try { localStorage.removeItem(key); } catch (e) {}
  };

  S.raw = function (key, def) {
    try { var v = localStorage.getItem(key); return v === null ? def : v; } catch (e) { return def; }
  };
  S.setRaw = function (key, val) {
    try { localStorage.setItem(key, val); return true; } catch (e) { return false; }
  };

  /** полный бэкап всего, что важно */
  S.exportAll = function () {
    var out = { version: 1, exported: new Date().toISOString(), data: {} };
    Object.keys(S.KEYS).forEach(function (k) {
      var v = S.get(S.KEYS[k], null);
      if (v !== null) out.data[S.KEYS[k]] = v;
    });
    return out;
  };

  S.importAll = function (obj) {
    if (!obj || !obj.data) throw new Error("Неверный формат файла бэкапа");
    var n = 0;
    Object.keys(obj.data).forEach(function (k) { S.set(k, obj.data[k]); n++; });
    return n;
  };
})();
