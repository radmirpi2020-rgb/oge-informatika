graph = {
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
    # поэтому первой обрабатывается вершина, младшая по алфавиту
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

print(' '.join(bfs('A')))
