// Prepared by: Codex.
// Real, nested USGS 3DEP elevation around the provisional Nevada anchor.
// XY follows the authored town: east/right, south/down. Z is up.
// The town itself is an authored drawing, not a surveyed USGS settlement.
const ASSET_ROOT = new URL('./assets/intro-nevada-v1/terrain/', import.meta.url);
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

export async function createRegionalRelief(THREE, options = {}) {
  const center = options.center || [512, 384];
  const metresPerUnit = options.metresPerUnit || 2;
  if (!Array.isArray(center) || center.length !== 2 || !center.every(Number.isFinite) || !(metresPerUnit > 0)) {
    throw new TypeError('Regional relief requires a finite XY center and positive metresPerUnit.');
  }
  async function loadElevation(file) {
    const response = await fetch(new URL(file, ASSET_ROOT));
    if (!response.ok) throw new Error(`Nevada elevation unavailable: ${file}, HTTP ${response.status}`);
    const data = await response.json();
    if (data.rows !== data.values.length || data.values.some(row => row.length !== data.cols || row.some(value => !Number.isFinite(value)))) {
      throw new Error(`Nevada elevation grid ${file} is incomplete or contains invalid values.`);
    }
    return data;
  }
  const [dem, horizon] = await Promise.all([
    loadElevation('nevada-elevation.json'),
    options.horizon === false ? null : loadElevation('nevada-horizon-elevation.json'),
  ]);
  const [west, south, east, north] = dem.bounds;
  const anchor = dem.anchor;
  const metresPerLongitude = 111320 * Math.cos(anchor.latitude * Math.PI / 180);
  const metresPerLatitude = 111132;
  const toX = longitude => center[0] + (longitude - anchor.longitude) * metresPerLongitude / metresPerUnit;
  const toY = latitude => center[1] + (anchor.latitude - latitude) * metresPerLatitude / metresPerUnit;
  const bounds = [toX(west), toY(north), toX(east), toY(south)];
  const horizonBounds = horizon ? [toX(horizon.bounds[0]), toY(horizon.bounds[3]), toX(horizon.bounds[2]), toY(horizon.bounds[1])] : bounds;
  const regionalImageBounds = horizon?.regionalImage?.bounds || [-121.00062787777313, 35, -111.99937212222687, 42];
  const regionalWorldBounds = [toX(regionalImageBounds[0]), toY(regionalImageBounds[3]), toX(regionalImageBounds[2]), toY(regionalImageBounds[1])];
  const resolutionApron = 3000 / metresPerUnit;
  const outsideInner = (x, y) => Math.hypot(Math.max(bounds[0] - x, 0, x - bounds[2]), Math.max(bounds[1] - y, 0, y - bounds[3]));
  function sampleGrid(grid, x, y) {
    const [west, south, east, north] = grid.bounds;
    const longitude = anchor.longitude + (x - center[0]) * metresPerUnit / metresPerLongitude;
    const latitude = anchor.latitude - (y - center[1]) * metresPerUnit / metresPerLatitude;
    // exportImage bounds describe pixel edges; these values are pixel centres.
    const u = clamp((longitude - west) / (east - west) * grid.cols - .5, 0, grid.cols - 1);
    const v = clamp((north - latitude) / (north - south) * grid.rows - .5, 0, grid.rows - 1);
    const x0 = Math.floor(u), y0 = Math.floor(v), x1 = Math.min(x0 + 1, grid.cols - 1), y1 = Math.min(y0 + 1, grid.rows - 1);
    const a = grid.values[y0][x0] * (1 - (u - x0)) + grid.values[y0][x1] * (u - x0);
    const b = grid.values[y1][x0] * (1 - (u - x0)) + grid.values[y1][x1] * (u - x0);
    return a * (1 - (v - y0)) + b * (v - y0);
  }
  function elevationAt(x, y) {
    const inner = sampleGrid(dem, x, y);
    const distance = outsideInner(x, y);
    if (!horizon || distance === 0) return inner;
    const blend = smooth(distance / resolutionApron);
    return inner * (1 - blend) + sampleGrid(horizon, x, y) * blend;
  }
  const baseElevation = elevationAt(center[0], center[1]);
  const town = { xMin: 0, xMax: 1024, yMin: 0, yMax: 768, featherUnits: 1000, groundZ: -.2 };
  function surfaceHeightAt(x, y) {
    const dx = Math.max(town.xMin - x, 0, x - town.xMax);
    const dy = Math.max(town.yMin - y, 0, y - town.yMax);
    const registrationWeight = smooth(Math.hypot(dx, dy) / town.featherUnits);
    return (elevationAt(x, y) - baseElevation) / metresPerUnit * registrationWeight + town.groundZ;
  }
  // Add exact town-edge vertices so no coarse triangle cuts through its roads.
  const gridAxis = (min, max, count, extra) => [...new Set([
    ...Array.from({ length: count + 1 }, (_, i) => min + (max - min) * i / count), ...extra,
  ])].filter(value => value >= min && value <= max).sort((a, b) => a - b);
  const innerXs = gridAxis(bounds[0], bounds[2], dem.cols, [-500, -250, 0, 256, 512, 768, 1024, 1274, 1524]);
  const innerYs = gridAxis(bounds[1], bounds[3], dem.rows, [-500, -250, 0, 192, 384, 576, 768, 1018, 1268]);
  // Existing inner coordinates are kept exactly. Only outer axis values are
  // added, making one crack-free nested mesh rather than overlapping tiles.
  const extendAxis = (inner, low, high) => !horizon ? inner : [...new Set([
    ...inner,
    ...gridAxis(low, high, 64, []).filter(value => value < inner[0] || value > inner[inner.length - 1]),
    inner[0] - resolutionApron, inner[inner.length - 1] + resolutionApron,
  ])].sort((a, b) => a - b);
  const xs = extendAxis(innerXs, horizonBounds[0], horizonBounds[2]);
  const ys = extendAxis(innerYs, horizonBounds[1], horizonBounds[3]);
  const positions = [], colours = [], uvs = [], regionalUvs = [], photoBlends = [], indices = [], townWeights = [], reliefWeights = [];
  // Exact base used by the untouched source ground painter, toga-render.js:31.
  // Stay on its warm earth palette instead of introducing a gray terrain island.
  const lowColour = new THREE.Color('#b7a68a'), highColour = new THREE.Color('#887b65');
  const tint = new THREE.Color();
  for (let row = 0; row < ys.length; row++) {
    for (let col = 0; col < xs.length; col++) {
      const x = xs[col], y = ys[row];
      const townDistance = Math.hypot(Math.max(-x, 0, x - 1024), Math.max(-y, 0, y - 768));
      const reliefWeight = smooth(townDistance / 1000);
      positions.push(x, y, surfaceHeightAt(x, y));
      uvs.push((x - bounds[0]) / (bounds[2] - bounds[0]), 1 - (y - bounds[1]) / (bounds[3] - bounds[1]));
      regionalUvs.push((x - regionalWorldBounds[0]) / (regionalWorldBounds[2] - regionalWorldBounds[0]), 1 - (y - regionalWorldBounds[1]) / (regionalWorldBounds[3] - regionalWorldBounds[1]));
      photoBlends.push(horizon ? smooth(outsideInner(x, y) / resolutionApron) : 0);
      // Match the source ground at the edge, then quickly recover photographic
      // structure. A kilometre-wide solid-color apron erased local detail.
      townWeights.push(1 - smooth(townDistance / 180));
      reliefWeights.push(reliefWeight);
      tint.copy(lowColour).lerp(highColour, smooth((elevationAt(x, y) - 1750) / 1300) * reliefWeight);
      colours.push(tint.r, tint.g, tint.b);
      if (row < ys.length - 1 && col < xs.length - 1) {
        const a = row * xs.length + col, b = a + xs.length;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('reliefRegionalUv', new THREE.Float32BufferAttribute(regionalUvs, 2));
  geometry.setAttribute('reliefPhotoBlend', new THREE.Float32BufferAttribute(photoBlends, 1));
  geometry.setAttribute('reliefTownWeight', new THREE.Float32BufferAttribute(townWeights, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  // Relief shading is baked from the measured surface normals, not a second
  // dynamic sun. A level plane is exactly 1, matching the town ground plane.
  const measuredNormals = geometry.attributes.normal.array;
  const illumination = new THREE.Vector3(-.55, -.35, .76).normalize();
  const lightOnFlat = illumination.z;
  const vertexColours = geometry.attributes.color.array;
  for (let i = 0; i < reliefWeights.length; i++) {
    const dot = Math.max(0, measuredNormals[i * 3] * illumination.x + measuredNormals[i * 3 + 1] * illumination.y + measuredNormals[i * 3 + 2] * illumination.z);
    const shade = clamp(1 + (dot - lightOnFlat) * .70 * reliefWeights[i], .60, 1.13);
    for (let channel = 0; channel < 3; channel++) vertexColours[i * 3 + channel] *= shade;
  }
  const styleUniform = { value: 1 }; // 0: registered photo, 1: sparse authored-town palette.
  const townBlendUniform = { value: 1 };
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false });
  let texture = null, regionalTexture = null, textureError = null;
  if (options.texture !== false) {
    try {
      texture = await new THREE.TextureLoader().loadAsync(new URL('nevada-desert-usgs.jpg', ASSET_ROOT).href);
      texture.colorSpace = THREE.SRGBColorSpace;
      if (horizon) {
        regionalTexture = await new THREE.TextureLoader().loadAsync(new URL('nevada-regional-complete.jpg', ASSET_ROOT).href);
        regionalTexture.colorSpace = THREE.SRGBColorSpace;
      }
      material.map = texture;
      material.onBeforeCompile = shader => {
        shader.uniforms.reliefStyleBlend = styleUniform;
        shader.uniforms.reliefTownBlend = townBlendUniform;
        shader.uniforms.reliefRegionalMap = { value: regionalTexture || texture };
        shader.vertexShader = 'attribute float reliefTownWeight; varying float vReliefTownWeight; attribute vec2 reliefRegionalUv; varying vec2 vReliefRegionalUv; attribute float reliefPhotoBlend; varying float vReliefPhotoBlend;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvReliefTownWeight = reliefTownWeight; vReliefRegionalUv = reliefRegionalUv; vReliefPhotoBlend = reliefPhotoBlend;');
        shader.fragmentShader = 'uniform float reliefStyleBlend; uniform float reliefTownBlend; uniform sampler2D reliefRegionalMap; varying float vReliefTownWeight; varying vec2 vReliefRegionalUv; varying float vReliefPhotoBlend;\n' + shader.fragmentShader;
        const blend = '(1.0 - (1.0 - reliefStyleBlend) * (1.0 - vReliefTownWeight * reliefTownBlend))';
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
          #ifdef USE_MAP
            vec4 closePhoto = texture2D(map, vMapUv);
            vec4 regionalPhoto = texture2D(reliefRegionalMap, vReliefRegionalUv);
            vec4 sampledDiffuseColor = mix(closePhoto, regionalPhoto, vReliefPhotoBlend);
            vec4 paintedRelief = vec4(1.0);
            #if defined(USE_COLOR_ALPHA)
              paintedRelief = vColor;
            #elif defined(USE_COLOR)
              paintedRelief.rgb = vColor;
            #endif
            // Keep measured image detail through the palette change. A solid
            // tint erased the relief and made the original model look simpler.
            float detail = clamp(dot(sampledDiffuseColor.rgb, vec3(.2126,.7152,.0722)) / .31, .64, 1.30);
            paintedRelief.rgb *= mix(detail, 1.0, vReliefTownWeight * reliefTownBlend);
            diffuseColor *= mix(sampledDiffuseColor, paintedRelief, ${blend});
          #endif
        `).replace('#include <color_fragment>', `
          #ifndef USE_MAP
            #if defined(USE_COLOR_ALPHA)
              diffuseColor *= vColor;
            #elif defined(USE_COLOR)
              diffuseColor.rgb *= vColor;
            #endif
          #endif
        `);
      };
      material.customProgramCacheKey = () => 'nevada-3dep-detail-preserved-flat-v4';
      material.needsUpdate = true;
    } catch (error) { textureError = String(error?.message || error); }
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'USGS Nevada nested 52 km detail and 220 km horizon';
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.name = 'Real Nevada regional relief';
  group.add(mesh);
  let hour = 16;
  // Sample the very triangles on screen, not a different bilinear surface.
  // Road ribbons otherwise alternate between floating and being buried.
  function sampleRenderedSurface(x, y) {
    const cell = (axis, value) => {
      let low = 0, high = axis.length - 1;
      while (high - low > 1) { const mid = (low + high) >> 1; if (axis[mid] > value) high = mid; else low = mid; }
      return Math.min(low, axis.length - 2);
    };
    const col = cell(xs, x), row = cell(ys, y);
    const u = clamp((x - xs[col]) / (xs[col + 1] - xs[col]));
    const v = clamp((y - ys[row]) / (ys[row + 1] - ys[row]));
    const z = (dx, dy) => positions[((row + dy) * xs.length + col + dx) * 3 + 2];
    return u + v <= 1 ? z(0, 0) + (z(1, 0) - z(0, 0)) * u + (z(0, 1) - z(0, 0)) * v
      : z(1, 1) + (z(0, 1) - z(1, 1)) * (1 - u) + (z(1, 0) - z(1, 1)) * (1 - v);
  }
  let groundLinear = [1, 1, 1];
  function updateLighting(nextHour, sharedGroundLinear) {
    hour = clamp(Number.isFinite(nextHour) ? nextHour : 16, 0, 24);
    if (Array.isArray(sharedGroundLinear) && sharedGroundLinear.length === 3 && sharedGroundLinear.every(value => Number.isFinite(value) && value >= 0)) {
      groundLinear = [...sharedGroundLinear];
    } else {
      // Same fallback as the town. Passing its returned groundLinear is preferred.
      const progress = clamp((hour - 18.35) / 3.15), night = smooth(progress);
      const start = [.54, .46, .43], end = [.009, .014, .025];
      const dusk = Math.sin(Math.PI * progress) ** 2;
      const tint = [1 + .42 * dusk, 1 - .07 * dusk, 1 - .48 * dusk];
      groundLinear = start.map((v, i) => Math.exp(Math.log(v) * (1 - night) + Math.log(end[i]) * night) * tint[i]);
    }
    material.color.setRGB(...groundLinear);
  }
  return {
    group,
    updateLighting,
    setStyleBlend(value) { styleUniform.value = clamp(value); },
    setTownBlend(value) { townBlendUniform.value = clamp(value); },
    sampleSurface(x, y) { return surfaceHeightAt(x, y); },
    sampleRenderedSurface,
    getState() {
      return {
        ready: true, source: dem.source, attribution: dem.attribution,
        anchor: { ...anchor, elevationMetres: baseElevation }, bounds: [...dem.bounds], worldBounds: [...bounds],
        metresPerUnit, verticalExaggeration: 1, rows: dem.rows, cols: dem.cols,
        vertices: positions.length / 3, triangles: indices.length / 3,
        horizon: horizon ? { bounds: [...horizon.bounds], worldBounds: [...horizonBounds], rows: horizon.rows, cols: horizon.cols, meshOuterIntervals: 64, extentMetres: 220000, resolutionFeatherMetres: 3000, innerGridPreserved: true, regionalImageBounds: [...regionalImageBounds], textureReady: Boolean(regionalTexture) } : null,
        hour, groundLinear: [...groundLinear], styleBlend: styleUniform.value, townBlend: townBlendUniform.value,
        townPalette: '#b7a68a', townPaletteApron: [0, 180], photoDetailPreserved: true, lighting: 'shared linear ground multiplier; measured normal shading baked once',
        textureReady: Boolean(texture), textureError,
        registration: { ...town, note: 'Authored town flattened to its existing zero-height plane; 1000-unit feather to real surrounding 3DEP elevations. Fictional town location is provisional, not a surveyed settlement.' },
      };
    },
    dispose() { group.remove(mesh); geometry.dispose(); material.dispose(); texture?.dispose(); regionalTexture?.dispose(); },
  };
}
