/** Defensive standard MIDI file (type 0/1) importer, quantized to 16th notes. */
import { DEFAULT_SETTINGS, TRACKS, makeSections, STEPS_PER_BAR } from './generator.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const read32=(a,i)=>((a[i]*0x1000000)+(a[i+1]<<16)+(a[i+2]<<8)+a[i+3])>>>0;
const read16=(a,i)=>(a[i]<<8)|a[i+1];
const decoder=new TextDecoder();
const NAME_LOOKUP=new Map(TRACKS.map(t=>[t.name.toLowerCase(),t.id]));

export function parseMidi(input) {
  const a=input instanceof Uint8Array?input:new Uint8Array(input);
  if(a.length<22||a.length>8*1024*1024)throw Error('MIDI file must be between 22 bytes and 8 MB');
  const text=(i,n)=>decoder.decode(a.subarray(i,i+n));
  if(text(0,4)!=='MThd')throw Error('Not a Standard MIDI File');
  const hLen=read32(a,4);
  if(hLen<6||8+hLen>a.length)throw Error('Invalid MIDI header length');
  const format=read16(a,8),trackCount=read16(a,10),division=read16(a,12);
  if(format>1||trackCount<1||trackCount>128||division===0||(division&0x8000))
    throw Error('Only standard type 0/1 MIDI with PPQ ticks is supported');
  let pos=8+hLen, tempo=500000, title='Imported MIDI',tempoFound=false;
  const midiTracks=[],markers=[];
  const readVlq=(end)=>{
    let n=0;
    for(let k=0;k<4;k++){
      if(pos>=end)throw Error('Unexpected end of MIDI event');
      const byte=a[pos++];
      n=(n<<7)|(byte&127);
      if(!(byte&128))return n;
    }
    throw Error('MIDI variable-length quantity is too large');
  };
  for(let t=0;t<trackCount;t++){
    if(pos+8>a.length||text(pos,4)!=='MTrk')throw Error('Missing MIDI track header');
    const size=read32(a,pos+4);
    pos+=8;
    const end=pos+size;
    if(end>a.length)throw Error('Truncated MIDI track');
    let tick=0,status=0,trackName='',eventCounter=0;
    const pending=new Map(),notes=[];
    while(pos<end){
      if(++eventCounter>300000)throw Error('Too many MIDI events');
      tick+=readVlq(end);
      let b=a[pos];
      if(b>=0x80){status=b;pos++;}
      else if(status<0x80||status>=0xf0)throw Error('Invalid MIDI running status');
      if(status===0xff){
        if(pos>=end)throw Error('Truncated MIDI meta event');
        const type=a[pos++],length=readVlq(end);
        if(pos+length>end)throw Error('Truncated MIDI meta data');
        if(type===0x03){trackName=text(pos,length);if(t===0&&trackName)title=trackName;}
        if(type===0x06)markers.push({tick,name:text(pos,length)});
        if(type===0x51&&length===3&&!tempoFound){tempo=(a[pos]<<16)|(a[pos+1]<<8)|a[pos+2];tempoFound=true;}
        pos+=length;status=0;
        if(type===0x2f)break;
        continue;
      }
      if(status===0xf0||status===0xf7){
        const length=readVlq(end);
        if(pos+length>end)throw Error('Truncated MIDI system data');
        pos+=length;status=0;continue;
      }
      const kind=status&0xf0,channel=status&15;
      const dataLength=(kind===0xc0||kind===0xd0)?1:2;
      if(pos+dataLength>end)throw Error('Truncated MIDI channel event');
      const pitch=a[pos++],velocity=dataLength===2?a[pos++]:0;
      if(pitch>127||velocity>127)throw Error('Invalid MIDI data byte');
      const key=channel+':'+pitch;
      if(kind===0x90&&velocity>0){
        const queue=pending.get(key)||[];
        queue.push({tick,pitch,velocity,channel});
        pending.set(key,queue);
      }else if(kind===0x80||(kind===0x90&&velocity===0)){
        const queue=pending.get(key);
        if(queue?.length){
          const note=queue.shift();
          notes.push({...note,endTick:Math.max(tick,note.tick+1)});
        }
      }
    }
    // Unreleased notes get a conservative one-beat tail.
    for(const queue of pending.values())for(const n of queue)notes.push({...n,endTick:n.tick+division});
    pos=end;
    midiTracks.push({name:trackName,notes});
  }
  const quantize=tick=>Math.max(0,Math.round(tick*4/division));
  let maxStep=0;
  const lanes=Object.fromEntries(TRACKS.map(t=>[t.id,[]]));
  let unassigned=0;
  for(const source of midiTracks){
    if(!source.notes.length)continue;
    const normalized=source.name.toLowerCase().trim();
    const nameId=NAME_LOOKUP.get(normalized)||TRACKS.find(t=>t.id===normalized)?.id;
    const groups=new Map();
    for(const n of source.notes){
      if(!groups.has(n.channel))groups.set(n.channel,[]);
      groups.get(n.channel).push(n);
    }
    for(const [channel,items] of groups){
      let dest=channel===9?'drums':nameId;
      if(!dest){
        // GM channel mapping for PhianoSheets exports; arbitrary channels use lane order.
        const ids=['bass','chords','melody','arp','lead'];
        dest=ids[unassigned++%ids.length];
      }
      for(const n of items){
        const step=quantize(n.tick),duration=Math.max(1,quantize(n.endTick)-step);
        maxStep=Math.max(maxStep,step+duration);
        lanes[dest].push({step,pitch:n.pitch,length:duration,velocity:n.velocity});
      }
    }
  }
  if(!Object.values(lanes).some(notes=>notes.length))throw Error('No playable MIDI notes found');
  const bars=[8,16,32,64].find(n=>n*STEPS_PER_BAR>=maxStep)||64;
  for(const t of TRACKS){
    lanes[t.id]=lanes[t.id].filter(n=>n.step<bars*STEPS_PER_BAR)
      .map(n=>({...n,length:Math.min(n.length,bars*STEPS_PER_BAR-n.step)}))
      .sort((a,b)=>a.step-b.step||a.pitch-b.pitch);
  }
  const safeTempo=tempo>0?clamp(Math.round(60000000/tempo),40,240):120;
  const settings={...DEFAULT_SETTINGS,title:title.slice(0,65),bars,bpm:safeTempo,swing:0,humanize:0};
  // Keep matching section markers when they form a valid arrangement.
  let sections=makeSections(bars);
  const unique=markers.filter((m,i)=>markers.findIndex(x=>x.tick===m.tick)===i)
    .map(m=>({start:Math.round(m.tick/(division*4)),name:m.name}));
  if(unique.length>=2&&unique[0].start===0&&unique.every((m,i)=>m.start>=0&&m.start<bars&&(!i||m.start>unique[i-1].start))){
    sections=unique.map((s,i)=>({name:s.name.slice(0,32)||'SECTION',start:s.start,bars:(unique[i+1]?.start??bars)-s.start,kind:i%6}));
  }
  return {
    song:{settings,sections,progression:[0,3,4,0],tracks:lanes,variations:{}},
    warnings:maxStep>bars*STEPS_PER_BAR?['Only the first 64 bars were imported.']:[],
  };
}
