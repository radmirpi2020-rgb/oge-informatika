/* tools/patch-lesson-config.js — аккуратно меняет поля практики в файле данных урока.
   Читает новый текст из отдельного файла (чтобы не мучиться с экранированием)
   и записывает его как JSON-строку.

   Запуск: node tools/patch-lesson-config.js --file data/lessons/module-08-graphs.js \
             --lesson 183 --field solution --text tools/patch/183-solution.py */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf("--" + name);
  return i === -1 ? def : args[i + 1];
}

const file = arg("file");
const lessonId = Number(arg("lesson"));
const field = arg("field");
const textFile = arg("text");

if (!file || !lessonId || !field || !textFile) {
  console.error("нужны --file --lesson --field --text");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const absFile = path.isAbsolute(file) ? file : path.join(root, file);
const absText = path.isAbsolute(textFile) ? textFile : path.join(root, textFile);

const src = fs.readFileSync(absFile, "utf8");
const value = fs.readFileSync(absText, "utf8").replace(/\r\n/g, "\n").replace(/\n$/, "");

const anchor = "id: " + lessonId + ", module";
const start = src.indexOf(anchor);
if (start === -1) { console.error("не нашёл урок " + lessonId); process.exit(1); }

// границы секции практики: до "tasks:" после начала урока
const tasksAt = src.indexOf("tasks:", start);
const scope = src.slice(start, tasksAt === -1 ? start + 8000 : tasksAt);

const re = new RegExp("(" + field + ":\\s*)\"(?:[^\"\\\\]|\\\\.)*\"");
let replaced;
if (re.test(scope)) {
  replaced = scope.replace(re, (all, prefix) => prefix + JSON.stringify(value));
} else {
  // поля нет — вставляем его перед practice: или tasks:, либо в конец объекта урока
  const anchorMatch = /\n(\s*)(practice|tasks):/.exec(scope);
  if (!anchorMatch) { console.error("не нашёл, куда вставить поле " + field + " в уроке " + lessonId); process.exit(1); }
  const indent = anchorMatch[1];
  const at = anchorMatch.index;
  replaced = scope.slice(0, at) + "\n" + indent + field + ": " + JSON.stringify(value) + "," + scope.slice(at);
}
fs.writeFileSync(absFile, src.slice(0, start) + replaced + src.slice(start + scope.length), "utf8");

console.log("урок " + lessonId + ": поле " + field + " " + (re.test(scope) ? "обновлено" : "добавлено") + " (" + value.length + " знаков)");
