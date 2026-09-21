/* tools/find-bad-token.js — ищет строку, на которой ломается разбор файла данных.
   Запуск: node tools/find-bad-token.js data/lessons/module-08-graphs.js */
const fs = require("fs");
const file = process.argv[2];
const src = fs.readFileSync(file, "utf8");
const lines = src.split("\n");

// 1) ищем подозрительные символы
const bad = [];
lines.forEach((l, i) => {
  // eslint-disable-next-line no-control-regex
  const m = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029]/.exec(l);
  if (m) bad.push([i + 1, "управляющий символ U+" + m[0].codePointAt(0).toString(16).toUpperCase(), l.slice(0, 80)]);
});
if (bad.length) {
  console.log("Подозрительные строки:");
  bad.slice(0, 20).forEach((b) => console.log("  строка " + b[0] + ": " + b[1] + " — " + JSON.stringify(b[2])));
} else {
  console.log("Управляющих символов нет.");
}

// 2) баланс кавычек по строкам там, где ожидаются строковые литералы
let unterminated = [];
lines.forEach((l, i) => {
  let q = null, esc = false;
  for (const c of l) {
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
  }
  if (q) unterminated.push(i + 1);
});
if (unterminated.length) {
  console.log("Строки с незакрытой кавычкой (возможно, перенос строки внутри строки): " + unterminated.slice(0, 20).join(", "));
} else {
  console.log("Незакрытых кавычек нет.");
}

// 3) пробуем разобрать префиксы блоками, чтобы найти место поломки
const start = src.indexOf("(function");
if (start === -1) { console.log("IIFE не найдена"); process.exit(1); }
let lastOk = 0;
for (let i = start; i < src.length; i += 1) {
  if (src[i] !== "\n") continue;
  const chunk = src.slice(start, i);
  try {
    new Function("App", "return " + chunk + "];})();");
    lastOk = i;
  } catch (e) { /* ожидаемо для неполного куска */ }
}
const lineOf = (pos) => src.slice(0, pos).split("\n").length;
console.log("Последняя строка, до которой файл ещё разбирался: " + lineOf(lastOk));
const around = src.slice(lastOk, lastOk + 400);
console.log("Контекст после неё:");
console.log(JSON.stringify(around.slice(0, 300), null, 0));
