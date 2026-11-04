import Soundfont from 'soundfont-player';
import { TRACKS } from './generator.js';
import { scheduleSong } from './schedule.js';
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const midiFreq = pitch => 440 * Math.pow(2, (pitch - 69) / 12);
const WAV_MAX_SECONDS = 240;
const DEFAULT_WAVE = { bass:'sawtooth', chords:'triangle', melody:'sine', arp:'triangle', lead:'square' };
export const INSTRUMENTS = ['auto', 'sine', 'triangle', 'sawtooth', 'square', 'pluck'];

function assign(parameter, value, at, immediate = false) {
  if (immediate) parameter.setValueAtTime(value, at);
  else parameter.setTargetAtTime(value, at, .012);
}

/** Shared Web Audio synthesis graph for playback and offline bounce. */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.channels = {};
    this.sf = {};
    this.timer = null;
    this.active = new Set();
    this.song = null;
    this.events = [];
    this.cursor = 0;
    this.isPlaying = false;
    this.mixer = {};
    this.onProgress = () => {};
    this.noise = null;
  }

  setup(ctx) {
    this.ctx = ctx;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -15;
    compressor.ratio.value = 3;
    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(.67, ctx.currentTime);
    this.master.connect(compressor);
    compressor.connect(ctx.destination);

    this.delayNode = ctx.createDelay(1.5);
    this.delayNode.delayTime.setValueAtTime(.25, ctx.currentTime);
    const feedback = ctx.createGain();
    feedback.gain.value = .22;
    const wet = ctx.createGain();
    wet.gain.value = .28;
    this.delayNode.connect(feedback);
    feedback.connect(this.delayNode);
    this.delayNode.connect(wet);
    wet.connect(this.master);

    for (const track of TRACKS) {
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 20000;
      const pan = ctx.createStereoPanner();
      const send = ctx.createGain();
      send.gain.value = 0;
      gain.connect(filter);
      filter.connect(pan);
      pan.connect(this.master);
      pan.connect(send);
      send.connect(this.delayNode);
      this.channels[track.id] = { gain, filter, pan, send };
    }

    // Stable noise bed keeps drum coloration consistent between preview/bounce.
    const frames = Math.max(1, Math.floor(ctx.sampleRate * .7));
    this.noise = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 369;
    for (let i = 0; i < frames; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
  }

  async ensure() {
    if (!this.ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('Web Audio is not supported in this browser.');
      this.setup(new Context());
    }
    await this.ctx.resume();
  }

  setMixer(mixer = {}, immediate = false) {
    this.mixer = mixer;
    if (!this.ctx) return;
    const time = this.ctx.currentTime;
    const soloed = TRACKS.some(t => mixer[t.id]?.solo);
    for (const track of TRACKS) {
      const cfg = mixer[track.id] || {};
      const channel = this.channels[track.id];
      const active = !cfg.mute && (!soloed || cfg.solo);
      assign(channel.gain.gain, active ? clamp(cfg.volume ?? .77, 0, 1.5) : 0, time, immediate);
      assign(channel.pan.pan, clamp(cfg.pan ?? 0, -1, 1), time, immediate);
      const amount = clamp(cfg.filter ?? 100, 0, 100) / 100;
      assign(channel.filter.frequency, 250 * Math.pow(80, amount), time, immediate);
      assign(channel.send.gain, clamp(cfg.delay ?? 0, 0, 100) / 100 * .85, time, immediate);
    }
  }

  setMaster(value, immediate = false) {
    if (this.master && this.ctx)
      assign(this.master.gain, clamp(value, 0, 1), this.ctx.currentTime, immediate);
  }

  setTempo(bpm, immediate = false) {
    if (this.delayNode && this.ctx) {
      const eighthNote = 30 / clamp(bpm, 30, 300);
      assign(this.delayNode.delayTime, eighthNote, this.ctx.currentTime, immediate);
    }
  }

  async loadSoundfonts() {
    await this.ensure();
    let loaded = 0;
    const failures = [];
    for (const track of TRACKS.filter(t => t.soundfont)) {
      if (this.sf[track.id]) { loaded++; continue; }
      try {
        this.sf[track.id] = await Soundfont.instrument(this.ctx, track.soundfont, {
          soundfont: 'FluidR3_GM',
          destination: this.channels[track.id].gain,
        });
        loaded++;
      } catch { failures.push(track.name); }
    }
    return { loaded, failures };
  }

  async play(song, mixer, onProgress, loop = false) {
    this.stop();
    await this.ensure();
    this.song = song;
    this.loop = loop;
    this.onProgress = onProgress || (() => {});
    this.setMixer(mixer);
    const plan = scheduleSong(song);
    this.events = plan.events;
    this.songDuration = plan.duration;
    this.setTempo(plan.bpm);
    this.started = this.ctx.currentTime + .08;
    this.cursor = 0;
    this.isPlaying = true;
    this.timer = window.setInterval(() => this.pump(), 45);
    this.pump();
  }

  pump() {
    if (!this.isPlaying || !this.ctx || !this.song) return;
    const current = this.ctx.currentTime - this.started;
    const ahead = current + .19;
    while (this.cursor < this.events.length && this.events[this.cursor].time <= ahead) {
      const event = this.events[this.cursor++];
      if (event.time + event.duration >= current - .04)
        this.sound(event, Math.max(this.ctx.currentTime + .005, this.started + event.time));
    }
    this.onProgress(Math.max(0, Math.min(this.song.settings.bars - 1,
      Math.floor(current / (this.songDuration / this.song.settings.bars)))));
    if (current >= this.songDuration) {
      if (this.loop) { this.started += this.songDuration; this.cursor = 0; }
      else this.stop(true);
    }
  }

  source(node) {
    this.active.add(node);
    node.onended = () => this.active.delete(node);
    return node;
  }

  sound(event, when, allowSoundfont = true) {
    const { track, n, duration } = event;
    const volume = n.velocity / 127;
    if (track.id === 'drums') { this.drum(n.pitch, when, volume); return; }
    const choice = this.mixer[track.id]?.instrument || 'auto';
    if (allowSoundfont && choice === 'auto' && this.sf[track.id]) {
      try {
        const playing = this.sf[track.id].play(n.pitch, when, duration, { gain: volume * .75 });
        if (playing && typeof playing.stop === 'function') this.active.add(playing);
        return;
      } catch { /* Fall back to a built-in voice. */ }
    }
    this.synth(track.id, n.pitch, when, duration, volume, choice);
  }

  oscillator(type, freq, when, duration, volume, destination, filterFreq, pluck = false) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const attack = pluck ? .003 : .008;
    const tail = pluck ? .06 : .11;
    const length = pluck ? Math.min(duration, .35) : duration;
    const peak = clamp(volume * .26, .003, .4);
    gain.gain.setValueAtTime(.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + attack);
    if (!pluck) {
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001, peak * .6),
        when + Math.max(attack + .01, length * .65));
    }
    gain.gain.exponentialRampToValueAtTime(.0001, when + length + tail);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    this.source(osc);
    osc.start(when);
    osc.stop(when + length + tail + .025);
  }

  synth(id, pitch, when, duration, velocity, instrument = 'auto') {
    const pluck = instrument === 'pluck';
    const wave = INSTRUMENTS.includes(instrument) && instrument !== 'auto' && !pluck
      ? instrument : DEFAULT_WAVE[id] || 'sine';
    const cutoff = id === 'bass' ? 900 : id === 'lead' ? 2400 : 4300;
    this.oscillator(pluck ? 'triangle' : wave, midiFreq(pitch), when,
      Math.max(.08, Math.min(duration, 4)), velocity, this.channels[id].gain,
      pluck ? 2500 : cutoff, pluck);
  }

  drum(pitch, when, velocity) {
    const ctx = this.ctx, output = this.channels.drums.gain;
    if (pitch === 36) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(155, when);
      osc.frequency.exponentialRampToValueAtTime(42, when + .14);
      gain.gain.setValueAtTime(.001, when);
      gain.gain.exponentialRampToValueAtTime(clamp(velocity * .78, .01, 1), when + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, when + .37);
      osc.connect(gain); gain.connect(output);
      this.source(osc); osc.start(when); osc.stop(when + .39);
      return;
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noise;
    filter.type = pitch === 38 ? 'bandpass' : 'highpass';
    filter.frequency.value = pitch === 38 ? 1900 : 6500;
    const duration = pitch === 49 ? .58 : pitch === 46 ? .3 : pitch === 38 ? .17 : .075;
    gain.gain.setValueAtTime(clamp(velocity * (pitch === 38 ? .6 : .25), .01, .9), when);
    gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
    source.connect(filter); filter.connect(gain); gain.connect(output);
    this.source(source); source.start(when); source.stop(when + duration + .005);
  }

  stop(completed = false) {
    if (this.timer) { window.clearInterval(this.timer); this.timer = null; }
    this.isPlaying = false; this.cursor = 0;
    for (const node of this.active) { try { node.stop(); } catch { /* already ended */ } }
    this.active.clear();
    if (completed) this.onProgress?.(-1);
  }

  dispose() {
    this.stop();
    if (this.ctx && typeof this.ctx.close === 'function') void this.ctx.close();
    this.ctx = null;
  }
}

/** Offline bounce: same note timing, oscillator voices, mixer and FX as live preview.
 * Loaded network SoundFonts cannot be rendered in this first version; auto uses synth. */
export async function renderAudio(song, mixer = {}, master = .72) {
  const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineContext) throw new Error('Offline audio rendering is not supported in this browser.');
  const plan = scheduleSong(song);
  if (plan.duration > WAV_MAX_SECONDS)
    throw new Error('WAV export is limited to 4 minutes. Shorten the arrangement or raise its tempo.');
  const sampleRate = 44100;
  const frames = Math.ceil((plan.duration + 2.0) * sampleRate);
  const ctx = new OfflineContext(2, frames, sampleRate);
  const engine = new AudioEngine();
  engine.setup(ctx);
  engine.setMixer(mixer, true);
  engine.setMaster(master, true);
  engine.setTempo(plan.bpm, true);
  for (const event of plan.events) engine.sound(event, event.time + .08, false);
  return ctx.startRendering();
}
