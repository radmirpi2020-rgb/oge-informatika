/* tools/check-content.js — проверка всех модулей уроков:
   1) скобки сбалансированы;
   2) файл разбирается как JS и реально возвращает массив уроков;
   3) у каждого choice индекс ответа существует в options;
   4) в input-ответах нет пробелов;
   5) у практик code: solution реально печатает expected (через мини-интерпретатор);
   6) id уроков уникальны, номера идут без пропусков.
   Запуск: node tools/check-content.js */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dir = path.join(root, "data", "lessons");

global.window = global;
global.App = {};
eval(fs.readFileSync(path.join(root, "scripts", "practice", "python-lite.js"), "utf8"));
const py = App.python;

/* ---- 1. скобки ---- */
function balance(src) {
  const pairs = { ")": "(", "]": "[", "}": "{" };
  let i = 0, line = 1, inStr = null, stack = [];
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (inStr) {
      if (c === "\\") { i += 2; continue; }
      if (c === inStr) inStr = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; }
      i += 2; continue;
    }
    if (c === "{" || c === "[" || c === "(") { stack.push({ c, line }); i++; continue; }
    if (c === "}" || c === "]" || c === ")") {
      const top = stack.pop();
      if (!top || top.c !== pairs[c]) {
        return "«" + c + "» на строке " + line + ", а ждали закрытие «" + (top ? top.c + "» со строки " + top.line : "—") + "»";
      }
      i++; continue;
    }
    i++;
  }
  if (stack.length) return "не закрыто: " + stack.slice(-4).map((s) => "«" + s.c + "» (строка " + s.line + ")").join(", ");
  return null;
}

const files = fs.readdirSync(dir).filter((f) => /^module-\d+.*\.js$/.test(f)).sort();
let problems = 0;
const soft = [];
const engineCount = {};
const allIds = [];
const pyChecks = [];

files.forEach((f) => {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  const bal = balance(src);
  if (bal) {
    console.log("[" + f + "] ОШИБКА СКОБОК: " + bal);
    problems++;
    return;
  }
  let lessons;
  try {
    const fn = (() => {
      const start = src.indexOf("(function");
      return new Function("App", "return " + src.slice(start).trim());
    })();
    const mods = [];
    lessons = fn({ registerModule: (n, l) => { mods.push(l); } });
    if (!Array.isArray(lessons) && mods[0]) lessons = mods[0];
  } catch (e) {
    console.log("[" + f + "] НЕ РАЗБИРАЕТСЯ: " + e.message);
    problems++;
    return;
  }
  if (!Array.isArray(lessons) || !lessons.length) {
    console.log("[" + f + "] не вернул массив уроков");
    problems++;
    return;
  }

  lessons.forEach((l) => {
    allIds.push(l.id);
    if (!l.id || !l.title) { console.log("[" + f + "] урок без id/title"); problems++; }
    if (typeof l.theory !== "string" || l.theory.length < 600) {
      console.log("[" + f + "] урок " + l.id + ": короткая или отсутствующая теория (" +
        (l.theory ? l.theory.length : 0) + " знаков)");
      problems++;
    }
    (l.tasks || []).forEach((t) => {
      if (!t.id || !t.q) { console.log("[" + f + "] задача " + t.id + " без текста"); problems++; }
      if (t.type === "choice") {
        if (!Array.isArray(t.options) || t.options.length < 2) { console.log("[" + f + "] " + t.id + ": нет вариантов"); problems++; }
        else if (!(Number(t.answer) >= 0 && Number(t.answer) < t.options.length)) {
          console.log("[" + f + "] " + t.id + ": индекс ответа " + t.answer + " вне списка вариантов");
          problems++;
        }
      } else if (t.type === "input") {
        if (t.answer == null || String(t.answer).trim() === "") { console.log("[" + f + "] " + t.id + ": пустой ответ"); problems++; }
        else if (/\s/.test(String(t.answer).trim()) && String(t.answer).indexOf("|") === -1) {
          soft.push("[" + f + "] " + t.id + ": в ответе пробел (" + t.answer + ")");
        }
      } else {
        console.log("[" + f + "] " + t.id + ": неизвестный тип " + t.type);
        problems++;
      }
      if (!t.explain) { console.log("[" + f + "] " + t.id + ": нет разбора"); problems++; }
    });
    if (l.practice) {
      engineCount[l.practice.engine] = (engineCount[l.practice.engine] || 0) + 1;
      const cfg = l.practice.config || {};
      if (l.practice.engine === "code") {
        if (!cfg.expected || !cfg.solution) { console.log("[" + f + "] практика " + l.id + ": нет expected/solution"); problems++; }
        else {
          const r = py.run(cfg.solution);
          const got = r.ok ? r.out : "";
          const want = String(cfg.expected).replace(/\s+$/, "");
          if (!r.ok || got.replace(/\s+$/, "") !== want) {
            pyChecks.push({ id: l.id, ok: false, err: r.ok ? "вывод не совпал" : r.error, got: got.slice(0, 80), want: want.slice(0, 80) });
          } else pyChecks.push({ id: l.id, ok: true });
        }
      } else if (l.practice.engine === "sandbox") {
        const steps = cfg.steps || [];
        if (!steps.length) { console.log("[" + f + "] практика " + l.id + ": нет шагов"); problems++; }
        steps.forEach((s, i) => {
          if (!s.q || s.answer == null || !Array.isArray(s.steps) || !s.steps.length) {
            console.log("[" + f + "] практика " + l.id + ", шаг " + (i + 1) + ": неполные данные");
            problems++;
          }
        });
      } else if (l.practice.engine === "robot") {
        const fld = cfg.field || {};
        if (!fld.start || !fld.goal) { console.log("[" + f + "] практика " + l.id + ": нет start/goal"); problems++; }
      }
    }
  });
  const ids = lessons.map((l) => l.id);
  console.log("[ок] " + f + ": элементов " + lessons.length + " (" + ids[0] + "–" + ids[ids.length - 1] + ")");
});

/* ---- сводка ---- */
const dup = allIds.filter((id, i) => allIds.indexOf(id) !== i);
const max = Math.max.apply(null, allIds);
const missing = [];
for (let i = 1; i <= max; i++) if (!allIds.includes(i)) missing.push(i);

console.log("\nВсего уроков: " + allIds.length + ", максимальный id: " + max);
console.log("Дубли id: " + (dup.length ? [...new Set(dup)].join(", ") : "нет"));
console.log("Пропущенные номера: " + (missing.length ? missing.join(", ") : "нет"));
console.log("Практики по движкам: " + JSON.stringify(engineCount));
const bad = pyChecks.filter((c) => !c.ok);
console.log("Практики с кодом: проверено " + pyChecks.length + ", не сошлось " + bad.length);
bad.forEach((b) => console.log("   урок " + b.id + ": " + b.err + "\n     ожидалось: " + JSON.stringify(b.want) + "\n     получено:  " + JSON.stringify(b.got)));
console.log("\nПроблем всего: " + problems);
if (soft.length) {
  console.log("Мягкие замечания (" + soft.length + "):");
  soft.slice(0, 60).forEach((s) => console.log("   " + s));
  if (soft.length > 60) console.log("   … ещё " + (soft.length - 60));
}
process.exit(problems || bad.length ? 1 : 0);
