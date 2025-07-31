// Poisson disk sampling inside an arbitrary “accept” mask (here, land).
// Refs: Bridson 2007, stackoverflow.com/q/4755210/372148.
export function poissonDiskSample(
  width, height,
  minDist = 40,           // pixels (≈ map-width / 12 is a good start)
  k = 30,                 // attempts before giving up on an active point
  accept = () => true     // predicate (x, y) => boolean
) {
  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.ceil(width / cellSize);
  const gridH = Math.ceil(height / cellSize);
  const grid = new Array(gridW * gridH).fill(null);
  const points = [];
  const active = [];

  function gridIndex(x, y) {
    return Math.floor(x / cellSize) + Math.floor(y / cellSize) * gridW;
  }
  function inNeighbourhood(x, y) {
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    for (let ny = gy - 2; ny <= gy + 2; ny++) {
      for (let nx = gx - 2; nx <= gx + 2; nx++) {
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
        const pIdx = grid[nx + ny * gridW];
        if (pIdx != null) {
          const [px, py] = points[pIdx];
          if ((px - x) ** 2 + (py - y) ** 2 < minDist ** 2) return true;
        }
      }
    }
    return false;
  }

  // pick first seed at random inside accept mask
  let tries = 500;
  while (tries--) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    if (accept(x, y)) {
      const gi = gridIndex(x, y);
      grid[gi] = points.length;
      points.push([x, y]);
      active.push(points.length - 1);
      break;
    }
  }
  if (!points.length) return points; // no land?

  // main loop
  while (active.length) {
    const idx = active[Math.floor(Math.random() * active.length)];
    const [cx, cy] = points[idx];
    let placed = false;

    for (let i = 0; i < k; i++) {
      const r = minDist * (1 + Math.random());              // [minDist, 2*minDist]
      const θ = Math.random() * Math.PI * 2;
      const x = cx + r * Math.cos(θ);
      const y = cy + r * Math.sin(θ);

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (!accept(x, y) || inNeighbourhood(x, y)) continue;

      const gi = gridIndex(x, y);
      grid[gi] = points.length;
      points.push([x, y]);
      active.push(points.length - 1);
      placed = true;
      break;
    }
    if (!placed) active.splice(active.indexOf(idx), 1);
  }
  return points;
}
