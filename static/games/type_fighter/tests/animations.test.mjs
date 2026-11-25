import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import test from 'node:test';
import library from '../src/animation-library.json' with { type: 'json' };

const { ANIMATION_CLIPS, DEFEAT_ANIMATIONS, FIGHT_ANIMATIONS } = library;

test('every configured combat animation source and extracted clip exists', () => {
  for (const [id, source] of Object.entries(ANIMATION_CLIPS)) {
    assert.ok(existsSync(`static/games/type_fighter/assets/models/${source}`), `${id} source`);
    const clipPath = `static/games/type_fighter/assets/animations/${id}.json`;
    assert.ok(existsSync(clipPath), `${id} clip`);
    const clip = THREE.AnimationClip.parse(JSON.parse(readFileSync(clipPath, 'utf8')));
    assert.ok(clip.tracks.length > 0, `${id} has animation tracks`);
  }
});

test('every attack maps to an existing opponent reaction with a valid impact point', () => {
  for (const [side, attacks] of Object.entries(FIGHT_ANIMATIONS)) {
    const opponent = side === 'player' ? 'enemy' : 'player';
    for (const [type, mapping] of Object.entries(attacks)) {
      assert.ok(ANIMATION_CLIPS[mapping.attack], `${side}.${type} attack`);
      assert.ok(ANIMATION_CLIPS[mapping.reaction], `${side}.${type} reaction`);
      assert.ok(mapping.impact > 0 && mapping.impact < 1, `${side}.${type} impact`);
      assert.ok(
        mapping.reaction.toLowerCase().startsWith(opponent === 'player' ? 'hero' : 'enemy'),
        `${side}.${type} opponent rig reaction`,
      );
    }
  }
});

test('both fighter rigs have configured defeat animations', () => {
  assert.equal(Object.keys(DEFEAT_ANIMATIONS).length, 2);
  for (const id of Object.values(DEFEAT_ANIMATIONS)) assert.ok(ANIMATION_CLIPS[id]);
});

test('all supplied attack, reaction, and defeat clips are connected to combat actions', () => {
  const configured = new Set(Object.values(DEFEAT_ANIMATIONS));
  for (const attacks of Object.values(FIGHT_ANIMATIONS)) {
    for (const mapping of Object.values(attacks)) {
      configured.add(mapping.attack);
      configured.add(mapping.reaction);
    }
  }
  assert.deepEqual([...Object.keys(ANIMATION_CLIPS)].filter((id) => !configured.has(id)), []);
  assert.equal(FIGHT_ANIMATIONS.player.kick.attack, 'heroDropKick');
  assert.equal(FIGHT_ANIMATIONS.player.kick.reaction, 'enemyDropKickReaction');
  assert.equal(FIGHT_ANIMATIONS.player.launcher.attack, 'heroFlipKick');
  assert.equal(FIGHT_ANIMATIONS.player.launcher.reaction, 'enemyFlipKickReaction');
  assert.equal(FIGHT_ANIMATIONS.player.heavy.attack, 'heroKneeCombo');
  assert.equal(FIGHT_ANIMATIONS.player.heavy.reaction, 'enemyKneeReaction');
  assert.equal(FIGHT_ANIMATIONS.enemy.kick.attack, 'enemyDropKick');
  assert.equal(FIGHT_ANIMATIONS.enemy.launcher.attack, 'enemyFlipKick');
  assert.equal(FIGHT_ANIMATIONS.enemy.special.attack, 'enemyKneeCombo');
});

test('attack categories pair with the matching opposite-side reactions', () => {
  assert.equal(FIGHT_ANIMATIONS.player.kick.attack, 'heroDropKick');
  assert.equal(FIGHT_ANIMATIONS.player.kick.reaction, 'enemyDropKickReaction');
  assert.equal(FIGHT_ANIMATIONS.player.launcher.attack, 'heroFlipKick');
  assert.equal(FIGHT_ANIMATIONS.player.launcher.reaction, 'enemyFlipKickReaction');
  assert.equal(FIGHT_ANIMATIONS.player.heavy.attack, 'heroKneeCombo');
  assert.equal(FIGHT_ANIMATIONS.player.heavy.reaction, 'enemyKneeReaction');
  assert.equal(FIGHT_ANIMATIONS.enemy.kick.attack, 'enemyDropKick');
  assert.equal(FIGHT_ANIMATIONS.enemy.kick.reaction, 'heroDropKickReaction');
  assert.equal(FIGHT_ANIMATIONS.enemy.launcher.attack, 'enemyFlipKick');
  assert.equal(FIGHT_ANIMATIONS.enemy.launcher.reaction, 'heroFlipKickReaction');
  assert.equal(FIGHT_ANIMATIONS.enemy.heavy.attack, 'enemyMutantPunch');
  assert.equal(FIGHT_ANIMATIONS.enemy.heavy.reaction, 'heroKneeReaction');
  assert.equal(FIGHT_ANIMATIONS.enemy.jab.attack, 'enemyPunch');
  assert.equal(FIGHT_ANIMATIONS.enemy.jab.reaction, 'heroKneeReaction');
  assert.equal(FIGHT_ANIMATIONS.enemy.special.attack, 'enemyKneeCombo');
  assert.equal(FIGHT_ANIMATIONS.enemy.special.reaction, 'heroKneeReaction');
});

