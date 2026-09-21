# -*- coding: utf-8 -*-
"""tools/check-py-solutions.py — прогоняет решения практик в настоящем Python
   и сверяет с expected. Проверяются те уроки, что лежат в module-08 (183, 186),
   либо любые номера, переданные аргументами.
   Запуск: python tools/check-py-solutions.py [номера...]"""
import io
import json
import re
import subprocess
import sys
import tempfile
import os
import runpy

PATH = r"D:\Сайт-ОГЭ-ЕГЭ\data\lessons\module-08-graphs.js"

with io.open(PATH, encoding="utf-8") as f:
    src = f.read()


def js_string_after(text, field):
    m = re.search(r"\b" + field + r":\s*\"", text)
    if not m:
        return None
    i = m.end()
    out = []
    while i < len(text):
        c = text[i]
        if c == "\\":
            nxt = text[i + 1]
            mapping = {"n": "\n", "t": "\t", '"': '"', "\\": "\\", "'": "'"}
            out.append(mapping.get(nxt, "\\" + nxt))
            i += 2
            continue
        if c == '"':
            break
        out.append(c)
        i += 1
    return "".join(out)


wanted = [int(x) for x in sys.argv[1:]] or [183, 186]
for num in wanted:
    idx = src.index("id: %d, module" % num)
    seg = src[idx:idx + 6000]
    solution = js_string_after(seg, "solution")
    expected = js_string_after(seg, "expected")
    fd, tmp = tempfile.mkstemp(suffix=".py")
    os.close(fd)
    with io.open(tmp, "w", encoding="utf-8") as f:
        f.write(solution)
    res = subprocess.run([sys.executable, tmp], capture_output=True, text=True, encoding="utf-8")
    os.unlink(tmp)
    got = (res.stdout or "").rstrip()
    print("=== урок %d" % num)
    if res.returncode != 0:
        print("   ОШИБКА Python:", (res.stderr or "").strip().splitlines()[-1] if res.stderr else "?")
    print("   ожидалось: %r" % expected)
    print("   получено:  %r" % got)
    print("   итог:", "СОВПАЛО" if got == expected.rstrip() else "РАСХОЖДЕНИЕ")
