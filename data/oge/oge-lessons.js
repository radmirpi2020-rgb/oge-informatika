/* oge-lessons.js — второй курс на сайте: «Подготовка к ОГЭ».

   Берёт сгенерированный план (data/oge/course-plan.js → App.oge.COURSE) и политику
   доставки (data/oge/oge-delivery.js → App.oge.DELIVERY), превращает их в обычные
   уроки сайта с course: "oge" — чтобы работали движки, прогресс, провожатый и админка.

   id уроков ОГЭ начинаются с 1001, чтобы не пересекаться со школьным курсом (1–300).

   Если уроки курса уже собраны из базы (файл data/oge/oge-lessons-bundle.js, его пишет
   tools/export-from-payload.js), берём их и ничего не пересобираем.

   Тексты уроков и задания — следующий проход; сейчас урок несёт план: цель модуля,
   режим (симуляция / скачать / вживую), файлы к уроку, чек-лист и критерий закрытия. */
(function () {
  "use strict";

  /* из базы уже загружено — не дублируем */
  if ((App.LESSONS || []).some(function (l) { return l.course === "oge"; })) return;

  /* снимок курса из базы (data/oge/oge-lessons-bundle.js) — берём его, если он есть */
  if (App.oge && App.oge.LESSONS_BUNDLE && App.oge.LESSONS_BUNDLE.length) {
    var loaded = 0;
    App.oge.LESSONS_BUNDLE.forEach(function (m) {
      App.registerModule("ОГЭ · " + m.module, m.lessons, "oge");
      loaded += (m.lessons || []).length;
    });
    App.oge.lessonsRegistered = loaded;
    App.oge.dataSource = "bundle";
    return;
  }

  if (!App.oge || !App.oge.COURSE) return; /* план не сгенерирован — второго курса нет */

  var COURSE = App.oge.COURSE;
  var D = App.oge.DELIVERY || { assets: {}, assetsFor: function () { return []; }, simLimits: {}, realMinimum: {} };
  var FIRST_ID = 1000;

  var MODE = {
    sim: {
      label: "симуляция в сайте",
      what: "Тренируйся на интерактивном тренажёре: он проверяет ответ сразу, а ошибку объясняет."
    },
    download: {
      label: "сначала скачать",
      what: "Скачай файл из списка ниже и работай в нём, а не наугад."
    },
    real: {
      label: "вживую в программе",
      what: "Делай урок в настоящей программе: это единственный способ поймать формат и оформление, которые проверяют эксперты."
    },
    exam: {
      label: "полный вариант на время",
      what: "150 минут, без подсказок, с записью ответов в бланк и сохранением файлов как на экзамене."
    }
  };

  /* формат ответа по заданию — из спецификации ОГЭ */
  var FORMAT = {
    "13.1": ".odp (презентация), входной файл .odt",
    "13.2": ".odt (текстовый документ)",
    "14": "файл .ods (электронная таблица)",
    "15": "Кумир или .txt, если среды нет",
    "16": "файл программы (Python, C++, Паскаль, Java, C#, ШЯ)"
  };

  function examLabel(exam) {
    if (exam === "все") return "весь вариант";
    if (exam === "13–16") return "задания 13–16";
    return "задание " + exam;
  }

  function assetOf(key) {
    var a = D.assets[key];
    if (!a) return null;
    var size = a.mb == null ? "размер уточнить" : a.mb + " МБ";
    return { title: a.title, size: size, url: a.url || a.page || "", why: a.why || "" };
  }

  function filesOf(moduleId, keys) {
    var out = [];
    (keys || []).forEach(function (k) {
      var a = assetOf(k);
      if (a) out.push(a);
    });
    return out;
  }

  function stepsFor(mode, task, files) {
    var steps = [];
    if (mode === "exam") {
      steps.push("Сядь за компьютер, поставь таймер на 150 минут и отключи подсказки.");
      steps.push("Сначала часть 1 (задания 1–12) за 45 минут, потом 15 и 16, затем 13 и 14 — так советует разбор ошибок.");
      steps.push("Файлы сохраняй в тот же формат, что на экзамене: " + (FORMAT[task] || "как в задании") + ".");
      steps.push("Проверь себя по критериям и запиши, где потерял баллы.");
    } else if (mode === "real") {
      steps.push("Открой настоящую программу" + (files.length ? " (файлы ниже: " + files.map(function (f) { return f.title; }).join(", ") + ")" : "") + ".");
      steps.push("Сделай работу ровно по требованиям задания, а не «как получится».");
      steps.push("Сохрани результат в нужном формате: " + (FORMAT[task] || "как указано в задании") + ".");
      steps.push("Пройди чек-лист ниже и отметь урок пройденным только после этого.");
    } else if (mode === "download") {
      steps.push("Скачай файлы из списка ниже — они понадобятся в следующих уроках модуля.");
      steps.push("Открой скачанное и убедись, что программа (LibreOffice, Кумир или Python) видит формат.");
    } else {
      steps.push("Разбери теорию и реши задания тренажёра — он проверит ответ и объяснит ошибку.");
      steps.push("Если ответ не сходится дважды — вернись к разбору и найди, где потерял шаг.");
    }
    return steps;
  }

  function theoryFor(m, l, mod) {
    var mode = l.mode || "sim";
    var info = MODE[mode] || MODE.sim;
    var files = filesOf(m.id, m.downloads);
    var lines = [];

    lines.push("**" + examLabel(m.exam) + "** · " + (m.ball || 0) + " " +
      App.util.plural(m.ball || 0, "балл", "балла", "баллов") +
      " · модуль целиком " + m.hours + " ч · урок " + l.n + " из " + m.lessons.length + ".");
    if (mod && mod.goal) lines.push("Цель модуля: " + mod.goal);
    lines.push("");
    lines.push("**Режим урока — " + info.label + ".** " + info.what);
    lines.push("");
    lines.push("**Что делать**");
    stepsFor(mode, m.exam, files).forEach(function (s, i) { lines.push((i + 1) + ". " + s); });
    lines.push("");

    if (files.length) {
      lines.push("**Файлы к уроку**");
      files.forEach(function (f) {
        lines.push("• " + f.title + " — " + f.size + (f.url ? " — " + f.url : "") + (f.why ? ". " + f.why : ""));
      });
      lines.push("");
    }

    if (m.realMinimum) {
      lines.push("> **Лайфхак.** Минимум живых прогонов по этому модулю: " + m.realRuns +
        (m.realTimed ? " (из них на время: " + m.realTimed + ")" : "") + ". " + m.realMinimum + ".");
    }
    if (m.simLimit) {
      lines.push("!! **Ошибка.** " + m.simLimit);
    }
    if (mode !== "real" && mode !== "exam" && (m.exam === "13.1" || m.exam === "13.2" || m.exam === "14" || m.exam === "15" || m.exam === "16")) {
      lines.push("!! **Ошибка.** Формат ответа (" + (FORMAT[m.exam] || "как в задании") + ") проверяют эксперты: работа не в том формате получает 0 баллов.");
    }
    lines.push("");
    lines.push("**Статус урока.** Тексты и симуляции этого урока ещё пишутся: сейчас здесь план, файлы и чек-лист. " +
      "Урок можно отметить пройденным, если ты проделал его вживую.");
    if (m.check) lines.push("Модуль закрыт, когда: " + m.check + ".");
    if (mod && mod.gap && mod.gap.length) lines.push("Чего нет в школьном курсе: " + mod.gap.join("; ") + ".");
    return lines.join("\n");
  }

  var seq = FIRST_ID;
  COURSE.modules.forEach(function (m) {
    var mod = App.oge.module ? App.oge.module(m.id) : null;
    var lessons = m.lessons.map(function (l) {
      seq++;
      var mode = l.mode || "sim";
      var info = MODE[mode] || MODE.sim;
      var files = filesOf(m.id, m.downloads);
      return {
        id: seq,
        course: "oge",
        module: "ОГЭ · " + m.title,
        title: l.title,
        sub: info.label + " · " + examLabel(m.exam) + " · " + l.minutes + " мин",
        kind: "lesson",
        minutes: l.minutes,
        theory: theoryFor(m, l, mod),
        tasks: [],
        /* метаданные курса: нужны фильтрам, карточкам и провожатому */
        oge: {
          moduleId: m.id,
          exam: m.exam,
          lessonN: l.n,
          mode: mode,
          modeLabel: info.label,
          ball: m.ball,
          engine: m.engine,
          realRuns: m.realRuns || 0,
          realTimed: m.realTimed || 0,
          downloads: m.downloads || [],
          files: files,
          simLimit: m.simLimit || "",
          check: m.check || "",
          goal: mod && mod.goal ? mod.goal : "",
          shortTrack: !!(App.oge.COURSE.short && App.oge.COURSE.short.modules.some(function (sm) {
            if (sm.id !== m.id) return false;
            return sm.lessons.some(function (sl) { return sl.n === l.n; });
          }))
        }
      };
    });
    App.registerModule("ОГЭ · " + m.title, lessons, "oge");
  });

  App.oge.lessonsRegistered = seq - FIRST_ID;
  App.oge.shortTrackLessons = (function () {
    var n = 0;
    (App.LESSONS || []).forEach(function (l) { if (l.oge && l.oge.shortTrack) n++; });
    return n;
  })();
})();
