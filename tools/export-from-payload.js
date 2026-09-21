/* export-from-payload.js — выгружает контент из базы (Payload + PostgreSQL) в файлы сайта.

   Зачем: сайт работает без сборки и без сервера, поэтому база — источник истины,
   а файлы data/*.js — снимок для офлайна и для проверок. Этот скрипт снимок обновляет.

   Что пишет:
     data/lessons-bundle.js          — школьный курс 5–9 (300 уроков), как его собирает tools/build-lessons.js
     data/oge/oge-lessons-bundle.js  — курс ОГЭ (100 уроков) в виде данных для data/oge/oge-lessons.js

   Запуск:
     node tools/export-from-payload.js                      # адрес по умолчанию http://127.0.0.1:3000
     node tools/export-from-payload.js http://server:3000   # свой адрес
     API_BASE=... node tools/export-from-payload.js         # или через переменную окружения

   Восстановить снимок из исходников: node tools/build-lessons.js (школьный курс). */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_BASE = path.join(ROOT, "data", "lessons-bundle.js");
const OUT_OGE = path.join(ROOT, "data", "oge", "oge-lessons-bundle.js");

const BASE = (process.argv[2] || process.env.API_BASE || "http://127.0.0.1:3000").replace(/\/+$/, "");

const MODE_LABEL = {
  sim: "симуляция в сайте",
  download: "сначала скачать",
  real: "вживую в программе",
  exam: "полный вариант на время"
};

async function get(pathname) {
  const res = await fetch(BASE + pathname, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`API ${res.status} на ${pathname}`);
  return res.json();
}

function toLesson(doc, moduleTitle, courseSlug) {
  const l = {
    id: doc.siteId,
    module: courseSlug === "oge" ? "ОГЭ · " + moduleTitle : moduleTitle,
    title: doc.title,
    sub: doc.sub || "",
    kind: doc.kind || "lesson",
    minutes: doc.minutes || 7,
    theory: doc.theory || "",
    tasks: (doc.tasks || []).map((t) => {
      const out = {
        id: t.tid,
        type: t.type || "input",
        q: t.q,
        answer: t.type === "choice" ? Number(t.answer) : String(t.answer),
        explain: t.explain || ""
      };
      if (t.type === "choice") out.options = (t.options || []).map((o) => o.text);
      return out;
    })
  };
  if (doc.practice && doc.practice.engine) {
    l.practice = { engine: doc.practice.engine, brief: doc.practice.brief || "", config: doc.practice.config || {} };
  }
  if (doc.oge && doc.oge.mode) {
    l.oge = {
      exam: doc.oge.exam || "",
      mode: doc.oge.mode,
      modeLabel: MODE_LABEL[doc.oge.mode] || doc.oge.mode,
      ball: doc.oge.ball || 0,
      files: (doc.oge.files || []).map((f) => ({ title: f.title, size: f.size || "", url: f.url || "", why: f.why || "" })),
      realRuns: doc.oge.realRuns || 0,
      realTimed: doc.oge.realTimed || 0,
      shortTrack: !!doc.oge.shortTrack,
      simLimit: doc.oge.simLimit || "",
      check: doc.oge.check || "",
      goal: doc.oge.goal || ""
    };
  }
  return l;
}

