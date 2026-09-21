/* tools/build-lessons.js — склейка модулей уроков в один файл без сборки.
   Модули лежат как отдельные файлы data/lessons/module-*.js в формате:
     (function(){ "use strict"; ... return [ ... ]; })();
   Здесь они оборачиваются в вызовы App.registerModule и собираются в data/lessons-bundle.js.

   Запуск: node tools/build-lessons.js
   Меняешь уроки в data/lessons/module-*.js → запускаешь этот скрипт → обновляешь страницу. */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dir = path.join(root, "data", "lessons");
const outFile = path.join(root, "data", "lessons-bundle.js");

const files = fs.readdirSync(dir)
  .filter((f) => /^module-\d+.*\.js$/.test(f))
  .sort();

if (!files.length) {
  console.error("Не нашёл ни одного data/lessons/module-*.js");
  process.exit(1);
}

function moduleName(src, fallbackFile) {
  // имя модуля — первая строка вида /* Модуль 1. Системы счисления (уроки 1-20) */
  const m = /\/\*([^*]+?)\*\//.exec(src);
  if (m) {
    return m[1].replace(/\(уроки[^)]*\)/i, "").replace(/^Модуль\s*\d+\.\s*/i, "").trim();
  }
  return fallbackFile.replace(/^module-\d+-/, "").replace(/\.js$/, "");
}

function wrap(src) {
  // убираем шапку-комментарий модуля: она попала бы между аргументами registerModule
  var out = src.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "");
  var start = out.indexOf("(function");
  if (start > 0) out = out.slice(start);
  return out.replace(/\(function\s*\(\s*\)\s*\{/, "(function () {");
}

let out = [];
out.push("/* lessons-bundle.js — СОБРАНО АВТОМАТИЧЕСКИ из data/lessons/module-*.js");
out.push("   Не правь этот файл руками: правь модули и запускай node tools/build-lessons.js */");
out.push("(function () {");
out.push('  "use strict";');

let total = 0;
const report = [];

files.forEach((f) => {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  const name = moduleName(src, f);
  const trimmed = src.trim();
  if (!/\(function\s*\(/.test(trimmed)) {
    report.push(["ОШИБКА", f, "файл не похож на IIFE"]);
    return;
  }
  // проверяем, что IIFE действительно возвращает массив
  const returnMatch = /return\s*\[/.test(trimmed);
  if (!returnMatch) report.push(["ВНИМАНИЕ", f, "не вижу return [ ... ]"]);

  out.push("");
  out.push("  /* ==== " + f + " ==== */");
  var wrapped = wrap(trimmed);
  if (!/\)\s*\(\s*\)\s*;?\s*$/.test(wrapped.replace(/\s+$/, ""))) {
    report.push(["ВНИМАНИЕ", f, "IIFE не заканчивается вызовом ()"]);
  }
  out.push("  App.registerModule(" + JSON.stringify(name) + ", " + wrapped.replace(/;\s*$/, "") + ");");

  const ids = [...trimmed.matchAll(/\bid\s*:\s*(\d+)\s*,/g)].map((m) => Number(m[1]));
  const uniq = new Set(ids.filter((n) => n >= 1 && n <= 1000));
  total += uniq.size;
  report.push(["ок", f, name + ": элементов " + uniq.size]);
});

out.push("");
out.push("  App.MODULES = (App.MODULE_ORDER || []).slice();");
out.push("})();");
out.push("");

fs.writeFileSync(outFile, out.join("\n"), "utf8");

/* проверка: бандл должен разбираться и регистрировать все модули */
try {
  const code = fs.readFileSync(outFile, "utf8");
  const mods = [];
  const lessons = [];
  const sandbox = {
    registerModule: function (n, l) {
      mods.push({ name: n, count: (l || []).length });
      (l || []).forEach(function (x) { lessons.push(x); });
    }
  };
  new Function("App", code)(sandbox);
  if (!mods.length) throw new Error("ни один модуль не зарегистрировался");
  if (!lessons.length) throw new Error("уроки пустые");
  console.log("Бандл проверен: модулей " + mods.length + ", элементов " + lessons.length);
  const ids = lessons.map(function (l) { return l.id; });
  const dup = ids.filter(function (id, i) { return ids.indexOf(id) !== i; });
  const missing = [];
  for (let i = 1; i <= Math.max.apply(null, ids); i++) if (ids.indexOf(i) === -1) missing.push(i);
  console.log("  дубли id: " + (dup.length ? dup.join(", ") : "нет"));
  console.log("  пропуски: " + (missing.length ? missing.join(", ") : "нет"));
} catch (e) {
  console.error("БАНДЛ НЕ РАБОТАЕТ: " + e.message);
  process.exit(1);
}

console.log("Собрано: " + path.relative(root, outFile));
report.forEach((r) => console.log("  [" + r[0] + "] " + r[1] + " — " + r[2]));
console.log("Всего элементов в бандле: " + total);

/* сводка по модулям для проверки руками.
   Модули возвращают массив уроков напрямую; App.registerModule вызывает уже бандл. */
try {
  const lessons = [];
  let moduleCount = 0;
  files.forEach((f) => {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    const start = src.indexOf("(function");
    if (start === -1) throw new Error("в " + f + " не нашёл IIFE");
    const fn = new Function("App", "return " + src.slice(start).trim());
    const list = fn({ registerModule: () => {} });
    if (!Array.isArray(list)) throw new Error("файл " + f + " не вернул массив уроков");
    moduleCount++;
    list.forEach((l) => lessons.push(l));
  });
  const ids = lessons.map((l) => l.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  const maxId = Math.max.apply(null, ids);
  const missing = [];
  for (let i = 1; i <= maxId; i++) if (ids.indexOf(i) === -1) missing.push(i);
  const engines = {};
  lessons.forEach((l) => {
    if (l.practice) engines[l.practice.engine] = (engines[l.practice.engine] || 0) + 1;
  });
  console.log("\nПроверка по модулям:");
  console.log("  модулей: " + moduleCount + ", элементов: " + lessons.length + ", последний id: " + maxId);
  console.log("  дубли id: " + (dup.length ? dup.join(", ") : "нет"));
  console.log("  пропуски: " + (missing.length ? missing.join(", ") : "нет"));
  console.log("  практики по движкам: " + JSON.stringify(engines));
  if (moduleCount !== files.length) throw new Error("загрузились не все модули");
  if (missing.length || dup.length) throw new Error("нумерация уроков нарушена");
} catch (e) {
  console.log("\nПроверка по модулям не удалась: " + e.message);
  process.exit(1);
}
