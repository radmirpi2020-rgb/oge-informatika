/* robot.js — практика «Б»: блочный конструктор, сетка, анимация исполнителя */
(function () {
  "use strict";
  var P = App.PRACTICE = App.PRACTICE || {};
  var CELL = 40, PAD = 14;

  var CATALOG = {
    forward: { label: "Вперёд", params: 1, def: 1 },
    back: { label: "Назад", params: 1, def: 1 },
    turn_right: { label: "Повернуть направо", params: 0 },
    turn_left: { label: "Повернуть налево", params: 0 },
    right: { label: "Направо", params: 0 },
    left: { label: "Налево", params: 0 },
    up: { label: "Вверх", params: 0 },
    down: { label: "Вниз", params: 0 },
    paint: { label: "Опустить перо", params: 0 },
    nopaint: { label: "Поднять перо", params: 0 },
    repeat: { label: "Повторить", params: 2, def: [3, 1] },
    ifwall: { label: "Если стена — повернуть", params: 0 },
    ifgoal: { label: "Если флаг — стоп", params: 0 },
    stop: { label: "Стоп", params: 0 }
  };

  /* В данных уроков блоки поворотов названы коротко (turn_r/turn_l) —
     приводим названия к одному виду, чтобы кнопки всегда попадали в палитру. */
  var ALIAS = {
    turn_r: "turn_right", turn_l: "turn_left",
    forward_n: "forward", back_n: "back", jump: "forward",
    if_wall: "ifwall", if_goal: "ifgoal", pen_down: "paint", pen_up: "nopaint"
  };
  function canonBlock(name) { return ALIAS[name] || name; }

  function pt(v, fb) {
    if (!v) return fb;
    if (Array.isArray(v)) return { x: Number(v[0]) || 0, y: Number(v[1]) || 0 };
    return { x: Number(v.x) || 0, y: Number(v.y) || 0 };
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  P.robot = {
    mount: function (host, cfg, ctx) {
      cfg = cfg || {};
      var field = cfg.field || {};
      var w = field.w || 10, h = field.h || 10;
      var start = pt(field.start, { x: 0, y: 0 });
      var goal = pt(field.goal, pt(cfg.target, { x: 8, y: 0 }));
      var walls = (field.walls || []).map(function (p, i) { var q = pt(p, { x: -1, y: -1 }); q.id = "w" + i; return q; });
      var drawMode = !!(cfg.draw || field.draw);
      var allowed = (cfg.allowed || ["forward", "back", "stop"]).slice();
      allowed = (allowed.map(canonBlock).filter(function (a) { return !!CATALOG[a]; }));
      if (drawMode && allowed.indexOf("paint") === -1) allowed.push("paint");
      if (!allowed.length) allowed = ["forward", "back", "stop"];
      var lessonId = (ctx.lesson && ctx.lesson.id) || 0;
      var key = "robot_" + lessonId;
      var saved = App.state.practice[key] || {};
      var prog = saved.prog ? clone(saved.prog) : [];

      var host0 = host;
      host0.innerHTML =
        '<div class="practical-task"><b>Задание</b>' + App.util.esc(cfg.task || "Собери программу, чтобы исполнитель дошёл до флага.") + "</div>" +
        '<div class="robot-wrap">' +
          '<div class="robot-palette" id="rbPalette"></div>' +
          '<div>' +
            '<div class="robot-prog" id="rbProg"></div>' +
            '<div class="row" style="margin-bottom:10px">' +
              '<button class="btn sm" id="rbRun">▶ Запустить</button>' +
              '<button class="btn sm ghost" id="rbReset">Сбросить</button>' +
              '<button class="btn sm ghost" id="rbClear">Очистить программу</button>' +
              '<button class="btn sm ghost" id="rbSol">Показать решение</button>' +
            "</div>" +
            '<div class="robot-log" id="rbLog">Программа пуста.</div>' +
          "</div>" +
        "</div>" +
        '<div class="robot-canvas-wrap" style="margin-top:12px" id="rbCanvasWrap"></div>' +
        '<div id="rbSolBox" style="display:none;margin-top:10px"><div class="alert soft"><div class="ex" id="rbSolTxt"></div></div></div>';

      var palette = host.querySelector("#rbPalette");
      var progBox = host.querySelector("#rbProg");
      var logBox = host.querySelector("#rbLog");
      var canvasWrap = host.querySelector("#rbCanvasWrap");

      allowed.forEach(function (a) {
        if (!CATALOG[a]) return;
        var b = document.createElement("button");
        b.className = "robot-block";
        b.textContent = "+ " + CATALOG[a].label;
        b.addEventListener("click", function () { addBlock(a, prog); renderProg(); simulate(); });
        palette.appendChild(b);
      });

      function addBlock(type, list) {
        if (type === "repeat") list.push({ type: "repeat", times: 3, body: [{ type: "forward", n: 1 }] });
        else if (type === "forward" || type === "back") list.push({ type: type, n: 1 });
        else list.push({ type: type });
      }

      function renderRow(list, container, depth) {
        list.forEach(function (blk, i) {
          var row = document.createElement("div");
          row.className = "robot-line";
          row.style.marginLeft = depth * 14 + "px";
          var cat = CATALOG[blk.type] || { label: blk.type };
          var html = "<span>" + cat.label + "</span>";
          if (blk.type === "repeat") {
            html += '<input type="number" min="1" max="50" value="' + (blk.times || 1) + '" data-f="times"> <span>раз</span>';
          }
          if (blk.type === "forward" || blk.type === "back") {
            html += '<input type="number" min="1" max="20" value="' + (blk.n || 1) + '" data-f="n">';
          }
          html += '<button class="plain" data-a="up" title="Выше">↑</button>' +
                  '<button class="plain" data-a="down" title="Ниже">↓</button>' +
                  '<button class="plain" data-a="add" title="Добавить блок внутрь">+</button>' +
                  '<button class="x" data-a="del" title="Удалить">✕</button>';
          row.innerHTML = html;

          row.querySelectorAll("input[data-f]").forEach(function (inp) {
            inp.addEventListener("change", function () {
              var v = Math.max(1, Math.min(50, Number(inp.value) || 1));
              blk[inp.getAttribute("data-f")] = v;
              simulate();
            });
          });
          row.querySelector('[data-a="del"]').addEventListener("click", function () {
            list.splice(i, 1); renderProg(); simulate();
          });
          row.querySelector('[data-a="up"]').addEventListener("click", function () {
            if (i === 0) return;
            var t = list[i - 1]; list[i - 1] = list[i]; list[i] = t;
            renderProg(); simulate();
          });
          row.querySelector('[data-a="down"]').addEventListener("click", function () {
            if (i >= list.length - 1) return;
            var t = list[i + 1]; list[i + 1] = list[i]; list[i] = t;
            renderProg(); simulate();
          });
          row.querySelector('[data-a="add"]').addEventListener("click", function () {
            if (!allowed[0]) return;
            var inner = allowed[0] === "repeat" ? allowed[1] || "forward" : allowed[0];
            addBlock(inner, list);
            if (inner === "repeat") { /* вложенный repeat — редкость, но допустим */ }
            renderProg(); simulate();
          });
          container.appendChild(row);

          if (blk.type === "repeat") {
            blk.body = blk.body || [];
            if (!blk.body.length) {
              var empty = document.createElement("div");
              empty.className = "tiny muted";
              empty.style.marginLeft = (depth + 1) * 14 + "px";
              empty.textContent = "внутри пусто";
              container.appendChild(empty);
            }
            renderRow(blk.body, container, depth + 1);
          }
        });
      }

      function renderProg() {
        progBox.innerHTML = "";
        if (!prog.length) {
          progBox.innerHTML = '<div class="tiny muted">Блоков пока нет. Жми блоки слева — они появятся здесь.</div>';
        } else {
          renderRow(prog, progBox, 0);
        }
        App.state.practice[key] = { prog: clone(prog), at: Date.now() };
        App.state.savePractice();
      }

      /* ---------- выполнение ---------- */
      function wallAt(x, y) {
        return walls.some(function (wl) { return wl.x === x && wl.y === y; });
      }
      function expand(list, depth) {
        var out = [];
        depth = depth || 0;
        if (depth > 6) return out;
        list.forEach(function (blk) {
          if (blk.type === "repeat") {
            for (var k = 0; k < Math.max(1, blk.times || 1); k++) {
              out = out.concat(expand(blk.body || [], depth + 1));
            }
          } else out.push(blk);
        });
        return out;
      }

      /** прогон программы: {cells, draw} */
      function walk(list) {
        var ops = expand(list);
        if (ops.length > 3000) throw new Error("Программа слишком длинная — уменьши число повторов");
        var dirs = [{ dx: 0, dy: -1, n: "вверх" }, { dx: 1, dy: 0, n: "вправо" }, { dx: 0, dy: 1, n: "вниз" }, { dx: -1, dy: 0, n: "влево" }];
        var dir = 1;                            // стартовое направление — вправо
        var x = start.x, y = start.y;
        var cells = [{ x: x, y: y, pen: false }];
        var guard = 0;
        var wasPaint = false;

        for (var i = 0; i < ops.length; i++) {
          var op = ops[i];
          var t = op.type;
          if (++guard > 6000) throw new Error("Слишком много шагов");
          if (t === "turn_right" || t === "right") dir = (dir + 1) % 4;
          else if (t === "turn_left" || t === "left") dir = (dir + 3) % 4;
          else if (t === "up") dir = 0;
          else if (t === "down") dir = 2;
          else if (t === "paint") { if (drawMode) { wasPaint = true; cells[cells.length - 1].pen = true; } }
          else if (t === "nopaint") { cells[cells.length - 1].pen = false; }
          else if (t === "stop") break;
          else if (t === "ifgoal") {
            if (x === goal.x && y === goal.y) break;
          } else if (t === "ifwall") {
            var d0 = dirs[dir];
            var ax = x + d0.dx, ay = y + d0.dy;
            if (ax < 0 || ax >= w || ay < 0 || ay >= h || wallAt(ax, ay)) {
              // стена впереди — разворачиваемся в поисках свободного направления
              for (var k = 1; k <= 4; k++) {
                var nd = (dir + k) % 4;
                var nx2 = x + dirs[nd].dx, ny2 = y + dirs[nd].dy;
                if (nx2 >= 0 && nx2 < w && ny2 >= 0 && ny2 < h && !wallAt(nx2, ny2)) {
                  if (nd === dir) break;
                  dir = nd;
                  break;
                }
              }
            }
          } else if (t === "forward" || t === "back") {
            var n = Math.max(0, op.n || 0);
            var step = t === "forward" ? dir : (dir + 2) % 4;
            var dv = dirs[step];
            for (var s = 0; s < n; s++) {
              var nx = x + dv.dx, ny = y + dv.dy;
              if (nx < 0 || nx >= w || ny < 0 || ny >= h) throw new Error("Исполнитель вышел за границы поля");
              if (wallAt(nx, ny)) {
                throw new Error("Исполнитель врезался в стену с клетки (" + x + ", " + y +
                  "). Обойди её: поверни и пройди другой дорогой.");
              }
              x = nx; y = ny;
              cells.push({ x: x, y: y, pen: cells[cells.length - 1].pen });
            }
          }
        }
        return { cells: cells, drawn: wasPaint };
      }

      function draw(cells, robotAt) {
        var svg = ['<svg class="grid-svg" width="' + (w * CELL + PAD * 2) + '" height="' + (h * CELL + PAD * 2) + '" viewBox="0 0 ' +
          (w * CELL + PAD * 2) + " " + (h * CELL + PAD * 2) + '">'];
        svg.push('<g transform="translate(' + PAD + "," + PAD + ')">');
        // сетка
        for (var yy = 0; yy < h; yy++) {
          svg.push('<rect class="cell-r" x="0" y="' + (yy * CELL) + '" width="' + (w * CELL) + '" height="' + CELL + '"/>');
        }
        for (var xx = 1; xx < w; xx++) {
          svg.push('<line class="cell-r" x1="' + (xx * CELL) + '" y1="0" x2="' + (xx * CELL) + '" y2="' + (h * CELL) + '"/>');
        }
        // флаг
        svg.push('<rect class="goal" x="' + (goal.x * CELL + 2) + '" y="' + (goal.y * CELL + 2) + '" width="' + (CELL - 4) + '" height="' + (CELL - 4) + '"/>');
        svg.push('<text x="' + (goal.x * CELL + CELL / 2) + '" y="' + (goal.y * CELL + CELL / 2 + 4) + '" text-anchor="middle">флаг</text>');
        // старт
        svg.push('<text x="' + (start.x * CELL + 4) + '" y="' + (start.y * CELL + 12) + '" opacity="0.5">старт</text>');
        // стены
        walls.forEach(function (wl) {
          svg.push('<rect class="wall" x="' + (wl.x * CELL + 1) + '" y="' + (wl.y * CELL + 1) + '" width="' + (CELL - 2) + '" height="' + (CELL - 2) + '"/>');
        });
        // путь
        if (cells && cells.length > 1) {
          if (drawMode) {
            var d = cells.map(function (c, i) {
              return (i ? "L" : "M") + (c.x * CELL + CELL / 2) + " " + (c.y * CELL + CELL / 2);
            }).join(" ");
            svg.push('<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="3"/>');
          } else {
            cells.forEach(function (c) {
              svg.push('<rect class="trail" x="' + (c.x * CELL + 3) + '" y="' + (c.y * CELL + 3) + '" width="' + (CELL - 6) + '" height="' + (CELL - 6) + '"/>');
            });
          }
        }
        var r = robotAt || start;
        svg.push('<circle class="robot" cx="' + (r.x * CELL + CELL / 2) + '" cy="' + (r.y * CELL + CELL / 2) + '" r="' + (CELL / 2 - 7) + '"/>');
        svg.push("</g></svg>");
        canvasWrap.innerHTML = svg.join("");
      }

      function animate(cells, done) {
        var i = 0;
        var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce || cells.length > 90) { draw(cells, cells[cells.length - 1]); done && done(); return; }
        var timer = setInterval(function () {
          draw(cells.slice(0, i + 1), cells[i]);
          i++;
          if (i >= cells.length) { clearInterval(timer); done && done(); }
        }, 170);
      }

      function simulate() {
        if (!prog.length) { draw([], start); logBox.textContent = "Программа пуста."; return null; }
        var res;
        try { res = walk(prog); }
        catch (e) {
          logBox.innerHTML = '<span style="color:var(--err)">✗ ' + App.util.esc(e.message) + "</span>";
          draw([], start);
          return null;
        }
        var cells = res.cells;
        var last = cells[cells.length - 1];
        if (drawMode) {
          if (res.drawn) {
            logBox.innerHTML = '<span style="color:var(--ok)">✓ Фигура нарисована: исполнитель прошёл ' +
              (cells.length - 1) + " клеток.</span>";
            ctx.onSolved && ctx.onSolved();
          } else {
            logBox.innerHTML = '<span style="color:var(--err)">✗ Перо не опускалось — линий нет. ' +
              "Добавь блок «Опустить перо» перед движением.</span>";
          }
        } else if (last.x === goal.x && last.y === goal.y) {
          logBox.innerHTML = '<span style="color:var(--ok)">✓ Цель достигнута: исполнитель на клетке (' + last.x + ", " + last.y + ") за " +
            (cells.length - 1) + " шагов.</span>";
          ctx.onSolved && ctx.onSolved();
        } else {
          var dx = Math.abs(last.x - goal.x), dy = Math.abs(last.y - goal.y);
          logBox.innerHTML = '<span style="color:var(--err)">✗ Исполнитель на клетке (' + last.x + ", " + last.y +
            "), до флага " + (dx + dy) + " шагов. Попробуй ещё.</span>";
        }
        draw(cells, last);
        return cells;
      }

      host.querySelector("#rbRun").addEventListener("click", function () {
        if (!prog.length) { logBox.textContent = "Сначала собери программу."; return; }
        var res;
        try { res = walk(prog); }
        catch (e) {
          logBox.innerHTML = '<span style="color:var(--err)">✗ ' + App.util.esc(e.message) + "</span>";
          return;
        }
        animate(res.cells, function () { simulate(); });
      });
      host.querySelector("#rbReset").addEventListener("click", function () { draw([], start); logBox.textContent = "Сброшено."; });
      host.querySelector("#rbClear").addEventListener("click", function () { prog = []; renderProg(); simulate(); });
      host.querySelector("#rbSol").addEventListener("click", function () {
        var box = host.querySelector("#rbSolBox");
        if (box.style.display === "none") {
          host.querySelector("#rbSolTxt").textContent = cfg.solution || "Решение не задано.";
          box.style.display = "block";
        } else box.style.display = "none";
      });

      renderProg();
      draw([], start);
      if (prog.length) simulate();
    }
  };
})();
