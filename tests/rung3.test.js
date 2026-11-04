import test from 'node:test';
import assert from 'node:assert/strict';
import { createSong, TRACKS } from '../src/music/generator.js';
import { scheduleSong } from '../src/music/schedule.js';
import { encodeWavPCM16 } from '../src/music/wav.js';
import { buildMidi } from '../src/music/midi.js';

const codec = new TextDecoder('ascii');
const getString=(a,at,len)=>codec.decode(a.subarray(at,at+len));
const u16=(a,at)=>new DataView(a.buffer,a.byteOffset,a.byteLength).getUint16(at,true);
const u32=(a,at)=>new DataView(a.buffer,a.byteOffset,a.byteLength).getUint32(at,true);
const i16=(a,at)=>new DataView(a.buffer,a.byteOffset,a.byteLength).getInt16(at,true);

test('Rung 3 schedule uses identical deterministic groove data to MIDI export',()=>{
  const song=createSong({bars:16,seed:369,swing:45,humanize:15});
  const plan=scheduleSong(song);
  assert.equal(plan.bpm,92);
  assert.equal(plan.duration,16*4*60/92);
  assert.equal(plan.events.length,Object.values(song.tracks).flat().length);
  assert.ok(plan.events.every(e=>e.time>=0&&e.time<plan.duration&&e.duration>0));
  assert.ok(plan.events.every((e,i)=>i===0||e.time>=plan.events[i-1].time));
  assert.deepEqual(scheduleSong(song),plan);
  assert.equal(buildMidi(song)[9],1,'MIDI format 1 stays unchanged');
});

test('PCM WAV encodes a valid RIFF header, channels, frame length and audio samples',()=>{
  const left=Float32Array.from([0,1,-1,.5]);
  const right=Float32Array.from([.25,-.25,2,NaN]);
  const b={numberOfChannels:2,length:4,sampleRate:44100,getChannelData:i=>i?right:left};
  const wav=encodeWavPCM16(b);
  assert.equal(wav.length,44+4*2*2);
  assert.equal(getString(wav,0,4),'RIFF');
  assert.equal(u32(wav,4),wav.length-8);
  assert.equal(getString(wav,8,4),'WAVE');
  assert.equal(getString(wav,12,4),'fmt ');
  assert.equal(u32(wav,16),16);
  assert.equal(u16(wav,20),1); // PCM
  assert.equal(u16(wav,22),2);
  assert.equal(u32(wav,24),44100);
  assert.equal(u32(wav,28),176400);
  assert.equal(u16(wav,32),4);
  assert.equal(u16(wav,34),16);
  assert.equal(getString(wav,36,4),'data');
  assert.equal(u32(wav,40),16);
  assert.equal(i16(wav,44),0);
  assert.ok(Math.abs(i16(wav,46)-8192)<=1);
  assert.equal(i16(wav,48),32767);
  assert.ok(Math.abs(i16(wav,50)+8192)<=1);
  assert.equal(i16(wav,52),-32768);
  assert.equal(i16(wav,54),32767);
  assert.equal(i16(wav,58),0); // nonfinite input must be silent
});

test('PCM WAV handles mono buffers and rejects invalid samples/formats',()=>{
  const mono={numberOfChannels:1,length:3,sampleRate:22050,
    getChannelData:()=>Float32Array.from([-.5,0,.5])};
  const wav=encodeWavPCM16(mono);
  assert.equal(wav.length,50);
  assert.equal(u16(wav,22),1);
  assert.equal(i16(wav,44),-16384);
  assert.equal(i16(wav,46),0);
  assert.equal(i16(wav,48),16384);
  assert.throws(()=>encodeWavPCM16({...mono,numberOfChannels:3}),/Invalid audio buffer/);
  assert.throws(()=>encodeWavPCM16({...mono,length:-1}),/Invalid audio buffer/);
  assert.throws(()=>encodeWavPCM16({...mono,sampleRate:0}),/Invalid audio buffer/);
});

test('song remains six separate MIDI lanes, and WAV controls never alter notes',()=>{
  const song=createSong({bars:8,seed:369});
  const before=JSON.stringify(song);
  const plan=scheduleSong(song);
  assert.equal(Object.keys(song.tracks).length,TRACKS.length);
  assert.ok(plan.events.some(e=>e.track.id==='drums'));
  assert.ok(plan.events.some(e=>e.track.id==='melody'));
  assert.equal(JSON.stringify(song),before);
});
