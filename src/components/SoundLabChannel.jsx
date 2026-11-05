import React from 'react';
import { INSTRUMENTS } from '../music/audio.js';
const LABELS = {
  auto: 'AUTO / GM IF LOADED',
  local: 'LOCAL SAMPLE BANK',
  sine: 'SINE · SOFT',
  triangle: 'TRIANGLE · WARM',
  sawtooth: 'SAW · BRIGHT',
  square: 'SQUARE · RETRO',
  pluck: 'PLUCK · SHORT',
};
export default function SoundLabChannel({ track, lane, onChange, bank, bankBusy, onLoadBank, onPresetChange }) {
  const local=lane.instrument==='local';
  return <div className="soundlab-channel">
    {track.id !== 'drums' && <>
      <label className="soundlab-voice">
        VOICE
        <select aria-label={track.name + ' synth voice'} value={lane.instrument ?? 'auto'}
          onChange={e => onChange('instrument', e.target.value)}>
          {INSTRUMENTS.map(choice => <option key={choice} value={choice}>{LABELS[choice]}</option>)}
        </select>
      </label>
      <div className="local-sample-box">
        <div className="local-bank-status">{bank ? <span className="local-bank-ready">● {bank.name}</span> :
          <span>{local?'LOCAL BANK NEEDS RELOADING':'LOCAL WAV / SFZ / SF2'}</span>}</div>
        <label className="local-bank-picker">{bankBusy?'LOADING BANK…':'LOAD SAMPLE FILES'}
          <input type="file" hidden multiple accept=".wav,.sfz,.sf2" disabled={bankBusy}
            onChange={e=>{onLoadBank(track.id,Array.from(e.target.files||[]));e.target.value='';}}/>
        </label>
        <label className="local-bank-picker">SELECT SAMPLE FOLDER
          <input type="file" hidden multiple webkitdirectory="" disabled={bankBusy}
            onChange={e=>{onLoadBank(track.id,Array.from(e.target.files||[]));e.target.value='';}}/>
        </label>
        {bank?.presets?.length>1&&<label className="sf2-preset">SF2 PRESET
          <select aria-label={track.name+' SF2 preset'} value={bank.presetIndex??0}
            disabled={bankBusy} onChange={e=>onPresetChange(track.id,Number(e.target.value))}>
            {bank.presets.map(p=><option key={p.index} value={p.index}>{p.bank}:{p.program} · {p.name}</option>)}
          </select>
        </label>}
        <small>For SFZ, select the .sfz and its WAVs together or choose their folder. Files remain on this device.</small>
      </div>
    </>}
    <div className="soundlab-params">
      <label>FILTER <strong>{lane.filter ?? 100}%</strong>
        <input type="range" aria-label={track.name + ' low-pass filter'} min="0" max="100"
          value={lane.filter ?? 100} onChange={e => onChange('filter', Number(e.target.value))}/>
      </label>
      <label>DELAY <strong>{lane.delay ?? 0}%</strong>
        <input type="range" aria-label={track.name + ' delay send'} min="0" max="100"
          value={lane.delay ?? 0} onChange={e => onChange('delay', Number(e.target.value))}/>
      </label>
    </div>
  </div>;
}
