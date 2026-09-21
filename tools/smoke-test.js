/* tools/smoke-test.js — прогон сайта без браузера.
   Поднимает минимальный DOM-шим, грузит все скрипты в том же порядке, что index.html,
   затем вызывает страницы, задачи и движки практик и сообщает об ошибках.
   Запуск: node tools/smoke-test.js */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);

/* ---------- минимальный DOM ---------- */
function makeEl(tag) {
  const el = {
    tagName: (tag || "div").toUpperCase(),
    children: [],
    attributes: {},
    dataset: {},
    style: { setProperty() {} },
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      contains(c) { return this._s.has(c); },
      toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
    },
    innerHTML: "",
    textContent: "",
    value: "",
    checked: false,
    disabled: false,
    files: [],
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.unshift(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); },
    remove() {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] === undefined ? null : this.attributes[k]; },
    removeAttribute(k) { delete this.attributes[k]; },
    addEventListener() {},
    removeEventListener() {},
    querySelector(sel) { return makeEl("div", sel); },     // заглушка: движки в тесте не рисуют, а считают
    querySelectorAll() { return []; },
    closest() { return null; },
    focus() {},
    blur() {},
    click() {},
    setSelectionRange() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
    insertAdjacentHTML() {},
    after() {},
    before() {}
  };
  Object.defineProperty(el, "firstChild", { get() { return this.children[0] || null; } });
  return el;
}

const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); }
};
global.sessionStorage = {
  _s: {},
  getItem(k) { return this._s[k] === undefined ? null : this._s[k]; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; }
};

const byId = {};
const document = {
  readyState: "complete",
  documentElement: makeEl("html"),
  body: makeEl("body"),
  head: makeEl("head"),
  createElement: (t) => makeEl(t),
  getElementById: (id) => byId[id] || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  createTextNode: (t) => ({ textContent: t }),
  _byId: byId
};
global.document = document;
global.window = global;
global.addEventListener = function () {};
global.removeEventListener = function () {};
global.scrollTo = function () {};
global.location = { hash: "#/home", protocol: "file:" };
global.navigator = { userAgent: "node" };
global.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
global.AbortController = global.AbortController || function () { this.abort = () => {}; this.signal = {}; };
global.Blob = function () {};
global.URL = global.URL || { createObjectURL: () => "blob:x" };
global.FileReader = function () { this.readAsText = () => {}; };
global.alert = () => {};
global.confirm = () => false;
global.setTimeout = global.setTimeout;
global.fetch = () => Promise.reject(new Error("сеть в тесте выключена"));

/* ---------- объект App (как в браузере: window.App) ---------- */
const APP = {};
Object.defineProperty(global, "_APP", { value: APP, writable: false });
Object.defineProperty(global, "App", { get: () => APP, set: () => {}, configurable: true });

const errors = [];
function guard(name, fn) {
  try { return fn(); }
  catch (e) { errors.push(name + ": " + (e && e.message ? e.message : String(e))); return null; }
}

/* ---------- загрузка скриптов ---------- */
scripts.forEach((rel) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) { errors.push("нет файла " + rel); return; }
  const code = fs.readFileSync(p, "utf8");
  if (rel === "scripts/core/boot.js") return;   // старт вызовем отдельно, как в браузере
  try {
    /* (0, eval) — непрямой вызов: код исполняется в глобальной области, точно как <script>.
       Никаких подсунутых аргументов, поэтому забытый window.X сразу даёт ReferenceError. */
    (0, eval)(code + "\n//# sourceURL=" + rel);
  } catch (e) {
    errors.push("загрузка " + rel + ": " + e.message);
  }
  if (/data\/|router|ai\/|pages\//.test(rel)) {
    console.log("  после " + rel + ": уроков " + (App.LESSONS || []).length +
      ", router " + (App.router ? "есть" : "нет") +
      ", страниц " + (App.pages ? Object.keys(App.pages).length : "—") +
      ", ошибок " + errors.length);
  }
});

