/* test.js — входной тест: 5 вопросов, варианты перемешиваются, результат по темам */
(function () {
  "use strict";

  function shuffle(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(i);
    for (var j = a.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }

  function orderFor(i, len) {
    var saved = App.storage.get("oge_test_order", null);
    if (saved && saved[i] && saved[i].length === len) return saved[i];
    var o = shuffle(len);
    saved = saved || {};
    saved[i] = o;
    App.storage.set("oge_test_order", saved);
    return o;
  }

  App.router.register("test", {
    view: function () {
      var qs = App.TEST_QUESTIONS || [];
      if (!qs.length) return '<div class="alert err">Вопросы теста не загрузились.</div>';
      var html = '<button class="back" data-go="home">← На главную</button>' +
        '<div class="kicker">Шаг 1 из 2</div>' +
        "<h2>Входной тест</h2>" +
        '<p class="lead">' + qs.length + " вопросов по разным темам. Задача — понять, что ты уже знаешь, " +
        "а что нужно подтянуть. Это не оценка, результат никуда не отправляется.</p>" +
        '<form id="quiz">';
      qs.forEach(function (q, i) {
        var order = orderFor(i, (q.options || []).length);
        var prev = App.storage.get("oge_test_answers", {}) || {};
        html += '<div class="q" data-i="' + i + '" data-answer="' + q.answer + '">' +
          '<p class="qt">' + (i + 1) + ". " + App.util.esc(q.q) + "</p>" +
          (q.topic ? '<div class="tiny muted" style="margin:-8px 0 10px">тема: ' + App.util.esc(q.topic) + "</div>" : "") +
          '<div class="opts">';
        order.forEach(function (origIdx) {
          html += '<label class="opt"><input type="radio" name="q' + i + '" value="' + origIdx + '"' +
            (prev[i] != null && Number(prev[i]) === origIdx ? " checked" : "") + "> " +
            App.util.esc(q.options[origIdx]) + "</label>";
        });
        html += "</div></div>";
      });
      html += '<div class="row" style="margin-top:20px">' +
        '<button type="submit" class="btn">Проверить</button>' +
        '<button type="button" class="btn ghost" id="resetBtn">Сбросить</button></div></form>' +
        '<div class="result" id="result"></div>';
      return html;
    },

    bind: function () {
      var form = document.getElementById("quiz");
      if (!form) return;
      form.addEventListener("change", function (e) {
        var q = e.target.closest(".q");
        if (!q) return;
        var answers = App.storage.get("oge_test_answers", {}) || {};
        answers[q.getAttribute("data-i")] = Number(e.target.value);
        App.storage.set("oge_test_answers", answers);
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var qs = App.TEST_QUESTIONS || [];
        var score = 0, total = qs.length, byTopic = [];
        qs.forEach(function (q, i) {
          var box = form.querySelector('.q[data-i="' + i + '"]');
          var sel = box.querySelector("input:checked");
          var ok = sel && Number(sel.value) === Number(q.answer);
          box.querySelectorAll(".opt").forEach(function (o) {
            o.classList.remove("correct", "wrong");
            var inp = o.querySelector("input");
            if (Number(inp.value) === Number(q.answer)) o.classList.add("correct");
            if (sel && inp === sel && !ok) o.classList.add("wrong");
          });
          if (ok) score++;
          byTopic.push({ topic: q.topic || ("Вопрос " + (i + 1)), ok: !!ok });
        });
        ST.test = { score: score, total: total, at: Date.now(), byTopic: byTopic };
        ST.saveTest();

        var weak = byTopic.filter(function (t) { return !t.ok; }).map(function (t) { return t.topic; });
        var strong = byTopic.filter(function (t) { return t.ok; }).map(function (t) { return t.topic; });
        var res = document.getElementById("result");
        res.className = "result show";
        var verdict = score >= 4 ? "Отличный старт: база есть, можно идти по программе подряд."
          : score >= 2 ? "Нормально: часть тем знакома, но пробелы есть — начни с первых модулей."
          : "Начинаем с нуля — это нормально. Первые модули объясняют всё с самых основ.";
        res.innerHTML = "<b>Результат: " + score + " из " + total + "</b><br>" + verdict +
          (strong.length ? "<br><br><b>Знаешь:</b> " + strong.join(", ") : "") +
          (weak.length ? "<br><b>Подтянуть:</b> " + weak.join(", ") : "") +
          '<div class="row" style="margin-top:14px">' +
            '<button class="btn sm" data-go="lessons">К урокам</button>' +
            '<button class="btn sm ghost" data-go="progress">Посмотреть прогресс</button>' +
          "</div>";
        window.scrollTo(0, document.body.scrollHeight);
      });

      document.getElementById("resetBtn").addEventListener("click", function () {
        App.storage.del("oge_test_answers");
        App.storage.del("oge_test_order");
        ST.test = null;
        ST.saveTest();
        App.router.render();
      });
    }
  });
})();
