/* Prepared by: Codex.
 * A small, live reflection probe for the portal-adjacent copper. This samples
 * the SAME moving portal texture that is on screen. It adds no glow, lights,
 * surface emission, full-scene recapture, or animation loop of its own.
 *
 * const reflections = createPortalReflections(THREE, renderer, {
 *   portalTexture, refreshHz: 8, resolution: 64, intensity: .72,
 *   sunDirection: key.position.clone().sub(key.target.position),
 * });
 * reflections.attach([innerRim, outerRim, ...bandFaceMeshes]);
 * // AFTER assembly.updateWorldMatrix(true, true), BEFORE the visible render:
 * reflections.update(worldTime, {
 *   quaternion: assembly.getWorldQuaternion(new THREE.Quaternion()),
 *   strength: settings.energy,
 * });
 *
 * attach accepts one mesh, an array of meshes, or a group. Use a `filter`
 * option when attaching a group. Only MeshStandard/Physical materials are
 * cloned; all original maps, colours, engraving hooks and geometry survive.
 * dispose restores each original material and releases this probe's targets.
 */

export function createPortalReflections(THREE, renderer, options = {}) {
  if (!THREE?.PMREMGenerator || !renderer?.isWebGLRenderer) {
    throw new TypeError('Portal reflections require Three.js and the existing WebGL renderer.');
  }
  const clamp = THREE.MathUtils.clamp;
  const resolution = clamp(2 ** Math.round(Math.log2(options.resolution || 64)), 32, 128);
  const refreshHz = clamp(options.refreshHz || 8, 1, 12);
  const intensity = clamp(options.intensity ?? .72, 0, 2);
  const resources = new Set(), attached = new Map();
  const own = resource => (resources.add(resource), resource);
  const probeScene = new THREE.Scene();
  probeScene.name = 'Local portal reflection probe, never displayed';
  const sunDirection = options.sunDirection?.isVector3
    ? options.sunDirection.clone()
    : new THREE.Vector3(...(options.sunDirection || [-.55, .64, .54]));
  if (sunDirection.lengthSq() < 1e-8) sunDirection.set(-.55, .64, .54);
  sunDirection.normalize();

  // The directional sun patch is intentionally small and only exists INSIDE
  // the reflection map. Roughness spreads it naturally across the metal; no
  // screen-space radial halo or fake additive rim is applied to the scene.
  const skyMaterial = own(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    uniforms: {
      sunDirection: { value: sunDirection },
      zenith: { value: new THREE.Color(0x9ab7c7) },
      horizon: { value: new THREE.Color(0xd2c5ab) },
      ground: { value: new THREE.Color(0x806744) },
      sunColour: { value: new THREE.Color(0xffefd7) },
    },
    vertexShader: `varying vec3 direction;
      void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 direction;
      uniform vec3 sunDirection,zenith,horizon,ground,sunColour;
      void main(){
        vec3 ray=normalize(direction);
        float height=max(0.,ray.y);
        vec3 sky=mix(horizon,zenith,pow(height,.6));
        sky=mix(ground*.68,sky,smoothstep(-.13,.11,ray.y));
        float sunlight=pow(max(0.,dot(ray,sunDirection)),160.);
        float warmAir=pow(max(0.,dot(ray,sunDirection)),7.);
        vec3 radiance=sky*.72+sunColour*(sunlight*2.6+warmAir*.075);
        gl_FragColor=vec4(radiance,1.);
      }`,
  }));
  const dome = new THREE.Mesh(own(new THREE.SphereGeometry(25, 16, 8)), skyMaterial);
  probeScene.add(dome);

  // A real planar source has dark portions as well as bright ones. Capture
  // it just behind the representative inner-rim sampling point. This is a
  // local approximation, not screen-space projection onto unrelated surfaces.
  const portalMaterial = own(new THREE.MeshBasicMaterial({
    map: options.portalTexture || null, color: 0xffffff,
    side: THREE.DoubleSide, toneMapped: false,
  }));
  const portal = new THREE.Mesh(own(new THREE.CircleGeometry(1.15, 48)), portalMaterial);
  portal.position.z = -.76;
  portal.visible = !!options.portalTexture;
  probeScene.add(portal);
  const target = own(new THREE.WebGLCubeRenderTarget(resolution, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    generateMipmaps: false, depthBuffer: true,
  }));
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const probeCamera = new THREE.CubeCamera(.01, 50, target);
  const generator = new THREE.PMREMGenerator(renderer);
  let pmrem = null, disposed = false, lastCapture = -Infinity;
  let captures = 0, lastSourceTime = null, lastStrength = 1, error = '';
  const direction = new THREE.Vector3(0, 0, -.76), identity = new THREE.Quaternion();

  const setMap = texture => {
    for (const { replacements } of attached.values()) for (const material of replacements) {
      if (!material) continue;
      const firstMap = material.envMap !== texture;
      material.envMap = texture;
      if (firstMap) material.needsUpdate = true;
    }
  };

  function attach(subject, settings = {}) {
    if (disposed) throw new Error('This portal reflection probe has been disposed.');
    const list = Array.isArray(subject) ? subject : [subject];
    let count = 0;
    const visit = object => {
      if (!object?.isMesh || attached.has(object) || (settings.filter && !settings.filter(object))) return;
      const original = object.material;
      const originalList = Array.isArray(original) ? original : [original];
      const replacements = originalList.map(material => {
        if (!material?.isMeshStandardMaterial) return null;
        const next = material.clone();
        // Material.copy does not preserve custom shader callbacks. Engraving,
        // globe cutouts and custom cache keys must remain exactly as authored.
        next.onBeforeCompile = material.onBeforeCompile;
        next.customProgramCacheKey = material.customProgramCacheKey;
        next.envMap = pmrem?.texture || null;
        next.envMapIntensity = clamp(settings.intensity ?? intensity, 0, 2);
        if (settings.roughness !== undefined) next.roughness = clamp(settings.roughness, .2, 1);
        next.name = `${material.name || 'Copper'} - live portal reflection`;
        next.needsUpdate = true;
        return next;
      });
      if (!replacements.some(Boolean)) return;
      const materials = originalList.map((material, index) => replacements[index] || material);
      object.material = Array.isArray(original) ? materials : materials[0];
      attached.set(object, { original, assigned: object.material, replacements });
      count++;
    };
    for (const root of list) if (root?.traverse) root.traverse(visit);
    return count;
  }

  function update(seconds, settings = {}) {
    if (disposed || !Number.isFinite(seconds)) return false;
    if (settings.portalTexture && settings.portalTexture !== portalMaterial.map) {
      portalMaterial.map = settings.portalTexture;
      portalMaterial.needsUpdate = true;
      lastCapture = -Infinity;
    }
    const hasNewTime = seconds >= lastCapture + 1 / refreshHz || seconds < lastCapture;
    if (!settings.force && !hasNewTime && Number.isFinite(lastCapture)) return false;
    const source = portalMaterial.map?.image;
    portal.visible = !!portalMaterial.map && (!source?.tagName || source.tagName !== 'VIDEO' || source.readyState >= 2);
    lastStrength = clamp(settings.strength ?? lastStrength, 0, 2);
    // The visible portal is restrained. It is not an HDR lamp or a colour-
    // changing diffuse flood; this radiance only appears in specular response.
    portalMaterial.color.setRGB(lastStrength * 1.3, lastStrength * 1.22, lastStrength * 1.05);
    const orientation = settings.quaternion || identity;
    portal.quaternion.copy(orientation);
    portal.position.copy(direction).applyQuaternion(orientation);
    if (settings.sunDirection) {
      if (settings.sunDirection.isVector3) sunDirection.copy(settings.sunDirection);
      else sunDirection.fromArray(settings.sunDirection);
      if (sunDirection.lengthSq() > 1e-8) sunDirection.normalize();
    }
    probeScene.updateMatrixWorld(true);

    // Both CubeCamera and PMREM touch renderer state. Restore the caller's
    // state even when WebGL capture fails, so the main composite keeps working.
    const saved = {
      target: renderer.getRenderTarget(), face: renderer.getActiveCubeFace(),
      level: renderer.getActiveMipmapLevel(), viewport: renderer.getViewport(new THREE.Vector4()),
      scissor: renderer.getScissor(new THREE.Vector4()), scissorTest: renderer.getScissorTest(),
      clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(),
      autoClear: renderer.autoClear, toneMapping: renderer.toneMapping,
      exposure: renderer.toneMappingExposure, xr: renderer.xr.enabled,
      shadowAutoUpdate: renderer.shadowMap.autoUpdate,
    };
    try {
      renderer.autoClear = true;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      probeCamera.update(renderer, probeScene);
      // Reuse the same PMREM render target. No render-target allocation or
      // disposal per tick, and no texture readback/canvas/video copy on the CPU.
      pmrem = generator.fromCubemap(target.texture, pmrem);
      setMap(pmrem.texture);
      lastCapture = seconds;
      lastSourceTime = Number.isFinite(source?.currentTime) ? source.currentTime : null;
      captures++;
      error = '';
      return true;
    } catch (cause) {
      error = cause?.message || String(cause);
      // Retry at the bounded frequency, not every animation frame.
      lastCapture = seconds;
      return false;
    } finally {
      renderer.setRenderTarget(saved.target, saved.face, saved.level);
      renderer.setViewport(saved.viewport);
      renderer.setScissor(saved.scissor);
      renderer.setScissorTest(saved.scissorTest);
      renderer.setClearColor(saved.clear, saved.alpha);
      renderer.autoClear = saved.autoClear;
      renderer.toneMapping = saved.toneMapping;
      renderer.toneMappingExposure = saved.exposure;
      renderer.xr.enabled = saved.xr;
      renderer.shadowMap.autoUpdate = saved.shadowAutoUpdate;
    }
  }

  return {
    attach, update,
    getState() {
      return {
        disposed, ready: !!pmrem, resolution, refreshHz,
        attachedMeshes: attached.size, captures,
        lastCapture: Number.isFinite(lastCapture) ? lastCapture : null,
        portalTime: lastSourceTime, strength: lastStrength, error,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [mesh, entry] of attached) {
        if (mesh.material === entry.assigned) mesh.material = entry.original;
        entry.replacements.forEach(material => material?.dispose());
      }
      attached.clear();
      pmrem?.dispose();
      generator.dispose();
      resources.forEach(resource => resource.dispose());
      resources.clear();
      probeScene.clear();
    },
  };
}
