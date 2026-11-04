/** Pure editing operations. No browser state, audio or external dependencies. */
import { createSong, randomFromSeed, TRACKS, STEPS_PER_BAR, SCALES } from './generator.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const validTrack=id=>TRACKS.some(t=>t.id===id);
const inRange=(n,from,to)=>n.step>=from&&n.step<to;
const copyNote=n=>({...n});
const cloneTracks=tracks=>Object.fromEntries(TRACKS.map(t=>[t.id,(tracks[t.id]||[]).map(copyNote)]));

export function regenerateTrack(song, id) {
  if (!validTrack(id)) throw new Error('Unknown track: '+id);
  const nextVariation=((song.variations||{})[id]||0)+1;
  const sourceSeed=Number(song.settings.seed)||369;
  const salt=Array.from(id).reduce((a,c)=>Math.imul(a,33)+c.charCodeAt(0)|0,5381);
  const seed=(Math.imul(sourceSeed+nextVariation, 1664525)^salt)>>>0;
  const proposal=createSong({...song.settings,seed:seed||1,progression:song.progression});
  return {...song,tracks:{...song.tracks,[id]:proposal.tracks[id]},variations:{...song.variations,[id]:nextVariation}};
}

export function setChordDegree(song, position, degree) {
  const steps=SCALES[song.settings.scale]||SCALES.minor;
  if (!Number.isInteger(position)||position<0||position>3) throw new RangeError('Chord slot 1–4 required');
  if (!Number.isInteger(degree)||degree<0||degree>=steps.length) throw new RangeError('Invalid chord degree');
  const progression=[...song.progression];
  progression[position]=degree;
  const proposal=createSong({...song.settings,progression});
  const tracks={...song.tracks};
  for(const id of ['chords','bass','arp'])tracks[id]=proposal.tracks[id];
  return {...song,progression,tracks,variations:{...song.variations,chords:0,bass:0,arp:0}};
}

export function moveSection(song, index, direction) {
  const target=index+direction;
  if(!Number.isInteger(index)||![-1,1].includes(direction)||index<0||target<0||target>=song.sections.length)return song;
  const reordered=song.sections.map((section,oldIndex)=>({...section,oldIndex}));
  [reordered[index],reordered[target]]=[reordered[target],reordered[index]];
  let offset=0;
  const sections=reordered.map(section=>{
    const {oldIndex,...rest}=section;
    const relocated={...rest,start:offset};
    offset+=section.bars;
    return relocated;
  });
  const startByOld=new Map(reordered.map((s,i)=>[s.oldIndex,sections[i].start]));
  const tracks={};
  for(const t of TRACKS){
    tracks[t.id]=(song.tracks[t.id]||[]).flatMap(n=>{
      const oldIndex=song.sections.findIndex(s=>inRange(n,s.start*STEPS_PER_BAR,(s.start+s.bars)*STEPS_PER_BAR));
      if(oldIndex<0)return [];
      const old=song.sections[oldIndex],step=startByOld.get(oldIndex)*STEPS_PER_BAR+n.step-old.start*STEPS_PER_BAR;
      const end=(startByOld.get(oldIndex)+old.bars)*STEPS_PER_BAR;
      const length=Math.min(n.length,end-step);
      return length>0?[{...n,step,length}]:[];
    }).sort((a,b)=>a.step-b.step||a.pitch-b.pitch);
  }
  return {...song,sections,tracks};
}

export function toggleDrumStep(song,bar,step,pitch,velocity=100) {
  if(![36,38,42,46,49].includes(pitch)||!Number.isInteger(step)||step<0||step>=16||bar<0||bar>=song.settings.bars)return song;
  const at=bar*STEPS_PER_BAR+step;
  const found=(song.tracks.drums||[]).some(n=>n.step===at&&n.pitch===pitch);
  const drums=found?song.tracks.drums.filter(n=>!(n.step===at&&n.pitch===pitch))
    :[...song.tracks.drums,{step:at,pitch,length:1,velocity:clamp(Math.round(velocity),1,127)}];
  drums.sort((a,b)=>a.step-b.step||a.pitch-b.pitch);
  return {...song,tracks:{...song.tracks,drums}};
}

