/* python-lite.js — мини-интерпретатор подмножества Python 3 на JavaScript.
   Нужен для практик типа «К»: ученик пишет код, жмёт «Запустить», видит вывод.
   Поддерживается: print, переменные, числа/строки/списки/словари, арифметика,
   сравнения, and/or/not, if/elif/else, while, for ... in range(...)|список|строка,
   def с параметрами и return, срезы, len/range/str/int/float/abs/min/max/sum/sorted/
   round/enumerate/zip/reversed/list/dict/tuple/set, методы строк и списков.
   Не поддерживается: import, классы, файлы, input(), генераторы.

   API: App.python.run(code) -> {ok, out, error, errorLine}
        App.python.isSupported(code) -> {ok, why}
   Ограничения: 200 000 шагов выполнения (защита от вечных циклов), рекурсия до 60. */

(function () {
  "use strict";

  var MAX_STEPS = 200000;
  var MAX_DEPTH = 60;

  /* ======================= лексер выражений ======================= */
  function lex(src) {
    var i = 0, out = [];
    var two = ["**", "//", "==", "!=", "<=", ">="];
    while (i < src.length) {
      var c = src[i];
      if (c === " " || c === "\t" || c === "\r" || c === "\n") { i++; continue; }
      if (c === "#") break;
      if (c === '"' || c === "'") {
        var q = c, buf = "", j = i + 1, closed = false;
        while (j < src.length) {
          if (src[j] === "\\") {
            var n = src[j + 1];
            buf += n === "n" ? "\n" : n === "t" ? "\t" : n === "\\" ? "\\" : n === q ? q : "\\" + n;
            j += 2; continue;
          }
          if (src[j] === q) { closed = true; j++; break; }
          buf += src[j]; j++;
        }
        if (!closed) throw new PErr("Не закрыта кавычка в строке", null);
        out.push({ t: "str", v: buf }); i = j; continue;
      }
      if (/[0-9]/.test(c)) {
        var num = "", k = i, isF = false;
        while (k < src.length && /[0-9_]/.test(src[k])) { if (src[k] !== "_") num += src[k]; k++; }
        if (src[k] === "." && /[0-9]/.test(src[k + 1] || "")) {
          num += "."; k++; isF = true;
          while (k < src.length && /[0-9_]/.test(src[k])) { if (src[k] !== "_") num += src[k]; k++; }
        }
        out.push({ t: "num", v: parseFloat(num), float: isF }); i = k; continue;
      }
      if (/[A-Za-zА-Яа-я_]/.test(c)) {
        var id = "", m = i;
        while (m < src.length && /[A-Za-zА-Яа-я0-9_]/.test(src[m])) { id += src[m]; m++; }
        out.push({ t: "name", v: id }); i = m; continue;
      }
      var matched = false;
      for (var t = 0; t < two.length; t++) {
        if (src.substr(i, 2) === two[t]) { out.push({ t: "op", v: two[t] }); i += 2; matched = true; break; }
      }
      if (matched) continue;
      if ("+-*/%<>=()[]{},:.".indexOf(c) !== -1) { out.push({ t: "op", v: c }); i++; continue; }
      throw new PErr("Непонятный символ: " + c, null);
    }
    out.push({ t: "eof" });
    return out;
  }

  function PErr(msg, line) {
    this.name = "PythonError";
    this.message = msg;
    this.line = line == null ? null : line;
  }
  PErr.prototype = Object.create(Error.prototype);

  function ParseErr(msg, line) { var e = new PErr(msg, line); e.name = "Ошибка синтаксиса"; return e; }

  /* ======================= парсер выражений ======================= */
  function makeParser(tokens) {
    var p = 0;
    function peek() { return tokens[p]; }
    function next() { return tokens[p++]; }
    function isOp(v) { var t = peek(); return t.t === "op" && t.v === v; }
    function isName(v) { var t = peek(); return t.t === "name" && t.v === v; }
    function eat(v) { if (isOp(v)) { p++; return true; } return false; }
    function expect(v) { if (!eat(v)) throw ParseErr("Ожидалось «" + v + "»", null); }

    function parseExpr() { return parseOr(); }
    function parseOr() {
      var l = parseAnd();
      while (isName("or")) { next(); l = { k: "bin", op: "or", a: l, b: parseAnd() }; }
      return l;
    }
    function parseAnd() {
      var l = parseNot();
      while (isName("and")) { next(); l = { k: "bin", op: "and", a: l, b: parseNot() }; }
      return l;
    }
    function parseNot() {
      if (isName("not")) { next(); return { k: "un", op: "not", a: parseNot() }; }
      return parseCmp();
    }
    function parseCmp() {
      var l = parseAdd();
      if (isOp("<") || isOp(">") || isOp("<=") || isOp(">=") || isOp("==") || isOp("!=")) {
        var op = next().v;
        return { k: "bin", op: op, a: l, b: parseAdd() };
      }
      if (isName("in")) {
        next();
        return { k: "bin", op: "in", a: l, b: parseAdd() };
      }
      if (isName("not") && tokens[p + 1] && tokens[p + 1].t === "name" && tokens[p + 1].v === "in") {
        next(); next();
        return { k: "un", op: "not", a: { k: "bin", op: "in", a: l, b: parseAdd() } };
      }
      return l;
    }
    function parseAdd() {
      var l = parseMul();
      while (isOp("+") || isOp("-")) { var op = next().v; l = { k: "bin", op: op, a: l, b: parseMul() }; }
      return l;
    }
    function parseMul() {
      var l = parseUnary();
      while (isOp("*") || isOp("/") || isOp("//") || isOp("%")) {
        var op = next().v; l = { k: "bin", op: op, a: l, b: parseUnary() };
      }
      return l;
    }
    function parseUnary() {
      if (isOp("-")) { next(); return { k: "un", op: "-", a: parseUnary() }; }
      if (isOp("+")) { next(); return parseUnary(); }
      return parsePower();
    }
    function parsePower() {
      var base = parsePostfix();
      if (isOp("**")) { next(); return { k: "bin", op: "**", a: base, b: parseUnary() }; }
      return base;
    }
    function parsePostfix() {
      var e = parseAtom();
      for (;;) {
        if (isOp(".")) {
          next();
          var t = next();
          if (t.t !== "name") throw ParseErr("После точки ожидалось имя метода", null);
          if (isOp("(")) {
            var kw = parseArgs();
            e = { k: "call", callee: { k: "attr", obj: e, name: t.v }, args: kw.args, kwargs: kw.kwargs };
          } else {
            e = { k: "attr", obj: e, name: t.v };
          }
          continue;
        }
        if (isOp("[")) {
          next();
          var start = null, stop = null, stepv = null;
          if (!isOp(":")) start = parseExpr();
          if (eat(":")) {
            if (!isOp("]") && !isOp(":")) stop = parseExpr();
            if (eat(":")) {
              if (!isOp("]")) stepv = parseExpr();
            }
            expect("]");
            e = { k: "slice", obj: e, start: start, stop: stop, step: stepv };
          } else {
            expect("]");
            e = { k: "index", obj: e, index: start };
          }
          continue;
        }
        if (isOp("(")) {
          var a2 = parseArgs();
          e = { k: "call", callee: e, args: a2.args, kwargs: a2.kwargs };
          continue;
        }
        break;
      }
      return e;
    }
    function parseArgs() {
      expect("(");
      var args = [], kwargs = {};
      if (!isOp(")")) {
        for (;;) {
          // именованный аргумент: name=значение (reverse=True, key=...)
          if (peek().t === "name" && tokens[p + 1] && tokens[p + 1].t === "op" && tokens[p + 1].v === "=") {
            var kw = next().v;
            next();
            kwargs[kw] = parseExpr();
          } else {
            args.push(parseExpr());
          }
          if (eat(",")) { if (isOp(")")) break; continue; }
          break;
        }
      }
      expect(")");
      return { args: args, kwargs: kwargs };
    }
    function parseAtom() {
      var t = next();
      if (t.t === "num") return t.float ? { k: "float", v: t.v } : { k: "num", v: t.v };
      if (t.t === "str") return { k: "str", v: t.v };
      if (t.t === "name") {
        if (t.v === "True") return { k: "num", v: true };
        if (t.v === "False") return { k: "num", v: false };
        if (t.v === "None") return { k: "num", v: null };
        return { k: "var", name: t.v };
      }
      if (t.t === "op" && t.v === "(") {
        var e = parseExpr();
        expect(")");
        return e;
      }
      if (t.t === "op" && t.v === "[") {
        var items = [];
        if (!isOp("]")) {
          for (;;) {
            items.push(parseExpr());
            if (eat(",")) { if (isOp("]")) break; continue; }
            break;
          }
        }
        expect("]");
        return { k: "list", items: items };
      }
      if (t.t === "op" && t.v === "{") {
        if (isOp("}")) { next(); return { k: "dict", items: [] }; }
        // либо словарь, либо множество — поддерживаем словарь
        var pairs = [];
        for (;;) {
          var key = parseExpr();
          expect(":");
          var val = parseExpr();
          pairs.push([key, val]);
          if (eat(",")) { if (isOp("}")) break; continue; }
          break;
        }
        expect("}");
        return { k: "dict", items: pairs };
      }
      throw ParseErr("Не удалось разобрать выражение", null);
    }
    return { parseExpr: parseExpr, eof: function () { return peek().t === "eof"; } };
  }

  function parseExpression(src, line) {
    try {
      var pr = makeParser(lex(src));
      var e = pr.parseExpr();
      if (!pr.eof()) throw ParseErr("Лишний текст в выражении: " + src, line);
      return e;
    } catch (err) {
      if (err && err.name) { err.line = line; throw err; }
      throw ParseErr(String(err && err.message || err), line);
    }
  }

  /* ======================= окружение ======================= */
  function Scope(parent) {
    this.vars = {};
    this.parent = parent || null;
  }
  Scope.prototype.get = function (name) {
    var s = this;
    while (s) { if (Object.prototype.hasOwnProperty.call(s.vars, name)) return s.vars[name]; s = s.parent; }
    throw new PErr("Имя «" + name + "» не определено", null);
  };
  Scope.prototype.has = function (name) {
    var s = this;
    while (s) { if (Object.prototype.hasOwnProperty.call(s.vars, name)) return true; s = s.parent; }
    return false;
  };
  Scope.prototype.set = function (name, val) {
    var s = this;
    while (s) {
      if (Object.prototype.hasOwnProperty.call(s.vars, name)) { s.vars[name] = val; return val; }
      s = s.parent;
    }
    this.vars[name] = val;
    return val;
  };
  Scope.prototype.define = function (name, val) { this.vars[name] = val; return val; };

  var RETURN = { ret: true };

  /* ======================= приведение типов ======================= */
  function isNum(v) { return typeof v === "number"; }
  function isStr(v) { return typeof v === "string"; }
  function isArr(v) { return Array.isArray(v); }
  function isDict(v) { return v && typeof v === "object" && !Array.isArray(v) && !(v instanceof PyFunc) && !(v instanceof PyFloat); }
  function PyFunc(params, body, scope) { this.params = params; this.body = body; this.scope = scope; }
  /* Float нужен, чтобы «16.0» печаталось с точкой, как в настоящем Python */
  function PyFloat(v) { this.v = v; }
  PyFloat.prototype.valueOf = function () { return this.v; };
  PyFloat.prototype.toString = function () { return pyStr(this); };
  function isFloat(v) { return v instanceof PyFloat; }

  function pyStr(v) {
    if (v === null || v === undefined) return "None";
    if (v === true) return "True";
    if (v === false) return "False";
    if (isFloat(v)) {
      var f = v.v;
      if (Number.isInteger(f)) return f.toFixed(1);
      return String(f);
    }
    if (isNum(v)) {
      if (Number.isInteger(v)) return String(v);
      return String(v);
    }
    if (isStr(v)) return v;
    if (isArr(v)) return "[" + v.map(function (x) { return pyRepr(x); }).join(", ") + "]";
    if (isDict(v)) {
      return "{" + Object.keys(v).map(function (k) { return pyRepr(k) + ": " + pyRepr(v[k]); }).join(", ") + "}";
    }
    if (v instanceof PyFunc) return "<function " + (v.name || "func") + ">";
    return String(v);
  }
  function pyRepr(v) {
    if (isStr(v)) return "'" + v.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n") + "'";
    if (isFloat(v)) return pyStr(v);
    return pyStr(v);
  }

  /* ======================= вычисление выражений ======================= */
  function evalNode(node, scope, rt) {
    rt.step();
    switch (node.k) {
      case "num": return node.v;
      case "float": return new PyFloat(node.v);
      case "str": return node.v;
      case "var": {
        if (scope.has(node.name)) return scope.get(node.name);
        if (BUILTINS[node.name] !== undefined) return BUILTINS[node.name];
        throw new PErr("Имя «" + node.name + "» не определено", rt.line);
      }
      case "list": return node.items.map(function (x) { return evalNode(x, scope, rt); });
      case "tuple": return node.items.map(function (x) { return evalNode(x, scope, rt); });
      case "dict": {
        var d = {};
        node.items.forEach(function (pair) {
          d[pyStr(evalNode(pair[0], scope, rt))] = evalNode(pair[1], scope, rt);
        });
        return d;
      }
      case "un": {
        var a = evalNode(node.a, scope, rt);
        if (node.op === "not") return !truthy(a);
        if (node.op === "-") return -toNum(a, rt);
        throw new PErr("Неизвестная унарная операция", rt.line);
      }
      case "bin": return evalBin(node, scope, rt);
      case "slice": {
        var so = evalNode(node.obj, scope, rt);
        var st = node.start ? evalNode(node.start, scope, rt) : null;
        var sp = node.stop ? evalNode(node.stop, scope, rt) : null;
        var sd = node.step ? evalNode(node.step, scope, rt) : null;
        return sliceOf(so, st, sp, sd, rt);
      }
      case "index": {
        var obj = evalNode(node.obj, scope, rt);
        var idx = evalNode(node.index, scope, rt);
        if (isArr(obj) || isStr(obj)) {
          var n = toInt(idx, rt);
          var lenv = isStr(obj) ? obj.length : obj.length;
          var real = n < 0 ? lenv + n : n;
          if (real < 0 || real >= lenv) throw new PErr("Индекс " + n + " вне диапазона (длина " + lenv + ")", rt.line);
          return isStr(obj) ? obj[real] : obj[real];
        }
        if (isDict(obj)) return obj[pyStr(idx)];
        throw new PErr("Нельзя взять элемент у этого значения", rt.line);
      }
      case "attr": {
        if (node.obj.k === "var" && node.obj.name === "math") return { __math: node.name };
        var o = evalNode(node.obj, scope, rt);
        return { __bound: o, __name: node.name };
      }
      case "call": return callNode(node, scope, rt);
      default: throw new PErr("Неизвестное выражение", rt.line);
    }
  }

  function evalBin(node, scope, rt) {
    var op = node.op;
    if (op === "and") return truthy(evalNode(node.a, scope, rt)) ? evalNode(node.b, scope, rt) : evalNode(node.a, scope, rt);
    if (op === "or") { var av = evalNode(node.a, scope, rt); return truthy(av) ? av : evalNode(node.b, scope, rt); }
    var a = evalNode(node.a, scope, rt);
    var b = evalNode(node.b, scope, rt);
    switch (op) {
      case "+":
        if (isStr(a) || isStr(b)) {
          if (!(isStr(a) || isNum(a)) || !(isStr(b) || isNum(b))) throw new PErr("Нельзя сложить строку и " + typeName(b), rt.line);
          return pyStr(a) + pyStr(b);
        }
        if (isArr(a) && isArr(b)) return a.concat(b);
        return toNum(a, rt) + toNum(b, rt);
      case "-": return toNum(a, rt) - toNum(b, rt);
      case "*":
        if (isStr(a) && isNum(b)) return b > 0 ? a.repeat(Math.floor(b)) : "";
        if (isNum(a) && isStr(b)) return a > 0 ? b.repeat(Math.floor(a)) : "";
        if (isArr(a) && isNum(b)) {
          var out = [];
          for (var i = 0; i < Math.floor(b); i++) out = out.concat(a);
          return out;
        }
        return toNum(a, rt) * toNum(b, rt);
      case "/":
        if (toNum(b, rt) === 0) throw new PErr("Деление на ноль", rt.line);
        return new PyFloat(toNum(a, rt) / toNum(b, rt));
      case "//":
        if (toNum(b, rt) === 0) throw new PErr("Деление на ноль", rt.line);
        return Math.floor(toNum(a, rt) / toNum(b, rt));
      case "%":
        if (toNum(b, rt) === 0) throw new PErr("Деление на ноль (остаток)", rt.line);
        return ((toNum(a, rt) % toNum(b, rt)) + toNum(b, rt)) % toNum(b, rt);
      case "**": return Math.pow(toNum(a, rt), toNum(b, rt));
      case "==": return pyEq(a, b);
      case "!=": return !pyEq(a, b);
      case "<": return cmpVals(a, b, rt) < 0;
      case ">": return cmpVals(a, b, rt) > 0;
      case "<=": return cmpVals(a, b, rt) <= 0;
      case ">=": return cmpVals(a, b, rt) >= 0;
      case "in":
        if (isStr(b)) return b.indexOf(pyStr(a)) !== -1;
        if (isArr(b)) return b.some(function (x) { return pyEq(x, a); });
        if (isDict(b)) return Object.prototype.hasOwnProperty.call(b, pyStr(a));
        throw new PErr("Оператор in работает со строкой, списком или словарём", rt.line);
    }
    throw new PErr("Неизвестная операция " + op, rt.line);
  }

  function pyEq(a, b) {
    if ((isNum(a) || isFloat(a)) && (isNum(b) || isFloat(b))) return toNum(a, null) === toNum(b, null);
    if (isStr(a) && isStr(b)) return a === b;
    if (isArr(a) && isArr(b)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!pyEq(a[i], b[i])) return false;
      return true;
    }
    if (isDict(a) && isDict(b)) {
      var ka = Object.keys(a), kb = Object.keys(b);
      if (ka.length !== kb.length) return false;
      for (var j = 0; j < ka.length; j++) if (!pyEq(a[ka[j]], b[ka[j]])) return false;
      return true;
    }
    return a === b;
  }

  /** срез строки или списка: a[1:3], a[:2], a[::-1] */
  function sliceOf(obj, start, stop, step, rt) {
    if (!isStr(obj) && !isArr(obj)) throw new PErr("Срез работает только со строкой или списком", rt.line);
    var len = obj.length;
    var st = step == null ? 1 : toInt(step, rt);
    if (st === 0) throw new PErr("Шаг среза не может быть нулём", rt.line);
    var a, b;
    if (st > 0) {
      a = start == null ? 0 : toInt(start, rt);
      b = stop == null ? len : toInt(stop, rt);
      if (a < 0) a += len;
      if (b < 0) b += len;
      a = Math.max(0, Math.min(a, len));
      b = Math.max(0, Math.min(b, len));
    } else {
      a = start == null ? len - 1 : toInt(start, rt);
      b = stop == null ? -1 : toInt(stop, rt);
      if (start != null && a < 0) a += len;
      if (stop != null && b < 0) b += len;
      a = Math.max(-1, Math.min(a, len - 1));
    }
    var out = [], i;
    if (st > 0) { for (i = a; i < b; i += st) out.push(obj[i]); }
    else { for (i = a; i > b; i += st) { if (i >= 0 && i < len) out.push(obj[i]); } }
    return isStr(obj) ? out.join("") : out;
  }

  function cmpVals(a, b, rt) {
    if ((isNum(a) || isFloat(a)) && (isNum(b) || isFloat(b))) {
      var an = toNum(a, rt), bn = toNum(b, rt);
      return an < bn ? -1 : an > bn ? 1 : 0;
    }
    if (isStr(a) && isStr(b)) return a < b ? -1 : a > b ? 1 : 0;
    if (isArr(a) && isArr(b)) {
      for (var i = 0; i < Math.min(a.length, b.length); i++) {
        var c = cmpVals(a[i], b[i], rt);
        if (c !== 0) return c;
      }
      return a.length - b.length;
    }
    throw new PErr("Нельзя сравнить " + typeName(a) + " и " + typeName(b), rt.line);
  }

  function truthy(v) {
    if (v === null || v === undefined || v === false) return false;
    if (isFloat(v)) return v.v !== 0;
    if (v === 0 || v === "") return false;
    if (isArr(v)) return v.length > 0;
    if (isDict(v)) return Object.keys(v).length > 0;
    return true;
  }
  function toNum(v, rt) {
    if (isNum(v)) return v;
    if (isFloat(v)) return v.v;
    if (v === true) return 1;
    if (v === false) return 0;
    throw new PErr("Ожидалось число, а не " + typeName(v), rt.line);
  }
  function toInt(v, rt) {
    var n = toNum(v, rt);
    if (!Number.isInteger(n)) throw new PErr("Ожидался целый индекс, а не " + n, rt.line);
    return n;
  }
  function typeName(v) {
    if (v === null) return "None";
    if (isFloat(v)) return "число с точкой";
    if (isNum(v)) return Number.isInteger(v) ? "целое число" : "число с точкой";
    if (isStr(v)) return "строка";
    if (isArr(v)) return "список";
    if (isDict(v)) return "словарь";
    if (v instanceof PyFunc) return "функция";
    return typeof v;
  }

  /* ======================= вызовы и методы ======================= */
  function callNode(node, scope, rt) {
    var kw = node.kwargs || {};
    // методы у значений
    if (node.callee.k === "attr") {
      var obj = evalNode(node.callee.obj, scope, rt);
      var name = node.callee.name;
      var args = node.args.map(function (a) { return evalNode(a, scope, rt); });
      if (obj && obj.__math) return mathFn(obj.__math, args, rt);
      return methodCall(obj, name, args, rt);
    }
    var fn = evalNode(node.callee, scope, rt);
    var fargs = node.args.map(function (a) { return evalNode(a, scope, rt); });
    var fkwargs = {};
    Object.keys(kw).forEach(function (k) { fkwargs[k] = evalNode(kw[k], scope, rt); });
    if (fn instanceof PyFunc) return callPyFunc(fn, fargs, rt);
    if (fn && fn.__builtin) return fn.__builtin(fargs, rt, fkwargs);
    if (typeof fn === "function") return fn.apply(null, fargs);
    throw new PErr("Это не функция", rt.line);
  }

  function callPyFunc(fn, args, rt) {
    if (rt.depth >= MAX_DEPTH) throw new PErr("Слишком глубокая рекурсия (больше " + MAX_DEPTH + ")", rt.line);
    if (args.length !== fn.params.length) {
      throw new PErr("Функция ждёт " + fn.params.length + " аргумент(ов), а получила " + args.length, rt.line);
    }
    var local = new Scope(fn.scope);
    fn.params.forEach(function (p, i) { local.define(p, args[i]); });
    rt.depth++;
    var prevLine = rt.line;
    var res = execBlock(fn.body, local, rt);
    rt.depth--;
    rt.line = prevLine;
    return res === RETURN ? rt.retVal : null;
  }

  function methodCall(obj, name, args, rt) {
    if (isStr(obj)) {
      switch (name) {
        case "upper": return obj.toUpperCase();
        case "lower": return obj.toLowerCase();
        case "strip": return obj.trim();
        case "lstrip": return obj.replace(/^\s+/, "");
        case "rstrip": return obj.replace(/\s+$/, "");
        case "split": return args.length ? obj.split(pyStr(args[0])) : obj.split(/\s+/).filter(function (x) { return x !== ""; });
        case "join": return args[0].map(function (x) { return pyStr(x); }).join(obj);
        case "replace": return obj.split(pyStr(args[0])).join(pyStr(args[1]));
        case "count": return obj.split(pyStr(args[0])).length - 1;
        case "find": return obj.indexOf(pyStr(args[0]));
        case "index": {
          var pos = obj.indexOf(pyStr(args[0]));
          if (pos === -1) throw new PErr("Подстроки «" + args[0] + "» нет в строке", rt.line);
          return pos;
        }
        case "rfind": return obj.lastIndexOf(pyStr(args[0]));
        case "startswith": return obj.indexOf(pyStr(args[0])) === 0;
        case "endswith": return obj.slice(-pyStr(args[0]).length) === pyStr(args[0]);
        case "isdigit": return /^[0-9]+$/.test(obj);
        case "isalpha": return /^[A-Za-zА-Яа-я]+$/.test(obj);
        case "zfill": return obj.length >= args[0] ? obj : new Array(args[0] - obj.length + 1).join("0") + obj;
      }
    }
    if (isArr(obj)) {
      switch (name) {
        case "append": obj.push(args[0]); return null;
        case "extend": args[0].forEach(function (x) { obj.push(x); }); return null;
        case "insert": obj.splice(toInt(args[0], rt), 0, args[1]); return null;
        case "remove": {
          var idx = obj.findIndex(function (x) { return pyEq(x, args[0]); });
          if (idx === -1) throw new PErr("Значения нет в списке", rt.line);
          obj.splice(idx, 1); return null;
        }
        case "pop": {
          if (!obj.length) throw new PErr("Список пуст, нечего удалять", rt.line);
          return args.length ? obj.splice(toInt(args[0], rt), 1)[0] : obj.pop();
        }
        case "index": {
          var i2 = obj.findIndex(function (x) { return pyEq(x, args[0]); });
          if (i2 === -1) throw new PErr("Значения нет в списке", rt.line);
          return i2;
        }
        case "count": return obj.filter(function (x) { return pyEq(x, args[0]); }).length;
        case "sort": obj.sort(function (a, b) { return cmpVals(a, b, rt); }); return null;
        case "reverse": obj.reverse(); return null;
        case "copy": return obj.slice();
        case "clear": obj.length = 0; return null;
      }
    }
    if (isDict(obj)) {
      switch (name) {
        case "get": return Object.prototype.hasOwnProperty.call(obj, pyStr(args[0])) ? obj[pyStr(args[0])] : (args.length > 1 ? args[1] : null);
        case "keys": return Object.keys(obj);
        case "values": return Object.keys(obj).map(function (k) { return obj[k]; });
        case "items": return Object.keys(obj).map(function (k) { return [k, obj[k]]; });
        case "pop": {
          var k = pyStr(args[0]);
          var v = obj[k]; delete obj[k]; return v;
        }
        case "update": Object.keys(args[0]).forEach(function (k) { obj[k] = args[0][k]; }); return null;
      }
    }
    throw new PErr("У " + typeName(obj) + " нет метода «" + name + "»", rt.line);
  }

  function mathFn(name, args, rt) {
    var m = {
      sqrt: Math.sqrt, floor: Math.floor, ceil: Math.ceil, fabs: Math.abs,
      pow: Math.pow, gcd: function (a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a; }
    };
    if (m[name]) return m[name].apply(null, args);
    throw new PErr("В math нет функции " + name, rt.line);
  }

  var BUILTINS = {
    print: { __builtin: function (args) { return { __print: args.map(pyStr).join(" ") }; } },
    len: { __builtin: function (args) {
      var v = args[0];
      if (isStr(v)) return v.length;
      if (isArr(v)) return v.length;
      if (isDict(v)) return Object.keys(v).length;
      throw new PErr("len() не работает с " + typeName(v), null);
    } },
    range: { __builtin: function (args) {
      var start = 0, stop, step = 1;
      if (args.length === 1) stop = args[0];
      else if (args.length === 2) { start = args[0]; stop = args[1]; }
      else { start = args[0]; stop = args[1]; step = args[2]; }
      if (step === 0) throw new PErr("Шаг range() не может быть нулём", null);
      var out = [];
      if (step > 0) for (var i = start; i < stop; i += step) out.push(i);
      else for (var j = start; j > stop; j += step) out.push(j);
      return out;
    } },
    str: { __name: "str", __builtin: function (args) { return pyStr(args[0]); } },
    isinstance: { __builtin: function (args) {
      var v = args[0], t = args[1];
      var name = (isDict(t) || t instanceof PyFunc) && t.__name ? t.__name : pyStr(t);
      name = String(name).toLowerCase();
      if (name === "dict") return isDict(v);
      if (name === "list") return isArr(v);
      if (name === "str") return isStr(v);
      if (name === "int") return isNum(v) && Number.isInteger(v);
      if (name === "float") return isFloat(v) || (isNum(v) && !Number.isInteger(v));
      if (name === "bool") return v === true || v === false;
      if (name === "set") return isArr(v);
      return false;
    } },
    type: { __builtin: function (args) {
      var v = args[0];
      return { __name: isDict(v) ? "dict" : isArr(v) ? "list" : isStr(v) ? "str" :
        isFloat(v) ? "float" : isNum(v) ? (Number.isInteger(v) ? "int" : "float") : "None" };
    } },
    dict: { __name: "dict", __builtin: function () { return {}; } },
    list: { __name: "list" },
    tuple: { __name: "tuple" },
    int: { __name: "int", __builtin: function (args) {
      var v = args[0];
      if (isFloat(v)) return Math.trunc(v.v);
      if (isNum(v)) return Math.trunc(v);
      if (isStr(v)) {
        var n = parseInt(v.trim(), 10);
        if (isNaN(n)) throw new PErr("Нельзя превратить в число: «" + v + "»", null);
        return n;
      }
      if (v === true) return 1;
      if (v === false) return 0;
      throw new PErr("int() не работает с " + typeName(v), null);
    } },
    float: { __name: "float", __builtin: function (args) { return parseFloat(args[0]); } },
    abs: { __builtin: function (args) { return Math.abs(toNum(args[0], { line: null })); } },
    min: { __builtin: function (args) {
      var arr = args.length === 1 && isArr(args[0]) ? args[0] : args;
      return arr.reduce(function (a, b) { return cmpVals(a, b, { line: null }) <= 0 ? a : b; });
    } },
    max: { __builtin: function (args) {
      var arr = args.length === 1 && isArr(args[0]) ? args[0] : args;
      return arr.reduce(function (a, b) { return cmpVals(a, b, { line: null }) >= 0 ? a : b; });
    } },
    sum: { __builtin: function (args) {
      var arr = args[0];
      return arr.reduce(function (a, b) { return a + toNum(b, { line: null }); }, 0);
    } },
    sorted: { __builtin: function (args, rt, kwargs) {
      var arr = args[0].slice();
      var keyFn = kwargs && kwargs.key;
      arr.sort(function (a, b) {
        var x = keyFn instanceof PyFunc ? callPyFunc(keyFn, [a], rt) : a;
        var y = keyFn instanceof PyFunc ? callPyFunc(keyFn, [b], rt) : b;
        return cmpVals(x, y, { line: null });
      });
      if (kwargs && truthy(kwargs.reverse)) arr.reverse();
      return arr;
    } },
    reversed: { __builtin: function (args) { return args[0].slice().reverse(); } },
    list: { __name: "list", __builtin: function (args) { return isStr(args[0]) ? args[0].split("") : args[0].slice(); } },
    tuple: { __builtin: function (args) { return isStr(args[0]) ? args[0].split("") : args[0].slice(); } },
    set: { __builtin: function (args) {
      var seen = [], out = [];
      args[0].forEach(function (x) { if (!seen.some(function (y) { return pyEq(x, y); })) { seen.push(x); out.push(x); } });
      return out;
    } },
    enumerate: { __builtin: function (args) {
      return args[0].map(function (x, i) { return [i, x]; });
    } },
    zip: { __builtin: function (args) {
      var out = [], n = Math.min.apply(null, args.map(function (a) { return a.length; }));
      for (var i = 0; i < n; i++) out.push(args.map(function (a) { return a[i]; }));
      return out;
    } },
    round: { __builtin: function (args) {
      var d = args.length > 1 ? args[1] : 0;
      var p = Math.pow(10, d);
      return Math.round(args[0] * p) / p;
    } },
    dict: { __name: "dict", __builtin: function () { return {}; } }
  };

  /* ======================= парсер строк/блоков ======================= */
  function countIndent(line) {
    var n = 0;
    for (var i = 0; i < line.length; i++) {
      if (line[i] === " ") n++;
      else if (line[i] === "\t") n += 4;
      else break;
    }
    return n;
  }

  function stripComment(line) {
    var q = null;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) { if (c === q && line[i - 1] !== "\\") q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === "#") return line.slice(0, i);
    }
    return line;
  }

  /** строка кода -> массив строк с отступом и номером.
      Многострочные конструкции (словарь, список, вызов) склеиваются в одну логическую строку. */
  function prepare(code) {
    var raw = String(code == null ? "" : code).replace(/\r\n?/g, "\n").split("\n");
    var logical = [];
    var buf = null;         // накопитель многострочной конструкции
    var depth = 0;          // незакрытые ( [ {
    var inStr3 = null;      // незакрытая кавычка длинной строки
    function scan(text) {
      var q = null;
      for (var i = 0; i < text.length; i++) {
        var c = text[i];
        if (q) {
          if (c === "\\") { i++; continue; }
          if (c === q) q = null;
          continue;
        }
        if (c === "#") break;
        if (c === '"' || c === "'") { q = c; continue; }
        if (c === "(" || c === "[" || c === "{") depth++;
        else if (c === ")" || c === "]" || c === "}") depth--;
      }
      return q;
    }

    for (var i = 0; i < raw.length; i++) {
      var line = stripComment(raw[i]);
      if (buf === null && line.trim() === "" && !inStr3) continue;
      var openQuote = scan(line);
      if (buf === null) {
        buf = { text: line, no: i + 1, indent: countIndent(raw[i]), multiline: false };
      } else {
        // внутри незакрытой кавычки перевод строки сохраняем, внутри скобок — заменяем пробелом
        buf.text += (inStr3 ? "\n" : " ") + line.trim();
        if (inStr3) buf.multiline = true;
      }
      if (openQuote) { inStr3 = openQuote; continue; }
      inStr3 = null;
      if (depth > 0) continue;                      // конструкция ещё не закрыта
      if (buf.text.trim() === "") { buf = null; continue; }
      logical.push({ text: buf.text.replace(/\s+$/, ""), indent: buf.indent, no: buf.no });
      buf = null;
      depth = 0;
    }
    if (buf && buf.text.trim() !== "") {
      logical.push({ text: buf.text.replace(/\s+$/, ""), indent: buf.indent, no: buf.no });
    }
    // многострочные значения превращаем в одну строку исходника
    return logical.map(function (l) {
      return { text: l.text, indent: l.indent, no: l.no };
    });
  }

  /* одна простая инструкция (не блок) */
  function parseSimple(text, lineNo) {
    // return
    if (/^return\b/.test(text)) {
      var rest = text.replace(/^return\b/, "").trim();
      if (rest === "") return { k: "return", expr: null, line: lineNo };
      // неявный кортеж: return a, b  ->  возвращаем список
      if (rest.indexOf(",") !== -1 && rest.indexOf("[") === -1 && rest.indexOf("(") === -1 && rest.indexOf("'") === -1 && rest.indexOf('"') === -1) {
        var parts = rest.split(",").map(function (s) { return s.trim(); });
        if (parts.length > 1 && parts.every(function (p) { return p.length > 0; })) {
          var items = parts.map(function (p) { return parseExpression(p, lineNo); });
          return { k: "return", expr: { k: "tuple", items: items }, line: lineNo };
        }
      }
      return { k: "return", expr: parseExpression(rest, lineNo), line: lineNo };
    }
    // break / continue / pass
    if (/^break$/.test(text)) return { k: "break", line: lineNo };
    if (/^continue$/.test(text)) return { k: "continue", line: lineNo };
    if (/^pass$/.test(text)) return { k: "pass", line: lineNo };
    // print(...) — как вызов, работает через BUILTINS
    // def — только в parseBlock (нужно тело)
    // присваивание: ищем первый одиночный «=» (не «==», не «!=», не «<=», не «>=»)
    var bareName = /^[A-Za-zА-Яа-я_][A-Za-zА-Яа-я0-9_]*[\s\[,+\-*\/%]/.test(text);
    if (bareName) {
      var eq = -1;
      for (var q = 0; q < text.length; q++) {
        if (text[q] !== "=") continue;
        var before = text[q - 1] || "", after = text[q + 1] || "";
        if (before === "=" || before === "!" || before === "<" || before === ">") continue;
        if (after === "=") continue;
        eq = q; break;
      }
      if (eq > 0) {
        var left = text.slice(0, eq).replace(/\s+$/, "");
        var op = "";
        if (left.slice(-2) === "//" || left.slice(-2) === "**") {
          op = left.slice(-2);
          left = left.slice(0, -2).replace(/\s+$/, "");
        } else if ("+-*/%".indexOf(left.charAt(left.length - 1)) !== -1) {
          op = left.charAt(left.length - 1);
          left = left.slice(0, -1).replace(/\s+$/, "");
        }
        var rhs = text.slice(eq + 1).trim();
        if (rhs === "") throw ParseErr("После знака «=» нет выражения", lineNo);
        // распаковка кортежа: count, size = walk(files)
        if (left.indexOf(",") !== -1 && left.indexOf("[") === -1) {
          var names = left.split(",").map(function (s) { return s.trim(); });
          if (names.every(function (n) { return /^[A-Za-zА-Яа-я_][A-Za-zА-Яа-я0-9_]*$/.test(n); })) {
            return { k: "unpack", names: names, expr: parseExpression(rhs, lineNo), line: lineNo };
          }
        }
        return { k: "assign", target: parseTarget(left, lineNo), op: op, expr: parseExpression(rhs, lineNo), line: lineNo };
      }
    }
    // выражение
    return { k: "expr", expr: parseExpression(text, lineNo), line: lineNo };
  }

  function parseTarget(text, lineNo) {
    var e = parseExpression(text, lineNo);
    if (e.k === "var") return { k: "name", name: e.name };
    if (e.k === "index") return { k: "arr", obj: e.obj, index: e.index };
    throw ParseErr("Не понимаю, куда присваивать: " + text, lineNo);
  }

  /** разбирает блок инструкций; i — индекс первой строки, возвращает {stmts, next} */
  function parseBlock(lines, i, indent) {
    var stmts = [];
    while (i < lines.length && lines[i].indent === indent) {
      var ln = lines[i];
      var text = ln.text.trim();
      // if / elif / else
      var mIf = text.match(/^if\s+(.+):$/);
      if (mIf) {
        i++;
        var body = parseChild(lines, i, indent, ln.no);
        i = body.next;
        var branches = [{ cond: parseExpression(mIf[1], ln.no), body: body.stmts }];
        var orelse = null;
        for (;;) {
          if (i < lines.length && lines[i].indent === indent) {
            var t2 = lines[i].text.trim();
            var mElif = t2.match(/^elif\s+(.+):$/);
            if (mElif) {
              i++;
              var b2 = parseChild(lines, i, indent, lines[i - 1].no);
              i = b2.next;
              branches.push({ cond: parseExpression(mElif[1], lines[i - 1].no), body: b2.stmts });
              continue;
            }
            if (/^else\s*:$/.test(t2)) {
              i++;
              var b3 = parseChild(lines, i, indent, lines[i - 1].no);
              orelse = b3.stmts;
              i = b3.next;
              continue;
            }
          }
          break;
        }
        stmts.push({ k: "if", branches: branches, orelse: orelse, line: ln.no });
        continue;
      }
      // while
      var mWhile = text.match(/^while\s+(.+):$/);
      if (mWhile) {
        i++;
        var b4 = parseChild(lines, i, indent, ln.no);
        stmts.push({ k: "while", cond: parseExpression(mWhile[1], ln.no), body: b4.stmts, line: ln.no });
        i = b4.next;
        continue;
      }
      // for
      var mFor = text.match(/^for\s+([A-Za-zА-Яа-я_][A-Za-zА-Яа-я0-9_]*(?:\s*,\s*[A-Za-zА-Яа-я_][A-Za-zА-Яа-я0-9_]*)?)\s+in\s+(.+):$/);
      if (mFor) {
        var names = mFor[1].split(",").map(function (s) { return s.trim(); });
        i++;
        var b5 = parseChild(lines, i, indent, ln.no);
        stmts.push({ k: "for", names: names, iter: parseExpression(mFor[2], ln.no), body: b5.stmts, line: ln.no });
        i = b5.next;
        continue;
      }
      // def
      var mDef = text.match(/^def\s+([A-Za-zА-Яа-я_][A-Za-zА-Яа-я0-9_]*)\s*\(([^)]*)\)\s*:$/);
      if (mDef) {
        var params = mDef[2].trim() === "" ? [] : mDef[2].split(",").map(function (s) { return s.trim(); });
        i++;
        var b6 = parseChild(lines, i, indent, ln.no);
        stmts.push({ k: "def", name: mDef[1], params: params, body: b6.stmts, line: ln.no });
        i = b6.next;
        continue;
      }
      // импорты явно запрещаем понятной ошибкой
      if (/^(import|from)\b/.test(text)) {
        throw ParseErr("Импорты в браузерном мини-Python не поддерживаются. Используй встроенные функции.", ln.no);
      }
      if (/^class\b/.test(text)) throw ParseErr("Классы здесь не поддерживаются — решай задачу без них.", ln.no);
      if (/^(if|while|for|def|elif|else)\b/.test(text) && !/:$/.test(text)) {
        throw ParseErr("Забыто двоеточие в конце строки", ln.no);
      }
      stmts.push(parseSimple(text, ln.no));
      i++;
    }
    return { stmts: stmts, next: i };
  }

  function parseChild(lines, i, parentIndent, parentLine) {
    if (i >= lines.length || lines[i].indent <= parentIndent) {
      throw ParseErr("После строки с двоеточием нужен блок с отступом", parentLine);
    }
    var childIndent = lines[i].indent;
    var res = parseBlock(lines, i, childIndent);
    return res;
  }

  /* ======================= выполнение ======================= */
  function execBlock(stmts, scope, rt) {
    for (var i = 0; i < stmts.length; i++) {
      var sig = execStmt(stmts[i], scope, rt);
      if (sig) return sig;
    }
    return null;
  }

  function execStmt(s, scope, rt) {
    rt.step();
    rt.line = s.line;
    switch (s.k) {
      case "pass": return null;
      case "return": {
        rt.retVal = s.expr ? evalNode(s.expr, scope, rt) : null;
        return RETURN;
      }
      case "break": return { brk: true };
      case "continue": return { cont: true };
      case "expr": {
        var v = evalNode(s.expr, scope, rt);
        if (v && v.__print !== undefined) { rt.out.push(v.__print); return null; }
        return null;
      }
      case "assign": {
        var val = evalNode(s.expr, scope, rt);
        if (s.op) {
          var cur = readTarget(s.target, scope, rt);
          val = applyAug(s.op, cur, val, rt);
        }
        writeTarget(s.target, val, scope, rt);
        return null;
      }
      case "unpack": {
        var vals = evalNode(s.expr, scope, rt);
        var parts = isArr(vals) ? vals : [vals];
        if (parts.length !== s.names.length) {
          throw new PErr("Слева " + s.names.length + " имени, а значений " + parts.length, s.line);
        }
        s.names.forEach(function (n, i) { scope.set(n, parts[i]); });
        return null;
      }
      case "if": {
        for (var i = 0; i < s.branches.length; i++) {
          if (truthy(evalNode(s.branches[i].cond, scope, rt))) {
            return execBlock(s.branches[i].body, new Scope(scope), rt);
          }
        }
        if (s.orelse) return execBlock(s.orelse, new Scope(scope), rt);
        return null;
      }
      case "while": {
        var guard = 0;
        while (truthy(evalNode(s.cond, scope, rt))) {
          rt.step();
          if (++guard > 50000) throw new PErr("Цикл while выполняется слишком долго — проверь условие", s.line);
          var sig = execBlock(s.body, new Scope(scope), rt);
          if (sig) { if (sig.brk) break; if (sig.cont) continue; return sig; }
        }
        return null;
      }
      case "for": {
        var it = evalNode(s.iter, scope, rt);
        var seq;
        if (isStr(it)) seq = it.split("");
        else if (isArr(it)) seq = it;
        else if (isDict(it)) seq = Object.keys(it);
        else throw new PErr("for умеет ходить по строке, списку, словарю или range()", s.line);
        for (var j = 0; j < seq.length; j++) {
          rt.step();
          var local = new Scope(scope);
          if (s.names.length === 1) local.define(s.names[0], seq[j]);
          else {
            var parts = isArr(seq[j]) ? seq[j] : [seq[j]];
            s.names.forEach(function (nm, k) { local.define(nm, parts[k]); });
          }
          var sg = execBlock(s.body, local, rt);
          if (sg) { if (sg.brk) break; if (sg.cont) continue; return sg; }
        }
        return null;
      }
      case "def": {
        var f = new PyFunc(s.params, s.body, scope);
        f.name = s.name;
        scope.define(s.name, f);
        return null;
      }
    }
    return null;
  }

  function readTarget(t, scope, rt) {
    if (t.k === "name") return scope.get(t.name);
    var arr = evalNode(t.obj, scope, rt);
    var idx = evalNode(t.index, scope, rt);
    if (isDict(arr)) return arr[pyStr(idx)];
    var n = toInt(idx, rt);
    var real = n < 0 ? arr.length + n : n;
    return arr[real];
  }

  function writeTarget(t, val, scope, rt) {
    if (t.k === "name") { scope.set(t.name, val); return; }
    var arr = evalNode(t.obj, scope, rt);
    var idx = evalNode(t.index, scope, rt);
    if (isDict(arr)) { arr[pyStr(idx)] = val; return; }
    var n = toInt(idx, rt);
    var real = n < 0 ? arr.length + n : n;
    if (!isArr(arr)) throw new PErr("Менять по индексу можно список или словарь", rt.line);
    if (real < 0 || real >= arr.length) throw new PErr("Индекс " + n + " вне диапазона (длина " + arr.length + ")", rt.line);
    arr[real] = val;
  }

  function applyAug(op, a, b, rt) {
    switch (op) {
      case "+": {
        if (isStr(a)) return a + pyStr(b);
        if (isArr(a) && isArr(b)) return a.concat(b);
        return toNum(a, rt) + toNum(b, rt);
      }
      case "-": return toNum(a, rt) - toNum(b, rt);
      case "*": {
        if (isStr(a) && isNum(b)) return a.repeat(Math.floor(b));
        if (isArr(a) && isNum(b)) { var o = []; for (var i = 0; i < Math.floor(b); i++) o = o.concat(a); return o; }
        return toNum(a, rt) * toNum(b, rt);
      }
      case "/": if (toNum(b, rt) === 0) throw new PErr("Деление на ноль", rt.line); return toNum(a, rt) / toNum(b, rt);
      case "//": if (toNum(b, rt) === 0) throw new PErr("Деление на ноль", rt.line); return Math.floor(toNum(a, rt) / toNum(b, rt));
      case "%": if (toNum(b, rt) === 0) throw new PErr("Деление на ноль", rt.line); return ((toNum(a, rt) % toNum(b, rt)) + toNum(b, rt)) % toNum(b, rt);
    }
    throw new PErr("Неизвестная операция " + op, rt.line);
  }

  /* срез a[1:3] ловится отдельно, т.к. парсер ждёт двоеточие внутри скобок */
  function preprocessSlices(code) {
    return code;
  }

  /* ======================= публичный интерфейс ======================= */
  App.python = {
    /** запуск кода: {ok, out, error, errorLine, lines} */
    run: function (code) {
      var rt = {
        out: [], steps: 0, line: 1, depth: 0, retVal: null,
        step: function () { if (++this.steps > MAX_STEPS) throw new PErr("Программа выполняется слишком долго (больше " + MAX_STEPS + " шагов)", this.line); }
      };
      try {
        var lines = prepare(preprocessSlices(code));
        if (!lines.length) throw new PErr("Пустая программа — напиши код", 1);
        var parsed = parseBlock(lines, 0, lines[0].indent);
        if (parsed.next < lines.length) {
          throw ParseErr("Лишний отступ в строке " + lines[parsed.next].no, lines[parsed.next].no);
        }
        var scope = new Scope(null);
        var sig = execBlock(parsed.stmts, scope, rt);
        return { ok: true, out: rt.out.join("\n"), error: null, errorLine: null, steps: rt.steps };
      } catch (e) {
        var msg = e && e.message ? e.message : String(e);
        return {
          ok: false, out: rt.out.join("\n"),
          error: (e && e.name && e.name !== "Error" ? e.name + ": " : "") + msg,
          errorLine: e && e.line ? e.line : null, steps: rt.steps
        };
      }
    },

    /** проверка перед запуском: чего мини-Python не умеет */
    isSupported: function (code) {
      var bad = [
        [/\bimport\s+\w+/, "импорты"],
        [/\bclass\s+\w+/, "классы"],
        [/\bwith\s+/, "конструкция with"],
        [/\blambda\b/, "lambda"],
        [/\byield\b/, "генераторы"],
        [/\bopen\s*\(/, "работа с файлами"],
        [/\binput\s*\(/, "input() — в браузере нет клавиатуры, задай данные переменной"]
      ];
      for (var i = 0; i < bad.length; i++) {
        if (bad[i][0].test(code)) return { ok: false, why: "В этом редакторе не поддерживаются: " + bad[i][1] };
      }
      return { ok: true };
    }
  };
})();
