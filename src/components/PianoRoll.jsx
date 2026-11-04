import React from 'react';
import { STEPS_PER_BAR, ROOTS, midiNoteName } from '../music/generator.js';
const DRUM_PITCHES=[49,46,42,38,36];
export default function PianoRoll({song,trackId,bar,windowBars=2,onChange}){
  const isDrum=trackId==='drums';
  const notes=song.tracks[trackId]||[];
  const start=bar*STEPS_PER_BAR,span=windowBars*STEPS_PER_BAR;
  const visible=notes.filter(n=>n.step+n.length>start&&n.step<start+span);
  const others=visible.filter(n=>isDrum?DRUM_PITCHES.includes(n.pitch):true);
  const nonDrumPitches=notes.map(n=>n.pitch);
  const minNote= nonDrumPitches.length ? Math.max(24,Math.min(...nonDrumPitches)-3) : 48;
  const maxNote=nonDrumPitches.length ? Math.min(108,Math.max(...nonDrumPitches)+3) : 72;
  const low=isDrum?0:minNote, rows=isDrum?DRUM_PITCHES.length:maxNote-minNote+1;
  const toRow=pitch=>isDrum?DRUM_PITCHES.indexOf(pitch):maxNote-pitch;
  const labelForRow=r=>isDrum?({49:'Crash',46:'Open hat',42:'Closed hat',38:'Snare',36:'Kick'}[DRUM_PITCHES[r]]):midiNoteName(maxNote-r);
  const selected = notes.length;
  const updateNotes=(next)=>onChange(trackId,next);
  const add=(event)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    const x=Math.min(0.9999,Math.max(0,(event.clientX-rect.left)/rect.width));
    const y=Math.min(.9999,Math.max(0,(event.clientY-rect.top)/rect.height));
    const step=start+Math.floor(x*span);
    const row=Math.floor(y*rows);
    const pitch=isDrum?DRUM_PITCHES[row]:maxNote-row;
    const length=isDrum?1:Math.min(2,start+span-step);
    if(!Number.isFinite(pitch))return;
    updateNotes([...notes,{step,pitch,length,velocity:100}]);
  };
  return <div className="piano-roll">
    <div className="roll-header"><div className="roll-title">PIANO ROLL <span>• {trackId.toUpperCase()}</span></div><span className="subdued">Click grid to add • Click note to remove</span><span className="note-count">{selected} notes</span></div>
    <div className="roll-body" style={{'--rows':rows}}>
      <div className="roll-keys">{Array.from({length:rows},(_,r)=><div key={r} className={'roll-key '+(!isDrum&&ROOTS[(maxNote-r)%12]==='C'?'root-key':'')}>{labelForRow(r)}</div>)}</div>
      <div className="roll-grid" onClick={add} role="button" tabIndex={0} aria-label="Piano roll. Click to add a note" onKeyDown={e=>{if(e.key==='Enter'){const p=isDrum?36:maxNote;updateNotes([...notes,{step:start,pitch:p,length:2,velocity:100}]);}}}>
        <div className="roll-grid-lines" style={{backgroundSize:`${100/span}% ${100/rows}%`}}/>
        {Array.from({length:windowBars},(_,b)=><div key={b} className="bar-divider" style={{left:`${(b/windowBars)*100}%`}}><small>{bar+b+1}</small></div>)}
        {others.map((n,i)=>{
          const x=Math.max(n.step,start), end=Math.min(n.step+n.length,start+span);
          const row=toRow(n.pitch);
          return <button key={`${n.step}-${n.pitch}-${i}`} className="roll-note" title={`${midiNoteName(n.pitch)} • beat ${n.step/4+1} • click to remove`}
            onClick={e=>{e.stopPropagation();const idx=notes.indexOf(n);updateNotes(notes.filter((_,j)=>j!==idx));}}
            style={{left:`${(x-start)/span*100}%`,width:`${Math.max((end-x)/span*100,.8)}%`,top:`${row/rows*100+0.3}%`,height:`${Math.max(100/rows-0.6,1.8)}%`}} />;
        })}
      </div>
    </div>
  </div>;
}
