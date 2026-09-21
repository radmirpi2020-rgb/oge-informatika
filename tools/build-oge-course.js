/* build-oge-course.js — генератор ОГЭ-курса: собирает 100 уроков из реестра
   (data/oge/oge-course.js) и политики доставки (data/oge/oge-delivery.js).

   Шаблон и правила: docs/OGE-COURSE-TEMPLATE.md

   Запуск:  node tools/build-oge-course.js
   Пишет:
     docs/OGE-COURSE-CONTENT.md        — готовый курс: 16 заданий, 100 уроков, режимы
     data/oge/course-plan.js           — машиночитаемый план (App.oge.COURSE)
     data/oge/delivery-manifest.json   — что скачать, сколько раз делать вживую

   Падает, если не сходится: 100 уроков, 21 балл, режимы у всех уроков,
   живые прогоны не ниже минимума, ключи загрузок существуют, все задания закрыты. */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OGE = path.join(ROOT, "data", "oge");

/* --- загружаем данные курса: подсовываем минимальный App, как в браузере --- */
const App = {};
const src =
  fs.readFileSync(path.join(OGE, "oge-course.js"), "utf8") + "\n" +
  fs.readFileSync(path.join(OGE, "oge-delivery.js"), "utf8") +
  "\n;App.__oge = App.oge;";
new Function("App", "window", src)(App, { App });

const og = App.__oge;
if (!og || !og.MODULES || !og.DELIVERY) {
  console.error("Не прочитаны App.oge.MODULES / App.oge.DELIVERY");
  process.exit(1);
}
const D = og.DELIVERY;

/* ---------- 1. собираем уроки ---------- */

function modeOf(moduleId, lessonNumber, title) {
  const ov = (D.modeOverrides && D.modeOverrides[moduleId]) || null;
  if (ov) {
    if (ov[lessonNumber]) return ov[lessonNumber];
    if (ov.default) return ov.default;
  }
  return D.modeFor(title);
}

function normLesson(raw, moduleId, i) {
  let l = raw;
  if (typeof l === "string") l = { t: l };
  const title = l.t || l.title;
  if (!title) throw new Error(`модуль ${moduleId}: у урока ${i + 1} нет заголовка`);
  const mode = l.mode || modeOf(moduleId, i + 1, title);
  const kind = l.kind ||
    (/^(практика|симуляц|проходим|разбор|проверка)/i.test(title.trim()) ? "practice"
      : /симуляц/i.test(title) ? "exam" : "lesson");
  return {
    id: `${moduleId}l${i + 1}`,
    n: i + 1,
    module: moduleId,
    title,
    kind,
    mode,
    engine: l.sim || (mode === "sim" ? og.module(moduleId).engine : null),
    real: l.real || 0
  };
}

const modules = og.MODULES.map((m) => {
  const perLesson = Math.max(6, Math.round((m.hours * 60) / m.lessons.length));
  const lessons = m.lessons.map((raw, i) => {
    const l = normLesson(raw, m.id, i);
    l.minutes = Math.max(6, Math.round((m.hours * 60) / m.lessons.length)) || perLesson;
    l.download = (l.mode === "download" || l.mode === "real") ? D.assetsFor(m.id) : [];
    return l;
  });
  const byMode = { sim: 0, download: 0, real: 0, exam: 0 };
  lessons.forEach((l) => { byMode[l.mode] = (byMode[l.mode] || 0) + 1; });
  const real = D.realOf(m.id);
  const task = og.task(m.exam) || null;
  return {
    id: m.id, n: m.n, exam: m.exam, order: m.order, title: m.title, sub: m.sub,
    ball: m.ball, hours: m.hours, goal: m.goal, check: m.check,
    engine: m.engine, base: m.base, gap: m.gap,
    lessons, byMode,
    downloads: D.assetsFor(m.id),
    realMinimum: real,
    realRuns: real ? real.runs : 0,
    realTimed: real ? real.timed : 0,
    simLimit: D.simLimits[m.id] || null,
    task
  };
});

