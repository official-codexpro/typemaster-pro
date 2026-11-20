// All combat and typing balance lives here so new modes can be tuned centrally.
export const DIFFICULTIES = {
  easy: {
    title: 'Easy',
    subtitle: 'Beginner',
    accent: '#65e6bd',
    skill: 'New to typing games',
    targetWpm: '10–20',
    targetAccuracy: '85%+',
    description: 'Learn the rhythm, build confidence, and explore the arena.',
    intensity: 'Calm',
    challenge: 'Forgiving windows and gentle pressure',
    words: ['dash', 'guard', 'kick', 'move', 'palm', 'rush', 'spin', 'step', 'sweep', 'wind'],
    timer: 8.5,
    aiInterval: 4.4,
    reaction: 1.25,
    aiDamage: 7,
    defenseChance: 0.08,
    evadeChance: 0.05,
    recovery: 1.15,
    playerDamage: 1.16,
    comboWindow: 4.1,
    accuracy: 0.72,
    mistakeDamage: 0.25,
    sentenceLength: 1,
    specialWords: 2,
  },
  normal: {
    title: 'Normal',
    subtitle: 'Intermediate',
    accent: '#83a7ff',
    skill: 'Comfortable with touch typing',
    targetWpm: '20–40',
    targetAccuracy: '90%+',
    description: 'A balanced duel for steady practice and clean combinations.',
    intensity: 'Balanced',
    challenge: 'Measured offense with room to recover',
    words: [
      'counter',
      'crimson',
      'deflect',
      'feint',
      'impact',
      'jab',
      'parry',
      'rising',
      'sidestep',
      'strike',
      'sweep',
      'velocity',
      'whirlwind',
    ],
    timer: 6.3,
    aiInterval: 3.55,
    reaction: 0.95,
    aiDamage: 9,
    defenseChance: 0.16,
    evadeChance: 0.1,
    recovery: 0.82,
    playerDamage: 1,
    comboWindow: 3.2,
    accuracy: 0.82,
    mistakeDamage: 0.7,
    sentenceLength: 2,
    specialWords: 3,
  },
  hard: {
    title: 'Hard',
    subtitle: 'Advanced',
    accent: '#ffb45e',
    skill: 'Fast and accurate typists',
    targetWpm: '40–60',
    targetAccuracy: '94%+',
    description: 'Longer calls and sharper reactions demand deliberate play.',
    intensity: 'High',
    challenge: 'Tight windows and frequent counters',
    words: [
      'counterpunch',
      'crosscounter',
      'disengage',
      'dragonkick',
      'intercept',
      'overhead',
      'punishment',
      'riposte',
      'sidestepstrike',
      'whirlwindkick',
    ],
    timer: 4.8,
    aiInterval: 3.05,
    reaction: 0.72,
    aiDamage: 11,
    defenseChance: 0.27,
    evadeChance: 0.16,
    recovery: 0.62,
    playerDamage: 0.94,
    comboWindow: 2.65,
    accuracy: 0.9,
    mistakeDamage: 1.25,
    sentenceLength: 3,
    specialWords: 4,
  },
  extreme: {
    title: 'Extreme',
    subtitle: 'Expert',
    accent: '#ff7185',
    skill: 'Expert speed and precision',
    targetWpm: '60–90+',
    targetAccuracy: '97%+',
    description: 'Complex calls, rapid decisions, and little room for error.',
    intensity: 'Maximum',
    challenge: 'Aggressive patterns and strict execution',
    words: [
      'anticipation',
      'countersequence',
      'displacement',
      'interception',
      'overextension',
      'punishwindow',
      'reversalstrike',
      'whirlwindcounter',
    ],
    timer: 3.6,
    aiInterval: 2.65,
    reaction: 0.55,
    aiDamage: 13,
    defenseChance: 0.36,
    evadeChance: 0.2,
    recovery: 0.48,
    playerDamage: 0.88,
    comboWindow: 2.2,
    accuracy: 0.96,
    mistakeDamage: 1.8,
    sentenceLength: 4,
    specialWords: 5,
  },
};

export const FIGHTING_PARAGRAPHS = {
  easy: [
    'The monster charges. Guard, dodge, and strike the beast.',
    'Stay calm. Block the heavy hit, then attack the monster.',
    'The beast steps closer. Move back, defend, and strike.',
  ],
  normal: [
    'The monster charges across the arena. Keep your guard high, dodge its heavy swing, then strike when the beast is exposed.',
    'Watch the creature carefully. Block the first attack, step around its claws, and answer with a clean counterstrike.',
    'The beast roars and lunges forward. Hold your ground, read its movement, then punish the opening with a quick attack.',
  ],
  hard: [
    'The armored monster feints left, then drives forward with a crushing blow. Sidestep the impact, recover your stance, and counter before it can guard.',
    "A precise fighter studies every movement. Deflect the beast's first strike, evade its follow-up, then deliver a measured combination to its exposed side.",
    'The creature guards its center and waits for a mistake. Change your rhythm, bait the heavy swing, and punish its recovery with a decisive counter.',
  ],
  extreme: [
    'The relentless beast shifts its weight, disguises a sweeping attack, and commits to a punishing overhead. Read the feint, displace your stance, and retaliate during the recovery window.',
    "Against the monster's layered offense, patience matters more than speed: intercept its approach, preserve your guard, evade the reversal, and answer with an exacting countersequence.",
    'The arena trembles as the creature prepares its final combination. Deflect the opening strike, disengage from the follow-up, then exploit the brief opening with a controlled riposte.',
  ],
};

export function paragraphsForDifficulty(difficulty, config) {
  if (difficulty !== 'custom') return FIGHTING_PARAGRAPHS[difficulty] || FIGHTING_PARAGRAPHS.normal;
  if (config.sentenceLength <= 1) return FIGHTING_PARAGRAPHS.easy;
  if (config.sentenceLength >= 3) return FIGHTING_PARAGRAPHS.hard;
  return FIGHTING_PARAGRAPHS.normal;
}

export function customConfiguration(params = {}) {
  const base = { ...DIFFICULTIES.normal, title: 'Custom', subtitle: 'Personal Practice' };
  const number = (key, fallback, min, max) =>
    Math.max(min, Math.min(max, Number(params[key]) || fallback));
  const targetWpm = number('target_wpm', 35, 10, 120);
  base.timer = number('timer', Math.max(3, 300 / targetWpm), 2.5, 12);
  base.aiInterval = 5.7 - (number('aggression', 50, 0, 100) / 100) * 4;
  base.reaction = 1.25 - (number('reaction', 50, 0, 100) / 100) * 0.9;
  const complexity = number('complexity', 50, 0, 100);
  base.words =
    complexity < 34
      ? DIFFICULTIES.easy.words
      : complexity > 66
        ? DIFFICULTIES.hard.words
        : DIFFICULTIES.normal.words;
  base.mistakeDamage = 0.8;
  base.sentenceLength = complexity < 34 ? 1 : complexity > 66 ? 3 : 2;
  base.accent = '#c99aff';
  base.intensity = 'Player tuned';
  base.challenge = `${targetWpm} WPM target`;
  return base;
}
