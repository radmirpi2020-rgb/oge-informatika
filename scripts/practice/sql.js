/* sql.js — практика «К» по базам данных: SQL-подобные запросы к учебной таблице.
   Поддержано: SELECT * | поля, FROM таблица, WHERE <условие>, ORDER BY поле [DESC],
   LIMIT n, а также COUNT(*), SUM(), AVG(), MIN(), MAX(). */
(function () {
  "use strict";
  var P = App.PRACTICE = App.PRACTICE || {};

  function rowsFrom(table) {
    return (table.rows || []).map(function (r) {
      var o = {};
      (table.columns || []).forEach(function (c, i) { o[c] = r[i]; });
      return o;
    });
  }

  function parseQuery(q, table) {
    var s = String(q || "").replace(/\s+/g, " ").trim().replace(/;\s*$/, "");
    if (!s) throw new Error("Пустой запрос");
    var m = /^select\s+(.+?)\s+from\s+([A-Za-zА-Яа-я_][\wА-Яа-я]*)\s*(.*)$/i.exec(s);
    if (!m) throw new Error("Запрос должен начинаться с SELECT ... FROM <таблица>");
    var fieldsRaw = m[1].trim();
    var tail = (m[3] || "").trim();
    var where = null, orderBy = [], limit = null;

    var mw = /\bwhere\s+(.+?)(?=\border\s+by\b|\blimit\b|$)/i.exec(tail);
    if (mw) where = mw[1].trim();
    var mo = /\border\s+by\s+(.+?)(?=\blimit\b|$)/i.exec(tail);
    if (mo) {
      orderBy = mo[1].split(",").map(function (part) {
        var p = part.trim().split(/\s+/);
        return { field: p[0], desc: /^desc$/i.test(p[1] || "") };
      });
    }
    var ml = /\blimit\s+(\d+)/i.exec(tail);
    if (ml) limit = parseInt(ml[1], 10);

    var fields = fieldsRaw === "*" ? (table.columns || []).slice() : fieldsRaw.split(",").map(function (f) { return f.trim(); });
    return { fields: fields, where: where, orderBy: orderBy, limit: limit, raw: s };
  }

  /** разбор и вычисление условия WHERE: поддерживает скобки, AND/OR/NOT, сравнения и IN */
  function makeWhere(where, columns) {
    var s = String(where);
    var i = 0;
    function ws() { while (i < s.length && /\s/.test(s[i])) i++; }
    function word(w) {
      ws();
      var rest = s.slice(i, i + w.length);
      if (rest.toUpperCase() === w.toUpperCase() && !/[A-Za-zА-Яа-я0-9_]/.test(s[i + w.length] || "")) {
        i += w.length;
        return true;
      }
      return false;
    }
    function parseOr() {
      var l = parseAnd();
      while (word("or")) { var r = parseAnd(); l = { op: "or", l: l, r: r }; }
      return l;
    }
    function parseAnd() {
      var l = parseNot();
      while (word("and")) { var r = parseNot(); l = { op: "and", l: l, r: r }; }
      return l;
    }
    function parseNot() {
      if (word("not")) return { op: "not", l: parseNot() };
      return parseCmp();
    }
    function parseCmp() {
      ws();
      if (s[i] === "(") {
        i++;
        var inner = parseOr();
        ws();
        if (s[i] !== ")") throw new Error("в условии не закрыта скобка");
        i++;
        return inner;
      }
      var left = parseValue();
      ws();
      // IN (a, b, c)
      if (word("in")) {
        ws();
        if (s[i] !== "(") throw new Error("после IN нужен список в скобках");
        i++;
        var items = [];
        for (;;) {
          items.push(parseValue());
          ws();
          if (s[i] === ",") { i++; continue; }
          break;
        }
        if (s[i] !== ")") throw new Error("в IN не закрыта скобка");
        i++;
        return { op: "in", left: left, items: items };
      }
      var ops = ["<=", ">=", "<>", "!=", "=", "<", ">"];
      for (var k = 0; k < ops.length; k++) {
        if (s.slice(i, i + ops[k].length) === ops[k]) {
          i += ops[k].length;
          var right = parseValue();
          return { op: "cmp", cmp: ops[k], left: left, right: right };
        }
      }
      throw new Error("в условии не хватает сравнения: «" + s.slice(i, i + 20) + "»");
    }
    function parseValue() {
      ws();
      if (s[i] === "'" || s[i] === '"') {
        var q = s[i++], buf = "";
        while (i < s.length && s[i] !== q) { buf += s[i]; i++; }
        i++;
        return { kind: "lit", value: buf };
      }
      var m = /^-?[0-9]+(\.[0-9]+)?/.exec(s.slice(i));
      if (m) { i += m[0].length; return { kind: "lit", value: Number(m[0]) }; }
      var name = /^[A-Za-zА-Яа-я_][A-Za-zА-Яа-я0-9_]*/.exec(s.slice(i));
      if (name) {
        i += name[0].length;
        if (columns.indexOf(name[0]) !== -1) return { kind: "col", name: name[0] };
        return { kind: "lit", value: name[0] };
      }
      throw new Error("не понимаю значение в условии: «" + s.slice(i, i + 15) + "»");
    }
    var ast = parseOr();
    ws();
    if (i < s.length) throw new Error("лишний текст в условии: «" + s.slice(i, i + 20) + "»");

    function val(node, row) { return node.kind === "col" ? row[node.name] : node.value; }
    function cmp(a, b, op) {
      var an = Number(a), bn = Number(b);
      var numeric = a !== "" && b !== "" && !isNaN(an) && !isNaN(bn);
      switch (op) {
        case "=": return numeric ? an === bn : String(a) === String(b);
        case "<>": case "!=": return numeric ? an !== bn : String(a) !== String(b);
        case "<": return numeric ? an < bn : String(a) < String(b);
        case ">": return numeric ? an > bn : String(a) > String(b);
        case "<=": return numeric ? an <= bn : String(a) <= String(b);
        case ">=": return numeric ? an >= bn : String(a) >= String(b);
      }
      return false;
    }
    function evalAst(node, row) {
      if (node.op === "and") return evalAst(node.l, row) && evalAst(node.r, row);
      if (node.op === "or") return evalAst(node.l, row) || evalAst(node.r, row);
      if (node.op === "not") return !evalAst(node.l, row);
      if (node.op === "in") {
        var v = val(node.left, row);
        return node.items.some(function (it) { return cmp(v, val(it, row), "="); });
      }
      return cmp(val(node.left, row), val(node.right, row), node.cmp);
    }
    return function (row) { return evalAst(ast, row); };
  }

  function fmtVal(v) {
    return v == null ? "" : String(v);
  }

  function runQuery(sql, table) {
    var q = parseQuery(sql, table);
    var rows = rowsFrom(table);

    if (q.where) {
      if (!q.where.trim()) throw new Error("После WHERE пусто");
      var test = makeWhere(q.where, table.columns || []);
      rows = rows.filter(test);
      var cols = Object.keys(rows[0] || rowsFrom(table)[0] || {});
      if (cols.length) test = makeWhere(q.where, cols);
    }

    // агрегаты
    var aggMatch = q.fields.length === 1 && /^(count|sum|avg|min|max)\s*\(/i.exec(q.fields[0]);
    var out;
    if (aggMatch) {
      var f = q.fields[0];
      var fn = aggMatch[1].toUpperCase();
      var arg = /\(([^)]*)\)/.exec(f)[1].trim();
      var vals = arg === "*" ? rows.map(function () { return 1; }) : rows.map(function (r) { return Number(r[arg]); });
      var num = vals.map(Number);
      var res;
      if (fn === "COUNT") res = vals.length;
      else if (fn === "SUM") res = num.reduce(function (a, b) { return a + b; }, 0);
      else if (fn === "AVG") res = num.length ? num.reduce(function (a, b) { return a + b; }, 0) / num.length : 0;
      else if (fn === "MIN") res = Math.min.apply(null, num);
      else res = Math.max.apply(null, num);
      if (typeof res === "number" && !Number.isInteger(res)) res = Math.round(res * 100) / 100;
      out = [[fn + "(" + arg + ")"], [res]];
      return { columns: [fn + "(" + arg + ")"], rows: [[res]], q: q };
    }

    if (q.orderBy && q.orderBy.length) {
      rows = rows.slice().sort(function (a, b) {
        for (var k = 0; k < q.orderBy.length; k++) {
          var spec = q.orderBy[k];
          var x = a[spec.field], y = b[spec.field];
          var cmpRes;
          if (typeof x === "number" && typeof y === "number") cmpRes = x - y;
          else {
            var xn = Number(x), yn = Number(y);
            cmpRes = (!isNaN(xn) && !isNaN(yn) && x !== "" && y !== "")
              ? xn - yn
              : String(x).localeCompare(String(y), "ru");
          }
          if (cmpRes !== 0) return spec.desc ? -cmpRes : cmpRes;
        }
        return 0;
      });
    }
    if (q.limit != null) rows = rows.slice(0, q.limit);

    out = rows.map(function (r) { return q.fields.map(function (f) { return r[f]; }); });
    return { columns: q.fields, rows: out, q: q };
  }

  /** нормализация результата для сверки: 2D-массив или массив объектов */
  function toMatrix(expected, columns) {
    if (!Array.isArray(expected)) return [];
    return expected.map(function (row) {
      if (Array.isArray(row)) return row.map(fmtVal);
      return columns.map(function (c) { return fmtVal(row[c]); });
    });
  }

  function same(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].length !== b[i].length) return false;
      for (var j = 0; j < a[i].length; j++) {
        if (String(a[i][j]).trim() !== String(b[i][j]).trim()) return false;
      }
    }
    return true;
  }

  P.sql = {
    runQuery: runQuery,
    mount: function (host, cfg, ctx) {
      var table = cfg.table || { name: "Таблица", columns: [], rows: [] };
      var lessonId = (ctx.lesson && ctx.lesson.id) || 0;
      var key = "sql_" + lessonId;
      var saved = App.state.practice[key] || {};

      host.innerHTML =
        '<div class="practical-task"><b>Задание</b>' + App.util.esc(cfg.task || "") + "</div>" +
        '<div class="tbl-wrap" style="margin-bottom:12px">' +
          "<table class=\"tbl\"><caption style=\"text-align:left;padding:6px 0;font-size:12px\">Таблица " + App.util.esc(table.name || "") + "</caption><thead><tr>" +
          (table.columns || []).map(function (c) { return "<th>" + App.util.esc(c) + "</th>"; }).join("") +
          "</tr></thead><tbody>" +
          (table.rows || []).map(function (r) {
            return "<tr>" + r.map(function (v) { return "<td>" + App.util.esc(fmtVal(v)) + "</td>"; }).join("") + "</tr>";
          }).join("") +
          "</tbody></table></div>" +
        '<div class="field"><label>Твой запрос</label>' +
          '<textarea id="sqlQ" spellcheck="false" style="min-height:90px"></textarea>' +
          '<div class="hint">Пример: SELECT * FROM ' + App.util.esc(table.name || "Таблица") + " WHERE " +
            App.util.esc((table.columns || [])[0] || "поле") + " > 10</div></div>" +
        '<div class="row"><button class="btn" id="sqlRun">▶ Выполнить</button>' +
          '<button class="btn ghost" id="sqlCheck">Проверить</button>' +
          '<button class="btn ghost" id="sqlSol">Показать решение</button></div>' +
        '<div id="sqlOut" style="margin-top:12px"></div>' +
        '<div id="sqlResult" class="alert" style="display:none"></div>' +
        '<div id="sqlSolBox" style="display:none"><div class="ex" id="sqlSolTxt"></div></div>';

      var ta = host.querySelector("#sqlQ");
      ta.value = saved.q != null ? saved.q : (cfg.starter || "");

      function show(res, note) {
        var out = host.querySelector("#sqlOut");
        var html = "";
        if (note) html += '<div class="tiny muted" style="margin-bottom:6px">' + App.util.esc(note) + "</div>";
        html += '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
          res.columns.map(function (c) { return "<th>" + App.util.esc(c) + "</th>"; }).join("") +
          "</tr></thead><tbody>" +
          (res.rows.length ? res.rows.map(function (r) {
            return "<tr>" + r.map(function (v) { return "<td>" + App.util.esc(fmtVal(v)) + "</td>"; }).join("") + "</tr>";
          }).join("") : '<tr><td colspan="' + Math.max(1, res.columns.length) + '">нет строк</td></tr>') +
          "</tbody></table></div>";
        out.innerHTML = html;
      }

      function doRun() {
        var sql = ta.value;
        App.state.practice[key] = { q: sql, at: Date.now() };
        App.state.savePractice();
        try {
          var res = runQuery(sql, table);
          show(res, "Строк: " + res.rows.length);
          return res;
        } catch (e) {
          host.querySelector("#sqlOut").innerHTML = '<div class="alert err">' + App.util.esc(e.message) + "</div>";
          return null;
        }
      }

      function doCheck() {
        var res = doRun();
        var box = host.querySelector("#sqlResult");
        box.style.display = "block";
        if (!res) { box.className = "alert err"; box.textContent = "Запрос не выполнился — сначала исправь ошибку."; return; }
        var want = toMatrix(cfg.expected, res.columns);
        var got = res.rows.map(function (r) { return r.map(fmtVal); });
        if (same(got, want)) {
          box.className = "alert ok";
          box.textContent = "✓ Верно! Запрос дал нужные записи (" + got.length + ").";
          ctx.onSolved && ctx.onSolved();
        } else {
          box.className = "alert err";
          box.innerHTML = "✗ Пока не совпадает. Нужно строк: " + want.length + ", у тебя: " + got.length +
            ".<br><span class=\"tiny\">Проверь условие WHERE (не путать И и ИЛИ) и выбранные поля.</span>";
        }
      }

      host.querySelector("#sqlRun").addEventListener("click", function () { doRun(); });
      host.querySelector("#sqlCheck").addEventListener("click", doCheck);
      host.querySelector("#sqlSol").addEventListener("click", function () {
        var b = host.querySelector("#sqlSolBox");
        if (b.style.display === "none") {
          host.querySelector("#sqlSolTxt").textContent = cfg.solution || "Решение не задано.";
          b.style.display = "block";
        } else b.style.display = "none";
      });
      ta.addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); doRun(); }
      });
      if (ta.value.trim()) doRun();
    }
  };
})();
