/* tools/scan-balance.js — ищет несбалансированные скобки в файле данных.
   Запуск: node tools/scan-balance.js data/lessons/module-08-graphs.js */
const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("укажи файл: node tools/scan-balance.js путь/к/файлу.js");
  process.exit(1);
}

const src = fs.readFileSync(file, "utf8");
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
    i += 2;
    continue;
  }
  if (c === "{" || c === "[" || c === "(") { stack.push({ c, line }); i++; continue; }
  if (c === "}" || c === "]" || c === ")") {
    const want = pairs[c];
    const top = stack.pop();
    if (!top || top.c !== want) {
      console.log("НЕСОВПАДЕНИЕ: «" + c + "» на строке " + line +
        ", а ждали закрытие для «" + (top ? top.c : "—") + "» со строки " + (top ? top.line : "—"));
      process.exit(0);
    }
    i++; continue;
  }
  i++;
}

if (stack.length) {
  console.log("Не закрыто до конца файла:");
  stack.slice(-10).forEach((s) => console.log("  «" + s.c + "» со строки " + s.line));
} else {
  console.log("Скобки сбалансированы: " + file);
}
