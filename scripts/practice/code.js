/* code.js — практика «К»: редактор Python, запуск, сверка вывода с эталоном */
(function () {
  "use strict";
  var P = App.PRACTICE = App.PRACTICE || {};

  function normOut(s) {
    return String(s == null ? "" : s).replace(/\r\n?/g, "\n").replace(/\s+$/g, "");
  }

  /** грубая оценка сложности по коду решения — сколько на самом деле знает ученик */
  function rateDifficulty(code) {
    var d = 1;
    var code2 = String(code || "");
    if (/\bfor\b/.test(code2) || /\bwhile\b/.test(code2)) d = 2;
    if (/\bdef\b/.test(code2)) d = 3;
    if (/\bdict\b|\{[^}]*:[^}]*\}/.test(code2)) d = 4;
    if (/for[\s\S]*for/.test(code2)) d = 5;
    return d;
  }

  var DIFF = ["", "очень просто", "просто", "средне", "сложно", "олимпиадно"];

  P.code = {
    mount: function (host, cfg, ctx) {
      var lesson = ctx.lesson || {};
      var savedKey = "code_" + lesson.id;
      var saved = App.state.practice[savedKey] || {};
      var code = saved.code != null ? saved.code : (cfg.starter || "");

      host.innerHTML =
        '<div class="practical-task"><b>Задание</b>' + App.util.esc(cfg.task || "") + "</div>" +
        (cfg.hint ? '<div class="hack">' + App.md.inline(cfg.hint) + "</div>" : "") +
        '<div class="code-editor">' +
          '<div class="pane"><div class="pane-head"><span>Твой код</span><span class="kbd-hint">Tab — отступ</span></div>' +
            '<textarea id="pyCode" spellcheck="false"></textarea></div>' +
          '<div class="pane"><div class="pane-head"><span>Вывод программы</span><span class="kbd-hint" id="pyMeta"></span></div>' +
            '<div class="code-out" id="pyOut">Напиши код и нажми «Запустить».</div></div>' +
        "</div>" +
        '<div class="row">' +
          '<button class="btn" id="pyRun">▶ Запустить</button>' +
          '<button class="btn ghost" id="pyCheck">Проверить</button>' +
          '<button class="btn ghost" id="pyClear">Стереть</button>' +
        "</div>" +
        '<div class="alert" id="pyResult" style="display:none"></div>' +
        '<div class="row" style="margin-top:10px">' +
          '<button class="btn sm ghost" id="pySol">Показать решение</button>' +
        "</div>" +
        '<div id="pySolBox" style="display:none"><div class="alert soft" style="border-left-color:var(--accent)"><div class="ex" id="pySolCode"></div></div></div>';

      var ta = host.querySelector("#pyCode");
      var out = host.querySelector("#pyOut");
      var meta = host.querySelector("#pyMeta");
      var result = host.querySelector("#pyResult");
      ta.value = code;

      ta.addEventListener("keydown", function (e) {
        if (e.key === "Tab") {
          e.preventDefault();
          var s = ta.selectionStart, en = ta.selectionEnd;
          ta.value = ta.value.slice(0, s) + "    " + ta.value.slice(en);
          ta.selectionStart = ta.selectionEnd = s + 4;
        }
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
          // автоотступ как в Python
          var pos = ta.selectionStart;
          var before = ta.value.slice(0, pos);
          var lineStart = before.lastIndexOf("\n") + 1;
          var curLine = before.slice(lineStart);
          var indent = (curLine.match(/^\s*/) || [""])[0];
          if (/:\s*$/.test(curLine)) indent += "    ";
          setTimeout(function () {
            var p = ta.selectionStart;
            ta.value = ta.value.slice(0, p) + indent + ta.value.slice(p);
            ta.selectionStart = ta.selectionEnd = p + indent.length;
          }, 0);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); doRun(); }
      });
      ta.addEventListener("input", function () { code = ta.value; save(); });

      function save() {
        App.state.practice[savedKey] = { code: ta.value, at: Date.now() };
        App.state.savePractice();
      }

      function doRun(silent) {
        code = ta.value;
        save();
        var support = App.python.isSupported(code);
        if (!support.ok) {
          out.className = "code-out err";
          out.textContent = support.why;
          if (!silent) return null;
        }
        var r = App.python.run(code);
        if (!r.ok) {
          out.className = "code-out err";
          out.textContent = (r.out ? r.out + "\n" : "") + "✗ " + r.error + (r.errorLine ? " (строка " + r.errorLine + ")" : "");
          meta.textContent = "ошибка";
          return null;
        }
        out.className = "code-out";
        out.textContent = r.out === "" ? "(программа ничего не вывела)" : r.out;
        meta.textContent = r.steps + " шагов";
        return r;
      }

      function doCheck() {
        var r = doRun(true);
        result.style.display = "block";
        if (!r) {
          result.className = "alert err";
          result.textContent = "Сначала исправь ошибку — программа не выполнилась.";
          return;
        }
        if (normOut(r.out) === normOut(cfg.expected)) {
          var lvl = rateDifficulty(cfg.solution || "");
          result.className = "alert ok";
          result.innerHTML = "✓ Верно! Вывод совпал с эталоном.<br><span class=\"tiny muted\">Это задание уровня «" +
            (DIFF[lvl] || "средне") + "» — в экзамене такие решают за " + (lvl * 2 + 2) + "–" + (lvl * 3 + 4) + " минут.</span>";
          ctx.onSolved && ctx.onSolved();
        } else {
          result.className = "alert err";
          var got = normOut(r.out).split("\n").filter(Boolean).length;
          var exp = normOut(cfg.expected).split("\n").filter(Boolean).length;
          result.innerHTML = "✗ Вывод не совпал с эталоном.<br><span class=\"tiny\">У тебя строк: " + got +
            ", в ответе: " + exp + ". Сверь порядок вывода и значения — расхождение в формате тоже считается ошибкой.</span>";
        }
      }

      host.querySelector("#pyRun").addEventListener("click", function () {
        doRun(true);
        result.style.display = "none";
      });
      host.querySelector("#pyCheck").addEventListener("click", doCheck);
      host.querySelector("#pyClear").addEventListener("click", function () {
        ta.value = ""; save(); ta.focus();
      });
      host.querySelector("#pySol").addEventListener("click", function () {
        var box = host.querySelector("#pySolBox");
        if (box.style.display === "none") {
          host.querySelector("#pySolCode").textContent = cfg.solution || "решение не задано";
          box.style.display = "block";
        } else box.style.display = "none";
      });

      if (code.trim()) doRun(true);
    }
  };
})();
