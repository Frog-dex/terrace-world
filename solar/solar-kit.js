
/* ======================= the solar kit: the Sun, toon planets, Saturn's rings, the Earth, orbits, stars =======================
   Shared by the opening and the solar system page. Everything is painted in the shader from the planet's own sphere
   (no texture seams, nothing that can fail to load except the Earth's map), lit by the Sun wherever it sits:
   three painted light bands, a warm terminator, and a night side that keeps its colours, cooled and dimmed,
   with a thin rim so no planet ever reads as a black hole. An ink hull outlines each body. */
const SolarKit = (() => {
  const NOISE = `
    float h3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
    float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0 - 2.0*f);
      return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm3(vec3 p){ return n3(p)*0.5 + n3(p*2.03 + 1.7)*0.27 + n3(p*4.1 - 2.3)*0.15 + n3(p*8.3 + 5.1)*0.08; }
    // craters: nearest cell centre on a 3D grid
    vec2 cells(vec3 p){ vec3 i = floor(p), f = fract(p); float d1 = 8.0, id = 0.0;
      for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++){ vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = vec3(h3(i + g), h3(i + g + 11.3), h3(i + g + 27.1)); float d = length(g + o - f); if (d < d1){ d1 = d; id = h3(i + g + 5.7); } }
      return vec2(d1, id); }`;
  // light: three painted bands, a warm line at the terminator, and a cool, readable night side
  const LIGHT = `
    vec3 toonLight(vec3 base, float nl, float rim){
      float b = nl > 0.42 ? 1.0 : nl > 0.12 ? 0.84 : nl > -0.06 ? 0.62 : 0.0;
      vec3 night = base*vec3(0.2, 0.23, 0.33) + vec3(0.012, 0.018, 0.045);
      vec3 c = b > 0.0 ? base*b : night;
      c += vec3(1.0, 0.55, 0.25)*0.16*exp(-pow((nl + 0.02)/0.07, 2.0));
      c += vec3(0.35, 0.5, 0.85)*0.22*rim*(1.0 - step(0.0, nl));            // a cool rim keeps the night-side silhouette
      return c; }`;
  const VERT = `varying vec3 vObj, vN, vW; void main(){ vObj = position; vN = normalize(mat3(modelMatrix)*normal); vW = (modelMatrix*vec4(position, 1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vW, 1.0); }`;
  const hex = c => new THREE.Color(c);
  let KEY_TO_VIEW = 0.42;                  // 0 = lit strictly from the Sun; more = the key light swings toward the viewer
  // painted looks: kind 0 banded gas giant, 1 rock, 2 ice giant, 3 cloud-wrapped (Venus)
  const LOOKS = {
    mercury: { kind: 1, pal: ['#a39a8f', '#7f776e', '#c2b9ad', '#8e867c', '#b3aa9e', '#6f685f'], crater: 1.0, patch: 0.55, caps: 0 },
    moon:    { kind: 1, pal: ['#c4c2bb', '#8e8c86', '#dcdad3', '#a7a59f', '#cfcdc6', '#7d7b76'], crater: 0.9, patch: 0.75, caps: 0 },
    mars:    { kind: 1, pal: ['#c86c43', '#9a4a2d', '#df9265', '#b3593a', '#d67d52', '#83402a'], crater: 0.35, patch: 0.8, caps: 1 },
    venus:   { kind: 3, pal: ['#f0dcae', '#e3c68c', '#d6b477', '#f6e8c8', '#e9d09c', '#caa468'] },
    jupiter: { kind: 0, pal: ['#f1e6cf', '#d9b68d', '#b9845a', '#e9d8b6', '#a8734f', '#f5ecdb'], freq: 9.0, turb: 0.55, spot: [-0.36, 1.2, 0.2, 0.1], spotC: '#c0583c' },
    saturn:  { kind: 0, pal: ['#efe2bf', '#e1c996', '#d1b27c', '#e9d7aa', '#c7a770', '#f3e8cb'], freq: 7.0, turb: 0.25 },
    uranus:  { kind: 2, pal: ['#a7dde0', '#98d0d5', '#b7e6e6', '#9fd6da', '#c3ecec', '#90c9cf'], freq: 5.0, turb: 0.12 },
    neptune: { kind: 2, pal: ['#4f7fd6', '#3f6bc2', '#6a93e0', '#4776cc', '#5d89da', '#3560b5'], freq: 6.0, turb: 0.3, spot: [-0.35, 0.6, 0.16, 0.08], spotC: '#27468f' }
  };
  function planetMaterial(name, extraU = {}){
    const L = LOOKS[name] || LOOKS.mercury;
    const u = Object.assign({ uSun: { value: new THREE.Vector3() }, uSpin: { value: 0 }, uView: { value: KEY_TO_VIEW }, uPal: { value: L.pal.map(hex) },
      uKind: { value: L.kind }, uFreq: { value: L.freq || 6 }, uTurb: { value: L.turb || 0.3 }, uCrater: { value: L.crater || 0 }, uPatch: { value: L.patch || 0.5 },
      uCaps: { value: L.caps || 0 }, uSpot: { value: new THREE.Vector4(...(L.spot || [0, 0, 0, 0])) }, uSpotC: { value: hex(L.spotC || '#000000') },
      uSeed: { value: (name.length*13.7) % 9 } }, extraU);
    return new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: `
      uniform vec3 uSun, uPal[6], uSpotC; uniform float uSpin, uKind, uFreq, uTurb, uCrater, uPatch, uCaps, uSeed, uView; uniform vec4 uSpot;
      varying vec3 vObj, vN, vW;` + NOISE + LIGHT + `
      vec3 pal(float k){ vec3 c = uPal[0]; int i = int(mod(k, 6.0));
        for (int j = 0; j < 6; j++) if (j == i) c = uPal[j]; return c; }
      void main(){
        vec3 p = normalize(vObj); float cs = cos(uSpin), sn = sin(uSpin); p = vec3(cs*p.x + sn*p.z, p.y, -sn*p.x + cs*p.z);
        float lat = asin(clamp(p.y, -1.0, 1.0)), lon = atan(p.z, p.x);
        vec3 q = p*2.2 + uSeed;
        vec3 base;
        if (uKind < 0.5 || (uKind > 1.5 && uKind < 2.5)){
          // bands, pulled about by the wind; a storm or two
          float w = fbm3(q*1.6)*uTurb + 0.18*uTurb*sin(lon*4.0 + lat*14.0 + fbm3(q*3.0)*3.0);
          float v = (lat/1.5708*0.5 + 0.5)*uFreq + w;
          float k = floor(v + h3(vec3(floor(v))*1.7)*0.35);
          base = pal(k + floor(h3(vec3(k, 2.0, 7.0))*3.0));
          float fine = n3(vec3(lon*3.0, lat*40.0, 0.0) + q*0.5);                // fine streaks inside each band
          base *= 0.95 + 0.1*step(0.55, fine);
          if (uSpot.z > 0.0){ vec2 d = vec2((lon - uSpot.y)/uSpot.z, (lat - uSpot.x)/uSpot.w); float r = length(d);
            base = mix(base, uSpotC, smoothstep(1.0, 0.86, r)); base = mix(base, uSpotC*1.18, smoothstep(0.55, 0.35, r)); base = mix(base, base*0.8, smoothstep(0.08, 0.0, abs(r - 1.0))); }
          if (uKind > 1.5) base = mix(base, uPal[4], 0.25*smoothstep(0.55, 0.95, abs(p.y)));   // ice giants: a pale haze at the poles
        } else if (uKind < 1.5){
          // rock: broad painted patches in three tones, craters with a dark rim and a light floor, polar caps
          float n = fbm3(q*1.3);
          base = n < 0.42 ? uPal[1] : n < 0.58 ? uPal[0] : uPal[2];
          float n2 = fbm3(q*3.1 + 4.0); base = mix(base, n2 > 0.6 ? uPal[3] : base, uPatch*step(0.6, n2));
          for (int s = 0; s < 2; s++){ float sc = s == 0 ? 3.0 : 7.5; vec2 c = cells(p*sc + uSeed + float(s)*9.0);
            float rad = 0.18 + 0.2*c.y, on = step(0.55, c.y)*uCrater;
            float rim = smoothstep(rad + 0.05, rad, c.x) - smoothstep(rad, rad - 0.07, c.x), floorC = smoothstep(rad - 0.02, rad - 0.1, c.x);
            base = mix(base, uPal[5], rim*0.8*on); base = mix(base, uPal[4], floorC*0.5*on); }
          if (uCaps > 0.0){ float cap = smoothstep(0.86, 0.9, abs(p.y) + 0.04*n); base = mix(base, vec3(0.95, 0.94, 0.9), cap); }
        } else {
          // cloud-wrapped: slow swirls in soft bands
          float w = fbm3(q*1.4 + vec3(0.0, 0.0, lon*0.2));
          float v = lat*3.0 + w*2.2 + 0.4*sin(lon*2.0 + w*5.0);
          float k = floor(v*1.6); base = pal(k); base = mix(base, uPal[3], 0.25*step(0.62, fbm3(q*4.0)));
        }
        vec3 n = normalize(vN), v = normalize(cameraPosition - vW), l = normalize(mix(normalize(uSun - vW), v, uView));   // the key leans toward the viewer: every planet reads
        float nl = dot(n, l), rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        gl_FragColor = vec4(toonLight(base, nl, rim), 1.0);
      }` });
  }
  // the ink hull: the back faces, pushed out along the normals and drawn dark
  const inkCache = {};
  function inkHull(geo, width, color = 0x0b0f1c){
    const key = width.toFixed(4) + ':' + color;
    const m = inkCache[key] || (inkCache[key] = (() => { const mm = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
      mm.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal)*' + width.toFixed(4) + ';'); };
      mm.customProgramCacheKey = () => 'sk-ink' + key; return mm; })());
    return new THREE.Mesh(geo, m);
  }
  // Saturn's (and Uranus's faint) rings: painted bands, lit from the Sun, darkened where the planet's shadow falls
  function makeRings(radius, inner, outer, look = 'saturn'){
    const geo = new THREE.RingGeometry(radius*inner, radius*outer, 192, 1);
    const u = { uView: { value: KEY_TO_VIEW }, uSun: { value: new THREE.Vector3() }, uCtr: { value: new THREE.Vector3() }, uR: { value: radius }, uIn: { value: radius*inner }, uOut: { value: radius*outer }, uFaint: { value: look === 'uranus' ? 1 : 0 } };
    const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying vec3 vW; varying float vR; void main(){ vR = length(position.xy); vW = (modelMatrix*vec4(position, 1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vW, 1.0); }`,
      fragmentShader: `uniform vec3 uSun, uCtr; uniform float uR, uIn, uOut, uFaint, uView; varying vec3 vW; varying float vR;
        float h1(float x){ return fract(sin(x*127.1)*43758.5453); }
        void main(){ float t = (vR - uIn)/(uOut - uIn);
          float a, b = 0.0; vec3 c;
          if (uFaint > 0.5){ a = 0.55*step(0.5, fract(t*3.0))*smoothstep(0.0, 0.05, t)*smoothstep(1.0, 0.95, t); c = vec3(0.75, 0.86, 0.88); }
          else {
            float k = floor(t*28.0), band = 0.55 + 0.45*h1(k);
            a = mix(0.45, 0.95, band)*smoothstep(0.0, 0.04, t)*smoothstep(1.0, 0.96, t);
            a *= 1.0 - 0.92*smoothstep(0.012, 0.0, abs(t - 0.62) - 0.02);        // Cassini division
            c = mix(vec3(0.79, 0.7, 0.53), vec3(0.93, 0.86, 0.69), band); c = mix(c, vec3(0.7, 0.62, 0.48), smoothstep(0.62, 1.0, t)*0.5);
          }
          // the planet's shadow on the rings: does the line to the Sun pass through the planet?
          vec3 L = normalize(mix(normalize(uSun - vW), normalize(cameraPosition - vW), uView)), oc = vW - uCtr; float pb = dot(oc, L);
          float dist = sqrt(max(dot(oc, oc) - pb*pb, 0.0)), shadow = step(pb, 0.0)*smoothstep(uR*1.03, uR*0.93, dist);
          c *= mix(1.0, 0.35, shadow);
          gl_FragColor = vec4(c, a); }` });
    const mesh = new THREE.Mesh(geo, m); mesh.userData.u = u; return mesh;
  }
  // a planet: body, ink, and (for Saturn and Uranus) rings; call update(sunWorld, t) each frame
  function makePlanet(name, radius, { tilt = 0, ink = 0.035, segments = 64 } = {}){
    const g = new THREE.Group(), tiltG = new THREE.Group(); tiltG.rotation.z = tilt; g.add(tiltG);
    const geo = new THREE.SphereGeometry(radius, segments, Math.round(segments*0.66)), mat = planetMaterial(name), body = new THREE.Mesh(geo, mat);
    tiltG.add(body); body.add(inkHull(geo, radius*ink));
    let rings = null;
    if (name === 'saturn'){ rings = makeRings(radius, 1.3, 2.3); rings.rotation.x = -Math.PI/2; tiltG.add(rings); }
    if (name === 'uranus'){ rings = makeRings(radius, 1.5, 1.9, 'uranus'); rings.rotation.x = -Math.PI/2; tiltG.add(rings); }
    const spinRate = { mercury: 0.05, venus: -0.02, moon: 0.03, mars: 0.25, jupiter: 0.6, saturn: 0.55, uranus: -0.35, neptune: 0.4 }[name] || 0.2;
    const wp = new THREE.Vector3();
    function update(sun, t){ mat.uniforms.uSun.value.copy(sun); mat.uniforms.uSpin.value = t*spinRate;
      if (rings){ g.getWorldPosition(wp); rings.userData.u.uSun.value.copy(sun); rings.userData.u.uCtr.value.copy(wp); } }
    return { group: g, body, rings, radius, update };
  }
  // the Sun: banded toon disc with a boiling surface, and a flame-edged corona with an ink rim
  function makeSun(R, uT){
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 40), new THREE.ShaderMaterial({ uniforms: { uT },
      vertexShader: `varying vec3 vN, vP, vV; void main(){ vN = normalize(normalMatrix*normal); vP = position; vec4 mv = modelViewMatrix*vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uT; varying vec3 vN, vP, vV;` + NOISE + `
        void main(){ float f = dot(normalize(vN), normalize(vV)); vec3 p = vP/` + (R*0.3).toFixed(2) + `;
          float boil = n3(p + vec3(0.0, uT*0.35, 0.0))*0.6 + n3(p*2.3 - vec3(uT*0.5))*0.4;
          float k = f + (boil - 0.5)*0.28;
          vec3 c = k > 0.62 ? vec3(1.0, 0.97, 0.78) : k > 0.38 ? vec3(1.0, 0.86, 0.42) : k > 0.16 ? vec3(1.0, 0.66, 0.24) : vec3(0.93, 0.42, 0.16);
          float cell = smoothstep(0.62, 0.7, n3(p*3.1 + uT*0.2)); c = mix(c, c*vec3(1.0, 0.9, 0.75), cell*0.35);
          gl_FragColor = vec4(c*1.12, 1.0); }` }));
    g.add(core);
    const corona = new THREE.Mesh(new THREE.PlaneGeometry(R*6, R*6), new THREE.ShaderMaterial({ uniforms: { uT }, transparent: true, depthWrite: false,
      vertexShader: `varying vec2 vU; void main(){ vU = uv*2.0 - 1.0; vec4 mv = modelViewMatrix*vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uT; varying vec2 vU;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), u.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y); }
        void main(){ float r = length(vU)*3.0, a = atan(vU.y, vU.x);
          float fl = 1.0 + 0.16*vn(vec2(a*5.0, uT*0.9)) + 0.1*vn(vec2(a*13.0 + 3.0, uT*1.7)) + 0.05*sin(a*23.0 + uT*2.0);
          float inside = step(r, fl), rim = smoothstep(fl - 0.035, fl - 0.012, r)*inside;
          vec3 c = mix(vec3(1.0, 0.58, 0.18), vec3(1.0, 0.8, 0.35), smoothstep(fl, 1.0, r));
          float glow = exp(-(r - 1.0)*2.2)*0.55*step(1.0, r);
          float ray = pow(max(0.0, sin(a*9.0 + uT*0.25)), 18.0)*exp(-(r - 1.0)*1.3)*0.25;
          vec4 o = vec4(c, inside*step(0.98, r));
          o.rgb = mix(o.rgb, vec3(0.45, 0.16, 0.06), rim);
          o = mix(vec4(vec3(1.0, 0.75, 0.4)*(glow + ray), glow + ray), o, o.a);
          gl_FragColor = o; }` }));
    corona.renderOrder = 2; g.add(corona);
    return { group: g, core, corona };
  }
  // an orbit: a dashed line that fades out close to the camera (so it never slices across the view in big dashes)
  function orbitLine(points, color = 0x8a9bc6, opacity = 0.34, dash = 1){
    const pos = [], along = []; let s = 0;
    points.forEach((p, i) => { if (i) s += p.distanceTo(points[i - 1]); pos.push(p.x, p.y, p.z); along.push(s); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uC: { value: new THREE.Color(color) }, uA: { value: opacity }, uDash: { value: s/(160*dash) }, uNear: { value: 1 } },
      vertexShader: `attribute float along; uniform float uDash; varying float vS, vD; void main(){ vS = along/uDash; vec4 mv = modelViewMatrix*vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uC; uniform float uA, uNear; varying float vS, vD; void main(){ if (fract(vS) > 0.58) discard; gl_FragColor = vec4(uC, uA*smoothstep(uNear*0.4, uNear, vD)); }` });
    const line = new THREE.Line(g, m); line.frustumCulled = false; return line;
  }
  const circle = (r, n = 256) => { const pts = []; for (let i = 0; i <= n; i++){ const a = i/n*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(a)*r, 0, Math.sin(a)*r)); } return pts; };
  // the sky: stars, thicker along the Milky Way, over a faint printed haze
  function makeSky(R, uT, seed = 8){
    const g = new THREE.Group();
    const rnd = (a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a>>>15, 1|a); t = t + Math.imul(t ^ t>>>7, 61|t) ^ t; return ((t ^ t>>>14)>>>0)/4294967296; })(seed);
    const N = 9000, pos = new Float32Array(N*3), col = new Float32Array(N*3), siz = new Float32Array(N), ph = new Float32Array(N);
    const band = new THREE.Vector3(0.3, 0.8, -0.52).normalize(), v = new THREE.Vector3();
    for (let i = 0; i < N; i++){ const u = rnd()*2 - 1, a = rnd()*Math.PI*2, s = Math.sqrt(1 - u*u); v.set(s*Math.cos(a), u, s*Math.sin(a));
      if (i % 5 < 2) v.addScaledVector(band, -v.dot(band)*(1 - (rnd() - 0.5)*0.35)).normalize();
      pos.set([v.x*R, v.y*R, v.z*R], i*3); const t = rnd(), c = t < 0.15 ? [1, 0.82, 0.62] : t < 0.3 ? [0.7, 0.8, 1] : [0.96, 0.96, 1]; col.set(c, i*3);
      siz[i] = rnd() < 0.03 ? 3.6 + rnd()*1.8 : 1.1 + rnd()*rnd()*2.2; ph[i] = rnd()*100; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(siz, 1)); geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    const sm = new THREE.ShaderMaterial({ uniforms: { uT, uPx: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float size, phase; attribute vec3 color; uniform float uT, uPx; varying vec3 vC; varying float vA;
        void main(){ vC = color; vA = 0.65 + 0.35*sin(uT*(1.3 + fract(phase)*2.5) + phase); gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); gl_PointSize = size*uPx; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vC*vA*a*a, 1.0); }` });
    const stars = new THREE.Points(geo, sm); stars.frustumCulled = false; stars.renderOrder = -2; g.add(stars);
    const haze = new THREE.Mesh(new THREE.SphereGeometry(R*1.1, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { uB: { value: band } },
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uB; varying vec3 vD;` + NOISE + `
        void main(){ float b = exp(-pow(dot(vD, uB)/0.2, 2.0)); float n = n3(vD*5.0)*0.6 + n3(vD*13.0)*0.3 + n3(vD*31.0)*0.1;
          float dust = smoothstep(0.55, 0.75, n3(vD*9.0 + 4.0))*b;
          vec3 c = vec3(0.075, 0.08, 0.13)*b*(0.45 + n) + vec3(0.09, 0.07, 0.1)*pow(b, 3.0)*n - vec3(0.03)*dust;
          c = floor(c*60.0 + 0.5)/60.0;
          gl_FragColor = vec4(max(c, 0.0) + vec3(0.008, 0.01, 0.025), 1.0); }` }));
    haze.renderOrder = -3; haze.frustumCulled = false; g.add(haze);
    return { group: g, stars, starMat: sm, haze };
  }
  // the Earth: the illustrated map, toon-lit; toon clouds; a thin atmosphere on the day side; an ink hull (no halo shells)
  function makeEarth(R, map, uT){
    const U = { uMap: { value: map }, uSun: { value: new THREE.Vector3() }, uT, uPing: { value: 0 }, uClear: { value: new THREE.Vector3(0, 1, 0) }, uCloudA: { value: 1 } };
    const earth = new THREE.Group(), spin = new THREE.Group(); earth.add(spin);
    const LF = `
      float bands(float nl){ return nl < -0.06 ? 0.0 : nl < 0.14 ? 0.6 : nl < 0.42 ? 0.84 : 1.0; }
      vec3 shade(vec3 base, float nl){ float b = bands(nl); vec3 night = base*vec3(0.16, 0.19, 0.28) + vec3(0.012, 0.022, 0.06);
        vec3 c = b > 0.0 ? base*b : night; c += vec3(0.95, 0.5, 0.25)*0.18*exp(-pow((nl + 0.02)/0.06, 2.0)); return c; }`;
    const geo = new THREE.SphereGeometry(R, 128, 96);
    const globe = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: U,
      vertexShader: `varying vec2 vUv; varying vec3 vN, vW, vL; void main(){ vUv = uv; vL = position; vN = normalize(mat3(modelMatrix)*normal); vW = (modelMatrix*vec4(position, 1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vW, 1.0); }`,
      fragmentShader: `uniform sampler2D uMap; uniform vec3 uSun, uClear; uniform float uPing; varying vec2 vUv; varying vec3 vN, vW, vL;` + LF + `
        void main(){ vec3 base = texture2D(uMap, vUv).rgb; vec3 n = normalize(vN); float nl = dot(n, normalize(uSun - vW)); vec3 c = shade(base, nl);
          float rim = pow(1.0 - max(dot(n, normalize(cameraPosition - vW)), 0.0), 3.0); c += vec3(0.3, 0.5, 0.9)*0.25*rim*(1.0 - step(0.0, nl));
          float d = acos(clamp(dot(normalize(vL), normalize(uClear)), -1.0, 1.0));
          for (int k = 0; k < 2; k++){ float ph = uPing - float(k)*0.9; if (ph > 0.0 && ph < 2.2){ float r = ph*0.045, w = 0.0025 + ph*0.001;
            c = mix(c, vec3(0.99, 0.82, 0.33), smoothstep(w, 0.0, abs(d - r))*(1.0 - ph/2.2)*0.95); } }
          if (uPing > 0.0) c = mix(c, vec3(1.0, 0.86, 0.4), smoothstep(0.006, 0.003, d)*smoothstep(0.0, 0.3, uPing));
          gl_FragColor = vec4(c, 1.0); }` }));
    spin.add(globe); globe.add(inkHull(geo, R*0.018, 0x0b1020));
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(R*1.012, 128, 96), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, extensions: { derivatives: true },
      vertexShader: `varying vec3 vP, vN, vW; void main(){ vP = position; vN = normalize(mat3(modelMatrix)*normal); vW = (modelMatrix*vec4(position, 1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vW, 1.0); }`,
      fragmentShader: `uniform vec3 uSun, uClear; uniform float uT, uCloudA; varying vec3 vP, vN, vW;` + LF + NOISE + `
        void main(){ vec3 p = normalize(vP); float lat = abs(p.y);
          vec3 q = p*5.0 + vec3(uT*0.012, 0.0, 0.0);
          float n = n3(q)*0.5 + n3(q*2.1 + 3.1)*0.27 + n3(q*4.6 - 1.3)*0.15 + n3(q*9.8)*0.08;
          n += 0.1*sin(p.y*11.0 + n3(q*0.7)*4.0) - 0.12*smoothstep(0.12, 0.3, lat)*smoothstep(0.55, 0.32, lat);
          n -= 0.28*smoothstep(0.985, 0.998, dot(p, normalize(uClear)));
          float th = 0.63, aa = fwidth(n)*1.2 + 0.002;
          float m = smoothstep(th - aa, th + aa, n), ink = smoothstep(th - aa*2.5, th, n) - smoothstep(th + aa*0.5, th + aa*3.0, n);
          float nl = dot(normalize(vN), normalize(uSun - vW)), lit = bands(nl);
          vec3 c = shade(n > th + 0.07 ? vec3(0.99, 0.99, 1.0) : vec3(0.83, 0.88, 0.95), nl);
          float day = smoothstep(-0.2, 0.05, nl);
          vec4 o = vec4(c, m*mix(0.45, 0.96, day));
          o = mix(o, vec4(vec3(0.34, 0.42, 0.58)*max(0.2, step(0.01, lit)), 0.85*mix(0.3, 1.0, day)), ink*0.7);
          gl_FragColor = vec4(o.rgb, o.a*uCloudA); }` }));
    spin.add(clouds);
    // the atmosphere: a thin blue limb, only where the Sun reaches, added on top (it never darkens anything)
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R*1.045, 96, 64), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 vN, vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vW = (modelMatrix*vec4(position, 1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vW, 1.0); }`,
      fragmentShader: `uniform vec3 uSun; varying vec3 vN, vW;
        void main(){ vec3 n = -normalize(vN), v = normalize(cameraPosition - vW); float x = max(dot(n, v), 0.0);
          float lit = smoothstep(-0.25, 0.35, dot(-n, normalize(uSun - vW)));
          float a = pow(smoothstep(0.0, 0.45, x), 1.5)*(1.0 - smoothstep(0.45, 0.9, x));
          gl_FragColor = vec4(vec3(0.38, 0.66, 1.0)*a*lit*0.9, 1.0); }` }));
    earth.add(atmo);
    return { group: earth, spin, globe, clouds, atmo, U, update(sun){ U.uSun.value.copy(sun); } };
  }
  function setKeyToView(k){ KEY_TO_VIEW = k; }
  return { setKeyToView, planetMaterial, makePlanet, makeRings, makeSun, orbitLine, circle, makeSky, makeEarth, inkHull, LOOKS };
})();
