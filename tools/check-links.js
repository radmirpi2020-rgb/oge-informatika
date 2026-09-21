/* tools/check-links.js — проверяет, что все файлы, на которые ссылается index.html и код, существуют.
   Запуск: node tools/check-links.js */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const problems = [];

/* 1. подключённые скрипты и стили */
const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]);
refs.forEach((r) => {
  if (/^https?:/.test(r)) return;
  if (!fs.existsSync(path.join(root, r))) problems.push("index.html ссылается на отсутствующий файл: " + r);
});
console.log("Ссылок в index.html: " + refs.length);

/* 2. картинки и озвучка из assets.js */
const assets = fs.readFileSync(path.join(root, "scripts", "core", "assets.js"), "utf8");
const files = [...assets.matchAll(/file:\s*"([^"]+)"/g)].map((m) => m[1]);
let missingMedia = 0;
files.forEach((f) => {
  const base = f.replace(/\.(jpg|png|webp|mp3|wav)$/i, "");
  const exts = [".jpg", ".png", ".webp", ".mp3", ".wav"];
  const found = exts.some((e) =>
    fs.existsSync(path.join(root, "assets", "images", base + e)) ||
    fs.existsSync(path.join(root, "assets", "audio", base + e)));
  if (!found) {
    missingMedia++;
    console.log("  картинки/озвучки пока нет: " + f + " (сайт просто не покажет её)");
  }
});
console.log("Файлов медиа в каталоге: " + files.length + ", отсутствуют: " + missingMedia);

/* 3. все ли скрипты core/data/practice/ai/pages существуют и подключены */
const dirs = ["scripts/core", "scripts/practice", "scripts/ai", "scripts/pages", "data"];
dirs.forEach((d) => {
  const full = path.join(root, d);
  if (!fs.existsSync(full)) { problems.push("нет папки " + d); return; }
  fs.readdirSync(full).filter((f) => f.endsWith(".js")).forEach((f) => {
    const rel = d + "/" + f;
    if (d === "data" || d === "scripts/core") return;         // data/lessons и сборка проверяются другими скриптами
    if (html.indexOf(rel) === -1) problems.push("файл не подключён в index.html: " + rel);
  });
});

if (problems.length) {
  console.log("\nПРОБЛЕМЫ (" + problems.length + "):");
  problems.forEach((p) => console.log("  ✗ " + p));
  process.exit(1);
}
console.log("\nВсе ссылки на месте, все скрипты подключены.");
