// Steps 10–11: Distance to roads & biome placement (skeleton)
export function computeDistanceToRoads(landMask, width, height, roadPixels) {
  // TODO: multi-source BFS on grid to compute distance for each land pixel
  return new Uint16Array(width * height);
}
export function placeBiomes(width, height, landMask, distanceField, noiseSeed) {
  // TODO: perlin/simplex layers for forest, lakes, flowers, etc.
  return new Uint8Array(width * height); // enum per tile type
}
