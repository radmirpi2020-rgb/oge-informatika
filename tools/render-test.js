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
  ["home", null, ["Репетитор, который", "Следующий шаг"]],
  ["lessons", null, ["Уроки и практики", "lesson-card"]],
  ["lesson", "1", ["Системы счисления", "Задача 1"]],
  /* у практики в разметке страницы есть контейнер и задание: движок наполняет его в браузере */
  ["lesson", "44", ["practiceHost", "Практика"]],
  ["test", null, ["Входной тест", "Проверить"]],
  ["tutor", null, ["Провожатый", "Спросить"]],
  ["progress", null, ["Твой прогресс", "По модулям"]],
  ["media", null, ["Медиа сайта", "greet"]],
  ["plans", null, ["Сколько нейронки", "Лимит"]],
  ["admin", null, ["Админка", "Пароль"]]
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

/* ---------- проверка «окна» на забытые глобалы ---------- */
["App", "ST", "App.router", "App.pages", "App.ai", "App.media", "App.PRACTICE", "App.python"].forEach((name) => {
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
