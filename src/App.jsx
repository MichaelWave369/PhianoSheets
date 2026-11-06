import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine, renderAudio } from './music/audio.js';
import { downloadWav, encodeWavPCM16 } from './music/wav.js';
import { loadLocalBank } from './music/sample-bank.js';
import { downloadZip } from './music/zip.js';
import { buildProductionPackEntries } from './music/production-pack.js';
import SoundLabChannel from './components/SoundLabChannel.jsx';
import { createSong, DEFAULT_SETTINGS, ROOTS, SCALES, STYLES, TRACKS, STEPS_PER_BAR } from './music/generator.js';
import { downloadMidi } from './music/midi.js';
import PianoRoll from './components/PianoRoll.jsx';
import Workbench from './components/Workbench.jsx';
import HarmonicLab from './components/HarmonicLab.jsx';
import ArrangementTrials from './components/ArrangementTrials.jsx';
import { regenerateTrack, setChordDegree, moveSection, toggleDrumStep, addDrumFill, setEuclideanDrums, copyClip, pasteClip, normalizeSong } from './music/editor.js';
import { parseMidi } from './music/import.js';

const KEY = 'phianosheets.project.v1';
const initialMixer=Object.fromEntries(TRACKS.map(t=>[t.id,{volume:t.id==='drums' ? .85 : .78,pan:0,mute:false,solo:false,filter:100,delay:0,instrument:'auto'}]));
const restoreMixer=saved=>Object.fromEntries(TRACKS.map(t=>[t.id,{...initialMixer[t.id],...(saved?.[t.id]||{})}]));
const readProject=()=>{
  try{
    const stored=JSON.parse(localStorage.getItem(KEY));
    if(stored?.song?.tracks && stored?.song?.settings && stored?.settings && stored?.mixer){
      return {settings:{...DEFAULT_SETTINGS,...stored.settings},song:normalizeSong(stored.song),mixer:restoreMixer(stored.mixer),master:Number.isFinite(stored.master)?stored.master:.72};
    }
  }catch{/* Fresh start on invalid saved data. */}
  return {settings:DEFAULT_SETTINGS,song:normalizeSong(createSong(DEFAULT_SETTINGS)),mixer:initialMixer,master:.72};
};
const prettyTime=(total)=>`${Math.floor(total/60)}:${String(Math.floor(total%60)).padStart(2,'0')}`;
const safeName=name=>(name||'phianosheets').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const downloadJson=(obj,name)=>{
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`${safeName(name)}.phiano.json`;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function Icon({name,size=18}){
  const paths={
    play:<polygon points="7 4 20 12 7 20 7 4" fill="currentColor" stroke="none"/>,
    stop:<rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none" rx="2"/>,
    download:<><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 17v4h14v-4"/></>,
    shuffle:<><path d="m18 14 4 4-4 4M18 2l4 4-4 4"/><path d="M2 18h2c7 0 6-12 13-12h5M2 6h2c3 0 4 2 6 5m4 3c2 3 3 4 6 4h2"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M19.1 4.9 17 7m-10 10-2.1 2.1"/></>,
    headphones:<><path d="M3 14v-3a9 9 0 0 1 18 0v3M3 14h5v7H6a3 3 0 0 1-3-3v-4Zm18 0h-5v7h2a3 3 0 0 0 3-3v-4Z"/></>,
    disk:<><path d="M4 3h14l3 3v15H3V3h1Z"/><path d="M7 3v6h10V3M7 21v-9h10v9"/></>,
    upload:<><path d="M12 17V3m-5 5 5-5 5 5"/><path d="M4 17v4h16v-4"/></>,
    loop:<><path d="M20 7H7a4 4 0 0 0-4 4v2m1-8 3 2-3 2M4 17h13a4 4 0 0 0 4-4v-2m-1 8-3-2 3-2"/></>,
    spark:<><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/></>,
    help:<><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.4 1.2-1.7 1.5-1.7 3.2M12 17h.01"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Slider({label,value,min=0,max=100,step=1,onChange,suffix='',valueText}){
  return <label className="knob"><span className="knob-top"><span>{label}</span><strong>{valueText??`${value}${suffix}`}</strong></span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
}
function App(){
  const first=useMemo(readProject,[]);
  const [settings,setSettings]=useState(first.settings);
  const [song,setSong]=useState(first.song);
  const [mixer,setMixer]=useState(first.mixer);
  const [selectedTrack,setSelectedTrack]=useState('melody');
  const [selectedBar,setSelectedBar]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [loop,setLoop]=useState(true);
  const [master,setMaster]=useState(first.master);
  const [soundfontStatus,setSoundfontStatus]=useState('Built-in synth ready');
  const [exportingAudio,setExportingAudio]=useState(false);
  const [exportProgress,setExportProgress]=useState('');
  const [bankBusy,setBankBusy]=useState(null);
  const [localBankInfo,setLocalBankInfo]=useState({});
  const [error,setError]=useState('');
  const [showInfo,setShowInfo]=useState(false);
  const engine=useRef(null), fileRef=useRef(null), midiRef=useRef(null);
  const sampleSources=useRef({});
  const songRef=useRef(first.song);
  const history=useRef({past:[],future:[]});
  const [,refreshHistory]=useState(0);
  const [clipboard,setClipboard]=useState(null);
  if(!engine.current && typeof window!=='undefined')engine.current=new AudioEngine();
  useEffect(()=>{
    try { localStorage.setItem(KEY,JSON.stringify({settings,song,mixer,master})); }
    catch { /* Project export still works if browser storage is blocked or full. */ }
  },[settings,song,mixer,master]);
  useEffect(()=>{engine.current?.setMixer(mixer);},[mixer]);
  useEffect(()=>{engine.current?.setMaster(master);},[master]);
  useEffect(()=>()=>engine.current?.dispose(),[]);
  const totalNotes=Object.values(song.tracks).reduce((sum,arr)=>sum+arr.length,0);
  const seconds=song.settings.bars*4*60/song.settings.bpm;
  const duration=prettyTime(seconds);
  const hasSolo=TRACKS.some(t=>mixer[t.id]?.solo);
  const activeCount=TRACKS.filter(t=>!mixer[t.id]?.mute&&(!hasSolo||mixer[t.id]?.solo)).length;

  const stop=useCallback((resetBar=true)=>{engine.current?.stop();setPlaying(false);if(resetBar)setSelectedBar(0);},[]);
  const commitSong=useCallback(next=>{
    const previous=songRef.current;
    if(next===previous)return;
    history.current.past.push(previous);
    if(history.current.past.length>40)history.current.past.shift();
    history.current.future=[];
    songRef.current=next;setSong(next);refreshHistory(n=>n+1);
  },[]);
  const restoreSong=useCallback(next=>{
    stop(false);songRef.current=next;setSong(next);
    setSelectedBar(bar=>Math.min(bar,next.settings.bars-1));
    setSettings({...DEFAULT_SETTINGS,...next.settings});
    refreshHistory(n=>n+1);
  },[stop]);
  const undo=useCallback(()=>{
    const previous=history.current.past.pop();if(!previous)return;
    history.current.future.push(songRef.current);restoreSong(previous);
  },[restoreSong]);
  const redo=useCallback(()=>{
    const next=history.current.future.pop();if(!next)return;
    history.current.past.push(songRef.current);restoreSong(next);
  },[restoreSong]);
  const start=useCallback(async()=>{
    setError('');
    try{
      await engine.current.play(song,mixer,(bar)=>{if(bar<0){setPlaying(false);setSelectedBar(0);}else setSelectedBar(bar);},loop);
      engine.current.setMaster(master);
      setPlaying(true);
    }catch(e){setError(e?.message||'Audio could not start.');setPlaying(false);}
  },[song,mixer,loop,master]);
  const toggle=useCallback(()=>playing?stop():start(),[playing,stop,start]);
  useEffect(()=>{
    const onKey=(e)=>{
      if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){
        if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable)return;
        e.preventDefault();
        if(e.key.toLowerCase()==='y'||e.shiftKey)redo();else undo();
        return;
      }
      if(e.code==='Space' && !['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName)){
        e.preventDefault();toggle();
      }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[toggle,undo,redo]);
  // Keep lightweight playback/groove edits in sync without changing note composition.
  const setField=(field,val)=>{
    // Live playback has a precomputed event schedule; restart after timing changes.
    if(['bpm','swing','humanize','a4Hz'].includes(field) && engine.current?.isPlaying) stop(false);
    setSettings(s=>({...s,[field]:val}));
    if(['bpm','swing','humanize','title','a4Hz'].includes(field)){
      const updated={...songRef.current,settings:{...songRef.current.settings,[field]:val}};
      songRef.current=updated;setSong(updated);
    }
  };
  const generate=(overrides={},freshSeed=false)=>{
    stop();setError('');
    const next={...settings,...overrides};
    if(freshSeed)next.seed=Math.floor(Math.random()*9999999)+1;
    setSettings(next);commitSong(normalizeSong(createSong(next)));setSelectedBar(0);
  };
  const selectStyle=(id)=>{
    const style=STYLES.find(s=>s.id===id);
    generate({style:id,bpm:style?.tempo||92},false);
  };
  const updateMixer=(id,field,val)=>setMixer(s=>({...s,[id]:{...s[id],[field]:val}}));
  const loadBank=async (id,files,presetIndex=0)=>{
    if(!files?.length)return;
    stop(false);setError('');setBankBusy(id);
    try {
      await engine.current.ensure();
      const bank=await loadLocalBank(files,engine.current.ctx,presetIndex);
      engine.current.setSampleBank(id,bank);
      sampleSources.current[id]=files;
      setLocalBankInfo(s=>({...s,[id]:{
        name:bank.name,presets:bank.presets||[],presetIndex
      }}));
      updateMixer(id,'instrument','local');
    }catch(error){setError('Local sample import: '+(error?.message||'Invalid sample bank'));}
    finally{setBankBusy(null);}
  };
  const changePreset=(id,presetIndex)=>{
    const files=sampleSources.current[id];
    if(files?.length)void loadBank(id,files,presetIndex);
  };
  const verifyLocalBanks=()=>{
    const missing=TRACKS.filter(t=>mixer[t.id]?.instrument==='local'&&!engine.current.sampleBanks[t.id]);
    if(missing.length)throw Error('Reload local samples for '+missing.map(t=>t.short).join(', ')+' before WAV/stem export.');
  };
  const exportAudio=async()=>{
    if(exportingAudio)return;
    stop(false);setError('');setExportingAudio(true);
    try{
      verifyLocalBanks();
      const rendered=await renderAudio(song,mixer,master,{sampleBanks:engine.current.sampleBanks});
      downloadWav(rendered,song.settings.title);
    }catch(e){setError('WAV export failed: '+(e?.message||'Unable to render audio'));}
    finally{setExportingAudio(false);}
  };
  // Shared offline renderer for both bare WAV stems and the complete DAW pack.
  // Render one lane at a time; preserve the same initial timeline for every lane.
  const renderAllStems=async()=>{
    verifyLocalBanks();
    const banks=engine.current.sampleBanks;
    const stems=[];
    for(const [index,track] of TRACKS.entries()){
      setExportProgress('Rendering '+track.short+' · '+(index+1)+'/'+TRACKS.length);
      const audio=await renderAudio(song,mixer,master,{
        stemTrackId:track.id,sampleBanks:banks
      });
      stems.push({id:track.id,name:track.id+'.wav',bytes:encodeWavPCM16(audio)});
    }
    return stems;
  };
  const exportStems=async()=>{
    if(exportingAudio)return;
    stop(false);setError('');setExportingAudio(true);
    try{
      const stems=await renderAllStems();
      setExportProgress('Packaging WAV stems…');
      downloadZip(stems,song.settings.title);
    }catch(e){setError('Stem export failed: '+(e?.message||'Unable to render stems'));}
    finally{setExportingAudio(false);setExportProgress('');}
  };
  const exportPack=async()=>{
    if(exportingAudio)return;
    stop(false);setError('');setExportingAudio(true);
    try{
      const stems=await renderAllStems();
      setExportProgress('Packaging DAW handoff…');
      const entries=buildProductionPackEntries({song,mixer,master,stems});
      downloadZip(entries,song.settings.title,'production-pack');
    }catch(e){setError('Production Pack failed: '+(e?.message||'Unable to build DAW package'));}
    finally{setExportingAudio(false);setExportProgress('');}
  };
  const updateNotes=(id,notes)=>{
    stop(false);commitSong({...songRef.current,tracks:{...songRef.current.tracks,[id]:notes}});
  };
  const editSong=operation=>{
    stop(false);setError('');commitSong(operation(songRef.current));
  };
  const regenerateSelected=id=>editSong(s=>regenerateTrack(s,id));
  const changeChord=(position,degree)=>editSong(s=>setChordDegree(s,position,degree));
  const reorderSection=(index,direction)=>editSong(s=>moveSection(s,index,direction));
  const toggleStep=(bar,step,pitch,velocity)=>editSong(s=>toggleDrumStep(s,bar,step,pitch,velocity));
  const fillBar=bar=>editSong(s=>addDrumFill(s,bar));
  const euclid=(bar,pitch,pulses,rotation,velocity)=>editSong(s=>setEuclideanDrums(s,bar,pitch,pulses,rotation,velocity));
  const copySelectedClip=()=>setClipboard(copyClip(songRef.current,selectedTrack,selectedBar,2));
  const pasteSelectedClip=()=>{if(clipboard)editSong(s=>pasteClip(s,selectedTrack,selectedBar,clipboard));};
  const loadFonts=async()=>{
    setSoundfontStatus('Loading SoundFont patches…');setError('');
    try{
      const {loaded,failures}=await engine.current.loadSoundfonts();
      setSoundfontStatus(failures.length?`${loaded}/5 patches ready • synth fallback for ${failures.length}`:`${loaded}/5 SoundFont patches ready`);
    }catch(e){setSoundfontStatus('Built-in synth ready');setError('Could not load SoundFonts. The built-in synth still works.');}
  };
  const importProject=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const project=JSON.parse(await file.text());
      if(!project.settings||!project.song?.tracks||!project.mixer||!TRACKS.every(t=>Array.isArray(project.song.tracks[t.id])))throw Error('Invalid PhianoSheets project file');
      stop();
      engine.current.sampleBanks={};sampleSources.current={};setLocalBankInfo({});
      const restored=normalizeSong(project.song);
      commitSong(restored);
      setSettings({...DEFAULT_SETTINGS,...project.settings,...restored.settings});
      setMixer(restoreMixer(project.mixer));setMaster(Number.isFinite(project.master)?project.master:.72);setError('');
    }catch(e){setError(`Import failed: ${e?.message||'Invalid file'}`);}
    e.target.value='';
  };
  const importMidiFile=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const {song:imported,warnings}=parseMidi(await file.arrayBuffer());
      const titled={...imported,settings:{...imported.settings,title:file.name.replace(/\.mid(i)?$/i,'').slice(0,65)}};
      stop();commitSong(normalizeSong(titled));
      setSettings(titled.settings);setSelectedTrack('melody');setError(warnings.join(' '));
    }catch(error){setError('MIDI import failed: '+(error?.message||'Invalid MIDI file'));}
    e.target.value='';
  };
  const canUndo=history.current.past.length>0,canRedo=history.current.future.length>0;
  const counts=useMemo(()=>Object.fromEntries(TRACKS.map(t=>{
    const a=Array(song.settings.bars).fill(0);
    (song.tracks[t.id]||[]).forEach(n=>{const b=Math.floor(n.step/16);if(b>=0&&b<a.length)a[b]++;});
    return [t.id,a];
  })),[song]);
  return <div className="shell">
    <header className="site-header">
      <div className="brand"><div className="brand-mark"><span>Φ</span></div><div><div className="brand-name">PHIANO<span>SHEETS</span><sup>369</sup></div><div className="brand-tagline">THE MIDI IDEA MACHINE</div></div></div>
      <nav className="top-nav"><span className="nav-current">STUDIO <span className="nav-dot"/></span><span className="nav-passive">GEN ENGINE V0.5 · LISTENING CHAMBER</span></nav>
      <div className="header-actions"><span className="online-indicator"><span/> LOCAL-FIRST ENGINE</span><button className="icon-btn" onClick={()=>setShowInfo(s=>!s)} title="About PhianoSheets"><Icon name="help"/></button><a className="github-link" href="https://github.com/MichaelWave369/PhianoSheets" target="_blank" rel="noreferrer">GITHUB ↗</a></div>
    </header>

    <main className="main-area">
      <div className="heading-row"><div><div className="eyebrow"><span className="tiny-diamond">◆</span> PHI369 LABS PRESENTS <span className="eyebrow-line"/></div><h1>Make something <em>move.</em></h1><p className="subtitle">Generate an idea. Find the pocket. Make it yours. Every note is real MIDI.</p></div>
        <div className="session-stat"><div className="session-led">◌ <span>LIVE SESSION</span></div><strong>{totalNotes.toLocaleString()}</strong><small>GENERATED NOTES</small></div></div>
      {showInfo&&<div className="info-panel"><strong>What is PhianoSheets?</strong><p>A free, MIT-licensed MIDI composition sandbox. Generate complete arrangements, edit notes, audition them in your browser and export standard multitrack MIDI. Built-in synthesis works offline after first load; optional SoundFont patches need internet. Local SF2/SFZ/WAV sampling and six-track WAV stems are supported. Native VST3/AU plugin builds belong to later phases.</p><button onClick={()=>setShowInfo(false)}>Close</button></div>}
      {error&&<div role="alert" className="error-bar">{error} <button onClick={()=>setError('')}>Dismiss</button></div>}
      <div className="workspace">
        <aside className="generator-sidebar">
          <div className="panel-heading"><span className="panel-number">01</span><h2>COMPOSITION DNA</h2><Icon name="settings" size={17}/></div>
          <div className="generator-content"><div className="field-label">PROJECT NAME</div><input className="project-input" aria-label="Project name" value={settings.title} maxLength={65} onChange={e=>setField('title',e.target.value)} />
            <div className="field-label spaced">CHOOSE YOUR FREQUENCY</div>
            <div className="style-picks">{STYLES.map(s=><button key={s.id} className={'style-pick '+(settings.style===s.id?'picked':'')} onClick={()=>selectStyle(s.id)} title={s.description}><span>{s.name}</span>{settings.style===s.id&&<span className="pick-circle"/>}</button>)}</div>
            <div className="dual-select"><label>ROOT NOTE<select value={settings.root} onChange={e=>setField('root',e.target.value)}>{ROOTS.map(r=><option key={r}>{r}</option>)}</select></label><label>SCALE<select value={settings.scale} onChange={e=>setField('scale',e.target.value)}>{Object.keys(SCALES).map(s=><option key={s} value={s}>{s.toUpperCase()}</option>)}</select></label></div>
            <div className="field-label spaced">SONG LENGTH</div><div className="length-pills">{[8,16,32,64].map(n=><button key={n} className={settings.bars===n?'chosen':''} onClick={()=>setField('bars',n)}>{n}<small> BARS</small></button>)}</div>
            <div className="seed-box"><label>RANDOM SEED<input type="number" min="1" max="99999999" value={settings.seed} onChange={e=>setField('seed',Math.max(1,Number(e.target.value)||1))}/></label><button onClick={()=>setField('seed',Math.floor(Math.random()*9999999)+1)} title="Random seed"><Icon name="shuffle" size={16}/></button></div>
            <button className="generate-btn" onClick={()=>generate()}><Icon name="spark" size={20}/> GENERATE SONG <span>↗</span></button><button className="variation-btn" onClick={()=>generate({},true)}><Icon name="shuffle" size={15}/> NEW VARIATION</button>
            <p className="sidebar-hint">Style presets regenerate immediately. Other composition changes apply when you generate.</p>
          </div>
          <div className="sidebar-footer"><div className="footer-symbol">◎</div><span>HUMAN IDEAS.<br/>SILICON ASSISTANCE.</span></div>
        </aside>

        <section className="studio-center">
          <div className="transport-panel"><div className="transport-top"><div className="transport-label"><span className="panel-number">02</span> THE WORKSPACE <span className="transport-title">/ {song.settings.title||'UNTITLED SESSION'}</span></div><span className="session-format">WEB AUDIO PREVIEW · MIDI 1.0 EXPORT</span></div>
            <div className="transport-controls"><button className="play-btn" onClick={toggle} aria-label={playing?'Stop playback':'Start playback'}><Icon name={playing?'stop':'play'} size={20}/></button><div className="transport-location"><strong>{String(selectedBar+1).padStart(2,'0')}<span>.01</span></strong><small>BAR · BEAT</small></div><div className="transport-divider"/><div className="tempo-field"><small>TEMPO</small><div><input aria-label="Tempo in BPM" type="number" min="40" max="240" value={settings.bpm} onChange={e=>setField('bpm',Math.min(240,Math.max(40,Number(e.target.value)||40)))}/><span>BPM</span></div></div><div className="transport-divider"/><div className="time-field"><small>TIME SIG</small><strong>4 / 4</strong></div><div className="transport-spacer"/><button className={'loop-btn '+(loop?'on':'')} onClick={()=>setLoop(v=>!v)} title="Toggle loop"><Icon name="loop" size={17}/><span>LOOP</span></button><span className="song-time">{duration}</span></div>
            <div className="transport-bottom"><span className="status-dot"/>{playing?'PLAYING ARRANGEMENT':'READY TO CREATE'} <span className="transport-bottom-right">6 TRACKS <span>·</span> {song.settings.bars} BARS <span>·</span> {settings.root} {settings.scale.toUpperCase()}</span></div>
          </div>
          <div className="arrangement-panel"><div className="arrangement-heading"><div className="panel-title"><span className="panel-number">03</span><h2>ARRANGEMENT</h2></div><span className="panel-helper">CLICK ANY BAR TO INSPECT</span></div>
            <div className="arrangement-scroll"><div className="arrangement-inner"><div className="section-line"><span className="track-head section-head">SONG STRUCTURE</span><div className="section-cells">{song.sections.map((s,i)=><div key={i} className={'section-cell sec-'+s.kind} style={{flex:s.bars}}>{s.name}<small>{s.bars} BAR{s.bars===1?'':'S'}</small></div>)}</div></div>
                <div className="bar-ruler"><span className="track-head ruler-label">TRACKS <b>{TRACKS.length}</b></span><div className="ruler-bars">{Array.from({length:song.settings.bars},(_,b)=><span key={b} style={{flex:1}}>{b%4===0?String(b+1).padStart(2,'0'):''}</span>)}</div></div>
                {TRACKS.map(t=><div key={t.id} className={'arrangement-row '+(selectedTrack===t.id?'selected-lane':'')}>
                  <button className="track-head track-name" onClick={()=>setSelectedTrack(t.id)}><span className="track-icon" style={{'--accent':t.color}}>{t.icon}</span><span><strong>{t.short}</strong><small>{t.name}</small></span><span className="track-led" style={{background:t.color}}/></button>
                  <div className="lane-cells" style={{'--track-color':t.color}}>{counts[t.id].map((count,b)=><button key={b} onClick={()=>{setSelectedTrack(t.id);setSelectedBar(b);}} className={'lane-block '+(count?'has-notes':'')+' '+(selectedBar===b?'playhead-bar':'')} style={{'--weight':count?Math.min(.93,.23+count/18):0}} title={`${t.name} · bar ${b+1} · ${count} notes`}>{count>0&&<span className="lane-notes"/>}</button>)}</div>
                </div>)}
                <div className="bar-ruler footer-ruler"><span className="track-head">END OF SESSION</span><div className="ruler-bars">{Array.from({length:song.settings.bars},(_,b)=><span key={b} style={{flex:1}}>{b%4===0?b+1:''}</span>)}</div></div>
              </div></div>
          </div>
          <Workbench song={song} trackId={selectedTrack} bar={selectedBar} canUndo={canUndo} canRedo={canRedo}
              clipboard={clipboard} onUndo={undo} onRedo={redo} onRegenerate={regenerateSelected}
              onChordChange={changeChord} onMoveSection={reorderSection} onCopy={copySelectedClip}
              onPaste={pasteSelectedClip} onToggleDrum={toggleStep} onFill={fillBar} onEuclid={euclid}/>
           <HarmonicLab a4Hz={song.settings.a4Hz ?? 440} onA4Change={hz=>setField('a4Hz',hz)}/>
           <ArrangementTrials song={song} mixer={mixer} master={master}
             sampleBanks={engine.current?.sampleBanks || {}} bankRevision={localBankInfo}
             stopPlayback={()=>stop(false)}/>
           <PianoRoll song={song} trackId={selectedTrack} bar={Math.floor(selectedBar/2)*2} onChange={updateNotes}/>
          <div className="export-panel"><div><span className="export-asterisk">✳</span><div><strong>GOOD IDEAS DESERVE TO LEAVE THE BROWSER.</strong><p>Take your arrangement into FL Studio, Ableton, Reaper, Logic, or any MIDI-capable DAW.</p></div></div><div className="export-actions"><button className="secondary-btn" onClick={()=>downloadJson({version:4,settings,song,mixer,master},settings.title)}><Icon name="disk" size={15}/> SAVE PROJECT</button><button className="export-btn" onClick={()=>downloadMidi(song,mixer)}><Icon name="download" size={16}/> EXPORT MIDI</button><button className="wav-export-btn" disabled={exportingAudio} onClick={exportAudio}><Icon name="download" size={16}/> {exportingAudio?'RENDERING…':'EXPORT WAV'}</button><button className="stem-export-btn" disabled={exportingAudio} onClick={exportStems}><Icon name="download" size={16}/> {exportingAudio?'RENDERING…':'STEMS ZIP'}</button><button className="pack-export-btn" disabled={exportingAudio} onClick={exportPack}><Icon name="download" size={16}/> {exportingAudio?'WORKING…':'DAW PACK ZIP'}</button><input ref={fileRef} type="file" hidden accept=".json,.phiano.json" onChange={importProject}/><input ref={midiRef} type="file" hidden accept=".mid,.midi,audio/midi" onChange={importMidiFile}/></div></div>
          <div className="import-links"><button className="import-link" onClick={()=>fileRef.current?.click()}><Icon name="upload" size={15}/> IMPORT PROJECT JSON</button><button className="import-link" onClick={()=>midiRef.current?.click()}><Icon name="upload" size={15}/> IMPORT MIDI</button></div><div className="wav-note">WAV and stems preserve the chosen A4 reference; non-440 MIDI uses channel pitch bend (verify DAW support). WAV and stems include local WAV/SFZ/SF2 samples, synth voices, mixer and FX. Online GM SoundFonts remain audition-only. Six-stem and DAW Pack exports require songs under 2 minutes.</div>{exportProgress&&<div role="status" className="export-progress">{exportProgress}</div>}
        </section>

        <aside className="mixer-sidebar"><div className="panel-heading"><span className="panel-number">04</span><h2>GROOVE & MIXER</h2><Icon name="headphones" size={18}/></div>
          <div className="groove-content"><div className="mini-header">GROOVE ENGINE <span>◈</span></div>
            <Slider label="SWING" value={settings.swing} onChange={v=>setField('swing',v)} suffix="%"/>
            <Slider label="HUMANIZE" value={settings.humanize} onChange={v=>setField('humanize',v)} suffix="%"/>
            <Slider label="COMPLEXITY" value={settings.complexity} onChange={v=>setField('complexity',v)} suffix="%"/>
            <Slider label="NOTE DENSITY" value={settings.density} onChange={v=>setField('density',v)} suffix="%"/>
            <div className="groove-note">Swing + humanize affect MIDI export immediately and take effect on the next playback. Complexity + density apply on generation.</div>
          </div>
          <div className="mixer-content"><div className="mini-header">CHANNEL MIXER <span>{activeCount}/6 ACTIVE</span></div>{TRACKS.map(t=>{
            const lane=mixer[t.id]||initialMixer[t.id];
            return <div className="mixer-channel" key={t.id} style={{'--accent':t.color}}><div className="channel-top"><span className="channel-led"/><strong>{t.short}</strong><div className="channel-buttons"><button aria-label={`Mute ${t.name}`} className={lane.mute?'engaged':''} onClick={()=>updateMixer(t.id,'mute',!lane.mute)}>M</button><button aria-label={`Solo ${t.name}`} className={lane.solo?'engaged solo':''} onClick={()=>updateMixer(t.id,'solo',!lane.solo)}>S</button></div></div><div className="fader-line"><span>VOL</span><input aria-label={`${t.name} volume`} type="range" min="0" max="1.5" step="0.01" value={lane.volume} onChange={e=>updateMixer(t.id,'volume',Number(e.target.value))}/><span>{Math.round(lane.volume*100)}%</span></div><div className="fader-line pan-line"><span>PAN</span><input aria-label={`${t.name} pan`} type="range" min="-1" max="1" step="0.05" value={lane.pan} onChange={e=>updateMixer(t.id,'pan',Number(e.target.value))}/><span>{lane.pan===0?'C':lane.pan<0?`L${Math.round(-lane.pan*100)}`:`R${Math.round(lane.pan*100)}`}</span></div><SoundLabChannel track={t} lane={lane} onChange={(field,value)=>updateMixer(t.id,field,value)}
              bank={localBankInfo[t.id]} bankBusy={bankBusy===t.id}
              onLoadBank={loadBank} onPresetChange={changePreset}/></div>;
          })}
            <div className="master-fader"><Slider label="MASTER OUTPUT" value={Math.round(master*100)} onChange={v=>setMaster(v/100)} suffix="%"/></div>
          </div>
          <div className="soundfont-block"><div><span className="sf-icon">▧</span><strong>SOUNDFONT PLAYER</strong></div><p>Instant built-in synth, or load sampled GM instrument patches when online.</p><button onClick={loadFonts} disabled={soundfontStatus.startsWith('Loading')}>LOAD GM SOUNDFONTS</button><small>{soundfontStatus}</small></div>
        </aside>
      </div>
      <footer className="site-footer"><span>Φ369 LABS / PHIANOSHEETS v0.5</span><span>BUILT FOR MUSIC MAKERS, NOT GATEKEEPERS.</span><span>OPEN SOURCE · MIT LICENSE</span></footer>
    </main>
  </div>;
}
export default App;
