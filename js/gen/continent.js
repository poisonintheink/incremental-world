import { SimplexNoise } from '../core/simplex.js';
import { Random } from '../core/random.js';

export class ContinentGenerator {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
  }

  generate(params) {
    const { islandSize, blobComplexity, noiseScale, noiseStrength,
      erosionIterations, verticalStretch, scaleFactor } = params;

    const fieldData = new Float32Array(this.width * this.height);
    const binaryData = new Array(this.width * this.height).fill(false);

    const radius = Math.min(this.width, this.height) * islandSize * 0.4;

    // 1) base metaball "continent" shape
    generateContinentShape(
      this.width, this.height, fieldData,
      this.width / 2, this.height / 2,
      radius, blobComplexity, verticalStretch, scaleFactor
    );

    // 2) edge-aware noise + connectivity
    applyNoiseWithConnectivity(
      this.width, this.height, fieldData, binaryData,
      noiseScale, noiseStrength, scaleFactor
    );

    // 3) controlled erosion
    applyControlledErosion(
      this.width, this.height, binaryData, erosionIterations
    );

    // 4) render
    const imageData = this.ctx.createImageData(this.width, this.height);
    const data = imageData.data;
    let landPixels = 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const index = y * this.width + x;
        const p = index * 4;
        if (binaryData[index]) {
          // Land (brown)
          data[p] = 139; data[p + 1] = 90; data[p + 2] = 43;
          landPixels++;
        } else {
          // Ocean (blue)
          data[p] = 30; data[p + 1] = 60; data[p + 2] = 120;
        }
        data[p + 3] = 255;
      }
    }
    this.ctx.putImageData(imageData, 0, 0);
    
    const landPct = +(landPixels / (this.width * this.height) * 100).toFixed(1);
    return { landPixels, landPct, landMask: binaryData };
  }
}

// === Helpers that mirror your inline functions, now parameterized by width/height ===

export function generateContinentShape(
  width, height, fieldData, centerX, centerY, radius, complexity, verticalStretch, scaleFactor
) {
  const metaballs = [];
  const rand = new Random(Date.now());

  // Scale the radius while keeping detail complexity
  radius = radius * scaleFactor;

  // Create a "spine" of metaballs for vertical elongation
  const spineCount = Math.floor(complexity * 0.6);
  const spineHeight = radius * verticalStretch * 2;

  for (let i = 0; i < spineCount; i++) {
    const t = i / Math.max(1, (spineCount - 1));
    const y = centerY - spineHeight / 2 + spineHeight * t;

    const xOffset = Math.sin(t * Math.PI * 3 + rand.next() * 2) * radius * 0.3;
    const sizeVariation = 0.6 + rand.next() * 0.6;

    metaballs.push({
      x: centerX + xOffset + (rand.next() - 0.5) * radius * 0.2,
      y: y + (rand.next() - 0.5) * radius * 0.1,
      radius: radius * sizeVariation * (0.7 + Math.sin(t * Math.PI) * 0.3),
      strength: 0.8 + rand.next() * 0.2
    });
  }

  // A few “bulges” off to the sides
  const bulgeCount = Math.floor(complexity * 0.3);
  for (let i = 0; i < bulgeCount; i++) {
    const t = rand.next();
    const y = centerY - spineHeight / 2 + spineHeight * t;
    const side = rand.next() > 0.5 ? 1 : -1;
    metaballs.push({
      x: centerX + side * radius * (0.5 + rand.next() * 0.5),
      y,
      radius: radius * (0.4 + rand.next() * 0.4),
      strength: 0.6 + rand.next() * 0.3
    });
  }

  // Small detail blobs around
  const detailCount = Math.max(0, complexity - spineCount - bulgeCount);
  for (let i = 0; i < detailCount; i++) {
    const angle = rand.next() * Math.PI * 2;
    const distance = radius * (0.3 + rand.next() * 0.7);
    const yStretch = 1.5;
    metaballs.push({
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance * yStretch,
      radius: radius * (0.2 + rand.next() * 0.3),
      strength: 0.5 + rand.next() * 0.3
    });
  }

  // Accumulate field values
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (const ball of metaballs) {
        const dx = x - ball.x, dy = y - ball.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < ball.radius * 2) {
          const normalized = distance / (ball.radius * 2);
          value += ball.strength * Math.pow(1 - normalized, 3);
        }
      }
      fieldData[y * width + x] = value;
    }
  }
}

