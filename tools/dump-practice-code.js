/* tools/dump-practice-code.js — выгружает starter/solution/expected практик в файлы,
   чтобы их можно было прогнать настоящим Python.
   Запуск: node tools/dump-practice-code.js 183 186 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dir = path.join(root, "data", "lessons");
const out = path.join(root, "tools", "dump");
if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

const want = process.argv.slice(2).map(Number);
const files = fs.readdirSync(dir).filter((f) => /^module-\d+.*\.js$/.test(f)).sort();

files.forEach((f) => {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  const start = src.indexOf("(function");
  if (start === -1) return;
  let lessons;
  try {
    lessons = new Function("App", "return " + src.slice(start).trim())({ registerModule: () => {} });
  } catch (e) { console.log("[" + f + "] не разобрался: " + e.message); return; }
  (lessons || []).forEach((l) => {
    if (!want.length || want.includes(l.id)) {
      if (!l.practice || l.practice.engine !== "code") return;
      const c = l.practice.config || {};
      fs.writeFileSync(path.join(out, l.id + "-starter.py"), c.starter || "", "utf8");
      fs.writeFileSync(path.join(out, l.id + "-solution.py"), c.solution || "", "utf8");
      fs.writeFileSync(path.join(out, l.id + "-expected.txt"), String(c.expected == null ? "" : c.expected), "utf8");
      console.log("выгружен урок " + l.id);
    }
  });
});
