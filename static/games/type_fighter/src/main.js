import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import animationLibrary from './animation-library.json';

const { ANIMATION_CLIPS, FIGHT_ANIMATIONS, DEFEAT_ANIMATIONS } = animationLibrary;
const FIGHTER_COLLISION_GAP = 1.8;

const root = document.getElementById('typeFighterGame');
const arena = document.getElementById('gameArena');

if (root && arena) {
  const status = document.getElementById('arenaStatus');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const actors = { player: null, enemy: null };
  const impactVelocity = [];
  const impactPositions = new Float32Array(24 * 3);
  const impactGeometry = new THREE.BufferGeometry();
  const impactMaterial = new THREE.PointsMaterial({
    color: '#ffd58b',
    size: 0.105,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  let renderer;
  let scene;
  let camera;
  let frameId = null;
  let previousFrame = 0;
  let isDisposed = false;
  let isPaused = false;
  let cameraShake = 0;
  let cameraIntroRemaining = 1.8;
  let targetCameraZ = 12.2;
  const cameraLookHeight = 1.36;
  let roundLightTime = 0;
  let environmentTexture = null;
  let impactPoints = null;
  let impactRing = null;
  let impactAge = 2;
  let entryResolve = null;

  impactGeometry.setAttribute('position', new THREE.BufferAttribute(impactPositions, 3));

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function makeMaterial(color, options = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.52,
      metalness: 0.12,
      ...options,
    });
  }

  function createFallbackFighter(side) {
    const color = side === 'player' ? '#4bbde1' : '#df554e';
    const material = makeMaterial(color, { metalness: 0.2 });
    const darkMaterial = makeMaterial('#24212a', { metalness: 0.3 });
    const skin = makeMaterial('#d7a98c', { roughness: 0.78 });
    const fighter = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.31, 0.62, 5, 10), material);
    torso.position.y = 1.24;
    fighter.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 12), skin);
    head.position.y = 1.92;
    fighter.add(head);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 0.36), darkMaterial);
    belt.position.y = 0.82;
    fighter.add(belt);

    for (const direction of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.54, 4, 8), material);
      arm.position.set(direction * 0.43, 1.29, 0.04);
      arm.rotation.z = direction * -0.28;
      fighter.add(arm);

      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.52, 4, 8), darkMaterial);
      leg.position.set(direction * 0.17, 0.36, 0);
      fighter.add(leg);
    }

    const guard = makeGuardShield();
    fighter.add(guard);
    return {
      group: fighter,
      mixer: null,
      action: null,
      guard,
      materials: [material, darkMaterial, skin],
    };
  }

  function createMonsterFighter() {
    const hide = makeMaterial('#403247', { roughness: 0.68, metalness: 0.08 });
    const armor = makeMaterial('#28212f', { roughness: 0.42, metalness: 0.34 });
    const plates = makeMaterial('#74364a', { roughness: 0.38, metalness: 0.28 });
    const claws = makeMaterial('#17151d', { roughness: 0.28, metalness: 0.48 });
    const glow = new THREE.MeshBasicMaterial({ color: '#ff394e' });
    const fighter = new THREE.Group();
    const materials = [hide, armor, plates, claws];
    const addMesh = (geometry, material, position, scale, rotation = null) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      if (scale) mesh.scale.set(...scale);
      if (rotation) mesh.rotation.set(...rotation);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      fighter.add(mesh);
      return mesh;
    };

    addMesh(new THREE.CapsuleGeometry(0.4, 0.72, 6, 12), hide, [0, 1.28, 0], [1.15, 1.08, 0.82]);
    addMesh(new THREE.SphereGeometry(0.53, 20, 16), plates, [0, 1.68, 0.04], [1.05, 0.86, 0.78]);
    addMesh(new THREE.SphereGeometry(0.34, 18, 14), armor, [0, 1.34, 0.38], [0.88, 1.08, 0.28]);
    addMesh(new THREE.SphereGeometry(0.47, 20, 16), hide, [0, 2.27, 0.12], [1.08, 0.9, 0.86]);
    addMesh(new THREE.BoxGeometry(0.59, 0.18, 0.4), armor, [0, 1.99, 0.34], null);

    for (const side of [-1, 1]) {
      addMesh(
        new THREE.SphereGeometry(0.095, 12, 10),
        glow,
        [side * 0.2, 2.34, 0.49],
        [1.2, 0.72, 0.55],
      );
      addMesh(
        new THREE.ConeGeometry(0.16, 0.5, 8),
        plates,
        [side * 0.31, 2.76, 0.06],
        [1, 1, 0.9],
        [0, 0, side * -0.48],
      );
      addMesh(new THREE.ConeGeometry(0.075, 0.2, 7), claws, [side * 0.14, 2.02, 0.56], null, [
        Math.PI,
        0,
        side * 0.12,
      ]);
      addMesh(
        new THREE.SphereGeometry(0.31, 16, 12),
        armor,
        [side * 0.55, 1.77, 0],
        [1.1, 0.9, 0.86],
      );
      addMesh(
        new THREE.CapsuleGeometry(0.15, 0.55, 5, 9),
        hide,
        [side * 0.7, 1.31, 0.08],
        [1, 1, 0.88],
        [0, 0, side * -0.14],
      );
      addMesh(
        new THREE.SphereGeometry(0.21, 14, 12),
        plates,
        [side * 0.72, 0.96, 0.14],
        [1.15, 0.72, 1.05],
      );
      for (let claw = 0; claw < 3; claw += 1) {
        addMesh(
          new THREE.ConeGeometry(0.055, 0.26, 6),
          claws,
          [side * (0.65 + claw * 0.075), 0.82, 0.35],
          null,
          [Math.PI / 2.5, 0, side * 0.12],
        );
      }
      addMesh(
        new THREE.CapsuleGeometry(0.17, 0.48, 5, 9),
        armor,
        [side * 0.2, 0.47, 0],
        [1, 1, 0.88],
      );
      addMesh(new THREE.BoxGeometry(0.34, 0.18, 0.49), plates, [side * 0.2, 0.14, 0.1], null);
      addMesh(new THREE.ConeGeometry(0.11, 0.3, 7), plates, [side * 0.32, 2.02, -0.45], null, [
        -Math.PI / 2,
        0,
        side * 0.2,
      ]);
    }

    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.83, -0.28),
      new THREE.Vector3(0.12, 0.64, -0.72),
      new THREE.Vector3(0.38, 0.48, -1.06),
      new THREE.Vector3(0.62, 0.68, -1.26),
    ]);
    const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 14, 0.075, 7, false), hide);
    tail.castShadow = true;
    fighter.add(tail);
    addMesh(
      new THREE.ConeGeometry(0.14, 0.34, 7),
      plates,
      [0.62, 0.68, -1.26],
      null,
      [0, 0, -0.95],
    );

    const guard = makeGuardShield('#ff6678');
    fighter.add(guard);
    fighter.userData.isMonster = true;
    return { group: fighter, mixer: null, action: null, guard, materials };
  }

  function makeGuardShield(color = '#60d8ff') {
    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 24, 16),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.26,
        wireframe: true,
        depthWrite: false,
      }),
    );
    shield.position.y = 1.25;
    shield.scale.set(0.82, 1.18, 0.54);
    shield.visible = false;
    return shield;
  }

  function makeAttackArc(side) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.038, 7, 26, Math.PI * 1.55),
      new THREE.MeshBasicMaterial({
        color: side === 'player' ? '#7deaff' : '#ff916e',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    arc.visible = false;
    arc.renderOrder = 3;
    scene.add(arc);
    return arc;
  }

  function getEntryStartX(side, actorHalfWidth) {
    const actorZ = 0;
    const distance = Math.max(1, targetCameraZ + 3.4 - actorZ);
    const visibleHalfWidth =
      distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    return (side === 'player' ? -1 : 1) * (visibleHalfWidth + actorHalfWidth + 0.35);
  }

  async function loadAnimationClips() {
    const entries = await Promise.all(
      Object.keys(ANIMATION_CLIPS).map(async (id) => {
        const response = await fetch(`${root.dataset.animationBaseUrl}${id}.json`, {
          cache: 'force-cache',
        });
        if (!response.ok) throw new Error(`${id} animation request failed (${response.status})`);
        const clip = THREE.AnimationClip.parse(await response.json());
        if (!clip.duration || !clip.tracks.length)
          throw new Error(`${id} animation has no duration or tracks`);
        clip.name = id;
        return [id, clip];
      }),
    );
    return new Map(entries);
  }

  function validateAnimationRig(model, side, clips) {
    const prefix = side === 'player' ? 'hero' : 'enemy';
    const boneNames = new Set();
    model.traverse((object) => {
      if (object.isBone) boneNames.add(object.name);
    });
    if (!boneNames.size) throw new Error(`The ${side} FBX has no bones.`);

    const clipIds = Object.keys(ANIMATION_CLIPS).filter((id) => id.startsWith(prefix));
    for (const id of clipIds) {
      const clip = clips.get(id);
      if (!clip) throw new Error(`The ${side} rig is missing required animation ${id}.`);
      const trackBones = new Set(clip.tracks.map((track) => track.name.split('.')[0]));
      const unmatched = [...trackBones].filter((name) => !boneNames.has(name));
      if (!trackBones.size || unmatched.length) {
        throw new Error(
          `${id} is incompatible with the ${side} rig; unmatched bones: ${unmatched.join(', ') || 'none'}.`,
        );
      }
    }

    return new Map(clipIds.map((id) => [id, clips.get(id)]));
  }

  function cloneMaterials(model, side) {
    const tint = new THREE.Color(side === 'player' ? '#9bdcf3' : '#f08b85');
    const materials = [];

    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = true;
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => material.clone())
        : object.material.clone();

      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material.color) material.color.lerp(tint, side === 'enemy' ? 0.34 : 0.08);
        if ('roughness' in material) material.roughness = Math.max(material.roughness, 0.42);
        if (material.emissive) material.emissive.set('#000000');
        materials.push(material);
      }
    });

    return materials;
  }

  function createActor(side, sourceModel, combatClips) {
    if (!sourceModel) throw new Error(`The ${side} FBX model did not load.`);
    const model = cloneSkeleton(sourceModel);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const targetHeight = 3.3;
    const scale = targetHeight / Math.max(size.y, 1);
    model.scale.setScalar(scale);
    model.position.y = -bounds.min.y * scale;
    const materials = cloneMaterials(model, side);
    const guard = makeGuardShield();
    model.add(guard);
    const clips = sourceModel.animations.filter((animation) => animation.tracks.length > 0);
    const clip = clips[0];
    if (!clip) throw new Error(`The ${side} FBX model has no idle animation.`);
    const mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(clip);
    const idleTimeScale = side === 'enemy' ? 0.82 : 0.72;
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.timeScale = idleTimeScale;
    action.play();
    const fighter = {
      group: model,
      mixer,
      action,
      guard,
      materials,
      animationClips: clips.map((item) => item.name),
    };

    fighter.side = side;
    fighter.combatClips = combatClips;
    fighter.idleAction = fighter.action;
    fighter.currentAction = fighter.action;
    fighter.sequence = null;
    fighter.sequenceQueue = [];
    fighter.isDefeated = false;

    const group = fighter.group;
    const baseX = side === 'player' ? -1.72 : 1.72;
    const baseY = -0.1;
    const baseZ = 0.2;
    group.position.set(baseX, baseY, baseZ);
    group.rotation.y = side === 'player' ? Math.PI / 2 : -Math.PI / 2;
    group.userData.baseX = baseX;
    group.userData.baseY = baseY;
    group.userData.baseZ = group.position.z;
    group.userData.baseRotationZ = 0;
    const actorBounds = new THREE.Box3().setFromObject(group);
    const actorHalfWidth = actorBounds.getSize(new THREE.Vector3()).x / 2;
    const startX = getEntryStartX(side, actorHalfWidth);
    group.position.x = startX;
    group.userData.entry = {
      startX,
      targetX: baseX,
      elapsed: 0,
      duration: reducedMotion ? 0.45 : 1.65,
    };
    group.userData.worldX = startX;
    group.userData.worldZ = baseZ;
    group.userData.worldY = 0;
    group.userData.velocityX = 0;
    group.userData.velocityZ = 0;
    group.userData.jumpVelocity = 0;
    group.userData.facing = side === 'player' ? 1 : -1;
    group.userData.moveInput = { forward: 0, lateral: 0, dash: false, crouch: false };
    group.userData.baseScaleY = group.scale.y;
    fighter.attackArc = makeAttackArc(side);
    group.userData.attack = null;
    group.userData.hitTime = 0;
    group.userData.guardUntil = 0;
    group.userData.downTime = 0;

    scene.add(group);
    return fighter;
  }

  function addArena() {
    const hemisphere = new THREE.HemisphereLight('#dce7ff', '#25191b', 1.25);
    scene.add(hemisphere);

    const keyLight = new THREE.DirectionalLight('#fff0d8', 3.2);
    keyLight.position.set(-4.5, 8.2, 4.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -7;
    keyLight.shadow.camera.right = 7;
    keyLight.shadow.camera.top = 8;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0003;
    keyLight.shadow.normalBias = 0.04;
    scene.add(keyLight);

    const rimLight = new THREE.SpotLight('#64c9ff', 120, 18, Math.PI / 4, 0.55, 1.2);
    rimLight.position.set(0.2, 6.2, -2.6);
    rimLight.target.position.set(0, 1, 0);
    scene.add(rimLight, rimLight.target);

    const coolFill = new THREE.DirectionalLight('#7899d4', 1.1);
    coolFill.position.set(4.5, 4.2, -4.5);
    scene.add(coolFill);

    const warmFill = new THREE.PointLight('#ff9a68', 20, 12, 1.8);
    warmFill.position.set(-4.2, 3.1, 3.6);
    scene.add(warmFill);

    const points = new THREE.Points(impactGeometry, impactMaterial);
    points.visible = false;
    scene.add(points);
    impactPoints = points;

    impactRing = new THREE.Mesh(
      new THREE.RingGeometry(0.44, 0.54, 32),
      new THREE.MeshBasicMaterial({
        color: '#ffe5a1',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    impactRing.rotation.x = -Math.PI / 2;
    impactRing.position.y = 0.025;
    impactRing.scale.setScalar(0.1);
    impactRing.visible = false;
    scene.add(impactRing);

    const loader = new THREE.TextureLoader();
    loader.load(
      root.dataset.environmentUrl,
      (texture) => {
        if (isDisposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        scene.background = texture;
        environmentTexture = texture;
      },
      undefined,
      () => setStatus('3D ARENA READY'),
    );
  }

  function resize() {
    if (!renderer || !camera || isDisposed) return;
    const width = Math.max(arena.clientWidth, 1);
    const height = Math.max(arena.clientHeight, 1);
    camera.aspect = width / height;
    camera.fov = width < 620 ? 41 : 35;
    targetCameraZ = width < 620 ? 13.4 : 12.2;
    if (cameraIntroRemaining <= 0) camera.position.z = targetCameraZ;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function triggerImpact(side, intensity = 1, color = '#ffd58b') {
    const actor = actors[side]?.group;
    if (!actor || !impactPoints || !impactRing) return;

    const center = new THREE.Vector3(actor.position.x, 1.2, actor.position.z + 0.15);
    const positions = impactGeometry.attributes.position.array;
    impactVelocity.length = 0;
    for (let index = 0; index < positions.length / 3; index += 1) {
      positions[index * 3] = center.x;
      positions[index * 3 + 1] = center.y;
      positions[index * 3 + 2] = center.z;
      impactVelocity.push({
        x: (Math.random() - 0.5) * 4.2 * intensity,
        y: (Math.random() * 2.8 + 0.7) * intensity,
        z: (Math.random() - 0.5) * 3.2 * intensity,
      });
    }
    impactGeometry.attributes.position.needsUpdate = true;
    impactMaterial.color.set(color);
    impactMaterial.size = 0.08 + intensity * 0.045;
    impactMaterial.opacity = 1;
    impactPoints.visible = true;
    impactAge = 0;

    impactRing.position.set(
      (actors.player.group.position.x + actors.enemy.group.position.x) / 2,
      0.075,
      0.1,
    );
    impactRing.scale.setScalar(0.18);
    impactRing.material.color.set(color);
    impactRing.material.opacity = 0.92;
    impactRing.visible = true;
    cameraShake = Math.min(0.5, cameraShake + 0.11 * intensity);
  }

  function playOneShot(fighter, clipId, duration) {
    const clip = fighter.combatClips?.get(clipId);
    if (!clip || !fighter.mixer) {
      console.error(`Type Fighter cannot play ${clipId} on the ${fighter.side} rig.`);
      return null;
    }
    const previous = fighter.currentAction;
    const action = fighter.mixer.clipAction(clip);
    action.reset();
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = clip.duration / Math.max(0.1, duration);
    action.play();
    if (previous && previous !== action) action.crossFadeFrom(previous, 0.12, false);
    fighter.currentAction = action;
    return action;
  }

  function returnToIdle(fighter) {
    const idle = fighter.idleAction;
    if (!idle || !fighter.mixer) return;
    const previous = fighter.currentAction;
    idle.reset();
    idle.enabled = true;
    idle.setLoop(THREE.LoopRepeat, Infinity);
    idle.clampWhenFinished = false;
    idle.timeScale = fighter.side === 'enemy' ? 0.82 : 0.72;
    idle.play();
    if (previous && previous !== idle) idle.crossFadeFrom(previous, 0.18, false);
    fighter.currentAction = idle;
  }

  function fireAttackImpact(fighter, sequence) {
    if (sequence.impactFired) return;
    sequence.impactFired = true;
    sequence.onImpact?.({
      attackId: sequence.profile.attack,
      reactionId: sequence.profile.reaction,
      side: sequence.side,
      type: sequence.type,
    });
  }

  function startQueuedAttack(fighter) {
    if (fighter.isDefeated || fighter.sequence || !fighter.sequenceQueue.length) return;
    const request = fighter.sequenceQueue.shift();
    const { side, type, onImpact, onInterrupt } = request;
    const profile = FIGHT_ANIMATIONS[side]?.[type] || FIGHT_ANIMATIONS[side]?.jab;
    if (!profile || !fighter.combatClips?.has(profile.attack)) {
      console.error(`Type Fighter has no configured ${side} ${type} attack animation.`);
      onInterrupt?.();
      return;
    }
    const clip = fighter.combatClips?.get(profile.attack);
    const duration = THREE.MathUtils.clamp(clip.duration, 0.72, 1.4);
    if (!playOneShot(fighter, profile.attack, duration)) {
      onInterrupt?.();
      return;
    }
    const impactAt = duration * THREE.MathUtils.clamp(profile.impact, 0.25, 0.8);
    fighter.sequence = {
      kind: 'attack',
      side,
      type,
      profile,
      elapsed: 0,
      duration,
      impactAt,
      impactEnd: Math.min(duration, impactAt + 0.12),
      impactFired: false,
      onImpact,
      onInterrupt,
    };
    fighter.group.userData.attack = {
      elapsed: 0,
      duration,
      intensity: type === 'special' ? 1.65 : type === 'launcher' ? 1.25 : 1,
      direction: fighter.group.userData.facing,
    };
    if (fighter.attackArc) {
      fighter.attackArc.visible = true;
      fighter.attackArc.material.color.set(
        type === 'special'
          ? '#fff0a8'
          : type === 'launcher'
            ? '#a8f0ff'
            : side === 'player'
              ? '#7deaff'
              : '#ff916e',
      );
    }
  }

  function triggerAttack(side, type = 'jab', onImpact = null, onInterrupt = null) {
    const fighter = actors[side];
    if (!fighter || fighter.isDefeated) return false;
    const profile = FIGHT_ANIMATIONS[side]?.[type] || FIGHT_ANIMATIONS[side]?.jab;
    if (!profile || !fighter.combatClips?.has(profile.attack)) return false;
    fighter.sequenceQueue.push({ side, type, onImpact, onInterrupt });
    startQueuedAttack(fighter);
    return true;
  }

  function react(side, reactionId, strength = 1) {
    const fighter = actors[side];
    if (!fighter || fighter.isDefeated) return false;
    if (!fighter.mixer || !fighter.combatClips?.has(reactionId)) {
      console.error(`Type Fighter has no ${side} reaction animation ${reactionId}.`);
      return false;
    }
    for (const request of fighter.sequenceQueue) request.onInterrupt?.();
    fighter.sequenceQueue.length = 0;
    if (fighter.sequence?.kind === 'attack' && !fighter.sequence.impactFired) {
      fighter.sequence.onInterrupt?.({
        attackId: fighter.sequence.profile.attack,
        side: fighter.sequence.side,
        type: fighter.sequence.type,
      });
    }
    fighter.sequence = null;
    fighter.group.userData.attack = null;
    if (fighter.attackArc) fighter.attackArc.visible = false;
    const clip = fighter.combatClips?.get(reactionId);
    const duration = THREE.MathUtils.clamp(clip.duration, 0.72, 1.35);
    if (!playOneShot(fighter, reactionId, duration)) return false;
    fighter.sequence = { kind: 'reaction', elapsed: 0, duration };
    fighter.group.userData.hitTime = 0.32 * strength;
    triggerImpact(side, Math.min(1.25, strength), side === 'player' ? '#71dfff' : '#ff866e');
    return true;
  }

  function setGuard(side, duration = 2) {
    const actor = actors[side];
    if (actor?.isDefeated) return;
    const group = actor?.group;
    const guard = actors[side]?.guard;
    if (!group || !guard) return;
    group.userData.guardUntil = performance.now() + duration * 1000;
    guard.visible = true;
  }

  function knockOut(side) {
    const fighter = actors[side];
    if (!fighter || fighter.isDefeated) return 0;
    const clipId = DEFEAT_ANIMATIONS[side];
    const clip = fighter.combatClips?.get(clipId);
    if (!clip || !fighter.mixer) {
      console.error(`Type Fighter has no ${side} defeat animation ${clipId}.`);
      return 0;
    }
    fighter.isDefeated = true;
    fighter.sequenceQueue.length = 0;
    fighter.sequence = null;
    fighter.group.userData.attack = null;
    if (fighter.attackArc) fighter.attackArc.visible = false;
    const duration = THREE.MathUtils.clamp(clip.duration, 1.2, 2.5);
    playOneShot(fighter, clipId, duration);
    fighter.sequence = { kind: 'defeat', elapsed: 0, duration };
    triggerImpact(side, 1.4, '#ffe7a6');
    return duration;
  }

  function resetFighter(side) {
    const group = actors[side]?.group;
    if (!group) return;
    const fighter = actors[side];
    fighter.isDefeated = false;
    fighter.sequence = null;
    fighter.sequenceQueue.length = 0;
    fighter.mixer?.stopAllAction();
    fighter.currentAction = fighter.idleAction;
    if (fighter.idleAction) {
      fighter.idleAction.reset();
      fighter.idleAction.setLoop(THREE.LoopRepeat, Infinity);
      fighter.idleAction.timeScale = side === 'enemy' ? 0.82 : 0.72;
      fighter.idleAction.play();
    }
    group.visible = true;
    group.userData.worldX = group.userData.baseX;
    group.userData.worldZ = group.userData.baseZ;
    group.userData.worldY = 0;
    group.userData.velocityX = 0;
    group.userData.velocityZ = 0;
    group.userData.jumpVelocity = 0;
    group.userData.moveInput = { forward: 0, lateral: 0, dash: false, crouch: false };
    group.position.set(group.userData.worldX, group.userData.baseY, group.userData.worldZ);
    group.scale.y = group.userData.baseScaleY;
    group.rotation.z = group.userData.baseRotationZ;
    group.userData.downTime = 0;
    group.userData.attack = null;
    if (actors[side].guard) actors[side].guard.visible = false;
  }

  function updateActor(fighter, delta, side) {
    if (!fighter) return;
    const group = fighter.group;
    const attack = group.userData.attack;
    const move = group.userData.moveInput;

    fighter.mixer?.update(delta);

    const sequence = fighter.sequence;
    if (sequence) {
      const previousElapsed = sequence.elapsed;
      sequence.elapsed += delta;
      if (
        sequence.kind === 'attack' &&
        previousElapsed <= sequence.impactEnd &&
        sequence.elapsed >= sequence.impactAt
      ) {
        fireAttackImpact(fighter, sequence);
      }
      if (sequence.elapsed >= sequence.duration) {
        group.userData.attack = null;
        if (fighter.attackArc) fighter.attackArc.visible = false;
        fighter.sequence = null;
        if (sequence.kind !== 'defeat') {
          returnToIdle(fighter);
          startQueuedAttack(fighter);
        }
      }
    }

    const entry = group.userData.entry;
    if (entry) {
      entry.elapsed = Math.min(entry.duration, entry.elapsed + delta);
      const progress = entry.elapsed / entry.duration;
      const easedProgress = progress * progress * (3 - 2 * progress);
      group.userData.worldX = THREE.MathUtils.lerp(entry.startX, entry.targetX, easedProgress);
      group.position.set(group.userData.worldX, group.userData.baseY, group.userData.baseZ);
      group.userData.velocityX = 0;
      group.userData.velocityZ = 0;
      if (fighter.action) {
        const idleTimeScale = side === 'enemy' ? 0.82 : 0.72;
        const settle = THREE.MathUtils.smoothstep(progress, 0.72, 1);
        fighter.action.timeScale = THREE.MathUtils.lerp(1.05, idleTimeScale, settle);
      }
      if (progress >= 1) {
        group.userData.entry = null;
        group.userData.worldX = entry.targetX;
        group.position.x = entry.targetX;
        if (fighter.action) fighter.action.timeScale = side === 'enemy' ? 0.82 : 0.72;
      }
      if (
        entryResolve &&
        !actors.player?.group.userData.entry &&
        !actors.enemy?.group.userData.entry
      ) {
        entryResolve();
        entryResolve = null;
      }
      return;
    }

    if (fighter.isDefeated && !fighter.sequence) return;

    const facing = group.userData.facing;
    const speed = move.crouch ? 0.5 : move.dash ? 3.7 : side === 'player' ? 2.05 : 1.55;
    const targetVelocityX =
      attack || group.userData.downTime > 0 ? 0 : facing * move.forward * speed;
    const targetVelocityZ =
      attack || group.userData.downTime > 0 ? 0 : move.lateral * (move.dash ? 2.8 : 1.55);
    const acceleration = Math.min(1, delta * 12);
    group.userData.velocityX += (targetVelocityX - group.userData.velocityX) * acceleration;
    group.userData.velocityZ += (targetVelocityZ - group.userData.velocityZ) * acceleration;
    const opponent = actors[side === 'player' ? 'enemy' : 'player']?.group;
    const minX = side === 'player' ? -4.15 : -3.3;
    const maxX = side === 'player' ? 3.3 : 4.15;
    let nextX = THREE.MathUtils.clamp(
      group.userData.worldX + group.userData.velocityX * delta,
      minX,
      maxX,
    );
    if (
      opponent &&
      (side === 'player'
        ? nextX > opponent.userData.worldX - FIGHTER_COLLISION_GAP
        : nextX < opponent.userData.worldX + FIGHTER_COLLISION_GAP)
    ) {
      nextX = group.userData.worldX;
      group.userData.velocityX = 0;
    }
    group.userData.worldX = nextX;
    group.userData.worldZ = THREE.MathUtils.clamp(
      group.userData.worldZ + group.userData.velocityZ * delta,
      -1.55,
      1.55,
    );

    if (group.userData.jumpVelocity || group.userData.worldY > 0) {
      group.userData.jumpVelocity -= 12.5 * delta;
      group.userData.worldY = Math.max(
        0,
        group.userData.worldY + group.userData.jumpVelocity * delta,
      );
      if (group.userData.worldY === 0) group.userData.jumpVelocity = 0;
    }

    if (attack) {
      attack.elapsed += delta;
      const progress = Math.min(attack.elapsed / attack.duration, 1);
      const pulse = Math.sin(progress * Math.PI);
      group.position.x = group.userData.worldX + attack.direction * pulse * 0.66 * attack.intensity;
      group.position.z = group.userData.worldZ + Math.sin(progress * Math.PI) * 0.12;
      group.rotation.z =
        group.userData.baseRotationZ + Math.sin(progress * Math.PI * 2) * 0.08 * attack.intensity;
      if (fighter.attackArc) {
        fighter.attackArc.position.set(
          group.position.x + attack.direction * 0.32,
          1.34 + group.userData.worldY,
          group.position.z + 0.34,
        );
        fighter.attackArc.rotation.z = (side === 'player' ? 0.2 : Math.PI - 0.2) + progress * 0.8;
        fighter.attackArc.scale.setScalar((0.72 + pulse * 0.72) * attack.intensity);
        fighter.attackArc.material.opacity = pulse * (attack.intensity > 1.4 ? 0.92 : 0.68);
        fighter.attackArc.visible = progress < 0.82;
      }
      if (progress >= 1) {
        group.position.x = group.userData.worldX;
        group.position.z = group.userData.worldZ;
        group.rotation.z = group.userData.baseRotationZ;
        group.userData.attack = null;
        if (fighter.attackArc) fighter.attackArc.visible = false;
      }
    } else {
      group.position.x = group.userData.worldX;
      group.position.z = group.userData.worldZ;
      group.position.y = group.userData.baseY + group.userData.worldY;
      group.scale.y = group.userData.baseScaleY * (move.crouch ? 0.88 : 1);
      if (fighter.attackArc) fighter.attackArc.visible = false;
    }

    if (group.userData.hitTime > 0) {
      group.userData.hitTime = Math.max(0, group.userData.hitTime - delta);
      const flash = group.userData.hitTime / 0.32;
      for (const material of fighter.materials) {
        if (material.emissive) {
          material.emissive.set(side === 'player' ? '#245b70' : '#682723');
          material.emissiveIntensity = flash * 1.65;
        }
      }
    } else {
      for (const material of fighter.materials) {
        if (material.emissive) material.emissiveIntensity = 0;
      }
    }

    if (fighter.guard) {
      const active = performance.now() < group.userData.guardUntil;
      fighter.guard.visible = active;
      if (active) fighter.guard.rotation.y += delta * 0.85;
    }
  }

  function updateEffects(delta) {
    if (impactAge < 0.85 && impactPoints && impactRing) {
      impactAge += delta;
      const positions = impactGeometry.attributes.position.array;
      for (let index = 0; index < impactVelocity.length; index += 1) {
        const velocity = impactVelocity[index];
        positions[index * 3] += velocity.x * delta;
        positions[index * 3 + 1] += velocity.y * delta;
        positions[index * 3 + 2] += velocity.z * delta;
        velocity.y -= 5.8 * delta;
      }
      impactGeometry.attributes.position.needsUpdate = true;
      impactMaterial.opacity = Math.max(0, 1 - impactAge / 0.85);
      impactRing.scale.setScalar(0.18 + impactAge * 3.4);
      impactRing.material.opacity = Math.max(0, 0.92 - impactAge * 1.25);
      cameraShake = Math.max(0, cameraShake - delta * 1.3);
    } else {
      if (impactPoints) impactPoints.visible = false;
      if (impactRing) impactRing.visible = false;
    }
  }

  function animate(time) {
    if (isDisposed) return;
    if (isPaused) {
      frameId = null;
      return;
    }
    frameId = requestAnimationFrame(animate);
    if (document.hidden) return;

    const delta = previousFrame ? Math.min((time - previousFrame) / 1000, 0.05) : 0;
    previousFrame = time;
    updateActor(actors.player, delta, 'player');
    updateActor(actors.enemy, delta, 'enemy');
    updateEffects(delta);

    roundLightTime += delta;
    const cameraTarget = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake : 0;
    const playerX = actors.player?.group.userData.worldX || 0;
    const enemyX = actors.enemy?.group.userData.worldX || 0;
    const centerX = (playerX + enemyX) / 2;
    camera.position.x += (centerX + cameraTarget - camera.position.x) * Math.min(1, delta * 5);
    cameraIntroRemaining = Math.max(0, cameraIntroRemaining - delta);
    const introProgress = 1 - cameraIntroRemaining / 1.8;
    const introEase = introProgress * introProgress * (3 - 2 * introProgress);
    const introOffset = 3.4 * (1 - introEase);
    const fightDistance = Math.abs(enemyX - playerX);
    const entering = Boolean(
      actors.player?.group.userData.entry || actors.enemy?.group.userData.entry,
    );
    const dynamicCameraZ = targetCameraZ + (entering ? 0 : Math.max(0, fightDistance - 3.4) * 0.7);
    camera.position.z +=
      (dynamicCameraZ + introOffset - camera.position.z) * Math.min(1, delta * 4.5);
    const baseCameraHeight = 3.1 + Math.sin(roundLightTime * 0.36) * 0.035;
    camera.position.y +=
      (baseCameraHeight + 1.15 * (1 - introEase) - camera.position.y) * Math.min(1, delta * 3.5);
    camera.lookAt(centerX, cameraLookHeight, 0);
    renderer.render(scene, camera);
  }

  function setPaused(paused) {
    isPaused = paused;
    if (paused) {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
    } else if (!isDisposed && frameId === null) {
      previousFrame = 0;
      frameId = requestAnimationFrame(animate);
    }
  }

  function enter() {
    if (!actors.player?.group.userData.entry && !actors.enemy?.group.userData.entry)
      return Promise.resolve();
    return new Promise((resolve) => {
      entryResolve = resolve;
    });
  }

  function setMovement(side, movement = {}) {
    const fighter = actors[side];
    const actor = fighter?.group;
    if (!actor || fighter.isDefeated) return;
    const current = actor.userData.moveInput;
    current.forward = THREE.MathUtils.clamp(Number(movement.forward) || 0, -1, 1);
    current.lateral = THREE.MathUtils.clamp(Number(movement.lateral) || 0, -1, 1);
    current.dash = Boolean(movement.dash);
    current.crouch = Boolean(movement.crouch);
    if (movement.jump && actor.userData.worldY === 0 && actor.userData.downTime <= 0) {
      actor.userData.jumpVelocity = 4.8;
    }
  }

  function getDistance() {
    if (!actors.player || !actors.enemy) return 3.44;
    return Math.hypot(
      actors.enemy.group.userData.worldX - actors.player.group.userData.worldX,
      actors.enemy.group.userData.worldZ - actors.player.group.userData.worldZ,
    );
  }

  function canBeHit(side) {
    const fighter = actors[side];
    return Boolean(fighter && !fighter.isDefeated && fighter.sequence?.kind !== 'defeat');
  }

  function getAnimationState(side) {
    const fighter = actors[side];
    if (!fighter) return { state: 'unavailable', clip: null, playing: false, defeated: false };
    return {
      state: fighter.sequence?.kind || 'idle',
      clip: fighter.currentAction?.getClip().name || null,
      playing: Boolean(fighter.currentAction?.isRunning()),
      defeated: fighter.isDefeated,
      position: {
        x: fighter.group.userData.worldX,
        y: fighter.group.position.y,
        z: fighter.group.userData.worldZ,
      },
      facing: fighter.group.userData.facing,
    };
  }

  function isEvading(side) {
    const actor = actors[side]?.group;
    return Boolean(
      actor && (Math.abs(actor.userData.velocityZ) > 0.75 || actor.userData.worldY > 0.35),
    );
  }

  async function initialize() {
    arena.style.position = 'relative';
    arena.style.overflow = 'hidden';
    setStatus('LOADING 3D ARENA');

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !reducedMotion,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.domElement.id = 'fighter3DCanvas';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = !reducedMotion;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      arena.prepend(renderer.domElement);

      scene = new THREE.Scene();
      scene.background = new THREE.Color('#392c32');
      scene.fog = new THREE.Fog('#352a31', 16, 36);
      camera = new THREE.PerspectiveCamera(35, 1, 0.1, 70);
      camera.position.set(0, 3.3, 12.2);
      camera.lookAt(0, cameraLookHeight, 0);

      addArena();
      resize();
      camera.position.z = targetCameraZ + 3.4;
      camera.position.y = 4.25;

      const loader = new FBXLoader();
      const [sourceModel, enemyModel, loadedClips] = await Promise.all([
        loader.loadAsync(root.dataset.modelUrl),
        loader.loadAsync(root.dataset.enemyModelUrl),
        loadAnimationClips(),
      ]);
      const playerClips = validateAnimationRig(sourceModel, 'player', loadedClips);
      const enemyClips = validateAnimationRig(enemyModel, 'enemy', loadedClips);

      if (isDisposed) return;
      actors.player = createActor('player', sourceModel, playerClips);
      actors.enemy = createActor('enemy', enemyModel, enemyClips);

      setStatus('ARENA READY · TYPE TO FIGHT');
      if (!isPaused) frameId = requestAnimationFrame(animate);
    } catch (error) {
      console.error('Type Fighter 3D renderer failed to initialize.', error);
      setStatus('ANIMATION ASSETS FAILED · RELOAD MATCH');
      renderer?.dispose();
      renderer?.domElement.remove();
      throw error;
    }
  }

  function dispose() {
    if (isDisposed) return;
    isDisposed = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    window.removeEventListener('pagehide', dispose);
    resizeObserver.disconnect();

    const disposedTextures = new Set();
    scene?.traverse((object) => {
      object.geometry?.dispose?.();
      if (object.material) {
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          for (const value of Object.values(material)) {
            if (value?.isTexture && !disposedTextures.has(value)) {
              value.dispose();
              disposedTextures.add(value);
            }
          }
          material.dispose?.();
        }
      }
    });
    if (environmentTexture && !disposedTextures.has(environmentTexture))
      environmentTexture.dispose();
    impactGeometry.dispose();
    impactMaterial.dispose();
    renderer?.dispose();
    renderer?.domElement.remove();
    delete window.typeFighter3D;
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(arena);
  window.addEventListener('pagehide', dispose, { once: true });

  window.typeFighter3D = {
    attack: triggerAttack,
    react,
    guard: setGuard,
    move: setMovement,
    distance: getDistance,
    isEvading,
    canBeHit,
    getAnimationState,
    knockout: knockOut,
    resetFighter,
    enter,
    setPaused,
    dispose,
    ready: initialize(),
  };
}
