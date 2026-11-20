# Type Fighter implementation notes

## Arena assets and animation

`templates/games/type_fighter/game.html` supplies the player `hero.fbx` and opponent `enemy.fbx` URLs. `npm run build:type-fighter` parses every action FBX with `FBXLoader`, verifies its bone tracks against the corresponding base rig, and extracts compact animation clips into `assets/animations/`. The runtime loads and validates every extracted clip, then assigns only hero clips to the hero mixer and enemy clips to the enemy mixer. Missing or incompatible assets stop the match with an explicit error; the game does not substitute unanimated fighters.

Each actor has one `AnimationMixer`. The base model's skeletal clip loops as its idle animation; attack, hit-reaction, and defeat clips transition through one-shot actions and return to idle after surviving a hit. Attack callbacks fire once inside each move's active impact window, where range, evasion, guard, and target state are checked before damage is applied. The two actors are normalized to the same arena height, face one another, and are slightly lowered in frame. The existing background is preserved; the arena has no added floor or bottom stage.

## Typing target

`src/difficulty.js` contains difficulty balance and sentence templates. `js/game.js` owns the sentence cursor and exposes the sentence in a transparent HUD over the lower arena background. Each correctly completed word queues exactly one attack; wrong characters do not trigger attacks, and input remains available while the attack animation recovers. `src/typing-input.js` accepts only a single newly inserted character or a valid backspace, so a replayed or multi-character input cannot advance the cursor. A spacebar character completes the current word only when it matches the paragraph separator.

## Verification

- `node --test static/games/type_fighter/tests/typing-input.test.mjs`
- `node --test static/games/type_fighter/tests/animations.test.mjs`
- `npm run build:type-fighter`
- `python manage.py check`
- `python manage.py test type.tests.test_type_fighter_results type.tests.test_space_shooter`

The animation tests parse all supplied action FBXs, compare each extracted runtime clip to its source, verify rig compatibility, and play each clip on its intended skeleton. Browser checks should also cover attack/reaction timing, damage/health updates, and fighter recovery.
