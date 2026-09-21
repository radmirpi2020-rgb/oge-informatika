/* pages/account.js — аккаунт ученика: регистрация, вход, подтверждение почты, сброс пароля.

   Зачем: пока аккаунта нет, прогресс живёт только в этом браузере. С аккаунтом он
   сохраняется на сервере (коллекция progress) и не теряется при чистке браузера.

   Работает поверх REST Payload:
     POST /api/students                     — регистрация (Payload шлёт письмо с подтверждением)
     POST /api/students/login               — вход, в ответ приходит token
     POST /api/students/logout              — выход
     POST /api/students/verify/:token       — подтверждение почты по ссылке из письма
     POST /api/students/forgot-password     — запрос сброса пароля
     POST /api/students/reset-password      — новый пароль по токену из письма
     GET  /api/students/me                  — кто я (нужен заголовок Authorization)

   Ссылки в письмах ведут на #/account?verify=… и #/account?reset=… — их разбирает accountView(). */
(function () {
  "use strict";

  /* ============================================================
     1. Состояние входа: токен, ученик, подписки на изменение
     ============================================================ */

  var AUTH = {};
  App.auth = AUTH;

  AUTH.TOKEN_KEY = "oge_student_token";
  AUTH.USER_KEY = "oge_student";

  AUTH.token = function () { return App.storage.get(AUTH.TOKEN_KEY, "") || ""; };
  AUTH.user = function () { return App.storage.get(AUTH.USER_KEY, null); };
  AUTH.logged = function () { return !!AUTH.token(); };

  var listeners = [];
  /** подписаться на изменение входа (нужно шапке и странице аккаунта) */
  AUTH.onChange = function (fn) {
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    };
  };

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(AUTH.user()); } catch (e) { App.showError(e); }
    });
  }

  function saveSession(token, user) {
    App.storage.set(AUTH.TOKEN_KEY, token);
    App.storage.set(AUTH.USER_KEY, user || null);
    /* тариф ученика хранится в аккаунте: сервер по нему решает, пускать ли к провожатому.
       Подтягиваем его сюда, чтобы интерфейс показывал то же самое, что разрешает сервер. */
    AUTH.applyPlan(user);
    emit();
  }

  /** привести тариф на сайте к тарифу из аккаунта (между free / full / max) */
  AUTH.applyPlan = function (user) {
    var p = user && user.plan;
    if (!p) return false;
    if (!App.plan(p) || App.plan(p).id !== p) return false;
    ST.setPlan(p);
    return true;
  };

  function clearSession() {
    App.storage.del(AUTH.TOKEN_KEY);
    App.storage.del(AUTH.USER_KEY);
    emit();
  }

  AUTH.logout = function () {
    var t = AUTH.token();
    clearSession();
    if (!t || !App.api || !App.api.enabled) return Promise.resolve({ ok: true });
    return App.api.post("/api/students/logout", {}, t)
      .catch(function () { return { ok: true }; });  /* токен уже убран локально — это главное */
  };

  /* ============================================================
     2. Запросы к серверу
     ============================================================ */

  function apiCall(method, path, body, token) {
    var base = (App.api && App.api.base) || "";
    if (!base) return Promise.reject(new Error("Сервер не настроен: в config/api.js пусто поле SITE_API."));

    var headers = { Accept: "application/json", "Content-Type": "application/json" };
    if (token || AUTH.token()) headers.Authorization = "JWT " + (token || AUTH.token());

    return fetch(base + path, {
      method: method,
      headers: headers,
      body: body == null ? undefined : JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data = {};
        try { data = txt ? JSON.parse(txt) : {}; } catch (e) { data = { raw: txt }; }
        if (!r.ok) {
          var err = new Error(messageOf(data, r.status));
          err.status = r.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  /** человеческое сообщение об ошибке вместо «Validation Error» */
  function messageOf(data, status) {
    if (data && data.errors && data.errors.length) {
      var e = data.errors[0];
      if (e.data && e.data.length && e.data[0].message) return e.data[0].message;
      if (e.message) return e.message;
    }
    if (data && data.message) return data.message;
    if (status === 401) return "Неверная почта или пароль.";
    if (status === 403) return "Сервер отклонил запрос. Проверь настройки доступа.";
    if (status === 409) return "Такая почта уже зарегистрирована.";
    if (status === 429) return "Слишком много попыток. Подожди немного и попробуй снова.";
    return "Не получилось: ошибка " + status + ".";
  }

  AUTH.register = function (email, password, extra) {
    return apiCall("POST", "/api/students", Object.assign({
      email: email,
      password: password,
      consent: true
    }, extra || {}));
  };

  AUTH.login = function (email, password) {
    return apiCall("POST", "/api/students/login", { email: email, password: password })
      .then(function (res) {
        saveSession(res.token, res.user || null);
        return res;
      });
  };

  AUTH.verify = function (token) {
    return apiCall("POST", "/api/students/verify/" + encodeURIComponent(token), null);
  };

  AUTH.forgot = function (email) {
    return apiCall("POST", "/api/students/forgot-password", { email: email });
  };

  AUTH.reset = function (token, password) {
    return apiCall("POST", "/api/students/reset-password", { token: token, password: password });
  };

  /** проверка сохранённого токена: если протух — молча выходим */
  AUTH.refresh = function () {
    if (!AUTH.logged()) return Promise.resolve(null);
    return apiCall("GET", "/api/students/me?depth=0").then(function (res) {
      var user = res.user || null;
      if (user) {
        App.storage.set(AUTH.USER_KEY, user);
        AUTH.applyPlan(user);
      }
      return user;
    }).catch(function (e) {
      if (e.status === 401) clearSession();
      return null;
    });
  };

  /* ============================================================
     3. Синхронизация прогресса с аккаунтом
     ============================================================ */

  function snapshot() {
    return {
      completed: App.storage.get(App.storage.KEYS.completed, {}) || {},
      answers: App.storage.get(App.storage.KEYS.answers, {}) || {},
      practice: App.storage.get(App.storage.KEYS.practice, {}) || {},
      test: App.storage.get(App.storage.KEYS.test, null),
      streak: App.storage.get(App.storage.KEYS.streak, 0) || 0
    };
  }

  /** отправить прогресс в аккаунт: один документ на ученика, создаём или обновляем */
  AUTH.pushProgress = function () {
    if (!AUTH.logged()) return Promise.reject(new Error("Нужно войти в аккаунт."));
    var payload = Object.assign({ source: "сайт: " + (navigator.userAgent || "").slice(0, 60) }, snapshot());
    var id = AUTH.progressId;

    if (id) {
      return apiCall("PATCH", "/api/progress/" + id, payload).then(function (r) { return r.doc || r; });
    }
    return apiCall("GET", "/api/progress?limit=1&depth=0").then(function (res) {
      var doc = res.docs && res.docs[0];
      if (doc) {
        AUTH.progressId = doc.id;
        return apiCall("PATCH", "/api/progress/" + doc.id, payload).then(function (r) { return r.doc || r; });
      }
      var user = AUTH.user();
      return apiCall("POST", "/api/progress", Object.assign({ student: user && user.id }, payload))
        .then(function (r) {
          var created = r.doc || r;
          AUTH.progressId = created.id;
          return created;
        });
    });
  };

  /** забрать прогресс из аккаунта (например, на новом устройстве) */
  AUTH.pullProgress = function () {
    if (!AUTH.logged()) return Promise.reject(new Error("Нужно войти в аккаунт."));
    return apiCall("GET", "/api/progress?limit=1&depth=0").then(function (res) {
      var doc = res.docs && res.docs[0];
      if (!doc) return null;
      AUTH.progressId = doc.id;
      if (doc.completed) App.storage.set(App.storage.KEYS.completed, doc.completed);
      if (doc.answers) App.storage.set(App.storage.KEYS.answers, doc.answers);
      if (doc.practice) App.storage.set(App.storage.KEYS.practice, doc.practice);
      if (doc.test) App.storage.set(App.storage.KEYS.test, doc.test);
      if (typeof doc.streak === "number") App.storage.set(App.storage.KEYS.streak, doc.streak);
      /* перечитываем состояние из хранилища и перерисовываем страницы */
      ST.answers = App.storage.get(App.storage.KEYS.answers, {}) || {};
      ST.completed = App.storage.get(App.storage.KEYS.completed, {}) || {};
      ST.practice = App.storage.get(App.storage.KEYS.practice, {}) || {};
      ST.test = App.storage.get(App.storage.KEYS.test, null);
      return doc;
    });
  };

  /* ============================================================
     4. Интерфейс
     ============================================================ */

  function loggedPanel() {
    var u = AUTH.user() || {};
    var s = ST.summary();
    return '<div class="card">' +
        '<div class="kicker">Ты вошёл</div>' +
        '<div class="progress-row"><span>Почта</span><span class="val">' + App.util.esc(u.email || "—") + "</span></div>" +
        '<div class="progress-row"><span>Имя</span><span class="val">' + App.util.esc(u.name || "не указано") + "</span></div>" +
        '<div class="progress-row"><span>Класс</span><span class="val">' + App.util.esc(u.grade || "—") + "</span></div>" +
        '<div class="progress-row"><span>Подтверждение почты</span><span class="val">' +
          (u._verified ? "подтверждена" : '<b class="warn">не подтверждена</b>') + "</span></div>" +
        '<div class="progress-row"><span>Прогресс на сайте</span><span class="val">' +
          s.finished + " / " + s.total + " элементов</span></div>" +
      "</div>" +
      (u._verified ? "" :
        '<div class="alert warn">Почта не подтверждена. Подтверди — иначе прогресс может не сохраниться. ' +
        '<button class="btn sm" id="authResend">Отправить письмо ещё раз</button></div>') +
      '<div class="row" style="margin-top:14px">' +
        '<button class="btn" id="authPush">Сохранить прогресс в аккаунт</button>' +
        '<button class="btn ghost" id="authPull">Загрузить прогресс из аккаунта</button>' +
        '<button class="btn ghost" id="authOut">Выйти</button>' +
      "</div>" +
      '<div id="authMsg" class="tiny muted" style="margin-top:10px"></div>';
  }

  function guestPanel() {
    return '<div class="grid two">' +
      '<div class="card">' +
        '<div class="kicker">Вход</div>' +
        '<p class="tiny muted">Почта и пароль, которые ты указал при регистрации.</p>' +
        '<label class="field"><span>Почта</span><input type="email" id="inEmail" autocomplete="email" placeholder="ivan@example.ru"></label>' +
        '<label class="field"><span>Пароль</span><input type="password" id="inPass" autocomplete="current-password" placeholder="пароль"></label>' +
        '<button class="cta" id="btnLogin">Войти</button>' +
        '<div class="tiny muted" style="margin-top:10px"><a href="#" id="btnForgot">Забыл пароль</a> · ' +
          '<a href="#" id="btnResend">Письмо не пришло</a></div>' +
      "</div>" +
      '<div class="card">' +
        '<div class="kicker">Регистрация</div>' +
        '<p class="tiny muted">Нужна, чтобы прогресс сохранялся на сервере, а не только в этом браузере.</p>' +
        '<label class="field"><span>Имя</span><input type="text" id="regName" autocomplete="name" placeholder="как к тебе обращаться"></label>' +
        '<label class="field"><span>Почта</span><input type="email" id="regEmail" autocomplete="email" placeholder="ivan@example.ru"></label>' +
        '<label class="field"><span>Пароль</span><input type="password" id="regPass" autocomplete="new-password" placeholder="минимум 8 символов"></label>' +
        '<label class="field"><span>Что готовим</span><select id="regCourse">' +
          '<option value="oge">ОГЭ по информатике</option>' +
          '<option value="base">Школьная программа 5–9</option>' +
          '<option value="both">И то, и другое</option>' +
        "</select></label>" +
        '<label class="check"><input type="checkbox" id="regConsent"> Согласен на обработку данных и хранение прогресса</label>' +
        '<button class="cta" id="btnRegister">Создать аккаунт</button>' +
      "</div>" +
    "</div>" +
    '<div id="authMsg" class="alert" style="display:none"></div>' +
    '<div class="alert">Сервер сейчас <b>' + (App.api && App.api.enabled ? "настроен" : "не настроен") + "</b>. " +
      (App.api && App.api.enabled ? "" : "Чтобы аккаунт заработал, укажи адрес сервера в config/api.js.") + "</div>";
  }

  function verifyPanel(token) {
    return '<div class="card">' +
      '<div class="kicker">Подтверждение почты</div>' +
      '<h3>Проверяю ссылку…</h3>' +
      '<div id="authMsg" class="tiny muted">Секунду.</div>' +
    "</div>" +
    '<script type="application/json" id="verifyToken">' + JSON.stringify({ token: token }) + "</script>";
  }

  function resetPanel(token) {
    return '<div class="card">' +
      '<div class="kicker">Новый пароль</div>' +
      '<p class="tiny muted">Придумай новый пароль — старый перестанет работать.</p>' +
      '<label class="field"><span>Новый пароль</span><input type="password" id="newPass" autocomplete="new-password" placeholder="минимум 8 символов"></label>' +
      '<button class="cta" id="btnReset">Сохранить пароль</button>' +
      '<div id="authMsg" class="alert" style="display:none"></div>' +
    "</div>";
  }

  function msg(text, kind) {
    var el = document.getElementById("authMsg");
    if (!el) return;
    el.className = "alert " + (kind || "");
    el.style.display = "";
    el.textContent = text;
  }

  function busy(btn, on, label) {
    if (!btn) return;
    btn.disabled = !!on;
    if (on) { btn.dataset.was = btn.textContent; btn.textContent = label || "Секунду…"; }
    else if (btn.dataset.was) { btn.textContent = btn.dataset.was; }
  }

  function fail(e) {
    msg(e && e.message ? e.message : String(e), "err");
  }

  /* ============================================================
     5. Страница
     ============================================================ */

  App.router.register("account", {
    view: function (param) {
      var q = App.router.query ? App.router.query() : {};
      var head = '<div class="kicker">Аккаунт</div><h1>Прогресс, который не потеряется</h1>' +
        '<p class="lead">Без аккаунта прогресс живёт в этом браузере: почистил данные — начал заново. ' +
        "С аккаунтом он хранится на сервере и открывается на любом устройстве.</p>";

      if (q.verify) return head + verifyPanel(q.verify);
      if (q.reset) return head + resetPanel(q.reset);
      return head + (AUTH.logged() ? loggedPanel() : guestPanel());
    },

    bind: function () {
      var q = App.router.query ? App.router.query() : {};

      /* --- ссылка из письма: подтверждение почты --- */
      if (q.verify) {
        AUTH.verify(q.verify).then(function () {
          msg("Почта подтверждена. Теперь прогресс будет сохраняться в аккаунте.", "ok");
        }).catch(function (e) {
          msg("Ссылка не сработала: " + (e.message || e) + ". Запроси письмо заново на этой странице.", "err");
        });
        return;
      }

      /* --- ссылка из письма: сброс пароля --- */
      if (q.reset) {
        var btnReset = document.getElementById("btnReset");
        if (btnReset) btnReset.addEventListener("click", function () {
          var p = (document.getElementById("newPass") || {}).value || "";
          if (p.length < 8) return msg("Пароль должен быть не короче 8 символов.", "err");
          busy(btnReset, true);
          AUTH.reset(q.reset, p).then(function () {
            msg("Пароль обновлён. Открой вход и войди с новым паролем.", "ok");
            setTimeout(function () { App.router.go("account"); }, 1500);
          }).catch(function (e) { busy(btnReset, false); fail(e); });
        });
        return;
      }

      if (AUTH.logged()) {
        var resend = document.getElementById("authResend");
        if (resend) resend.addEventListener("click", function () {
          var u = AUTH.user() || {};
          busy(resend, true);
          AUTH.forgot(u.email).then(function () {
            msg("Письмо отправлено на " + u.email + ". Проверь и папку «спам».", "ok");
          }).catch(fail).then(function () { busy(resend, false); });
        });

        var push = document.getElementById("authPush");
        if (push) push.addEventListener("click", function () {
          busy(push, true);
          AUTH.pushProgress().then(function () {
            msg("Прогресс сохранён в аккаунт.", "ok");
          }).catch(fail).then(function () { busy(push, false); });
        });

        var pull = document.getElementById("authPull");
        if (pull) pull.addEventListener("click", function () {
          busy(pull, true);
          AUTH.pullProgress().then(function (doc) {
            if (!doc) return msg("В аккаунте пока нет сохранённого прогресса.", "warn");
            msg("Прогресс загружен из аккаунта. Обнови страницу, чтобы увидеть его везде.", "ok");
          }).catch(fail).then(function () { busy(pull, false); });
        });

        var out = document.getElementById("authOut");
        if (out) out.addEventListener("click", function () {
          AUTH.logout().then(function () { App.router.render(); });
        });
        return;
      }

      /* --- вход --- */
      var btnLogin = document.getElementById("btnLogin");
      if (btnLogin) btnLogin.addEventListener("click", function () {
        var email = (document.getElementById("inEmail") || {}).value || "";
        var pass = (document.getElementById("inPass") || {}).value || "";
        if (!email || !pass) return msg("Заполни почту и пароль.", "err");
        busy(btnLogin, true);
        AUTH.login(email.trim(), pass).then(function () {
          App.router.render();
        }).catch(function (e) {
          busy(btnLogin, false);
          var text = String((e && e.message) || "");
          if (e.status === 401 || /verify|verified|подтвер/i.test(text)) {
            msg("Вход не получился. Проверь почту и пароль. Если почта ещё не подтверждена — " +
                "нажми «Письмо не пришло» и открой ссылку из письма.", "err");
          } else fail(e);
        });
      });

      /* --- регистрация --- */
      var btnReg = document.getElementById("btnRegister");
      if (btnReg) btnReg.addEventListener("click", function () {
        var name = (document.getElementById("regName") || {}).value || "";
        var email = (document.getElementById("regEmail") || {}).value || "";
        var pass = (document.getElementById("regPass") || {}).value || "";
        var course = (document.getElementById("regCourse") || {}).value || "oge";
        var consent = !!(document.getElementById("regConsent") || {}).checked;

        if (!email || !pass) return msg("Нужны почта и пароль.", "err");
        if (pass.length < 8) return msg("Пароль должен быть не короче 8 символов.", "err");
        if (!consent) return msg("Отметь согласие на обработку данных — без него аккаунт создать нельзя.", "err");

        busy(btnReg, true);
        AUTH.register(email.trim(), pass, { name: name.trim(), course: course }).then(function () {
          msg("Аккаунт создан. На " + email.trim() + " отправлено письмо со ссылкой для подтверждения.", "ok");
          return AUTH.login(email.trim(), pass).catch(function () { return null; });
        }).then(function () {
          App.router.render();
        }).catch(function (e) {
          busy(btnReg, false);
          fail(e);
        });
      });

      /* --- забыл пароль / письмо не пришло --- */
      var btnForgot = document.getElementById("btnForgot");
      if (btnForgot) btnForgot.addEventListener("click", function (ev) {
        ev.preventDefault();
        var email = (document.getElementById("inEmail") || {}).value || "";
        if (!email) return msg("Сначала впиши почту в поле выше — на неё придёт письмо.", "err");
        AUTH.forgot(email.trim()).then(function () {
          msg("Письмо со ссылкой для сброса пароля отправлено на " + email.trim() + ".", "ok");
        }).catch(fail);
      });

      var btnResend2 = document.getElementById("btnResend");
      if (btnResend2) btnResend2.addEventListener("click", function (ev) {
        ev.preventDefault();
        var email = (document.getElementById("inEmail") || {}).value || "";
        if (!email) return msg("Сначала впиши почту в поле выше.", "err");
        AUTH.forgot(email.trim()).then(function () {
          msg("Если такая почта зарегистрирована, письмо отправлено. Проверь папку «спам».", "ok");
        }).catch(fail);
      });
    }
  });
})();
