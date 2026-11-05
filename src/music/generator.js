/** Pure, deterministic composition logic. Units are 16th-note steps. */
export const PPQ = 480;
export const STEPS_PER_BAR = 16;
export const TRACKS = [
  { id: 'drums', name: 'Drum Machine', short: 'DRUMS', color: '#f2a66a', icon: '◉', program: 0, soundfont: null },
  { id: 'bass', name: 'Low End Theory', short: 'BASS', color: '#a6bbff', icon: '≋', program: 38, soundfont: 'synth_bass_1' },
  { id: 'chords', name: 'Chord Garden', short: 'CHORDS', color: '#b2a0ef', icon: '▤', program: 4, soundfont: 'electric_piano_1' },
  { id: 'melody', name: 'Main Character', short: 'MELODY', color: '#e8cd82', icon: '♫', program: 10, soundfont: 'music_box' },
  { id: 'arp', name: 'Arpeggio Lab', short: 'ARP', color: '#76c8c1', icon: '⟡', program: 81, soundfont: 'lead_2_sawtooth' },
  { id: 'lead', name: 'Hook Machine', short: 'LEAD', color: '#e899c0', icon: '⌁', program: 80, soundfont: 'lead_1_square' },
];
export const STYLES = [
  { id: 'boomBap', name: 'Boom Bap', tempo: 92, description: 'Dusty drums, head-nod bass' },
  { id: 'lofi', name: 'Lo-Fi', tempo: 78, description: 'Warm, hazy, reflective' },
  { id: 'house', name: 'House', tempo: 124, description: 'Four-on-the-floor motion' },
  { id: 'synthwave', name: 'Synthwave', tempo: 105, description: 'After-dark neon drive' },
  { id: 'trap', name: 'Trap', tempo: 142, description: 'Sub weight, syncopated hats' },
  { id: 'funk', name: 'Funk', tempo: 108, description: 'Syncopated pocket' },
  { id: 'ambient', name: 'Ambient', tempo: 72, description: 'Floating harmonic textures' },
  { id: 'cinematic', name: 'Cinematic', tempo: 88, description: 'Dramatic harmonic arcs' },
];
export const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentatonic: [0, 3, 5, 7, 10],
};
export const DEFAULT_SETTINGS = {
  title: 'The First Frequency', style: 'boomBap', root: 'C', scale: 'minor', bars: 32,
  bpm: 92, swing: 29, humanize: 15, complexity: 56, density: 58, seed: 369, a4Hz: 440,
};

