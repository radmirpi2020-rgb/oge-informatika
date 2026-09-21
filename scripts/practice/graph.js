/* graph.js — практика по графам: маршрут кликами по вершинам, подсчёт пути, Дейкстра */
(function () {
  "use strict";
  var P = App.PRACTICE = App.PRACTICE || {};

  function build(cfg) {
    var nodes = (cfg.nodes || []).map(function (n, i) {
      if (typeof n === "string" || typeof n === "number") return { id: String(n), x: 0, y: 0, auto: true };
      return { id: String(n.id), x: n.x, y: n.y, auto: n.x == null };
    });
    var n = nodes.length || 1;
    nodes.forEach(function (nd, i) {
      if (nd.auto) {
        var ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        nd.x = 60 + 110 * Math.cos(ang);
        nd.y = 60 + 110 * Math.sin(ang);
      }
    });
    var edges = (cfg.edges || []).map(function (e) {
      return { a: String(e[0]), b: String(e[1]), w: e.length > 2 ? Number(e[2]) : 1 };
    });
    return { nodes: nodes, edges: edges, directed: !!cfg.directed };
  }

  function findNode(g, id) {
    for (var i = 0; i < g.nodes.length; i++) if (g.nodes[i].id === id) return g.nodes[i];
    return null;
  }
  function neighbours(g, id) {
    var out = [];
    g.edges.forEach(function (e) {
      if (e.a === id) out.push({ to: e.b, w: e.w, e: e });
      else if (!g.directed && e.b === id) out.push({ to: e.a, w: e.w, e: e });
    });
    return out;
  }

  /** кратчайший путь алгоритмом Дейкстры */
  function shortest(g, from, to) {
    var dist = {}, prev = {}, used = {};
    g.nodes.forEach(function (n) { dist[n.id] = Infinity; });
    dist[from] = 0;
    for (;;) {
      var best = null;
      g.nodes.forEach(function (n) {
        if (used[n.id]) return;
        if (best === null || dist[n.id] < dist[best]) best = n.id;
      });
      if (best === null || dist[best] === Infinity) break;
      if (best === to) break;
      used[best] = 1;
      neighbours(g, best).forEach(function (nb) {
        var alt = dist[best] + nb.w;
        if (alt < dist[nb.to]) { dist[nb.to] = alt; prev[nb.to] = best; }
      });
    }
    if (dist[to] === Infinity) return { path: null, cost: Infinity };
    var path = [to], cur = to;
    while (cur !== from) { cur = prev[cur]; if (!cur) return { path: null, cost: Infinity }; path.unshift(cur); }
    return { path: path, cost: dist[to] };
  }

  /** сколько путей из from в to (перебор без повторного прохода по вершине) */
  function countPaths(g, from, to, limit) {
    var count = 0;
    var visited = {};
    (function dfs(v) {
      if (count > (limit || 10000)) return;
      if (v === to) { count++; return; }
      visited[v] = 1;
      neighbours(g, v).forEach(function (nb) { if (!visited[nb.to]) dfs(nb.to); });
      delete visited[v];
    })(from);
    return count;
  }

  function pathCost(g, path) {
    var sum = 0;
    for (var i = 0; i < path.length - 1; i++) {
      var a = path[i], b = path[i + 1];
      var e = null;
      g.edges.forEach(function (ed) {
        if ((ed.a === a && ed.b === b) || (!g.directed && ed.b === a && ed.a === b)) e = ed;
      });
      if (!e) return null;
      sum += e.w;
    }
    return sum;
  }

  P.graph = {
    shortest: shortest,
    countPaths: countPaths,
    build: build,
    mount: function (host, cfg, ctx) {
      var g = build(cfg);
      var lessonId = (ctx.lesson && ctx.lesson.id) || 0;
      var key = "graph_" + lessonId;
      var saved = App.state.practice[key] || {};
      var path = Array.isArray(saved.path) ? saved.path.slice() : [];
      var expectPath = Array.isArray(cfg.answer);
      var start = cfg.start ? String(cfg.start) : (cfg.nodes && cfg.nodes[0] ? String(cfg.nodes[0].id || cfg.nodes[0]) : null);

      if (!expectPath && path.length === 0 && !cfg.mode) {
        // режим ввода числа (подсчёт путей), путь не нужен
      }

      host.innerHTML =
        '<div class="practical-task"><b>Задание</b>' + App.util.esc(cfg.task || "") + "</div>" +
        '<div class="tiny muted" style="margin-bottom:8px">Кликай по вершинам, чтобы строить маршрут' +
          (start ? " (начало — " + App.util.esc(start) + ")" : "") + ". Повторный клик по последней вершине убирает её.</div>" +
        '<div class="robot-canvas-wrap" id="grWrap"></div>' +
        '<div class="robot-log" id="grLog">Маршрут пуст.</div>' +
        '<div class="row" style="margin-top:10px">' +
          '<button class="btn sm ghost" id="grUndo">← Убрать вершину</button>' +
          '<button class="btn sm ghost" id="grClear">Очистить</button>' +
          '<button class="btn sm ghost" id="grShort">Показать кратчайший путь</button>' +
        "</div>" +
        '<div id="grAnswerBox" style="margin-top:12px">' +
          '<div class="field"><label>Ответ числом (если задание про количество или длину)</label>' +
            '<input type="text" id="grNum" value="' + App.util.esc(saved.num || "") + '"></div>' +
        "</div>" +
        '<div class="row"><button class="btn" id="grCheck">Проверить</button></div>' +
        '<div class="alert" id="grRes" style="display:none"></div>';

      var wrap = host.querySelector("#grWrap");
      var log = host.querySelector("#grLog");

      function draw(hotPath) {
        var w = 340, h = 300;
        var svg = ['<svg class="grid-svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '">'];
        var hotEdges = {};
        if (hotPath) {
          for (var i = 0; i < hotPath.length - 1; i++) {
            hotEdges[hotPath[i] + "|" + hotPath[i + 1]] = 1;
            hotEdges[hotPath[i + 1] + "|" + hotPath[i]] = 1;
          }
        }
        g.edges.forEach(function (e) {
          var na = findNode(g, e.a), nb = findNode(g, e.b);
          if (!na || !nb) return;
          var hot = hotEdges[e.a + "|" + e.b] || hotEdges[e.b + "|" + e.a];
          svg.push('<line class="edge-l' + (hot ? " hot" : "") + '" x1="' + (na.x + 30) + '" y1="' + (na.y + 30) +
            '" x2="' + (nb.x + 30) + '" y2="' + (nb.y + 30) + '"/>');
          var mx = (na.x + nb.x) / 2 + 30, my = (na.y + nb.y) / 2 + 30;
          svg.push('<text x="' + mx + '" y="' + (my - 3) + '" text-anchor="middle">' + e.w + "</text>");
        });
        g.nodes.forEach(function (n) {
          svg.push('<circle class="node-c" cx="' + (n.x + 30) + '" cy="' + (n.y + 30) + '" r="18"/>');
          svg.push('<text x="' + (n.x + 30) + '" y="' + (n.y + 34) + '" text-anchor="middle">' + App.util.esc(n.id) + "</text>");
          svg.push('<rect x="' + (n.x + 8) + '" y="' + (n.y + 8) + '" width="44" height="44" fill="transparent" data-node="' + App.util.esc(n.id) + '" style="cursor:pointer"/>');
        });
        svg.push("</svg>");
        wrap.innerHTML = svg.join("");
        wrap.querySelectorAll("[data-node]").forEach(function (r) {
          r.addEventListener("click", function () { clickNode(r.getAttribute("data-node")); });
        });
      }

      function clickNode(id) {
        if (path.length && path[path.length - 1] === id) path.pop();
        else path.push(id);
        saved.path = path;
        saved.num = host.querySelector("#grNum").value;
        App.state.practice[key] = saved;
        App.state.savePractice();
        refresh();
      }

      function refresh() {
        draw(path.length ? path : null);
        if (!path.length) { log.textContent = "Маршрут пуст."; return; }
        var cost = pathCost(g, path);
        if (cost === null) {
          log.innerHTML = '<span style="color:var(--err)">✗ Между ' + App.util.esc(path[path.length - 2]) + " и " +
            App.util.esc(path[path.length - 1]) + " нет ребра.</span>";
        } else {
          log.innerHTML = "Маршрут: " + path.join(" → ") + " · длина " + cost;
        }
      }

      host.querySelector("#grUndo").addEventListener("click", function () { path.pop(); refresh(); });
      host.querySelector("#grClear").addEventListener("click", function () { path = []; refresh(); });
      host.querySelector("#grShort").addEventListener("click", function () {
        var from = start || (cfg.nodes && cfg.nodes[0] && (cfg.nodes[0].id || cfg.nodes[0]));
        var to = cfg.goal || (Array.isArray(cfg.answer) ? cfg.answer[cfg.answer.length - 1] : null);
        if (!from || !to) { log.textContent = "Для подсказки нужны start и goal в задании."; return; }
        var r = shortest(g, String(from), String(to));
        if (!r.path) { log.textContent = "Пути между этими вершинами нет."; return; }
        path = r.path.slice();
        draw(path);
        log.innerHTML = "Кратчайший путь: <b>" + path.join(" → ") + "</b>, длина " + r.cost + ".";
      });

      host.querySelector("#grCheck").addEventListener("click", function () {
        var box = host.querySelector("#grRes");
        box.style.display = "block";
        var ok, msg;
        if (expectPath) {
          var want = cfg.answer.map(String);
          ok = path.length === want.length && path.every(function (v, i) { return v === want[i]; });
          if (!ok && cfg.anyShortest === true) {
            var cost = pathCost(g, path);
            var bestCost = pathCost(g, want);
            ok = cost !== null && cost === bestCost;
          }
          msg = ok ? "✓ Маршрут верный." : "✗ Нужен другой маршрут: проверь, что путь идёт по рёбрам и не проходит вершину дважды.";
        } else {
          var num = host.querySelector("#grNum").value;
          ok = App.util.checkAnswer(num, cfg.answer);
          msg = ok ? "✓ Верно!" : "✗ Не совпало. Посчитай ещё раз: перебери все маршруты, не забывая про обратный порядок.";
        }
        saved.num = host.querySelector("#grNum").value;
        saved.path = path;
        App.state.practice[key] = saved;
        App.state.savePractice();
        box.className = "alert " + (ok ? "ok" : "err");
        box.textContent = msg;
        if (ok) ctx.onSolved && ctx.onSolved();
      });

      draw(path.length ? path : null);
      refresh();
    }
  };
})();
