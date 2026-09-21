# -*- coding: utf-8 -*-
"""tools/fix-graphs-practices.py — переписывает решения практик 183 и 186
в подмножестве, которое поддерживает браузерный мини-Python (без генераторов,
lambda, множеств и вложенных функций).
Запуск: python tools/fix-graphs-practices.py
"""
import io
import re

PATH = r"D:\Сайт-ОГЭ-ЕГЭ\data\lessons\module-08-graphs.js"

STARTER_183 = """graph = {
    'A': ['B', 6, 'D', 2, 'C', 4],
    'B': ['A', 6, 'C', 3, 'D', 6, 'E', 8],
    'C': ['B', 3, 'F', 3, 'A', 4],
    'D': ['A', 2, 'B', 6, 'E', 5],
    'E': ['D', 5, 'F', 5, 'B', 8],
    'F': ['C', 3, 'E', 5],
}

def dijkstra(g, start):
    vertices = list(g.keys())
    dist = {}
    used = {}
    for v in vertices:
        dist[v] = 1000000
        used[v] = 0
    dist[start] = 0
    # допиши алгоритм: пока есть необработанные вершины —
    # берём ближайшую, отмечаем и обновляем расстояния соседей
    return dist

d = dijkstra(graph, 'A')
# выведи одно число: кратчайшее расстояние до F
"""

SOLUTION_183 = """graph = {
    'A': ['B', 6, 'D', 2, 'C', 4],
    'B': ['A', 6, 'C', 3, 'D', 6, 'E', 8],
    'C': ['B', 3, 'F', 3, 'A', 4],
    'D': ['A', 2, 'B', 6, 'E', 5],
    'E': ['D', 5, 'F', 5, 'B', 8],
    'F': ['C', 3, 'E', 5],
}

def dijkstra(g, start):
    vertices = list(g.keys())
    dist = {}
    used = {}
    for v in vertices:
        dist[v] = 1000000
        used[v] = 0
    dist[start] = 0
    for step in range(len(vertices)):
        v = ''
        best = 1000000
        for x in vertices:
            if used[x] == 0 and dist[x] < best:
                best = dist[x]
                v = x
        if v == '':
            break
        used[v] = 1
        row = g[v]
        i = 0
        while i < len(row):
            w = row[i]
            cost = row[i + 1]
            if dist[v] + cost < dist[w]:
                dist[w] = dist[v] + cost
            i += 2
    return dist

d = dijkstra(graph, 'A')
print(d['F'])"""

STARTER_186 = """graph = {
    'A': ['B', 'C'],
    'B': ['A', 'C', 'D'],
    'C': ['A', 'B', 'E'],
    'D': ['B', 'F'],
    'E': ['C', 'F', 'H'],
    'F': ['D', 'E', 'G'],
    'G': ['F', 'H'],
    'H': ['E', 'G'],
}

def bfs(start):
    order = []
    visited = {start: 1}
    queue = [start]
    # пока очередь не пуста:
    #   взять первую вершину, записать её в order,
    #   положить в конец очереди всех её непосещённых соседей
    return order

# выведи обход в ширину одной строкой через пробел
"""

SOLUTION_186 = """graph = {
    'A': ['B', 'C'],
    'B': ['A', 'C', 'D'],
    'C': ['A', 'B', 'E'],
    'D': ['B', 'F'],
    'E': ['C', 'F', 'H'],
    'F': ['D', 'E', 'G'],
    'G': ['F', 'H'],
    'H': ['E', 'G'],
}

def dfs(start):
    # итеративный обход в глубину: в стек кладём соседей в обратном порядке,
    # поэтому первой обрабатывается самая «младшая» по алфавиту вершина
    order = []
    visited = {start: 1}
    stack = [start]
    while stack:
        v = stack.pop()
        order.append(v)
        row = graph[v]
        i = len(row) - 1
        while i >= 0:
            w = row[i]
            if w not in visited:
                visited[w] = 1
                stack.append(w)
            i -= 1
    return order

def bfs(start):
    order = []
    visited = {start: 1}
    queue = [start]
    while queue:
        v = queue[0]
        order.append(v)
        queue = queue[1:]
        for w in sorted(graph[v]):
            if w not in visited:
                visited[w] = 1
                queue.append(w)
    return order

print(' '.join(dfs('A')))
print(' '.join(bfs('A')))"""

