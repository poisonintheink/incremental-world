// Poisson disk sampling with optional "accept" mask predicate.
// Returns an array of [x, y] points distributed at least minDist apart.
export function poissonDiskSample(width, height, minDist = 40, k = 30, accept = () => true) {
  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.ceil(width / cellSize);
  const gridH = Math.ceil(height / cellSize);
  const grid = new Array(gridW * gridH).fill(null);
  const points = [];
  const active = [];

  function gidx(x, y) {
    return Math.floor(x / cellSize) + Math.floor(y / cellSize) * gridW;
  }
  function crowded(x, y) {
    const gx = Math.floor(x / cellSize), gy = Math.floor(y / cellSize);
    for (let ny = gy - 2; ny <= gy + 2; ny++) {
      for (let nx = gx - 2; nx <= gx + 2; nx++) {
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
        const idx = grid[nx + ny * gridW];
        if (idx != null) {
          const p = points[idx];
          if ((p[0] - x) ** 2 + (p[1] - y) ** 2 < minDist ** 2) return true;
        }
      }
    }
    return false;
  }

  // first seed
  let guard = 500;
  while (guard--) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    if (accept(x, y)) {
      grid[gidx(x, y)] = points.length;
      points.push([x, y]);
      active.push(points.length - 1);
      break;
    }
  }
  if (!points.length) return points;

  // grow
  while (active.length) {
    const idx = active[Math.floor(Math.random() * active.length)];
    const [cx, cy] = points[idx];
    let placed = false;

    for (let i = 0; i < k; i++) {
      const r = minDist * (1 + Math.random());
      const th = Math.random() * Math.PI * 2;
      const x = cx + r * Math.cos(th);
      const y = cy + r * Math.sin(th);
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (!accept(x, y) || crowded(x, y)) continue;

      grid[gidx(x, y)] = points.length;
      points.push([x, y]);
      active.push(points.length - 1);
      placed = true;
      break;
    }
    if (!placed) active.splice(active.indexOf(idx), 1);
  }

  return points;
}
