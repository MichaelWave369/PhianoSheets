import test from 'node:test';
import assert from 'node:assert/strict';
import { createSong, TRACKS } from '../src/music/generator.js';
import { regenerateTrack, setChordDegree, moveSection, toggleDrumStep, setEuclideanDrums,
  addDrumFill, copyClip, pasteClip, normalizeSong } from '../src/music/editor.js';
import { parseMidi } from '../src/music/import.js';
import { buildMidi } from '../src/music/midi.js';

test('track regeneration preserves the other five lanes, harmonic context and source seed',()=>{
  const original=normalizeSong(createSong({bars:16,seed:369}));
  const first=regenerateTrack(original,'melody');
  const second=regenerateTrack(first,'melody');
  assert.equal(first.settings.seed,369);
  assert.deepEqual(first.progression,original.progression);
  for(const t of TRACKS.filter(t=>t.id!=='melody'))assert.deepEqual(first.tracks[t.id],original.tracks[t.id]);
  assert.notDeepEqual(first.tracks.melody,original.tracks.melody);
  assert.notDeepEqual(second.tracks.melody,first.tracks.melody);
  assert.equal(second.variations.melody,2);
});

test('changing a chord slot reharmonizes accompaniment, not the drums or lead ideas',()=>{
  const original=normalizeSong(createSong({bars:8,seed:420}));
  const degree=(original.progression[1]+1)%7;
  const updated=setChordDegree(original,1,degree);
  assert.equal(updated.progression[1],degree);
  for(const id of ['drums','melody','lead'])assert.deepEqual(updated.tracks[id],original.tracks[id]);
  assert.notDeepEqual(updated.tracks.chords,original.tracks.chords);
  assert.equal(original.progression[1]!==updated.progression[1],true);
});

test('moving arrangement sections preserves total bars and note bounds',()=>{
  const original=normalizeSong(createSong({bars:32,seed:1}));
  const moved=moveSection(original,0,1);
  assert.equal(moved.sections[1].name,original.sections[0].name);
  assert.equal(moved.sections.reduce((s,p)=>s+p.bars,0),32);
  assert.equal(moved.sections[0].start,0);
  assert.equal(moved.sections[1].start,moved.sections[0].bars);
  assert.ok(Object.values(moved.tracks).flat().every(n=>n.step>=0&&n.step+n.length<=512));
  assert.deepEqual(original,normalizeSong(original)); // no hidden mutations
  assert.strictEqual(moveSection(original,0,-1),original);
});

test('step toggling changes only the requested drum voice, and is reversible',()=>{
  const s=normalizeSong(createSong({seed:234,bars:8}));
  const at=0,pitch=36;
  const exists=s.tracks.drums.some(n=>n.step===at&&n.pitch===pitch);
  const toggled=toggleDrumStep(s,0,0,pitch,96);
  assert.equal(toggled.tracks.drums.some(n=>n.step===at&&n.pitch===pitch),!exists);
  const restored=toggleDrumStep(toggled,0,0,pitch,96);
  assert.equal(restored.tracks.drums.some(n=>n.step===at&&n.pitch===pitch),exists);
  assert.deepEqual(toggled.tracks.chords,s.tracks.chords);
});

test('Euclidean drum patterns use exact pulse count and preserve other voices',()=>{
  const s=normalizeSong(createSong({bars:8}));
  const before=s.tracks.drums.filter(n=>n.pitch!==42);
  const updated=setEuclideanDrums(s,2,42,5,3,77);
  assert.equal(updated.tracks.drums.filter(n=>n.pitch===42&&n.step>=32&&n.step<48).length,5);
  assert.deepEqual(updated.tracks.drums.filter(n=>n.pitch!==42),before);
  assert.ok(updated.tracks.drums.filter(n=>n.pitch===42&&n.step>=32&&n.step<48).every(n=>n.velocity===77));
  assert.equal(setEuclideanDrums(updated,2,42,0).tracks.drums.filter(n=>n.pitch===42&&n.step>=32&&n.step<48).length,0);
});

test('drum fills are deterministic and stay inside the chosen bar',()=>{
  const s=normalizeSong(createSong({bars:8,seed:87}));
  const a=addDrumFill(s,4),b=addDrumFill(s,4);
  assert.deepEqual(a,b);
  assert.deepEqual(a.tracks.bass,s.tracks.bass);
  assert.ok(a.tracks.drums.filter(n=>n.step>=64&&n.step<80).length>=s.tracks.drums.filter(n=>n.step>=64&&n.step<80).length);
});

test('copy/paste replaces only destination clip and never mutates source',()=>{
  const s=normalizeSong(createSong({bars:8,seed:9}));
  const clip=copyClip(s,'melody',0,2);
  const pasted=pasteClip(s,'melody',4,clip);
  assert.ok(clip.notes.length>0);
  const replaced=pasted.tracks.melody.filter(n=>n.step>=64&&n.step<96);
  assert.deepEqual(replaced.map(n=>({...n,step:n.step-64})),clip.notes);
  assert.deepEqual(pasted.tracks.drums,s.tracks.drums);
  assert.deepEqual(s,normalizeSong(s));
});

test('standard multitrack MIDI export can be imported with pitch and channels intact',()=>{
  const s=createSong({bars:16,seed:369,swing:0,humanize:0});
  const midi=buildMidi(s);
  const {song,warnings}=parseMidi(midi);
  assert.deepEqual(warnings,[]);
  assert.equal(song.settings.bpm,92);
  assert.equal(song.settings.bars,16);
  assert.equal(song.settings.swing,0);
  for(const t of TRACKS){
    assert.equal(song.tracks[t.id].length,s.tracks[t.id].length,'unexpected note count for '+t.id);
    assert.deepEqual(song.tracks[t.id].map(n=>n.pitch),s.tracks[t.id].map(n=>n.pitch));
  }
});

test('MIDI importer rejects unsupported formats and corrupt files',()=>{
  assert.throws(()=>parseMidi(new Uint8Array(30)),/Standard MIDI File/);
  const invalid=buildMidi(createSong({bars:8}));
  invalid[8]=0;invalid[9]=2;
  assert.throws(()=>parseMidi(invalid),/type 0\/1/);
});
