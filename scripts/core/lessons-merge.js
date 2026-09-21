/* lessons-merge.js — правки уроков из админки поверх базовых данных.
   Правка сохраняется в localStorage (oge_lessons_custom), база не меняется.
   Скрипт держит функции сохранения/удаления/добавления, чтобы админка была короткой. */
(function () {
  "use strict";

  var AP = App.admin = App.admin || {};

  AP.DELETED_KEY = "oge_lessons_deleted";

  AP.deleted = function () { return App.storage.get(AP.DELETED_KEY, []) || []; };
  AP.saveDeleted = function (arr) { App.storage.set(AP.DELETED_KEY, arr); };

  AP.overrides = function () { return App.storage.get(App.storage.KEYS.lessons, {}) || {}; };
  AP.saveOverrides = function (obj) { App.storage.set(App.storage.KEYS.lessons, obj); };

  AP.patch = function (id, patch) {
    var ov = AP.overrides();
    ov[id] = Object.assign({}, ov[id] || {}, patch);
    AP.saveOverrides(ov);
  };

  AP.addLesson = function (lesson) {
    var ov = AP.overrides();
    ov[lesson.id] = lesson;
    AP.saveOverrides(ov);
    var del = AP.deleted().filter(function (x) { return x !== lesson.id; });
    AP.saveDeleted(del);
  };

  AP.removeLesson = function (id) {
    var ov = AP.overrides();
    delete ov[id];
    AP.saveOverrides(ov);
    var del = AP.deleted();
    if (del.indexOf(id) === -1) del.push(id);
    AP.saveDeleted(del);
  };

  AP.restoreAll = function () {
    App.storage.del(App.storage.KEYS.lessons);
    App.storage.del(AP.DELETED_KEY);
  };

  AP.nextId = function () {
    var max = 0;
    ST.allLessons().forEach(function (l) { if (l.id > max) max = l.id; });
    return max + 1;
  };

  /* пароль админки */
  AP.pass = function () { return App.storage.get(App.storage.KEYS.adminPass, "admin"); };
  AP.setPass = function (p) { App.storage.set(App.storage.KEYS.adminPass, p); };
  AP.hasSession = function () { return sessionStorage.getItem("oge_admin") === "1"; };
  AP.login = function (p) {
    if (String(p) === String(AP.pass())) { sessionStorage.setItem("oge_admin", "1"); return true; }
    return false;
  };
  AP.logout = function () { sessionStorage.removeItem("oge_admin"); };
})();
