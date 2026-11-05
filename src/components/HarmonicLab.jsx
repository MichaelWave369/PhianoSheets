import React, { useEffect, useRef, useState } from 'react';
import { A4_MAX, A4_MIN, a4Cents, createBlindTrial, intervalCentsDifference,
  midiFrequency, partialBeatRate, tunedFrequency } from '../music/tuning.js';
import './HarmonicLab.css';

const INTERVALS = [
  { steps: 3, name: 'Minor third', parts: [6, 5] },
  { steps: 4, name: 'Major third', parts: [5, 4] },
  { steps: 7, name: 'Perfect fifth', parts: [3, 2] },
  { steps: 9, name: 'Major sixth', parts: [5, 3] },
];
const PRESETS = [432, 435, 440, 443];
const decimal = n => Number(n).toFixed(2);
const trialCsv = results => [
  'trial,stimulus_a_hz,stimulus_b_hz,preference,preferred_reference_hz,stimulus,method',
  ...results.map((r, i) => [
    i + 1, r.a, r.b, r.choice, r.choice === 'same' ? '' : r[r.choice],
    'C-major triad', 'equal-temperament synthesized sine'
  ].join(','))
].join('\n') + '\n';

export default function HarmonicLab({ a4Hz = 440, onA4Change }) {
  const [interval, setInterval] = useState(4);
  const [temperament, setTemperament] = useState('equal');
  const [wave, setWave] = useState('sine');
  const [trial, setTrial] = useState(() => createBlindTrial());
  const [results, setResults] = useState([]);
  const [reveal, setReveal] = useState(false);
  const [audioError, setAudioError] = useState('');
  const context = useRef(null);
  useEffect(() => () => { if (context.current) void context.current.close(); }, []);

  const play = async (reference, mode = 'equal', notes = [60, 64, 67], tone = wave) => {
    try {
      setAudioError('');
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw Error('This browser does not support Web Audio.');
      if (!context.current) context.current = new Context();
      const ctx = context.current;
      await ctx.resume();
      const start = ctx.currentTime + .035;
      const duration = 1.35;
      for (const note of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = tone;
        osc.frequency.setValueAtTime(tunedFrequency(note, { a4Hz: reference,
          tonicMidi: 60, temperament: mode }), start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(.15 / notes.length, start + .04);
        gain.gain.setValueAtTime(.15 / notes.length, start + duration - .12);
        gain.gain.linearRampToValueAtTime(0, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
        osc.start(start);
        osc.stop(start + duration + .02);
      }
    } catch (e) { setAudioError(e.message || 'Unable to play test tones.'); }
  };
  const selected = INTERVALS.find(i => i.steps === interval) || INTERVALS[1];
  const low = midiFrequency(60, a4Hz);
  const equalUpper = tunedFrequency(60 + interval, { a4Hz, temperament: 'equal' });
  const justUpper = tunedFrequency(60 + interval, { a4Hz, temperament: 'just' });
  const upper = temperament === 'just' ? justUpper : equalUpper;
  const beat = partialBeatRate(low, upper, ...selected.parts);
  const choose = choice => {
    setResults(r => [...r, { ...trial, choice }]);
    setTrial(createBlindTrial());
  };
  const exportResults = () => {
    const blob = new Blob([trialCsv(results)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'phianosheets-blind-trials.csv';
    document.body.append(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const selected432 = results.filter(r => r.choice !== 'same' && r[r.choice] === 432).length;
  const selected440 = results.filter(r => r.choice !== 'same' && r[r.choice] === 440).length;
  return <section className="harmonic-lab" aria-label="Harmonic research lab">
    <div className="harmonic-head">
      <div><span className="panel-number">R4</span> <strong>PHI HARMONIC RESEARCH LAB</strong>
        <p>Question the reference. Measure the intervals. Listen before deciding.</p></div>
      <span className="harmonic-tag">LOCAL · EXPERIMENTAL</span>
    </div>
    <div className="harmonic-grid">
      <div className="harmonic-section">
        <h3>01 / REFERENCE PITCH</h3>
        <p>Set the A4 reference for the full composition, live synth, local samples and WAV stems.</p>
        <div className="harmonic-reference"><strong>{a4Hz} Hz</strong><span>{a4Cents(a4Hz).toFixed(2)} cents vs A440</span></div>
        <input aria-label="A4 tuning reference in Hz" type="range" min={A4_MIN} max={A4_MAX}
          step="1" value={a4Hz} onChange={e => onA4Change(Number(e.target.value))}/>
        <div className="harmonic-presets">{PRESETS.map(n =>
          <button type="button" key={n} className={a4Hz === n ? 'selected' : ''}
            aria-pressed={a4Hz === n} onClick={() => onA4Change(n)}>{n} Hz</button>)}</div>
        <button type="button" className="harmonic-play" onClick={() => play(a4Hz)}>▶ AUDITION CURRENT REFERENCE</button>
        <small>Drums remain percussion. Online GM SoundFonts fall back to the built-in synth outside 440 Hz; local sample banks follow the reference.</small>
      </div>
      <div className="harmonic-section">
        <h3>02 / HARMONIC STRUCTURE</h3>
        <p>Compare 12-tone equal temperament with tonic-anchored 5-limit just intonation.</p>
        <div className="harmonic-selects">
          <label>INTERVAL<select value={interval} onChange={e => setInterval(Number(e.target.value))}>
            {INTERVALS.map(i => <option value={i.steps} key={i.steps}>{i.name}</option>)}</select></label>
          <label>SYSTEM<select value={temperament} onChange={e => setTemperament(e.target.value)}>
            <option value="equal">12-TET</option><option value="just">Just intonation</option>
          </select></label>
          <label>VOICE<select value={wave} onChange={e => setWave(e.target.value)}>
            <option value="sine">Sine</option><option value="triangle">Triangle</option><option value="sawtooth">Sawtooth</option>
          </select></label>
        </div>
        <div className="harmonic-values">
          <span>Lower C4 <b>{decimal(low)} Hz</b></span>
          <span>Upper note <b>{decimal(upper)} Hz</b></span>
          <span>Just minus 12-TET <b>{intervalCentsDifference(interval).toFixed(2)} cents</b></span>
          <span>Selected partial beating <b>{decimal(beat)} Hz</b></span>
        </div>
        <div className="harmonic-comparison"><button onClick={() => play(a4Hz, 'equal', [60, 60 + interval])}>▶ PLAY 12-TET</button>
          <button onClick={() => play(a4Hz, 'just', [60, 60 + interval])}>▶ PLAY JUST</button></div>
        <small>Partial beating measures one aligned overtone pair, not overall consonance or a health effect.</small>
      </div>
      <div className="harmonic-section harmonic-blind">
        <h3>03 / BLINDED A/B LISTENING</h3>
        <p>Which sounds better to you? Compare matched 432 and 440 Hz C-major triads. Both are synthesized sine tones; their identity is hidden until you reveal results.</p>
        <div className="harmonic-comparison"><button onClick={() => play(trial.a, 'equal', [60, 64, 67], 'sine')}>▶ PLAY A</button>
          <button onClick={() => play(trial.b, 'equal', [60, 64, 67], 'sine')}>▶ PLAY B</button></div>
        <div className="harmonic-preferences">
          <button onClick={() => choose('a')}>PREFER A</button>
          <button onClick={() => choose('b')}>PREFER B</button>
          <button onClick={() => choose('same')}>NO DIFFERENCE</button>
        </div>
        <div className="harmonic-scores">
          <span>{results.length} trials recorded this session</span>
          {reveal && <strong>432: {selected432} · 440: {selected440} · no preference: {results.length - selected432 - selected440}</strong>}
        </div>
        <div className="harmonic-actions">
          <button onClick={() => setReveal(r => !r)} disabled={!results.length}>{reveal ? 'HIDE RESULTS' : 'REVEAL RESULTS'}</button>
          <button disabled={!results.length} onClick={exportResults}>EXPORT CSV</button>
          <button disabled={!results.length} onClick={() => { setResults([]); setTrial(createBlindTrial()); setReveal(false); }}>RESET</button>
        </div>
        <small>Personal preference demo, not a double-blind clinical trial. No identifiers or microphone data collected; results remain in this tab until exported.</small>
      </div>
    </div>
    {audioError && <p role="alert" className="harmonic-error">{audioError}</p>}
    <p className="harmonic-disclaimer">Reference pitch and temperament are separate variables. The full song currently uses 12-TET; just intonation is audition-only in this lab. Neither pitch is proven universally healthier. Keep listening levels comfortable.</p>
  </section>;
}
