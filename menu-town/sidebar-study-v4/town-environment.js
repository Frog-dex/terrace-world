/* Prepared by: Codex.
 * Isolated, read-only adapter for the existing saved TOGA town. No editor,
 * persistence, replacement buildings, camera, or animation loop is installed.
 */
import { createTownPerspective } from '../../intro-town-perspective.js?v=terrain-flat-v4';
import { createRegionalRelief } from '../../intro-nevada-relief.js?v=complete-regional-v5';
import { createRegionalRoads } from '../../intro-regional-roads.js?v=terrain-flat-v4';

const SOURCE = new URL('../../assets/intro-nevada-v1/school-source/', import.meta.url);
const CLASSIC_MODULES = [
  ['toga-camera.js', 'TogaCamera'],
  ['toga-school-assets.js', 'TogaSchoolAssets'],
  ['toga-geometry.js', 'TogaGeometry'],
  ['toga-terrain.js', 'TogaTerrain'],
  ['toga-civilian.js', 'TogaCivilian'],
  ['toga-world.js', 'TogaWorld'],
  ['toga-assets.js', 'TogaAssets'],
  ['blackbird-model.js', 'TogaBlackbird'],
  ['toga-render.js', 'TogaRenderer'],
];
let sourceReady;

function loadClassic(file, exportedName) {
  if (globalThis[exportedName]) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(file, SOURCE).href;
    script.async = false;
    script.dataset.townEnvironmentSource = file;
    script.onload = () => {
      script.onload = script.onerror = null;
      if (globalThis[exportedName]) resolve();
      else reject(new Error(`${file} did not expose ${exportedName}.`));
    };
    script.onerror = () => {
      script.onload = script.onerror = null;
      script.remove();
      reject(new Error(`Original town module could not load: ${file}`));
    };
    document.head.appendChild(script);
  });
}

async function loadSourceWorld() {
  // Keep each source array object: original connect()/nearestRoad() close over
  // those arrays. Assigning cloned arrays would render the wrong old road plan.
  if (!sourceReady) sourceReady = (async () => {
    for (const [file, exportedName] of CLASSIC_MODULES) await loadClassic(file, exportedName);
    const response = await fetch(new URL('city-current.json', SOURCE));
    if (!response.ok) throw new Error(`Original town checkpoint returned HTTP ${response.status}.`);
    const city = await response.json();
    if (!city.terrain?.values?.length || !city.buildings?.length || !city.roads?.length) {
      throw new Error('The original town checkpoint is incomplete.');
    }
    if (!city.terrain.values.every(Number.isFinite)) throw new Error('Saved town terrain contains invalid heights.');
    const school = city.buildings.find(building => building.id === 'building-029');
    if (!school || !['x', 'y', 'w', 'd', 'h'].every(key => Number.isFinite(school[key]))) {
      throw new Error('The saved reference-school footprint is missing or invalid.');
    }
    const world = globalThis.TogaWorld;
    for (const key of ['buildings', 'roads', 'towers', 'parcels']) {
      if (!Array.isArray(city[key]) || !Array.isArray(world[key])) throw new Error(`Missing original town ${key}.`);
      world[key].splice(0, world[key].length, ...city[key]);
    }
    world.terrain = city.terrain;
    if (city.props) world.props = city.props;
    if (city.aircraft) world.aircraft = city.aircraft;
    world.source = { ...world.source, image: new URL('references/toga-original.jpeg', SOURCE).href };
    return world;
  })().catch(error => {
    sourceReady = null;
    throw error;
  });
  return sourceReady;
}

/**
 * Mount the real town into the caller's Y-up scene, in unchanged source units.
 * Source points are [X east/right, Y south/down, Z up]. The only registration
 * is group.rotation.x = -PI/2, so scene points are [X, Z, -Y].
 * The caller owns lighting, fog, camera, rendering, and sign geometry.
 */
