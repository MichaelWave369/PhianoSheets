import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSFZ, chooseRegion, inspectSF2, loadLocalBank } from '../src/music/sample-bank.js';
import { crc32, zipStore } from '../src/music/zip.js';
import { createSong, TRACKS } from '../src/music/generator.js';
import { buildMidi } from '../src/music/midi.js';

test('SFZ groups, notes, velocities and local file safety',()=>{
  const regions=parseSFZ(`<control> default_path=samples/
<global> ampeg_release=.25
<group> lokey=c3 hikey=b3
<region> sample="soft piano.wav" hivel=70 pitch_keycenter=c4
<region> sample="hard piano.wav" lovel=71 tune=-12 loop_mode=loop_continuous loop_start=40 loop_end=300`);
  assert.equal(regions.length,2);
  assert.equal(regions[0].path,'samples/soft piano.wav');
  assert.deepEqual([regions[0].keyLo,regions[0].keyHi,regions[0].root],[48,59,60]);
  assert.equal(regions[1].loop,true);
  assert.equal(regions[0].release,.25);
  assert.equal(chooseRegion({regions},50,60),regions[0]);
  assert.equal(chooseRegion({regions},50,90),regions[1]);
  assert.equal(chooseRegion({regions},65,90),null);
  assert.throws(()=>parseSFZ('<region> sample=../bad.wav'),/Unsafe/);
});

test('local WAV loader and SFZ companion files decode without network',async()=>{
  const wav={name:'hat.wav',size:16,webkitRelativePath:'kit/samples/hat.wav',arrayBuffer:async()=>new ArrayBuffer(16)};
  const sfz={name:'kit.sfz',size:120,text:async()=>`<region> sample=hat.wav key=42
<region> sample=hat.wav key=46`};
  let count=0;
  const mock={decodeAudioData:async()=>{count++;return {duration:.2,sampleRate:44100};}};
  const bank=await loadLocalBank([sfz,wav],mock);
  assert.equal(bank.source,'sfz');
  assert.equal(bank.regions.length,2);
  assert.equal(count,1);
  assert.equal(bank.regions[0].buffer,bank.regions[1].buffer);
  assert.equal(chooseRegion(bank,42,100).root,42);
  await assert.rejects(loadLocalBank([sfz],mock),/Missing or ambiguous/);
  assert.equal((await loadLocalBank([wav],mock)).source,'wav');
});

const text=s=>Array.from(new TextEncoder().encode(s));
const u16=n=>[n&255,(n>>>8)&255];
const u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
const name=(s,len)=>[...text(s),...Array(Math.max(0,len-text(s).length)).fill(0)].slice(0,len);
const chunk=(id,data)=>[...text(id),...u32(data.length),...data,...(data.length&1?[0]:[])];
const list=(id,parts)=>chunk('LIST',[...text(id),...parts.flat()]);
function sf2Fixture(){
  const phdr=chunk('phdr',[
    ...name('Tiny Piano',20),...u16(0),...u16(0),...u16(0),...u32(0),...u32(0),...u32(0),
    ...name('EOP',20),...u16(0),...u16(0),...u16(1),...u32(0),...u32(0),...u32(0)]);
  const pbag=chunk('pbag',[...u16(0),...u16(0),...u16(1),...u16(0)]);
  const pgen=chunk('pgen',[...u16(41),...u16(0),...u16(0),...u16(0)]);
  const inst=chunk('inst',[...name('Instrument',20),...u16(0),...name('EOI',20),...u16(1)]);
  const ibag=chunk('ibag',[...u16(0),...u16(0),...u16(1),...u16(0)]);
  const igen=chunk('igen',[...u16(53),...u16(0),...u16(0),...u16(0)]);
  const sampleHeader=n=>[...name(n,20),...u32(0),...u32(64),...u32(8),...u32(52),...u32(44100),60,0,...u16(0),...u16(1)];
  const shdr=chunk('shdr',[...sampleHeader('PCM'),...sampleHeader('EOS')]);
  const pcm=chunk('smpl',Array.from({length:64},(_,i)=>u16(Math.round(Math.sin(i/8)*16000)&65535)).flat());
  const body=[...list('sdta',[pcm]),...list('pdta',[phdr,pbag,pgen,inst,ibag,igen,shdr])];
  return Uint8Array.from([...text('RIFF'),...u32(body.length+4),...text('sfbk'),...body]);
}
test('SF2 RIFF hydra reader resolves a preset to correct PCM16 sample zone',async()=>{
  const data=sf2Fixture(),parsed=inspectSF2(data);
  assert.equal(parsed.name,'Tiny Piano');
  assert.equal(parsed.zones.length,1);
  assert.equal(parsed.zones[0].root,60);
  assert.equal(parsed.samples.get(0).sampleRate,44100);
  const mock={createBuffer:(channels,frames,rate)=>{
    const samples=new Float32Array(frames);
    return {length:frames,sampleRate:rate,getChannelData:()=>samples};
  }};
  const bank=await loadLocalBank([{name:'tiny.sf2',size:data.length,arrayBuffer:async()=>data.buffer}],mock);
  assert.equal(bank.source,'sf2');
  assert.equal(bank.regions[0].buffer.length,64);
  assert.ok(bank.regions[0].buffer.getChannelData(0)[4]>0);
  assert.throws(()=>inspectSF2(data,99),/Invalid SoundFont preset/);
  assert.throws(()=>inspectSF2(new Uint8Array(120)),/valid SoundFont/);
});

test('ZIP store archive has CRC32, two WAV entries and valid central directory',async()=>{
  assert.equal(crc32(Uint8Array.from(text('123456789'))),0xcbf43926);
  const blob=zipStore([{name:'drums.wav',bytes:Uint8Array.from(text('123456789'))},
    {name:'melody.wav',bytes:Uint8Array.of(1,2,3)}]);
  const a=new DataView(await blob.arrayBuffer());
  assert.equal(a.getUint32(0,true),0x04034b50);
  assert.equal(a.getUint32(14,true),0xcbf43926);
  assert.equal(a.getUint32(a.byteLength-22,true),0x06054b50);
  assert.equal(a.getUint16(a.byteLength-12,true),2);
  assert.throws(()=>zipStore([]),/1–20/);
});

test('the existing MIDI export remains deterministic with six tracks',()=>{
  const song=createSong({seed:369,bars:8});
  const before=buildMidi(song);
  assert.equal(TRACKS.length,6);
  assert.deepEqual(buildMidi(song),before);
});