const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
const totalRuns = modules.reduce((s, m) => s + m.realRuns, 0);
const totalTimed = modules.reduce((s, m) => s + m.realTimed, 0);
const byMode = { sim: 0, download: 0, real: 0, exam: 0 };
modules.forEach((m) => Object.keys(byMode).forEach((k) => { byMode[k] += m.byMode[k] || 0; }));

/* ---------- 1b. короткий трек ----------
   Уроки берутся из явного списка keepLessons (номера уроков модуля), плюс
   автоматически: все уроки «вживую» и «полный вариант» (иначе пропадут живые
   прогоны) и последний урок практического модуля (сдача и самопроверка). */

const SHORT = D.shortTrack || { weeks: 8, maxLessons: 80, keepLessons: {}, keepLastOf: [], rule: "", drop: "" };
const shortReason = new Map(); /* id урока → почему он в коротком треке */

modules.forEach((m) => {
  const keep = SHORT.keepLessons[m.id] || m.lessons.map((l) => l.n);
  m.lessons.forEach((l, i) => {
    const isLast = i === m.lessons.length - 1;
    if (l.mode === "real" || l.mode === "exam") shortReason.set(l.id, "живой прогон");
    else if (SHORT.keepLastOf.indexOf(m.id) >= 0 && isLast) shortReason.set(l.id, "сдача и самопроверка");
    else if (keep.indexOf(l.n) >= 0) shortReason.set(l.id, "ядро модуля");
  });
});

const shortModules = modules.map((m) => {
  const lessons = m.lessons.filter((l) => shortReason.has(l.id));
  const shortByMode = { sim: 0, download: 0, real: 0, exam: 0 };
  lessons.forEach((l) => { shortByMode[l.mode] = (shortByMode[l.mode] || 0) + 1; });
  return {
    id: m.id, exam: m.exam, title: m.title, ball: m.ball, engine: m.engine,
    wasLessons: m.lessons.length, lessons, byMode: shortByMode,
    dropped: m.lessons.filter((l) => !shortReason.has(l.id)),
    realRuns: m.realRuns, realMinimum: m.realMinimum
  };
}).filter((m) => m.lessons.length > 0);

const shortTotal = shortModules.reduce((s, m) => s + m.lessons.length, 0);
const shortByMode = { sim: 0, download: 0, real: 0, exam: 0 };
shortModules.forEach((m) => Object.keys(shortByMode).forEach((k) => { shortByMode[k] += m.byMode[k] || 0; }));
const shortRuns = shortModules.reduce((s, m) => s + (m.realRuns || 0), 0);

/* ---------- 2. проверки, без которых файлы не пишем ---------- */

const problems = [];
const totalBall = og.totalBall();
const REQUIRE_LESSONS = 100;

if (totalLessons !== REQUIRE_LESSONS) {
  problems.push(`уроков ${totalLessons}, а по шаблону должно быть ${REQUIRE_LESSONS}`);
}
if (totalBall !== 21) {
  problems.push(`сумма баллов по плану ${totalBall}, а по спецификации 21`);
}
modules.forEach((m) => {
  m.lessons.forEach((l) => {
    if (!["sim", "download", "real", "exam"].includes(l.mode)) {
      problems.push(`${m.id}: у урока «${l.title}» неизвестный режим ${l.mode}`);
    }
  });
  m.downloads.forEach((key) => {
    if (!D.assets[key]) problems.push(`${m.id}: в загрузках указан неизвестный ключ «${key}»`);
  });
  if (m.realMinimum) {
    const live = m.byMode.real + m.byMode.exam + m.byMode.download;
    if (live < 1) problems.push(`${m.id}: есть минимум живых прогонов, но ни один урок не живой`);
  }
});
["d13", "d14", "d15", "d16", "d17"].forEach((id) => {
  const m = modules.find((x) => x.id === id);
  if (!m) { problems.push(`нет модуля ${id}`); return; }
  if (!m.byMode.real && !m.byMode.exam) problems.push(`${id}: нет ни одного урока в реальном инструменте`);
  if (!m.byMode.sim) problems.push(`${id}: нет ни одного урока-симуляции`);
});
["d0", "d18"].forEach((id) => {
  const m = modules.find((x) => x.id === id);
  if (m && !m.byMode.exam) problems.push(`${id}: нужна хотя бы одна полная симуляция (режим exam)`);
});
const closedTasks = new Set(modules.filter((m) => m.exam !== "все" && m.exam !== "13–16").map((m) => m.exam));
closedTasks.add("13.1"); closedTasks.add("13.2"); /* закрыты модулями d13 и d14 */
og.EXAM.plan.forEach((t) => {
  if (!closedTasks.has(t.n)) problems.push(`задание ${t.n} не закрыто ни одним модулем`);
});

