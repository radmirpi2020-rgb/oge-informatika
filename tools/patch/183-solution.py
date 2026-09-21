graph = {
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
print(d['F'])
