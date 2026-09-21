/* tools/debug-validate.js — почему проверка модулей в build-lessons выдаёт нули */
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "data", "lessons");
const files = fs.readdirSync(dir).filter((f) => /^module-\d+.*\.js$/.test(f)).sort();

const mods = [];
const sandbox = { registerModule: (n, l) => mods.push({ name: n, lessons: l || [] }) };
console.log("перед загрузкой: mods =", mods.length);

files.forEach((f) => {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  const start = src.indexOf("(function");
  if (start === -1) { console.log("нет IIFE в " + f); return; }
  const fn = new Function("App", "return " + src.slice(start).trim());
  const res = fn(sandbox);
  if (f === files[0]) {
    console.log("первый модуль: результат =", Array.isArray(res) ? "массив из " + res.length : typeof res);
    console.log("после вызова: mods =", mods.length);
  }
});

console.log("итог: модулей " + mods.length + ", в первом " + (mods[0] ? mods[0].lessons.length : "нет"));
