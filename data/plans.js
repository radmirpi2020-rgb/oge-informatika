/* plans.js — тарифы, дневные лимиты токенов, режимы трат, функции лимита */
(function () {
  "use strict";

  /* Режимы трат: чем больше ученик занимается, тем выше режим ему нужен.
     Каждый режим — свой набор инструментов нейронки и свой расход. */
  App.AI_MODES = [
    {
      id: "eco",
      name: "Эконом",
      cost: 1200,       // средний расход токенов за один ответ
      desc: "Короткий ответ, объяснение теории, проверка ответа. Без инструментов.",
      tools: []
    },
    {
      id: "std",
      name: "Стандарт",
      cost: 4000,
      desc: "Разбор по шагам, помощь с кодом, поиск по урокам и твоим ошибкам.",
      tools: ["search_lessons", "calc"]
    },
    {
      id: "pro",
      name: "Полный (агент)",
      cost: 12000,
      desc: "Ходит по урокам, смотрит таблицы, маски, графы, отлаживает код, готовит план.",
      tools: ["search_lessons", "calc", "get_lesson", "check_code", "get_progress", "explain_task"]
    }
  ];

  App.AI_MODE = function (id) {
    for (var i = 0; i < App.AI_MODES.length; i++) if (App.AI_MODES[i].id === id) return App.AI_MODES[i];
    return App.AI_MODES[0];
  };

  /* Тарифы. Лимит — на человека в день, обновляется каждые сутки. */
  App.PLANS = [
    {
      id: "free",
      name: "Без подписки",
      price: 0,
      period: "",
      dailyTokens: 50000,
      modes: ["eco"],
      features: [
        "Первые 2 модуля уроков (40 элементов)",
        "Лимит 50 000 токенов в день + бонус за прогресс",
        "Режим «Эконом»: короткие ответы по теории",
        "Практики: песочница и задачи с проверкой",
        "Без блокнота, без экспорта, без плана подготовки"
      ]
    },
    {
      id: "start",
      name: "Старт",
      price: 490,
      period: "в месяц",
      dailyTokens: 250000,
      modes: ["eco", "std"],
      badge: "выгодно",
      features: [
        "Все 300 уроков и ~70 интерактивных практик",
        "Лимит 250 000 токенов в день",
        "Режимы «Эконом» и «Стандарт»",
        "Разбор ошибок, помощь с кодом, поиск по урокам",
        "Сохраняются все решения практик",
        "Первый месяц бесплатно"
      ]
    },
    {
      id: "pro",
      name: "Про",
      price: 1490,
      period: "в месяц",
      dailyTokens: 500000,
      modes: ["eco", "std", "pro"],
      features: [
        "Всё из «Старт», плюс полный режим агента",
        "Лимит 500 000 токенов в день",
        "Нейронка ходит по урокам и данным, отлаживает код",
        "Персональный план до экзамена",
        "Отчёт родителю раз в неделю",
        "Все предметы, когда появятся"
      ]
    }
  ];

  App.plan = function (id) {
    for (var i = 0; i < App.PLANS.length; i++) if (App.PLANS[i].id === id) return App.PLANS[i];
    return App.PLANS[0];
  };

  /* ---------- расход токенов за сегодня ---------- */

  App.usage = {
    all: function () { return App.storage.get(App.storage.KEYS.usage, {}) || {}; },
    today: function () {
      var all = App.usage.all();
      var t = App.util.today();
      if (!all[t]) all[t] = { tokens: 0, calls: 0, byMode: {} };
      return all[t];
    },
    add: function (tokens, modeId) {
      var all = App.usage.all();
      var t = App.util.today();
      if (!all[t]) all[t] = { tokens: 0, calls: 0, byMode: {} };
      all[t].tokens += Math.max(0, Math.round(tokens || 0));
      all[t].calls += 1;
      all[t].byMode[modeId] = (all[t].byMode[modeId] || 0) + Math.max(0, Math.round(tokens || 0));
      App.storage.set(App.storage.KEYS.usage, all);
      return all[t];
    },
    /** {used, limit, left, percent, calls} */
    info: function () {
      var t = App.usage.today();
      var limit = ST.dailyTokens();
      var used = t.tokens || 0;
      return {
        used: used,
        limit: limit,
        left: Math.max(0, limit - used),
        percent: limit ? Math.min(100, Math.round(used / limit * 100)) : 0,
        calls: t.calls || 0,
        date: App.util.today()
      };
    },
    history: function (days) {
      var all = App.usage.all(), out = [];
      var d = new Date();
      for (var i = 0; i < (days || 7); i++) {
        var key = d.getFullYear() + "-" + App.util.pad(d.getMonth() + 1, 2) + "-" + App.util.pad(d.getDate(), 2);
        out.unshift({ date: key, tokens: (all[key] && all[key].tokens) || 0, calls: (all[key] && all[key].calls) || 0 });
        d.setDate(d.getDate() - 1);
      }
      return out;
    }
  };

  /* максимальный доступный режим трат для текущего тарифа */
  App.bestMode = function () {
    var list = ST.planDef().modes;
    return list[list.length - 1];
  };

  /** можно ли включить режим: он должен входить в тариф и в остаток лимита */
  App.canUseMode = function (modeId) {
    var p = ST.planDef();
    if (p.modes.indexOf(modeId) === -1) return { ok: false, why: "plan" };
    var mode = App.AI_MODE(modeId);
    var info = App.usage.info();
    if (info.left < Math.round(mode.cost * 0.6)) return { ok: false, why: "budget" };
    return { ok: true };
  };

  /** рекомендация режима: чем больше остаток и чем выше тариф — тем выше режим */
  App.recommendMode = function () {
    var p = ST.planDef();
    var info = App.usage.info();
    var share = info.limit ? info.left / info.limit : 0;
    if (p.modes.indexOf("pro") !== -1 && share > 0.25) return "pro";
    if (p.modes.indexOf("std") !== -1 && share > 0.15) return "std";
    return "eco";
  };
})();
