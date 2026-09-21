/* ==========================================================================
   app.js — ядро: глобальный объект App, утилиты, реестр модулей уроков
   Загружается первым. Ничего не рисует.
   ========================================================================== */
(function () {
  "use strict";

  window.App = window.App || {};

  /* ---- реестр модулей уроков (data/lessons/module-*.js складывают сюда) ----
     course: "base" — школьная информатика 5–9 (по умолчанию), "oge" — подготовка к ОГЭ. */
  App.registerModule = function (moduleName, lessons, course) {
    App._modules = App._modules || [];
    var id = course || "base";
    (lessons || []).forEach(function (l) { if (!l.course) l.course = id; });
    App._modules.push({ name: moduleName, course: id, lessons: lessons || [] });
    App.LESSONS = App._modules.reduce(function (acc, m) { return acc.concat(m.lessons); }, []);
    App.LESSONS.sort(function (a, b) { return a.id - b.id; });
    // порядок следования модулей сохраняем отдельно (для страницы уроков)
    App.MODULE_ORDER = [];
    App._modules.forEach(function (m) {
      if (App.MODULE_ORDER.indexOf(m.name) === -1) App.MODULE_ORDER.push(m.name);
    });
  };

  App.LESSONS = [];
  App.TEST_QUESTIONS = [];
  App.MODULES = [];

  /* ---- утилиты ---- */
  App.util = {
    esc: function (s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    /** нормализация ответа: пробелы, регистр, запятая, ё, синонимы да/нет */
    normalize: function (s) {
      var v = String(s == null ? "" : s).trim().toLowerCase()
        .replace(/\s+/g, "").replace(/,/g, ".").replace(/ё/g, "е")
        .replace(/[«»"']/g, "");
      var syn = {
        "да": "1", "yes": "1", "true": "1", "истина": "1",
        "нет": "0", "no": "0", "false": "0", "ложь": "0"
      };
      if (Object.prototype.hasOwnProperty.call(syn, v)) return syn[v];
      return v;
    },
    /** верен ли ответ; альтернативы в эталоне разделяются | */
    checkAnswer: function (given, expected) {
      var g = App.util.normalize(given);
      if (g === "") return false;
      var variants = String(expected == null ? "" : expected).split("|");
      for (var i = 0; i < variants.length; i++) {
        if (App.util.normalize(variants[i]) === g) return true;
      }
      return false;
    },
    clone: function (x) { return JSON.parse(JSON.stringify(x)); },
    uid: function (p) { return (p || "id") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
    plural: function (n, one, few, many) {
      var m10 = n % 10, m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return one;
      if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
      return many;
    },
    fmt: function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); },
    pad: function (n, len) { var s = String(n); while (s.length < (len || 3)) s = "0" + s; return s; },
    /** минуты -> «1 ч 20 мин» */
    humanTime: function (min) {
      min = Math.round(min);
      if (min < 60) return min + " мин";
      return Math.floor(min / 60) + " ч " + (min % 60 ? (min % 60) + " мин" : "");
    },
    today: function () {
      var d = new Date();
      return d.getFullYear() + "-" + App.util.pad(d.getMonth() + 1, 2) + "-" + App.util.pad(d.getDate(), 2);
    }
  };

  /* ---- markdown-подобная разметка теории (как в прототипе) ---- */
  function mdEscape(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function mdInline(text) {
    var s = mdEscape(text);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<i>$2</i>");
    return s;
  }

  App.md = {
    escape: mdEscape,
    inline: mdInline,
    /** построчный рендер теории в HTML */
    theory: function (text) {
      if (!text) return "";
      if (/^\s*<(p|div|b|i|code|br|span|ul|ol|h[1-4])[\s>]/i.test(text)) return text;
      var lines = String(text).split("\n"), out = [], i = 0;
      while (i < lines.length) {
        var line = lines[i];
        if (line.trim() === "~~~") {
          var buf = []; i++;
          while (i < lines.length && lines[i].trim() !== "~~~") { buf.push(lines[i]); i++; }
          i++;
          out.push('<div class="ex">' + mdEscape(buf.join("\n")) + "</div>");
          continue;
        }
        if (line.indexOf("> ") === 0) {
          var hb = [];
          while (i < lines.length && lines[i].indexOf("> ") === 0) { hb.push(lines[i].slice(2)); i++; }
          out.push('<div class="hack">' + mdInline(hb.join(" ")) + "</div>");
          continue;
        }
        if (line.indexOf("!! ") === 0) {
          var wb = [];
          while (i < lines.length && lines[i].indexOf("!! ") === 0) { wb.push(lines[i].slice(3)); i++; }
          out.push('<div class="warn">' + mdInline(wb.join(" ")) + "</div>");
          continue;
        }
        if (line.trim() === "") { i++; continue; }
        var para = [];
        while (i < lines.length && lines[i].trim() !== "" && lines[i].indexOf("> ") !== 0 &&
               lines[i].indexOf("!! ") !== 0 && lines[i].trim() !== "~~~") {
          para.push(lines[i]); i++;
        }
        out.push("<p>" + para.map(mdInline).join("<br>") + "</p>");
      }
      return out.join("");
    }
  };

  /* ---- ошибки наружу, а не в пустоту ---- */
  App.showError = function (e) {
    var box = document.getElementById("error");
    if (!box) return;
    box.classList.add("show");
    box.textContent = "Ошибка: " + (e && e.message ? e.message : String(e)) +
      (e && e.stack ? "\n\n" + e.stack : "");
  };
  App.clearError = function () {
    var box = document.getElementById("error");
    if (box) { box.classList.remove("show"); box.textContent = ""; }
  };
  window.addEventListener("error", function (ev) { App.showError(ev.error || ev.message); });

  /* ---- режим работы: файл или сервер ---- */
  App.isFile = location.protocol === "file:";
})();