test('all attack and reaction clips bind to their matching FBX rig and animate bones', () => {
  globalThis.document = {
    createElementNS: () => ({
      addEventListener() {},
      removeEventListener() {},
      set src(value) {},
    }),
  };
  const loadFbx = (path) => {
    const data = readFileSync(path);
    return new FBXLoader().parse(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      './',
    );
  };
  const rigs = {
    hero: loadFbx('static/games/type_fighter/assets/models/hero.fbx'),
    enemy: loadFbx('static/games/type_fighter/assets/models/enemy.fbx'),
  };

  for (const id of Object.keys(ANIMATION_CLIPS)) {
    const rigName = id.startsWith('hero') ? 'hero' : 'enemy';
    const model = cloneSkeleton(rigs[rigName]);
    const clip = THREE.AnimationClip.parse(
      JSON.parse(readFileSync(`static/games/type_fighter/assets/animations/${id}.json`, 'utf8')),
    );
    const before = new Map(
      clip.tracks.map((track) => {
        const [boneName, property] = track.name.split('.');
        const bone = model.getObjectByName(boneName);
        return [track.name, bone[property].toArray()];
      }),
    );
    const mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.play();
    mixer.update(Math.min(0.37, clip.duration * 0.4));

    const changedBone = [...before].some(([trackName, initial]) => {
      const [boneName, property] = trackName.split('.');
      const current = model.getObjectByName(boneName)[property].toArray();
      return initial.some((value, index) => Math.abs(value - current[index]) > 1e-5);
    });
    assert.ok(action.isRunning(), `${id} action should be running`);
    assert.ok(changedBone, `${id} should change a bone transform on the ${rigName} rig`);
    mixer.stopAllAction();
  }
});

test('every supplied action FBX parses and exactly matches its runtime clip on the target rig', () => {
  globalThis.document = {
    createElementNS: () => ({
      addEventListener() {},
      removeEventListener() {},
      set src(value) {},
    }),
  };
  const loadFbx = (path) => {
    const data = readFileSync(path);
    return new FBXLoader().parse(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      './',
    );
  };
  const rigs = {
    hero: loadFbx('static/games/type_fighter/assets/models/hero.fbx'),
    enemy: loadFbx('static/games/type_fighter/assets/models/enemy.fbx'),
  };
  const rigBones = {};
  for (const [side, model] of Object.entries(rigs)) {
    rigBones[side] = new Set();
    model.traverse((object) => {
      if (object.isBone) rigBones[side].add(object.name);
    });
  }

  for (const [id, source] of Object.entries(ANIMATION_CLIPS)) {
    const side = id.startsWith('hero') ? 'hero' : 'enemy';
    const sourceModel = loadFbx(`static/games/type_fighter/assets/models/${source}`);
    assert.equal(sourceModel.animations.length, 1, `${source} should contain one animation`);
    const sourceClip = sourceModel.animations[0];
    const runtimeClip = THREE.AnimationClip.parse(
      JSON.parse(readFileSync(`static/games/type_fighter/assets/animations/${id}.json`, 'utf8')),
    );
    assert.equal(runtimeClip.duration, sourceClip.duration, `${id} duration`);
    assert.deepEqual(
      runtimeClip.tracks.map((track) => track.name),
      sourceClip.tracks.map((track) => track.name),
      `${id} tracks`,
    );
    for (let index = 0; index < sourceClip.tracks.length; index += 1) {
      const sourceTrack = sourceClip.tracks[index];
      const runtimeTrack = runtimeClip.tracks[index];
      assert.deepEqual(Array.from(runtimeTrack.times), Array.from(sourceTrack.times), `${id} times`);
      assert.deepEqual(
        Array.from(runtimeTrack.values),
        Array.from(sourceTrack.values),
        `${id} values`,
      );
      const boneName = sourceTrack.name.split('.')[0];
      assert.ok(rigBones[side].has(boneName), `${source} track ${sourceTrack.name} binds to ${side}`);
    }
  }
});
