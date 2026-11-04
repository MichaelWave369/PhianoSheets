import React, { useEffect, useRef, useState } from 'react';
import { STEPS_PER_BAR, ROOTS, midiNoteName } from '../music/generator.js';

const DRUM_PITCHES=[49,46,42,38,36];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export default function PianoRoll({song,trackId,bar,windowBars=2,onChange}){
  const isDrum=trackId==='drums',notes=song.tracks[trackId]||[];
  const start=bar*STEPS_PER_BAR,span=windowBars*STEPS_PER_BAR;
  const visible=notes.filter(n=>n.step+n.length>start&&n.step<start+span);
  const pitched=visible.filter(n=>isDrum?DRUM_PITCHES.includes(n.pitch):true);
  const nonDrumPitches=notes.map(n=>n.pitch);
  const minNote=nonDrumPitches.length?Math.max(24,Math.min(...nonDrumPitches)-3):48;
  const maxNote=nonDrumPitches.length?Math.min(108,Math.max(...nonDrumPitches)+3):72;
  const rows=isDrum?DRUM_PITCHES.length:maxNote-minNote+1;
  const toRow=pitch=>isDrum?DRUM_PITCHES.indexOf(pitch):maxNote-pitch;
  const labelForRow=r=>isDrum?({49:'Crash',46:'Open hat',42:'Closed hat',38:'Snare',36:'Kick'}[DRUM_PITCHES[r]]):midiNoteName(maxNote-r);
  const gridRef=useRef(null),gesture=useRef(null);
  const [selected,setSelected]=useState(-1),[preview,setPreview]=useState(null);
  useEffect(()=>{setSelected(-1);setPreview(null);gesture.current=null;},[trackId,bar]);
  const selectedNote=notes[selected];
  const submit=next=>onChange(trackId,next);
  const update=(index,n)=>submit(notes.map((note,i)=>i===index?n:note));
  const edit=(type,delta)=>{
    if(!selectedNote)return;
    const next={...selectedNote};
    if(type==='step')next.step=clamp(next.step+delta,0,song.settings.bars*16-next.length);
    if(type==='length')next.length=clamp(next.length+delta,1,song.settings.bars*16-next.step);
    update(selected,next);
  };
  const remove=()=>{
    if(!selectedNote)return;
    submit(notes.filter((_,i)=>i!==selected));setSelected(-1);
  };
  const add=e=>{
    if(e.target.closest('.roll-note'))return;
    const rect=e.currentTarget.getBoundingClientRect();
    const x=clamp((e.clientX-rect.left)/rect.width,0,.9999);
    const y=clamp((e.clientY-rect.top)/rect.height,0,.9999);
    const step=start+Math.floor(x*span),row=Math.floor(y*rows);
    const pitch=isDrum?DRUM_PITCHES[row]:maxNote-row;
    if(!Number.isFinite(pitch))return;
    submit([...notes,{step,pitch,length:isDrum?1:Math.min(2,song.settings.bars*16-step),velocity:100}]);
  };
  const begin=(e,index,n)=>{
    e.stopPropagation();e.preventDefault();
    const resize=Boolean(e.target.closest('.roll-resize'));
    gesture.current={index,original:n,x:e.clientX,y:e.clientY,mode:resize?'resize':'move'};
    e.currentTarget.setPointerCapture(e.pointerId);setSelected(index);setPreview(null);
  };
  const transform=e=>{
    const g=gesture.current,rect=gridRef.current?.getBoundingClientRect();
    if(!g||!rect)return null;
    const dStep=Math.round((e.clientX-g.x)/(rect.width/span));
    const dRow=Math.round((e.clientY-g.y)/(rect.height/rows));
    if(g.mode==='resize')return {...g.original,length:clamp(g.original.length+dStep,1,song.settings.bars*16-g.original.step)};
    return {...g.original,
      step:clamp(g.original.step+dStep,0,song.settings.bars*16-g.original.length),
      pitch:isDrum?g.original.pitch:clamp(g.original.pitch-dRow,0,127)};
  };
  const move=e=>{if(gesture.current)setPreview(transform(e));};
  const finish=e=>{
    if(!gesture.current)return;
    const g=gesture.current,next=transform(e);
    gesture.current=null;setPreview(null);
    if(next&&(next.step!==g.original.step||next.length!==g.original.length||next.pitch!==g.original.pitch))update(g.index,next);
  };
  const selectedActions=(action,e)=>{
    if(!selectedNote)return;
    if(action==='delete')remove();
    else if(action==='left')edit('step',-1);
    else if(action==='right')edit('step',1);
    else if(action==='shorter')edit('length',-1);
    else if(action==='longer')edit('length',1);
    e?.stopPropagation();
  };
  return <div className="piano-roll">
    <div className="roll-header"><div className="roll-title">PIANO ROLL <span>• {trackId.toUpperCase()}</span></div>
      <span className="subdued">Click grid to add · drag note to move · drag its right edge to resize</span>
      <span className="note-count">{notes.length} notes</span>
    </div>
    <div className="roll-editbar">
      <span>{selectedNote?'SELECTED: '+midiNoteName(selectedNote.pitch)+' · STEP '+selectedNote.step+' · LENGTH '+selectedNote.length:'CLICK A NOTE TO SELECT IT'}</span>
      <div><button disabled={!selectedNote} onClick={()=>selectedActions('left')} title="Move left one step">←</button>
        <button disabled={!selectedNote} onClick={()=>selectedActions('right')} title="Move right one step">→</button>
        <button disabled={!selectedNote} onClick={()=>selectedActions('shorter')} title="Shorten by one step">L−</button>
        <button disabled={!selectedNote} onClick={()=>selectedActions('longer')} title="Lengthen by one step">L+</button>
        <button disabled={!selectedNote} onClick={()=>selectedActions('delete')} title="Delete selected note">DELETE</button></div>
    </div>
    <div className="roll-body" style={{'--rows':rows}}>
      <div className="roll-keys">{Array.from({length:rows},(_,r)=><div key={r} className={'roll-key '+(!isDrum&&ROOTS[(maxNote-r)%12]==='C'?'root-key':'')}>{labelForRow(r)}</div>)}</div>
      <div ref={gridRef} className="roll-grid" onClick={add} role="grid" tabIndex={0}
        aria-label="Piano roll. Click to add a note, select a note to move or resize it."
        onKeyDown={e=>{
          if(e.key==='Enter'&&e.target===e.currentTarget){e.preventDefault();submit([...notes,{step:start,pitch:isDrum?36:maxNote,length:2,velocity:100}]);}
        }}>
        <div className="roll-grid-lines" style={{backgroundSize:(100/span)+'% '+(100/rows)+'%'}}/>
        {Array.from({length:windowBars},(_,b)=><div key={b} className="bar-divider" style={{left:(b/windowBars*100)+'%'}}><small>{bar+b+1}</small></div>)}
        {pitched.map(n=>{
          const index=notes.indexOf(n),v=selected===index&&preview?preview:n;
          const x=Math.max(v.step,start),end=Math.min(v.step+v.length,start+span);
          const row=toRow(v.pitch);
          if(row<0||row>=rows||end<=x)return null;
          return <button key={index} className={'roll-note '+(selected===index?'roll-note-selected':'')}
            aria-label={midiNoteName(v.pitch)+' at step '+v.step+' length '+v.length+'. Drag to move or resize.'}
            title={midiNoteName(v.pitch)+' · drag body to move, right edge to resize'}
            onClick={e=>{e.stopPropagation();setSelected(index);}}
            onPointerDown={e=>begin(e,index,n)} onPointerMove={move} onPointerUp={finish}
            onPointerCancel={()=>{gesture.current=null;setPreview(null);}}
            onKeyDown={e=>{
              if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}
              if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();selectedActions(e.shiftKey?(e.key==='ArrowLeft'?'shorter':'longer'):(e.key==='ArrowLeft'?'left':'right'));}
            }}
            style={{left:(x-start)/span*100+'%',width:Math.max((end-x)/span*100,.8)+'%',
              top:(row/rows*100+.3)+'%',height:Math.max(100/rows-.6,1.8)+'%'}}>
            <span className="roll-resize" aria-hidden="true"/>
          </button>;
        })}
      </div>
    </div>
  </div>;
}