/* короткий трек: те же живые прогоны, но меньше уроков */
if (shortTotal > SHORT.maxLessons) {
  problems.push(`в коротком треке ${shortTotal} уроков, а потолок ${SHORT.maxLessons}`);
}
if (shortByMode.real !== byMode.real || shortByMode.exam !== byMode.exam) {
  problems.push("короткий трек потерял уроки «вживую» или полные варианты — так нельзя");
}
if (shortRuns !== totalRuns) {
  problems.push(`в коротком треке ${shortRuns} живых прогонов вместо ${totalRuns}`);
}
shortModules.forEach((m) => {
  if (m.lessons.length < 2) problems.push(`${m.id}: в коротком треке остался ${m.lessons.length} урок — мало`);
});
SHORT.keepLastOf.forEach((id) => {
  const full = modules.find((m) => m.id === id);
  const short = shortModules.find((m) => m.id === id);
  if (!full || !short) { problems.push(`${id}: модуль выпал из короткого трека`); return; }
  const last = full.lessons[full.lessons.length - 1];
  if (!short.lessons.some((l) => l.id === last.id)) {
    problems.push(`${id}: выброшен последний урок «${last.title}» — он про сдачу и самопроверку`);
  }
});
modules.forEach((m) => {
  if (m.realMinimum && !shortModules.some((s) => s.id === m.id)) {
    problems.push(`${m.id}: модуль с обязательными живыми прогонами выпал из короткого трека`);
  }
});

/* ---------- 3. пишем машиночитаемый план ---------- */

const stamp = new Date().toISOString();
const planJs = `/* course-plan.js — СГЕНЕРИРОВАНО tools/build-oge-course.js, руками не правим.
   Источник: data/oge/oge-course.js + data/oge/oge-delivery.js.
   Шаблон: docs/OGE-COURSE-TEMPLATE.md. Собрано: ${stamp}

   ${totalLessons} уроков, ${totalBall} балл(ов), ${totalRuns} живых прогонов (из них ${totalTimed} на время).
   Режимы уроков: sim — симуляция в сайте, download — сначала скачать, real — делать в настоящей
   программе, exam — полная симуляция на 150 минут. */
(function () {
  "use strict";

  var og = App.oge = App.oge || {};

  og.COURSE = {
    generatedAt: ${JSON.stringify(stamp)},
    lessonsTotal: ${totalLessons},
    maxPrimary: ${totalBall},
    realRuns: ${totalRuns},
    realTimed: ${totalTimed},
    byMode: ${JSON.stringify(byMode, null, 2).replace(/\n/g, "\n    ")},
    /* короткий трек: ${shortTotal} уроков из ${totalLessons}, живых прогонов столько же */
    short: {
      target: ${SHORT.target},
      weeks: ${SHORT.weeks},
      lessonsTotal: ${shortTotal},
      realRuns: ${shortRuns},
      byMode: ${JSON.stringify(shortByMode, null, 2).replace(/\n/g, "\n      ")},
      modules: ${JSON.stringify(shortModules.map((m) => ({
        id: m.id, exam: m.exam, was: m.wasLessons, now: m.lessons.length,
        lessons: m.lessons.map((l) => ({ id: l.id, n: l.n, title: l.title, mode: l.mode })),
        dropped: m.dropped.map((l) => l.title)
      })), null, 2).replace(/\n/g, "\n      ")}
    },
    modules: ${JSON.stringify(modules.map((m) => ({
      id: m.id, exam: m.exam, title: m.title, ball: m.ball, hours: m.hours,
      engine: m.engine, downloads: m.downloads,
      realRuns: m.realRuns, realTimed: m.realTimed,
      realMinimum: m.realMinimum ? m.realMinimum.what : null,
      simLimit: m.simLimit,
      check: m.check,
      lessons: m.lessons.map((l) => ({ id: l.id, n: l.n, title: l.title, kind: l.kind, mode: l.mode, minutes: l.minutes }))
    })), null, 2).replace(/\n/g, "\n    ")}
  };
})();
`;
fs.writeFileSync(path.join(OGE, "course-plan.js"), planJs, "utf8");

