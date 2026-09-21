/* tools/debug-sql.js — показывает конфиги и результаты SQL-практик */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const dir = path.join(root, "data", "lessons");

global.window = global;
global.App = {};
eval(fs.readFileSync(path.join(root, "scripts", "practice", "python-lite.js"), "utf8"));

const files = fs.readdirSync(dir).filter((f) => /^module-\d+.*\.js$/.test(f)).sort();
files.forEach((f) => {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  const start = src.indexOf("(function");
  if (start === -1) return;
  let lessons;
  try { lessons = new Function("App", "return " + src.slice(start).trim())({ registerModule: () => {} }); }
  catch (e) { return; }
  (lessons || []).forEach((l) => {
    if (!l.practice || l.practice.engine !== "sql") return;
    const c = l.practice.config;
    console.log("===== урок " + l.id + " — " + l.title);
    console.log("task: " + String(c.task).slice(0, 300));
    console.log("таблица: " + c.table.name + " | колонки: " + c.table.columns.join(", "));
    console.log("строк: " + c.table.rows.length);
    console.log("solution: " + c.solution);
    console.log("expected: " + JSON.stringify(c.expected));
    // грузануть движок sql (он требует App.util? нет)
    const sqlSrc = fs.readFileSync(path.join(root, "scripts", "practice", "sql.js"), "utf8");
    new Function("App", sqlSrc)(global.App);
    try {
      const res = App.PRACTICE.sql.runQuery(c.solution, c.table);
      console.log("получилось: " + JSON.stringify(res.rows));
    } catch (e) {
      console.log("ОШИБКА: " + e.message);
    }
    console.log("");
  });
});
