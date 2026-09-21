/* tools/count-bundle.js — сколько уроков реально в собранном бандле */
const fs = require("fs");
const path = require("path");
const b = fs.readFileSync(path.join(__dirname, "..", "data", "lessons-bundle.js"), "utf8");

const ids = [...b.matchAll(/id:\s*(\d+)\s*,\s*module/g)].map((m) => Number(m[1]));
console.log("уроков найдено: " + ids.length);
console.log("модулей: " + (b.match(/App\.registerModule\(/g) || []).length);
console.log("первые id: " + ids.slice(0, 6).join(", "));
console.log("последние id: " + ids.slice(-6).join(", "));

const missing = [];
for (let i = 1; i <= 300; i++) if (!ids.includes(i)) missing.push(i);
console.log("нет в бандле: " + (missing.length ? missing.slice(0, 30).join(", ") + (missing.length > 30 ? " …" : "") : "нет"));

/* проверим, что бандл исполняется и регистрирует 300 уроков */
try {
  const mods = [];
  new Function("App", b)({ registerModule: (n, l) => mods.push({ n, count: (l || []).length }) });
  const total = mods.reduce((a, m) => a + m.count, 0);
  console.log("при запуске бандл регистрирует уроков: " + total + " в " + mods.length + " модулях");
} catch (e) {
  console.log("бандл не исполняется: " + e.message);
}
