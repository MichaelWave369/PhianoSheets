import test from 'node:test';
import assert from 'node:assert/strict';
import { createSong } from '../src/music/generator.js';
import { buildMidi } from '../src/music/midi.js';
import { midiFrequency, tunedFrequency, a4Cents, a4PitchBend, normalizeA4,
  createBlindTrial, intervalCentsDifference, partialBeatRate } from '../src/music/tuning.js';

const near = (a, b, epsilon = .001) => assert.ok(Math.abs(a - b) < epsilon, String(a) + ' != ' + String(b));
test('A4 reference and octave relation are exact', () => {
  near(midiFrequency(69, 440), 440);
  near(midiFrequency(69, 432), 432);
  near(midiFrequency(81, 432), 864);
  near(a4Cents(432), -31.76665363, .00001);
  assert.equal(normalizeA4(700), 440);
  assert.equal(normalizeA4('not a frequency'), 440);
});
test('just intervals are tonic-anchored, separate from global pitch reference', () => {
  near(tunedFrequency(64, { a4Hz: 432, temperament: 'just' }) /
    tunedFrequency(60, { a4Hz: 432, temperament: 'just' }), 5/4);
  near(tunedFrequency(67, { a4Hz: 440, temperament: 'just' }) /
    tunedFrequency(60, { a4Hz: 440, temperament: 'just' }), 3/2);
  near(tunedFrequency(64, { a4Hz: 440, temperament: 'equal' }) /
    tunedFrequency(60, { a4Hz: 440, temperament: 'equal' }), 2 ** (4/12));
  assert.ok(intervalCentsDifference(4) < 0);
  near(partialBeatRate(100, 125, 5, 4), 0);
});
test('blinded stimulus assignments are reproducible for an injected random source', () => {
  assert.deepEqual(createBlindTrial(() => 0), { a: 432, b: 440 });
  assert.deepEqual(createBlindTrial(() => .8), { a: 440, b: 432 });
});
test('MIDI tuning is centered at A440 and includes pitched-channel RPN/bend for A432', () => {
  assert.equal(a4PitchBend(440), 8192);
  assert.ok(a4PitchBend(432) < 8192);
  const standard = buildMidi(createSong({ bars: 8, a4Hz: 440 }));
  const altered = buildMidi(createSong({ bars: 8, a4Hz: 432 }));
  const contains = (bytes, sequence) => Array.from(bytes).some((_, i) =>
    sequence.every((b, j) => bytes[i + j] === b));
  const bend = a4PitchBend(432);
  assert.ok(contains(altered, [0xe0, bend & 127, (bend >> 7) & 127]));
  assert.ok(contains(altered, [0xb0, 101, 0]));
  assert.ok(contains(altered, [0xb0, 6, 2]));
  assert.equal(standard.length < altered.length, true);
});
