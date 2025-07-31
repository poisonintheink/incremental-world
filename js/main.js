import { ContinentGenerator } from './gen/continent.js';
import { buildVoronoi } from './gen/voronoi.js';   // Voronoi builder (count + variety)

const canvas = document.getElementById('canvas');
const info = document.getElementById('info');
const generator = new ContinentGenerator(canvas);

const controls = {
  islandSize: document.getElementById('islandSize'),
  blobComplexity: document.getElementById('blobComplexity'),
  noiseScale: document.getElementById('noiseScale'),
  noiseStrength: document.getElementById('noiseStrength'),
  erosionIterations: document.getElementById('erosionIterations'),
  verticalStretch: document.getElementById('verticalStretch'),
  scaleFactor: document.getElementById('scaleFactor'),
  // NEW:
  regionCount: document.getElementById('regionCount'),
  regionVariety: document.getElementById('regionVariety'),
};

const labels = {
  sizeValue: document.getElementById('sizeValue'),
  blobValue: document.getElementById('blobValue'),
  noiseScaleValue: document.getElementById('noiseScaleValue'),
  noiseStrengthValue: document.getElementById('noiseStrengthValue'),
  erosionValue: document.getElementById('erosionValue'),
  stretchValue: document.getElementById('stretchValue'),
  scaleValue: document.getElementById('scaleValue'),
  // NEW:
  regionCountValue: document.getElementById('regionCountValue'),
  regionVarietyValue: document.getElementById('regionVarietyValue'),
};

function readParams() {
  return {
    islandSize: parseFloat(controls.islandSize.value),
    blobComplexity: parseInt(controls.blobComplexity.value, 10),
    noiseScale: parseFloat(controls.noiseScale.value),
    noiseStrength: parseFloat(controls.noiseStrength.value),
    erosionIterations: parseInt(controls.erosionIterations.value, 10),
    verticalStretch: parseFloat(controls.verticalStretch.value),
    scaleFactor: parseFloat(controls.scaleFactor.value),
    // NEW:
    regionCount: parseInt(controls.regionCount.value, 10),
    regionVariety: parseFloat(controls.regionVariety.value),
  };
}

function updateLabels() {
  labels.sizeValue.textContent = controls.islandSize.value;
  labels.blobValue.textContent = controls.blobComplexity.value;
  labels.noiseScaleValue.textContent = controls.noiseScale.value;
  labels.noiseStrengthValue.textContent = controls.noiseStrength.value;
  labels.erosionValue.textContent = controls.erosionIterations.value;
  labels.stretchValue.textContent = controls.verticalStretch.value;
  labels.scaleValue.textContent = controls.scaleFactor.value;
  // NEW:
  labels.regionCountValue.textContent = controls.regionCount.value;
  labels.regionVarietyValue.textContent = parseFloat(controls.regionVariety.value).toFixed(2);
}

function generate() {
  info.textContent = "Generating continent...";
  const res = generator.generate(readParams());
  generator.lastResult = res; // keep latest result so overlays can access landMask
  info.textContent = `Continent generated: ${res.landPct}% land coverage (single contiguous landmass)`;
}

document.getElementById('generateBtn').addEventListener('click', generate);
Object.values(controls).forEach(input => input.addEventListener('input', updateLabels));

updateLabels();
generate();

// --- Debug overlay: press 'V' to draw state/region borders ---
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'v') return;

  const res = generator.lastResult;
  if (!res || !res.landMask) {
    info.textContent = "Voronoi overlay: no land mask available yet.";
    return;
  }

  const p = readParams();
  const { segments, regions } = buildVoronoi(
    res.landMask,
    canvas.width,
    canvas.height,
    {
      // target controls
      count: p.regionCount,          // 3..15
      variety: p.regionVariety,      // 0..1 size diversity

      // feel free to adjust / expose later:
      metricNoiseAmp: 0.08,
      metricNoiseScale: 80,
      segmentNoiseAmp: 1.8,
      segmentNoiseScale: 24,
      maxAreaRatio: 0.5,
    }
  );

  // Draw overlay on top of current canvas
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.strokeStyle = '#ffd20088';
  ctx.lineWidth = 1.2;

  // Stroke all polylines in one path for speed
  ctx.beginPath();
  segments.forEach(seg => {
    const poly = seg.polyline && seg.polyline.length ? seg.polyline : [seg.a, seg.b];
    if (!poly.length) return;
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i][0], poly[i][1]);
    }
  });
  ctx.stroke();
  ctx.restore();

  info.textContent = `Voronoi overlay: ${regions.length} regions (press G to regenerate map)`;
});
