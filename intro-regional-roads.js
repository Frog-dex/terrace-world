/* Prepared by: Codex.
 * Continue only saved public-road exits into the surrounding Nevada terrain.
 * XY remains the authored east/right, south/down coordinate system, Z is up.
 * This is a reversible presentation layer: it never edits world or its save.
 */
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const PALETTE = { shoulder: '#c4c0b1', pavement: '#737c7e', marking: '#d7ca95' };

function publicExits(world) {
  const width = world.W || 1024, height = world.H || 768;
  const exits = [];
  for (const road of world.roads) {
    if (road.kind !== 'road' || !(road.width > 0) || road.points.length < 2) continue;
    for (const atStart of [true, false]) {
      const endpoint = road.points[atStart ? 0 : road.points.length - 1];
      const previous = road.points[atStart ? 1 : road.points.length - 2];
      const length = distance(previous, endpoint);
      if (!(length > 0)) continue;
      const tangent = endpoint.map((value, axis) => (value - previous[axis]) / length);
      const outside = endpoint[0] <= 0 && tangent[0] < 0 || endpoint[0] >= width && tangent[0] > 0 || endpoint[1] <= 0 && tangent[1] < 0 || endpoint[1] >= height && tangent[1] > 0;
      if (!outside) continue;
      // Reach inside the source's 65-unit feather so the original road does not
      // disappear before its extension starts. Never extend internal driveways.
      const overlap = Math.min(length, 115);
      exits.push({ id: `${road.id}:${atStart ? 'start' : 'end'}`, sourceId: road.id, atStart, width: road.width, endpoint: [...endpoint], tangent, overlap, start: endpoint.map((value, axis) => value - tangent[axis] * overlap) });
    }
  }
  return exits;
}

/** Deterministic, bounded beam search over gentle rural-road bends.
 * Longitudinal grades are checked at <= 2 world-unit intervals, not merely at
 * the control points. Invalid terrain is an error, never a silent flat fallback.
 */
function planRoute(exit, sample, { length, step, maxGrade, beamWidth }) {
  const initialAngle = Math.atan2(exit.tangent[1], exit.tangent[0]);
  const z = sample(...exit.endpoint);
  const root = { x: exit.endpoint[0], y: exit.endpoint[1], z, angle: initialAngle, cost: 0, parent: null, maxGrade: 0 };
  let beam = [root];
  const turn = Math.PI / 22.5; // 8 degrees per 80 m, minimum radius about 570 m.
  const count = Math.ceil(length / step);
  let completedSteps = 0;
  for (let i = 0; i < count; i++) {
    const candidates = [];
    for (const node of beam) for (const delta of i === 0 ? [0] : [-turn, -turn / 2, 0, turn / 2, turn]) {
      const angle = node.angle + delta;
      const deviation = angleDifference(angle, initialAngle);
      if (Math.abs(deviation) > Math.PI * .56) continue;
      const x = node.x + Math.cos(angle) * step, y = node.y + Math.sin(angle) * step;
      let previousZ = node.z, segmentGrade = 0, valid = true;
      const checks = Math.ceil(step / 2);
      for (let k = 1; k <= checks; k++) {
        const elevation = sample(node.x + (x - node.x) * k / checks, node.y + (y - node.y) * k / checks);
        segmentGrade = Math.max(segmentGrade, Math.abs(elevation - previousZ) / (step / checks));
        previousZ = elevation;
        if (segmentGrade > maxGrade) { valid = false; break; }
      }
      if (!valid) continue;
      const nx = -Math.sin(angle), ny = Math.cos(angle);
      const crossGrade = Math.abs(sample(x + nx * exit.width / 2, y + ny * exit.width / 2) - sample(x - nx * exit.width / 2, y - ny * exit.width / 2)) / exit.width;
      const cost = node.cost + .12 * (1 - Math.cos(deviation)) + .008 * (delta / turn) ** 2 + 3 * segmentGrade ** 2 + .9 * crossGrade ** 2;
      candidates.push({ x, y, z: previousZ, angle, cost, parent: node, maxGrade: Math.max(node.maxGrade, segmentGrade) });
    }
    if (!candidates.length) break;
    candidates.sort((a, b) => a.cost - b.cost);
    // Spatial/heading diversity is essential: a dozen almost-identical paths
    // cannot find a gentle pass around the same steep ridge.
    const buckets = new Set();
    beam = [];
    for (const candidate of candidates) {
      const bucket = `${Math.round(candidate.x / 35)}:${Math.round(candidate.y / 35)}:${Math.round(candidate.angle / (turn / 2))}`;
      if (buckets.has(bucket)) continue;
      buckets.add(bucket); beam.push(candidate);
      if (beam.length >= beamWidth) break;
    }
    completedSteps++;
  }
  let best = beam[0];
  const path = [];
  while (best) { path.push([best.x, best.y, best.z]); best = best.parent; }
  path.reverse();
  return { path, completedSteps, requestedSteps: count, maxGrade: beam[0].maxGrade, limitedByTerrain: completedSteps < count };
}

