import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderAudio } from '../music/audio.js';
import { TRACKS } from '../music/generator.js';
import { A4_MIN, A4_MAX } from '../music/tuning.js';
import { makeComparisonPlan, randomizePair, validateReferencePair, withReference,
  levelMatchGains, sourceFingerprint, tallyVotes, exportTrialsCsv } from '../music/experiment.js';
import './ArrangementTrials.css';

const PRESETS = [432, 435, 440, 443];
const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2,'0');
const slug = s => (String(s || 'phianosheets').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'phianosheets');
function download(text, filename) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

export default function ArrangementTrials({ song, mixer, master, sampleBanks = {},
  bankRevision, stopPlayback }) {
  const [first, setFirst] = useState(432);
  const [second, setSecond] = useState(440);
  const [mode, setMode] = useState('auto');
  const [startBar, setStartBar] = useState(0);
  const [prepared, setPrepared] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [trial, setTrial] = useState(()=>randomizePair(432,440));
  const [votes, setVotes] = useState([]);
  const [playCounts, setPlayCounts] = useState({ a: 0, b: 0 });
  const [ended, setEnded] = useState(false);
  const [playing, setPlaying] = useState('');
  const ctxRef = useRef(null);
  const nodeRef = useRef(null);
  const epochRef = useRef(0);

  const plan = useMemo(()=>makeComparisonPlan(song,{mode,startBar}),[song,mode,startBar]);
  const fingerprint = useMemo(()=>sourceFingerprint(song,mixer,master),[song,mixer,master]);
  const stopSource = () => {
    const source = nodeRef.current;
    nodeRef.current = null;
    if (source) { try { source.stop(); } catch { /* Already stopped. */ } }
    setPlaying('');
  };
  useEffect(()=>{
    epochRef.current++;
    const source = nodeRef.current;
    nodeRef.current = null;
    if (source) { try { source.stop(); } catch { /* Already stopped. */ } }
    setPlaying(''); setPrepared(null); setBusy(''); setError('');
    setTrial(first !== second ? randomizePair(first,second) : {aHz:first,bHz:second});
    setVotes([]); setPlayCounts({ a:0,b:0 }); setEnded(false);
  },[song,mixer,master,bankRevision,first,second,mode,startBar]);
  useEffect(()=>()=> {
    epochRef.current++;
    if (nodeRef.current) { try { nodeRef.current.stop(); } catch { /* Already stopped. */ } }
    if (ctxRef.current) void ctxRef.current.close();
  },[]);

  const prepare = async () => {
    if (busy) return;
    const version = ++epochRef.current;
    stopSource();
    setPrepared(null); setError('');
    try {
      validateReferencePair(first,second);
      const missing = TRACKS.filter(t => mixer[t.id]?.instrument === 'local' &&
        !sampleBanks[t.id]).map(t => t.short);
      if (missing.length) throw new Error('Reload the local sample banks for '+missing.join(', ')+' first.');
      stopPlayback?.();
      setBusy('Rendering first reference…');
      const bufferFirst = await renderAudio(withReference(plan.song,first),mixer,master,{sampleBanks});
      if (version !== epochRef.current) return;
      setBusy('Rendering second reference…');
      const bufferSecond = await renderAudio(withReference(plan.song,second),mixer,master,{sampleBanks});
      if (version !== epochRef.current) return;
      const matched = levelMatchGains(bufferFirst, bufferSecond);
      if (matched.rmsFirst <= 0 || matched.rmsSecond <= 0)
        throw new Error('One or both renders are silent. Check the mixer and note lanes.');
      setPrepared({ bufferFirst, bufferSecond, matched, fingerprint, plan });
      setTrial(randomizePair(first,second));
      setVotes([]); setPlayCounts({a:0,b:0}); setEnded(false);
    } catch(e) {
      if (version === epochRef.current) setError(e.message || 'Unable to render both conditions.');
    } finally { if (version === epochRef.current) setBusy(''); }
  };
  const audition = async label => {
    if (!prepared || busy || ended) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw Error('Web Audio is unavailable in this browser.');
      if (!ctxRef.current) ctxRef.current = new Context();
      await ctxRef.current.resume();
      stopSource();
      const ctx = ctxRef.current, hz = label === 'a' ? trial.aHz : trial.bHz;
      const isFirst = hz === first;
      const source = ctx.createBufferSource(), gain = ctx.createGain();
      source.buffer = isFirst ? prepared.bufferFirst : prepared.bufferSecond;
      gain.gain.value = isFirst ? prepared.matched.first : prepared.matched.second;
      source.connect(gain); gain.connect(ctx.destination);
      source.onended = () => {
        source.disconnect(); gain.disconnect();
        if(nodeRef.current === source){ nodeRef.current = null; setPlaying(''); }
      };
      nodeRef.current = source; source.start();
      setPlaying(label); setPlayCounts(p=>({...p,[label]:p[label]+1}));
    } catch(e){setError(e.message || 'Could not play comparison render.');}
  };
  const choose = choice => {
    if (!prepared || ended || playCounts.a < 1 || playCounts.b < 1) return;
    stopSource();
    setVotes(v=>[...v,{...trial,choice,playsA:playCounts.a,playsB:playCounts.b}]);
    setTrial(randomizePair(first,second));
    setPlayCounts({a:0,b:0});
  };
  const exportCsv = () => {
    if (!prepared || !votes.length) return;
    const {scope,startBar,bars,noteCount} = prepared.plan;
    download(exportTrialsCsv(votes,{
      first, second, scope, startBar, bars, noteCount,
      fingerprint:prepared.fingerprint,
      title:song.settings.title, bpm:song.settings.bpm,
      swing:song.settings.swing, humanize:song.settings.humanize,
    }), slug(song.settings.title)+'-tuning-trials.csv');
  };
  const summary = tallyVotes(votes,first,second);
  const canVote = !!prepared && !ended && playCounts.a > 0 && playCounts.b > 0;
  const autoExcerpt = plan.scope==='excerpt' && mode==='auto';
  return <section className="arrangement-trials" aria-label="Controlled arrangement listening chamber">
    <div className="trial-heading">
      <div><span className="panel-number">R5</span> <strong>THE CONTROLLED LISTENING CHAMBER</strong>
        <p>One composition. Two references. Same notes, tempo, groove, mixer and sound source.</p></div>
      <span className="trial-pill">A/B · LOCAL-ONLY</span>
    </div>
    <div className="trial-body">
      <div className="trial-settings">
        <h3>01 / EXPERIMENT CONDITIONS</h3>
        <div className="trial-form">
          <label>REFERENCE 1
            <select aria-label="First reference frequency" value={first} onChange={e=>setFirst(Number(e.target.value))}>
              {PRESETS.map(n=><option value={n} key={n}>{n} Hz</option>)}</select></label>
          <label>REFERENCE 2
            <select aria-label="Second reference frequency" value={second} onChange={e=>setSecond(Number(e.target.value))}>
              {PRESETS.map(n=><option value={n} key={n}>{n} Hz</option>)}</select></label>
          <label>COMPARISON SCOPE
            <select aria-label="Comparison scope" value={mode} onChange={e=>setMode(e.target.value)}>
              <option value="auto">Full song (up to 2 min)</option>
              <option value="excerpt">Eight-bar excerpt</option>
            </select></label>
          {plan.scope==='excerpt' && <label>EXCERPT START BAR
            <input type="number" min="1" max={Math.max(1,plan.totalBars-plan.bars+1)}
              value={plan.startBar+1} onChange={e=>setStartBar(Math.max(0,Number(e.target.value)-1||0))}/></label>}
        </div>
        <div className="trial-facts">
          <span><b>{plan.scope==='full'?'Full arrangement':'Matched excerpt'}</b></span>
          <span>{plan.scope==='full'?plan.bars+' bars': 'Bars '+(plan.startBar+1)+'–'+(plan.startBar+plan.bars)}</span>
          <span>{fmt(plan.seconds)} audio (+2s tail)</span>
          <span>{plan.noteCount} unchanged MIDI notes</span>
          <span>Signature {fingerprint}</span>
        </div>
        {autoExcerpt && <p className="trial-notice">Song is over 2 minutes: automatically using the same eight-bar excerpt in both versions to protect browser memory.</p>}
        <button className="trial-primary" disabled={!!busy || first===second} onClick={prepare}>{busy || (prepared?'RE-RENDER CONDITIONS':'RENDER BOTH CONDITIONS')}</button>
        <p className="trial-fine">Renders are synthesized locally through the existing offline export engine, including loaded sample banks. Online GM SoundFonts use the built-in synth on offline render. Differences in equal PCM RMS are attenuated to the quieter render, not perceptually loudness-calibrated.</p>
      </div>
      <div className="trial-session">
        <h3>02 / BLINDED LISTENING</h3>
        <p className="trial-fine">A/B mapping is shuffled after every vote. Both audio examples must be played before choosing. Change your setup before rendering, not during the trial.</p>
        <div className="trial-buttons">
          <button disabled={!prepared || !!busy || ended} onClick={()=>audition('a')} className={playing==='a'?'active':''}>▶ PLAY A <small>{playCounts.a} listens</small></button>
          <button disabled={!prepared || !!busy || ended} onClick={()=>audition('b')} className={playing==='b'?'active':''}>▶ PLAY B <small>{playCounts.b} listens</small></button>
        </div>
        <button className="trial-stop" disabled={!playing} onClick={stopSource}>■ STOP AUDIO</button>
        <div className="trial-votes"><button disabled={!canVote} onClick={()=>choose('a')}>PREFER A</button><button disabled={!canVote} onClick={()=>choose('b')}>PREFER B</button><button disabled={!canVote} onClick={()=>choose('same')}>NO PREFERENCE</button></div>
        <div className="trial-counter">{prepared ? 'Trial '+(votes.length+1) : 'Render both conditions to begin'} · {votes.length} responses recorded</div>
        {ended && <div className="trial-results"><strong>SESSION RESULTS</strong>
          <span>{first} Hz: {summary.first} votes</span><span>{second} Hz: {summary.second} votes</span>
          <span>No preference: {summary.same}</span>
          <small>Descriptive counts only. These cannot establish a universal optimum.</small></div>}
        <div className="trial-actions">
          <button disabled={!votes.length || ended} onClick={()=>{stopSource();setEnded(true);}}>REVEAL & END SESSION</button>
          <button disabled={!votes.length} onClick={exportCsv}>EXPORT CSV</button>
          <button disabled={!prepared} onClick={()=>{stopSource();setVotes([]);setTrial(randomizePair(first,second));setPlayCounts({a:0,b:0});setEnded(false);}}>NEW SESSION</button>
        </div>
        {error && <p role="alert" className="trial-error">{error}</p>}
      </div>
    </div>
    <p className="trial-footer">Research instrument, not a clinical test. Hardware, playback volume, listener expectation and hearing conditions can influence results. This chamber does not record microphone, identity or biometrics; session results are in memory until you export. References: {A4_MIN}–{A4_MAX} Hz supported in the tuning engine.</p>
  </section>;
}
