import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, createSong } from '../src/music/generator.js';
import { encodeWavPCM16 } from '../src/music/wav.js';
import { inspectStemWav, createPackManifest, buildProductionPackEntries } from '../src/music/production-pack.js';
import { zipStore } from '../src/music/zip.js';

const decode=bytes=>new TextDecoder().decode(bytes);
const bytesOf=(frames,sampleRate=44100,channels=2)=>{
  const data=Array.from({length:channels},(_,i)=>Float32Array.from({length:frames},(_,j)=>(i?-.3:.3)*Math.sin(j)));
  return encodeWavPCM16({
    length:frames,numberOfChannels:channels,sampleRate,
    getChannelData:index=>data[index],
  });
};
const song=createSong({bars:8,seed:369,title:'FL Production Pack',bpm:96,swing:0,humanize:0});
const stems=()=>TRACKS.map(t=>({id:t.id,name:t.id+'.wav',bytes:bytesOf(32)}));

test('pack contains the original MIDI, editable project, six WAV stems and a manifest',async()=>{
  const mixer={bass:{instrument:'local',volume:.65,filter:55,delay:12,pan:-.3}};
  const entries=buildProductionPackEntries({song,mixer,master:.7,stems:stems()});
  assert.equal(entries.length,10);
  assert.deepEqual(entries.map(e=>e.name),[
    'arrangement.mid','project.phiano.json','manifest.json','README.txt',
    'drums.wav','bass.wav','chords.wav','melody.wav','arp.wav','lead.wav'
  ]);
  const midi=entries.find(e=>e.name==='arrangement.mid').bytes;
  assert.equal(decode(midi.slice(0,4)),'MThd');
  assert.equal(midi[9],1); // format 1, the six-track export untouched
  const project=JSON.parse(decode(entries.find(e=>e.name==='project.phiano.json').bytes));
  assert.equal(project.version,4);
  assert.deepEqual(project.song,song);
  assert.equal(project.master,.7);
  assert.equal(project.mixer.bass.instrument,'local');
  const manifest=JSON.parse(decode(entries.find(e=>e.name==='manifest.json').bytes));
  assert.equal(manifest.schema,'phianosheets.production-pack.v1');
  assert.equal(manifest.tempoBpm,96);
  assert.equal(manifest.stemAudio.frames,32);
  assert.equal(manifest.stemAudio.sampleRate,44100);
  assert.equal(manifest.stemAudio.framesStartAt,0);
  assert.equal(manifest.tracks.length,6);
  assert.equal(manifest.tracks[0].midiChannel,10);
  assert.equal(manifest.tracks[1].midiChannel,1);
  assert.equal(manifest.tracks[5].midiChannel,5);
  assert.equal(manifest.tracks[1].voice,'local');
  assert.ok(manifest.sampleDisclaimer.includes('not embedded'));
  assert.match(decode(entries.find(e=>e.name==='README.txt').bytes),/bar 1 \/ time zero/);
  // ZIP is readable by standard archive tools: stores 10 local headers + central entries.
  const zip=new Uint8Array(await zipStore(entries).arrayBuffer());
  const view=new DataView(zip.buffer);
  assert.equal(view.getUint32(0,true),0x04034b50);
  assert.equal(view.getUint32(zip.length-22,true),0x06054b50);
  assert.equal(view.getUint16(zip.length-12,true),entries.length);
});

test('pack refuses a missing, duplicate, badly formatted or misaligned stem',()=>{
  const good=stems();
  assert.throws(()=>buildProductionPackEntries({song,stems:good.slice(1)}),/all six stems/);
  assert.throws(()=>buildProductionPackEntries({song,stems:[...good.slice(0,5),good[4]]}),/duplicate stem/);
  assert.throws(()=>buildProductionPackEntries({song,stems:good.map((s,i)=>i===0?{...s,bytes:bytesOf(31)}:s)}),/matching timeline lengths/);
  assert.throws(()=>buildProductionPackEntries({song,stems:good.map((s,i)=>i===0?{...s,bytes:bytesOf(32,22050)}:s)}),/44.1 kHz/);
  assert.throws(()=>buildProductionPackEntries({song,stems:good.map((s,i)=>i===1?{...s,bytes:bytesOf(32,44100,1)}:s)}),/44.1 kHz/);
  assert.throws(()=>buildProductionPackEntries({song,stems:good.map((s,i)=>i===3?{...s,bytes:Uint8Array.of(1,2,3)}:s)}),/PCM WAV/);
});

test('WAV metadata validation preserves frame length and rejects damaged headers',()=>{
  const wav=bytesOf(44);
  const meta=inspectStemWav(wav);
  assert.deepEqual(meta,{frames:44,sampleRate:44100,channels:2});
  const invalid=wav.slice();
  invalid[40]=0;
  assert.throws(()=>inspectStemWav(invalid),/Invalid WAV PCM size/);
});

test('manifest creation retains time signature, original note count and sample disclaimer',()=>{
  const manifest=createPackManifest(song,{},.72,44100*32);
  assert.deepEqual(manifest.timeSignature,[4,4]);
  assert.equal(manifest.seed,369);
  assert.equal(manifest.bars,8);
  assert.equal(manifest.notes,Object.values(song.tracks).reduce((a,l)=>a+l.length,0));
  assert.equal(manifest.masterLevel,.72);
  assert.equal(manifest.tracks.find(t=>t.id==='drums').midiProgram,null);
});