async function main() {
  console.log("Источник: " + BASE);

  const [coursesRes, modulesRes, lessonsRes] = await Promise.all([
    get("/api/courses?limit=50&sort=order&depth=0"),
    get("/api/modules?limit=500&sort=order&depth=0"),
    get("/api/lessons?limit=1000&depth=0")
  ]);

  const courses = coursesRes.docs || [];
  const modules = modulesRes.docs || [];
  const lessons = lessonsRes.docs || [];
  if (!lessons.length) throw new Error("в базе нет уроков — сначала импорт: pnpm seed (в папке server)");

  const moduleById = new Map(modules.map((m) => [String(m.id), m]));
  const courseById = new Map(courses.map((c) => [String(c.id), c]));

  const groups = new Map();
  for (const doc of lessons) {
    const courseId = doc.course && doc.course.id ? doc.course.id : doc.course;
    const moduleId = doc.module && doc.module.id ? doc.module.id : doc.module;
    const slug = (courseById.get(String(courseId)) || {}).slug || "base";
    const mod = moduleById.get(String(moduleId)) || { title: "Прочее", order: 999 };
    const key = slug + "|" + mod.order + "|" + mod.title;
    if (!groups.has(key)) groups.set(key, { slug, title: mod.title || "Прочее", order: mod.order || 0, lessons: [] });
    groups.get(key).lessons.push(toLesson(doc, mod.title || "Прочее", slug));
  }

  const sorted = [...groups.values()].sort((a, b) => a.order - b.order);
  const base = sorted.filter((g) => g.slug === "base");
  const oge = sorted.filter((g) => g.slug === "oge");

  /* --- школьный курс: тот же формат, что у tools/build-lessons.js --- */
  const stamp = new Date().toISOString();
  const lines = [];
  lines.push("/* lessons-bundle.js — ЭКСПОРТ ИЗ БАЗЫ (Payload + PostgreSQL)");
  lines.push("   Сгенерировано: tools/export-from-payload.js, " + stamp + ", источник " + BASE);
  lines.push("   Модулей: " + base.length + ", уроков: " + base.reduce((n, g) => n + g.lessons.length, 0));
  lines.push("   Пересобрать из исходников data/lessons/*.js: node tools/build-lessons.js */");
  lines.push("(function () {");
  lines.push('  "use strict";');
  for (const g of base) {
    lines.push("");
    lines.push("  /* ==== " + g.title + " ==== */");
    lines.push("  App.registerModule(" + JSON.stringify(g.title) + ", " + JSON.stringify(g.lessons, null, 0) + ', "base");');
  }
  lines.push("");
  lines.push("  App.MODULES = (App.MODULE_ORDER || []).slice();");
  lines.push("})();");
  lines.push("");
  fs.writeFileSync(OUT_BASE, lines.join("\n"), "utf8");

  /* --- курс ОГЭ: данные, их подхватывает data/oge/oge-lessons.js --- */
  const ogeOut = [];
  ogeOut.push("/* oge-lessons-bundle.js — ЭКСПОРТ КУРСА ОГЭ ИЗ БАЗЫ (Payload + PostgreSQL)");
  ogeOut.push("   Сгенерировано: tools/export-from-payload.js, " + stamp);
  ogeOut.push("   Модулей: " + oge.length + ", уроков: " + oge.reduce((n, g) => n + g.lessons.length, 0));
  ogeOut.push("   Подхватывается data/oge/oge-lessons.js; если файла нет — курс собирается из course-plan.js */");
  ogeOut.push("App.oge = App.oge || {};");
  ogeOut.push("App.oge.LESSONS_BUNDLE = " + JSON.stringify(
    oge.map((g) => ({ module: g.title, lessons: g.lessons })),
    null,
    0
  ) + ";");
  ogeOut.push("");
  fs.writeFileSync(OUT_OGE, ogeOut.join("\n"), "utf8");

  console.log("Школьный курс: модулей " + base.length + ", уроков " + base.reduce((n, g) => n + g.lessons.length, 0) + " → data/lessons-bundle.js");
  console.log("Курс ОГЭ:      модулей " + oge.length + ", уроков " + oge.reduce((n, g) => n + g.lessons.length, 0) + " → data/oge/oge-lessons-bundle.js");
  console.log("Проверки сайта: node tools/smoke-test.js && node tools/render-test.js");
}

main().catch((e) => {
  console.error("Ошибка экспорта: " + e.message);
  console.error("Проверь, что сервер поднят: cd server && pnpm db:start && pnpm dev");
  process.exit(1);
});
