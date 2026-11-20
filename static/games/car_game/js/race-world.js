import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const TRACK_HALF_WIDTH = 12.2;
const TRACK_SHOULDER_WIDTH = 16.5;
const TRACK_SAMPLES = 900;
const RACER_LANES = [0, -9.7, -4.85, 4.85, 9.7];
const REFERENCE_WPM = 55;
const MAX_PROGRESS_SPEED = 1.82;
const PAINT_COLORS = ['#25d982', '#a855f7', '#ff4f64', '#f1a52b', '#26b8e8'];
const BUILDING_COLORS = ['#18212d', '#202b3b', '#1b2734', '#263344', '#172430'];

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function mod(value, length) {
  return ((value % length) + length) % length;
}

function canvasTexture(draw, width = 512, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createAsphaltTexture() {
  const rand = seededRandom(42);
  const texture = canvasTexture((context, width, height) => {
    context.fillStyle = '#333a43';
    context.fillRect(0, 0, width, height);
    for (let i = 0; i < 13000; i++) {
      const shade = Math.floor(65 + rand() * 55);
      const alpha = 0.05 + rand() * 0.16;
      context.fillStyle = `rgba(${shade},${shade + 3},${shade + 8},${alpha})`;
      const size = rand() * 2.1 + 0.4;
      context.fillRect(rand() * width, rand() * height, size, size);
    }
    context.fillStyle = 'rgba(255,255,255,.09)';
    context.fillRect(width * 0.03, 0, width * 0.006, height);
    context.fillRect(width * 0.97, 0, width * 0.006, height);
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

function createNightSkyTexture() {
  return canvasTexture(
    (context, width, height) => {
      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#121b39');
      gradient.addColorStop(0.34, '#343d67');
      gradient.addColorStop(0.68, '#e17d72');
      gradient.addColorStop(1, '#f3bd85');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      const glow = context.createRadialGradient(
        width * 0.76,
        height * 0.62,
        0,
        width * 0.76,
        height * 0.62,
        height * 0.48,
      );
      glow.addColorStop(0, 'rgba(255,202,135,.58)');
      glow.addColorStop(1, 'rgba(255,202,135,0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);
      const rand = seededRandom(733);
      for (let i = 0; i < 170; i++) {
        const x = rand() * width;
        const y = rand() * height * 0.43;
        const radius = 0.35 + rand() * 1.2;
        context.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.65})`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    },
    1024,
    512,
  );
}

function createRoadCurve() {
  const points = [
    [-175, -255],
    [-130, -345],
    [-30, -395],
    [95, -382],
    [192, -310],
    [232, -202],
    [222, -82],
    [162, 22],
    [66, 112],
    [-55, 135],
    [-166, 91],
    [-236, 2],
    [-248, -117],
    [-222, -211],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  return new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.32);
}

function crossSection(curve, t) {
  const center = curve.getPointAt(mod(t, 1));
  const tangent = curve.getTangentAt(mod(t, 1)).normalize();
  const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
  return { center, tangent, side };
}

function ribbonGeometry(curve, leftOffset, rightOffset, y, samples = TRACK_SAMPLES) {
  const positions = new Float32Array((samples + 1) * 2 * 3);
  const uvs = new Float32Array((samples + 1) * 2 * 2);
  const indices = new Uint32Array(samples * 6);
  for (let i = 0; i <= samples; i++) {
    const { center, side } = crossSection(curve, i / samples);
    const left = center.clone().addScaledVector(side, leftOffset);
    const right = center.clone().addScaledVector(side, rightOffset);
    left.y = y;
    right.y = y;
    const vertex = i * 2;
    positions.set([left.x, left.y, left.z, right.x, right.y, right.z], vertex * 3);
    uvs.set([0, i * 0.055, 1, i * 0.055], vertex * 2);
    if (i < samples) {
      const index = i * 6;
      indices.set([vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2], index);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

function dashGeometry(curve, offset, length, gap, width) {
  const positions = [];
  const indices = [];
  const trackLength = curve.getLength();
  let vertex = 0;
  for (let start = 0; start < trackLength; start += length + gap) {
    const end = Math.min(start + length, trackLength);
    const samples = Math.max(2, Math.ceil((end - start) / 1.8));
    for (let i = 0; i <= samples; i++) {
      const distance = start + ((end - start) * i) / samples;
      const { center, side } = crossSection(curve, distance / trackLength);
      const left = center.clone().addScaledVector(side, offset - width / 2);
      const right = center.clone().addScaledVector(side, offset + width / 2);
      left.y = 0.105;
      right.y = 0.105;
      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      if (i < samples) {
        indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2);
      }
      vertex += 2;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function offsetCurve(curve, offset, y = 0) {
  const points = [];
  const sampleCount = Math.max(240, Math.ceil(curve.getLength() / 2.6));
  for (let i = 0; i < sampleCount; i++) {
    const { center, side } = crossSection(curve, i / sampleCount);
    center.addScaledVector(side, offset);
    center.y = y;
    points.push(center);
  }
  return new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.2);
}

function createTrackLabel(text, accent = '#4be5ff') {
  const texture = canvasTexture(
    (context, width, height) => {
      context.clearRect(0, 0, width, height);
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, 'rgba(8,15,31,.95)');
      gradient.addColorStop(1, 'rgba(26,38,61,.96)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      context.strokeStyle = accent;
      context.lineWidth = 6;
      context.strokeRect(3, 3, width - 6, height - 6);
      context.fillStyle = accent;
      context.font = '800 39px Arial, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, width / 2, height / 2 + 1, width - 28);
    },
    512,
    96,
  );
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function makeCarNumber(number, color) {
  const texture = canvasTexture(
    (context, width, height) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = 'rgba(247,249,248,.95)';
      context.beginPath();
      context.roundRect(0, 0, width, height, 12);
      context.fill();
      context.fillStyle = color;
      context.font = '900 64px Arial, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(number).padStart(2, '0'), width / 2, height / 2 + 2);
    },
    256,
    128,
  );
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    toneMapped: false,
  });
}

function addBox(parent, material, size, position, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow ?? false;
  parent.add(mesh);
  return mesh;
}

function createCar(racer, index) {
  const root = new THREE.Group();
  root.name = `${racer.name} 3D car`;
  const bodyColor = PAINT_COLORS[index % PAINT_COLORS.length];
  const paint = new THREE.MeshPhysicalMaterial({
    color: bodyColor,
    metalness: 0.64,
    roughness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.16,
  });
  const darkPaint = new THREE.MeshStandardMaterial({
    color: '#111923',
    metalness: 0.72,
    roughness: 0.28,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#172a3c',
    metalness: 0.3,
    roughness: 0.12,
    clearcoat: 1,
    transparent: true,
    opacity: 0.92,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: '#080d13',
    metalness: 0.4,
    roughness: 0.63,
  });
  const tireMaterial = new THREE.MeshStandardMaterial({
    color: '#080b0f',
    roughness: 0.88,
  });
  const alloy = new THREE.MeshStandardMaterial({
    color: '#b5c4ce',
    metalness: 0.9,
    roughness: 0.18,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: index === 0 ? '#d4ff69' : bodyColor,
    emissive: index === 0 ? '#224a14' : bodyColor,
    emissiveIntensity: 0.42,
    metalness: 0.58,
    roughness: 0.25,
  });
  const headlight = new THREE.MeshStandardMaterial({
    color: '#fff3d0',
    emissive: '#ffd37d',
    emissiveIntensity: 5.2,
  });
  const taillight = new THREE.MeshStandardMaterial({
    color: '#ff3948',
    emissive: '#ff172e',
    emissiveIntensity: 3.1,
  });

  const hullShape = new THREE.Shape();
  hullShape.moveTo(-0.78, -2.12);
  hullShape.lineTo(0.78, -2.12);
  hullShape.lineTo(1.02, -1.78);
  hullShape.lineTo(1.06, -0.78);
  hullShape.lineTo(0.91, 0.02);
  hullShape.lineTo(0.74, 1.55);
  hullShape.lineTo(0.48, 2.05);
  hullShape.lineTo(-0.48, 2.05);
  hullShape.lineTo(-0.74, 1.55);
  hullShape.lineTo(-0.91, 0.02);
  hullShape.lineTo(-1.06, -0.78);
  hullShape.lineTo(-1.02, -1.78);
  hullShape.closePath();
  const hullGeometry = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.56,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.1,
    bevelThickness: 0.09,
  });
  hullGeometry.rotateX(Math.PI / 2);
  hullGeometry.translate(0, 0.84, 0);
  const hull = new THREE.Mesh(hullGeometry, paint);
  hull.castShadow = true;
  hull.receiveShadow = true;
  root.add(hull);

  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.25, 3.55), darkPaint);
  lowerBody.position.set(0, 0.47, -0.08);
  lowerBody.castShadow = true;
  root.add(lowerBody);

  const cabinShape = new THREE.Shape();
  cabinShape.moveTo(-0.68, -0.89);
  cabinShape.lineTo(0.68, -0.89);
  cabinShape.lineTo(0.61, -0.2);
  cabinShape.lineTo(0.49, 0.82);
  cabinShape.lineTo(-0.49, 0.82);
  cabinShape.lineTo(-0.61, -0.2);
  cabinShape.closePath();
  const cabinGeometry = new THREE.ExtrudeGeometry(cabinShape, {
    depth: 0.68,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.09,
    bevelThickness: 0.08,
  });
  cabinGeometry.rotateX(Math.PI / 2);
  cabinGeometry.translate(0, 1.28, 0);
  const cabin = new THREE.Mesh(cabinGeometry, glass);
  cabin.castShadow = true;
  root.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.94), paint);
  roof.position.set(0, 1.34, 0.02);
  roof.castShadow = true;
  root.add(roof);
  const hoodLine = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.95), accent);
  hoodLine.position.set(0, 0.82, 1.25);
  root.add(hoodLine);

  const frontSplitter = addBox(root, trim, [2.18, 0.14, 0.28], [0, 0.36, 1.92]);
  frontSplitter.castShadow = true;
  addBox(root, accent, [1.25, 0.06, 0.13], [0, 0.32, 2.03]);
  addBox(root, trim, [2.12, 0.13, 0.24], [0, 0.39, -1.88]);
  addBox(root, paint, [0.12, 0.52, 0.12], [-0.74, 1.13, -1.48]);
  addBox(root, paint, [0.12, 0.52, 0.12], [0.74, 1.13, -1.48]);
  addBox(root, paint, [1.7, 0.12, 0.24], [0, 1.38, -1.48]);

  const wheelGeometry = new THREE.CylinderGeometry(0.46, 0.46, 0.34, 24, 1);
  const rimGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.355, 20, 1);
  const hubGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.37, 16);
  const wheels = [];
  for (const x of [-0.97, 0.97]) {
    for (const z of [-1.25, 1.25]) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, 0.47, z);
      wheelGroup.rotation.z = Math.PI / 2;
      const tire = new THREE.Mesh(wheelGeometry, tireMaterial);
      tire.castShadow = true;
      wheelGroup.add(tire);
      const rim = new THREE.Mesh(rimGeometry, alloy);
      wheelGroup.add(rim);
      const hub = new THREE.Mesh(hubGeometry, darkPaint);
      wheelGroup.add(hub);
      for (let spoke = 0; spoke < 5; spoke++) {
        const spokeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.25, 0.035), alloy);
        spokeMesh.position.y = 0.02;
        spokeMesh.rotation.z = (Math.PI * 2 * spoke) / 5;
        wheelGroup.add(spokeMesh);
      }
      root.add(wheelGroup);
      wheels.push(wheelGroup);
    }
  }

  for (const x of [-0.77, 0.77]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.13, 0.1), headlight);
    light.position.set(x, 0.67, 1.91);
    root.add(light);
    const rear = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.1), taillight);
    rear.position.set(x * 0.8, 0.68, -1.94);
    root.add(rear);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.3), paint);
    mirror.position.set(x * 1.33, 0.92, 0.38);
    root.add(mirror);
  }

  const boostFlames = [];
  for (const x of [-0.54, 0.54]) {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 1.3, 12),
      new THREE.MeshBasicMaterial({
        color: index === 0 ? '#bfff54' : '#77cfff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(x, 0.39, -1.96);
    root.add(flame);
    boostFlames.push(flame);
  }

  const numberMaterial = makeCarNumber(index + 1, bodyColor);
  const number = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.24), numberMaterial);
  number.rotation.x = -Math.PI / 2;
  number.position.set(0, 0.86, 0.64);
  root.add(number);

  if (index === 0) {
    const target = new THREE.Object3D();
    target.position.set(0, 0.1, 58);
    root.add(target);
    for (const x of [-0.58, 0.58]) {
      const beam = new THREE.SpotLight('#ffe8bf', 55, 92, 0.25, 0.65, 1.4);
      beam.position.set(x, 0.62, 1.8);
      beam.target = target;
      beam.castShadow = false;
      root.add(beam);
    }
  }

  return { root, wheels, boostFlames, paint, index };
}

export class RaceWorld3D {
  constructor(
    canvas,
    racers,
    { reducedMotion = false, modelUrl = '/static/games/car_game/models/spectral-gt-rs.glb' } = {},
  ) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.modelUrl = modelUrl;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.13;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.composer = new EffectComposer(this.renderer);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#a9aab1');
    this.scene.fog = new THREE.FogExp2('#bbb4ad', 0.00072);
    this.camera = new THREE.PerspectiveCamera(63, 1, 0.15, 1900);
    this.camera.position.set(0, 5.2, 14);
    this.cameraTarget = new THREE.Vector3();
    this.time = 0;
    this.curve = createRoadCurve();
    this.trackLength = this.curve.getLength();
    this.distancePerProgress = this.trackLength / 78;
    this.cars = racers.map((racer, index) => createCar(racer, index));
    this.scene.add(...this.cars.map((car) => car.root));

    this.createLighting();
    this.createEnvironment();
    this.createTrack();
    this.createCity();
    this.createStreetLights();
    this.createTrackSigns();
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.46, 0.62, 0.77));
    this.resize();
    this.ready = this.loadDetailedCars(racers).catch((error) => {
      console.warn(
        'Keeping the built-in 3D cars because the detailed car model could not load:',
        error,
      );
      return false;
    });
  }

  async loadDetailedCars(racers) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(this.modelUrl);
    const template = gltf.scene;
    template.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(template);
    const center = bounds.getCenter(new THREE.Vector3());
    const bodyColors = ['#68e9a0', '#b86dff', '#ff526f', '#ffb844', '#43caff'];

    this.cars.forEach((fallback, index) => {
      const racer = racers[index];
      const model = template.clone(true);
      const materialCopies = new Map();
      model.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = /BODY|Tire|Rim|Fender|Wing|Roof/i.test(node.name);
        node.receiveShadow = true;
        const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
        const clonedMaterials = sourceMaterials.map((source) => {
          if (!materialCopies.has(source.uuid)) {
            const material = source.clone();
            if (material.name.includes('Spectral Blue')) {
              material.color.set(bodyColors[index]);
              material.metalness = 0.72;
              material.roughness = 0.19;
              material.clearcoat = 1;
              material.clearcoatRoughness = 0.13;
            } else if (material.name.includes('Shadow Panels')) {
              material.color.set(bodyColors[index]).multiplyScalar(0.19);
            }
            materialCopies.set(source.uuid, material);
          }
          return materialCopies.get(source.uuid);
        });
        node.material = Array.isArray(node.material) ? clonedMaterials : clonedMaterials[0];
      });

      model.position.set(-center.x, -bounds.min.y, -center.z);
      const orientation = new THREE.Group();
      orientation.rotation.y = -Math.PI / 2;
      orientation.scale.setScalar(0.88);
      orientation.add(model);
      const root = new THREE.Group();
      root.name = racer.name;
      root.add(orientation);

      const wheelPivots = this.createWheelPivots(model);
      const glow = new THREE.PointLight(bodyColors[index], index === 0 ? 3.2 : 1.8, 12, 1.8);
      glow.position.set(0, 0.35, 0);
      root.add(glow);

      this.scene.remove(fallback.root);
      this.disposeObject(fallback.root);
      this.cars[index] = {
        root,
        wheels: wheelPivots,
        wheelAxis: 'z',
        boostFlames: [],
        index,
      };
      this.scene.add(root);
    });
    this.render(racers, 0);
    return true;
  }

  createWheelPivots(model) {
    model.updateMatrixWorld(true);
    const wheelPrefixes = ['Front_Left', 'Front_Right', 'Rear_Left', 'Rear_Right'];
    return wheelPrefixes
      .map((prefix) => {
        const tire = model.getObjectByName(`${prefix}_Tire`);
        if (!tire) return null;
        const pivotPosition = model.worldToLocal(tire.getWorldPosition(new THREE.Vector3()));
        const pivot = new THREE.Group();
        pivot.position.copy(pivotPosition);
        model.add(pivot);
        model.updateMatrixWorld(true);
        const parts = [];
        model.traverse((node) => {
          if (
            node !== pivot &&
            node.name.startsWith(`${prefix}_`) &&
            /Tire|Sidewall|Brake_Disc|Brake_Hat|Rim_Base|Spoke_|Hub/i.test(node.name)
          ) {
            parts.push(node);
          }
        });
        const pivotInverse = pivot.matrixWorld.clone().invert();
        parts.forEach((part) => {
          part.updateMatrixWorld(true);
          const worldMatrix = part.matrixWorld.clone();
          const localMatrix = pivotInverse.clone().multiply(worldMatrix);
          part.removeFromParent();
          pivot.add(part);
          localMatrix.decompose(part.position, part.quaternion, part.scale);
          part.matrixAutoUpdate = true;
        });
        return pivot;
      })
      .filter(Boolean);
  }

  disposeObject(object) {
    object.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry?.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
    });
  }

  pixelRatio() {
    const screenScale = window.innerWidth < 720 ? 1.25 : 1.7;
    return Math.min(window.devicePixelRatio || 1, screenScale);
  }

  createLighting() {
    this.scene.add(new THREE.HemisphereLight('#c9e3ff', '#1b2831', 1.75));
    const key = new THREE.DirectionalLight('#ffd8ab', 3.5);
    key.position.set(-180, 250, 160);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.camera.left = -260;
    key.shadow.camera.right = 260;
    key.shadow.camera.top = 280;
    key.shadow.camera.bottom = -280;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 620;
    key.shadow.bias = -0.00018;
    this.scene.add(key);
    this.scene.add(key.target);
    const fill = new THREE.DirectionalLight('#81caff', 1.1);
    fill.position.set(190, 90, -190);
    this.scene.add(fill);
  }

  createEnvironment() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1350, 40, 24),
      new THREE.MeshBasicMaterial({
        map: createNightSkyTexture(),
        side: THREE.BackSide,
        fog: false,
        toneMapped: false,
      }),
    );
    this.scene.add(sky);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2800, 2800),
      new THREE.MeshStandardMaterial({
        color: '#242b34',
        roughness: 1,
        metalness: 0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.8;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(90, 48),
      new THREE.MeshBasicMaterial({
        color: '#df886d',
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    glow.position.set(360, 165, -680);
    this.scene.add(glow);
  }

  createTrack() {
    const asphalt = new THREE.MeshStandardMaterial({
      color: '#d6dce3',
      map: createAsphaltTexture(),
      roughness: 0.82,
      metalness: 0.04,
    });
    const shoulderMaterial = new THREE.MeshStandardMaterial({
      color: '#404751',
      roughness: 0.94,
      metalness: 0.08,
    });
    const shoulder = new THREE.Mesh(
      ribbonGeometry(this.curve, TRACK_SHOULDER_WIDTH, -TRACK_SHOULDER_WIDTH, 0.015),
      shoulderMaterial,
    );
    shoulder.receiveShadow = true;
    this.scene.add(shoulder);

    const road = new THREE.Mesh(
      ribbonGeometry(this.curve, TRACK_HALF_WIDTH, -TRACK_HALF_WIDTH, 0.052),
      asphalt,
    );
    road.receiveShadow = true;
    this.scene.add(road);

    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: '#f2f3ef',
      roughness: 0.62,
      metalness: 0.04,
    });
    for (const offset of [-11.8, 11.8]) {
      const edge = new THREE.Mesh(
        ribbonGeometry(this.curve, offset + 0.16, offset - 0.16, 0.093),
        edgeMaterial,
      );
      edge.receiveShadow = true;
      this.scene.add(edge);
    }

    const laneMaterial = new THREE.MeshStandardMaterial({
      color: '#f2eee0',
      roughness: 0.7,
      emissive: '#4c4a43',
      emissiveIntensity: 0.13,
      side: THREE.DoubleSide,
    });
    for (const boundary of [-1.5, -0.5, 0.5, 1.5]) {
      const offset = boundary * 4.88;
      const markings = new THREE.Mesh(dashGeometry(this.curve, offset, 13, 17, 0.13), laneMaterial);
      markings.receiveShadow = true;
      this.scene.add(markings);
    }

    this.createKerbs();
    this.createGuardRails();
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.TubeGeometry(offsetCurve(this.curve, side * 15.2, 1.4), 980, 0.075, 7, true),
        new THREE.MeshBasicMaterial({
          color: side < 0 ? '#49e4ff' : '#ff76bc',
          toneMapped: false,
        }),
      );
      this.scene.add(rail);
    }
  }

  createKerbs() {
    const box = new THREE.BoxGeometry(0.74, 0.14, 5.15);
    const redMaterial = new THREE.MeshStandardMaterial({
      color: '#f15b58',
      roughness: 0.58,
      emissive: '#35100e',
    });
    const whiteMaterial = new THREE.MeshStandardMaterial({
      color: '#d9e1df',
      roughness: 0.6,
    });
    const blocksPerSide = Math.ceil(this.trackLength / 5.2);
    for (const sideSign of [-1, 1]) {
      const red = new THREE.InstancedMesh(box, redMaterial, Math.ceil(blocksPerSide / 2));
      const white = new THREE.InstancedMesh(box, whiteMaterial, Math.ceil(blocksPerSide / 2));
      red.castShadow = true;
      white.castShadow = true;
      const temp = new THREE.Object3D();
      let redIndex = 0;
      let whiteIndex = 0;
      for (let block = 0; block < blocksPerSide; block++) {
        const distance = block * 5.2;
        const { center, tangent, side } = crossSection(this.curve, distance / this.trackLength);
        center.addScaledVector(side, sideSign * 12.58);
        temp.position.set(center.x, 0.16, center.z);
        temp.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
        temp.updateMatrix();
        if (block % 2) white.setMatrixAt(whiteIndex++, temp.matrix);
        else red.setMatrixAt(redIndex++, temp.matrix);
      }
      red.count = redIndex;
      white.count = whiteIndex;
      red.instanceMatrix.needsUpdate = true;
      white.instanceMatrix.needsUpdate = true;
      this.scene.add(red, white);
    }
  }

  createGuardRails() {
    const postMaterial = new THREE.MeshStandardMaterial({
      color: '#8997a5',
      metalness: 0.75,
      roughness: 0.31,
    });
    const railMaterial = new THREE.MeshStandardMaterial({
      color: '#c4d1da',
      metalness: 0.86,
      roughness: 0.24,
    });
    const poleGeometry = new THREE.BoxGeometry(0.18, 1.2, 0.18);
    const postCount = Math.ceil(this.trackLength / 13);
    for (const sideSign of [-1, 1]) {
      const posts = new THREE.InstancedMesh(poleGeometry, postMaterial, postCount);
      const temp = new THREE.Object3D();
      for (let i = 0; i < postCount; i++) {
        const { center, side } = crossSection(this.curve, (i * 13) / this.trackLength);
        center.addScaledVector(side, sideSign * 13.85);
        temp.position.set(center.x, 0.66, center.z);
        temp.updateMatrix();
        posts.setMatrixAt(i, temp.matrix);
      }
      posts.instanceMatrix.needsUpdate = true;
      posts.castShadow = true;
      this.scene.add(posts);
      for (const y of [0.78, 1.25]) {
        const rail = new THREE.Mesh(
          new THREE.TubeGeometry(offsetCurve(this.curve, sideSign * 13.85, y), 900, 0.12, 7, true),
          railMaterial,
        );
        rail.castShadow = true;
        this.scene.add(rail);
      }
    }
  }

  createCity() {
    const random = seededRandom(2028);
    const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
    const buildingMaterial = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.8,
      metalness: 0.18,
    });
    const buildingCount = 176;
    const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, buildingCount);
    buildings.castShadow = true;
    buildings.receiveShadow = true;
    const windowGeometry = new THREE.BoxGeometry(1, 0.76, 0.075);
    const windowMaterial = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      toneMapped: false,
    });
    const windows = new THREE.InstancedMesh(windowGeometry, windowMaterial, 12000);
    windows.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const matrixObject = new THREE.Object3D();
    const lookColors = ['#ffd592', '#83d9ff', '#ff8bd4', '#fff0c7'];
    let buildingIndex = 0;
    let windowIndex = 0;
    const perimeterLayers = [
      { min: 34, max: 70, height: 20 },
      { min: 94, max: 180, height: 90 },
      { min: 235, max: 405, height: 130 },
    ];

    for (const layer of perimeterLayers) {
      const spacing = layer.height < 80 ? 40 : 74;
      for (let distance = 0; distance < this.trackLength; distance += spacing) {
        for (const sideSign of [-1, 1]) {
          if (random() < (layer.height < 80 ? 0.28 : 0.1)) continue;
          const t = mod(distance + random() * spacing * 0.7, this.trackLength) / this.trackLength;
          const { center, tangent, side } = crossSection(this.curve, t);
          const depth = 12 + random() * 20;
          const width = 14 + random() * 24;
          const height = 18 + random() * layer.height;
          const offset = layer.min + random() * (layer.max - layer.min);
          center.addScaledVector(side, sideSign * offset);
          const yaw = Math.atan2(tangent.x, tangent.z) - (sideSign * Math.PI) / 2;
          matrixObject.position.set(center.x, height / 2 - 0.8, center.z);
          matrixObject.rotation.set(0, yaw, 0);
          matrixObject.scale.set(width, height, depth);
          matrixObject.updateMatrix();
          if (buildingIndex < buildingCount) {
            buildings.setMatrixAt(buildingIndex, matrixObject.matrix);
            buildings.setColorAt(
              buildingIndex,
              new THREE.Color(BUILDING_COLORS[Math.floor(random() * BUILDING_COLORS.length)]),
            );
            buildingIndex++;
          }

          const columns = Math.max(2, Math.floor(width / 4.5));
          const rows = Math.max(2, Math.min(18, Math.floor(height / 5.5)));
          const front = 0.5 + 0.42 / depth;
          const buildingMatrix = matrixObject.matrix.clone();
          for (let row = 1; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
              if (windowIndex >= windows.instanceMatrix.count || random() < 0.29) continue;
              const localX = ((column + 0.5) / columns - 0.5) * 1.72;
              const localY = -0.78 + ((row + 0.5) / rows) * 1.56;
              const local = new THREE.Vector3(localX, localY, front);
              local.applyMatrix4(buildingMatrix);
              matrixObject.position.copy(local);
              matrixObject.rotation.set(0, yaw, 0);
              matrixObject.scale.set(1, 1, 1);
              matrixObject.updateMatrix();
              windows.setMatrixAt(windowIndex, matrixObject.matrix);
              windows.setColorAt(
                windowIndex,
                new THREE.Color(lookColors[Math.floor(random() * lookColors.length)]),
              );
              windowIndex++;
            }
          }
        }
      }
    }
    buildings.count = buildingIndex;
    windows.count = windowIndex;
    buildings.instanceMatrix.needsUpdate = true;
    windows.instanceMatrix.needsUpdate = true;
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
    this.scene.add(buildings, windows);

    this.createTrees(random);
  }

  createTrees(random) {
    const treeCount = Math.ceil(this.trackLength / 22) * 2;
    const trunkGeometry = new THREE.CylinderGeometry(0.28, 0.42, 5, 7);
    const leafGeometry = new THREE.IcosahedronGeometry(2.5, 1);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: '#554438',
      roughness: 0.94,
    });
    const leafMaterial = new THREE.MeshStandardMaterial({
      color: '#29675e',
      roughness: 1,
      flatShading: true,
    });
    const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, treeCount);
    const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, treeCount);
    const temp = new THREE.Object3D();
    let index = 0;
    for (let distance = 11; distance < this.trackLength; distance += 22) {
      for (const sideSign of [-1, 1]) {
        if (random() < 0.15) continue;
        const { center, side } = crossSection(this.curve, distance / this.trackLength);
        center.addScaledVector(side, sideSign * (24 + random() * 6));
        temp.position.set(center.x, 1.5, center.z);
        temp.scale.set(0.75 + random() * 0.7, 0.85 + random() * 1.4, 0.75 + random() * 0.7);
        temp.rotation.set(random() * 0.2, random() * Math.PI, random() * 0.2);
        temp.updateMatrix();
        trunks.setMatrixAt(index, temp.matrix);
        temp.position.y += 4.0 + random() * 1.8;
        temp.scale.multiplyScalar(1.8);
        temp.updateMatrix();
        leaves.setMatrixAt(index, temp.matrix);
        leaves.setColorAt(index, new THREE.Color(random() < 0.45 ? '#317668' : '#3e8270'));
        index++;
      }
    }
    trunks.count = index;
    leaves.count = index;
    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    this.scene.add(trunks, leaves);
  }

  createStreetLights() {
    const poleMaterial = new THREE.MeshStandardMaterial({
      color: '#738391',
      metalness: 0.78,
      roughness: 0.25,
    });
    const fixtureMaterial = new THREE.MeshStandardMaterial({
      color: '#e8f8ff',
      emissive: '#85dfff',
      emissiveIntensity: 3.8,
    });
    const poleGeometry = new THREE.CylinderGeometry(0.09, 0.16, 8.2, 8);
    const armGeometry = new THREE.BoxGeometry(2.6, 0.13, 0.16);
    const lightGeometry = new THREE.BoxGeometry(1.15, 0.23, 0.7);
    for (let distance = 40, index = 0; distance < this.trackLength; distance += 74, index++) {
      const { center, tangent, side } = crossSection(this.curve, distance / this.trackLength);
      const sideSign = index % 2 ? 1 : -1;
      center.addScaledVector(side, sideSign * 17.6);
      const group = new THREE.Group();
      group.position.copy(center);
      group.rotation.y = Math.atan2(tangent.x, tangent.z);
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(-sideSign * 0.7, 4.1, 0);
      pole.castShadow = true;
      group.add(pole);
      const arm = new THREE.Mesh(armGeometry, poleMaterial);
      arm.position.set(sideSign * 0.5, 8.0, 0);
      group.add(arm);
      const fixture = new THREE.Mesh(lightGeometry, fixtureMaterial);
      fixture.position.set(sideSign * 1.55, 7.87, 0);
      group.add(fixture);
      this.scene.add(group);
      if (index % 4 === 0) {
        const lamp = new THREE.PointLight('#83dfff', 24, 62, 1.7);
        lamp.position.set(center.x + sideSign * 2.2, 7.3, center.z);
        this.scene.add(lamp);
      }
    }
  }

  createTrackSigns() {
    const signs = [
      { distance: 100, text: 'MIDTOWN  ·  CITY LOOP', color: '#69e8ff' },
      {
        distance: this.trackLength * 0.35,
        text: 'TYPE TO THROTTLE',
        color: '#d4ff69',
      },
      {
        distance: this.trackLength * 0.69,
        text: 'NEON DISTRICT',
        color: '#ff83cb',
      },
    ];
    signs.forEach((sign, index) => {
      const { center, tangent } = crossSection(this.curve, sign.distance / this.trackLength);
      const yaw = Math.atan2(tangent.x, tangent.z);
      const group = new THREE.Group();
      group.position.copy(center);
      group.rotation.y = yaw;
      const postMaterial = new THREE.MeshStandardMaterial({
        color: '#536477',
        metalness: 0.78,
        roughness: 0.24,
      });
      for (const x of [-14.6, 14.6]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.54, 8, 0.62), postMaterial);
        post.position.set(x, 4, 0);
        post.castShadow = true;
        group.add(post);
      }
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(30, 0.65, 0.7),
        new THREE.MeshStandardMaterial({
          color: '#405163',
          metalness: 0.65,
          roughness: 0.31,
        }),
      );
      beam.position.y = 7.1;
      group.add(beam);
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(13.2, 2.05),
        createTrackLabel(sign.text, sign.color),
      );
      board.position.set(0, 8.85, 0.43);
      board.rotation.y = Math.PI;
      group.add(board);
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(14.5, 0.08, 0.08),
        new THREE.MeshBasicMaterial({ color: sign.color, toneMapped: false }),
      );
      edge.position.set(0, 7.95, 0.42);
      group.add(edge);
      this.scene.add(group);
      if (index === 0) this.createCityOverpass(sign.distance + 360);
    });
  }

  createCityOverpass(distance) {
    const { center, tangent } = crossSection(this.curve, distance / this.trackLength);
    const bridge = new THREE.Group();
    bridge.position.copy(center);
    bridge.rotation.y = Math.atan2(tangent.x, tangent.z);
    const concrete = new THREE.MeshStandardMaterial({
      color: '#596779',
      roughness: 0.73,
      metalness: 0.12,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: '#202b38',
      roughness: 0.8,
      metalness: 0.15,
    });
    for (const x of [-14, 14]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8.5, 2.2), concrete);
      pillar.position.set(x, 4.2, 0);
      pillar.castShadow = true;
      bridge.add(pillar);
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 2.8), dark);
      base.position.set(x, 0.55, 0);
      bridge.add(base);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(32, 1.2, 10), concrete);
    deck.position.set(0, 8.6, -1);
    deck.castShadow = true;
    deck.receiveShadow = true;
    bridge.add(deck);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(32, 1.25, 0.55), dark);
    rail.position.set(0, 9.72, 3.15);
    bridge.add(rail);
    this.scene.add(bridge);
  }

  pose(progress, lane) {
    const distance = mod(progress * this.distancePerProgress, this.trackLength);
    const pose = crossSection(this.curve, distance / this.trackLength);
    pose.center.addScaledVector(pose.side, lane);
    pose.center.y = 0.04;
    pose.rotation = Math.atan2(pose.tangent.x, pose.tangent.z);
    pose.distance = distance;
    return pose;
  }

  lapLabel(progress) {
    const lap = Math.floor((progress * this.distancePerProgress) / this.trackLength) + 1;
    return `LAP ${String(lap).padStart(2, '0')}`;
  }

  render(racers, dt = 0) {
    if (dt > 0) this.time += dt;
    const player = racers[0];
    racers.forEach((racer, index) => {
      const car = this.cars[index];
      const pose = this.pose(racer.progress, RACER_LANES[index]);
      const speed = racer.player
        ? racer.velocity
        : (racer.wpm / REFERENCE_WPM) * MAX_PROGRESS_SPEED;
      car.root.position.copy(pose.center);
      if (!this.reducedMotion) {
        car.root.position.y +=
          Math.sin(this.time * 8 + index * 1.7) * Math.min(0.045, speed * 0.018);
      }
      car.root.rotation.y = pose.rotation;
      const boost = THREE.MathUtils.clamp(
        racer.player ? racer.throttle * 0.42 + racer.drivePulse * 0.6 : racer.wpm / 78,
        0,
        1,
      );
      car.boostFlames.forEach((flame, flameIndex) => {
        const flicker = this.reducedMotion
          ? 0.3
          : 0.24 + 0.12 * Math.sin(this.time * 26 + flameIndex);
        const length = this.reducedMotion ? 0.32 : 0.24 + 0.13 * Math.sin(this.time * 18 + index);
        flame.material.opacity = boost * flicker;
        flame.scale.setScalar(0.72 + boost * length);
      });
      car.wheels.forEach((wheel, wheelIndex) => {
        const rotation = speed * Math.max(dt, 0) * 3.8 * (wheelIndex < 2 ? -1 : 1);
        if (car.wheelAxis === 'z') wheel.rotation.z += rotation;
        else wheel.rotation.x += rotation;
      });
    });

    const pose = this.pose(player.progress, RACER_LANES[0]);
    const speed = player.velocity || 0;
    const followDistance = 10.6 + Math.min(speed * 1.25, 2.1);
    const cameraPosition = pose.center
      .clone()
      .addScaledVector(pose.tangent, -followDistance)
      .add(new THREE.Vector3(0, 4.65 + Math.min(speed * 0.09, 0.16), 0))
      .addScaledVector(
        pose.side,
        this.reducedMotion ? 0 : Math.sin(this.time * 0.55) * speed * 0.08,
      );
    const lookTarget = pose.center
      .clone()
      .addScaledVector(pose.tangent, 14 + Math.min(speed * 1.2, 5))
      .add(new THREE.Vector3(0, 1.15, 0));
    const smoothing = dt > 0 ? 1 - Math.exp(-dt * (3.5 + speed * 0.3)) : 1;
    this.camera.position.lerp(cameraPosition, smoothing);
    this.cameraTarget.lerp(lookTarget, smoothing);
    this.camera.lookAt(this.cameraTarget);
    this.camera.fov = this.reducedMotion ? 59 : 58 + Math.min(speed * 2.8, 8);
    this.camera.updateProjectionMatrix();
    this.composer.render();
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

window.RaceWorld3D = RaceWorld3D;
