/** Controlled reference-pitch comparison helpers.
 * The arrangement, groove, and mixer stay fixed between conditions.
 * No hidden calibration, listening-effect inference, or network collection. */
import { TRACKS, STEPS_PER_BAR } from './generator.js';
import { A4_MIN, A4_MAX, STANDARD_A4 } from './tuning.js';

export const MAX_FULL_COMPARE_SECONDS = 120;
export const EXCERPT_COMPARE_BARS = 8;

export function validateReferencePair(first, second) {
  for (const n of [first, second]) {
    if (!Number.isFinite(n) || n < A4_MIN || n > A4_MAX)
      throw new RangeError('A4 reference must be between 415 and 466 Hz.');
  }
  if (first === second) throw new RangeError('Choose two different tuning references.');
  return [first, second];
}
export function songSeconds(song) {
  const bars = Number(song?.settings?.bars);
  const bpm = Number(song?.settings?.bpm);
  if (!Number.isFinite(bars) || bars < 1 || !Number.isFinite(bpm) || bpm < 1)
    throw new Error('Invalid composition timing for comparison.');
  return bars * 240 / bpm;
}
export function withReference(song, a4Hz) {
  if (!Number.isFinite(a4Hz) || a4Hz < A4_MIN || a4Hz > A4_MAX)
    throw new RangeError('Invalid tuning reference.');
  return { ...song, settings: { ...song.settings, a4Hz } };
}
/** "auto" uses complete song <= 120s; >120s uses 8-bar excerpt.
 * "excerpt" explicitly requests 8 bars. Notes crossing boundaries are clipped.
 * Excerpt groove is rescheduled deterministically identically across both references. */
export function makeComparisonPlan(song, { mode = 'auto', startBar = 0 } = {}) {
  const seconds = songSeconds(song);
  const bars = Math.trunc(song.settings.bars);
  if (mode !== 'excerpt' && seconds <= MAX_FULL_COMPARE_SECONDS) {
    return { song, scope: 'full', startBar: 0, bars, seconds, totalBars: bars,
      noteCount: TRACKS.reduce((n,t) => n + (song.tracks[t.id] || []).length,0) };
  }
  const segmentBars = Math.min(bars, EXCERPT_COMPARE_BARS);
  const first = Math.max(0, Math.min(bars - segmentBars, Math.trunc(Number(startBar) || 0)));
  const from = first * STEPS_PER_BAR, to = from + segmentBars * STEPS_PER_BAR;
  const tracks = Object.fromEntries(TRACKS.map(t => [t.id,
    (song.tracks[t.id] || []).flatMap(n => {
      const begin = Math.max(from, n.step);
      const end = Math.min(to, n.step + n.length);
      return end > begin ? [{ ...n, step: begin - from, length: end - begin }] : [];
    })
  ]));
  const clip = { ...song,
    settings: { ...song.settings, bars: segmentBars },
    sections: [{ name: 'REFERENCE TEST', start: 0, bars: segmentBars, kind: 0 }],
    tracks };
  return { song: clip, scope: 'excerpt', startBar: first, bars: segmentBars,
    seconds: songSeconds(clip), totalBars: bars,
    noteCount: TRACKS.reduce((n,t)=>n+tracks[t.id].length,0) };
}
export function randomizePair(first, second, random = Math.random) {
  validateReferencePair(first, second);
  return random() < .5 ? { aHz: first, bHz: second } : { aHz: second, bHz: first };
}
export function preferredHz(trial, choice) {
  return choice === 'a' ? trial.aHz : choice === 'b' ? trial.bHz : null;
}
/** Use equal (unweighted) PCM RMS as an approximate level-match, reducing
 * the louder render to the quietest. Not a substitute for LUFS calibration. */
export function bufferRms(buffer, stride = 64) {
  if (!buffer || typeof buffer.getChannelData !== 'function') return 0;
  let total = 0, count = 0;
  const step = Math.max(1, Math.trunc(stride));
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i += step) {
      const v = Number.isFinite(data[i]) ? data[i] : 0;
      total += v * v;
      count++;
    }
  }
  return count ? Math.sqrt(total / count) : 0;
}
export function levelMatchGains(first, second) {
  const one = bufferRms(first), two = bufferRms(second);
  if (one <= 0 || two <= 0) return { first: 1, second: 1, rmsFirst: one, rmsSecond: two };
  const common = Math.min(one, two);
  return { first: common / one, second: common / two, rmsFirst: one, rmsSecond: two };
}
export function sourceFingerprint(song, mixer = {}, master = .72) {
  const settings = { ...song.settings, a4Hz: STANDARD_A4 };
  const value = JSON.stringify({ settings, tracks: song.tracks, mixer, master });
  let n = 2166136261;
  for (let i = 0; i < value.length; i++) {
    n ^= value.charCodeAt(i);
    n = Math.imul(n, 16777619);
  }
  return (n >>> 0).toString(16).padStart(8,'0');
}
export function tallyVotes(votes, first, second) {
  const result = { first: 0, second: 0, same: 0 };
  for (const vote of votes) {
    const preferred = preferredHz(vote, vote.choice);
    if (preferred === first) result.first++;
    else if (preferred === second) result.second++;
    else result.same++;
  }
  return result;
}
const csvCell = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
export function exportTrialsCsv(votes, context) {
  const headers = [
    'trial','source_fingerprint','song_title','tempo_bpm','groove_swing','groove_humanize',
    'scope','first_bar_1based','bar_count','notes_in_comparison','reference_1_hz',
    'reference_2_hz','stimulus_a_hz','stimulus_b_hz','choice','preferred_hz',
    'plays_a','plays_b','waveform_source','match_method','method_notes'
  ];
  const rows = votes.map((vote, i) => [
    i + 1, context.fingerprint, context.title, context.bpm, context.swing,
    context.humanize, context.scope, context.startBar + 1, context.bars,
    context.noteCount, context.first, context.second, vote.aHz, vote.bHz,
    vote.choice === 'same' ? 'no_preference' : vote.choice,
    preferredHz(vote, vote.choice) ?? '', vote.playsA, vote.playsB,
    'offline Web Audio built-in synth or loaded local bank',
    'common PCM RMS attenuation',
    'Uncalibrated listening preference only; no clinical inference'
  ]);
  return [headers, ...rows].map(row=>row.map(csvCell).join(',')).join('\n')+'\n';
}
