import { PPQ, TRACKS, grooveNote } from './generator.js';
import { a4PitchBend, normalizeA4 } from './tuning.js';
const bytes = (...vals) => vals.map(v=>v & 255);
const u16 = v => bytes(v>>8,v);
const u32 = v => bytes(v>>>24,v>>>16,v>>>8,v);
const ascii = value => Array.from(new TextEncoder().encode(value));
const chunk = (type, data) => [...ascii(type), ...u32(data.length), ...data];
export function variableLength(value) {
  let v = Math.max(0, Math.floor(value));
  const out = [v&127];
  while ((v >>= 7)>0) out.unshift((v&127)|128);
  return out;
}
function metaEvent(type,payload) {return [0xff,type,...variableLength(payload.length),...payload];}
function encodeTrack(events) {
  events.sort((a,b)=>a.tick-b.tick || a.order-b.order);
  let prev = 0;
  const data = [];
  for (const event of events) {
    data.push(...variableLength(event.tick-prev),...event.data);
    prev=event.tick;
  }
  data.push(0,...metaEvent(0x2f,[]));
  return chunk('MTrk',data);
}
/** Standard MIDI File format 1, one playable track per arrangement lane. */
export function buildMidi(song, mixer={}) {
  const bpm = Math.max(30,Math.min(300,Number(song.settings.bpm)||92));
  const a4Hz = normalizeA4(song.settings?.a4Hz);
  const bend = a4PitchBend(a4Hz);
  const tempo = Math.round(60000000/bpm);
  const conductor = encodeTrack([
    {tick:0,order:0,data:metaEvent(0x03,ascii(song.settings.title || 'PhianoSheets'))},
    {tick:0,order:1,data:metaEvent(0x51,bytes(tempo>>16,tempo>>8,tempo))},
    {tick:0,order:2,data:metaEvent(0x58,[4,2,24,8])},
    ...song.sections.map((s,i)=>({tick:s.start*4*PPQ,order:3+i,data:metaEvent(0x06,ascii(s.name))})),
  ]);
  const trackChunks = TRACKS.map((track,i)=>{
    const channel = i===0 ? 9 : i-1;
    const slot = mixer[track.id] || {};
    const volume = Math.max(0,Math.min(127,Math.round((slot.volume ?? .8)*100)));
    const pan = Math.max(0,Math.min(127,Math.round(((slot.pan ?? 0)+1)*63.5)));
    const events = [
      {tick:0,order:0,data:metaEvent(0x03,ascii(track.name))},
      {tick:0,order:1,data:[0xb0|channel,7,volume]},
      {tick:0,order:2,data:[0xb0|channel,10,pan]},
      ...(i===0?[]:[{tick:0,order:3,data:[0xc0|channel,track.program]}]),
      ...(i===0 || a4Hz===440 ? [] : [
        {tick:0,order:4,data:[0xb0|channel,101,0]},
        {tick:0,order:5,data:[0xb0|channel,100,0]},
        {tick:0,order:6,data:[0xb0|channel,6,2]},
        {tick:0,order:7,data:[0xb0|channel,38,0]},
        {tick:0,order:8,data:[0xb0|channel,101,127]},
        {tick:0,order:9,data:[0xb0|channel,100,127]},
        {tick:0,order:10,data:[0xe0|channel,bend&127,(bend>>7)&127]},
      ]),
    ];
    for (const n of song.tracks[track.id] || []) {
      const g = grooveNote(n,song.settings,i);
      events.push({tick:g.tick,order:20,data:[0x90|channel,g.pitch,g.velocity]});
      events.push({tick:g.tick+g.durationTicks,order:15,data:[0x80|channel,g.pitch,0]});
    }
    return encodeTrack(events);
  });
  const header = chunk('MThd',[...u16(1),...u16(1+trackChunks.length),...u16(PPQ)]);
  return new Uint8Array([...header,...conductor,...trackChunks.flat()]);
}
export function downloadMidi(song,mixer) {
  const bytes=buildMidi(song,mixer);
  const blob = new Blob([bytes],{type:'audio/midi'});
  const a = document.createElement('a');
  const url=URL.createObjectURL(blob);
  a.href=url;
  a.download = `${(song.settings.title||'phianosheets').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}.mid`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
