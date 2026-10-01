/* Life in the menu's sky. Every so often, while the menu rests on its own view, the Blackbird crosses high over
 * the town, or the UFO turns up over the northern edge, hangs there a few seconds and zips off.
 * Everything sits in the town's own group, in source units (X east, Y south, Z up), so it shares its registration. */
const SUN = [-0.35, 0.55, 0.76];
const lin = c => { c /= 255; return c <= 0.04045 ? c/12.92 : Math.pow((c + 0.055)/1.055, 2.4); };

export function createMenuAmbient(THREE, environment, { base = [518, 397], model = globalThis.TogaBlackbird } = {}) {
  const root = new THREE.Group(); root.name = 'Menu sky life'; environment.group.add(root);
  const L = new THREE.Vector3(...SUN).normalize();
  const disposables = [];
  const own = x => (disposables.push(x), x);
  const glowTex = own((() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })());
  const glow = (color, size, opacity = 1) => { const s = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glowTex, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }))); s.scale.setScalar(size); return s; };

  // the jet: the town's own Blackbird-inspired model, faces lit the way the town is lit
  const jet = new THREE.Group(); jet.rotation.order = 'ZYX'; jet.visible = false; root.add(jet); jet.userData.burners = [];
  if (model?.faces){
    const k = model.scale || 0.35, pos = [], col = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (const f of model.faces){ const P = f.points.map(p => [p[0], p[1], p[2] - 2]);
      for (let i = 1; i < P.length - 1; i++){ const tri = [P[0], P[i], P[i + 1]];
        a.fromArray(tri[0]); b.fromArray(tri[1]); c.fromArray(tri[2]); n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
        const shade = 0.62 + 0.42*Math.abs(n.dot(L));
        for (const v of tri){ pos.push(...v); col.push(lin(f.color[0])*shade, lin(f.color[1])*shade, lin(f.color[2])*shade); } } }
    const g = own(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const body = new THREE.Mesh(g, own(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }))); body.scale.setScalar(k); jet.add(body);
    for (const side of [-1, 1]){ const s = glow(0xffb45a, 4.2); s.position.set(-21*k, side*8.2*k, 1.2*k); jet.add(s); jet.userData.burners.push(s); }
    // a faint vapour trail off each engine, a vertical ribbon so it reads from the street
    const tc = document.createElement('canvas'); tc.width = 256; tc.height = 8; const tg = tc.getContext('2d'), lg = tg.createLinearGradient(0, 0, 256, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.85, 'rgba(255,255,255,0.55)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); tg.fillStyle = lg; tg.fillRect(0, 0, 256, 8);
    const trailTex = own(new THREE.CanvasTexture(tc)); trailTex.colorSpace = THREE.SRGBColorSpace;
    for (const side of [-1, 1]){ const tr = new THREE.Mesh(own(new THREE.PlaneGeometry(140, 1.1)), own(new THREE.MeshBasicMaterial({ map: trailTex, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })));
      tr.rotation.x = Math.PI/2; tr.position.set(-21*k - 70, side*8.2*k, 1.2*k); jet.add(tr); }
  }

  // the UFO: the same saucer as the tour's, larger, its spin axis stood up to the town's Z
  const ufo = new THREE.Group(); ufo.visible = false; root.add(ufo);
  const saucer = new THREE.Group(); saucer.rotation.x = Math.PI/2; ufo.add(saucer);
  { const prof = [[0, -6], [16, -5], [30, -1.5], [34, 0], [30, 2.2], [18, 5], [10, 6.5], [0, 7]].map(([x, y]) => new THREE.Vector2(x, y));
    saucer.add(new THREE.Mesh(own(new THREE.LatheGeometry(prof, 40)), own(new THREE.MeshStandardMaterial({ color: 0xd4dade, metalness: 0.25, roughness: 0.35, emissive: 0x2a3036 }))));
    const dome = new THREE.Mesh(own(new THREE.SphereGeometry(11, 24, 12, 0, Math.PI*2, 0, Math.PI/2)), own(new THREE.MeshStandardMaterial({ color: 0x9fe3f0, emissive: 0x5fb8c8, emissiveIntensity: 0.8, roughness: 0.2 }))); dome.position.y = 5.5; saucer.add(dome);
    saucer.userData.lights = [];
    for (let i = 0; i < 12; i++){ const a = i/12*Math.PI*2, m = new THREE.Mesh(own(new THREE.SphereGeometry(1.8, 8, 6)), own(new THREE.MeshBasicMaterial({ color: i%2 ? 0xffd86a : 0x8ff0c8, toneMapped: false })));
      m.position.set(Math.cos(a)*31, 0.6, Math.sin(a)*31); m.userData.noInk = true; saucer.add(m); saucer.userData.lights.push(m); }
    saucer.scale.setScalar(0.42); }
  const halo = glow(0x9ff5d8, 40, 0.45); halo.position.z = -1.5; ufo.add(halo);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const ground = (x, y) => { try { return environment.terrainHeight(x, y); } catch (e) { return 0; } };
  const eye = ground(base[0], base[1]);
  let ev = null, wait = 16 + Math.random()*10;
  function start(kind){
    if (kind === 'jet' && model?.faces){
      const dir = Math.random() < 0.5 ? 1 : -1;
      ev = { kind, t: 0, dur: 8.5, dir, y: base[1] - 215 - Math.random()*60, z: eye + 62 + Math.random()*22, x0: base[0] - dir*600, x1: base[0] + dir*600 };
      jet.visible = true;
    } else {
      const side = Math.random() < 0.5 ? -1 : 1, x = base[0] + side*(110 + Math.random()*90), y = base[1] - 380 - Math.random()*60;
      ev = { kind: 'ufo', t: 0, dur: 6.8, side, x, y, z: ground(x, y) + 52 + Math.random()*14 };
      ufo.visible = true;
    }
  }
  function stop(){ ev = null; jet.visible = ufo.visible = false; wait = 40 + Math.random()*40; }
  return {
    group: root,
    /** allowed: the menu is resting on its own view. Returns true while something is in the sky. */
    update(dt, allowed){
      dt = Math.min(dt, 0.05);
      if (!ev){ if (!allowed || reduce.matches) return false; wait -= dt; if (wait > 0) return false; start(Math.random() < 0.55 ? 'jet' : 'ufo'); }
      if (!allowed){ stop(); return true; }
      ev.t += dt; const u = Math.min(1, ev.t/ev.dur);
      if (ev.kind === 'jet'){
        jet.position.set(ev.x0 + (ev.x1 - ev.x0)*u, ev.y, ev.z + Math.sin(u*Math.PI)*6);
        jet.rotation.set(0.1*Math.sin(u*Math.PI*2), 0, ev.dir > 0 ? 0 : Math.PI);
        jet.userData.burners.forEach((b, i) => { b.material.opacity = 0.65 + 0.35*Math.sin(ev.t*37 + i*2); });
      } else {
        const appear = Math.min(1, ev.t/0.45), zip = Math.max(0, ev.t - 5.5)/0.9, zz = zip*zip;
        ufo.scale.setScalar(Math.max(0.001, appear*(1 - Math.min(1, zip)*0.7)));
        ufo.position.set(ev.x + Math.sin(ev.t*0.9)*4 + ev.side*zz*260, ev.y - zz*120, ev.z + Math.sin(ev.t*2.1)*1.2 + zz*170);
        saucer.rotation.y = ev.t*2.4;
        saucer.userData.lights.forEach((m, i) => m.material.color.set(Math.floor(ev.t*6 + i)%3 === 0 ? 0xffd86a : 0x8ff0c8));
        halo.material.opacity = 0.45*appear*(1 - Math.min(1, zip));
      }
      if (ev.t >= ev.dur) stop();
      return true;
    },
    trigger(kind, at = 0){ stop(); start(kind); if (ev) ev.t = at; },   // for review: put one in the sky now
    getState: () => ev ? { kind: ev.kind, t: ev.t } : { kind: null, wait },
    dispose(){ for (const d of disposables) d.dispose(); root.removeFromParent(); }
  };
}
