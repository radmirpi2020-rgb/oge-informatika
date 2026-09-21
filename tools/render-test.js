/* tools/render-test.js — запускает сайт «как в браузере»: грузит скрипты и boot.js,
   затем рисует каждую страницу и проверяет, что в DOM появилась настоящая разметка.
   Ловит именно те ошибки, которые видны только при отрисовке (например, забытый window.ST).
   Запуск: node tools/render-test.js */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);

/* ---------- DOM-шим с реальными узлами по id ---------- */
function El(tag, id) {
  return {
    tagName: (tag || "div").toUpperCase(), id: id || "",
    innerHTML: "", textContent: "", value: "", checked: false, disabled: false,
    style: { setProperty() {} }, children: [],
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, contains(c) { return this._s.has(c); }, toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } },
    setAttribute(k, v) { this[k] = v; }, getAttribute(k) { return this[k] === undefined ? null : this[k]; },
    removeAttribute(k) { delete this[k]; },
    appendChild(c) { this.children.push(c); return c; }, removeChild(c) { this.children = this.children.filter((x) => x !== c); },
    insertBefore(c) { this.children.unshift(c); return c; }, remove() {},
    addEventListener() {}, removeEventListener() {}, closest() { return null; },
    querySelector() { return El("div"); }, querySelectorAll() { return []; },
    focus() {}, blur() {}, click() {}, setSelectionRange() {}, insertAdjacentHTML() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; }
  };
}

const nodes = {
  pageHeader: El("div", "pageHeader"),
  pageAside: El("div", "pageAside"),
  pageBody: El("main", "pageBody"),
  root: El("div", "root"),
  panels: El("div", "panels"),
  error: El("div", "error"),
  themeBtn: El("button", "themeBtn"),
  ringBtn: El("button", "ringBtn"),
  aiBtn: El("button", "aiBtn")
};

const document = {
  readyState: "complete",
  documentElement: El("html"),
  head: El("head"), body: El("body"),
  createElement: (t) => El(t),
  createTextNode: (t) => ({ textContent: t }),
  getElementById: (id) => nodes[id] || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {}
};

const store = {};
Object.defineProperties(global, {
  document: { value: document, configurable: true },
  localStorage: { value: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { Object.keys(store).forEach((k) => delete store[k]); } }, configurable: true },
  sessionStorage: { value: { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } }, configurable: true },
  location: { value: { hash: "#/home", protocol: "http:" }, configurable: true, writable: true },
  navigator: { value: { userAgent: "node" }, configurable: true },
  matchMedia: { value: () => ({ matches: false, addEventListener() {} }), configurable: true },
  addEventListener: { value: () => {}, configurable: true },
  removeEventListener: { value: () => {}, configurable: true },
  scrollTo: { value: () => {}, configurable: true },
  fetch: { value: () => Promise.reject(new Error("сеть отключена")), configurable: true },
  AbortController: { value: function () { this.abort = () => {}; this.signal = {}; }, configurable: true },
  Blob: { value: function () {}, configurable: true },
  FileReader: { value: function () { this.readAsText = () => {}; }, configurable: true },
  URL: { value: { createObjectURL: () => "blob:x" }, configurable: true },
  alert: { value: () => {}, configurable: true },
  confirm: { value: () => false, configurable: true },
  Audio: { value: function () { this.play = () => Promise.reject(new Error("нет звука")); }, configurable: true },
  App: { value: {}, configurable: true, writable: true }
});
global.window = global;

const errors = [];
function load(rel) {
  const code = fs.readFileSync(path.join(root, rel), "utf8");
  (0, eval)(code + "\n//# sourceURL=" + rel);
}

/* ---------- загрузка всех скриптов, включая boot.js ---------- */
scripts.forEach((rel) => {
  try { load(rel); }
  catch (e) { errors.push("загрузка " + rel + ": " + e.message); }
});

if (typeof App === "undefined" || !App.router) {
  console.log("Роутер не поднялся — дальше проверять нечего.");
  errors.forEach((e) => console.log("  ✗ " + e));
  process.exit(1);
}

