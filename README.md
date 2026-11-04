# PhianoSheets 369

**Make something move.** A local-first, free and open-source one-click MIDI composition studio from Phi369 Labs.

PhianoSheets generates musical *arrangements* with sections, not just four-bar loops. Compose a song in the browser, audition all six lanes using the built-in Web Audio engine, shape groove and mix levels, edit notes, then export a **standard MIDI format 1** file for your favorite DAW.

## First playable release (v0.1)

- **One-click song generation:** Intro, Verse, Hook, Bridge, Final Hook, Outro, across 8/16/32/64 bars.
- **Eight styles:** Boom Bap, Lo-Fi, House, Synthwave, Trap, Funk, Ambient, Cinematic.
- **Six independent MIDI tracks:** Drums, Bass, Chords, Melody, Arpeggio, Lead.
- **Reproducible seeds:** Same settings + seed = same arrangement.
- **Musical controls:** 12 roots, five scale modes, tempo, swing, humanization, density, complexity.
- **Piano roll:** Inspect two bars at a time; click to add notes, click notes to remove them.
- **Audio preview:** Browser-native synth and drums, with mixer volume, pan, mute, solo, master gain and looping.
- **SoundFont sample playback:** Optional `soundfont-player` GM patches from FluidR3_GM. Click **Load GM SoundFonts** while online. Synth playback works without them. This version does **not** accept direct `.sf2` file uploads.
- **MIDI export:** Multi-track format 1, separate GM channels with channel 10 reserved for drums, tempo map, time signature, section markers, channel pan/volume, program changes, and groove-adjusted note timing.
- **Save/reopen:** Browser autosave via localStorage plus portable `.phiano.json` project export/import.
- **Live React app:** Vite + React, deployable to Netlify or GitHub Pages.

## Local development

Node 20.19+ / Node 22.12+ recommended.

```bash
npm install
npm run dev
npm run check
```

Open the dev URL. The first play requires a user gesture to start Web Audio. To build the deployable static site: `npm run build`; publish the resulting `dist/` folder.

## Netlify

The included `netlify.toml` sets `npm run build` and publish directory `dist`. Import this repository into Netlify for continuous deploys. **A passing CI run does not itself mean a live Netlify site has been deployed.**

## Architecture

```text
src/
  App.jsx                 React UI, arrangement, mixer, export/import
  components/PianoRoll.jsx MIDI note editing
  music/generator.js      deterministic song grammar and groove transform
  music/midi.js           MIDI format 1 binary writer (dependency-free)
  music/audio.js          Web Audio playback and optional SoundFont sampler
  style.css               responsive studio design
```

The generator and MIDI exporter are pure JavaScript, intentionally portable into a future desktop audio plugin. MIDI file export carries **per-channel instrument programs and mixer volume/pan**, but **does not bake mute/solo or render audio**. Imported GM-capable DAWs can choose their own sound sources.

## Development roadmap

- **Rung 1: Browser playable studio (this PR).** Full song generator, six tracks, piano roll, mixer, MIDI export, saved projects, online SoundFont preset loading, tests, live-ready React app.
- **Rung 2: Arrangement editor.** Drag/copy/paste section clips, per-track generation, chord progression editor, probability, Euclidean drums, step sequencer, fill button, music theory tools, Undo/Redo, MIDI import.
- **Rung 3: Advanced audio.** Local `.sf2`/`.sfz` support via a suitable licensed sampler engine, velocity layers, effects sends, audio export, better time-synchronized transport, playback metering and automation.
- **Rung 4: Native plugin output.** Reuse a portable composition core in a desktop **VST3/CLAP** plugin host shell (e.g. JUCE or iPlug2), MIDI output, host tempo/transport sync, parameter automation, plugin validation, installer/signing. Browser apps cannot themselves emit a VST3 binary; this requires separate native code and builds. AU can follow for macOS.
- **Rung 5: Phi ecosystem integrations.** MoreBounceLabs Writer's Room, PhiOS audio workflows, MIDI pattern libraries and cross-app project handoff.

## Safety and licensing

MIT project code. The optional third-party SoundFont library and sample patch data have their own licenses. Verify and honor those licenses before bundling sample assets for distribution; patches are loaded remotely by default and are not committed here.

Built to help creators turn ideas into something they can actually finish.
