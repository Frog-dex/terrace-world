/* Prepared by: Codex.
 * Standalone afternoon atmosphere for the town study. No external assets,
 * renderer, animation loop, persistence, or canonical scene mutations.
 *
 * const sky = createTownSky(THREE, camera, { cloudSpeed: 38, brightness: 1 });
 * backgroundScene.add(sky.group);
 * sky.update(elapsedSeconds); // before rendering the background / native scene
 *
 * The opaque sky draws first without writing depth. It also works in a native
 * scene; ordinary geometry drawn afterwards remains in front. The caller must
 * not clear the colour buffer between a separate sky pass and its foreground.
 */

const VERTEX = /* glsl */`
  varying vec3 vWorldDirection;
  void main() {
    vWorldDirection = mat3(modelMatrix) * position;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // Keep the dome at far depth even when a caller uses a short camera.far.
    gl_Position = clip.xyww;
  }
`;

const FRAGMENT = /* glsl */`
  precision highp float;
  varying vec3 vWorldDirection;
  uniform float uTime;
  uniform float uCloudSpeed;
  uniform float uCoverage;
  uniform float uBrightness;
  uniform vec2 uWind;
  uniform vec3 uCameraPosition;
  uniform vec3 uSunDirection;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uWarmHorizon;
  uniform vec3 uCloudShade;
  uniform vec3 uCloudLight;

  float hash3(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 p) {
    vec3 cell = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(cell), hash3(cell + vec3(1,0,0)), f.x),
          mix(hash3(cell + vec3(0,1,0)), hash3(cell + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash3(cell + vec3(0,0,1)), hash3(cell + vec3(1,0,1)), f.x),
          mix(hash3(cell + vec3(0,1,1)), hash3(cell + vec3(1,1,1)), f.x), f.y), f.z);
  }

  float cloudShape(vec3 p, float fineDetail) {
    // Four coherent scales: rounded cloud bodies, billowing shoulders, wisps,
    // and a restrained edge breakup. All travel in the same world-space wind;
    // no time-varying noise makes the clouds boil. Fade only the finest scale
    // where a grazing ray's march spacing cannot resolve it cleanly.
    return noise3(p) * 0.64
      + noise3(p * 2.03 + vec3(13.2, 4.1, 7.7)) * 0.24
      + noise3(p * 4.07 + vec3(6.8, 17.3, 2.9)) * 0.09
      + mix(0.5, noise3(p * 8.11 + vec3(19.6, 8.2, 11.4)), fineDetail) * 0.03;
  }

  vec3 atmosphere(vec3 ray) {
    float elevation = max(ray.y, 0.0);
    float airPath = exp(-elevation * 5.2);
    vec3 sky = mix(uZenith, uHorizon, airPath);
    vec2 azimuth = normalize(ray.xz + vec2(0.00001));
    vec2 sunAzimuth = normalize(uSunDirection.xz);
    float sunward = pow(0.5 + 0.5 * dot(azimuth, sunAzimuth), 3.0);
    // Broad directional haze, never a concentric bloom behind an object.
    float warmth = sunward * exp(-elevation * 7.5) * 0.48;
    sky = mix(sky, uWarmHorizon, warmth);
    return mix(sky, uHorizon * 0.84, smoothstep(0.0, 0.32, -ray.y));
  }

  void main() {
    vec3 ray = normalize(vWorldDirection);
    vec3 sky = atmosphere(ray);
    vec3 colour = sky;
    // A world-space cloud slab gives each view ray a different distance and
    // volume. Real camera translation produces cloud parallax; rotation does
    // not drag a screen-space texture along with the view.
    const float cloudBase = 1350.0;
    const float cloudTop = 1800.0;
    if (ray.y > 0.15 && uCoverage > 0.0 && uCameraPosition.y < cloudTop) {
      float nearT = max(0.0, (cloudBase - uCameraPosition.y) / ray.y);
      float farT = (cloudTop - uCameraPosition.y) / ray.y;
      float stepLength = (farT - nearT) / 32.0;
      float fineDetail = 1.0 - smoothstep(0.045, 0.085, stepLength * 0.00135);
      // Fixed midpoints make adjacent rays continuous. Per-pixel march jitter
      // caused visible salt-and-pepper edges, even without temporal animation.
      vec3 accumulated = vec3(0.0);
      float transmittance = 1.0;
      // Clear lower atmosphere is intentional: far grazing rays otherwise
      // cross too many density cells and expose slices of the march as bands.
      // Fade the volume itself, not an opaque haze laid over its striping.
      float horizonFade = smoothstep(0.15, 0.38, ray.y);
      for (int sampleIndex = 0; sampleIndex < 32; sampleIndex++) {
        float distanceAlongRay = nearT + (float(sampleIndex) + 0.5) * stepLength;
        vec3 world = uCameraPosition + ray * distanceAlongRay;
        float heightInCloud = clamp((world.y - cloudBase) / (cloudTop - cloudBase), 0.0, 1.0);
        vec3 drift = vec3(uWind.x, 0.0, uWind.y) * uTime * uCloudSpeed;
        // A little height-dependent wind shear gives depth without boiling.
        vec3 p = (world - drift * (0.94 + heightInCloud * 0.12)) * 0.00135;
        p.y = heightInCloud * 1.75 + 5.8;
        vec3 shapePosition = p + vec3(23.4, 0.0, 9.2);
        float shape = cloudShape(shapePosition, fineDetail);
        float threshold = mix(0.70, 0.42, uCoverage);
        float density = smoothstep(threshold, threshold + 0.18, shape);
        // Denser cores rise into rounded crowns; the shoulders taper lower.
        // This adds a cumulus profile without introducing a second flat layer.
        float crown = mix(0.56, 0.82, smoothstep(0.54, 0.78, shape));
        density *= smoothstep(0.0, 0.14, heightInCloud)
          * (1.0 - smoothstep(crown, 1.0, heightInCloud));
        if (density > 0.002) {
          // Two broad light probes follow the actual sun direction. They give
          // the wind-carried lobes a lit face and a cooler body, rather than
          // drawing equally white noise over every cloud surface.
          vec3 sunPosition = shapePosition + uSunDirection * 0.28;
          float sunSample = noise3(sunPosition) * 0.73
            + noise3(sunPosition * 2.03 + vec3(13.2, 4.1, 7.7)) * 0.27;
          float light = clamp(0.45 + heightInCloud * 0.43
            + (shape - sunSample) * 1.1 - density * 0.08, 0.26, 0.96);
          vec3 cloudColour = mix(uCloudShade, uCloudLight, light);
          // Distant cloud bases merge into the same air as the horizon.
          float aerial = exp(-distanceAlongRay * 0.000070);
          cloudColour = mix(sky, cloudColour, aerial);
          float opacity = (1.0 - exp(-density * stepLength * 0.0055)) * horizonFade;
          accumulated += transmittance * opacity * cloudColour;
          transmittance *= 1.0 - opacity;
          if (transmittance < 0.015) break;
        }
      }
      colour = sky * transmittance + accumulated;
    }
    gl_FragColor = vec4(colour * uBrightness, 1.0);
    #include <colorspace_fragment>
  }
`;

