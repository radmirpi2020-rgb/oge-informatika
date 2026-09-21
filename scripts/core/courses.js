/* courses.js — два курса на одном сайте.

   Курс 1 «Информатика 5–9 класс» — школьная программа: 300 уроков и практик
   (data/lessons/module-*.js, поле course не заполнено → считается первым курсом).
   Курс 2 «Подготовка к ОГЭ» — экзаменационный: 100 уроков по 16 заданиям
   (data/oge/oge-lessons.js собирает их из сгенерированного плана App.oge.COURSE).

   Здесь только реестр курсов, текущий курс и общий переключатель. Прогресс и
   фильтры живут там, где и раньше: ST.summary(course), ST.allLessons(course). */
(function () {
  "use strict";

  App.COURSES = [
    {
      id: "base",
      name: "Информатика 5–9 класс",
      short: "5–9 класс",
      kicker: "Курс 1 · школьная программа",
      note: "Программа 5–9 классов: уроки, практики, проекты. Основа для любого экзамена."
    },
    {
      id: "oge",
      name: "Подготовка к ОГЭ",
      short: "ОГЭ",
      kicker: "Курс 2 · экзамен 2026/2027",
      note: "16 заданий, 21 балл, 150 минут. Практика — в настоящих LibreOffice, Кумире и Python."
    }
  ];

  var C = App.course = {};

  C.all = function () { return App.COURSES; };

  C.get = function (id) {
    for (var i = 0; i < App.COURSES.length; i++) if (App.COURSES[i].id === id) return App.COURSES[i];
    return App.COURSES[0];
  };

  /** текущий выбранный курс (хранится в localStorage) */
  C.current = function () { return C.get(App.storage.get(App.storage.KEYS.course, "base")).id; };

  C.set = function (id) { App.storage.set(App.storage.KEYS.course, C.get(id).id); };

  C.currentDef = function () { return C.get(C.current()); };

  /** курс конкретного урока: у уроков школьного курса поле course пустое */
  C.ofLesson = function (l) { return (l && l.course) || "base"; };

  C.isOge = function (l) { return C.ofLesson(l) === "oge"; };

  /** уроки курса (сырые, без правок из админки) */
  C.lessons = function (id) {
    id = id || C.current();
    return (App.LESSONS || []).filter(function (l) { return C.ofLesson(l) === id; });
  };

  /** сводка по курсу без учёта текущего выбора — для карточек «два курса» */
  C.summary = function (id) {
    if (App.state && App.state.summary) return App.state.summary(id);
    return null;
  };

  /** переключатель курсов: одна разметка для всех страниц.
      Клик ловит роутер (data-course), поэтому bind не нужен. */
  C.tabsHtml = function (mode) {
    var cur = C.current();
    return '<div class="course-tabs' + (mode === "compact" ? " compact" : "") + '">' +
      App.COURSES.map(function (c) {
        var n = C.lessons(c.id).length;
        var summary = C.summary(c.id);
        var pct = summary ? summary.percent : 0;
        return '<button class="course-tab' + (c.id === cur ? " active" : "") + '" data-course="' + c.id + '">' +
          '<b>' + App.util.esc(c.name) + "</b>" +
          '<span class="tiny muted">' + App.util.esc(c.kicker) + " · " + n + " " +
          App.util.plural(n, "элемент", "элемента", "элементов") + (summary ? " · " + pct + "%" : "") +
          "</span></button>";
      }).join("") + "</div>";
  };

  /** подпись курса урока для крошек и карточек */
  C.label = function (id) { return C.get(id).name; };
})();
