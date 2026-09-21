/* tools/debug-float.js — диагностика: превращается ли «16.0» в PyFloat */
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "scripts", "practice", "python-lite.js");
let src = fs.readFileSync(file, "utf8");

// маркеры в ключевых местах
src = src.replace('out.push({ t: "num", v: parseFloat(num), float: isF })',
  'console.error("LEX num:", num, "isF:", isF); out.push({ t: "num", v: parseFloat(num), float: isF })');
src = src.replace('case "float":', 'case "float": console.error("EVAL float:", node.v);');
src = src.replace('if (isFloat(v)) {\n      var f = v.v;', 'if (isFloat(v)) {\n      console.error("PYSTR float:", v.v);\n      var f = v.v;');

global.window = global;
global.App = {};
eval(src);

const r = App.python.run('print(16.0)');
console.error("вывод:", JSON.stringify(r.out));
