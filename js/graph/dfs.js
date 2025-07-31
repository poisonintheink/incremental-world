// Step 5: Depth-first search over county adjacency (skeleton)
/**
 * Given an adjacency list { nodeId: [neighborIds...] }, returns a DFS tree that connects all nodes.
 */
export function dfsConnect(adjacency, startId = 0) {
  const visited = new Set();
  const treeEdges = [];
  function dfs(u) {
    visited.add(u);
    for (const v of (adjacency[u] || [])) {
      if (!visited.has(v)) {
        treeEdges.push([u, v]);
        dfs(v);
      }
    }
  }
  dfs(startId);
  return { visited, treeEdges };
}
