/* core/api.js — режим «контент из базы»: сайт берёт уроки из Payload (PostgreSQL) по REST.

   Как работает:
     • если window.SITE_API пусто — ничего не делаем, сайт живёт на файлах data/*.js;
     • если адрес задан — загружаем курсы, модули и уроки, собираем реестр уроков заново
       (App.registerModule с тем же полем course) и перерисовываем страницу;
     • если сервер недоступен — остаёмся на статике и пишем предупреждение в консоль,
       то есть сайт продолжает работать.

   Номера уроков (siteId) совпадают со статикой, поэтому прогресс в localStorage не теряется. */
(function () {
  "use strict";

  var API = {};
  App.api = API;

  var base = String(window.SITE_API || "").replace(/\/+$/, "");
  API.base = base;
  API.enabled = !!base;
  App.dataSource = base ? "api" : "static";
  App.dataSourceNote = base ? "контент из базы" : "контент из файлов";

  if (!base) return;

  function get(path) {
    return fetch(base + path, { headers: { Accept: "application/json" } }).then(function (r) {
      if (!r.ok) throw new Error("API " + r.status + " на " + path);
      return r.json();
    });
  }

  function optionsOf(t) {
    return (t.options || []).map(function (o) { return o.text; });
  }

  function filesOf(files) {
    return (files || []).map(function (f) {
      return { title: f.title, size: f.size || "", url: f.url || "", why: f.why || "" };
    });
  }

  /** документ Payload → урок в формате сайта */
  function toLesson(doc, moduleTitle, courseSlug) {
    var l = {
      id: doc.siteId,
      course: courseSlug,
      module: courseSlug === "oge" ? "ОГЭ · " + moduleTitle : moduleTitle,
      title: doc.title,
      sub: doc.sub || "",
      kind: doc.kind || "lesson",
      minutes: doc.minutes || 7,
      theory: doc.theory || "",
      tasks: (doc.tasks || []).map(function (t) {
        var out = {
          id: t.tid,
          type: t.type || "input",
          q: t.q,
          answer: t.type === "choice" ? Number(t.answer) : String(t.answer),
          explain: t.explain || ""
        };
        if (t.type === "choice") out.options = optionsOf(t);
        return out;
      }),
      tasksCount: (doc.tasks || []).length
    };
    if (doc.practice && doc.practice.engine) {
      l.practice = {
        engine: doc.practice.engine,
        brief: doc.practice.brief || "",
        config: doc.practice.config || {}
      };
    }
    if (doc.oge && doc.oge.mode) {
      l.oge = {
        exam: doc.oge.exam || "",
        mode: doc.oge.mode,
        modeLabel: modeLabel(doc.oge.mode),
        ball: doc.oge.ball || 0,
        files: filesOf(doc.oge.files),
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

  function modeLabel(mode) {
    return {
      sim: "симуляция в сайте",
      download: "сначала скачать",
      real: "вживую в программе",
      exam: "полный вариант на время"
    }[mode] || mode;
  }

  API.load = function () {
    return Promise.all([
      get("/api/courses?limit=50&sort=order&depth=0"),
      get("/api/modules?limit=500&sort=order&depth=0"),
      get("/api/lessons?limit=1000&depth=0")
    ]).then(function (res) {
      var courses = res[0].docs || [];
      var modules = res[1].docs || [];
      var lessons = res[2].docs || [];
      if (!lessons.length) throw new Error("в базе нет уроков");

      /* курсы: подменяем описания, id-шники (base/oge) остаются прежними */
      courses.forEach(function (c) {
        App.COURSES.forEach(function (local) {
          if (local.id !== c.slug) return;
          local.name = c.name || local.name;
          local.short = c.short || local.short;
          local.kicker = c.kicker || local.kicker;
          local.note = c.note || local.note;
        });
      });

      var moduleById = {};
      modules.forEach(function (m) { moduleById[String(m.id)] = m; });
      var courseById = {};
      courses.forEach(function (c) { courseById[String(c.id)] = c; });

      /* собираем реестр уроков заново */
      var groups = {};
      var order = [];
      lessons.forEach(function (doc) {
        var course = courseById[String(doc.course && doc.course.id ? doc.course.id : doc.course)] || { slug: "base" };
        var mod = moduleById[String(doc.module && doc.module.id ? doc.module.id : doc.module)] || { title: "Прочее", order: 999 };
        var slug = course.slug || "base";
        var key = slug + "|" + (mod.order || 0) + "|" + mod.title;
        if (!groups[key]) {
          groups[key] = { slug: slug, title: mod.title || "Прочее", order: mod.order || 0, lessons: [] };
          order.push(key);
        }
        groups[key].lessons.push(toLesson(doc, mod.title || "Прочее", slug));
      });

      App._modules = [];
      App.LESSONS = [];
      order
        .sort(function (a, b) { return groups[a].order - groups[b].order; })
        .forEach(function (key) {
          var g = groups[key];
          g.lessons.sort(function (a, b) { return a.id - b.id; });
          App.registerModule(g.title, g.lessons, g.slug);
        });

      API.stats = {
        courses: courses.length,
        modules: order.length,
        lessons: App.LESSONS.length,
        base: App.course.lessons("base").length,
        oge: App.course.lessons("oge").length
      };
      App.dataSource = "api";
      App.dataSourceNote = "контент из базы: " + API.stats.lessons + " уроков";
      if (window.console && console.info) console.info("Контент загружен из базы:", API.stats);
      if (App.router && App.router.render) App.router.render();
      return API.stats;
    });
  };

  API.load().catch(function (e) {
    App.dataSource = "static";
    App.dataSourceNote = "контент из файлов (сервер недоступен)";
    App.apiError = e.message;
    if (window.console && console.warn) {
      console.warn("Не получилось загрузить контент из базы, работаю на файлах:", e.message);
    }
  });
})();
