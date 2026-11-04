import test from 'node:test';
import assert from 'node:assert/strict';
import { createSong, DEFAULT_SETTINGS, grooveNote, TRACKS } from '../src/music/generator.js';
import { buildMidi, variableLength } from '../src/music/midi.js';
const parseU32=(a,o)=> (a[o]*2**24 + a[o+1]*2**16+a[o+2]*2**8+a[o+3]);

test('one-click generation creates an arranged six-track song',()=>{
  const song=createSong();
  assert.equal(song.sections.reduce((sum,s)=>sum+s.bars,0),32);
  assert.equal(Object.keys(song.tracks).length,6);
  assert.ok(TRACKS.every(t=>song.tracks[t.id].length>0));
  assert.ok(song.sections.some(s=>s.name==='HOOK'));
  assert.ok(Object.values(song.tracks).flat().every(n=>n.step>=0 && n.step<32*16 && n.length>0 && n.pitch<=127));
});
test('same seed is reproducible while another seed changes musical output',()=>{
  assert.deepEqual(createSong({seed:369}),createSong({seed:369}));
  assert.notDeepEqual(createSong({seed:369}).tracks.melody,createSong({seed:370}).tracks.melody);
});
test('supported arrangement lengths get exact section boundaries',()=>{
  for(const bars of [8,16,32,64]){
    const song=createSong({bars});
    assert.equal(song.sections.at(-1).start+song.sections.at(-1).bars,bars);
  }
});
test('groove modifies timing deterministically without mutating notes',()=>{
  const n={step:3,pitch:60,length:2,velocity:100};
  const shifted=grooveNote(n,{...DEFAULT_SETTINGS,swing:70,humanize:20});
  assert.ok(shifted.tick>360);
  assert.equal(n.tick,undefined);
  assert.deepEqual(shifted,grooveNote(n,{...DEFAULT_SETTINGS,swing:70,humanize:20}));
});
test('MIDI export produces MIDI format 1 with conductor and six tracks',()=>{
  const song=createSong({seed:123,bars:8});
  const out=buildMidi(song);
  assert.equal(new TextDecoder().decode(out.slice(0,4)),'MThd');
  assert.equal(parseU32(out,4),6);
  assert.equal(out[9],1);
  assert.equal(out[11],7);
  assert.equal(out[13],480 & 255);
  assert.equal((new TextDecoder().decode(out).match(/MTrk/g)||[]).length,7);
});
test('variable-length MIDI delta encoder spans boundaries',()=>{
  assert.deepEqual(variableLength(0),[0]);
  assert.deepEqual(variableLength(127),[127]);
  assert.deepEqual(variableLength(128),[0x81,0]);
  assert.deepEqual(variableLength(16384),[0x81,0x80,0]);
});