/* ---------- отрисовка страниц ---------- */
const routes = [
  ["home", null, ["Репетитор, который", "Следующий шаг", "Два курса"]],
  ["lessons", null, ["Информатика 5–9 класс", "lesson-card"]],
  ["lesson", "1", ["Системы счисления", "Задача 1"]],
  /* у практики в разметке страницы есть контейнер и задание: движок наполняет его в браузере */
  ["lesson", "44", ["practiceHost", "Практика"]],
  ["test", null, ["Входной тест", "Проверить"]],
  ["tutor", null, ["Провожатый", "Спросить"]],
  ["progress", null, ["Прогресс:", "По модулям", "Второй курс"]],
  ["media", null, ["Медиа сайта", "greet"]],
  ["plans", null, ["Сколько нейронки", "Лимит"]],
  ["admin", null, ["Админка", "Пароль"]],
  ["account", null, ["Аккаунт", "Регистрация", "Вход"]]
];

console.log("Проверка отрисовки страниц:");
let bad = 0;
routes.forEach(([route, param, needles]) => {
  global.location.hash = "#/" + route + (param ? "/" + param : "");
  let err = null;
  try { App.router.render(); } catch (e) { err = e.message; }
  if (err) { bad++; console.log("  ✗ " + route + (param ? "/" + param : "") + ": " + err); return; }
  const out = nodes.pageBody.innerHTML || "";
  const missing = needles.filter((n) => out.indexOf(n) === -1);
  const headerOk = (nodes.pageHeader.innerHTML || "").indexOf("logo") !== -1;
  if (missing.length || !headerOk || out.length < 200) {
    bad++;
    console.log("  ✗ " + route + (param ? "/" + param : "") + ": " +
      (missing.length ? "нет текста: " + missing.join(", ") : "шапка не отрисовалась") +
      " (получено " + out.length + " знаков)");
  } else {
    console.log("  ок  " + route + (param ? "/" + param : "") + " (" + out.length + " знаков разметки)");
  }
});

/* ---------- два курса: переключение, раздельный прогресс, уроки ОГЭ ---------- */
console.log("");
console.log("Проверка двух курсов:");

function renderPage(hash) {
  global.location.hash = hash;
  App.router.render();
  return {
    body: nodes.pageBody.innerHTML || "",
    header: nodes.pageHeader.innerHTML || ""
  };
}

function courseCheck(title, fn) {
  let problem = null;
  try { problem = fn(); } catch (e) { problem = "исключение: " + e.message; }
  if (problem) { bad++; console.log("  ✗ " + title + ": " + problem); }
  else console.log("  ок  " + title);
}

const totalBase = ST.summary("base").total;
const totalOge = ST.summary("oge").total;

courseCheck("курс 1: в списке 300 элементов школьной программы", () => {
  App.course.set("base");
  const p = renderPage("#/lessons");
  if (totalBase !== 300) return "в курсе 1 уроков " + totalBase + ", а должно быть 300";
  if (p.body.indexOf("Информатика 5–9 класс") === -1) return "нет названия первого курса";
  if (p.body.indexOf("Системы счисления") === -1) return "нет модулей школьного курса";
  if (p.header.indexOf("5–9 класс") === -1) return "в шапке не отображается первый курс";
  if (p.body.indexOf("ОГЭ · ") !== -1) return "в первый курс попали уроки ОГЭ";
  return null;
});

courseCheck("курс 2: уроки ОГЭ и режимы на месте", () => {
  App.course.set("oge");
  const p = renderPage("#/lessons");
  if (!totalOge) return "второй курс пустой";
  if (p.body.indexOf("Подготовка к ОГЭ") === -1) return "нет названия второго курса";
  if (p.body.indexOf("ОГЭ · ") === -1) return "нет модулей ОГЭ";
  if (p.body.indexOf("вживую в программе") === -1) return "не видно режима «вживую»";
  if (p.body.indexOf("полный вариант на время") === -1) return "не видно режима «полный вариант»";
  if (p.header.indexOf("ОГЭ") === -1) return "в шапке не отображается курс ОГЭ";
  return null;
});

courseCheck("курсы не пересекаются и прогресс считается раздельно", () => {
  const ids = { base: {}, oge: {} };
  ST.allLessons("base").forEach((l) => { ids.base[l.id] = 1; });
  ST.allLessons("oge").forEach((l) => { ids.oge[l.id] = 1; });
  const cross = Object.keys(ids.base).filter((id) => ids.oge[id]);
  if (cross.length) return "уроки в двух курсах одновременно: " + cross.slice(0, 5).join(", ");
  const all = ST.allLessons().length;
  if (all !== totalBase + totalOge) return "всего уроков " + all + ", а по курсам " + (totalBase + totalOge);
  return null;
});

