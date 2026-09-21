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
    # допиши алгоритм: пока есть необработанные вершины —
    # берём ближайшую, отмечаем её и обновляем расстояния соседей
    return dist

d = dijkstra(graph, 'A')
# выведи одно число: кратчайшее расстояние до F
