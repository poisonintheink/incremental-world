// Step 6: Flood fill / BFS over road network to compute graph distances (skeleton)
export function graphDistances(adjacency, sources) {
  const dist = {};
  const q = [];
  for (const s of sources) { dist[s] = 0; q.push(s); }
  while (q.length) {
    const u = q.shift();
    for (const v of (adjacency[u] || [])) {
      if (!(v in dist)) {
        dist[v] = dist[u] + 1;
        q.push(v);
      }
    }
  }
  return dist;
}
