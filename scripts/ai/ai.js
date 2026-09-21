/* ai.js — AI-провожатый: DeepSeek, режимы трат, лимиты токенов, локальная страховка.
   Ключ берётся из config/deepseek-key.js (window.DEEPSEEK_API_KEY) или из админки (localStorage).
   Если ключа нет — работает локальный разбор без расхода токенов. */
(function () {
  "use strict";

  var AI = App.ai = {};

  AI.CONFIG = {
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
    temperature: 0.3,
    maxTokens: 700,
    historyLimit: 8,
    timeoutMs: 60000
  };

  AI.key = function () {
    var manual = App.storage.get(App.storage.KEYS.aiKeyOverride, "");
    if (manual) return String(manual).trim();
    var k = window.DEEPSEEK_API_KEY;
    if (k && typeof k === "string" && k.trim().length > 12 && k.indexOf("вставь") === -1) return k.trim();
    return "";
  };
  AI.configured = function () { return AI.key().length > 12; };
  AI.keySource = function () {
    if (App.storage.get(App.storage.KEYS.aiKeyOverride, "")) return "сохранён в админке";
    if (AI.configured()) return "из config/deepseek-key.js";
    return "ключа нет";
  };

  AI.mode = function () {
    var m = App.storage.get(App.storage.KEYS.aiMode, null);
    if (!m || !App.canUseMode(m).ok && !App.canUseMode(m).why) m = App.recommendMode();
    var list = ST.planDef().modes;
    if (list.indexOf(m) === -1) m = list[list.length - 1];
    return m;
  };
  AI.setMode = function (m) {
    if (ST.planDef().modes.indexOf(m) === -1) return false;
    App.storage.set(App.storage.KEYS.aiMode, m);
    return true;
  };

  AI.history = function () { return App.storage.get(App.storage.KEYS.aiHistory, []) || []; };
  AI.setHistory = function (h) {
    App.storage.set(App.storage.KEYS.aiHistory, h.slice(-40));
  };
  AI.clearHistory = function () { App.storage.del(App.storage.KEYS.aiHistory); };

  /* ---------- контекст: что сейчас на экране ---------- */
  AI.context = function () {
    var ctx = { lesson: null, route: App.router.current.name };
    var id = App.router.current.name === "lesson" ? App.router.current.param : null;
    if (id) ctx.lesson = ST.lesson(id);
    if (!ctx.lesson) {
      var last = App.storage.get(App.storage.KEYS.lastLesson, null);
      if (last) ctx.lesson = ST.lesson(last);
    }
    return ctx;
  };

  /** системный промпт: коротко, по делу, без лекций */
  AI.systemPrompt = function (modeId) {
    var mode = App.AI_MODE(modeId);
    var ctx = AI.context();
    var info = App.usage.info();
    var plan = ST.planDef();
    var lines = [];
    lines.push("Ты — «Провожатый», помощник школьника 5–9 класса по информатике.");
    lines.push("На сайте два курса: «Информатика 5–9 класс» (300 уроков школьной программы) и собирающийся курс «Подготовка к ОГЭ».");
    lines.push("Помогай с тем уроком, который открыт. Если спрашивают про ОГЭ — отвечай по официальному плану КИМ: 16 заданий, 21 первичный балл, 150 минут.");
    lines.push("Отвечай по-русски, коротко: 3–6 строк или короткий список. Никаких вступлений и извинений.");
    lines.push("Главное — подсказать ход мысли, а не выдать готовое решение целиком. Если ученик просит решение, дай его, но с объяснением шагов.");
    lines.push("Пиши простыми словами, как объясняет хороший репетитор. Формулы и код — в отдельных строках.");
    lines.push("Не выдумывай задания, номера заданий и баллы ОГЭ. Если не знаешь — скажи прямо.");
    lines.push("");
    lines.push("Режим трат: " + mode.name + ". " + mode.desc);
    if (modeId === "eco") lines.push("В этом режиме отвечай максимально сжато: 2–4 строки, без длинных разборов.");
    if (modeId === "std") lines.push("Можно дать разбор по шагам, но не больше 10 строк.");
    if (modeId === "pro") lines.push("Можно дать подробный разбор и план, если ученик просит, но всё равно без воды.");
    lines.push("");
    lines.push("Тариф ученика: " + plan.name + ". Остаток лимита сегодня: " + info.left + " токенов из " + info.limit + ".");
    if (ctx.lesson) {
      var l = ctx.lesson;
      var st = ST.lessonStats(l);
      lines.push("");
      lines.push("Ученик сейчас на элементе №" + l.id + " «" + l.title + "» (модуль «" + (l.module || "") + "», " +
        (l.kind === "practice" ? "практика" : "урок") + ").");
      if (l.sub) lines.push("Тема: " + l.sub + ".");
      if (st.total) lines.push("Решено задач в нём: " + st.done + " из " + st.total + ".");
      if (l.theory) {
        var t = String(l.theory).replace(/[#*`>!~]/g, " ").replace(/\s+/g, " ").trim();
        lines.push("Краткое содержание урока (для контекста): " + t.slice(0, 700));
      }
    }
    return lines.join("\n");
  };

  /* ---------- запрос к DeepSeek ---------- */
  AI.chat = function (messages, modeId, cb) {
    var key = AI.key();
    if (!key) return Promise.reject(new Error("NO_KEY"));
    var mode = App.AI_MODE(modeId);
    var url = App.storage.get("oge_ai_endpoint", AI.CONFIG.endpoint) || AI.CONFIG.endpoint;

    var payload = {
      model: App.storage.get("oge_ai_model", AI.CONFIG.model) || AI.CONFIG.model,
      messages: messages,
      temperature: AI.CONFIG.temperature,
      max_tokens: mode.id === "eco" ? 500 : AI.CONFIG.maxTokens,
      stream: true,
      stream_options: { include_usage: true }
    };

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, AI.CONFIG.timeoutMs);

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    }).then(function (resp) {
      if (!resp.ok) {
        return resp.text().then(function (t) {
          var msg = "HTTP " + resp.status;
          try { var j = JSON.parse(t); if (j.error && j.error.message) msg += ": " + j.error.message; } catch (e) {}
          var err = new Error(msg);
          err.status = resp.status;
          throw err;
        });
      }
      var reader = resp.body.getReader();
      var dec = new TextDecoder("utf-8");
      var buf = "", text = "", usage = null;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            clearTimeout(timer);
            return { text: text, usage: usage };
          }
          buf += dec.decode(r.value, { stream: true });
          var parts = buf.split("\n");
          buf = parts.pop();
          parts.forEach(function (line) {
            line = line.trim();
            if (!line || line.indexOf("data:") !== 0) return;
            var data = line.slice(5).trim();
            if (data === "[DONE]") return;
            try {
              var j = JSON.parse(data);
              if (j.usage) usage = j.usage;
              var d = j.choices && j.choices[0] && j.choices[0].delta;
              if (d && d.content) {
                text += d.content;
                cb && cb(d.content, text);
              }
            } catch (e) { /* неполный кусок — дождёмся следующего */ }
          });
          return pump();
        });
      }
      return pump();
    }).catch(function (e) {
      clearTimeout(timer);
      if (e.name === "AbortError") throw new Error("Ответ не пришёл за " + (AI.CONFIG.timeoutMs / 1000) + " секунд. Попробуй ещё раз.");
      if (String(e.message).indexOf("Failed to fetch") !== -1) {
        throw new Error("Нет связи с api.deepseek.com. Проверь интернет; если сайт открыт как файл — попробуй открыть его через localhost.");
      }
      throw e;
    });
  };

  /* ---------- локальная страховка: работает без ключа и без трат ---------- */
  function localAnswer(question, ctx) {
    var q = String(question || "").toLowerCase();
    var l = ctx.lesson;
    var out = [];
    if (!l) {
      out.push("Нейронка выключена (нет ключа), поэтому отвечаю по-простому. Открой урок — и я разберу его тему.");
    } else {
      out.push("Нейронка выключена (нет ключа), отвечаю по уроку «" + l.title + "».");
    }
    if (/что так|объясни|не понял|непонятн|как реш/.test(q) && l) {
      out.push("");
      out.push("Коротко по теме: " + String(l.sub || "").trim() + ".");
      var theory = String(l.theory || "").split("\n").filter(function (s) { return s.trim() && s.trim() !== "~~~"; });
      var hacks = theory.filter(function (s) { return s.indexOf("> ") === 0; }).slice(0, 2);
      var errs = theory.filter(function (s) { return s.indexOf("!! ") === 0; }).slice(0, 2);
      var main = theory.filter(function (s) { return s.indexOf("> ") !== 0 && s.indexOf("!! ") !== 0; }).slice(0, 4);
      main.forEach(function (s) { out.push(s.replace(/\*\*/g, "")); });
      hacks.forEach(function (s) { out.push("Лайфхак: " + s.replace(/^>\s*/, "").replace(/\*\*/g, "")); });
      errs.forEach(function (s) { out.push("Ошибка: " + s.replace(/^!!\s*/, "").replace(/\*\*/g, "")); });
    } else if (/план|что дальше|с чего начать/.test(q)) {
      var s = ST.summary();
      var next = ST.nextLesson();
      out.push("Пройдено " + s.finished + " из " + s.total + " элементов (" + s.percent + "%).");
      if (next) out.push("Дальше: №" + next.id + " «" + next.title + "».");
      out.push("Занимайся по 20–25 минут в день — так лучше запоминается.");
    } else if (/ошибк|не получ|проверь/.test(q)) {
      out.push("Посмотри строку «Ошибка» в уроке и найди такую же ситуацию в своём решении.");
      var e2 = String(l && l.theory || "").split("\n").filter(function (s) { return s.indexOf("!! ") === 0; }).slice(0, 2);
      e2.forEach(function (s) { out.push(s.replace(/^!!\s*/, "Типичная ошибка: ").replace(/\*\*/g, "")); });
    } else {
      out.push("Могу: объяснить тему урока, показать лайфхаки, подсказать, что делать дальше, разобрать твою ошибку.");
      out.push("Подключи ключ DeepSeek в файле config/deepseek-key.js — и я смогу отвечать на любые вопросы.");
    }
    return out.join("\n");
  }

  /* ---------- главный вход: спросить провожатого ---------- */
  AI.ask = function (question, opts) {
    opts = opts || {};
    var modeId = opts.mode || AI.mode();
    var ctx = AI.context();
    var info = App.usage.info();

    var gate = App.canUseMode(modeId);
    if (!gate.ok) {
      var plan = ST.planDef();
      if (gate.why === "plan") {
        var better = null;
        for (var i = 0; i < App.PLANS.length; i++) {
          if (App.PLANS[i].modes.indexOf(modeId) !== -1 && App.PLANS[i].dailyTokens > plan.dailyTokens) { better = App.PLANS[i]; break; }
        }
        var e = new Error("Режим «" + App.AI_MODE(modeId).name + "» входит в тариф «" + (better ? better.name : "Про") + "»" +
          (better ? " — там " + App.util.fmt(better.dailyTokens) + " токенов в день." : "."));
        e.code = "PLAN";
        return { error: e };
      }
      var e2 = new Error("На сегодня лимит почти исчерпан: осталось " + info.left + " токенов. " +
        "Он обновится ночью, или переключись на «Эконом» — там короткие ответы и маленький расход.");
      e2.code = "BUDGET";
      return { error: e2 };
    }

    if (!AI.configured()) {
      return { local: true, text: localAnswer(question, ctx) };
    }

    var hist = AI.history().slice(-AI.CONFIG.historyLimit).map(function (m) {
      return { role: m.role, content: m.content };
    });
    var messages = [{ role: "system", content: AI.systemPrompt(modeId) }]
      .concat(hist)
      .concat([{ role: "user", content: String(question) }]);

    var streamCb = opts.onChunk || null;
    var started = Date.now();
    return AI.chat(messages, modeId, streamCb).then(function (res) {
      var u = res.usage || {};
      var prompt = u.prompt_tokens || Math.ceil(JSON.stringify(messages).length / 3.2);
      var completion = u.completion_tokens || Math.ceil(res.text.length / 3.2);
      var total = u.total_tokens || (prompt + completion);
      App.usage.add(total, modeId);

      var h = AI.history();
      h.push({ role: "user", content: String(question), at: Date.now() });
      h.push({ role: "assistant", content: res.text, at: Date.now(), tokens: total, mode: modeId });
      AI.setHistory(h);

      return {
        text: res.text, usage: { prompt: prompt, completion: completion, total: total },
        left: App.usage.info().left, ms: Date.now() - started, mode: modeId
      };
    });
  };

  /** короткая версия вопроса для «Эконом»: убираем лишние слова */
  AI.shorten = function (q) {
    var s = String(q).trim();
    if (s.length < 220) return s;
    return s.slice(0, 220) + "…";
  };
})();
