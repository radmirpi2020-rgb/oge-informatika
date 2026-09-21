/* tools/test-practices.js — прогоняет решения всех практик «code» через мини-интерпретатор.
   Запуск: node tools/test-practices.js [номер урока]
   Без аргумента проверяет все и печатает только расхождения.
   С номером урока — показывает полный вывод и код решения. */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dir = path.join(root, "data", "lessons");

global.window = global;
global.App = {};
eval(fs.readFileSync(path.join(root, "scripts", "practice", "python-lite.js"), "utf8"));
const py = App.python;

const files = fs.readdirSync(dir).filter((f) => /^module-\d+.*\.js$/.test(f)).sort();
const codes = [];

files.forEach((f) => {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  const start = src.indexOf("(function");
  if (start === -1) return;
  let lessons;
  try {
    lessons = new Function("App", "return " + src.slice(start).trim())({ registerModule: () => {} });
  } catch (e) {
    console.log("[" + f + "] не разобрался: " + e.message);
    return;
  }
  (lessons || []).forEach((l) => {
    if (l.practice && l.practice.engine === "code") codes.push({ file: f, id: l.id, title: l.title, cfg: l.practice.config });
  });
});

const only = process.argv[2] ? Number(process.argv[2]) : null;
let bad = 0, good = 0;

codes.forEach((c) => {
  if (only && c.id !== only) return;
  const r = py.run(c.cfg.solution || "");
  const got = r.ok ? r.out.replace(/\s+$/, "") : "";
  const want = String(c.cfg.expected == null ? "" : c.cfg.expected).replace(/\s+$/, "");
  const ok = r.ok && got === want;
  if (only) {
    console.log("===== урок " + c.id + " (" + c.file + "): " + c.title);
    console.log("--- starter ---\n" + (c.cfg.starter || ""));
    console.log("--- solution ---\n" + (c.cfg.solution || ""));
    console.log("--- ожидалось ---\n" + want);
    console.log("--- получено ---\n" + (r.ok ? got : "ОШИБКА: " + r.error + (r.errorLine ? " (строка " + r.errorLine + ")" : "")));
    console.log("--- итог: " + (ok ? "ок" : "РАСХОЖДЕНИЕ") + "\n");
  }
  if (ok) good++;
  else {
    bad++;
    if (!only) {
      console.log("урок " + c.id + " [" + c.file + "]: " + (r.ok ? "вывод не совпал" : r.error + (r.errorLine ? " (строка " + r.errorLine + ")" : "")));
      console.log("   ожидалось: " + JSON.stringify(want.slice(0, 120)));
      console.log("   получено:  " + JSON.stringify(got.slice(0, 120)));
    }
  }
});

if (!only) console.log("\nПрактик с кодом: " + codes.length + ", совпало: " + good + ", расхождений: " + bad);
process.exit(bad ? 1 : 0);
