import { SimplexNoise } from '../core/simplex.js';

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


// Build a Voronoi diagram over the given land mask. Returns an object with
// `segments` (border polylines) and `regions` (Voronoi cells as polygons).
// The implementation is intentionally lightweight and makes no attempt to be
// perfectly robust; it is designed for a moderate amount of sites (\~3–15)
// which is sufficient for the overlay used in this project.
export function buildVoronoi(landMask, width, height, options = {}) {
  const {
    count = 8,
    variety = 0,          // currently unused but accepted for API parity
    metricNoiseAmp = 0,   // unused – distance noise could be added later
    metricNoiseScale = 80,
    segmentNoiseAmp = 0,
    segmentNoiseScale = 24,
    maxAreaRatio = 0.5,   // unused; placeholder for future tweaking
  } = options;

  // --- Sample seed sites -------------------------------------------------
  const accept = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || xi >= width || yi < 0 || yi >= height) return false;
    return !!landMask[yi * width + xi];
  };

  // Estimate a radius that yields approximately `count` sites. Adjust a
  // couple of times if we are far off the target.
  const area = width * height;
  let minDist = Math.sqrt(area / count) * 0.85;
  let sites = poissonDiskSample(width, height, minDist, 30, accept);
  let attempts = 0;
  while (attempts < 5 && (sites.length < count * 0.8 || sites.length > count * 1.2)) {
    minDist = minDist * Math.sqrt(sites.length / count);
    sites = poissonDiskSample(width, height, minDist, 30, accept);
    attempts++;
  }
  if (sites.length < 3) return { segments: [], regions: [] };

  // --- Delaunay triangulation via Bowyer–Watson --------------------------
  const pts = sites.map(p => ({ x: p[0], y: p[1] }));
  const max = Math.max(width, height) * 10;
  // Add "super" triangle
  pts.push({ x: -max, y: -max });
  pts.push({ x: max, y: -max });
  pts.push({ x: 0, y: max });

  function circumcircle(ax, ay, bx, by, cx, cy) {
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (d === 0) return { x: 0, y: 0, r2: Infinity };
    const ux = ((ax * ax + ay * ay) * (by - cy) +
      (bx * bx + by * by) * (cy - ay) +
      (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) +
      (bx * bx + by * by) * (ax - cx) +
      (cx * cx + cy * cy) * (bx - ax)) / d;
    const r2 = (ux - ax) * (ux - ax) + (uy - ay) * (uy - ay);
    return { x: ux, y: uy, r2 };
  }

  let triangles = [{
    a: pts.length - 3, b: pts.length - 2, c: pts.length - 1,
    ...circumcircle(
      pts[pts.length - 3].x, pts[pts.length - 3].y,
      pts[pts.length - 2].x, pts[pts.length - 2].y,
      pts[pts.length - 1].x, pts[pts.length - 1].y)
  }];

  for (let i = 0; i < sites.length; i++) {
    const px = pts[i].x, py = pts[i].y;
    const bad = [];
    for (let t = 0; t < triangles.length; t++) {
      const tri = triangles[t];
      if (((tri.x - px) ** 2 + (tri.y - py) ** 2) <= tri.r2) bad.push(t);
    }

    const polygon = [];
    for (const idx of bad) {
      const tri = triangles[idx];
      const edges = [[tri.a, tri.b], [tri.b, tri.c], [tri.c, tri.a]];
      for (const e of edges) {
        let found = false;
        for (let j = 0; j < polygon.length; j++) {
          const pe = polygon[j];
          if (pe[0] === e[1] && pe[1] === e[0]) { polygon.splice(j, 1); found = true; break; }
        }
        if (!found) polygon.push(e);
      }
    }
    triangles = triangles.filter((_, idx) => !bad.includes(idx));

    for (const e of polygon) {
      const tri = {
        a: e[0], b: e[1], c: i,
        ...circumcircle(
          pts[e[0]].x, pts[e[0]].y,
          pts[e[1]].x, pts[e[1]].y,
          pts[i].x, pts[i].y)
      };
      triangles.push(tri);
    }
  }

  const superIdx = [pts.length - 3, pts.length - 2, pts.length - 1];
  triangles = triangles.filter(tri => !superIdx.includes(tri.a) && !superIdx.includes(tri.b) && !superIdx.includes(tri.c));
  const centers = triangles.map(t => ({ x: t.x, y: t.y }));

  // --- Build Voronoi edges from triangle adjacencies ---------------------
  const edgeMap = new Map();
  triangles.forEach((t, ti) => {
    const edges = [[t.a, t.b], [t.b, t.c], [t.c, t.a]];
    edges.forEach(([a, b]) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      const arr = edgeMap.get(key);
      if (arr) arr.push(ti); else edgeMap.set(key, [ti]);
    });
  });

  const segments = [];
  function clipToBounds(x, y, dx, dy) {
    let tMax = Infinity;
    if (dx > 0) tMax = Math.min(tMax, (width - x) / dx);
    else if (dx < 0) tMax = Math.min(tMax, (0 - x) / dx);
    if (dy > 0) tMax = Math.min(tMax, (height - y) / dy);
    else if (dy < 0) tMax = Math.min(tMax, (0 - y) / dy);
    if (tMax === Infinity) return [x, y];
    return [x + dx * tMax, y + dy * tMax];
  }

  const noise = segmentNoiseAmp > 0 ? new SimplexNoise() : null;
  function addSegment(p1, p2) {
    const seg = { a: [p1.x, p1.y], b: [p2.x, p2.y] };
    if (noise) {
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(2, Math.floor(len / segmentNoiseScale));
      const poly = [];
      const nx = -(p2.y - p1.y) / len;
      const ny = (p2.x - p1.x) / len;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const off = noise.noise2D(x / segmentNoiseScale, y / segmentNoiseScale) * segmentNoiseAmp;
        poly.push([x + nx * off, y + ny * off]);
      }
      seg.polyline = poly;
    }
    segments.push(seg);
  }

  edgeMap.forEach((tris, key) => {
    if (tris.length === 2) {
      const c1 = centers[tris[0]];
      const c2 = centers[tris[1]];
      addSegment(c1, c2);
    } else if (tris.length === 1) {
      // edge on the convex hull – extend to bounding box
      const [aIdx, bIdx] = key.split(',').map(Number);
      const p1 = pts[aIdx], p2 = pts[bIdx];
      const c = centers[tris[0]];
      const dx = p2.y - p1.y;
      const dy = -(p2.x - p1.x);
      const [x, y] = clipToBounds(c.x, c.y, dx, dy);
      addSegment(c, { x, y });
    }
  });

  // --- Assemble regions from triangle circumcenters ---------------------
  const triByPoint = new Map();
  triangles.forEach((t, ti) => {
    [t.a, t.b, t.c].forEach(v => {
      if (!triByPoint.has(v)) triByPoint.set(v, []);
      triByPoint.get(v).push(ti);
    });
  });

  const regions = [];
  for (let i = 0; i < sites.length; i++) {
    const tris = triByPoint.get(i) || [];
    if (!tris.length) continue;
    const center = sites[i];
    const poly = tris.map(ti => {
      const c = centers[ti];
      const angle = Math.atan2(c.y - center[1], c.x - center[0]);
      return { c, angle };
    }).sort((a, b) => a.angle - b.angle).map(o => [o.c.x, o.c.y]);
    regions.push({ index: i, center, polygon: poly });
  }

  return { segments, regions };
}