export function addDrumFill(song,bar) {
  if(!Number.isInteger(bar)||bar<0||bar>=song.settings.bars)return song;
  const rand=randomFromSeed((Number(song.settings.seed)||369)+bar*7919);
  const drums=(song.tracks.drums||[]).map(copyNote);
  for(const step of [11,12,13,14,15]){
    const pitch=step%2?38:42,at=bar*STEPS_PER_BAR+step;
    if(!drums.some(n=>n.step===at&&n.pitch===pitch))
      drums.push({step:at,pitch,length:1,velocity:Math.round(61+rand()*44)});
  }
  drums.sort((a,b)=>a.step-b.step||a.pitch-b.pitch);
  return {...song,tracks:{...song.tracks,drums}};
}

export function copyClip(song,trackId,bar,bars=2){
  if(!validTrack(trackId))throw new Error('Unknown track');
  const from=clamp(Math.floor(bar),0,song.settings.bars-1)*STEPS_PER_BAR;
  const span=Math.min(Math.max(1,Math.floor(bars)),song.settings.bars-Math.floor(from/STEPS_PER_BAR))*STEPS_PER_BAR;
  return {bars:span/STEPS_PER_BAR,notes:(song.tracks[trackId]||[]).filter(n=>inRange(n,from,from+span))
    .map(n=>({...n,step:n.step-from,length:Math.min(n.length,from+span-n.step)}))};
}
export function pasteClip(song,trackId,bar,clip){
  if(!validTrack(trackId)||!clip||!Number.isInteger(clip.bars)||!Array.isArray(clip.notes))throw new Error('Invalid clip');
  const from=clamp(Math.floor(bar),0,song.settings.bars-1)*STEPS_PER_BAR;
  const end=Math.min(song.settings.bars*STEPS_PER_BAR,from+clip.bars*STEPS_PER_BAR);
  const untouched=(song.tracks[trackId]||[]).filter(n=>!inRange(n,from,end));
  const notes=clip.notes.filter(n=>Number.isInteger(n.step)&&Number.isInteger(n.pitch)&&Number.isFinite(n.length)&&n.step>=0&&n.step<(end-from)&&n.pitch>=0&&n.pitch<=127&&n.length>0)
    .map(n=>({...n,step:from+n.step,length:Math.min(n.length,end-from-n.step)}));
  return {...song,tracks:{...song.tracks,[trackId]:[...untouched,...notes].sort((a,b)=>a.step-b.step||a.pitch-b.pitch)}};
}
export function normalizeSong(song) {
  return {...song,sections:song.sections||[],progression:Array.isArray(song.progression)&&song.progression.length===4?song.progression:[0,3,4,0],
    variations:song.variations||{},tracks:cloneTracks(song.tracks)};
}

/** Evenly-spaced Euclidean pattern, optionally rotated; only one drum voice is replaced. */
export function setEuclideanDrums(song,bar,pitch,pulses,rotation=0,velocity=95){
  if(![36,38,42,46,49].includes(pitch)||!Number.isInteger(bar)||bar<0||bar>=song.settings.bars)return song;
  const count=clamp(Math.floor(Number(pulses)||0),0,16);
  const phase=((Math.floor(Number(rotation)||0)%16)+16)%16;
  const from=bar*STEPS_PER_BAR,to=from+STEPS_PER_BAR;
  const unaffected=(song.tracks.drums||[]).filter(n=>!(n.pitch===pitch&&inRange(n,from,to)));
  const notes=[];
  for(let step=0;step<16;step++){
    const relative=(step-phase+16)%16;
    if(count>0 && (relative*count)%16<count)
      notes.push({step:from+step,pitch,length:1,velocity:clamp(Math.round(velocity),1,127)});
  }
  return {...song,tracks:{...song.tracks,drums:[...unaffected,...notes].sort((a,b)=>a.step-b.step||a.pitch-b.pitch)}};
}
