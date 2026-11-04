import React, { useState } from 'react';
import { ROOTS, SCALES, TRACKS, STEPS_PER_BAR } from '../music/generator.js';

const DRUMS=[
  {pitch:49,name:'CRASH'},
  {pitch:46,name:'OPEN HAT'},
  {pitch:42,name:'CLOSED HAT'},
  {pitch:38,name:'SNARE'},
  {pitch:36,name:'KICK'},
];

export default function Workbench({song,trackId,bar,canUndo,canRedo,clipboard,onUndo,onRedo,
  onRegenerate,onChordChange,onMoveSection,onCopy,onPaste,onToggleDrum,onFill,onEuclid}){
  const [velocity,setVelocity]=useState(92);
  const [pulses,setPulses]=useState(5);
  const [rotate,setRotate]=useState(0);
  const [voice,setVoice]=useState(42);
  const steps=SCALES[song.settings.scale]||SCALES.minor;
  const root=Math.max(0,ROOTS.indexOf(song.settings.root));
  const degrees=steps.map((semitones,i)=>({degree:i,label:String(i+1)+' · '+ROOTS[(root+semitones)%12]}));
  const selected=TRACKS.find(t=>t.id===trackId)||TRACKS[0];
  return <section className="workbench-panel" aria-label="Rung 2 composition workbench">
    <div className="workbench-head"><div><span className="panel-number">R2</span><strong> THE COMPOSITION WORKBENCH</strong><small>KEEP THE GOOD PARTS. CHANGE THE REST.</small></div>
      <div className="workbench-history"><button onClick={onUndo} disabled={!canUndo} title="Undo last song edit (Ctrl+Z)">↶ UNDO</button><button onClick={onRedo} disabled={!canRedo} title="Redo last song edit (Ctrl+Shift+Z)">↷ REDO</button></div>
    </div>
    <div className="workbench-tools">
      <div className="wb-tool">
        <h3>TRACK LAB <span>01</span></h3>
        <p>Regenerate only <b>{selected.name}</b>. Other tracks and mixer settings stay intact.</p>
        <button className="wb-primary" onClick={()=>onRegenerate(trackId)}>♻ REGENERATE {selected.short}</button>
        <div className="wb-inline"><button onClick={onCopy}>COPY 2 BARS</button><button disabled={!clipboard} onClick={onPaste}>PASTE {clipboard?clipboard.bars+' BARS':''}</button></div>
        <small>{clipboard?'Clip ready: '+clipboard.notes.length+' notes':'Copy from the selected track and bar; paste over the destination bars.'}</small>
      </div>
      <div className="wb-tool">
        <h3>CHORD LAB <span>02</span></h3>
        <p>Four-chord progression. Changes rewrite <b>bass, chords and arp</b>, leaving drums, melody and lead untouched.</p>
        <div className="wb-chords">{song.progression.map((degree,i)=><label key={i}>CHORD {i+1}
          <select aria-label={'Chord '+(i+1)+' scale degree'} value={degree} onChange={e=>onChordChange(i,Number(e.target.value))}>{degrees.map(d=><option key={d.degree} value={d.degree}>{d.label}</option>)}</select>
        </label>)}</div>
      </div>
    </div>
    <div className="wb-arrangement">
      <div className="wb-section-title">SECTION REORDER <span>MOVE AN ENTIRE SECTION, INCLUDING ITS MIDI NOTES</span></div>
      <div className="wb-section-list">{song.sections.map((section,index)=><div className="wb-section-chip" key={index}>
        <span>{section.name} <small>{section.bars} BARS</small></span>
        <button disabled={index===0} onClick={()=>onMoveSection(index,-1)} aria-label={'Move '+section.name+' earlier'}>←</button>
        <button disabled={index===song.sections.length-1} onClick={()=>onMoveSection(index,1)} aria-label={'Move '+section.name+' later'}>→</button>
      </div>)}</div>
    </div>
    <div className="wb-drums">
      <div className="wb-section-title">DRUM MACHINE <span>EDIT BAR {bar+1} · 16-STEP GRID · GM CHANNEL 10</span></div>
      <div className="wb-drum-rows">{DRUMS.map(d=><div className="wb-drum-row" key={d.pitch}>
        <span>{d.name}</span><div className="wb-drum-grid">{Array.from({length:STEPS_PER_BAR},(_,step)=>{
          const at=bar*STEPS_PER_BAR+step,active=song.tracks.drums.some(n=>n.pitch===d.pitch&&n.step===at);
          return <button type="button" key={step} aria-label={d.name+' bar '+(bar+1)+' step '+(step+1)}
            aria-pressed={active} onClick={()=>onToggleDrum(bar,step,d.pitch,velocity)}
            className={'wb-step '+(active?'wb-step-active ':'')+(step%4===0?'wb-beat':'')}>{active?'●':''}</button>;
        })}</div>
      </div>)}</div>
      <div className="wb-drum-controls">
        <label>VELOCITY <b>{velocity}</b><input type="range" min="35" max="127" value={velocity} onChange={e=>setVelocity(Number(e.target.value))}/></label>
        <label>PULSES <b>{pulses}/16</b><input type="range" min="0" max="16" value={pulses} onChange={e=>setPulses(Number(e.target.value))}/></label>
        <label>ROTATE <b>{rotate}</b><input type="range" min="0" max="15" value={rotate} onChange={e=>setRotate(Number(e.target.value))}/></label>
        <select aria-label="Euclidean pattern drum voice" value={voice} onChange={e=>setVoice(Number(e.target.value))}>{DRUMS.map(d=><option key={d.pitch} value={d.pitch}>{d.name}</option>)}</select>
        <button className="wb-secondary" onClick={()=>onEuclid(bar,voice,pulses,rotate,velocity)}>APPLY RHYTHM</button>
        <button className="wb-primary" onClick={()=>onFill(bar)}>+ DRUM FILL</button>
      </div>
      <p className="wb-footnote">Click steps to add/remove hits. Euclidean rhythm replaces only the selected drum voice in this bar. Fill adds a reproducible turnaround. Every edit exports as MIDI.</p>
    </div>
  </section>;
}
