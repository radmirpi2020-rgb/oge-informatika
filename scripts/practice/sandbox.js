/* sandbox.js — практика «П»: ввод ответа + пошаговое решение (полуавтомат) */
(function () {
  "use strict";
  var P = App.PRACTICE = App.PRACTICE || {};

  P.sandbox = {
    mount: function (host, cfg, ctx) {
      var steps = cfg.steps || [];
      var lessonId = (ctx.lesson && ctx.lesson.id) || 0;
      var key = "sandbox_" + lessonId;
      var saved = App.state.practice[key] || { done: {} };
      var wrap = document.createElement("div");

      steps.forEach(function (step, i) {
        var box = document.createElement("div");
        box.className = "sandbox-step";
        box.innerHTML =
          '<div class="qt">' + (i + 1) + ". " + App.util.esc(step.q) + "</div>" +
          '<input type="text" inputmode="text" placeholder="Ответ" value="' + App.util.esc((saved.values && saved.values[i]) || "") + '">' +
          '<div class="row">' +
            '<button class="btn sm" data-act="check">Проверить</button>' +
            '<button class="btn sm ghost" data-act="steps">Показать шаги</button>' +
          "</div>" +
          '<div class="feedback"></div>' +
          '<div class="steps"><ol>' + (step.steps || []).map(function (s) {
            return "<li>" + App.util.esc(s) + "</li>";
          }).join("") + "</ol></div>";
        wrap.appendChild(box);

        var input = box.querySelector("input");
        var fb = box.querySelector(".feedback");
        var stepsBox = box.querySelector(".steps");
        var solved = !!(saved.done && saved.done[i]);
        if (solved) {
          fb.className = "feedback show ok";
          fb.textContent = "✓ верно";
        }

        box.querySelector('[data-act="check"]').addEventListener("click", function () {
          var ok = App.util.checkAnswer(input.value, step.answer);
          fb.className = "feedback show " + (ok ? "ok" : "err");
          fb.textContent = ok ? "✓ верно" : "✗ не так, попробуй ещё или посмотри шаги";
          saved.done = saved.done || {};
          saved.values = saved.values || {};
          saved.values[i] = input.value;
          if (ok) saved.done[i] = 1;
          App.state.practice[key] = saved;
          App.state.savePractice();
          refresh();
          if (ok && steps.length && Object.keys(saved.done).length >= steps.length) {
            ctx.onSolved && ctx.onSolved();
          }
        });
        box.querySelector('[data-act="steps"]').addEventListener("click", function () {
          stepsBox.classList.toggle("show");
        });
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") box.querySelector('[data-act="check"]').click();
        });
      });

      var counter = document.createElement("div");
      counter.className = "tiny muted";
      counter.style.marginTop = "6px";
      wrap.appendChild(counter);
      var closed = false;
      function refresh() {
        var done = Object.keys(saved.done || {}).length;
        counter.textContent = "Решено шагов: " + done + " из " + steps.length;
        if (steps.length && done >= steps.length) {
          counter.textContent += " — практика закрыта";
          if (!closed) { closed = true; }
        }
      }
      refresh();
      host.appendChild(wrap);
    }
  };
})();
