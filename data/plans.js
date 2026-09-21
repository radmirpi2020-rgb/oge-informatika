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

  /* Тарифы.
     Важное разделение: доступ к урокам и доступ к нейронке — разные вещи.
     • «бесплатный» — попробовать курс руками, без нейронки;
     • «Полный курс» (490 ₽) — все уроки и практики, но без нейронки;
     • «Максимум» (990 ₽) — всё то же плюс провожатый с лимитом 100 000 токенов в день.
     Поле ai показывает, входит ли нейронка: без него режимы трат недоступны. */
  App.PLANS = [
    {
      id: "free",
      name: "Бесплатный",
      price: 0,
      period: "навсегда",
      ai: false,
      dailyTokens: 0,
      modes: [],
      features: [
        "Первые 2 раздела уроков: 40 элементов",
        "Практики в браузере: песочница, Python, робот, таблицы",
        "Входной тест и список тем",
        "Нейронка-провожатый не входит",
        "Прогресс хранится в этом браузере"
      ]
    },
    {
      id: "full",
      name: "Полный курс",
      price: 490,
      period: "в месяц",
      ai: false,
      dailyTokens: 0,
      modes: [],
      features: [
        "Все 400 уроков: курс 5–9 класс и подготовка к ОГЭ",
        "Все интерактивные практики и симуляции",
        "Прогресс, серия дней, разбор ошибок",
        "Работает и без интернета",
        "Нейронка-провожатый не входит — его можно добавить в «Максимуме»"
      ]
    },
    {
      id: "max",
      name: "Максимум",
      price: 990,
      period: "в месяц",
      ai: true,
      dailyTokens: 100000,
      modes: ["eco", "std", "pro"],
      badge: "с нейронкой",
      features: [
        "Всё из «Полного курса»",
        "Провожатый на DeepSeek: 100 000 токенов в день",
        "Три режима трат: короткий ответ, разбор по шагам, полный агент",
        "Провожатый видит открытый урок и твои ошибки",
        "Ключ живёт на сервере, а не в браузере",
        "Бонус за прогресс: до 40 000 токенов сверху"
      ]
    }
  ];

  App.plan = function (id) {
    for (var i = 0; i < App.PLANS.length; i++) if (App.PLANS[i].id === id) return App.PLANS[i];
    return App.PLANS[0];
  };

  /** входит ли нейронка в тариф */
  App.planAI = function (plan) { return !!(plan || ST.planDef()).ai; };

  /** минимальная цена тарифа с нейронкой — показывается в подсказках */
  App.aiPlan = function () {
    var best = null;
    App.PLANS.forEach(function (p) {
      if (!p.ai) return;
      if (!best || p.price < best.price) best = p;
    });
    return best;
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

  /* максимальный доступный режим трат для текущего тарифа; null — если нейронки нет */
  App.bestMode = function () {
    var list = ST.planDef().modes || [];
    return list.length ? list[list.length - 1] : null;
  };

  /** можно ли включить режим: нейронка должна входить в тариф, режим — быть доступен, лимит — не исчерпан */
  App.canUseMode = function (modeId) {
    var p = ST.planDef();
    if (!p.ai || !(p.modes || []).length) return { ok: false, why: "noai" };
    if (p.modes.indexOf(modeId) === -1) return { ok: false, why: "plan" };
    var mode = App.AI_MODE(modeId);
    var info = App.usage.info();
    if (info.left < Math.round(mode.cost * 0.6)) return { ok: false, why: "budget" };
    return { ok: true };
  };

  /** рекомендация режима: чем больше остаток и чем выше тариф — тем выше режим.
      Если нейронки в тарифе нет — null: вызывающий код показывает подсказку про тариф с ИИ. */
  App.recommendMode = function () {
    var p = ST.planDef();
    if (!p.ai || !(p.modes || []).length) return null;
    var info = App.usage.info();
    var share = info.limit ? info.left / info.limit : 0;
    if (p.modes.indexOf("pro") !== -1 && share > 0.25) return "pro";
    if (p.modes.indexOf("std") !== -1 && share > 0.15) return "std";
    return "eco";
  };

  /** текст подсказки, когда нейронки в тарифе нет */
  App.noAiHint = function () {
    var ai = App.aiPlan();
    return "В тарифе «" + ST.planDef().name + "» нейронки нет. " +
      "Провожатый входит в тариф «" + (ai ? ai.name : "Максимум") + "» за " +
      (ai ? ai.price : 990) + " ₽ в месяц — там " + App.util.fmt(ai ? ai.dailyTokens : 100000) + " токенов в день.";
  };
})();
