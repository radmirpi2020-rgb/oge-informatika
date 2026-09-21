/* build-oge-modules.js — генерирует каркасы модулей ОГЭ-курса из data/oge/oge-course.js.

   Зачем генератор: список модулей, их цели, связи с базовыми уроками и «дыры»
   живут в одном месте (oge-course.js). Файлы модулей — производные, поэтому
   расхождений между реестром и файлами быть не может.

   Запуск:  node tools/build-oge-modules.js
   Файлы:   data/oge/module-NN-<id>.js  (перезаписываются, ручные тексты попадут в отдельные поля) */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "data", "oge", "oge-course.js");
const OUT = path.join(ROOT, "data", "oge");

/* --- загружаем реестр: подсовываем минимальный App, как в браузере --- */
const App = {};
new Function("App", "window", fs.readFileSync(SRC, "utf8") + "\n;App.__oge = App.oge;")(
  App,
  { App }
);
const og = App.__oge;
if (!og || !og.MODULES) {
  console.error("Не удалось прочитать App.oge.MODULES из", SRC);
  process.exit(1);
}

/* --- модули диагностики и симуляций пишутся не как «задание N», а как «весь вариант» --- */

/* --- имена файлов: порядковый номер + понятный слаг --- */
const SLUG = {
  d0: "diagnostic",
  d1: "task-01-text-volume",
  d2: "task-02-decoding",
  d3: "task-03-logic",
  d4: "task-04-graph-path",
  d5: "task-05-executor",
  d6: "task-06-trace-program",
  d7: "task-07-web-address",
  d8: "task-08-search-queries",
  d9: "task-09-graph-paths",
  d10: "task-10-numeral-systems",
  d11: "task-11-file-search",
  d12: "task-12-file-count",
  d13: "task-13-presentation",
  d14: "task-14-text-document",
  d15: "task-15-spreadsheet",
  d16: "task-16-robot",
  d17: "task-17-python",
  d18: "simulations"
};

const q = (s) => JSON.stringify(String(s));

/* Что даёт модуль: заголовки уроков берём из плана, время — по нормативу ФИПИ,
   если модуль закрывает конкретное задание.

   Урок в реестре может быть строкой ("Практика: ...") или объектом {kind,title,sub}.
   Строку превращаем в объект: kind угадываем по смыслу названия. */
function normLesson(l) {
  if (l && typeof l === "object") {
    return { kind: l.kind || "lesson", title: l.title, sub: l.sub || "" };
  }
  const text = String(l);
  const kind = /^(практика|симуляц|проходим|разбор|проверка)/i.test(text.trim()) ? "practice"
    : /симуляц/i.test(text) ? "exam"
    : "lesson";
  return { kind, title: text, sub: "" };
}

function lessonLines(m) {
  const task = og.task(m.exam);
  const total = task ? task.min : 0;
  const perLesson = Math.max(6, Math.round((m.hours * 60) / m.lessons.length));
  return m.lessons.map((raw, i) => {
    const l = normLesson(raw);
    if (!l.title || typeof l.title !== "string") {
      throw new Error(`модуль ${m.id}: у урока ${i + 1} нет названия`);
    }
    return (
      `      { n: ${i + 1}, kind: ${q(l.kind)}, title: ${q(l.title)}, ` +
      `sub: ${q(l.sub)}, minutes: ${l.minutes || perLesson} }`
    );
  }).join(",\n") + (task ? `\n      /* норматив ФИПИ на задание ${task.n}: ${total} мин */` : "");
}

function render(m, index) {
  const file = `module-${String(index).padStart(2, "0")}-${SLUG[m.id]}.js`;
  const examLabel = m.exam === "все" ? "весь вариант" : "задание " + m.exam;
  return `/* ${file} — ОГЭ-курс, модуль ${m.n} «${m.title}» (${examLabel})

   СТАТУС: каркас. Тексты уроков (theory) и задания (tasks/practice)
   дописываются отдельным проходом; формат полей описан в docs/OGE-COURSE.md.

   Данные модуля (цель, баллы, часы, движок практики, связи с базовым курсом)
   лежат в data/oge/oge-course.js и здесь не дублируются. */
(function () {
  "use strict";

  var M = ${q("ОГЭ · " + m.title)};

  App.OGE_PLAN = App.OGE_PLAN || [];
  App.OGE_PLAN.push({
    id: ${q(m.id)},
    moduleId: ${q(m.id)},
    exam: ${q(m.exam)},
    name: M,
    ball: ${m.ball},
    hours: ${m.hours},
    engine: ${q(m.engine)},
    status: "каркас",
    goal: ${q(m.goal)},
    lessons: [
${lessonLines(m)}
    ],
    /* готовые уроки базового курса 5–9, которые закрывают тему */
    base: [${m.base.join(", ")}],
    /* чего в базовом курсе нет — это и есть работа по второму курсу */
    gap: [
${m.gap.map((g) => "      " + q(g)).join(",\n")}
    ],
    check: ${q(m.check)}
  });
})();
`;
}

let written = 0;
const manifest = [];
og.MODULES.forEach((m, i) => {
  const file = `module-${String(i + 1).padStart(2, "0")}-${SLUG[m.id]}.js`;
  fs.writeFileSync(path.join(OUT, file), render(m, i + 1), "utf8");
  manifest.push({ file, id: m.id, exam: m.exam, ball: m.ball, hours: m.hours, lessons: m.lessons.length, gaps: m.gap.length });
  written++;
});

/* --- проверки согласованности: сумма баллов должна быть 21 --- */
const total = og.totalBall();
const problems = [];
if (total !== 21) problems.push(`сумма баллов по заданиям = ${total}, а по спецификации 21`);

const examTasks = og.EXAM.plan.map((t) => t.n);
const moduleExams = new Set(og.MODULES.filter((m) => m.exam !== "все" && m.exam !== "13–16").map((m) => m.exam));
examTasks.forEach((n) => {
  if (n === "13.1" || n === "13.2") return; /* оба варианта закрыты модулями d13 и d14 */
  if (!moduleExams.has(n)) problems.push(`задание ${n} не закрыто ни одним модулем`);
});

const manifestPath = path.join(OUT, "MANIFEST.json");
fs.writeFileSync(manifestPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  examYear: og.EXAM.year,
  maxPrimary: og.EXAM.maxPrimary,
  totalBallFromPlan: total,
  partMinutes: { part1: og.partMinutes(1), part2: og.partMinutes(2) },
  modules: manifest
}, null, 2) + "\n", "utf8");

console.log(`Сгенерировано файлов модулей: ${written}`);
console.log(`Сумма баллов по плану КИМ: ${total} из ${og.EXAM.maxPrimary}`);
console.log(`Норматив времени: часть 1 — ${og.partMinutes(1)} мин, часть 2 — ${og.partMinutes(2)} мин`);
console.log(`Манифест: ${path.relative(ROOT, manifestPath)}`);
if (problems.length) {
  console.log("\nПРОБЛЕМЫ:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
console.log("Проверки согласованности пройдены.");