const manifest = {
  generatedAt: stamp,
  rule: D.rule,
  simMaxMb: D.simMaxMb,
  totals: {
    lessons: totalLessons,
    ball: totalBall,
    modules: modules.length,
    realRuns: totalRuns,
    realTimed: totalTimed,
    byMode
  },
  downloads: {
    tools: Object.keys(D.assets).filter((k) => D.assets[k].kind === "tool").map((k) => Object.assign({ key: k }, D.assets[k])),
    data: Object.keys(D.assets).filter((k) => D.assets[k].kind !== "tool").map((k) => Object.assign({ key: k }, D.assets[k])),
    totalMbTools: Object.keys(D.assets)
      .filter((k) => D.assets[k].kind === "tool" && D.assets[k].mb)
      .reduce((s, k) => s + D.assets[k].mb, 0)
  },
  shortTrack: {
    target: SHORT.target,
    weeks: SHORT.weeks,
    rule: SHORT.rule,
    drop: SHORT.drop,
    totals: { lessons: shortTotal, realRuns: shortRuns, byMode: shortByMode },
    modules: shortModules.map((m) => ({
      id: m.id, exam: m.exam, was: m.wasLessons, now: m.lessons.length,
      keptLessons: m.lessons.map((l) => l.n),
      droppedLessons: m.dropped.map((l) => l.title)
    }))
  },
  realMinimum: D.realMinimum,
  simLimits: D.simLimits,
  onlineInstead: D.onlineInstead,
  modules: modules.map((m) => ({
    id: m.id, exam: m.exam, ball: m.ball, hours: m.hours, lessons: m.lessons.length,
    byMode: m.byMode, downloads: m.downloads,
    realRuns: m.realRuns, realTimed: m.realTimed
  }))
};
fs.writeFileSync(path.join(OGE, "delivery-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

/* ---------- 4. пишем человеческий план ---------- */

const MODE_LABEL = {
  sim: "симуляция",
  download: "скачать",
  real: "вживую",
  exam: "симуляция 150 мин"
};
const assetLabel = (key) => {
  const a = D.assets[key];
  const mb = a.mb == null ? "размер уточнить" : `${a.mb} МБ`;
  return a.url ? `[${a.title}](${a.url}) — ${mb}` : `${a.title} — генерируем локально`;
};

let md = `# Курс подготовки к ОГЭ по информатике: 100 уроков

**СГЕНЕРИРОВАНО** \`tools/build-oge-course.js\` (${stamp}). Руками не правим: правьте
\`data/oge/oge-course.js\` и \`data/oge/oge-delivery.js\`, потом запускайте генератор.
Шаблон и правила: \`docs/OGE-COURSE-TEMPLATE.md\`.

## Как читать режимы

| Режим | Что делать ученику |
|---|---|
| симуляция | всё внутри сайта, с автопроверкой |
| скачать | сначала скачать файл (данные или инструмент) |
| вживую | обязательно в настоящей программе: LibreOffice, Кумир, Python, файловый менеджер |
| симуляция 150 мин | полный вариант на время |

## Итоги

| Показатель | Значение |
|---|---|
| Уроков | **${totalLessons}** |
| Модулей | ${modules.length} |
| Максимальный балл по плану КИМ | **${totalBall}** |
| Живых прогонов на реальных инструментах | **${totalRuns}** (из них ${totalTimed} на время) |
| Уроков-симуляций в сайте | ${byMode.sim} |
| Уроков «вживую» (реальный инструмент) | ${byMode.real} |
| Уроков «полный вариант на 150 минут» | ${byMode.exam} |

### Что скачать один раз (инструменты)

| Инструмент | Размер | Ссылка | Зачем |
|---|---|---|---|
${Object.keys(D.assets).filter((k) => D.assets[k].kind === "tool" && D.assets[k].mb > 0).map((k) => {
  const a = D.assets[k];
  return `| ${a.title} | ${a.mb} МБ | [скачать](${a.url}) | ${a.why} |`;
}).join("\n")}

**Итого инструментов: ${manifest.downloads.totalMbTools.toFixed(1)} МБ** (LibreOffice + Кумир + Python).
Онлайн-замены для черновика: ${Object.keys(D.assets).filter((k) => D.assets[k].kind === "tool" && !D.assets[k].mb).map((k) => `[${D.assets[k].title}](${D.assets[k].url})`).join(", ")} — итоговый ответ в них не сдаём.

**Не качаем архив ФИПИ целиком (113,7 МБ).** Берём из него только нужные файлы:
данные задания 14 (\`.ods\`) и заготовки задания 13 (картинки, образец текста).
Учебный архив файлов (задания 11–12) и большую таблицу (задание 14) генерируем локально.

---

`;

modules.forEach((m) => {
  const examLabel = m.exam === "все" ? "весь вариант" : `задание ${m.exam}`;
  md += `## ${m.order}. ${m.title} — ${examLabel}${m.ball && m.exam !== "все" ? ` (${m.ball} б.)` : ""}\n\n`;
  md += `- **Цель:** ${m.goal}\n`;
  md += `- **Часы:** ${m.hours}, уроков: ${m.lessons.length}, движок симуляции: \`${m.engine}\`\n`;
  if (m.ball && m.exam !== "все") md += `- **Балл на экзамене:** ${m.ball}\n`;
  if (m.downloads.length) {
    md += `- **Скачать до модуля:** ${m.downloads.map((k) => assetLabel(k)).join("; ")}\n`;
  }
  if (m.realMinimum) {
    md += `- **Вживую обязательно:** ${m.realMinimum.runs} прогон(ов)${m.realMinimum.timed ? `, из них ${m.realMinimum.timed} на время` : ""} — ${m.realMinimum.what}\n`;
  }
  if (m.simLimit) md += `- **Чего симуляция не проверит:** ${m.simLimit}\n`;
  md += `- **Модуль закрыт, когда:** ${m.check}\n\n`;
  md += `| № | Урок | Тип | Режим | Мин | Файлы к уроку |\n|---|---|---|---|---|---|\n`;
  m.lessons.forEach((l) => {
    const files = l.download && l.download.length
      ? l.download.map((k) => D.assets[k] ? D.assets[k].title : k).join(", ")
      : "—";
    md += `| ${l.n} | ${l.title} | ${l.kind} | ${MODE_LABEL[l.mode]} | ${l.minutes} | ${files} |\n`;
  });
  md += `\n`;
});

md += `## Короткий трек: ${shortTotal} уроков (если старт в марте)

Полный курс — ${totalLessons} уроков. Короткий трек — **${shortTotal} уроков за ${SHORT.weeks} недель**:
${SHORT.rule}

Отбрасывается: ${SHORT.drop}

| Модуль | Задание | Было уроков | Осталось | Оставлены (№) | Живых прогонов | Что выброшено |
|---|---|---|---|---|---|---|
${shortModules.map((m) =>
  `| ${m.id} | ${m.exam} | ${m.wasLessons} | ${m.lessons.length} | ${m.lessons.map((l) => l.n).join(", ")} | ${m.realRuns || "—"} | ${m.dropped.length ? m.dropped.map((l) => l.title).join("; ") : "ничего"} |`
).join("\n")}

**Живых прогонов в коротком треке столько же — ${shortRuns}** (режимы: симуляция ${shortByMode.sim}, вживую ${shortByMode.real}, полный вариант ${shortByMode.exam}).
Ни один урок «вживую» и ни одна симуляция на 150 минут не выброшены: трек короче только за счёт
расширяющих симуляций. Недельная раскладка короткого трека — \`App.oge.PLAN_SHORT\` (8 недель)
в \`data/oge/oge-course.js\`.

## Порядок живых прогонов (расписание «вживую»)

| Модуль | Задание | Прогонов | Из них на время | Что именно |
|---|---|---|---|---|
${modules.filter((m) => m.realMinimum).map((m) =>
  `| ${m.id} | ${m.exam} | ${m.realRuns} | ${m.realTimed} | ${m.realMinimum.what} |`
).join("\n")}

**Итого ${totalRuns} прогон(ов), из них ${totalTimed} на время.** Это минимум, а не цель:
после каждой симуляции на 150 минут добавляется ещё один прогон тех заданий, где потеряны баллы.

## Чем нельзя заменять настоящий инструмент

| Вместо чего | Онлайн-замена | Годится для | Не годится для |
|---|---|---|---|
${D.onlineInstead.map((o) =>
  `| ${o.instead} | ${o.online ? `[${o.online.replace("https://", "")}](${o.online})` : "—"} | ${o.ok || "—"} | ${o.notOk} |`
).join("\n")}

---

## Что дальше (наполнение)

Каркас из ${totalLessons} уроков собран, текстов не написано ни в одном. Порядок работы:

1. Наполнять модули по одному, начиная с самых дорогих: d15 (задание 14, 3 балла) → d16 (задание 15) →
   d17 (задание 16) → d13/d14 (задание 13).
2. В каждом уроке с режимом «вживую» — инструкция, чек-лист самопроверки и счётчик прогонов.
3. В каждом уроке со «скачать» — карточка загрузки (имя, размер, ссылка).
4. После наполнения модуля: \`node tools/build-oge-course.js\` и проверки сайта.
`;

fs.writeFileSync(path.join(ROOT, "docs", "OGE-COURSE-CONTENT.md"), md, "utf8");

/* ---------- 5. отчёт ---------- */

console.log(`Уроков: ${totalLessons}`);
console.log(`Баллов по плану КИМ: ${totalBall} из ${og.EXAM.maxPrimary}`);
console.log(`Режимы уроков: симуляция ${byMode.sim}, скачать ${byMode.download}, вживую ${byMode.real}, симуляция 150 мин ${byMode.exam}`);
console.log(`Живых прогонов: ${totalRuns}, из них на время: ${totalTimed}`);
console.log(`Короткий трек: ${shortTotal} уроков (живых прогонов столько же: ${shortRuns})`);
console.log(`Инструментов к загрузке: ${manifest.downloads.tools.length} (~${manifest.downloads.totalMbTools} МБ)`);
console.log(`Файлы: data/oge/course-plan.js, data/oge/delivery-manifest.json, docs/OGE-COURSE-CONTENT.md`);
if (problems.length) {
  console.log("\nПРОБЛЕМЫ:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
console.log("Проверки шаблона пройдены.");
