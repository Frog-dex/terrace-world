/* Prepared by: Codex.
 * Ground hardware for the isolated town sign. All dimensions are world units.
 * This owns no animation, camera, town assets, lights, or persistence.
 *
 * Integration (after the mechanism's world matrices have been updated):
 *   const base = assembly.localToWorld(new THREE.Vector3(172, -806, -180));
 *   footing.update(base, signRoot.rotation.y + assembly.rotation.y,
 *     town && !cleanPlate && !hideControl.checked,
 *     signRoot.scale.x / (.0065 * 640 / 520));
 * Keep this group in the root scene, not the environment group that is hidden
 * for film playback. Remove the original 80 x 10 x 80 foot plate; keep the pole.
 */

export function createSignFooting(THREE) {
  if (!THREE?.Group || !THREE?.MeshStandardMaterial) {
    throw new TypeError('Sign footing requires the current Three.js namespace.');
  }
  const group = new THREE.Group();
  group.name = 'Sign footing: buried concrete, socket, anchors and soil contact';
  group.visible = false;
  const resources = new Set();
  let disposed = false;
  const own = resource => (resources.add(resource), resource);
  const material = (color, roughness, metalness = 0) => own(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  const concrete = material(0x9e9787, .98);
  const edgeConcrete = material(0x898275, 1);
  const iron = material(0x443a30, .67, .5);
  const rubbedIron = material(0x6d604c, .48, .62);
  const weld = material(0x392e24, .86, .35);
  const gravel = material(0x947650, 1);
  const mesh = (geometry, surface, name) => {
    const result = new THREE.Mesh(own(geometry), surface);
    result.name = name;
    result.castShadow = true;
    result.receiveShadow = true;
    group.add(result);
    return result;
  };
  const box = (w, h, d, x, y, z, surface, name) => {
    const result = mesh(new THREE.BoxGeometry(w, h, d), surface, name);
    result.position.set(x, y, z);
    return result;
  };
  const cylinder = (radius, height, sides, x, y, z, surface, name) => {
    const result = mesh(new THREE.CylinderGeometry(radius, radius, height, sides), surface, name);
    result.position.set(x, y, z);
    return result;
  };

  // A chamfered footing with an imperfect casting outline. The bottom 11 cm
  // is below the anchor plane, so it never reads as a block resting on sand.
  const outline = new THREE.Shape();
  const perimeter = [
    [-.397, -.38], [.381, -.376], [.435, -.331], [.44, .317],
    [.384, .374], [-.383, .38], [-.438, .322], [-.44, -.324],
  ];
  perimeter.forEach(([x, z], index) => index ? outline.lineTo(x, z) : outline.moveTo(x, z));
  outline.closePath();
  const blockGeometry = new THREE.ExtrudeGeometry(outline, {
    depth: .19, bevelEnabled: true, bevelThickness: .024,
    bevelSize: .018, bevelSegments: 1, steps: 1, curveSegments: 1,
  });
  blockGeometry.rotateX(-Math.PI / 2);
  const block = mesh(blockGeometry, concrete, 'Partly buried chamfered concrete pier');
  block.position.y = -.07;

  // The socket continues below the plate and grips the retained 16 cm pole.
  // Four separate faces leave a genuine hollow opening instead of capping it.
  box(.62, .048, .56, 0, .157, 0, iron, 'Thick steel anchor plate');
  const socketY = .29, socketH = .33, outer = .228, wall = .026;
  for (const side of [-1, 1]) {
    box(wall, socketH, outer, side * (outer - wall) / 2, socketY, 0, iron, 'Socket side');
    box(outer - wall * 2, socketH, wall, 0, socketY, side * (outer - wall) / 2, iron, 'Socket face');
  }
  for (const side of [-1, 1]) {
    box(.014, .014, .234, side * .113, .459, 0, rubbedIron, 'Socket worn lip');
    box(.206, .014, .014, 0, .459, side * .113, rubbedIron, 'Socket worn lip');
  }

  // Real triangular gussets join socket and plate, not a decorative brace
  // hovering behind either piece. The profile is extruded perpendicular to it.
  const gussetShape = new THREE.Shape();
  gussetShape.moveTo(.114, .181);
  gussetShape.lineTo(.275, .181);
  gussetShape.lineTo(.114, .397);
  gussetShape.closePath();
  const gussetGeometry = new THREE.ExtrudeGeometry(gussetShape, {
    depth: .019, bevelEnabled: false, steps: 1, curveSegments: 1,
  });
  gussetGeometry.translate(0, 0, -.0095);
  for (let side = 0; side < 4; side++) {
    const brace = mesh(gussetGeometry, iron, 'Welded triangular socket gusset');
    brace.rotation.y = side * Math.PI / 2;
  }
  box(.224, .009, .009, 0, .183, .12, weld, 'Socket weld bead');
  box(.224, .009, .009, 0, .183, -.12, weld, 'Socket weld bead');

  for (const x of [-.239, .239]) for (const z of [-.205, .205]) {
    cylinder(.047, .009, 20, x, .185, z, rubbedIron, 'Anchor washer');
    const nut = cylinder(.032, .036, 6, x, .2075, z, iron, 'Hex anchor nut');
    nut.rotation.y = Math.PI / 6;
    cylinder(.015, .017, 12, x, .234, z, rubbedIron, 'Exposed anchor stud');
  }
  // Small casting blemishes stay on the pier sides, clear of the hardware.
  for (let i = 0; i < 7; i++) {
    const chip = box(.022 + (i % 3) * .01, .01, .004, -.28 + i * .091,
      .084 + Math.sin(i * 1.7) * .008, .3805, edgeConcrete, 'Casting aggregate');
    chip.rotation.z = Math.sin(i * 2) * .25;
  }

  // The dust is a low-contrast irregular contact collar, not a hard-edged
  // fake shadow. Its alpha tapers to zero before every edge of the plane.
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size * 2 - 1, v = (y + .5) / size * 2 - 1;
    const r = Math.pow(Math.pow(Math.abs(u), 5) + Math.pow(Math.abs(v), 5), 1 / 5);
    const irregularity = Math.sin(u * 23 + v * 8) * .032 + Math.cos(v * 27 - u * 11) * .023;
    const fade = Math.max(0, Math.min(1, (.92 - r + irregularity) / .2));
    const grain = .83 + .17 * Math.sin(x * 19.17 + y * 31.23);
    const index = (y * size + x) * 4;
    pixels[index] = 110; pixels[index + 1] = 87; pixels[index + 2] = 59;
    pixels[index + 3] = Math.round(51 * fade * grain);
  }
  const dirtTexture = own(new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat));
  dirtTexture.colorSpace = THREE.SRGBColorSpace;
  dirtTexture.magFilter = dirtTexture.minFilter = THREE.LinearFilter;
  dirtTexture.needsUpdate = true;
  const dirtMaterial = own(new THREE.MeshBasicMaterial({
    map: dirtTexture, transparent: true, opacity: 1, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  const dirt = mesh(new THREE.PlaneGeometry(1.24, 1.08), dirtMaterial, 'Uneven earth contact collar');
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.y = .007;
  dirt.castShadow = dirt.receiveShadow = false;
  for (let i = 0; i < 15; i++) {
    const a = i * 2.399963;
    const x = Math.cos(a) * (.47 + (i % 4) * .023);
    const z = Math.sin(a) * (.42 + (i % 3) * .021);
    const stone = mesh(new THREE.DodecahedronGeometry(.018 + (i % 3) * .004, 0), gravel, 'Small footing aggregate');
    stone.position.set(x, .01, z);
    stone.scale.set(1.3, .6, 1);
    stone.rotation.set(i * .7, a, i * .3);
  }

  return {
    group,
    update(anchor, yaw = 0, visible = true, scale = 1) {
      if (disposed) return;
      const p = anchor?.isVector3 ? anchor : Array.isArray(anchor) ? new THREE.Vector3(...anchor) : null;
      if (!p || ![p.x, p.y, p.z, yaw, scale].every(Number.isFinite) || scale <= 0) {
        throw new TypeError('Footing update needs a finite ground anchor, yaw, and positive scale.');
      }
      group.position.copy(p);
      group.rotation.set(0, yaw, 0);
      group.scale.setScalar(scale);
      group.visible = !!visible;
      group.updateMatrixWorld(true);
    },
    getState() {
      return {
        disposed, visible: group.visible, anchor: group.position.toArray(),
        yaw: group.rotation.y, scale: group.scale.x,
        concrete: { width: .916, depth: .796, top: .144, buried: .094 },
        socket: { width: .228, opening: .176, top: .466 },
        plate: { width: .62, depth: .56, top: .181 },
        anchorBolts: 4, gussets: 4,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.visible = false;
      group.removeFromParent();
      group.clear();
      resources.forEach(resource => resource.dispose());
      resources.clear();
    },
  };
}
