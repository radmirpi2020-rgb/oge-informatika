/* plans.js (страница) — тарифы, режимы трат, активация промокода */
(function () {
  "use strict";

  var PROMOS = {
    "FULL30": { plan: "full", days: 30, label: "Полный курс на 30 дней" },
    "MAX30": { plan: "max", days: 30, label: "Максимум на 30 дней" },
    "SCHOOL": { plan: "max", days: 90, label: "Максимум на 90 дней (школьный)" }
  };

  App.router.register("plans", {
    view: function () {
      var cur = ST.planDef();
      var info = App.usage.info();
      var promo = ST.promo;
      var hasAi = App.planAI(cur);
      var aiPlan = App.aiPlan();

      var html = '<button class="back" data-go="home">← На главную</button>' +
        '<div class="kicker">Тарифы</div>' +
        "<h2>Курс отдельно, нейронка отдельно</h2>" +
        '<p class="lead">Уроки и практики — это курс. Провожатый на нейронке — отдельная часть: ' +
        "он объясняет, разбирает ошибки и ведёт по плану. Можно взять только курс, а нейронку добавить позже.</p>";

      /* кружок лимита показываем только тем, у кого нейронка в тарифе */
      html += '<div class="card"><div class="row center" style="gap:16px">' + App.aiRing({ size: 60, stroke: 6 }) +
        (hasAi
          ? "<div><b>Сегодня осталось " + App.util.fmt(info.left) + " токенов</b><br>" +
            '<span class="tiny muted">лимит ' + App.util.fmt(info.limit) + " · использовано " + App.util.fmt(info.used) +
            " · запросов " + info.calls + "</span></div>" +
            '<div style="flex:1"></div><button class="btn sm ghost" id="limitBtn">Подробнее</button>'
          : "<div><b>Нейронка в тариф не входит</b><br>" +
            '<span class="tiny muted">Уроки и практики работают полностью. Провожатый — в тарифе «' +
            App.util.esc(aiPlan ? aiPlan.name : "Максимум") + "» за " + (aiPlan ? aiPlan.price : 990) + " ₽.</span></div>" +
            '<div style="flex:1"></div><button class="btn sm" data-plan="' + (aiPlan ? aiPlan.id : "max") + '">Взять нейронку</button>') +
        "</div></div>";

      html += '<div class="plan-grid">';
      App.PLANS.forEach(function (p) {
        var isCur = p.id === cur.id;
        html += '<div class="plan' + (isCur ? " current" : "") + '">' +
          (p.badge ? '<span class="badge accent">' + App.util.esc(p.badge) + "</span>" : "") +
          "<h3>" + App.util.esc(p.name) + "</h3>" +
          '<div class="price">' + (p.price ? p.price + " ₽" : "0 ₽") + " <small>" + App.util.esc(p.period || "навсегда") + "</small></div>" +
          '<div class="tiny ' + (p.ai ? "muted" : "") + '">' +
            (p.ai ? "Нейронка: " + App.util.fmt(p.dailyTokens) + " токенов в день" : "Нейронка не входит") +
          "</div>" +
          "<ul>" + p.features.map(function (f) { return "<li>" + App.util.esc(f) + "</li>"; }).join("") + "</ul>" +
          '<div class="spacer"></div>' +
          (isCur ? '<button class="btn sm" disabled>Текущий тариф</button>'
                 : '<button class="btn sm" data-plan="' + p.id + '">Включить</button>') +
        "</div>";
      });
      html += "</div>";

      html += "<h3>Режимы трат провожатого</h3>" +
        '<p class="tiny muted">Режим выбирается в панели провожатого. Чем выше режим, тем больше инструментов и расход. ' +
        "Один короткий ответ — около 1 200 токенов, разбор с кодом — около 4 000, полный агент — до 12 000.</p>" +
        '<div class="mode-grid">';
      App.AI_MODES.forEach(function (m) {
        var allowed = (cur.modes || []).indexOf(m.id) !== -1;
        html += '<div class="mode' + (allowed ? "" : " disabled") + '">' +
          "<b>" + m.name + (allowed ? "" : " 🔒") + "</b>" +
          '<div class="cost">≈ ' + App.util.fmt(m.cost) + " токенов за ответ</div>" +
          '<div class="tiny muted" style="margin-top:6px">' + App.util.esc(m.desc) + "</div>" +
          '<div class="tiny" style="margin-top:6px">Инструменты: ' + (m.tools.length ? m.tools.join(", ") : "нет") + "</div>" +
        "</div>";
      });
      html += "</div>";
      if (!hasAi) {
        html += '<div class="alert soft">Режимы трат относятся к провожатому. В тарифе «' + App.util.esc(cur.name) +
          "» они закрыты — сам курс от этого не зависит.</div>";
      }

      html += "<h3>Промокод</h3><div class=\"card\">" +
        '<div class="field"><label>Если дали код — введи его здесь</label>' +
        '<input type="text" id="promoInput" placeholder="например MAX30"></div>' +
        '<div class="row"><button class="btn sm" id="promoBtn">Активировать</button></div>' +
        '<div id="promoMsg" class="tiny" style="margin-top:8px">' +
          (promo ? "Активен: " + App.util.esc(promo.label) + " до " + promo.until : "Промокод не активирован.") + "</div>" +
      "</div>";

      html += '<div class="alert soft">Подписка пока переключается вручную: платежи подключаются отдельно (ЮKassa / CloudPayments). ' +
        "Дневной лимит — мягкий: если ученик занимается каждый день и закрывает уроки, к лимиту добавляется бонус до 40 000 токенов.</div>";
      return html;
    },

    bind: function () {
      var lb = document.getElementById("limitBtn");
      if (lb) lb.addEventListener("click", function () { App.showLimitModal(); });

      document.querySelectorAll("[data-plan]").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-plan");
          ST.setPlan(id);
          App.storage.del(App.storage.KEYS.aiMode);
          var p = App.plan(id);
          alert("Тариф «" + p.name + "» включён." +
            (p.ai ? " Нейронка: " + App.util.fmt(p.dailyTokens) + " токенов в день, режимы: " +
              (p.modes || []).map(function (m) { return App.AI_MODE(m).name; }).join(", ") + "."
              : " Нейронка в этот тариф не входит."));
          App.router.render();
        });
      });

      var pb = document.getElementById("promoBtn");
      if (pb) pb.addEventListener("click", function () {
        var code = String(document.getElementById("promoInput").value || "").trim().toUpperCase();
        var msg = document.getElementById("promoMsg");
        var p = PROMOS[code];
        if (!p) { msg.innerHTML = '<span style="color:var(--err)">Такого промокода нет.</span>'; return; }
        var until = new Date();
        until.setDate(until.getDate() + p.days);
        ST.promo = { plan: p.plan, label: p.label, until: until.toISOString().slice(0, 10), code: code };
        App.storage.set(App.storage.KEYS.promo, ST.promo);
        msg.textContent = "Активирован: " + p.label + " до " + ST.promo.until;
        App.router.render();
      });
    }
  });
})();
