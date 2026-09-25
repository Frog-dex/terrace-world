// Georeferenced imagery, not generated replacement terrain. The complete
// regional Esri export replaces a USGS mosaic with an actual NoData footprint.
// Each image is an EPSG:4326 export with its returned (not rounded) bounds.
export const NEVADA_TARGET = Object.freeze({ latitude: 38.5, longitude: -116.5, provisional: true });
export const NEVADA_LEVELS = Object.freeze([
  { id: 'western-us', file: 'western-us-usgs.jpg', bounds: [-128.00166481687009, 27.999999999999986, -102.9983351831298, 49.999999999999986], width: 3072, height: 2703, enterKm: 8000, fullKm: 2400 },
  { id: 'nevada-regional', file: 'nevada-regional-complete.jpg', bounds: [-121.00062787777313, 35, -111.99937212222687, 42], width: 3072, height: 2389, enterKm: 1900, fullKm: 520, completeCoverage: true },
  { id: 'nevada-desert', file: 'nevada-desert-usgs.jpg', bounds: [-116.800025477707, 38.269999999999996, -116.19997452229299, 38.72999999999999], width: 3072, height: 2355, enterKm: 180, fullKm: 46 },
]);

const clamp = value => Math.max(0, Math.min(1, value));
const eased = value => { const q = clamp(value); return q * q * (3 - 2 * q); };

// The source photos and their baked daytime shadows stay untouched. Hold the
// Earth descent in daylight; the town shot owns the later day-to-night change.
export function nevadaLightingAt(sceneTime = 0) {
  return {
    hour: 16,
    duskProgress: 0,
    handoffHour: 16,
    linearMultiplier: [1, 1, 1],
    phase: 'daylight',
  };
}

// The official regional mosaic contains one white NoData footprint with a
// black stair-step rim, plus two holes clipped by its southern image edge.
// These measured image-pixel polygons hide only those known coverage gaps.
// The complete, geographically registered western-US image remains underneath.
// Never key out dark terrain or bright salt flats globally.
export const REGIONAL_NO_DATA_POLYGONS = Object.freeze([
  [[1302,1366],[1620,1366],[1875,1536],[1939,1602],[1939,1895],[1915,1918],[1860,1918],[1540,1854],[1345,1616],[1302,1555]],
  [[-40,2210],[135,2210],[135,2430],[-40,2430]],
  [[1000,2340],[1140,2340],[1140,2430],[1000,2430]],
]);

function regionalCoverageShader(spec) {
  if (spec.id !== 'nevada-regional' || spec.completeCoverage) return '';
  return `vec2 sourcePixel = vec2(vMapUv.x * 3072.0, (1.0 - vMapUv.y) * 2389.0);\n` +
    REGIONAL_NO_DATA_POLYGONS.map(polygon => `{
      float edgeDistancePixels = 10000.0;
      ${polygon.map((a, index) => {
        const b = polygon[(index + 1) % polygon.length];
        const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
        return `edgeDistancePixels = min(edgeDistancePixels, (${dx.toFixed(4)} * (sourcePixel.y - ${a[1].toFixed(4)}) - ${dy.toFixed(4)} * (sourcePixel.x - ${a[0].toFixed(4)})) / ${length.toFixed(4)});`;
      }).join('\n')}
      diffuseColor.a *= 1.0 - smoothstep(-80.0, -40.0, edgeDistancePixels);
    }`).join('\n');
}

// Build display coverage only: never rewrite the USGS photo. Its ocean is
// bathymetric cartography, unlike NASA's photographic ocean underneath.
// Connectivity is essential: isolated blue inland lakes must remain USGS.
export function connectedOceanCoverage(rgba, width, height, bounds, featherPixels = 2) {
  const count = width * height;
  if (rgba.length !== count * 4 || width < 2 || height < 2) throw new TypeError('Ocean coverage requires a complete RGBA image.');
  const candidates = new Uint8Array(count), ocean = new Uint8Array(count);
  const queue = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    candidates[i] = b > r + 4 && b > g + 2 ? 1 : 0;
  }
  let head = 0, tail = 0;
  const seed = i => { if (candidates[i] && !ocean[i]) { ocean[i] = 1; queue[tail++] = i; } };
  // The Pacific is the only blue component connected to this western edge.
  for (let y = 0; y < height; y++) seed(y * width);
  // Baja's tip lies south of the crop, so the Gulf is disconnected in-image.
  // Seed only its known southern-edge opening, never arbitrary inland water.
  const [west, south, east] = bounds;
  if (south > 27.9 && south < 28.1) {
    for (let x = 0; x < width; x++) {
      const longitude = west + (east - west) * (x + .5) / width;
      if (longitude > -114 && longitude < -110) seed((height - 1) * width + x);
    }
  }
  while (head < tail) {
    const i = queue[head++], x = i % width;
    if (x > 0) seed(i - 1);
    if (x + 1 < width) seed(i + 1);
    if (i >= width) seed(i - width);
    if (i + width < count) seed(i + width);
  }
  // Feather only ocean-side pixels. Every land and disconnected lake pixel
  // remains fully opaque; image bounds are not mistaken for a coastline.
  const distance = new Uint16Array(count), far = Math.min(65534, width + height);
  for (let i = 0; i < count; i++) distance[i] = ocean[i] ? far : 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (x) distance[i] = Math.min(distance[i], distance[i - 1] + 1);
    if (y) distance[i] = Math.min(distance[i], distance[i - width] + 1);
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x;
    if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i + 1] + 1);
    if (y + 1 < height) distance[i] = Math.min(distance[i], distance[i + width] + 1);
  }
  const coverage = new Uint8Array(count);
  for (let i = 0; i < count; i++) coverage[i] = ocean[i] ? Math.round(255 * eased(1 - distance[i] / featherPixels)) : 255;
  return { coverage, ocean, oceanPixels: tail, width, height, featherPixels };
}

