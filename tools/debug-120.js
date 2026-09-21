/* tools/debug-120.js — показывает точную ошибку разбора для практик 120, 183, 186 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const dir = path.join(root, "data", "lessons");

global.window = global;
global.App = {};
eval(fs.readFileSync(path.join(root, "scripts", "practice", "python-lite.js"), "utf8"));

const want = process.argv.slice(2).map(Number);
const files = fs.readdirSync(dir).filter((f) => /^module-\d+.*\.js$/.test(f)).sort();

files.forEach((f) => {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  const start = src.indexOf("(function");
  if (start === -1) return;
  let lessons;
  try {
    lessons = new Function("App", "return " + src.slice(start).trim())({ registerModule: () => {} });
  } catch (e) { return; }
  (lessons || []).forEach((l) => {
    if (!want.length || want.includes(l.id)) {
      if (!l.practice) return;
      const cfg = l.practice.config || {};
      if (l.practice.engine !== "code") return;
      console.log("===== урок " + l.id + " — " + l.title);
      console.log("--- solution ---");
      console.log(cfg.solution);
      const r = App.python.run(cfg.solution);
      console.log("--- результат: " + (r.ok ? "ок" : r.error + (r.errorLine ? " (строка " + r.errorLine + ")" : "")));
      console.log("--- вывод ---");
      console.log(r.out || "(пусто)");
      const want2 = String(cfg.expected).replace(/\s+$/, "");
      console.log("--- ожидалось ---");
      console.log(want2);
      console.log("");
    }
  });
});
