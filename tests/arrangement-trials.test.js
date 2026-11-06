import test from 'node:test';
import assert from 'node:assert/strict';
import { createSong, TRACKS } from '../src/music/generator.js';
import { makeComparisonPlan, songSeconds, withReference, randomizePair, preferredHz,
  validateReferencePair, sourceFingerprint, tallyVotes, levelMatchGains,
  exportTrialsCsv } from '../src/music/experiment.js';

test('reference conditions do not change arrangement notes or tempo',()=>{
  const original=createSong({seed:369,bars:32,bpm:100});
  const first=withReference(original,432), second=withReference(original,440);
  assert.deepEqual(first.tracks,second.tracks);
  assert.deepEqual(first.sections,second.sections);
  assert.equal(first.settings.bpm,second.settings.bpm);
  assert.equal(first.settings.a4Hz,432);
  assert.equal(second.settings.a4Hz,440);
  assert.deepEqual(original.tracks,first.tracks);
  assert.equal(sourceFingerprint(first),sourceFingerprint(second));
});
test('whole song is preserved when duration fits two minutes',()=>{
  const original=createSong({seed:1,bars:32,bpm:92});
  const plan=makeComparisonPlan(original);
  assert.equal(plan.scope,'full');
  assert.equal(plan.song,original);
  assert.equal(plan.bars,32);
  assert.ok(songSeconds(original)<120);
});
test('long songs use an equal eight-bar passage with clipping',()=>{
  const song=createSong({seed:2,bars:64,bpm:80});
  const plan=makeComparisonPlan(song,{startBar:29});
  assert.equal(plan.scope,'excerpt');
  assert.equal(plan.startBar,29);
  assert.equal(plan.bars,8);
  assert.equal(plan.song.settings.bars,8);
  assert.equal(plan.song.sections.length,1);
  assert.ok(TRACKS.every(t=>plan.song.tracks[t.id].every(n=>n.step>=0 && n.step<128 && n.length>0 && n.step+n.length<=128)));
  assert.ok(plan.noteCount>0);
  const last=makeComparisonPlan(song,{startBar:1000});
  assert.equal(last.startBar,56);
});
test('short songs can still request an excerpt; alternate A/B is randomized',()=>{
  const song=createSong({bars:16});
  assert.equal(makeComparisonPlan(song,{mode:'excerpt',startBar:3}).bars,8);
  assert.deepEqual(randomizePair(432,440,()=>0),{aHz:432,bHz:440});
  assert.deepEqual(randomizePair(432,440,()=>.9),{aHz:440,bHz:432});
  assert.equal(preferredHz({aHz:440,bHz:432},'b'),432);
  assert.equal(preferredHz({aHz:440,bHz:432},'same'),null);
  assert.throws(()=>validateReferencePair(440,440));
  assert.throws(()=>validateReferencePair(200,440));
});
test('PCM RMS attenuation reduces the louder render only',()=>{
  const buffer=amplitude=>({numberOfChannels:2,getChannelData:()=>new Float32Array(128).fill(amplitude)});
  const matched=levelMatchGains(buffer(.5),buffer(.25));
  assert.ok(Math.abs(matched.first-.5)<1e-6);
  assert.ok(Math.abs(matched.second-1)<1e-6);
});
test('votes tally by actual reference, not shuffled A/B label',()=>{
  const votes=[
    {aHz:440,bHz:432,choice:'b',playsA:1,playsB:2},
    {aHz:432,bHz:440,choice:'b',playsA:2,playsB:1},
    {aHz:440,bHz:432,choice:'same',playsA:1,playsB:1}
  ];
  assert.deepEqual(tallyVotes(votes,432,440),{first:1,second:1,same:1});
  const csv=exportTrialsCsv(votes,{fingerprint:'abcdef00',title:'Song, "one"',
    bpm:92,swing:20,humanize:5,scope:'full',startBar:0,bars:32,noteCount:300,
    first:432,second:440});
  assert.equal(csv.trim().split('\n').length,4);
  assert.ok(csv.includes('"Song, ""one"""'));
  assert.ok(csv.includes('"no_preference"'));
});
