/* table.js — практика по электронным таблицам: редактируемая сетка с формулами.
   Поддержаны ссылки (A1), диапазоны (A1:A5) и функции СУММ, СРЗНАЧ, МИН, МАКС, СЧЁТ, ЕСЛИ, ABS, КОРЕНЬ.
   Формулы считаются в самом движке (не через Python) — так ошибок меньше. */
(function () {
  "use strict";
  var P = App.PRACTICE = App.PRACTICE || {};

  function colName(i) { return String.fromCharCode(65 + i); }

  /* ---------- вычислитель формул ---------- */
  function evalFormula(expr, table, addr, seen) {
    var i = 0;
    var s = expr;
    function ws() { while (i < s.length && /\s/.test(s[i])) i++; }
    function peek() { ws(); return s[i]; }
    function eat(ch) { ws(); if (s[i] === ch) { i++; return true; } return false; }

    function parseOr() {
      var v = parseAnd();
      for (;;) {
        ws();
        if (/^or\b/i.test(s.slice(i))) { i += 2; var r = parseAnd(); v = (truthy(v) || truthy(r)); }
        else return v;
      }
    }
    function parseAnd() {
      var v = parseCmp();
      for (;;) {
        ws();
        if (/^and\b/i.test(s.slice(i))) { i += 3; var r = parseCmp(); v = (truthy(v) && truthy(r)); }
        else return v;
      }
    }
    function parseCmp() {
      var a = parseAdd();
      ws();
      var ops = ["<=", ">=", "<>", "!=", "=", "<", ">"];
      for (var k = 0; k < ops.length; k++) {
        if (s.startsWith(ops[k], i)) {
          i += ops[k].length;
          var b = parseAdd();
          var an = Number(a), bn = Number(b);
          var numeric = !isNaN(an) && !isNaN(bn) && a !== "" && b !== "";
          switch (ops[k]) {
            case "<": return numeric ? an < bn : String(a) < String(b);
            case ">": return numeric ? an > bn : String(a) > String(b);
            case "<=": return numeric ? an <= bn : String(a) <= String(b);
            case ">=": return numeric ? an >= bn : String(a) >= String(b);
            case "=": return numeric ? an === bn : String(a) === String(b);
            case "<>": case "!=": return numeric ? an !== bn : String(a) !== String(b);
          }
        }
      }
      return a;
    }
    function parseAdd() {
      var v = parseMul();
      for (;;) {
        ws();
        if (s[i] === "+") { i++; v = num(v) + num(parseMul()); }
        else if (s[i] === "-") { i++; v = num(v) - num(parseMul()); }
        else return v;
      }
    }
    function parseMul() {
      var v = parseUnary();
      for (;;) {
        ws();
        if (s[i] === "*") { i++; v = num(v) * num(parseUnary()); }
        else if (s[i] === "/") {
          i++; var d = num(parseUnary());
          if (d === 0) throw new Error("деление на ноль");
          v = num(v) / d;
        }
        else if (s[i] === "^") { i++; v = Math.pow(num(v), num(parseUnary())); }
        else return v;
      }
    }
    function parseUnary() {
      ws();
      if (s[i] === "-") { i++; return -num(parseUnary()); }
      if (s[i] === "+") { i++; return parseUnary(); }
      return parseAtom();
    }
    function parseAtom() {
      ws();
      if (eat("(")) { var v = parseOr(); if (!eat(")")) throw new Error("не закрыта скобка"); return v; }
      if (s[i] === '"' || s[i] === "'") {
        var q = s[i++], buf = "";
        while (i < s.length && s[i] !== q) buf += s[i++];
        i++;
        return buf;
      }
      var m = /^[0-9]+([.,][0-9]+)?/.exec(s.slice(i));
      if (m) { i += m[0].length; return Number(m[0].replace(",", ".")); }
      var fn = /^([A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_]*)\s*\(/.exec(s.slice(i));
      if (fn) {
        i += fn[0].length;
        var args = [];
        if (!/[)\s]/.test(s[i] || ")")) {
          for (;;) {
            args.push(parseOr());
            ws();
            if (eat(";")) continue;
            if (eat(",")) continue;
            break;
          }
        }
        ws();
        if (!eat(")")) throw new Error("не закрыта скобка в функции " + fn[1]);
        return callFn(fn[1], args, table, addr, seen);
      }
      var range = /^([A-Za-z])(\d+)\s*:\s*([A-Za-z])(\d+)/.exec(s.slice(i));
      if (range) {
        i += range[0].length;
        var list = [];
        var c1 = range[1].toUpperCase().charCodeAt(0) - 65, c2 = range[3].toUpperCase().charCodeAt(0) - 65;
        var r1 = Number(range[2]), r2 = Number(range[4]);
        for (var c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
          for (var r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
            list.push(table.cellValue(colName(c) + r, seen));
          }
        }
        return list;
      }
      var ref = /^([A-Za-z])(\d+)(?![0-9A-Za-z])/.exec(s.slice(i));
      if (ref) {
        i += ref[0].length;
        return table.cellValue(ref[1].toUpperCase() + ref[2], seen);
      }
      throw new Error("не понимаю «" + s.slice(i, i + 12) + "»");
    }
    function num(v) {
      if (Array.isArray(v)) throw new Error("диапазон нельзя использовать как число — оберни в СУММ");
      var n = Number(String(v).replace(",", "."));
      if (isNaN(n)) throw new Error("«" + v + "» — не число");
      return n;
    }
    function truthy(v) {
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v !== 0;
      if (typeof v === "string") return v !== "" && v !== "0" && v.toLowerCase() !== "ложь";
      if (Array.isArray(v)) return v.length > 0;
      return !!v;
    }
    function flat(a) {
      var out = [];
      a.forEach(function (x) { if (Array.isArray(x)) out = out.concat(flat(x)); else out.push(x); });
      return out;
    }
    function nums(a) {
      return flat(a).map(function (x) { var n = Number(String(x).replace(",", ".")); return isNaN(n) ? null : n; })
        .filter(function (x) { return x !== null; });
    }
    function callFn(name, args, table, addr, seen) {
      var N = name.toUpperCase();
      switch (N) {
        case "СУММ": case "SUM": return nums(args).reduce(function (a, b) { return a + b; }, 0);
        case "СРЗНАЧ": case "AVERAGE": {
          var f = nums(args);
          return f.length ? f.reduce(function (a, b) { return a + b; }, 0) / f.length : 0;
        }
        case "МИН": case "MIN": return Math.min.apply(null, nums(args));
        case "МАКС": case "MAX": return Math.max.apply(null, nums(args));
        case "СЧЁТ": case "COUNT": return flat(args).filter(function (x) { return x !== "" && x != null; }).length;
        case "СЧЁТЗ": case "COUNTA": return flat(args).filter(function (x) { return x !== "" && x != null; }).length;
        case "ЕСЛИ": case "IF": return truthy(args[0]) ? args[1] : (args.length > 2 ? args[2] : "");
        case "ABS": return Math.abs(num(args[0]));
        case "КОРЕНЬ": case "SQRT": return Math.sqrt(num(args[0]));
        case "ЦЕЛОЕ": case "INT": return Math.floor(num(args[0]));
        case "ОКРУГЛ": case "ROUND": {
          var d = args.length > 1 ? num(args[1]) : 0;
          var p = Math.pow(10, d);
          return Math.round(num(args[0]) * p) / p;
        }
        case "ДЛСТР": case "LEN": return String(args[0]).length;
        default: throw new Error("функции «" + name + "» здесь нет");
      }
    }
    var result = parseOr();
    ws();
    if (i < s.length) throw new Error("лишний текст: «" + s.slice(i) + "»");
    return result;
  }

  /* ---------- модель таблицы ---------- */
  function Table(cfg) {
    this.cols = Math.max(1, Math.min(12, cfg.cols || 4));
    this.rows = Math.max(1, Math.min(40, cfg.rows || 6));
    this.cells = {};
    var self = this;
    Object.keys(cfg.cells || {}).forEach(function (k) { self.cells[k.toUpperCase()] = cfg.cells[k]; });
  }
  Table.prototype.get = function (addr) {
    var v = this.cells[addr.toUpperCase()];
    return v === undefined ? "" : v;
  };
  Table.prototype.set = function (addr, v) { this.cells[addr.toUpperCase()] = v; };
  Table.prototype.isFormula = function (addr) {
    var v = this.get(addr);
    return typeof v === "string" && v.trim().charAt(0) === "=";
  };
  /** значение ячейки: число, строка или результат формулы; ошибки возвращает как «#ОШИБКА» */
  Table.prototype.cellValue = function (addr, seen) {
    addr = addr.toUpperCase();
    seen = seen || {};
    var raw = this.get(addr);
    if (!this.isFormula(addr)) {
      if (raw === "") return "";
      var n = Number(String(raw).replace(",", "."));
      return isNaN(n) ? String(raw) : n;
    }
    if (seen[addr]) return "#ЦИКЛ";
    var deeper = {};
    Object.keys(seen).forEach(function (k) { deeper[k] = 1; });
    deeper[addr] = 1;
    try {
      return evalFormula(String(raw).trim().slice(1), this, addr, deeper);
    } catch (e) {
      return "#ОШИБКА: " + e.message;
    }
  };

  P.table = {
    Table: Table,
    evalFormula: evalFormula,
    mount: function (host, cfg, ctx) {
      var t = new Table(cfg);
      var lessonId = (ctx.lesson && ctx.lesson.id) || 0;
      var key = "table_" + lessonId;
      var saved = App.state.practice[key] || {};
      if (saved.cells) Object.keys(saved.cells).forEach(function (k) { t.set(k, saved.cells[k]); });

      function persist() {
        App.state.practice[key] = { cells: t.cells, answer: saved.answer, at: Date.now() };
        App.state.savePractice();
      }

      function isError(v) { return typeof v === "string" && v.charAt(0) === "#"; }

      function tableHtml() {
        var html = '<div class="tbl-wrap"><table class="tbl" id="tbGrid"><thead><tr><th></th>';
        for (var c = 0; c < t.cols; c++) html += "<th>" + colName(c) + "</th>";
        html += "</tr></thead><tbody>";
        for (var r = 1; r <= t.rows; r++) {
          html += "<tr><th>" + r + "</th>";
          for (var c2 = 0; c2 < t.cols; c2++) {
            var addr = colName(c2) + r;
            var raw = t.get(addr);
            var shown = t.cellValue(addr);
            html += '<td contenteditable="true" data-addr="' + addr + '"' +
              (t.isFormula(addr) ? ' style="background:rgba(255,77,0,.08)"' : "") +
              (isError(shown) ? ' title="' + App.util.esc(shown) + '"' : "") +
              ">" + App.util.esc(isError(shown) ? "#ОШИБКА" : shown) + "</td>";
          }
          html += "</tr>";
        }
        html += "</tbody></table></div>";
        return html;
      }

      function bindCells() {
        host.querySelectorAll("#tbGrid td[contenteditable]").forEach(function (td) {
          td.addEventListener("focus", function () {
            var raw = t.get(td.getAttribute("data-addr"));
            if (raw !== "") td.textContent = raw;
          });
          td.addEventListener("blur", function () {
            var addr = td.getAttribute("data-addr");
            t.set(addr, td.textContent.trim());
            persist();
            redraw();
          });
          td.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); td.blur(); }
            if (e.key === "Escape") { redraw(); }
          });
        });
      }

      function redraw() {
        host.querySelector("#tbGridWrap").innerHTML = tableHtml();
        bindCells();
      }

      var steps = cfg.steps || [];
      host.innerHTML =
        '<div class="practical-task"><b>Задание</b>' + App.util.esc(cfg.task || "") + "</div>" +
        '<div class="tiny muted" style="margin-bottom:6px">Кликни по ячейке и введи значение или формулу, начиная со знака «=». Формулы подсвечены оранжевым.</div>' +
        '<div id="tbGridWrap"></div>' +
        '<div class="field" style="margin-top:12px"><label>Твой ответ (число или текст)</label>' +
          '<input type="text" id="tbAns" value="' + App.util.esc(saved.answer || "") + '"></div>' +
        '<div class="row"><button class="btn" id="tbCheck">Проверить</button>' +
          '<button class="btn ghost" id="tbSteps">Показать шаги</button></div>' +
        '<div class="alert" id="tbRes" style="display:none"></div>' +
        '<div class="ex" id="tbStepsBox" style="display:none"></div>';

      redraw();

      host.querySelector("#tbSteps").addEventListener("click", function () {
        var box = host.querySelector("#tbStepsBox");
        if (box.style.display === "none") {
          box.textContent = steps.length ? steps.map(function (s, i) { return (i + 1) + ") " + s; }).join("\n") : "Шагов нет.";
          box.style.display = "block";
        } else box.style.display = "none";
      });

      host.querySelector("#tbCheck").addEventListener("click", function () {
        var val = host.querySelector("#tbAns").value;
        saved.answer = val;
        persist();
        var box = host.querySelector("#tbRes");
        box.style.display = "block";
        if (App.util.checkAnswer(val, cfg.answer)) {
          box.className = "alert ok";
          box.textContent = "✓ Верно!";
          ctx.onSolved && ctx.onSolved();
        } else {
          box.className = "alert err";
          box.textContent = "✗ Не совпало. Проверь формулу и порядок действий — кнопка «Показать шаги» подскажет, где ошибка.";
        }
      });
    }
  };
})();
