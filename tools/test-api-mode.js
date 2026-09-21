/* tools/test-api-mode.js — проверяет режим «контент из базы» без браузера.

   Что делает: поднимает минимальный шим (window/App/localStorage), подставляет реальный fetch,
   загружает ядро сайта, курсы и scripts/core/api.js с адресом сервера, ждёт загрузку и проверяет,
   что реестр уроков собран из базы: 300 уроков школьного курса и 100 курса ОГЭ, у уроков есть
   задачи и теория, у курса ОГЭ — режимы и короткий трек.

   Запуск (сервер должен быть поднят: cd server && pnpm db:start && pnpm dev):
     node tools/test-api-mode.js                # по умолчанию http://127.0.0.1:3000
     API_BASE=http://host:3000 node tools/test-api-mode.js */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = (process.argv[2] || process.env.API_BASE || "http://127.0.0.1:3000").replace(/\/+$/, "");

const problems = [];
const note = (msg) => console.log(msg);

/* ---------- шим окружения ---------- */
const store = {};
const listeners = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); }
};
global.document = {
  addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ setAttribute() {}, style: {} })
};
global.location = { hash: "#/lessons", protocol: "http:" };
/* navigator в Node 22 только для чтения — не трогаем */
global.addEventListener = () => {};
global.scrollTo = () => {};

const App = {};
global.window = global;
global.App = App;
global.window.App = App;
global.window.SITE_API = BASE;
global.window.console = console;

App.registerModule = function (moduleName, lessons, course) {
  App._modules = App._modules || [];
  const id = course || "base";
  (lessons || []).forEach((l) => { if (!l.course) l.course = id; });
  App._modules.push({ name: moduleName, course: id, lessons: lessons || [] });
  App.LESSONS = App._modules.reduce((acc, m) => acc.concat(m.lessons), []);
  App.LESSONS.sort((a, b) => a.id - b.id);
};
App.LESSONS = [];
App.TEST_QUESTIONS = [];

/* ---------- загрузка скриптов ядра ---------- */
["scripts/core/app.js", "scripts/core/storage.js", "scripts/core/courses.js"].forEach((rel) => {
  const code = fs.readFileSync(path.join(ROOT, rel), "utf8");
  (0, eval)(code + "\n//# sourceURL=" + rel);
});

/* api.js требует настоящий fetch — в Node 18+ он есть */
const apiCode = fs.readFileSync(path.join(ROOT, "scripts/core/api.js"), "utf8");
(0, eval)(apiCode + "\n//# sourceURL=scripts/core/api.js");

/* ---------- ждём загрузку и проверяем ---------- */
const deadline = Date.now() + 30000;
(function waitReady() {
  const done = App.api && App.api.stats;
  const failed = App.apiError;
  if ((done || failed) || Date.now() > deadline) return check();
  setTimeout(waitReady, 200);
})();

function check() {
  note("Адрес базы: " + BASE);
  note("Источник данных: " + App.dataSource + " (" + (App.dataSourceNote || "") + ")");

  if (App.apiError) {
    problems.push("API недоступен: " + App.apiError);
    return finish();
  }
  if (!App.api.stats) {
    problems.push("за 30 секунд контент из базы не загрузился");
    return finish();
  }

  const stats = App.api.stats;
  note(`Из базы: курсов ${stats.courses}, модулей ${stats.modules}, уроков ${stats.lessons} (школьных ${stats.base}, ОГЭ ${stats.oge})`);

  if (stats.base !== 300) problems.push(`уроков школьного курса ${stats.base}, ожидается 300`);
  if (stats.oge !== 100) problems.push(`уроков курса ОГЭ ${stats.oge}, ожидается 100`);

  const base = App.course.lessons("base");
  const oge = App.course.lessons("oge");

  const withTasks = base.filter((l) => (l.tasks || []).length).length;
  const withTheory = base.filter((l) => l.theory).length;
  const withPractice = base.filter((l) => l.practice).length;
  note(`Школьный курс: с задачами ${withTasks}, с практиками ${withPractice}, с теорией ${withTheory}`);
  /* часть уроков — практики: у них вместо задач конфигурация движка */
  if (withTasks + withPractice < 295) {
    problems.push(`уроков с задачами или практикой всего ${withTasks + withPractice} из ${base.length}`);
  }
  if (withTheory < 295) problems.push(`уроков с теорией всего ${withTheory}`);

  const modes = {};
  oge.forEach((l) => { const m = (l.oge && l.oge.mode) || "нет"; modes[m] = (modes[m] || 0) + 1; });
  note("Режимы уроков ОГЭ: " + JSON.stringify(modes));
  if (!modes.real) problems.push("в курсе ОГЭ из базы нет уроков режима «вживую»");
  if (!modes.exam) problems.push("в курсе ОГЭ из базы нет полных вариантов");

  const short = oge.filter((l) => l.oge && l.oge.shortTrack).length;
  note("Короткий трек: " + short + " уроков");
  if (short !== 85) problems.push(`в коротком треке ${short} уроков, ожидается 85`);

  const sample = oge.find((l) => l.oge && l.oge.files && l.oge.files.length);
  if (sample) note(`Пример файлов у урока №${sample.id}: ` + sample.oge.files.map((f) => f.title + " (" + f.size + ")").join(", "));
  else problems.push("ни у одного урока ОГЭ не пришли файлы к уроку");

  const first = base[0];
  if (first) note(`Первый урок школьного курса: №${first.id} «${first.title}», задач ${(first.tasks || []).length}`);
  const practice = base.find((l) => l.practice);
  if (practice) note(`Практика из базы: №${practice.id} «${practice.title}», движок ${practice.practice.engine}`);
  else problems.push("практики из базы не пришли");

  finish();
}

function finish() {
  if (problems.length) {
    console.log("\nПРОБЛЕМЫ:");
    problems.forEach((p) => console.log("  - " + p));
    process.exit(1);
  }
  console.log("\nОК: сайт собирает оба курса из базы и готов к работе в режиме «контент из базы».");
  process.exit(0);
}
