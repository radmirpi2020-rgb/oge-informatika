/* tools/test-python.js — прогон мини-интерпретатора на типовых задачах практик.
   Запуск: node tools/test-python.js */
const fs = require("fs");
const path = require("path");

global.window = global;
global.App = {};
eval(fs.readFileSync(path.join(__dirname, "..", "scripts", "practice", "python-lite.js"), "utf8"));

const cases = [
  ["print(2 + 3 * 4)", "14"],
  ["print(2 ** 10)", "1024"],
  ["print(17 // 5, 17 % 5)", "3 2"],
  ["print(10 / 4)", "2.5"],
  ["x = 0\nwhile x < 6:\n    x += 2\nprint(x)", "6"],
  ["x = 1\nwhile x < 10:\n    x = x * 2\nprint(x)", "16"],
  ["s = 0\nfor i in range(1, 6):\n    s += i\nprint(s)", "15"],
  ["for i in range(3):\n    print(i)", "0\n1\n2"],
  ["for i in range(5, 0, -1):\n    print(i)", "5\n4\n3\n2\n1"],
  ["n = 1101\ns = 0\np = 1\nwhile n > 0:\n    s += (n % 10) * p\n    p *= 2\n    n //= 10\nprint(s)", "13"],
  ["n = 97\nres = ''\nwhile n > 0:\n    res = str(n % 2) + res\n    n //= 2\nprint(res)", "1100001"],
  ["n = 255\nh = ''\nd = '0123456789ABCDEF'\nwhile n > 0:\n    h = d[n % 16] + h\n    n //= 16\nprint(h)", "FF"],
  ["a = [5, 3, 8]\na.sort()\nprint(a)", "[3, 5, 8]"],
  ["print(sorted([5, 3, 8], reverse=True))", "[8, 5, 3]"],
  ["print(len('привет'), len([1,2,3]))", "6 3"],
  ["s = 'информатика'\nprint(s[0], s[-1], s[2:5])", "и а фор"],
  ["print('ab' * 3)", "ababab"],
  ["print(sum([1,2,3,4]), max([1,2,3,4]), min([1,2,3,4]))", "10 4 1"],
  ["a = [1,2,3]\na.append(4)\nprint(a)", "[1, 2, 3, 4]"],
  ["print([x for x in [1,2]] if True else 1)", null, true],
  ["def f(x):\n    return x * x\nprint(f(7))", "49"],
  ["def krat(n):\n    if n % 3 == 0:\n        return 'да'\n    else:\n        return 'нет'\nprint(krat(9), krat(10))", "да нет"],
  ["def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\nprint(fact(5))", "120"],
  ["d = {'a': 1, 'b': 2}\nprint(d['a'], len(d))", "1 2"],
  ["d = {}\nd['кот'] = 3\nprint(d.get('кот'), d.get('пёс', 0))", "3 0"],
  ["A = True\nB = False\nprint((A and B) or (not B and A))", "True"],
  ["print(not (1 > 2))", "True"],
  ["print(5 == 5.0, 'a' < 'b')", "True True"],
  ["words = ['мама', 'мыла', 'раму']\nprint(' '.join(words))", "мама мыла раму"],
  ["print('Привет'.upper(), 'МИР'.lower())", "ПРИВЕТ мир"],
  ["print('a,b,c'.split(','))", "['a', 'b', 'c']"],
  ["b = 100\nbits = 0\nwhile b > 0:\n    bits += b % 2\n    b //= 2\nprint(bits)", "3"],
  ["v = 1024\nspeed = 128\nprint(v // speed)", "8"],
  ["print(' 7 '.strip(), int('42') + 1)", "7 43"],
  ["for i in range(3):\n    for j in range(2):\n        print(i, j)", "0 0\n0 1\n1 0\n1 1\n2 0\n2 1"],
  ["a = [1,2,3,4]\ns = 0\nfor x in a:\n    if x % 2 == 0:\n        s += x\nprint(s)", "6"],
  ["print(round(3.14159, 2))", "3.14"],
  ["print(7 % 3, -7 % 3)", "1 2"],
  ["s = '1100'\nn = 0\nfor ch in s:\n    n = n * 2 + int(ch)\nprint(n)", "12"],
  ["print(len('Hello, world!'.replace(' ', '')))", "12"],
  ["x = 10\nif x > 5:\n    if x > 8:\n        print('большое')\n    else:\n        print('среднее')\nelse:\n    print('мало')", "большое"],
  ["print(list(range(3)))", "[0, 1, 2]"],
  ["print(2 == 2 and 'да')", "да"],
  ["a = [3, 1, 2]\nfor i in range(len(a)):\n    for j in range(len(a) - 1):\n        if a[j] > a[j + 1]:\n            t = a[j]\n            a[j] = a[j + 1]\n            a[j + 1] = t\nprint(a)", "[1, 2, 3]"],
  ["print('x' in 'text', 3 in [1,2,3])", "True True"],
  ["print(16.0, 200 / 8, 1 / 3)", "16.0 25.0 0.3333333333333333"],
  ["print(200 * 1024 * 8 / (100 * 1024))", "16.0"],
  ["print(7 / 2 + 1)", "4.5"],
  ["def f(s, base):\n    d = '0123456789ABCDEF'\n    r = 0\n    for ch in s.upper():\n        r = r * base + d.index(ch)\n    return r\nprint(f('FF', 16))", "255"],
  ["names = ['Аня', 'Борис']\nscores = [5, 4]\nj = {'Аня': 0, 'Борис': 0}\nfor i in range(len(names)):\n    j[names[i]] = scores[i]\nprint(j['Борис'], j['Аня'])", "4 5"],
  ["files = {'a.txt': 1200, 'b.jpg': 2048}\ntotal = 0\nfor k in files:\n    total = total + files[k]\nprint('Файлов:', len(files), 'размер:', total)", "Файлов: 2 размер: 3248"],
  ["a = [[1,2],[3,4]]\nprint(a[1][0])", "3"],
  ["a = [1,2,3]\na[0] = a[0] + 10\nprint(a)", "[11, 2, 3]"],
  ["d = {'x': {'y': 5}}\nprint(d['x']['y'])", "5"],
  ["print(round(16.0), int(16.0), str(16.0))", "16 16 16.0"],
  ["s = 'abc'\nprint(s[::-1], s[1:], s[:2])", "cba bc ab"],
  ["print(max(3, 7), min([4, 2, 9]))", "7 2"],
  ["for i, x in enumerate(['a','b']):\n    print(i, x)", "0 a\n1 b"]
];