TASK_183 = ("Дан взвешенный неориентированный граф: A-B 6, A-D 2, B-C 3, C-F 3, A-C 4, B-D 6, D-E 5, E-F 5, B-E 8. "
            "Граф записан так: у каждой вершины список пар «сосед, вес» подряд. "
            "Допиши алгоритм Дейкстры и выведи одно число — кратчайшее расстояние от A до F.")

TASK_186 = ("Граф задан словарём: у каждой вершины список соседей. "
            "Напиши обход в ширину (BFS) от вершины A и выведи порядок обхода одной строкой через пробел, "
            "соседей перебирай в алфавитном порядке.")


def replace_string(src, start, field, new_value):
    """Заменяет значение поля field (строковый литерал) в тексте, начиная с позиции start."""
    m = re.search(r"\b" + field + r":\s*\"", src[start:])
    if not m:
        raise SystemExit("не нашёл поле " + field + " после позиции " + str(start))
    a = start + m.end() - 1          # позиция открывающей кавычки
    i = a + 1
    out = []
    while i < len(src):
        c = src[i]
        if c == "\\":
            out.append(src[i:i + 2])
            i += 2
            continue
        if c == '"':
            break
        out.append(c)
        i += 1
    return src[:a] + '"' + new_value + '"' + src[i + 1:]


with io.open(PATH, encoding="utf-8") as f:
    src = f.read()

# --- урок 183 ---
i183 = src.index("id: 183, module")
head = src[:i183]
tail = src[i183:]
tail = replace_string(tail, 0, "task", TASK_183)
tail = replace_string(tail, 0, "starter", STARTER_183)
tail = replace_string(tail, 0, "solution", SOLUTION_183)
src = head + tail

# --- урок 186 ---
i186 = src.index("id: 186, module")
head = src[:i186]
tail = src[i186:]
tail = replace_string(tail, 0, "task", TASK_186)
tail = replace_string(tail, 0, "starter", STARTER_186)
tail = replace_string(tail, 0, "solution", SOLUTION_186)
src = head + tail

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

print("Практики 183 и 186 переписаны.")

# --- проверка в настоящем Python ---
import subprocess
import sys
import tempfile
import os

for num, name in ((183, "solution"), (186, "solution")):
    i = src.index("id: %d, module" % num)
    seg = src[i:i + 8000]
    m = re.search(r"\bsolution:\s*\"", seg)
    body = []
    k = m.end()
    while k < len(seg):
        c = seg[k]
        if c == "\\":
            nxt = seg[k + 1]
            body.append({"n": "\n", "t": "\t", '"': '"', "\\": "\\", "'": "'"}.get(nxt, "\\" + nxt))
            k += 2
            continue
        if c == '"':
            break
        body.append(c)
        k += 1
    fd, tmp = tempfile.mkstemp(suffix=".py")
    os.close(fd)
    with io.open(tmp, "w", encoding="utf-8") as f:
        f.write("".join(body))
    res = subprocess.run([sys.executable, tmp], capture_output=True, text=True, encoding="utf-8")
    os.unlink(tmp)
    got = (res.stdout or "").rstrip()
    m2 = re.search(r"\bexpected:\s*\"", seg)
    exp = []
    k = m2.end()
    while k < len(seg):
        c = seg[k]
        if c == "\\":
            nxt = seg[k + 1]
            exp.append({"n": "\n", "t": "\t", '"': '"', "\\": "\\", "'": "'"}.get(nxt, "\\" + nxt))
            k += 2
            continue
        if c == '"':
            break
        exp.append(c)
        k += 1
    want = "".join(exp).rstrip()
    print("урок %d: Python вернул %r, ожидалось %r -> %s" % (num, got, want, "СОВПАЛО" if got == want else "РАСХОЖДЕНИЕ"))

