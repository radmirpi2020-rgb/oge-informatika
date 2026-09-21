/* tools/count-bundle.js — сколько уроков реально в собранном бандле.

   Идентификаторы берём ИСПОЛНЕНИЕМ бандла, а не регуляркой по тексту: бандл бывает двух видов —
   собранный из data/lessons/*.js (объекты в JS-стиле) и экспортированный из базы
   (tools/export-from-payload.js, JSON-стиль с кавычками). Разбор через App.registerModule
   работает в обоих случаях. */
const fs = require("fs");
const path = require("path");

const bundlePath = path.join(__dirname, "..", "data", "lessons-bundle.js");
const b = fs.readFileSync(bundlePath, "utf8");

const modules = [];
let error = null;
try {
  new Function("App", "window", b + "\n//# sourceURL=lessons-bundle.js")(
    { registerModule: (n, l, course) => modules.push({ n, course: course || "base", lessons: l || [] }) },
    { addEventListener() {} }
  );
} catch (e) {
  error = e;
}

const lessons = modules.reduce((acc, m) => acc.concat(m.lessons), []);
const ids = lessons.map((l) => Number(l.id)).filter((n) => Number.isFinite(n)).sort((a, b2) => a - b2);

console.log("уроков найдено: " + ids.length);
console.log("модулей: " + modules.length + (modules.some((m) => m.course !== "base") ? " (в том числе не только школьный курс)" : ""));
console.log("первые id: " + ids.slice(0, 6).join(", "));
console.log("последние id: " + ids.slice(-6).join(", "));

if (error) {
  console.log("бандл не исполняется: " + error.message);
  process.exit(1);
}

const baseIds = new Set(
  modules
    .filter((m) => m.course === "base")
    .reduce((acc, m) => acc.concat(m.lessons), [])
    .map((l) => Number(l.id))
);
const missing = [];
for (let i = 1; i <= 300; i++) if (!baseIds.has(i)) missing.push(i);
console.log("нет в бандле: " + (missing.length ? missing.slice(0, 30).join(", ") + (missing.length > 30 ? " …" : "") : "нет"));

const base = modules.filter((m) => m.course === "base");
console.log("при запуске бандл регистрирует уроков: " + baseIds.size + " в " + base.length + " модулях");

if (missing.length) process.exit(1);