courseCheck("урок ОГЭ рисуется: план, файлы, чек-лист", () => {
  App.course.set("oge");
  const first = ST.allLessons("oge")[0];
  if (!first) return "нет уроков ОГЭ";
  const p = renderPage("#/lesson/" + first.id);
  if (p.body.indexOf("Подготовка к ОГЭ") === -1) return "нет курса в крошках";
  if (p.body.indexOf("Режим урока") === -1) return "нет режима урока";
  if (p.body.indexOf("Что делать") === -1) return "нет шагов урока";
  if (p.body.indexOf("Статус урока") === -1) return "нет честного статуса «тексты пишутся»";
  return null;
});

courseCheck("прогресс: у курса ОГЭ свой счётчик и ссылка на второй курс", () => {
  App.course.set("oge");
  const p = renderPage("#/progress");
  if (p.body.indexOf("Прогресс: Подготовка к ОГЭ") === -1) return "нет заголовка прогресса второго курса";
  if (p.body.indexOf("Второй курс") === -1) return "нет блока со вторым курсом";
  if (p.body.indexOf("По модулям") === -1) return "нет разбивки по модулям";
  return null;
});

courseCheck("главная: две карточки курсов и цифры ОГЭ", () => {
  App.course.set("base");
  const p = renderPage("#/home");
  if (p.body.indexOf("Два курса") === -1) return "нет блока «Два курса»";
  if (p.body.indexOf("Подготовка к ОГЭ") === -1) return "нет карточки второго курса";
  if (p.body.indexOf("Живых прогонов") === -1) return "нет цифр о живых прогонах";
  return null;
});

App.course.set("base");   /* возвращаем состояние по умолчанию, как у нового ученика */
global.location.hash = "#/home";
App.router.render();

/* ---------- аккаунт: страница и ссылки из письма ---------- */
console.log("");
console.log("Проверка аккаунта:");

courseCheck("страница входа и регистрации рисуется", () => {
  const out = renderPage("#/account").body;
  if (out.indexOf("Регистрация") === -1) return "нет формы регистрации";
  if (out.indexOf("Забыл пароль") === -1) return "нет восстановления пароля";
  if (out.indexOf("btnRegister") === -1) return "нет кнопки создания аккаунта";
  if (out.indexOf("Сервер сейчас") === -1) return "нет подсказки про сервер";
  return null;
});

courseCheck("ссылка «подтвердить почту» из письма разбирается", () => {
  global.location.hash = "#/account?verify=abc123";
  const q = App.router.query();
  if (q.verify !== "abc123") return "параметр verify не разобран: " + JSON.stringify(q);
  const parsed = App.router.parse();
  if (parsed.name !== "account") return "роут разобран как " + parsed.name;
  App.router.render();
  const out = nodes.pageBody.innerHTML || "";
  if (out.indexOf("Подтверждение почты") === -1) return "нет панели подтверждения";
  return null;
});

courseCheck("ссылка «сбросить пароль» из письма разбирается", () => {
  global.location.hash = "#/account?reset=tok-42";
  const q = App.router.query();
  if (q.reset !== "tok-42") return "параметр reset не разобран: " + JSON.stringify(q);
  App.router.render();
  const out = nodes.pageBody.innerHTML || "";
  if (out.indexOf("Новый пароль") === -1) return "нет формы нового пароля";
  if (out.indexOf("btnReset") === -1) return "нет кнопки сохранения пароля";
  return null;
});

courseCheck("вход и выход переключают панель аккаунта", () => {
  App.storage.set(App.auth.TOKEN_KEY, "test-token");
  App.storage.set(App.auth.USER_KEY, { id: 1, email: "u@example.ru", _verified: true });
  if (!App.auth.logged()) return "вход не отмечен";
  const out = renderPage("#/account").body;
  if (out.indexOf("Сохранить прогресс в аккаунт") === -1) return "нет панели вошедшего ученика";
  App.auth.logout();
  if (App.auth.logged()) return "токен не убран после выхода";
  return null;
});

/* ---------- проверка «окна» на забытые глобалы ---------- */
["App", "ST", "App.router", "App.pages", "App.ai", "App.media", "App.PRACTICE", "App.python", "App.auth"].forEach((name) => {
  let value;
  try { value = (0, eval)(name); } catch (e) { value = undefined; }
  if (value === undefined) { bad++; console.log("  ✗ в window нет " + name); }
});

console.log("");
if (errors.length) { console.log("Ошибки загрузки:"); errors.forEach((e) => console.log("  ✗ " + e)); }
if (bad || errors.length) {
  console.log("Проблем: " + (bad + errors.length));
  process.exit(1);
}
console.log("Все страницы рисуются, глобальные объекты на месте.");
