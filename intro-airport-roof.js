/* Prepared by: Codex.
 * Isolated cinematic additions. The saved city, school geometry and Blackbird
 * source stay unchanged. Coordinates use the town's authored X/Y ground, Z up.
 */

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const linear = value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;

export function createAirportRoof(THREE, {
  world, roof, roofMetadata, aircraftModel = globalThis.TogaBlackbird,
  takeoffStart = 5, rollDuration = 2
} = {}) {
  if (!world?.geometry || !world?.roads || !aircraftModel?.faces) {
    throw new Error('Airport/roof additions require the original world and TogaBlackbird faces.');
  }
  const school = world.buildings.find(building => building.id === 'building-029');
  const runway = world.roads.find(road => road.id === 'runway' && road.kind === 'runway');
  if (!school || !runway || runway.points.length !== 2 || !roofMetadata?.outline || !roof) {
    throw new Error('The exact school roof and saved two-point runway are required.');
  }
  if (!Number.isFinite(takeoffStart) || !Number.isFinite(rollDuration) || rollDuration <= 0) {
    throw new TypeError('Finite takeoff timing and a positive runway-roll duration are required.');
  }

  const group = new THREE.Group();
  group.name = 'Cinematic airport takeoff and reversible roof additions';
  const resources = [], coloredMeshes = [];
  let disposed = false, time = 0, flightState = null;
  const worldPoint = point => world.geometry.point(school, [school.x + point[0], school.y + point[1], point[2]]);

  function makeFaces(faces, name) {
    const positions = [], colors = [], indices = [], records = [];
    for (const face of faces) {
      if (face.points.length < 3) continue;
      const vertices = face.points.map(point => new THREE.Vector3(...point));
      const normal = new THREE.Vector3().subVectors(vertices[1], vertices[0])
        .cross(new THREE.Vector3().subVectors(vertices[2], vertices[0])).normalize();
      const dominant = Math.abs(normal.x) > Math.abs(normal.y)
        ? (Math.abs(normal.x) > Math.abs(normal.z) ? 0 : 2)
        : (Math.abs(normal.y) > Math.abs(normal.z) ? 1 : 2);
      const axes = [0, 1, 2].filter(axis => axis !== dominant);
      const contour = face.points.map(point => new THREE.Vector2(point[axes[0]], point[axes[1]]));
      const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
      const first = positions.length / 3;
      const base = face.color.map(value => linear(value / 255));
      for (const point of face.points) { positions.push(...point); colors.push(...base); }
      for (const triangle of triangles) indices.push(...triangle.map(index => first + index));
      records.push({ first, count: face.points.length, base, normal });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    resources.push(geometry, material);
    coloredMeshes.push({ mesh, geometry, records });
    return mesh;
  }

  const aircraft = new THREE.Group();
  aircraft.name = 'Original Blackbird-inspired source model in flight';
  aircraft.rotation.order = 'ZYX';
  const plane = makeFaces(aircraftModel.faces, aircraftModel.name);
  const planeScale = world.aircraft?.scale ?? aircraftModel.scale;
  if (!Number.isFinite(planeScale) || planeScale <= 0) throw new Error('Original aircraft scale must be positive.');
  plane.scale.setScalar(planeScale);
  aircraft.add(plane);
  group.add(aircraft);
  const sourceMinZ = Math.min(...aircraftModel.faces.flatMap(face => face.points.map(point => point[2])));
  const [runwayStart, runwayEnd] = runway.points;
  const runwayLength = Math.hypot(runwayEnd[0] - runwayStart[0], runwayEnd[1] - runwayStart[1]);
  if (!(runwayLength > 0)) throw new Error('Saved runway must have nonzero length.');
  const runwayUnit = runwayEnd.map((value, axis) => (value - runwayStart[axis]) / runwayLength);
  const heading = Math.atan2(runwayUnit[1], runwayUnit[0]);

  // Original tall roof spans .66w..w and .25d..d. The addition occupies its
  // back-left portion, clear of the existing .79w/.52d vent and .87w/.58d anchor.
  const headhouse = {
    localMin: [school.w * .70, school.d * .32, roofMetadata.height],
    size: [3, 3.8, 2.9], doorWidth: 1.05, doorHeight: 2.15
  };
  const [hx, hy, hz] = headhouse.localMin, [hw, hd, hh] = headhouse.size;
  const doorwayLocal = [hx + hw * .5, hy + hd, hz];
  const doorLeft = doorwayLocal[0] - headhouse.doorWidth / 2;
  const doorRight = doorwayLocal[0] + headhouse.doorWidth / 2;
  const newFaces = [], add = (points, color) => newFaces.push({ points: points.map(worldPoint), color });
  const plaster = [171, 165, 145], trim = [132, 143, 136], roofColor = [125, 135, 127];
  function panel(x0, y0, z0, x1, y1, z1, color) {
    add([[x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]], color);
  }
  panel(hx, hy, hz, hx + hw, hy, hz + hh, plaster);
  panel(hx, hy + hd, hz, hx, hy, hz + hh, plaster);
  panel(hx + hw, hy, hz, hx + hw, hy + hd, hz + hh, plaster);
  // The +Y face is constructed around a genuine opening, not a door pasted on
  // a solid wall. A recessed dark inner plane avoids implying a finished room.
  panel(doorLeft, hy + hd, hz, hx, hy + hd, hz + hh, plaster);
  panel(hx + hw, hy + hd, hz, doorRight, hy + hd, hz + hh, plaster);
  panel(doorRight, hy + hd, hz + headhouse.doorHeight, doorLeft, hy + hd, hz + hh, plaster);
  panel(doorLeft, hy + hd - .8, hz, doorRight, hy + hd - .8, hz + headhouse.doorHeight, [29, 34, 32]);
  panel(doorLeft, hy + hd, hz, doorLeft, hy + hd - .8, hz + headhouse.doorHeight, trim);
  panel(doorRight, hy + hd - .8, hz, doorRight, hy + hd, hz + headhouse.doorHeight, trim);
  add([[doorLeft, hy + hd, hz + headhouse.doorHeight], [doorRight, hy + hd, hz + headhouse.doorHeight], [doorRight, hy + hd - .8, hz + headhouse.doorHeight], [doorLeft, hy + hd - .8, hz + headhouse.doorHeight]], trim);
  add([[hx - .10, hy - .10, hz + hh], [hx + hw + .10, hy - .10, hz + hh], [hx + hw + .10, hy + hd + .10, hz + hh], [hx - .10, hy + hd + .10, hz + hh]], roofColor);
  add([[doorLeft - .10, hy + hd - .08, hz + .025], [doorRight + .10, hy + hd - .08, hz + .025], [doorRight + .10, hy + hd + .32, hz + .025], [doorLeft - .10, hy + hd + .32, hz + .025]], trim);
  const stairwell = makeFaces(newFaces, 'New removable school rooftop stairwell with open +Y access');
  group.add(stairwell);

  // Reversible, simple roof props for the ordinary-school/fireworks story beat.
  // These do not modify city-current.json or the authored school mesh.
  const supplyFaces = [], supplyBoxes = [];
  const supplyFace = (points, color) => supplyFaces.push({points:points.map(worldPoint),color});
  function carton(x,y,z,w,d,h,open=false){
    supplyBoxes.push({local:[x,y,z],size:[w,d,h],open});
    supplyFace([[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z]],[102,76,49]);
    supplyFace([[x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h]],[173,137,90]);
    supplyFace([[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]],[151,113,72]);
    supplyFace([[x+w,y+d,z],[x,y+d,z],[x,y+d,z+h],[x+w,y+d,z+h]],[191,157,106]);
    supplyFace([[x,y+d,z],[x,y,z],[x,y,z+h],[x,y+d,z+h]],[159,120,76]);
    if(!open)supplyFace([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],[204,176,125]);
  }
  const bx=school.w*.775,by=school.d*.77,bz=hz+.04;
  // No cartons: paper cones, striped tubes and exposed wooden guide sticks.
  for(let i=0;i<4;i++){
    const cx=bx+.35+i*.82,cy=by+.78,base=bz+.82,tip=base+1.18+(i%2)*.25,r=.23;
    supplyFace([[cx-.04,cy,bz],[cx+.04,cy,bz],[cx+.04,cy,base+.25],[cx-.04,cy,base+.25]],[190,158,111]);
    for(let j=0;j<8;j++){
      const a=j*Math.PI/4,b=(j+1)*Math.PI/4;
      const p=[cx+Math.cos(a)*r,cy+Math.sin(a)*r],q=[cx+Math.cos(b)*r,cy+Math.sin(b)*r];
      supplyFace([[...p,base],[...q,base],[...q,tip-.32],[...p,tip-.32]],i===1?[211,174,87]:[166,64,48]);
      supplyFace([[...p,tip-.32],[...q,tip-.32],[cx,cy,tip]],[223,192,134]);
      supplyFace([[...p,base+.26],[...q,base+.26],[...q,base+.43],[...p,base+.43]],[235,220,179]);
    }
  }
  const fireworksSupplies=makeFaces(supplyFaces,'Four unlit striped paper fireworks on exposed wooden guide sticks, no boxes');
  group.add(fireworksSupplies);

  // A deliberately anonymous, flat silhouette, not a substitute for Blu's
  // character artwork. It stays on the original +X/+Y viewing side; no billboard
  // camera mathematics can flip it when the root reflects authored Y to north.
  const silhouette = new THREE.Group();
  silhouette.name = 'Temporary flat rooftop character silhouette, no firework';
  const bodyShape = new THREE.Shape();
  const contour = [[-.10, 1.40], [-.23, 1.35], [-.40, .85], [-.27, .82], [-.18, 1.16], [-.16, .74], [-.25, .08], [-.08, .02], [0, .64], [.08, .02], [.25, .08], [.16, .74], [.18, 1.16], [.27, .82], [.40, .85], [.23, 1.35], [.10, 1.40]];
  contour.forEach((point, index) => index ? bodyShape.lineTo(...point) : bodyShape.moveTo(...point));
  bodyShape.closePath();
  const bodyGeometry = new THREE.ShapeGeometry(bodyShape);
  const headGeometry = new THREE.CircleGeometry(.18, 24);
  headGeometry.translate(0, 1.57, 0);
  const silhouetteMaterial = new THREE.MeshBasicMaterial({ color: 0x161a18, side: THREE.DoubleSide, toneMapped: false });
  const figurePlane = new THREE.Group();
  figurePlane.rotation.x = Math.PI / 2;
  figurePlane.add(new THREE.Mesh(bodyGeometry, silhouetteMaterial), new THREE.Mesh(headGeometry, silhouetteMaterial));
  silhouette.add(figurePlane);
  silhouette.rotation.z = (school.angle || 0) - Math.PI / 4;
  const characterLocal = [school.w * .86, school.d * .70, hz + .035];
  const characterWorld = worldPoint(characterLocal);
  silhouette.position.set(...characterWorld);
  group.add(silhouette);
  resources.push(bodyGeometry, headGeometry, silhouetteMaterial);

  const positions = {
    runwayStart: [...runwayStart], runwayEnd: [...runwayEnd],
    stairwell: worldPoint([hx + hw / 2, hy + hd / 2, hz]),
    doorway: worldPoint(doorwayLocal), character: [...characterWorld],
    roofAnchor: [...roof]
  };
  positions.fireworksSupplies=worldPoint([bx+2.5,by+.9,bz]);
  let lastGround = null;
  function update(seconds, { groundLinear = [1, 1, 1] } = {}) {
    if (disposed) return;
    if (!Number.isFinite(seconds)) throw new TypeError('Cinematic time must be finite.');
    if (!Array.isArray(groundLinear) || groundLinear.length !== 3 || groundLinear.some(value => !Number.isFinite(value) || value < 0)) {
      throw new TypeError('Lighting must be three nonnegative linear multipliers.');
    }
    time = Math.max(0, seconds);
    const elapsed = Math.max(0, time - takeoffStart);
    const roll = Math.min(elapsed, rollDuration), flight = Math.max(0, elapsed - rollDuration);
    const acceleration = 60, liftSpeed = acceleration * rollDuration;
    const distance = runwayLength * .16 + .5 * acceleration * roll * roll + liftSpeed * flight + 10 * flight * flight;
    const altitude = 9 * flight * flight;
    const climbAngle = Math.atan2(18 * flight, liftSpeed + 20 * flight);
    aircraft.position.set(runwayStart[0] + runwayUnit[0] * distance, runwayStart[1] + runwayUnit[1] * distance, .04 - sourceMinZ * planeScale + altitude);
    aircraft.rotation.set(0, -Math.min(.24, climbAngle) * smooth(flight / .5), heading, 'ZYX');
    flightState = { phase: time < takeoffStart ? 'waiting-on-runway' : elapsed < rollDuration ? 'runway-roll' : 'climb', position: aircraft.position.toArray(), altitude, pitch: -aircraft.rotation.y, heading, runwayDistance: distance };
    if (!lastGround || groundLinear.some((value, axis) => Math.abs(value - lastGround[axis]) > 1e-5)) {
      lastGround = [...groundLinear];
      const sun = new THREE.Vector3(-.74, .48, .47).normalize();
      for (const { geometry, records } of coloredMeshes) {
        const values = geometry.attributes.color.array;
        for (const record of records) {
          const shade = .78 + .22 * Math.max(0, record.normal.dot(sun));
          const rgb = record.base.map((value, axis) => value * groundLinear[axis] * shade);
          for (let index = record.first; index < record.first + record.count; index++) values.set(rgb, index * 3);
        }
        geometry.attributes.color.needsUpdate = true;
      }
    }
  }
  update(0);

  return {
    group, aircraft, stairwell, silhouette, fireworksSupplies, supplyBoxes, positions, update,
    getState: () => ({ time, disposed, coordinates: 'Authored X/Y ground and Z up; root owns axis conversion', positions, flight: flightState, aircraft: { source: 'Unchanged school-source/blackbird-model.js', faces: aircraftModel.faces.length, scale: planeScale, savedParkingPosition: world.aircraft ? { ...world.aircraft } : null, takeoffStart, rollDuration }, stairwell: { schoolId: school.id, ...headhouse, doorway: [...positions.doorway], preservesOriginalVent: true, persisted: false }, character: { kind: 'Anonymous flat silhouette placeholder', position: [...characterWorld], height: 1.75, animated: false, fireworks: false }, limitations: ['Cinematic takeoff is time-compressed, not an aircraft physics simulation.', 'Stairwell is a new reversible headhouse; the interior stairs and original roof opening are not modeled.', 'Anonymous character placeholder has no walking or firework animation.'] }),
    dispose() { if (disposed) return; disposed = true; for (const resource of resources) resource.dispose(); group.clear(); }
  };
}
