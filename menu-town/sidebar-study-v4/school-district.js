/* The school district from the opening (intro-school.js): the planner's school kit at the district's
 * proportions, its low wing, the fenced court, lawn, trees, the roof door and the TOGA SCHOOL name sign.
 * Loaded as plain triangles in source units (X east, Y south, Z up) and lit the way the town is lit here:
 * flat colour per face from a fixed sun, drawn without scene lights. */
const SUN = [-0.35, 0.55, 0.76];
const lin = c => { c /= 255; return c <= 0.04045 ? c/12.92 : Math.pow((c + 0.055)/1.055, 2.4); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

export async function createSchoolDistrict(THREE, parent) {
  const data = await (await fetch(new URL('../../assets/menu-scene-v1/school-district.json', import.meta.url))).json();
  const L = new THREE.Vector3(...SUN).normalize(), group = new THREE.Group();
  group.name = 'School district (from the opening)';
  const palette = data.palette.map(hex);
  const baseColors = [];
  function mesh(set, { decal = false, lift = 0 } = {}) {
    const t = set.t, n = t.length/9, pos = new Float32Array(n*9), col = new Float32Array(n*9), base = new Float32Array(n*9);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nm = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      a.fromArray(t, i*9); b.fromArray(t, i*9 + 3); c.fromArray(t, i*9 + 6);
      nm.subVectors(b, a).cross(c.clone().sub(a)).normalize();
      const shade = 0.72 + 0.34*Math.abs(nm.dot(L))*(nm.z > -0.2 ? 1 : 0.6), rgb = palette[set.c[i]];
      for (let k = 0; k < 3; k++) {
        pos[i*9 + k*3] = t[i*9 + k*3]; pos[i*9 + k*3 + 1] = t[i*9 + k*3 + 1]; pos[i*9 + k*3 + 2] = t[i*9 + k*3 + 2] + lift;
        for (let j = 0; j < 3; j++) { const v = lin(rgb[j])*shade; col[i*9 + k*3 + j] = v; base[i*9 + k*3 + j] = v; }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false,
      polygonOffset: decal, polygonOffsetFactor: decal ? -2 : 0, polygonOffsetUnits: decal ? -6 : 0 }));
    baseColors.push([g.attributes.color, base]); group.add(m); return m;
  }
  // the ground: schoolyard, lawns, concrete, the court and its lines
  { const quads = [], cols = [];
    const quad = (x, y, w, d, col) => { quads.push(x, y, x + w, y, x + w, y + d, x, y, x + w, y + d, x, y + d); for (let k = 0; k < 6; k++) cols.push(col); };
    for (const [x, y, w, d, c] of data.surfaces) quad(x, y, w, d, c);
    const C = data.court, lc = '#e2e0d2', l = 0.14;
    quad(C.x + .8, C.y + .8, C.w - 1.6, l, lc); quad(C.x + .8, C.y + C.d - .8 - l, C.w - 1.6, l, lc); quad(C.x + .8, C.y + .8, l, C.d - 1.6, lc); quad(C.x + C.w - .8 - l, C.y + .8, l, C.d - 1.6, lc);
    quad(C.x + C.w/2 - l/2, C.y + .8, l, C.d - 1.6, lc);
    const n = quads.length/2, pos = new Float32Array(n*3), col = new Float32Array(n*3);
    for (let i = 0; i < n; i++) { pos[i*3] = quads[i*2]; pos[i*3 + 1] = quads[i*2 + 1]; pos[i*3 + 2] = 0.03 + (i/6 | 0)*0.002; const rgb = hex(cols[i]); for (let j = 0; j < 3; j++) col[i*3 + j] = lin(rgb[j])*0.98; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }))); }
  mesh(data.solid); mesh(data.prop); mesh(data.decal, { decal: true });
  // chain-link between the posts
  { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.strokeStyle = 'rgba(96,110,100,0.95)'; x.lineWidth = 3;
    for (let k = -64; k <= 64; k += 16) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 64, 64); x.stroke(); x.beginPath(); x.moveTo(k + 64, 0); x.lineTo(k, 64); x.stroke(); }
    for (const [a, b, h] of data.fences) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(len/0.9, (h - .15)/0.9); tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h - .15), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }));
      const along = new THREE.Vector3(b[0] - a[0], b[1] - a[1], 0).normalize(), up = new THREE.Vector3(0, 0, 1), side = new THREE.Vector3().crossVectors(along, up);
      m.matrixAutoUpdate = false; m.matrix.makeBasis(along, up, side).setPosition((a[0] + b[0])/2, (a[1] + b[1])/2, (h + .15)/2); group.add(m); } }
  // the name on the sign's panel, in the same lettering as before
  { const N = data.nameSign, cv = document.createElement('canvas'); cv.width = 1024; cv.height = 300; const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 300); grd.addColorStop(0, '#efe8d6'); grd.addColorStop(1, '#ddd3bb'); g.fillStyle = grd; g.fillRect(0, 0, 1024, 300);
    g.strokeStyle = '#2f3b36'; g.lineWidth = 10; g.strokeRect(22, 22, 980, 256); g.lineWidth = 3; g.strokeRect(38, 38, 948, 224);
    g.fillStyle = '#2f3b36'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 128px Georgia, "Times New Roman", serif'; if ('letterSpacing' in g) g.letterSpacing = '10px';
    g.fillText('TOGA SCHOOL', 517, 158, 900);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(3.36, 0.985), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    // PlaneGeometry faces +Z; stand it up (+Z -> the sign's facing direction in source units) at the panel's height
    const f = N.face, dir = new THREE.Vector3(Math.cos(f), Math.sin(f), 0), up = new THREE.Vector3(0, 0, 1), right = new THREE.Vector3().crossVectors(up, dir);
    plate.matrixAutoUpdate = false; plate.matrix.makeBasis(right, up, dir).setPosition(N.x + dir.x*0.118, N.y + dir.y*0.118, 1.26); group.add(plate);
    group.userData.nameSign = { x: N.x, y: N.y, face: f }; }
  // any other faceted model in source units, with its own colours per face (the parked Blackbird at the airfield)
  function facets(faces, place) {
    const n = faces.reduce((k, f) => k + f.points.length - 2, 0), pos = new Float32Array(n*9), col = new Float32Array(n*9), base = new Float32Array(n*9);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nm = new THREE.Vector3(); let i = 0;
    for (const f of faces) { const P = f.points.map(place);
      for (let k = 1; k < P.length - 1; k++, i++) { const tri = [P[0], P[k], P[k + 1]];
        a.fromArray(tri[0]); b.fromArray(tri[1]); c.fromArray(tri[2]); nm.subVectors(b, a).cross(c.clone().sub(a)).normalize();
        const shade = 0.66 + 0.4*Math.abs(nm.dot(L));
        for (let v = 0; v < 3; v++) for (let j = 0; j < 3; j++) { pos[i*9 + v*3 + j] = tri[v][j]; col[i*9 + v*3 + j] = base[i*9 + v*3 + j] = lin(f.color[j])*shade; } } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }));
    baseColors.push([g.attributes.color, base]); group.add(m); if (lastLight) api.setLight(lastLight); return m;
  }
  let lastLight = null;
  parent.add(group);
  const api = {
    group, nameSign: group.userData.nameSign,
    /** model faces in model units; a = {x, y, heading, scale}; z = ground height under it */
    addAircraft(model, a, z = 0) {
      const co = Math.cos(a.heading), si = Math.sin(a.heading), k = a.scale || model.scale || .35;
      return facets(model.faces, p => [a.x + (p[0]*co - p[1]*si)*k, a.y + (p[0]*si + p[1]*co)*k, z + (p[2] - 2)*k + 0.55]);
    },
    // follow the town's day-to-night: scale every face by the light the town is using
    setLight(rgb) { lastLight = rgb; for (const [attr, base] of baseColors) { for (let i = 0; i < base.length; i += 3) { attr.array[i] = base[i]*rgb[0]; attr.array[i + 1] = base[i + 1]*rgb[1]; attr.array[i + 2] = base[i + 2]*rgb[2]; } attr.needsUpdate = true; } },
    dispose() { group.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); }); group.removeFromParent(); }
  };
  return api;
}
