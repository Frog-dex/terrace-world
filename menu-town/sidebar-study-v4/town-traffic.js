/* Prepared by: Codex.
 * One source-derived town vehicle, on unchanged saved streets. No persistence.
 * Geometry is the existing pickup in school-source/toga-render.js:235-245;
 * TogaAssets exports airport equipment, not this native road-vehicle model.
 */
const SOURCE_MODEL = '/assets/intro-nevada-v1/school-source/toga-render.js';
const SOURCE_TRAFFIC = '/assets/intro-nevada-v1/school-source/toga-traffic.js';
const ROAD_IDS = ['main-street', 'town-east', 'north-street', 'school-road'];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** A real closed street circuit avoids any on-screen wrap/teleport, even if
 * the caller changes its camera. It passes the school on main-street first.
 * Motion is deterministic in absolute elapsedSeconds; caller owns its clock.
 */
export function createTownTraffic(THREE, environment) {
  const { world, group: environmentGroup, terrainHeight } = environment || {};
  if (!THREE?.Group || !world?.geometry || !environmentGroup?.add || typeof terrainHeight !== 'function') {
    throw new TypeError('Town traffic requires the loaded source town environment.');
  }
  const roads = ROAD_IDS.map(id => {
    const road = world.roads.find(candidate => candidate.id === id);
    if (!road?.points?.length || !(road.width > 0)) throw new Error(`Original traffic street missing: ${id}`);
    return road;
  });
  const crossings = roads.map((road, index) => {
    const next = roads[(index + 1) % roads.length];
    const matches = world.geometry.junctions([road, next]);
    if (matches.length !== 1) throw new Error(`Expected one saved crossing between ${road.id} and ${next.id}.`);
    return [matches[0].x, matches[0].y];
  });

  function roadSection(road, from, to) {
    const along = [0];
    for (let i = 1; i < road.points.length; i++) along.push(along[i - 1] + Math.hypot(...road.points[i].map((value, axis) => value - road.points[i - 1][axis])));
    function station(point) {
      let best = { distance: Infinity };
      for (let i = 1; i < road.points.length; i++) {
        const hit = world.geometry.projectSegment(point, road.points[i - 1], road.points[i]);
        if (hit.distance < best.distance) best = { ...hit, along: along[i - 1] + hit.f * (along[i] - along[i - 1]) };
      }
      if (best.distance > .05) throw new Error('Traffic junction is not on its saved road.');
      return best.along;
    }
    const start = station(from), end = station(to);
    const inside = road.points.filter((point, index) => along[index] > Math.min(start, end) + .01 && along[index] < Math.max(start, end) - .01);
    if (end < start) inside.reverse();
    return [from, ...inside, to];
  }

  const route = [];
  roads.forEach((road, index) => {
    const section = roadSection(road, crossings[(index + roads.length - 1) % roads.length], crossings[index]);
    // Every retained vertex carries the upcoming saved segment's width.
    section.slice(0, -1).forEach((point, pointIndex) => route.push({ x: point[0], y: point[1], width: road.width, roadId: road.id, junction: pointIndex === 0 }));
  });
  const direction = (a, b) => {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < .001) throw new Error('Duplicate source-road vertices in traffic circuit.');
    return [(b.x - a.x) / length, (b.y - a.y) / length];
  };
  // The saved school road has a nearly collinear vertex only two units before
  // the main-road crossing. It is meaningful to the source editor, but making
  // it a steering control would force an abrupt sub-unit-radius turn. Omit
  // only such redundant traffic controls, never saved geometry or junctions.
  for (let index = route.length - 1; index >= 0; index--) {
    const point = route[index];
    if (point.junction) continue;
    const previous = route[(index + route.length - 1) % route.length], next = route[(index + 1) % route.length];
    const a = direction(previous, point), b = direction(point, next);
    const short = Math.min(Math.hypot(point.x - previous.x, point.y - previous.y), Math.hypot(next.x - point.x, next.y - point.y)) < 5;
    if (short && a[0] * b[0] + a[1] * b[1] > .94) route.splice(index, 1);
  }
  const lane = route.map((point, index) => {
    const previous = route[(index + route.length - 1) % route.length];
    const next = route[(index + 1) % route.length];
    const incoming = direction(previous, point), outgoing = direction(point, next);
    const offsetIn = previous.width * .2, offsetOut = point.width * .2;
    const a = [point.x - incoming[1] * offsetIn, point.y + incoming[0] * offsetIn];
    const b = [point.x - outgoing[1] * offsetOut, point.y + outgoing[0] * offsetOut];
    const cross = incoming[0] * outgoing[1] - incoming[1] * outgoing[0];
    if (Math.abs(cross) < .001) return new THREE.Vector3((a[0] + b[0]) * .5, (a[1] + b[1]) * .5, 0);
    const t = ((b[0] - a[0]) * outgoing[1] - (b[1] - a[1]) * outgoing[0]) / cross;
    return new THREE.Vector3(a[0] + incoming[0] * t, a[1] + incoming[1] * t, 0);
  });
  // Round junctions locally, then densify. A sparse Catmull curve cuts across
  // entire blocks; dense points around a sharp corner instead cause a steering
  // snap. Short tangent-matched corner arcs avoid both failure modes.
  const corners = lane.map((point, index) => {
    const previous = lane[(index + lane.length - 1) % lane.length];
    const next = lane[(index + 1) % lane.length];
    const incoming = point.clone().sub(previous).normalize();
    const outgoing = next.clone().sub(point).normalize();
    const angle = Math.acos(clamp(incoming.dot(outgoing), -1, 1));
    const trim = Math.min(9, 1 + angle * 6, point.distanceTo(previous) * .32, point.distanceTo(next) * .32);
    return { point, entry: point.clone().addScaledVector(incoming, -trim), exit: point.clone().addScaledVector(outgoing, trim), trim };
  });
  const samples = [];
  corners.forEach((corner, index) => {
    const rounded = new THREE.QuadraticBezierCurve3(corner.entry, corner.point, corner.exit);
    const arcSteps = Math.max(4, Math.ceil(corner.trim * 2));
    for (let step = 0; step < arcSteps; step++) samples.push(rounded.getPoint(step / arcSteps));
    const next = corners[(index + 1) % corners.length].entry;
    const steps = Math.max(1, Math.ceil(corner.exit.distanceTo(next) / 2));
    for (let step = 0; step < steps; step++) samples.push(corner.exit.clone().lerp(next, step / steps));
  });
  const curve = new THREE.CatmullRomCurve3(samples, true, 'centripetal');
  curve.arcLengthDivisions = Math.max(2048, samples.length * 12);
  const length = curve.getLength();
  const scale = Math.min(.43, ...roads.map(road => road.width * .4 / 8));
  const speed = 7.4; // Same 6-9 source-units/s range as original TogaTraffic.
  const duration = length / speed;

  const group = new THREE.Group();
  group.name = 'Original 1980s TOGA pickup following saved streets';
  const body = new THREE.Group();
  body.scale.setScalar(scale);
  group.add(body);
  const positions = [], indices = [], colours = [], faceRecords = [];
  const paint = [154, 100, 81]; // Existing pickup traffic palette, car index 3.
  const colour = new THREE.Color();
  function face(points, rgb, normal) {
    const first = positions.length / 3;
    for (const point of points) positions.push(...point);
    for (let i = 1; i < points.length - 1; i++) indices.push(first, first + i, first + i + 1);
    for (let i = 0; i < points.length; i++) colours.push(0, 0, 0);
    faceRecords.push({ first, count: points.length, rgb, normal });
  }
  function part(x, y, width, depth, z, height, rgb) {
    const low = [[x, y, z], [x + width, y, z], [x + width, y + depth, z], [x, y + depth, z]];
    const high = low.map(point => [point[0], point[1], z + height]);
    for (let i = 0; i < 4; i++) face([low[i], low[(i + 1) % 4], high[(i + 1) % 4], high[i]], rgb, [[0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0]][i]);
    face(high, rgb, [0, 0, 1]);
  }
  // Exact dimensions and part construction from the original town renderer.
  for (const x of [-6, 5]) for (const y of [-5, 3.7]) part(x, y, 3, 1.3, .4, 2, [30, 35, 31]);
  part(-9, -4, 19, 8, 1.8, 2.3, paint);
  part(-7.8, -3.2, 8, 6.4, 3.9, .2, paint.map(value => value * .65));
  part(.3, -3.6, 4.6, 7.2, 4.1, 1.9, paint.map(value => value * 1.05));
  part(4.5, -3.4, 1.5, 6.8, 4, 1.2, [62, 92, 91]);
  part(6, -3.8, 3.8, 7.6, 3.8, .6, paint.map(value => value * 1.06));
  for (const y of [-3, 2]) {
    face([[10.006, y, 2], [10.006, y + 1, 2], [10.006, y + 1, 3], [10.006, y, 3]], [225, 223, 183], [1, 0, 0]);
    face([[-9.006, y, 2], [-9.006, y + 1, 2], [-9.006, y + 1, 3], [-9.006, y, 3]], [115, 51, 37], [-1, 0, 0]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Source pickup body, bed, glass, four tires, headlights and tail lights';
  body.add(mesh);
  environmentGroup.add(group);

  // Begin at the school frontage so the first pass is visible immediately.
  const school = environment.school || world.buildings.find(building => building.id === 'building-029');
  let startFraction = 0, best = Infinity;
  for (let i = 0; i < 1200; i++) {
    const point = curve.getPointAt(i / 1200);
    const distance = Math.hypot(point.x - (school.x + 30), point.y - (school.y + school.d + 11));
    if (distance < best) { best = distance; startFraction = i / 1200; }
  }
  let disposed = false, elapsed = 0, phase = startFraction, heading = 0, ground = 0;
  let previousHeading = NaN, previousHour = NaN;

  function update(elapsedSeconds = 0) {
    if (disposed) return;
    if (!Number.isFinite(elapsedSeconds)) throw new TypeError('Traffic update expects finite elapsed seconds.');
    elapsed = Math.max(0, elapsedSeconds);
    phase = ((startFraction + elapsed / duration) % 1 + 1) % 1;
    const point = curve.getPointAt(phase), tangent = curve.getTangentAt(phase);
    heading = Math.atan2(tangent.y, tangent.x);
    ground = terrainHeight(point.x, point.y);
    if (!Number.isFinite(ground)) throw new Error('Source terrain did not return a finite traffic height.');
    // Source tire bottoms are at local Z=.4, so register those, not the body
    // origin, with the actual ground. No floating vehicle over the pavement.
    group.position.set(point.x, point.y, ground - .4 * scale + .022);
    group.rotation.z = heading;
    const state = environment.town?.getState?.().lighting;
    const hour = state?.hour ?? 16;
    if (Math.abs(heading - previousHeading) > .002 || hour !== previousHour || !Number.isFinite(previousHeading)) {
      const solar = globalThis.TogaRenderer?.solar?.(hour);
      const sun = solar?.sun || [-.866, .48, .5], sunLength = Math.hypot(...sun);
      const groundLinear = state?.groundLinear || [1, 1, 1];
      const target = geometry.attributes.color.array, cs = Math.cos(heading), sn = Math.sin(heading);
      for (const record of faceRecords) {
        const [nx, ny, nz] = record.normal;
        const light = .78 + .22 * Math.max(0, ((nx * cs - ny * sn) * sun[0] + (nx * sn + ny * cs) * sun[1] + nz * sun[2]) / sunLength);
        colour.setRGB(...record.rgb.map(value => clamp(value * light / 255, 0, 1)), THREE.SRGBColorSpace);
        for (let i = record.first; i < record.first + record.count; i++) {
          target[i * 3] = colour.r * groundLinear[0];
          target[i * 3 + 1] = colour.g * groundLinear[1];
          target[i * 3 + 2] = colour.b * groundLinear[2];
        }
      }
      geometry.attributes.color.needsUpdate = true;
      previousHeading = heading;
      previousHour = hour;
    }
  }
  update(0);
  return {
    group, update,
    getState() {
      const nearest = world.geometry.nearest(roads, [group.position.x, group.position.y]);
      return {
        ready: !disposed, vehicleCount: 1, type: 'pickup', sourceModel: SOURCE_MODEL,
        sourceMotion: SOURCE_TRAFFIC, palette: [...paint], scale, speed, elapsed,
        cycleDuration: duration, pathLength: length, phase, heading,
        sourcePosition: group.position.toArray(), tireGround: ground + .022,
        roadIds: [...ROAD_IDS], nearestRoad: nearest.r?.id,
        distanceFromRoadCenter: nearest.distance,
        laneOffsetRule: 'Original TogaTraffic road.width * 0.2, on right-hand side',
        route: 'Closed connected saved streets; continuous pose at cycle seam, no teleport anywhere',
        sourceWrites: false,
        limitations: ['Source car tires are original block geometry, not newly invented spinning wheels.', 'One presentation vehicle; not a new traffic simulation or persistent town state.'],
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      geometry.dispose();
      material.dispose();
      group.clear();
    },
  };
}