export async function createTownEnvironment(THREE, scene) {
  if (!THREE?.Group || !scene?.add) throw new TypeError('A Three.js namespace and scene are required.');
  if (typeof document === 'undefined') throw new Error('The original terrain painter requires a browser document.');
  const world = await loadSourceWorld();
  const group = new THREE.Group();
  group.name = 'Original TOGA town environment, source units, Y-up registration';
  group.rotation.x = -Math.PI / 2;
  let town, relief, roads, disposed = false;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    roads?.dispose();
    relief?.dispose();
    town?.dispose();
    group.clear();
  };

  try {
    town = createTownPerspective(THREE, world);
    group.add(town.group);
    // Existing real-relief adapter fills the source terrain's edge feather and
    // provides the distant horizon for a street-height, slightly upward view.
    relief = await createRegionalRelief(THREE, { center: [512, 384], metresPerUnit: 2 });
    group.add(relief.group);
    const terrainHeight = (x, y) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Terrain sampling needs finite source X/Y.');
      return x >= 0 && x <= world.W && y >= 0 && y <= world.H
        ? town.terrainHeight(x, y) : relief.sampleRenderedSurface(x, y);
    };
    roads = createRegionalRoads(THREE, { world, metresPerUnit: 2, sampleSurface: terrainHeight });
    group.add(roads.group);

    const school = town.school;
    const sourcePoint = (x, y, z = 0) => world.geometry.point(school, [school.x + x, school.y + y, z]);
    const toWorld = point => {
      group.updateWorldMatrix(true, false);
      return group.localToWorld(new THREE.Vector3(...point));
    };
    const toSource = point => {
      group.updateWorldMatrix(true, false);
      const value = point?.isVector3 ? point.clone() : new THREE.Vector3(...point);
      return group.worldToLocal(value).toArray();
    };
    const schoolGeometry = globalThis.TogaCivilian.make(school, world.buildingProfile(school));
    const sourceBounds = new THREE.Box3();
    for (const face of schoolGeometry.faces) for (const point of face.points) {
      sourceBounds.expandByPoint(new THREE.Vector3(...sourcePoint(...point)));
    }
    const schoolBounds = {
      source: sourceBounds,
      get world() {
        group.updateWorldMatrix(true, false);
        return sourceBounds.clone().applyMatrix4(group.matrixWorld);
      },
    };

    // Grounded anchors, not canonical placements. Sign sits just beyond the
    // school southeast corner, before the main-road shoulder. Camera stays on
    // the authored +X/+Y faces with its eye below the facade's target height.
    const groundAnchor = (x, y, eyeHeight = 0) => {
      const point = sourcePoint(x, y);
      point[2] = terrainHeight(point[0], point[1]) + eyeHeight;
      return point;
    };
    const signSource = groundAnchor(school.w + 2.4, school.d + .8);
    const cameraSource = groundAnchor(school.w + 36, school.d + 39, 2.4);
    const targetSource = sourcePoint(school.w * .60, school.d * .65, school.h * .72);
    const door = schoolGeometry.door;
    const entranceSource = sourcePoint(door?.x ?? school.w, door?.y ?? school.d * .5, .1);
    const anchors = {
      source: { sign: signSource, camera: cameraSource, target: targetSource, entrance: entranceSource },
      get sign() { return toWorld(signSource); },
      get camera() { return toWorld(cameraSource); },
      get target() { return toWorld(targetSource); },
      get entrance() { return toWorld(entranceSource); },
      // This points toward the camera side in source coordinates and is useful
      // for orienting a live sign without rotating or mirroring the town.
      signFacingSource: [Math.SQRT1_2, Math.SQRT1_2, 0],
      suggestedFov: 43,
      suggestedNear: .05,
      suggestedFar: 150000,
      note: 'Provisional staging anchors only. Use one locked camera for clean background and live sign passes.',
    };

    function updateLighting(hour = 16) {
      const light = town.updateLighting(hour);
      relief.updateLighting(hour, light.groundLinear);
      roads.updateLighting(light.groundLinear);
      return light;
    }
    updateLighting(16);
    scene.add(group);
    group.updateWorldMatrix(true, true);
    return {
      group, town, world, school, schoolBounds, relief, roads, anchors,
      terrainHeight, toWorld, toSource, updateLighting, dispose,
      getState() {
        const box = schoolBounds.world;
        return {
          ready: !disposed,
          source: new URL('city-current.json', SOURCE).href,
          sourceCoordinateSystem: 'X east/right, Y south/down, Z up; unchanged source units',
          sceneCoordinateSystem: 'Y up; source [X,Y,Z] maps to [X,Z,-Y]',
          registration: { rotationX: group.rotation.x, scale: group.scale.toArray() },
          sourceWrites: false,
          school: {
            id: school.id, x: school.x, y: school.y,
            width: school.w, depth: school.d, authoredHeight: school.h,
            angle: school.angle || 0,
            sourceBounds: { min: sourceBounds.min.toArray(), max: sourceBounds.max.toArray() },
            worldBounds: { min: box.min.toArray(), max: box.max.toArray() },
          },
          anchors: { ...anchors.source, fov: anchors.suggestedFov, provisional: true },
          town: town.getState(), relief: relief.getState(), roads: roads.getState(),
        };
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
