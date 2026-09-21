/* tools/debug-load.js — показывает, что происходит при загрузке скриптов по порядку из index.html */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);

const APP = {};
global.window = global;
Object.defineProperty(global, "App", { get: () => APP, set: () => {}, configurable: true });
global.addEventListener = function () {};
global.document = {
  readyState: "complete",
  documentElement: { setAttribute() {}, getAttribute() { return "light"; } },
  body: { appendChild() {} },
  createElement: () => ({ style: {}, classList: { add() {}, remove() {}, contains() { return false; } }, addEventListener() {}, appendChild() {}, setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; } }),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {}
};
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
global.sessionStorage = global.localStorage;
global.location = { hash: "", protocol: "file:" };
global.matchMedia = () => ({ matches: false });
global.fetch = () => Promise.reject(new Error("нет сети"));

scripts.forEach((rel) => {
  const code = fs.readFileSync(path.join(root, rel), "utf8");
  let err = null;
  try {
    new Function("window", "document", "localStorage", "sessionStorage", "location", "matchMedia", "fetch", code)
      (global, global.document, global.localStorage, global.sessionStorage, global.location, global.matchMedia, global.fetch);
  } catch (e) { err = e.message; }
  console.log(rel.padEnd(42) + " | router: " + (APP.router ? "есть" : "нет") +
    " | страниц: " + (APP.pages ? Object.keys(APP.pages).length : 0) +
    " | уроков: " + (APP.LESSONS || []).length +
    (err ? " | ОШИБКА: " + err : ""));
});

console.log("\nОтладка router.js:");
const rcode = fs.readFileSync(path.join(root, "scripts/core/router.js"), "utf8");
console.log("  длина файла: " + rcode.length);
console.log("  содержит 'App.router =': " + rcode.includes("App.router ="));
try {
  const probe = {};
  Object.defineProperty(global, "App", { get: () => probe, set: () => {}, configurable: true });
  new Function("App", rcode + "\n;return typeof App.router;")(probe);
  console.log("  после прямого вызова: router = " + typeof probe.router + ", страниц = " + Object.keys(probe.pages || {}).length);
} catch (e) {
  console.log("  ОШИБКА прямого вызова: " + e.message);
}
