/* home.js — главная: суть продукта, прогресс, следующий шаг, блок про провожатого */
(function () {
  "use strict";

  App.router.register("home", {
    view: function () {
      var s = ST.summary();
      var next = ST.nextLesson();
      var plan = ST.planDef();
      var info = App.usage.info();
      var testDone = ST.test !== null && ST.test !== undefined;

      var html = '<div class="kicker">ОГЭ · 9 класс · Информатика</div>' +
        "<h1>Репетитор, который <em>ведёт за руку</em> и знает, где ты ошибаешься</h1>" +
        '<p class="lead">' + s.total + " элементов: " + s.lessons + " уроков и " + s.practices +
        " интерактивных практик. После каждых 2–3 уроков — практика, которая проверяет, что ты понял, а не прочитал." +
        " Рядом нейронка-провожатый: объяснит коротко и по делу.</p>" +
        App.media.figure(App.media.imageById("hero"), { className: "hero-figure" });

      html += '<div class="row" style="margin-bottom:20px">' +
        (testDone ? '<button class="cta" data-go="lessons">Продолжить обучение →</button>'
                  : '<button class="cta" data-go="test">Пройти входной тест →</button>') +
        '<button class="btn ghost" data-go="tutor">Открыть провожатого</button>' +
        '<button class="btn ghost" data-go="plans">Тарифы и лимиты</button>' +
      "</div>";

      if (next) {
        html += '<div class="next-step">' +
          "<div><div class=\"kicker\" style=\"margin-bottom:4px\">Следующий шаг</div>" +
          "<b>№" + next.id + " · " + App.util.esc(next.title) + "</b>" +
          '<div class="tiny muted">' + App.util.esc(next.sub || "") + " · " + (next.minutes || 7) + " мин</div></div>" +
          '<button class="btn" data-go="lesson/' + next.id + '">Начать</button>' +
        "</div>";
      } else {
        html += '<div class="alert ok">Все элементы пройдены. Можно повторить сложные темы или пройти финальную симуляцию ОГЭ (#300).</div>';
      }

      html += '<div class="hero-grid">' +
        '<div class="hero-tile"><b>' + s.finished + " / " + s.total + "</b><span>элементов пройдено (" + s.percent + "%)</span>" +
          '<div class="bar" style="margin-top:10px"><i style="width:' + s.percent + '%"></i></div></div>' +
        '<div class="hero-tile"><b>' + s.tasksDone + " / " + s.tasksTotal + "</b><span>задач решено верно</span></div>" +
        '<div class="hero-tile"><b>' + s.streak + " " + App.util.plural(s.streak, "день", "дня", "дней") + "</b><span>серия занятий подряд</span></div>" +
        '<div class="hero-tile"><b>' + App.util.humanTime(s.minutesLeft) + "</b><span>примерно осталось до конца курса</span></div>" +
      "</div>";

      html += '<div class="card">' +
        '<div class="kicker">Входной тест</div>' +
        '<div class="progress-row"><span>Результат</span><span class="val">' +
          (testDone ? ST.test.score + " / " + ST.test.total : "не пройден") + "</span></div>" +
        '<div class="progress-row"><span>Тариф</span><span class="val">' + App.util.esc(plan.name) + "</span></div>" +
        '<div class="progress-row"><span>Лимит нейронки сегодня</span><span class="val">' + App.util.fmt(info.left) + " / " + App.util.fmt(info.limit) + "</span></div>" +
        '<div class="progress-row"><span>Провожатый</span><span class="val">' +
          (App.ai.configured() ? "DeepSeek подключён" : "ключ не подключён") + "</span></div>" +
      "</div>";

      html += '<h3>Почему это работает</h3><div class="callout-grid">' +
        '<div class="callout"><h4>Провожатый, а не поисковик</h4><p>Нейронка видит, какой урок открыт, что ты уже решил и где ошибся. Отвечает коротко — 3–6 строк, без лекций.</p></div>' +
        '<div class="callout"><h4>Лимиты как в GPT</h4><p>Кружок в шапке показывает остаток токенов. Режим «Эконом» тратит копейки, «Полный» — ходит по урокам и данным.</p></div>' +
        '<div class="callout"><h4>Практика — действие</h4><p>Песочница с пошаговым разбором, редактор Python с запуском кода и блочный конструктор робота. Не «прочитал», а «сделал».</p></div>' +
        '<div class="callout"><h4>Лайфхаки и ошибки</h4><p>В каждом уроке отдельно: как решить быстрее и что чаще всего теряет баллы на экзамене.</p></div>' +
      "</div>";

      html += '<div class="row" style="margin-top:14px">' +
        App.media.voiceButton("greet", "Послушать провожатого") +
        '<button class="btn sm ghost" data-go="media">Все картинки и озвучка</button>' +
      "</div>";
      return html;
    },
    bind: function () { App.media.bind(); }
  });
})();