// This camera shows a narrow slice of sky above the street. Eight world units
// per second was technically moving but read as a still image at that distance.
// Keep the existing volume and lighting; move its bodies far enough to be seen
// in a short glance, without speeding time up or restarting at the film seam.
const DEFAULTS = Object.freeze({ cloudSpeed: 38, coverage: 0.38, brightness: 1 });
const finiteRange = (value, name, low, high) => {
  if (!Number.isFinite(value) || value < low || value > high) {
    throw new RangeError(`${name} must be a finite number between ${low} and ${high}.`);
  }
  return value;
};

/**
 * Absolute-time animation: seeking/replaying never accumulates drift.
 * Options: cloudSpeed 0..60 (world units/s), coverage 0..1, brightness 0..2,
 * wind [x,z], sunDirection [x,y,z]. Colours are explicitly warm afternoon.
 * Capture and native rendering use the same group; no CSS background exists.
 */
export function createTownSky(THREE, camera, options = {}) {
  if (!THREE?.ShaderMaterial || !camera?.getWorldPosition) {
    throw new TypeError('createTownSky requires Three.js and a real camera.');
  }
  const group = new THREE.Group();
  group.name = 'Town afternoon atmosphere';
  group.renderOrder = -10000;
  const cameraPosition = new THREE.Vector3();
  const localPosition = new THREE.Vector3();
  const settings = { ...DEFAULTS };
  let elapsed = 0, disposed = false;
  const uniforms = {
    uTime: { value: 0 },
    uCloudSpeed: { value: DEFAULTS.cloudSpeed },
    uCoverage: { value: DEFAULTS.coverage },
    uBrightness: { value: DEFAULTS.brightness },
    uWind: { value: new THREE.Vector2(0.91, 0.41).normalize() },
    uCameraPosition: { value: cameraPosition },
    uSunDirection: { value: new THREE.Vector3(-0.55, 0.64, 0.54).normalize() },
    uZenith: { value: new THREE.Color('#4e83b5') },
    uHorizon: { value: new THREE.Color('#c5d9e3') },
    uWarmHorizon: { value: new THREE.Color('#f0dfc5') },
    uCloudShade: { value: new THREE.Color('#a5b6c4') },
    uCloudLight: { value: new THREE.Color('#fff6e9') },
  };
  const geometry = new THREE.SphereGeometry(1, 32, 20);
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT,
    side: THREE.BackSide, depthTest: false, depthWrite: false,
    transparent: false, toneMapped: false, fog: false,
  });
  material.name = 'Directional afternoon atmosphere and 3D cloud slab';
  const dome = new THREE.Mesh(geometry, material);
  dome.name = 'Far sky dome';
  dome.renderOrder = -10000;
  dome.frustumCulled = false;
  dome.raycast = () => {};
  group.add(dome);

  function setOptions(patch = {}) {
    if (disposed) return;
    const next = { ...settings };
    for (const [name, low, high] of [['cloudSpeed', 0, 60], ['coverage', 0, 1], ['brightness', 0, 2]]) {
      if (patch[name] !== undefined) next[name] = finiteRange(patch[name], name, low, high);
    }
    const wind = patch.wind === undefined ? uniforms.uWind.value.clone() : new THREE.Vector2(...patch.wind);
    const sun = patch.sunDirection === undefined ? uniforms.uSunDirection.value.clone() : new THREE.Vector3(...patch.sunDirection);
    if (![wind.x, wind.y, sun.x, sun.y, sun.z].every(Number.isFinite) || wind.lengthSq() < 0.000001 || sun.lengthSq() < 0.000001 || Math.hypot(sun.x, sun.z) < 0.000001) {
      throw new RangeError('Sky wind and sunDirection must be finite, non-zero directions; the sun requires a horizontal direction.');
    }
    Object.assign(settings, next);
    uniforms.uCloudSpeed.value = settings.cloudSpeed;
    uniforms.uCoverage.value = settings.coverage;
    uniforms.uBrightness.value = settings.brightness;
    uniforms.uWind.value.copy(wind).normalize();
    uniforms.uSunDirection.value.copy(sun).normalize();
  }

  function update(seconds = 0) {
    if (disposed) return;
    elapsed = finiteRange(seconds, 'Sky elapsed seconds', 0, Number.MAX_SAFE_INTEGER);
    camera.updateWorldMatrix(true, false);
    camera.getWorldPosition(cameraPosition);
    localPosition.copy(cameraPosition);
    if (group.parent) group.parent.worldToLocal(localPosition);
    group.position.copy(localPosition);
    // Large enough for an orthographic native scene, but projection writes
    // far depth so no local far-plane assumption clips the background.
    const radius = Math.max(1000, Number.isFinite(camera.far) ? camera.far * 0.45 : 10000);
    dome.scale.setScalar(radius);
    uniforms.uTime.value = elapsed;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    geometry.dispose();
    material.dispose();
    group.clear();
  }

  function getState() {
    return {
      ready: !disposed, disposed, seconds: elapsed,
      ...settings,
      wind: uniforms.uWind.value.toArray(),
      sunDirection: uniforms.uSunDirection.value.toArray(),
      cameraWorldPosition: cameraPosition.toArray(),
      cloudLayer: { base: 1350, top: 1800, marchSamples: 32, shapeOctaves: 4, sampling: 'continuous fixed midpoints', horizonFade: [0.15, 0.38] },
      style: 'directional warm afternoon with drifting cumulus bodies and coherent wisps',
      externalAssets: 0, ownsAnimationLoop: false,
    };
  }

  try { setOptions(options); update(0); }
  catch (error) { dispose(); throw error; }
  return { group, update, setOptions, dispose, getState };
}
