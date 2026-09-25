/* Prepared by: Codex.
 * GOAL: project the saved TOGA town and its actual building-029 roof in true
 * perspective, without changing a single saved coordinate or source asset.
 * Camera, sky, timing and visual acceptance belong to intro-nevada.js.
 * Original civilian/prop faces are retained. Airfield facades, roof seams,
 * industrial details and water towers follow toga-render.js's source formulas.
 * Its screen-space rods become thin solid rods at the same source endpoints.
 */

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const linear = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const srgb = value => value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055;

/** Exact saved coordinates: X/Y ground, Z up. No camera or persistence writes.
 * options.ground=false permits geometry-only Node validation.
 */
export function createTownPerspective(THREE, world, options = {}) {
  const Civil = options.civilian || globalThis.TogaCivilian;
  const Assets = options.assets || globalThis.TogaAssets;
  const SourceRenderer = options.renderer || globalThis.TogaRenderer;
  if (!Civil || !world?.geometry || !world?.buildings) throw new Error('Original TOGA geometry modules are required.');
  const group = new THREE.Group();
  group.name = 'Original TOGA town, perspective projection';
  const positions = [], normals = [], indices = [], records = [], lamps = [];
  const sourceCounts = { buildings: world.buildings.length, exactCivilianBuildings: 0, restoredAirfieldBuildings: 0, restoredGenericBuildings: 0, simplifiedDistantBuildings: 0, exactProps: 0, restoredWaterTowers: 0, sourceRods: 0, sourceCylinders: 0, sourceFacadeWindows: 0, faces: 0 };
  const restoredIds = [], airportFacades = [];
  const G = world.geometry;
  const school = world.buildings.find(b => b.id === 'building-029');
  if (!school || Civil.role(school) !== 'reference-school') throw new Error('Exact school building-029 is required.');
  const worldPoint = (b, point) => G.point(b, [b.x + point[0], b.y + point[1], point[2]]);

  function normalOf(points) {
    const a = points[1].map((v, i) => v - points[0][i]);
    const b = points[2].map((v, i) => v - points[0][i]);
    const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const len = Math.hypot(...n) || 1;
    return n.map(v => v / len);
  }

  function face(points, base, day = base, glow = false, source = null) {
    if (points.length < 3) return;
    const n = normalOf(points);
    if (Math.hypot(...n) < .1) return;
    const dominant = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
    const axes = [0, 1, 2].filter(i => i !== dominant);
    const contour = points.map(p => new THREE.Vector2(p[axes[0]], p[axes[1]]));
    const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
    if (!triangles.length) return;
    const first = positions.length / 3;
    for (const point of points) { positions.push(...point); normals.push(...n); }
    for (const tri of triangles) {
      const tn = normalOf(tri.map(i => points[i]));
      if (tn.reduce((v, x, i) => v + x * n[i], 0) < 0) [tri[1], tri[2]] = [tri[2], tri[1]];
      indices.push(...tri.map(i => first + i));
    }
    records.push({ first, count: points.length, base, day, n, glow, source });
    sourceCounts.faces++;
  }

  function box(emit, x, y, z, w, d, h, color, top = color) {
    const low = [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]];
    const high = low.map(p => [p[0], p[1], z + h]);
    for (let i = 0; i < 4; i++) emit([low[i], low[(i + 1) % 4], high[(i + 1) % 4], high[i]], color);
    emit(high, top);
  }

  // Source rods were strokes measured in town units. A narrow octagonal solid
  // retains those endpoints and widths in perspective without screen-size tricks.
  function rod(emit, a, b, width, color) {
    const axis = b.map((v, i) => v - a[i]), length = Math.hypot(...axis);
    if (length < 1e-8 || width <= 0) return;
    const direction = axis.map(v => v / length);
    const helper = Math.abs(direction[2]) < .9 ? [0, 0, 1] : [0, 1, 0];
    const u = [direction[1] * helper[2] - direction[2] * helper[1], direction[2] * helper[0] - direction[0] * helper[2], direction[0] * helper[1] - direction[1] * helper[0]];
    const ul = Math.hypot(...u); for (let i = 0; i < 3; i++) u[i] /= ul;
    const v = [direction[1] * u[2] - direction[2] * u[1], direction[2] * u[0] - direction[0] * u[2], direction[0] * u[1] - direction[1] * u[0]];
    const ring = center => Array.from({ length: 8 }, (_, i) => center.map((p, k) => p + width / 2 * (Math.cos(i * Math.PI / 4) * u[k] + Math.sin(i * Math.PI / 4) * v[k])));
    const low = ring(a), high = ring(b);
    for (let i = 0; i < 8; i++) emit([low[i], low[(i + 1) % 8], high[(i + 1) % 8], high[i]], color);
    emit([...low].reverse(), color); emit(high, color);
    sourceCounts.sourceRods++;
  }

  function cylinder(emit, x, y, radius, z, height, color) {
    const circle = (count, elevation) => Array.from({ length: count }, (_, i) => [x + Math.cos(i * Math.PI * 2 / count) * radius, y + Math.sin(i * Math.PI * 2 / count) * radius, elevation]);
    const low = circle(24, z), high = circle(24, z + height);
    for (let i = 0; i < 24; i++) emit([low[i], low[(i + 1) % 24], high[(i + 1) % 24], high[i]], color);
    // The source cap uses 32 points, independently of the 24 wall segments.
    emit(circle(32, z + height), color);
    sourceCounts.sourceCylinders++;
  }

  function airframe(b) {
    const { w, d } = b;
    const facades = [{ o: [0, 0], u: [1, 0], n: [0, -1], span: w }, { o: [w, 0], u: [0, 1], n: [1, 0], span: d }, { o: [w, d], u: [-1, 0], n: [0, 1], span: w }, { o: [0, d], u: [0, -1], n: [-1, 0], span: d }];
    const pavement = world.roads.filter(r => r.kind === 'runway' || r.kind === 'apron');
    for (const f of facades) {
      const p = worldPoint(b, [f.o[0] + f.u[0] * f.span / 2 + f.n[0] * 5, f.o[1] + f.u[1] * f.span / 2 + f.n[1] * 5, 0]);
      f.distance = G.nearest(pavement, p)?.distance ?? Infinity;
    }
    const f = facades.sort((a, b) => a.distance - b.distance)[0];
    airportFacades.push({ id: b.id, normal: [...f.n], span: f.span, distanceToPavement: f.distance });
    return { ...f, p: (u, v, z = 0) => [f.o[0] + f.u[0] * u + f.n[0] * v, f.o[1] + f.u[1] * u + f.n[1] * v, z] };
  }

  const airportRoles = { hangar: 'hangar', 'building-084': 'hangar', 'building-085': 'hangar', 'building-083': 'workshop', 'building-001': 'operations', 'building-002': 'workshop', 'building-003': 'operations' };
  for (const [buildingIndex, b] of world.buildings.entries()) {
    if (Civil.role(b)) {
      const mesh = Civil.make(b, world.buildingProfile(b));
      for (const f of mesh.faces) face(f.points.map(p => worldPoint(b, p)), f.color, f.dayColor || f.color, f.glow, b.id);
      for (const lamp of mesh.lights || []) lamps.push({ ...lamp, position: worldPoint(b, [lamp.x, lamp.y, lamp.z]), owner: b.id });
      sourceCounts.exactCivilianBuildings++;
      continue;
    }
    // Original source formulas, adapted only from absolute building coordinates
    // to local coordinates. No replacement buildings or edited envelopes.
    const z = v => world.buildingZ ? world.buildingZ(b, v) : v;
    const emit = (pts, color, glow = false) => face(pts.map(p => worldPoint(b, [p[0], p[1], z(p[2])])), color, color, glow, b.id);
    const { w, d, h } = b, role = airportRoles[b.id];
    if (role) {
      const f = airframe(b);
      const metal = role === 'operations' ? [167, 157, 128] : [143, 151, 143];
      const roof = [153, 160, 151], eave = Math.max(2, h - 1.5), ridge = h + .7;
      const corners = [[0, 0], [w, 0], [w, d], [0, d]];
      const facadeNormals = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      for (let i = 0; i < 4; i++) {
        const p = corners[i], q = corners[(i + 1) % 4], n = facadeNormals[i], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        emit([[...p, 0], [...q, 0], [...q, eave], [...p, eave]], metal);
        if (role !== 'operations') for (let u = 1; u < len; u += 1.25) {
          const x = p[0] + (q[0] - p[0]) * u / len, y = p[1] + (q[1] - p[1]) * u / len;
          rod(emit, [x, y, .4], [x, y, eave - .15], .1, [124, 136, 128]);
        }
        const front = Math.abs(n[0] - f.n[0]) + Math.abs(n[1] - f.n[1]) < .1;
        if (front && role !== 'operations') {
          const doorWidth = f.span * .82, left = (f.span - doorWidth) / 2, top = eave * .88;
          emit([f.p(left, .08, .15), f.p(left + doorWidth, .08, .15), f.p(left + doorWidth, .08, top), f.p(left, .08, top)], [70, 82, 77]);
          for (let k = 0; k < 4; k++) {
            const x = left + k * doorWidth / 4, panelWidth = doorWidth / 4 - .16;
            emit([f.p(x, .12, .2), f.p(x + panelWidth, .12, .2), f.p(x + panelWidth, .12, top - .15), f.p(x, .12, top - .15)], [130 + k % 2 * 6, 140 + k % 2 * 6, 132]);
            for (let u = x + .4; u < x + panelWidth; u += 1) rod(emit, f.p(u, .15, .4), f.p(u, .15, top - .3), .09, [109, 122, 114]);
            emit([f.p(x + .3, .2, top * .62), f.p(x + panelWidth - .3, .2, top * .62), f.p(x + panelWidth - .3, .2, top * .82), f.p(x + .3, .2, top * .82)], [63, 83, 80]);
            sourceCounts.sourceFacadeWindows++;
          }
          rod(emit, f.p(left - .8, .25, top + .3), f.p(left + doorWidth + .8, .25, top + .3), .25, [87, 101, 97]);
        } else for (let u = 2; u < len - 2; u += 4.5) {
          const pt = (along, height) => [p[0] + (q[0] - p[0]) * along / len + n[0] * .1, p[1] + (q[1] - p[1]) * along / len + n[1] * .1, height];
          emit([pt(u, eave * .53), pt(u + 1.6, eave * .53), pt(u + 1.6, eave * .8), pt(u, eave * .8)], [62, 80, 76], role === 'operations');
          sourceCounts.sourceFacadeWindows++;
        }
      }
      if (role === 'operations') {
        box(emit, -.35, -.35, eave, w + .7, d + .7, .45, roof);
        box(emit, w * .7, d * .35, eave + .45, 2.2, 2, .9, [118, 127, 116]);
      } else {
        emit([[0, 0, eave], [w, 0, eave], [w / 2, 0, ridge]], metal);
        emit([[w, d, eave], [0, d, eave], [w / 2, d, ridge]], metal);
        emit([[-.3, -.3, eave], [w / 2, -.3, ridge], [w / 2, d + .3, ridge], [-.3, d + .3, eave]], roof);
        emit([[w / 2, -.3, ridge], [w + .3, -.3, eave], [w + .3, d + .3, eave], [w / 2, d + .3, ridge]], roof);
        for (let v = .8; v < d; v += 1.35) {
          rod(emit, [0, v, eave + .06], [w / 2, v, ridge + .06], .1, [127, 140, 130]);
          rod(emit, [w / 2, v, ridge + .06], [w, v, eave + .06], .1, [127, 140, 130]);
        }
        rod(emit, [w / 2, 0, ridge + .12], [w / 2, d, ridge + .12], .32, [166, 172, 158]);
      }
      sourceCounts.restoredAirfieldBuildings++;
    } else {
      const roof = b.type === 'house' ? [151 + buildingIndex % 4 * 8, 137 + buildingIndex % 3 * 8, 108 + buildingIndex % 5 * 6] : b.type === 'factory' ? [117, 123, 114] : [147, 154, 146];
      box(emit, 0, 0, 0, w, d, h, [174, 168, 144]);
      box(emit, -.6, -.6, h, w + 1.2, d + 1.2, .7, roof);
      if (b.type === 'house') {
        emit([[-.8, -.8, h + 1], [w / 2, -.8, h + 4], [w / 2, d + .8, h + 4], [-.8, d + .8, h + 1]], roof);
        emit([[w / 2, -.8, h + 4], [w + .8, -.8, h + 1], [w + .8, d + .8, h + 1], [w / 2, d + .8, h + 4]], roof);
        for (let y = 2; y < d; y += 2.6) rod(emit, [0, y, h + 1.2], [w / 2, y, h + 4.2], .12, [130, 122, 100]);
        box(emit, w * .73, 2, h + 1, 1.8, 2, 2.6, [137, 122, 101]);
      } else {
        for (let x = 1; x < w; x += 2) rod(emit, [x, 0, h + 1], [x, d, h + 1], .18, [122, 132, 121]);
        box(emit, w * .65, 2, h + 1, Math.min(3, w * .2), 3, 1.8, [120, 128, 122]);
      }
      for (let x = 2; x < w - 2; x += 5) {
        emit([[x, d + .2, 2], [x + 2, d + .2, 2], [x + 2, d + .2, h - 1], [x, d + .2, h - 1]], [57, 77, 74], true);
        sourceCounts.sourceFacadeWindows++;
      }
      if (b.type === 'factory') for (let k = 0; k < 3; k++) {
        cylinder(emit, 4 + k * 8, 8, 1.7, h, 16 + k * 2, [131, 131, 117]);
        cylinder(emit, 4 + k * 8, 8, 1.8, h + 15 + k * 2, 1.2, [59, 67, 61]);
      }
      sourceCounts.restoredGenericBuildings++;
    }
    restoredIds.push(b.id);
  }

  // Tower bracing, tank, cone and ladder are copied from toga-render.js. They
  // were absent from the earlier adapter, although present in the saved town.
  for (const [index, t] of (world.towers || []).entries()) {
    const emit = (pts, color) => face(pts, color, color, false, t.id || `water-tower-${index}`);
    const feet = [[-6, -6], [6, -6], [6, 6], [-6, 6]];
    for (let i = 0; i < 4; i++) {
      const a = feet[i], b = feet[(i + 1) % 4];
      rod(emit, [t.x + a[0], t.y + a[1], 0], [t.x + a[0] * .75, t.y + a[1] * .75, t.h - 9], .8, [106, 117, 112]);
      rod(emit, [t.x + a[0], t.y + a[1], 2], [t.x + b[0] * .75, t.y + b[1] * .75, t.h - 11], .35, [135, 143, 130]);
      rod(emit, [t.x + a[0] * .75, t.y + a[1] * .75, t.h - 11], [t.x + b[0], t.y + b[1], 2], .35, [135, 143, 130]);
    }
    cylinder(emit, t.x, t.y, t.r, t.h - 13, 12, [150, 161, 150]);
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12, b = (i + 1) * Math.PI / 12;
      emit([[t.x, t.y, t.h + 2], [t.x + Math.cos(a) * t.r, t.y + Math.sin(a) * t.r, t.h], [t.x + Math.cos(b) * t.r, t.y + Math.sin(b) * t.r, t.h]], [164, 173, 159]);
    }
    for (let z = 1; z < t.h; z += 2) rod(emit, [t.x + t.r, t.y - 1, z], [t.x + t.r, t.y + 1, z], .2, [166, 168, 148]);
    rod(emit, [t.x + t.r, t.y - 1, 0], [t.x + t.r, t.y - 1, t.h], .3, [166, 168, 148]);
    rod(emit, [t.x + t.r, t.y + 1, 0], [t.x + t.r, t.y + 1, t.h], .3, [166, 168, 148]);
    sourceCounts.restoredWaterTowers++;
  }

  if (Assets) for (const prop of world.props || []) {
    if (!Assets.spec(prop.type)) continue;
    const angle = prop.angle || 0, c = Math.cos(angle), s = Math.sin(angle), scale = prop.scale || 1;
    const transform = p => [prop.x + (p[0] * c - p[1] * s) * scale, prop.y + (p[0] * s + p[1] * c) * scale, p[2] * scale];
    for (const f of Assets.mesh(prop.type, 0, angle)) face(f.points.map(transform), f.color, f.color, false, prop.id);
    sourceCounts.exactProps++;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  const colors = new Float32Array(positions.length);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
  const buildings = new THREE.Mesh(geometry, material);
  buildings.name = 'Original civilian, airfield, industrial and water-tower geometry';
  group.add(buildings);

  let groundTexture = null, groundMaterial = null, groundGeometry = null;
  const townBlend = { value: 1 };
  const terrainDatum = Math.min(...world.terrain.values);
  const terrainMaximum = Math.max(...world.terrain.values);
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  // The saved scalar field is relative art height, not surveyed metres. The old
  // renderer only painted this relief. This perspective adaptation exposes that
  // same stored field while holding its existing lots and roads at source Z=0.
  function terrainHeight(x, y) {
    let keep = 1;
    for (const b of world.buildings) {
      const p = G.point(b, [x, y], true);
      const dx = Math.max(b.x - p[0], 0, p[0] - b.x - b.w);
      const dy = Math.max(b.y - p[1], 0, p[1] - b.y - b.d);
      keep = Math.min(keep, smooth((Math.hypot(dx, dy) - 3) / 24));
      if (!keep) return -.01;
    }
    for (const r of world.roads) for (let i = 1; i < r.points.length; i++) {
      const distance = G.projectSegment([x, y], r.points[i - 1], r.points[i]).distance;
      keep = Math.min(keep, smooth((distance - r.width / 2 - 2) / 18));
      if (!keep) return -.01;
    }
    const edge = smooth(Math.min(x, y, world.W - x, world.H - y) / 65);
    return Math.max(0, world.terrainTools.sample(world.terrain, x, y) - terrainDatum) * keep * edge - .01;
  }
  if (options.ground !== false) {
    if (!SourceRenderer || typeof document === 'undefined') throw new Error('Original ground painter is required.');
    const painter = SourceRenderer.make(world);
    const ground = painter.ground;
    const ctx = ground.getContext('2d');
    // Same painted relief multiplier as toga-render.js, not displaced terrain.
    const relief = document.createElement('canvas');
    relief.width = 256; relief.height = 192;
    const rc = relief.getContext('2d'), T = world.terrainTools;
    for (let y = 0; y < 192; y++) for (let x = 0; x < 256; x++) {
      const wx = x * 4, wy = y * 4;
      const gx = (T.sample(world.terrain, wx + 8, wy) - T.sample(world.terrain, wx - 8, wy)) / 16;
      const gy = (T.sample(world.terrain, wx, wy + 8) - T.sample(world.terrain, wx, wy - 8)) / 16;
      const v = clamp(.96 - gx * .18 - gy * .22, .74, 1);
      rc.fillStyle = `rgb(${Math.round(v * 255)},${Math.round(v * 254)},${Math.round(v * 251)})`;
      rc.fillRect(x, y, 1, 1);
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(relief, 0, 0, ground.width, ground.height); ctx.restore();
    groundTexture = new THREE.CanvasTexture(ground);
    groundTexture.colorSpace = THREE.SRGBColorSpace;
    groundTexture.anisotropy = 4;
    const columns = 256, rows = 192, terrainPositions = [], terrainUV = [], terrainIndices = [];
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
      const wx = x / columns * world.W, wy = y / rows * world.H;
      terrainPositions.push(wx, wy, terrainHeight(wx, wy));
      terrainUV.push(x / columns, 1 - y / rows);
      if (x < columns && y < rows) {
        const a = y * (columns + 1) + x, b = a + 1, c = a + columns + 2, d = a + columns + 1;
        terrainIndices.push(a, b, c, a, c, d);
      }
    }
    groundGeometry = new THREE.BufferGeometry();
    groundGeometry.setAttribute('position', new THREE.Float32BufferAttribute(terrainPositions, 3));
    groundGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(terrainUV, 2));
    groundGeometry.setIndex(terrainIndices);
    groundGeometry.computeVertexNormals();
    groundMaterial = new THREE.MeshBasicMaterial({ map: groundTexture, toneMapped: false, transparent: true, alphaTest: .005 });
    groundMaterial.onBeforeCompile = shader => {
      shader.uniforms.townBlend = townBlend;
      shader.fragmentShader = 'uniform float townBlend;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `
        float edgeDistance = min(min(vMapUv.x, 1.0-vMapUv.x)*1024.0, min(vMapUv.y, 1.0-vMapUv.y)*768.0);
        diffuseColor.a *= smoothstep(0.0, 65.0, edgeDistance) * townBlend;
        #include <alphatest_fragment>
      `);
    };
    groundMaterial.customProgramCacheKey = () => 'town-edge-bridge-v1';
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.name = 'Original road and parcel paint on the saved height field';
    group.add(groundMesh);
  }

  const roofLocal = [school.w * .87, school.d * .58, school.h + .12];
  const roof = worldPoint(school, roofLocal);
  const schoolMesh = Civil.make(school, world.buildingProfile(school));
  const roofFace = schoolMesh.faces.find(f => f.normal[2] > .99 && f.points.every(p => Math.abs(p[2] - roofLocal[2]) < 1e-6) && roofLocal[0] >= Math.min(...f.points.map(p => p[0])) && roofLocal[0] <= Math.max(...f.points.map(p => p[0])) && roofLocal[1] >= Math.min(...f.points.map(p => p[1])) && roofLocal[1] <= Math.max(...f.points.map(p => p[1])));
  if (!roofFace) throw new Error('Clear roof anchor is not on the original tall school roof.');
  const roofMetadata = {
    anchor: roof, local: roofLocal, height: roof[2],
    outline: roofFace.points.map(p => worldPoint(school, p)),
    parapetTop: school.h + .40,
    outward: [-Math.sin(school.angle || 0), Math.cos(school.angle || 0), 0],
    existingFixtureBounds: { localMin: [school.w * .79, school.d * .52, school.h + .42], localMax: [school.w * .79 + .95, school.d * .52 + .72, school.h + .79] }
  };

  let lastHour = NaN, lightingState = null;
  function updateLighting(hour) {
    if (!Number.isFinite(hour)) throw new TypeError('Town lighting hour must be finite.');
    if (Math.abs(hour - lastHour) < .002) return lightingState;
    lastHour = hour;
    // Hold the exact day palette through the approach. Time compression starts
    // only after the rooftop camera looks skyward, controlled by the caller.
    const progress = clamp((hour - 16) / (21.5 - 16));
    const night = smooth(progress), day = 1 - smooth((progress - .12) / .74);
    const start = [1, 1, 1], end = [.009, .014, .025];
    const dusk = Math.sin(Math.PI * progress) ** 2;
    const duskTint = [1 + .42 * dusk, 1 - .07 * dusk, 1 - .48 * dusk];
    const groundLinear = progress === 0 ? [...start] : progress === 1 ? [...end] : start.map((v, i) => Math.exp(mix(Math.log(v), Math.log(end[i]), night)) * duskTint[i]);
    const ambient = groundLinear.map(srgb);
    // A soft directional component keeps the existing roof planes legible.
    // There are no added luminous roof surfaces, halos, or invented fixtures.
    const sun = [mix(-.74, -.22, night), mix(.48, .32, night), mix(.47, .92, night)], length = Math.hypot(...sun);
    const emission = smooth((progress - .24) / .60);
    for (const record of records) {
      const dot = Math.max(0, record.n.reduce((sum, v, i) => sum + v * sun[i], 0) / length);
      const rgb = record.base.map((v, i) => {
        const lit = mix(v, record.day[i], day) * ambient[i] * (.78 + .22 * dot);
        return linear(clamp((record.glow ? mix(lit, [168, 155, 112][i], emission) : lit) / 255));
      });
      for (let i = record.first; i < record.first + record.count; i++) colors.set(rgb, i * 3);
    }
    geometry.attributes.color.needsUpdate = true;
    if (groundMaterial) groundMaterial.color.setRGB(...groundLinear);
    lightingState = {
      hour, progress, day, night, ambient: [...ambient], groundLinear,
      phase: progress < .18 ? 'daylight' : progress < .55 ? 'warm-dusk' : progress < .82 ? 'blue-hour' : 'night',
      windowEmission: emission,
      mode: 'Cinematic time-compressed lighting; not astronomical solar time'
    };
    return lightingState;
  }
  updateLighting(16);

  return {
    group, buildings, school, roof, roofMetadata, lamps, updateLighting, terrainHeight,
    setBlend(value) { townBlend.value = clamp(value); material.transparent = townBlend.value < 1; material.opacity = townBlend.value; },
    getState: () => ({ ...sourceCounts, vertices: positions.length / 3, triangles: indices.length / 3, drawCalls: group.children.length, simplifiedIds: [], restoredIds: [...restoredIds], airportFacades: airportFacades.map(f => ({ ...f, normal: [...f.normal] })), lighting: lightingState, roof: [...roof], originalCoordinateSystem: 'X/Y ground; Z up', terrain: { source: 'Saved relative art heightfield, not surveyed metres', datum: terrainDatum, sourceRange: [terrainDatum, terrainMaximum], maximumRelief: terrainMaximum - terrainDatum, vertices: groundGeometry?.attributes.position.count || 0, treatment: 'Original heightfield exposed as a mesh; feathered to source Z=0 at saved lots and road corridors' }, limitations: ['Source screen-space rods use eight-sided solids of the original width.', 'Dynamic smoke, blinking tower beacons and road lamp light pools are not reproduced.'] }),
    dispose() { geometry.dispose(); material.dispose(); groundGeometry?.dispose(); groundMaterial?.dispose(); groundTexture?.dispose(); group.clear(); }
  };
}
