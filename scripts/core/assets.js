/* assets.js — картинки и озвучка сайта.
   Файлы лежат в assets/images и assets/audio. Если файла нет — сайт просто не покажет картинку.

   Как заменить: положи свой файл с тем же именем в assets/images/ и обнови страницу.
   Как добавить свою картинку к уроку: допиши строку вида
     12: { id: "my-picture", file: "assets/images/my-picture.jpg", caption: "Подпись" },
   Первое число — номер урока (id из урока), дальше объект с файлом и подписью. */
(function () {
  "use strict";

  App.media = {
    dir: "assets/images/",
    audioDir: "assets/audio/",

    /* кадры, которые показываются на страницах и в уроках */
    images: [
      { id: "hero", file: "hero.jpg", title: "Старт", caption: "Ученик за ноутбуком: с этого начинается подготовка", where: "Главная" },
      { id: "numbers", file: "numbers.jpg", title: "Системы счисления", caption: "Двоичные цифры и порядок позиций", modules: ["Системы счисления"], where: "Модуль 1" },
      { id: "logic", file: "logic.jpg", title: "Логика", caption: "Схемы из логических элементов", modules: ["Логика"], where: "Модуль 2" },
      { id: "robot", file: "robot.jpg", title: "Алгоритмы", caption: "Исполнитель ищет путь до флага", modules: ["Алгоритмы и исполнители"], where: "Модуль 3" },
      { id: "mentor", file: "mentor.jpg", title: "Провожатый", caption: "Тот, кто ведёт за руку", where: "Провожатый" },
      { id: "exam", file: "exam.jpg", title: "Экзамен", caption: "Спокойный класс и чистые столы", where: "Финал" },
      { id: "data", file: "data.jpg", title: "Таблицы и данные", caption: "Ячейки, связи, записи", modules: ["Электронные таблицы", "Базы данных"], where: "Модули 6–7" },
      { id: "files", file: "files.jpg", title: "Файлы", caption: "Дерево папок и поиск по маске", modules: ["Файловая система"], where: "Модуль 5" }
    ],

    /* короткая озвучка провожатого (кнопка «послушать») */
    voice: {
      greet: { file: "greet.mp3", title: "Приветствие провожатого" }
    },

    imageById: function (id) {
      for (var i = 0; i < App.media.images.length; i++) if (App.media.images[i].id === id) return App.media.images[i];
      return null;
    },

    /** картинка для модуля (если есть) */
    forModule: function (moduleName) {
      for (var i = 0; i < App.media.images.length; i++) {
        var im = App.media.images[i];
        if (im.modules && im.modules.indexOf(moduleName) !== -1) return im;
      }
      return null;
    },

    /** картинка для урока: своя из images[].lesson или по модулю */
    forLesson: function (lesson) {
      if (!lesson) return null;
      for (var i = 0; i < App.media.images.length; i++) {
        if (App.media.images[i].lesson === lesson.id) return App.media.images[i];
      }
      return App.media.forModule(lesson.module);
    },

    /* расширения по приоритету: сначала настоящий рендер (.jpg), потом схема (.png) */
    exts: ["jpg", "png", "webp"],

    /** путь к картинке: берём первое расширение, которое реально лежит в папке.
        Если ничего не нашли — отдаём .jpg, чтобы <img> просто не показался. */
    path: function (img) {
      if (!img) return "";
      var base = img.file.replace(/\.(jpg|png|webp)$/i, "");
      var more = img.exts || [];
      for (var i = 0; i < more.length; i++) {
        if (App.media.has(base + "." + more[i])) return App.media.dir + base + "." + more[i];
      }
      for (var k = 0; k < App.media.exts.length; k++) {
        if (App.media.has(base + "." + App.media.exts[k])) return App.media.dir + base + "." + App.media.exts[k];
      }
      return App.media.dir + base + ".jpg";
    },

    /** какие файлы реально есть в папке. Пусто — пробуем все расширения по очереди,
        а неподходящие <img> сами скрываются через onerror. */
    present: null,
    has: function (file) {
      var p = App.media.present;
      if (!p) return true;
      return p[file] !== false;
    },

    /** врезка «иллюстрация» — с подписью и подсказкой, что это картинка сайта */
    figure: function (img, opts) {
      if (!img) return "";
      opts = opts || {};
      var cls = opts.className || "media-figure";
      return '<figure class="' + cls + '">' +
        '<img src="' + App.util.esc(App.media.path(img)) + '" alt="' + App.util.esc(img.title || "") + '"' +
        ' loading="lazy" onerror="this.parentNode.classList.add(\'missing\')">' +
        (opts.hideCaption ? "" : '<figcaption>' + App.util.esc(img.caption || img.title || "") + "</figcaption>") +
        "</figure>";
    },

    /** простая озвучка: кнопка «послушать» + сам плеер */
    voiceButton: function (key, label) {
      var v = App.media.voice[key];
      if (!v) return "";
      return '<button class="btn sm ghost media-voice" data-voice="' + App.util.esc(key) + '">' +
        "▶ " + App.util.esc(label || "Послушать") + "</button>" +
        '<span class="tiny muted media-voice-note" id="voiceNote_' + App.util.esc(key) + '"></span>';
    },

    playVoice: function (key) {
      var v = App.media.voice[key];
      if (!v) return;
      var note = document.getElementById("voiceNote_" + key);
      var src = App.media.audioDir + v.file;
      var audio = new Audio(src);
      audio.play().then(function () {
        if (note) note.textContent = "играет…";
        audio.onended = function () { if (note) note.textContent = ""; };
      }).catch(function () {
        if (note) note.textContent = "файла озвучки пока нет — положи его в " + App.media.audioDir + v.file;
      });
    },

    bind: function () {
      document.querySelectorAll("[data-voice]").forEach(function (b) {
        b.addEventListener("click", function () { App.media.playVoice(b.getAttribute("data-voice")); });
      });
    }
  };
})();
