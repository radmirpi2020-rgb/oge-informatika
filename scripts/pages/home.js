/* home.js — главная: суть продукта, прогресс, следующий шаг, блок про провожатого */
(function () {
  "use strict";

  App.router.register("home", {
    view: function () {
      var courseId = App.course.current();
      var courseDef = App.course.currentDef();
      var s = ST.summary(courseId);
      var next = ST.nextLesson(courseId);
      var plan = ST.planDef();
      var info = App.usage.info();
      var testDone = ST.test !== null && ST.test !== undefined;

      var html = '<div class="kicker">' + App.util.esc(courseDef.kicker) + '</div>' +
        "<h1>Репетитор, который <em>ведёт за руку</em> и знает, где ты ошибаешься</h1>" +
        '<p class="lead">Сейчас открыт курс «' + App.util.esc(courseDef.name) + '»: ' + s.total + " элементов — " +
        s.lessons + " уроков и " + s.practices + " интерактивных практик. " +
        App.util.esc(courseDef.note) + " Рядом нейронка-провожатый: объяснит коротко и по делу.</p>" +
        App.media.figure(App.media.imageById("hero"), { className: "hero-figure" });

      html += App.course.tabsHtml("compact");

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
        html += '<div class="alert ok">Курс «' + App.util.esc(courseDef.name) + '» пройден целиком. ' +
          "Можно повторить сложные темы или перейти во второй курс.</div>";
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

      /* два курса рядом: школьный и экзаменационный, с раздельным прогрессом */
      html += '<h3>Два курса</h3><div class="course-pair">' +
        App.COURSES.map(function (c) {
          var cs = ST.summary(c.id);
          var n = App.course.lessons(c.id).length;
          var active = c.id === courseId;
          return '<div class="course-card' + (active ? " active" : "") + '">' +
            '<div class="kicker">' + App.util.esc(c.kicker) + (active ? " · открыт сейчас" : "") + '</div>' +
            "<h4>" + App.util.esc(c.name) + "</h4>" +
            '<p class="tiny muted" style="margin:0">' + App.util.esc(c.note) + "</p>" +
            '<div class="num">' + cs.percent + '<span style="font-size:14px">%</span></div>' +
            '<div class="bar"><i style="width:' + cs.percent + '%"></i></div>' +
            '<div class="tiny muted">' + cs.finished + " из " + cs.total + " элементов · " + n + " всего</div>" +
            '<div class="row"><button class="btn sm' + (active ? " ghost" : "") + '" data-course="' + c.id + '">' +
              (active ? "Открыть список" : "Перейти в курс") + "</button></div>" +
          "</div>";
        }).join("") + "</div>";

      if (App.oge && App.oge.COURSE) {
        var oc = App.oge.COURSE;
        html += '<div class="card"><div class="kicker">Курс «Подготовка к ОГЭ» — как он устроен</div>' +
          '<div class="progress-row"><span>Уроков по 16 заданиям</span><span class="val">' + oc.lessonsTotal + "</span></div>" +
          '<div class="progress-row"><span>Короткий трек (старт в марте)</span><span class="val">' +
            (oc.short ? oc.short.lessonsTotal : "—") + " уроков</span></div>" +
          '<div class="progress-row"><span>Живых прогонов в настоящих программах</span><span class="val">' +
            oc.realRuns + " (из них на время: " + oc.realTimed + ")</span></div>" +
          '<div class="progress-row"><span>Максимальный первичный балл</span><span class="val">21 за 150 минут</span></div>' +
          '<p class="tiny muted" style="margin:8px 0 0">Тяжёлое скачиваем и делаем вживую, лёгкое — симуляцией в сайте. ' +
            "Инструменты: LibreOffice, Кумир, Python. Подробности — в уроках курса.</p></div>";
      }

      html += '<div class="row" style="margin-top:14px">' +
        App.media.voiceButton("greet", "Послушать провожатого") +
        '<button class="btn sm ghost" data-go="media">Все картинки и озвучка</button>' +
      "</div>";
      return html;
    },
    bind: function () { App.media.bind(); }
  });
})();
