/** Portable DAW handoff with original MIDI, project, and six aligned WAV stems. */
import { TRACKS } from './generator.js';
import { buildMidi } from './midi.js';

const encoder = new TextEncoder();
const PCM_SAMPLE_RATE = 44100;
const encode = text => encoder.encode(text);

export function inspectStemWav(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 44)
    throw new Error('Stem must be a PCM WAV byte array');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (pos,n)=>String.fromCharCode(...bytes.slice(pos,pos+n));
  if (ascii(0,4)!=='RIFF'||ascii(8,4)!=='WAVE'||ascii(12,4)!=='fmt '||ascii(36,4)!=='data')
    throw new Error('Stem must be a canonical WAV RIFF file');
  if (view.getUint32(16,true)!==16||view.getUint16(20,true)!==1 ||
      view.getUint16(22,true)!==2||view.getUint32(24,true)!==PCM_SAMPLE_RATE ||
      view.getUint16(34,true)!==16)
    throw new Error('Stem WAV must be 44.1 kHz stereo 16-bit PCM');
  const dataSize=view.getUint32(40,true);
  if (dataSize !== bytes.byteLength-44 || dataSize%4)
    throw new Error('Invalid WAV PCM size');
  return { frames:dataSize/4, sampleRate:PCM_SAMPLE_RATE, channels:2 };
}

function validateStems(stems) {
  if (!Array.isArray(stems)||stems.length!==TRACKS.length)
    throw new Error('Production Pack needs all six stems');
  const byId = new Map();
  for (const stem of stems) {
    if (!TRACKS.some(t=>t.id===stem.id)||byId.has(stem.id))
      throw new Error('Production Pack has an unknown or duplicate stem');
    const header=inspectStemWav(stem.bytes);
    byId.set(stem.id,{...stem,header});
  }
  const frames=byId.get(TRACKS[0].id)?.header.frames;
  for (const track of TRACKS) {
    const entry=byId.get(track.id);
    if (!entry||entry.header.frames!==frames)
      throw new Error('Stem files do not have matching timeline lengths');
  }
  return { byId, frames };
}

export function createPackManifest(song, mixer, master, frames) {
  const settings=song.settings||{};
  const bpm=Number(settings.bpm)||92, bars=Number(settings.bars)||8;
  return {
    schema:'phianosheets.production-pack.v1',
    title:settings.title||'Untitled',tempoBpm:bpm,timeSignature:[4,4],bars,
    root:settings.root||'C',scale:settings.scale||'minor',
    seed:Number(settings.seed)||369,
    notes:Object.values(song.tracks||{}).reduce((sum,lane)=>sum+lane.length,0),
    stemAudio:{format:'WAV',sampleRate:PCM_SAMPLE_RATE,channels:2,bitDepth:16,
      frames,framesStartAt:0,tailSeconds:2},
    midi:{format:1,ppq:480,file:'arrangement.mid',
      note:'Standard multitrack MIDI. Drums use channel 10 (1-based).'},
    tracks:TRACKS.map((track,index)=>{
      const config=mixer?.[track.id]||{};
      return {
        id:track.id,name:track.name,
        midiChannel:index===0?10:index,
        midiProgram:track.id==='drums'?null:track.program,
        stemFile:track.id+'.wav',noteCount:song.tracks[track.id]?.length||0,
        voice:config.instrument||'auto',volume:config.volume??.78,
        pan:config.pan??0,filter:config.filter??100,delay:config.delay??0
      };
    }),
    masterLevel:master,projectFile:'project.phiano.json',
    sampleDisclaimer:'Local sample files are not embedded; reload banks after reopening. Online GM SoundFonts are audition-only and are not included in stem rendering.'
  };
}

export function buildProductionPackEntries({song,mixer={},master=.72,stems}) {
  if (!song?.settings||!song?.tracks||!Array.isArray(song.sections))
    throw new Error('Invalid PhianoSheets song');
  const {byId,frames}=validateStems(stems);
  const project={version:4,settings:song.settings,song,mixer,master};
  const manifest=createPackManifest(song,mixer,master,frames);
  const guide=[
    'PHIANOSHEETS 369 | DAW PRODUCTION PACK',
    '====================================',
    'Project: '+manifest.title,
    'BPM: '+manifest.tempoBpm+' | 4/4 | '+manifest.bars+' bars',
    '',
    'FILES',
    'arrangement.mid: Original multitrack MIDI, with tempo and section markers.',
    'drums.wav, bass.wav, chords.wav, melody.wav, arp.wav, lead.wav: aligned stems.',
    'project.phiano.json: Editable PhianoSheets session.',
    'manifest.json: Track list and audio alignment metadata.',
    '',
    'FL STUDIO IMPORT',
    '1. Extract this ZIP to a folder.',
    '2. Set the project tempo to '+manifest.tempoBpm+' BPM in 4/4.',
    '3. Drag all six WAV files to bar 1 / time zero, on separate audio tracks.',
    '4. Alternatively import arrangement.mid to edit notes and instrument choices.',
    '5. Avoid double-playing MIDI instruments and the WAV stems.',
    '',
    'All stems start at zero and contain exactly '+frames+' audio frames.',
    'A two-second audio effect tail is included.',
    'Mute/solo audition state is overridden so every stem is included.',
    'Each stem has independent compression; summed stems may differ from the mix.',
    'Online GM SoundFonts cannot be baked into stems. Local banks can.',
    'Sample files are not bundled; use only banks you have rights to use.',
    ''
  ].join('\n');
  return [
    {name:'arrangement.mid',bytes:buildMidi(song,mixer)},
    {name:'project.phiano.json',bytes:encode(JSON.stringify(project,null,2)+'\n')},
    {name:'manifest.json',bytes:encode(JSON.stringify(manifest,null,2)+'\n')},
    {name:'README.txt',bytes:encode(guide)},
    ...TRACKS.map(track=>({name:track.id+'.wav',bytes:byId.get(track.id).bytes})),
  ];
}