/**
 * @param {object} THREE Existing locally bundled Three namespace.
 * @param {object} options
 * @param {object} options.world Unmodified saved TOGA world, with roads/W/H.
 * @param {function(number, number): number} options.sampleSurface Prefer the
 * actual rendered terrain triangle sampler, with the original town sampler
 * inside its bounds. Returned heights must be in the same authored world units.
 */
export function createRegionalRoads(THREE, options = {}) {
  const { world, sampleSurface } = options;
  if (!world?.roads || typeof sampleSurface !== 'function') throw new TypeError('Regional roads require the original world and a terrain height sampler.');
  const metresPerUnit = options.metresPerUnit || 2;
  const lengthMetres = options.lengthMetres || 24000;
  // The eastern public road leaves the valley toward a real ridge. End its
  // scenic extension beyond the close approach rather than inventing a tunnel.
  const lengthsByExit = { 'main-street:end': 8000, ...options.lengthsByExit };
  const maxGrade = options.maxGrade ?? .115;
  if (!(metresPerUnit > 0) || !(lengthMetres > 0) || !(maxGrade > 0 && maxGrade <= .12)) throw new RangeError('Road scale and length must be positive; maximum grade must be <= 12%.');
  const sample = (x, y) => {
    const z = sampleSurface(x, y);
    if (!Number.isFinite(z)) throw new Error(`Regional road terrain is not finite at ${x}, ${y}.`);
    return z;
  };
  const group = new THREE.Group();
  group.name = 'Original public-road exits continued into the Nevada valley';
  const exits = publicExits(world);
  const materials = {
    // The intro spans roof-close to regional distances. Physical millimetre-
    // scale lifts alone collapse in that depth buffer, so each coplanar layer
    // also gets an explicit ordered depth bias without moving its geometry.
    shoulder: new THREE.MeshBasicMaterial({ color: PALETTE.shoulder, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    pavement: new THREE.MeshBasicMaterial({ color: PALETTE.pavement, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    marking: new THREE.MeshBasicMaterial({ color: PALETTE.marking, side: THREE.DoubleSide, toneMapped: false, transparent: true, opacity: 136 / 255, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  };
  const baseColours = Object.fromEntries(Object.entries(materials).map(([key, material]) => [key, material.color.clone()]));
  const buffers = Object.fromEntries(Object.keys(materials).map(key => [key, { positions: [], indices: [] }]));
  const records = [];

  function quad(kind, a, b, width, lift) {
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (length < 1e-8) return;
    const nx = -dy / length * width / 2, ny = dx / length * width / 2;
    const buffer = buffers[kind], first = buffer.positions.length / 3;
    for (const point of [[a[0] + nx, a[1] + ny], [a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny]]) buffer.positions.push(...point, sample(...point) + lift);
    buffer.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }

  function ribbon(kind, points, width, lift) {
    const buffer = buffers[kind], first = buffer.positions.length / 3;
    const unit = (a, b) => { const length = distance(a, b); return [(b[0] - a[0]) / length, (b[1] - a[1]) / length]; };
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const incoming = unit(points[Math.max(0, i - 1)], points[Math.max(1, i)]);
      const outgoing = unit(points[Math.min(i, points.length - 2)], points[Math.min(i + 1, points.length - 1)]);
      const nx = -(incoming[1] + outgoing[1]), ny = incoming[0] + outgoing[0], normalLength = Math.hypot(nx, ny);
      const normal = [nx / normalLength, ny / normalLength];
      // Shared miter vertices make a single sealed strip at every gentle bend.
      const scale = width / 2 / Math.max(.95, normal[0] * -outgoing[1] + normal[1] * outgoing[0]);
      for (const sign of [1, -1]) {
        const x = point[0] + normal[0] * scale * sign, y = point[1] + normal[1] * scale * sign;
        buffer.positions.push(x, y, sample(x, y) + lift);
      }
      if (i) {
        const a = first + (i - 1) * 2, b = a + 2;
        buffer.indices.push(a, a + 1, b + 1, a, b + 1, b);
      }
    }
  }

  for (const exit of exits) {
    const requestedLength = lengthsByExit[exit.id] ?? lengthMetres;
    if (!(requestedLength > 0)) throw new RangeError(`Road length must be positive for ${exit.id}.`);
    const route = planRoute(exit, sample, { length: requestedLength / metresPerUnit, step: 80 / metresPerUnit, maxGrade, beamWidth: 64 });
    const routePoints = [[...exit.start, sample(...exit.start)], ...route.path];
    // Linear densification preserves every authored source point and planned
    // tangent. It introduces no smoothing overshoot into neighbouring hills.
    const points = [routePoints[0]];
    for (let i = 1; i < routePoints.length; i++) {
      const a = routePoints[i - 1], b = routePoints[i], subdivisions = Math.ceil(distance(a, b) / 3);
      for (let j = 1; j <= subdivisions; j++) {
        const t = j / subdivisions, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        points.push([x, y, sample(x, y)]);
      }
    }
    ribbon('shoulder', points, exit.width + 3, .045);
    ribbon('pavement', points, exit.width, .065);
    let walked = 0, measuredGrade = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], length = distance(a, b);
      measuredGrade = Math.max(measuredGrade, Math.abs(b[2] - a[2]) / length);
      // Same 3.8-on/5.2-off cadence and .42-unit width as toga-render.js:74.
      const end = walked + length;
      for (let dash = Math.floor(walked / 9) * 9; dash < end; dash += 9) {
        const startAt = Math.max(walked, dash), endAt = Math.min(end, dash + 3.8);
        if (endAt <= startAt) continue;
        const at = d => { const t = (d - walked) / length; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
        quad('marking', at(startAt), at(endAt), .42, .085);
      }
      walked = end;
    }
    records.push({ sourceId: exit.sourceId, endpoint: exit.atStart ? 'start' : 'end', start: [...exit.start], originalEndpoint: [...exit.endpoint], originalTangent: [...exit.tangent], width: exit.width, overlapUnits: exit.overlap, requestedLengthMetres: requestedLength, lengthMetres: (walked - exit.overlap) * metresPerUnit, maxGrade: measuredGrade, limitedByTerrain: route.limitedByTerrain, lastPoint: [...points.at(-1)], samples: points.length, route: route.path.map(point => [...point]) });
  }
  for (const [kind, buffer] of Object.entries(buffers)) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffer.positions, 3));
    geometry.setIndex(buffer.indices); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, materials[kind]);
    mesh.name = `Source-matched regional road ${kind}`;
    group.add(mesh);
  }
  let blend = 1;
  return {
    group,
    setBlend(value) {
      blend = clamp(value, 0, 1);
      for (const [key, material] of Object.entries(materials)) {
        material.opacity = blend * (key === 'marking' ? 136 / 255 : 1);
        material.transparent = material.opacity < 1;
        material.depthWrite = blend === 1 && key !== 'marking';
      }
      group.visible = blend > .001;
    },
    updateLighting(groundLinear = [1, 1, 1]) {
      if (!Array.isArray(groundLinear) || groundLinear.length !== 3 || !groundLinear.every(Number.isFinite)) throw new TypeError('Regional road lighting needs three finite linear channels.');
      for (const [key, material] of Object.entries(materials)) material.color.copy(baseColours[key]).multiply(new THREE.Color().setRGB(...groundLinear));
    },
    getState() {
      return { source: 'Unchanged city-current.json public-road boundary endpoints', authoredCoordinates: 'X east, Y south, Z up', metresPerUnit, maxPermittedGrade: maxGrade, requestedLengthMetres: lengthMetres, drawCalls: group.children.length, blend, palette: { ...PALETTE }, exits: records.map(({ route, ...record }) => ({ ...record })), limitations: ['Extension paths are authored scenic road continuations, not surveyed Nevada highways.', 'Original town, airport runways, private lanes and saved geometry are unchanged.'] };
    },
    getRoutes() { return records.map(record => ({ ...record, route: record.route.map(point => [...point]) })); },
    dispose() { for (const mesh of group.children) mesh.geometry.dispose(); for (const material of Object.values(materials)) material.dispose(); group.clear(); },
  };
}
