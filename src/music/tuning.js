/** Pure, reproducible tuning calculations. No claims about physiological benefit. */
export const STANDARD_A4 = 440;
export const A4_MIN = 415;
export const A4_MAX = 466;
export const JUST_RATIOS = Object.freeze([
  1, 16/15, 9/8, 6/5, 5/4, 4/3, 45/32, 3/2, 8/5, 5/3, 9/5, 15/8
]);

export function normalizeA4(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= A4_MIN && n <= A4_MAX ? n : STANDARD_A4;
}
export function a4Cents(a4 = STANDARD_A4) {
  return 1200 * Math.log2(normalizeA4(a4) / STANDARD_A4);
}
export function midiFrequency(note, a4 = STANDARD_A4) {
  return normalizeA4(a4) * 2 ** ((Number(note) - 69) / 12);
}
/** In just intonation, the tonic is anchored to 12-TET at the chosen A4.
 * Interval ratios are pure relative to that tonic; not a key-independent 12-note grid. */
export function tunedFrequency(note, { a4Hz = STANDARD_A4, tonicMidi = 60, temperament = 'equal' } = {}) {
  if (temperament !== 'just') return midiFrequency(note, a4Hz);
  const distance = Math.round(note - tonicMidi);
  const octave = Math.floor(distance / 12);
  const degree = ((distance % 12) + 12) % 12;
  return midiFrequency(tonicMidi, a4Hz) * (2 ** octave) * JUST_RATIOS[degree];
}
export function intervalCentsDifference(semitones) {
  const degree = ((Math.round(semitones) % 12) + 12) % 12;
  return 1200 * Math.log2(JUST_RATIOS[degree]) - 100 * degree;
}
/** Standard MIDI pitch bend with RPN bend range of +/- 2 semitones. */
export function a4PitchBend(a4 = STANDARD_A4) {
  return Math.max(0, Math.min(16383, Math.round(8192 + a4Cents(a4) / 200 * 8192)));
}
export function createBlindTrial(random = Math.random) {
  return random() < .5 ? { a: 432, b: 440 } : { a: 440, b: 432 };
}
export function partialBeatRate(low, high, lowPartial, highPartial) {
  return Math.abs(low * lowPartial - high * highPartial);
}