function createOceanCoverageTexture(THREE, image, spec) {
  if (spec.id !== 'western-us') return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(1536, image.width);
  canvas.height = Math.round(image.height * canvas.width / image.width);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const mask = connectedOceanCoverage(pixels.data, canvas.width, canvas.height, spec.bounds);
  for (let i = 0; i < mask.coverage.length; i++) {
    pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = mask.coverage[i];
    pixels.data[i * 4 + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return { texture, state: { width: mask.width, height: mask.height, oceanPixels: mask.oceanPixels, featherPixels: mask.featherPixels, sourcePreserved: true, inlandLakesPreserved: true } };
}

export function geographicNormal(latitude, longitude) {
  const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)];
}

function sphericalPatch(THREE, bounds, radius) {
  const [west, south, east, north] = bounds;
  // At least 64 segments also keeps the close-up surface smooth at low altitude.
  const nx = Math.max(64, Math.ceil((east - west) * 6));
  const ny = Math.max(64, Math.ceil((north - south) * 6));
  const positions = [], uv = [], indices = [];
  for (let y = 0; y <= ny; y++) {
    for (let x = 0; x <= nx; x++) {
      const normal = geographicNormal(south + (north - south) * y / ny, west + (east - west) * x / nx);
      positions.push(...normal.map(v => v * radius));
      uv.push(x / nx, y / ny);
      if (y < ny && x < nx) {
        const a = y * (nx + 1) + x, b = a + nx + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export async function createNevadaTerrain(THREE, renderer, earthMesh, radius) {
  const group = new THREE.Group();
  group.name = 'Nevada georeferenced imagery';
  earthMesh.add(group);
  const failures = [], layers = [];
  await Promise.all(NEVADA_LEVELS.map(async (spec, index) => {
    try {
      const map = await new THREE.TextureLoader().loadAsync(`assets/intro-nevada-v1/terrain/${spec.file}`);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
      const oceanCoverage = createOceanCoverageTexture(THREE, map.image, spec);
      const material = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
      material.onBeforeCompile = shader => {
        if (oceanCoverage) {
          shader.uniforms.uOceanCoverage = { value: oceanCoverage.texture };
          shader.fragmentShader = 'uniform sampler2D uOceanCoverage;\n' + shader.fragmentShader;
        }
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
          #include <map_fragment>
          vec2 edgeDistance = min(vMapUv, vec2(1.0) - vMapUv);
          float feather = smoothstep(0.0, 0.12, min(edgeDistance.x, edgeDistance.y));
          diffuseColor.a *= feather;
          ${oceanCoverage ? 'diffuseColor.a *= texture2D(uOceanCoverage, vMapUv).r;' : ''}
          ${regionalCoverageShader(spec)}
        `);
      };
      material.customProgramCacheKey = () => `nevada-complete-regional-v4-${spec.id}`;
      const mesh = new THREE.Mesh(sphericalPatch(THREE, spec.bounds, radius + 0.00002 * (index + 1)), material);
      mesh.name = spec.id;
      mesh.renderOrder = 2 + index;
      mesh.visible = false;
      group.add(mesh);
      layers.push({ spec, mesh, map, oceanCoverage });
    } catch (error) {
      const failure = { id: spec.id, message: String(error?.message || error) };
      failures.push(failure);
      console.error('Nevada imagery failed to load', failure);
    }
  }));
  layers.sort((a, b) => NEVADA_LEVELS.indexOf(a.spec) - NEVADA_LEVELS.indexOf(b.spec));
  let altitudeKm = null, lighting = nevadaLightingAt(0);
  return {
    update(nextAltitudeKm, sceneTime = 0) {
      altitudeKm = nextAltitudeKm;
      lighting = nevadaLightingAt(sceneTime);
      for (const { spec, mesh } of layers) {
        const opacity = eased(Math.log(spec.enterKm / altitudeKm) / Math.log(spec.enterKm / spec.fullKm));
        mesh.material.opacity = opacity;
        mesh.material.color.setRGB(...lighting.linearMultiplier);
        mesh.visible = opacity > 0.001;
      }
    },
    getState() {
      return {
        ready: layers.length === NEVADA_LEVELS.length,
        source: 'USGS National Map and Esri World Imagery, geographically registered',
        attribution: 'USDA, USGS; Esri, Vantor, Earthstar Geographics, GIS User Community',
        coverageGaps: 'Regional NoData mosaic replaced with a complete export at identical geographic bounds',
        oceanCoverage: layers.find(layer => layer.oceanCoverage)?.oceanCoverage.state || null,
        projection: 'EPSG:4326',
        target: NEVADA_TARGET,
        altitudeKm,
        lighting: { ...lighting, linearMultiplier: [...lighting.linearMultiplier] },
        activeLevel: [...layers].reverse().find(layer => layer.mesh.material.opacity > 0.5)?.spec.id || 'global-earth',
        levels: layers.map(({ spec, mesh }) => ({ id: spec.id, opacity: mesh.material.opacity, width: spec.width, height: spec.height, bounds: spec.bounds })),
        failures,
      };
    },
  };
}