/** Stable 32-bit hashing + PRNG for reproducible songs. */
export function randomFromSeed(seed) {
  let n = (Number(seed) >>> 0) || 1;
  return function rand() {
    n += 0x6D2B79F5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (items, rand) => items[Math.floor(rand() * items.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const note = (step, pitch, length, velocity) => ({ step, pitch, length, velocity });
const sectionNames = ['INTRO', 'VERSE', 'HOOK', 'BRIDGE', 'FINAL HOOK', 'OUTRO'];
export function makeSections(bars) {
  const units = [1, 2, 2, 1, 1, 1];
  const block = bars / 8;
  let at = 0;
  return units.map((u, i) => {
    const section = { name: sectionNames[i], start: at, bars: u * block, kind: i };
    at += section.bars;
    return section;
  });
}
const progressions = {
  minor: [[0,5,2,6],[0,3,6,4],[0,6,5,6],[0,4,5,3]],
  major: [[0,4,5,3],[0,3,4,0],[0,5,3,4],[0,4,1,5]],
  dorian: [[0,3,4,0],[0,6,3,4]],
  mixolydian: [[0,6,3,0],[0,3,6,3]],
  pentatonic: [[0,3,4,2],[0,4,2,3]],
};

export function createSong(input = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...input };
  const bars = [8, 16, 32, 64].includes(Number(settings.bars)) ? Number(settings.bars) : 32;
  const rand = randomFromSeed(settings.seed);
  const intervals = SCALES[settings.scale] || SCALES.minor;
  const root = ROOTS.indexOf(settings.root) >= 0 ? ROOTS.indexOf(settings.root) : 0;
  const sectionAt = makeSections(bars);
  // Allow a user-authored four-chord progression without changing the rest of
  // the seeded arrangement grammar. The original seed still drives groove/riffs.
  const progression = Array.isArray(input.progression) && input.progression.length === 4
    ? input.progression.map(n => clamp(Math.trunc(Number(n) || 0), 0, intervals.length - 1))
    : pick(progressions[settings.scale] || progressions.minor, rand);
  const tracks = Object.fromEntries(TRACKS.map(t => [t.id, []]));
  const v = (center, variance=14) => clamp(Math.round(center + (rand()-.5)*variance), 30, 124);
  const degree = (d, octave=4) => {
    const len = intervals.length;
    const q = Math.floor(d / len);
    return clamp(12 * (octave + 1 + q) + root + intervals[((d % len) + len) % len], 0, 127);
  };
  const density = clamp(Number(settings.density)/100, 0, 1);
  const complexity = clamp(Number(settings.complexity)/100, 0, 1);
  const beatChance = (base) => clamp(base * (.55 + density*.9), 0, 1);
  const riff = Array.from({ length: 16 }, (_, i) => ({ on: rand() < beatChance(i%4===0 ?.65:.28), d: Math.floor(rand()*8), length: pick([1,1,2,2,3,4],rand) }));

  for (let b=0; b<bars; b++) {
    const part = sectionAt.find(s => b >= s.start && b < s.start + s.bars) || sectionAt[0];
    const isIntro = part.kind === 0, isOutro = part.kind === 5;
    const isHook = part.kind === 2 || part.kind === 4;
    const isBridge = part.kind === 3;
    const energy = isIntro ? .56 : isOutro ? .48 : isBridge ? .66 : isHook ? 1 : .82;
    const chordIndex = progression[b%4];
    const base = b*STEPS_PER_BAR;
    const tonic = degree(chordIndex, 3);
    // Small voiced chord, repeated at harmonic changes, with occasional 7th.
    const tones = [degree(chordIndex, 4), degree(chordIndex+2, 4), degree(chordIndex+4, 4)];
    if (complexity > .60 || settings.style === 'lofi' || settings.style === 'cinematic') tones.push(degree(chordIndex+6,4));
    const chordSteps = settings.style === 'funk' ? [0, 6, 10] : settings.style === 'house' ? [0, 8] : [0];
    for (const s of chordSteps) {
      if (s > 0 && rand() > complexity) continue;
      tones.forEach(p => tracks.chords.push(note(base+s, p, Math.min(16-s, settings.style==='funk'?3:16), v(79))));
    }

    // Bass: emphasize roots, but interact with kicks and style.
    const bassSteps = settings.style==='house' ? [0,4,8,12] : settings.style==='trap' ? [0,7,10] : [0,6,8,11,14];
    bassSteps.forEach((s, j) => {
      if (j && rand() > beatChance(.54)*energy) return;
      const p = s>=12 && rand()<complexity*.5 ? degree(chordIndex+4,2):degree(chordIndex,2);
      tracks.bass.push(note(base+s,p, settings.style==='trap'?Math.min(6,16-s):Math.min(j===0?6:3,16-s),v(96)));
    });

    // Musical motifs repeat over 4-bar phrases; choruses gain octave lift.
    for (let s=0;s<16;s++) {
      const hit = riff[s];
      if (hit.on && rand() < energy * (isBridge?.65:1)) {
        const d = chordIndex + ((hit.d%4)*2);
        tracks.melody.push(note(base+s, degree(d, isHook?5:4), Math.min(hit.length,16-s), v(86)));
      }
    }
    if (!isIntro && !isOutro && rand()<complexity*.65) {
      const s = pick([0,3,6,8,11,14],rand);
      tracks.lead.push(note(base+s,degree(chordIndex+pick([2,4,6],rand),5),Math.min(pick([2,3,4,6],rand),16-s),v(80)));
    }

    const arpEvery = settings.style === 'ambient' ? 4 : settings.style==='trap'? 2 : 2;
    if (!isOutro) for (let s=0;s<16;s+=arpEvery) {
      if (rand() > beatChance(.55)*energy) continue;
      const tone = [chordIndex, chordIndex+2, chordIndex+4, chordIndex+2][Math.floor(s/arpEvery)%4];
      tracks.arp.push(note(base+s, degree(tone,5), Math.min(arpEvery,16-s),v(65,20)));
    }

    // Dedicated GM channel 10 drum voices, stylistic pocket.
    if (settings.style !== 'ambient' || b%2===0) {
      const kick = settings.style==='house'?[0,4,8,12] : settings.style==='trap'?[0,7,10] : [0,7,10];
      kick.forEach((s,i) => { if (i===0||rand()<beatChance(.8)*energy) tracks.drums.push(note(base+s,36,1,v(109))); });
      const snare = settings.style==='house'?[4,12] : [4,12];
      snare.forEach(s=>tracks.drums.push(note(base+s,38,1,v(95))));
      const hatEvery = settings.style==='trap'?1:settings.style==='lofi'?4:2;
      for (let s=0;s<16;s+=hatEvery) if(rand()<beatChance(.88)*energy) tracks.drums.push(note(base+s, rand()<.07?46:42,1,v(71,24)));
      if (isHook && b===part.start) tracks.drums.push(note(base,49,3,v(103)));
    }
  }
  return { settings: { ...settings, bars }, sections: sectionAt, progression, tracks };
}

/** Groove is deterministic, with note data unchanged until export/playback. */
export function grooveNote(n, settings, trackIndex=0) {
  const stepTicks = PPQ / 4;
  const swing = clamp(Number(settings.swing) || 0, 0, 100);
  const human = clamp(Number(settings.humanize) || 0, 0, 100);
  const hash = (((n.step+1)*2654435761) ^ ((n.pitch+1)*2246822519) ^ (Number(settings.seed)||0) ^ trackIndex) >>> 0;
  const jitter = (((hash%1001)/1000)-.5) * human*.4;
  const shift = (n.step%2===1 ? swing*.65 : 0) + jitter;
  return {
    ...n,
    tick: Math.max(0, Math.round(n.step * stepTicks + shift)),
    durationTicks: Math.max(30, Math.round(n.length*stepTicks - Math.max(0, shift*.3))),
    velocity: clamp(Math.round(n.velocity + jitter*.25), 1, 127),
  };
}
export const midiNoteName = (midi) => `${ROOTS[midi%12]}${Math.floor(midi/12)-1}`;
