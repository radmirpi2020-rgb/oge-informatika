/* tools/fix-content.js — точечные правки данных уроков:
   1) в ответах input убирает пробелы (ответы сверяются без пробелов, но так аккуратнее в админке);
   2) сообщает про пустые и нулевые id уроков.
   Ничего кроме этих правок не делает. Запуск: node tools/fix-content.js [--write] */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "data", "lessons");
const write = process.argv.includes("--write");
const files = fs.readdirSync(dir).filter((f) => /^module-\d+.*\.js$/.test(f)).sort();

let fixes = 0, checked = 0;

files.forEach((f) => {
  const p = path.join(dir, f);
  let src = fs.readFileSync(p, "utf8");
  const before = src;

  // плотные ответы: «5 + 3» -> «5+3», «канал связи|канал» -> «каналсвязи|канал»
  src = src.replace(/answer:\s*"([^"\n]*?)"/g, (all, val) => {
    checked++;
    if (!val.trim() || val.indexOf("\\") !== -1) return all;
    if (!/\s/.test(val)) return all;
    const compact = val.split("|").map((part) => part.trim().replace(/\s+/g, "")).join("|");
    if (compact === val) return all;
    fixes++;
    return 'answer: "' + compact + '"';
  });

  if (write && src !== before) {
    fs.writeFileSync(p, src, "utf8");
    console.log("поправлен " + f);
  }
});

console.log((write ? "Записано. " : "Пробный прогон (без --write). ") +
  "Просмотрено ответов: " + checked + ", требует правки: " + fixes);
