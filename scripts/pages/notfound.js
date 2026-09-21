/* notfound.js — заглушка для неизвестного маршрута */
(function () {
  "use strict";
  App.router.register("notfound", {
    view: function () {
      return '<div class="kicker">404</div><h2>Такой страницы нет</h2>' +
        '<p class="lead">Возможно, ссылка устарела. Начни с главной или с уроков.</p>' +
        '<div class="row"><button class="btn" data-go="home">На главную</button>' +
        '<button class="btn ghost" data-go="lessons">К урокам</button></div>';
    }
  });
})();
