/* pages/media.js — страница «Медиа»: все картинки и озвучка сайта в одном месте */
(function () {
  "use strict";

  App.router.register("media", {
    view: function () {
      var imgs = App.media.images;
      var html = '<div class="kicker">Картинки и озвучка</div>' +
        "<h2>Медиа сайта</h2>" +
        '<p class="lead">Кадры лежат в папке <span class="mono">assets/images</span>, озвучка — в ' +
        '<span class="mono">assets/audio</span>. Сгенерировано локально и забирается на этот компьютер. ' +
        "Чтобы заменить картинку, положи свой файл с тем же именем — сайт подхватит его сам.</p>";

      html += '<div class="row" style="margin-bottom:16px">' +
        App.media.voiceButton("greet", "Послушать приветствие провожатого") +
        '<button class="btn sm ghost" data-go="tutor">К провожатому</button>' +
      "</div>";

      html += '<div class="media-grid">';
      imgs.forEach(function (im) {
        html += '<div class="media-card">' +
          '<img src="' + App.util.esc(App.media.path(im)) + '" alt="' + App.util.esc(im.title) + '" loading="lazy"' +
          " onerror=\"this.parentNode.classList.add('missing')\">" +
          '<div class="media-meta"><b>' + App.util.esc(im.title) + "</b>" +
          '<span class="tiny muted">' + App.util.esc(im.where || "") + "</span>" +
          "<p>" + App.util.esc(im.caption || "") + "</p>" +
          '<div class="tiny mono muted">' + App.util.esc(im.file) + "</div></div></div>";
      });
      html += "</div>";

      html += '<h3>Где какая картинка показывается</h3><div class="card">' +
        '<div class="progress-row"><span>Главная страница</span><span class="val">hero.jpg</span></div>' +
        '<div class="progress-row"><span>Уроки</span><span class="val">по модулю темы</span></div>' +
        '<div class="progress-row"><span>Страница провожатого</span><span class="val">mentor.jpg + greet.mp3</span></div>' +
        '<div class="progress-row"><span>Финал курса (№300)</span><span class="val">exam.jpg</span></div>' +
        '<div class="tiny muted" style="margin-top:10px">Картинка модуля берётся автоматически: открой любой урок этого модуля — она будет сверху.</div>' +
      "</div>";

      html += '<div class="card"><div class="kicker">Как это сгенерировано</div>' +
        '<div class="progress-row"><span>Картинки</span><span class="val">локальный сервер генерации, FLUX</span></div>' +
        '<div class="progress-row"><span>Озвучка</span><span class="val">локальный TTS</span></div>' +
        '<div class="progress-row"><span>Размер кадров</span><span class="val">1280 × 720</span></div>' +
        '<div class="tiny muted" style="margin-top:10px">Ничего не уходит в облако: и картинки, и голос считаются на своём железе.</div>' +
      "</div>";
      return html;
    },
    bind: function () { App.media.bind(); }
  });
})();
