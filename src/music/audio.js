import Soundfont from 'soundfont-player';
import { grooveNote, TRACKS, PPQ } from './generator.js';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const midiFreq=p=>440*Math.pow(2,(p-69)/12);

/** Browser-native playable engine, with optional network-loaded SoundFont patches. */
export class AudioEngine {
  constructor() {
    this.ctx=null;this.master=null;this.channels={};this.sf={};this.timer=null;
    this.active=[];this.song=null;this.started=0;this.cursor=0;this.events=[];
    this.loop=false;this.onProgress=()=>{};this.isPlaying=false;this.mixer={};this.noise=null;
  }
  async ensure() {
    if (!this.ctx) {
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)throw new Error('Web Audio is not supported in this browser.');
      this.ctx=new Ctx();
      const compressor=this.ctx.createDynamicsCompressor();
      compressor.threshold.value=-15;compressor.ratio.value=3;
      this.master=this.ctx.createGain();this.master.gain.value=.67;
      this.master.connect(compressor);compressor.connect(this.ctx.destination);
      for(const t of TRACKS){
        const gain=this.ctx.createGain();const pan=this.ctx.createStereoPanner();
        gain.connect(pan);pan.connect(this.master);
        this.channels[t.id]={gain,pan};
      }
      const size=Math.floor(this.ctx.sampleRate*.7);
      this.noise=this.ctx.createBuffer(1,size,this.ctx.sampleRate);
      const data=this.noise.getChannelData(0);
      for(let i=0;i<size;i++)data[i]=Math.random()*2-1;
    }
    await this.ctx.resume();
  }
  setMixer(mixer={}) {
    this.mixer=mixer;
    if(!this.ctx)return;
    const soloed=TRACKS.some(t=>mixer[t.id]?.solo);
    for(const t of TRACKS){
      const cfg=mixer[t.id]||{};
      const active=!cfg.mute&&(!soloed||cfg.solo);
      this.channels[t.id].gain.gain.setTargetAtTime(active ? clamp(cfg.volume??.77,0,1.5):0,this.ctx.currentTime,.01);
      this.channels[t.id].pan.pan.setTargetAtTime(clamp(cfg.pan??0,-1,1),this.ctx.currentTime,.01);
    }
  }
  setMaster(value){if(this.master&&this.ctx)this.master.gain.setTargetAtTime(clamp(value,0,1),this.ctx.currentTime,.02);}
  async loadSoundfonts() {
    await this.ensure();
    let loaded=0;
    const failures=[];
    for(const t of TRACKS.filter(t=>t.soundfont)) {
      if(this.sf[t.id]){loaded++;continue;}
      try{
        this.sf[t.id]=await Soundfont.instrument(this.ctx,t.soundfont,{
          soundfont:'FluidR3_GM',destination:this.channels[t.id].gain,
        });
        loaded++;
      }catch(e){failures.push(t.name);}
    }
    return {loaded,failures};
  }
  async play(song,mixer,onProgress,loop=false) {
    this.stop();
    await this.ensure();
    this.song=song;this.loop=loop;this.onProgress=onProgress||(()=>{});this.setMixer(mixer);
    const secondsPerTick=60/clamp(song.settings.bpm,30,300)/PPQ;
    this.songDuration=song.settings.bars*4*PPQ*secondsPerTick;
    this.events=[];
    TRACKS.forEach((track,i)=>{
      for(const n of song.tracks[track.id]||[]){
        const g=grooveNote(n,song.settings,i);
        this.events.push({track,n:g,time:g.tick*secondsPerTick,duration:g.durationTicks*secondsPerTick});
      }
    });
    this.events.sort((a,b)=>a.time-b.time);
    this.started=this.ctx.currentTime+.08;this.cursor=0;this.isPlaying=true;
    this.timer=window.setInterval(()=>this.pump(),45);
    this.pump();
  }
  pump() {
    if(!this.isPlaying||!this.ctx||!this.song)return;
    const t=this.ctx.currentTime-this.started;
    const ahead=t+.19;
    while(this.cursor<this.events.length && this.events[this.cursor].time <= ahead){
      const event=this.events[this.cursor++];
      if(event.time+event.duration >=t-.04)this.sound(event,Math.max(this.ctx.currentTime+.005,this.started+event.time));
    }
    this.onProgress(clamp(Math.floor(t/(this.songDuration/this.song.settings.bars)),0,this.song.settings.bars-1));
    if(t>=this.songDuration){
      if(this.loop){this.started+=this.songDuration;this.cursor=0;}
      else this.stop(true);
    }
  }
  sound(event,when) {
    const {track,n,duration}=event;
    if(track.id==='drums')this.drum(n.pitch,when,n.velocity/127);
    else if(this.sf[track.id]){
      try{this.sf[track.id].play(n.pitch,when,duration,{gain:n.velocity/127*.75});}
      catch{this.synth(track.id,n.pitch,when,duration,n.velocity/127);}
    } else this.synth(track.id,n.pitch,when,duration,n.velocity/127);
  }
  oscillator(type,freq,when,duration,velocity,destination,filterFreq) {
    const ctx=this.ctx;
    const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
    osc.type=type;osc.frequency.setValueAtTime(freq,when);
    filter.type='lowpass';filter.frequency.value=filterFreq;
    const attack=.008,release=.11,peak=clamp(velocity*.26,.003,.4);
    gain.gain.setValueAtTime(.0001,when);
    gain.gain.exponentialRampToValueAtTime(peak,when+attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001,peak*.6),when+Math.max(attack+.01,duration*.65));
    gain.gain.exponentialRampToValueAtTime(.0001,when+duration+release);
    osc.connect(filter);filter.connect(gain);gain.connect(destination);
    osc.start(when);osc.stop(when+duration+release+.025);this.active.push(osc);
  }
  synth(id,pitch,when,duration,velocity){
    const wave=id==='bass'?'sawtooth':id==='lead'?'square':id==='arp'?'triangle':id==='chords'?'triangle':'sine';
    const freq=midiFreq(pitch);
    this.oscillator(wave,freq,when,clamp(duration,.08,4),velocity,this.channels[id].gain,id==='bass'?900:id==='lead'?2400:4300);
  }
  drum(pitch,when,velocity){
    const ctx=this.ctx, output=this.channels.drums.gain;
    if(pitch===36){
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type='sine';osc.frequency.setValueAtTime(155,when);osc.frequency.exponentialRampToValueAtTime(42,when+.14);
      gain.gain.setValueAtTime(.001,when);gain.gain.exponentialRampToValueAtTime(clamp(velocity*.78,.01,1),when+.008);
      gain.gain.exponentialRampToValueAtTime(.0001,when+.37);
      osc.connect(gain);gain.connect(output);osc.start(when);osc.stop(when+.39);this.active.push(osc);return;
    }
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=this.noise;filter.type=pitch===38?'bandpass':'highpass';
    filter.frequency.value=pitch===38?1900:6500;
    const duration=pitch===49?.58:pitch===46?.3:pitch===38?.17:.075;
    gain.gain.setValueAtTime(clamp(velocity*(pitch===38?.6:.25),.01,.9),when);
    gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
    source.connect(filter);filter.connect(gain);gain.connect(output);
    source.start(when);source.stop(when+duration+.005);this.active.push(source);
  }
  stop(completed=false){
    if(this.timer){window.clearInterval(this.timer);this.timer=null;}
    this.isPlaying=false;this.cursor=0;
    for(const node of this.active){try{node.stop();}catch{/* already ended */}}
    this.active=[];
    if(completed)this.onProgress?.(-1);
  }
  dispose(){this.stop();if(this.ctx){void this.ctx.close();this.ctx=null;}}
}