console.log("Загружено скриптов: " + scripts.length);
if (errors.length) {
  console.log("Ошибки загрузки:");
  errors.forEach((e) => console.log("  ✗ " + e));
}
scripts.forEach((rel) => {
  const loaded = fs.existsSync(path.join(root, rel));
  if (!loaded) console.log("  нет файла: " + rel);
});
console.log("App: " + (typeof App));
console.log("App.util: " + (App && typeof App.util));
console.log("App.pages: " + (App && typeof App.pages));
console.log("Уроков в бандле: " + (App.LESSONS ? App.LESSONS.length : 0));
console.log("Вопросов входного теста: " + (App.TEST_QUESTIONS ? App.TEST_QUESTIONS.length : 0));

/* ---------- проверка «как в браузере»: без подсунутых глобалов ---------- */
const globalChecks = [
  ["App", "object"], ["ST", "object"], ["App.router", "object"], ["App.pages", "object"],
  ["App.ai", "object"], ["App.media", "object"], ["App.PRACTICE", "object"], ["App.python", "object"]
];
globalChecks.forEach(([name, kind]) => {
  let value;
  try { value = (0, eval)(name); } catch (e) { value = undefined; }
  if (typeof value !== kind) errors.push("в window нет " + name + " (нужен " + kind + ", а " + typeof value + ")");
});

/* ---------- страницы ---------- */
const routes = [
  ["home", null], ["test", null], ["lessons", null], ["lessons", "practice"],
  ["progress", null], ["plans", null], ["tutor", null], ["admin", null], ["notfound", null]
];
guard("роутер", () => { App.router.current = { name: "home", param: null }; });
routes.forEach(([name, param]) => {
  const page = App.pages[name];
  if (!page) { errors.push("страница " + name + " не зарегистрирована"); return; }
  const htmlOut = guard("страница " + name, () => page.view(param));
  if (!htmlOut) errors.push("страница " + name + " вернула пусто");
});

/* страницы уроков всех типов */
const byKind = {};
App.LESSONS.forEach((l) => {
  const k = l.kind === "practice" ? "practice:" + (l.practice ? l.practice.engine : "?") : "lesson";
  if (!byKind[k]) byKind[k] = l;
});
Object.keys(byKind).forEach((k) => {
  const l = byKind[k];
  const out = guard("урок " + l.id + " (" + k + ")", () => App.pages.lesson.view(String(l.id)));
  if (!out || out.indexOf("Урок не найден") !== -1) errors.push("урок " + l.id + " не отрисовался");
});

/* ---------- движки практик напрямую ---------- */
function host() { return makeEl("div"); }

// песочница
guard("движок sandbox", () => {
  const l = App.LESSONS.filter((x) => x.practice && x.practice.engine === "sandbox")[0];
  App.PRACTICE.sandbox.mount(host(), l.practice.config, { lesson: l, onSolved() {} });
});

// код
guard("движок code", () => {
  const l = App.LESSONS.filter((x) => x.practice && x.practice.engine === "code")[0];
  App.PRACTICE.code.mount(host(), l.practice.config, { lesson: l, onSolved() {} });
});

// робот (все конфиги)
let robots = 0;
App.LESSONS.filter((x) => x.practice && x.practice.engine === "robot").forEach((l) => {
  robots++;
  guard("движок robot, урок " + l.id, () => {
    App.PRACTICE.robot.mount(host(), l.practice.config, { lesson: l, onSolved() {} });
  });
});

// sql
let sqlChecked = 0;
App.LESSONS.filter((x) => x.practice && x.practice.engine === "sql").forEach((l) => {
  guard("движок sql, урок " + l.id, () => {
    const cfg = l.practice.config;
    const res = App.PRACTICE.sql.runQuery(cfg.solution, cfg.table);
    const want = JSON.stringify(cfg.expected);
    const got = JSON.stringify(res.rows);
    sqlChecked++;
    if (want !== got) errors.push("sql " + l.id + ": expected " + want + " ≠ получилось " + got);
    App.PRACTICE.sql.mount(host(), cfg, { lesson: l, onSolved() {} });
  });
});

// таблицы
guard("движок table", () => {
  const l = App.LESSONS.filter((x) => x.practice && x.practice.engine === "table")[0];
  if (l) {
    const cfg = l.practice.config;
    const t = new App.PRACTICE.table.Table(cfg);
    Object.keys(cfg.formulas || {}).forEach((addr) => {
      const v = t.cellValue(addr);
      if (typeof v === "string" && v.indexOf("#") === 0) errors.push("таблица " + addr + ": " + v);
    });
    App.PRACTICE.table.mount(host(), cfg, { lesson: l, onSolved() {} });
  }
});