export function findLargestConnectedComponent(width, height, binaryData) {
  const visited = new Array(width * height).fill(false);
  const components = [];

  function floodFill(startX, startY) {
    const component = [];
    const stack = [[startX, startY]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const index = y * width + x;
      if (visited[index] || !binaryData[index]) continue;
      visited[index] = true;
      component.push([x, y]);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return component;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (!visited[index] && binaryData[index]) {
        const component = floodFill(x, y);
        if (component.length) components.push(component);
      }
    }
  }
  return components.reduce((largest, current) => current.length > largest.length ? current : largest, []);
}

export function applyNoiseWithConnectivity(
  width, height, fieldData, binaryData, noiseScale, noiseStrength, scaleFactor
) {
  const noise = new SimplexNoise(Date.now());
  const noise2 = new SimplexNoise(Date.now() + 1000);
  const noise3 = new SimplexNoise(Date.now() + 2000);

  // Find max field value
  let maxFieldValue = 0;
  for (let i = 0; i < fieldData.length; i++) if (fieldData[i] > maxFieldValue) maxFieldValue = fieldData[i];

  const edgeThreshold = 0.6; // “edge region” indicator

  // Edge-aware noise application
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (fieldData[index] <= 0) continue;

      const normalizedField = fieldData[index] / maxFieldValue;
      const isEdge = normalizedField < edgeThreshold;

      let noiseValue = 0, amplitude = 1, frequency = 1, maxValue = 0;
      const adjustedScale = noiseScale / Math.sqrt(scaleFactor);

      if (isEdge) {
        // isotropic multi-octave for coasts
        for (let i = 0; i < 5; i++) {
          noiseValue += noise3.noise2D(
            x * frequency / (width / adjustedScale),
            y * frequency / (height / adjustedScale)
          ) * amplitude;
          maxValue += amplitude;
          amplitude *= 0.5;
          frequency *= 2.2;
        }
      } else {
        // directional interior
        for (let i = 0; i < 4; i++) {
          noiseValue += noise.noise2D(
            x * frequency / (width / adjustedScale),
            y * frequency / (height / adjustedScale) * 0.5
          ) * amplitude;
          maxValue += amplitude;
          amplitude *= 0.5;
          frequency *= 2;
        }
      }

      // fine-grain overlay
      amplitude = 0.2; frequency = 4;
      noiseValue += noise2.noise2D(
        x * frequency / (width / adjustedScale),
        y * frequency / (height / adjustedScale)
      ) * amplitude;
      maxValue += amplitude;

      noiseValue = (noiseValue / maxValue + 1) * 0.5;

      const edgeStrength = isEdge ? noiseStrength : noiseStrength * 0.7;
      fieldData[index] = fieldData[index] * (1 - edgeStrength) + fieldData[index] * noiseValue * edgeStrength;
    }
  }

  // Threshold to build land mask
  const threshold = 0.35;
  for (let i = 0; i < fieldData.length; i++) binaryData[i] = fieldData[i] > threshold;

  // Keep only the largest connected component (single landmass)
  const largestComponent = findLargestConnectedComponent(width, height, binaryData);
  binaryData.fill(false);
  for (const [x, y] of largestComponent) binaryData[y * width + x] = true;
}

export function applyControlledErosion(width, height, binaryData, iterations) {
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (let iter = 0; iter < iterations; iter++) {
    const toErode = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x;
        if (!binaryData[index]) continue;

        let waterNeighbors = 0, landNeighbors = 0;
        for (const [dx, dy] of dirs) {
          const ni = (y + dy) * width + (x + dx);
          if (binaryData[ni]) landNeighbors++; else waterNeighbors++;
        }
        // slightly stronger early iterations, then ease
        const erosionThreshold = iter < iterations / 2 ? 5 : 4;
        if (waterNeighbors >= erosionThreshold && landNeighbors >= 1) toErode.push(index);
      }
    }
    for (const index of toErode) binaryData[index] = false;
  }
}
