import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import animationLibrary from '../static/games/type_fighter/src/animation-library.json' with { type: 'json' };

const { ANIMATION_CLIPS } = animationLibrary;

const modelsRoot = 'static/games/type_fighter/assets/models';
const outputRoot = 'static/games/type_fighter/assets/animations';

globalThis.document = {
  createElementNS: () => ({
    addEventListener() {},
    removeEventListener() {},
    set src(value) {},
  }),
};

function parseFbx(path) {
  const data = readFileSync(path);
  return new FBXLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    './',
  );
}

function getBoneNames(model) {
  const names = new Set();
  model.traverse((object) => {
    if (object.isBone) names.add(object.name);
  });
  return names;
}

const rigBones = {
  hero: getBoneNames(parseFbx(join(modelsRoot, 'hero.fbx'))),
  enemy: getBoneNames(parseFbx(join(modelsRoot, 'enemy.fbx'))),
};

for (const [id, relativePath] of Object.entries(ANIMATION_CLIPS)) {
  const sourcePath = join(modelsRoot, relativePath);
  const model = parseFbx(sourcePath);
  const clip = model.animations.find((animation) => animation.tracks.length > 0);
  if (!clip) throw new Error(`No animation clip found in ${sourcePath}`);

  const rig = id.startsWith('hero') ? 'hero' : 'enemy';
  const unmatchedBones = new Set(
    clip.tracks.map((track) => track.name.split('.')[0]).filter((name) => !rigBones[rig].has(name)),
  );
  if (unmatchedBones.size) {
    throw new Error(
      `${id} contains tracks not present on the ${rig} base model: ${[...unmatchedBones].join(', ')}`,
    );
  }

  const serialized = clip.toJSON();
  serialized.uuid = id;
  const outputPath = join(outputRoot, `${id}.json`);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(serialized));
  console.log(
    `${id}: ${clip.duration.toFixed(2)}s, ${clip.tracks.length} tracks, ${statSync(outputPath).size} bytes`,
  );
}

console.log(`Extracted ${Object.keys(ANIMATION_CLIPS).length} rig-compatible Type Fighter clips.`);