// граф
guard("движок graph", () => {
  const l = App.LESSONS.filter((x) => x.practice && x.practice.engine === "graph")[0];
  if (l) {
    const cfg = l.practice.config;
    const g = App.PRACTICE.graph.build(cfg);
    const from = cfg.start || (cfg.nodes[0].id || cfg.nodes[0]);
    const to = cfg.goal || cfg.answer[cfg.answer.length - 1];
    const best = App.PRACTICE.graph.shortest(g, String(from), String(to));
    if (!best.path) errors.push("граф: пути нет");
    else {
      const wantCost = App.PRACTICE.graph.shortest(g, String(cfg.answer[0]), String(cfg.answer[cfg.answer.length - 1])).cost;
      if (best.cost !== wantCost) errors.push("граф: ответ в данных длиннее кратчайшего (" + wantCost + " против " + best.cost + ")");
    }
    App.PRACTICE.graph.mount(host(), cfg, { lesson: l, onSolved() {} });
  }
});

/* ---------- проверка ответов ---------- */
let checked = 0;
App.LESSONS.forEach((l) => {
  (l.tasks || []).forEach((t) => {
    checked++;
    if (t.type === "choice") {
      if (!(Number(t.answer) >= 0 && Number(t.answer) < t.options.length)) errors.push("задача " + t.id + ": индекс ответа вне вариантов");
    } else {
      if (!App.util.checkAnswer(String(t.answer).split("|")[0], t.answer)) {
        errors.push("задача " + t.id + ": свой же ответ не проходит проверку (" + t.answer + ")");
      }
    }
  });
});

/* ---------- нормализация и разметка ---------- */
guard("нормализация", () => {
  const cases = [
    ["13", "13", true], [" 13 ", "13", true], ["1101", "1101", true],
    ["2D", "2d", true], ["да", "1", true], ["нет", "0", true],
    ["1.5", "1,5", true], ["ёж", "еж", true], ["16", "16|0x10", true],
    ["17", "16|0x10", false]
  ];
  cases.forEach(([given, exp, want]) => {
    const got = App.util.checkAnswer(given, exp);
    if (got !== want) errors.push("проверка ответа: «" + given + "» против «" + exp + "» → " + got + ", ждали " + want);
  });
});

guard("разметка теории", () => {
  const htmlOut = App.md.theory("**жирный**\n\n~~~\nкод\n~~~\n\n> **Лайфхак.** тест\n\n!! **Ошибка.** тест");
  ["<b>жирный</b>", "class=\"ex\"", "class=\"hack\"", "class=\"warn\""].forEach((needle) => {
    if (htmlOut.indexOf(needle) === -1) errors.push("разметка: не нашёл " + needle);
  });
});

guard("лимиты и тарифы", () => {
  App.PLANS.forEach((p) => { if (!p.dailyTokens || !p.modes.length) errors.push("тариф " + p.id + " пустой"); });
  const info = App.usage.info();
  if (info.limit <= 0) errors.push("дневной лимит не считается");
  const before = App.usage.info().used;
  App.usage.add(1000, "eco");
  if (App.usage.info().used !== before + 1000) errors.push("расход токенов не считается");
  App.ai.setMode("eco");
  if (App.ai.mode() !== "eco") errors.push("режим трат не переключается");
  if (!App.aiRing({}).indexOf("limit-ring")) errors.push("кружок лимита не рисуется");
});

guard("локальный ответ без ключа", () => {
  const r = App.ai.ask("объясни тему", { mode: "eco" });
  if (!r.local || !r.text) errors.push("без ключа не работает локальный ответ");
});

/* ---------- итог ---------- */
console.log("Практик робота проверено: " + robots);
console.log("SQL-практик сверено: " + sqlChecked);
console.log("Задач проверено: " + checked);
if (errors.length) {
  console.log("\nОШИБКИ (" + errors.length + "):");
  errors.forEach((e) => console.log("  ✗ " + e));
  process.exit(1);
} else {
  console.log("\nВсё чисто: страницы, движки, задачи, лимиты и разметка работают.");
}