const errors = [
  ["print(1/0)", "Деление на ноль"],
  ["print(unknown_var)", "не определено"],
  ["if True\n    print(1)", "двоеточие"],
  ["import math", "не поддерживаются"],
  ["print(", "разобрать"],
  ["def f():\nprint(1)", "отступ"]
];

let pass = 0, fail = 0;
cases.forEach(([code, expected, expectReject]) => {
  const r = App.python.run(code);
  if (expectReject) {
    if (r.ok) { console.log("FAIL (ожидалась ошибка):", JSON.stringify(code)); fail++; }
    else pass++;
    return;
  }
  if (!r.ok) { console.log("FAIL (ошибка выполнения):", JSON.stringify(code), "->", r.error, "строка", r.errorLine); fail++; return; }
  if (r.out !== expected) {
    console.log("FAIL:", JSON.stringify(code), "\n  ожидалось:", JSON.stringify(expected), "\n  получено: ", JSON.stringify(r.out));
    fail++;
  } else pass++;
});

errors.forEach(([code, needle]) => {
  const r = App.python.run(code);
  if (r.ok) { console.log("FAIL (должна быть ошибка):", JSON.stringify(code), "->", r.out); fail++; }
  else if (!r.error.includes(needle)) { console.log("FAIL (другая ошибка):", JSON.stringify(code), "->", r.error); fail++; }
  else pass++;
});

console.log("\nИтог: успешно " + pass + ", провалено " + fail);
process.exit(fail ? 1 : 0);
