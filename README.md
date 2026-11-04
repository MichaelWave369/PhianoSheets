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

## Rung 2: Composition Workbench (v0.2)

The new composition workbench extends the **same** six-track engine and MIDI export workflow tested with FL Studio:

- **Regenerate one track:** choose any arrangement lane, regenerate just that part; the other five lanes and original seed remain unchanged. Subsequent clicks produce new variations.
- **Chord Lab:** edit any of four scale-degree slots. Bass, chords and arpeggio accompaniment are reharmonized; drums, melody and lead are deliberately preserved. These accompaniment tracks are regenerated, so save a project first if you have hand-edited them.
- **Sections:** move Intro/Verse/Hook/Bridge/etc. left or right, taking note clips with them. Notes crossing an old section boundary are clipped to stay within their section.
- **Clip copy/paste:** select a track and bar, copy up to two bars, then paste into the same or another track at a selected destination bar (replaces destination notes in that span).
- **16-step drum machine:** Kick, Snare, Closed Hat, Open Hat, Crash. Toggle hits in the current bar, set step velocity, add deterministic fills, or generate Euclidean rhythms with pulse count and rotation for one drum voice.
- **Better piano roll:** click to add/select notes; drag to move, drag right edge to resize; keyboard-accessible step/length editing and Delete.
- **40-step undo/redo:** song-changing operations are reversible, including section swaps, chord rewrites, generated variations and piano-roll edits. Buttons and Ctrl/Cmd+Z / Shift+Z are provided; text fields retain native undo.
- **MIDI import:** standard MIDI type 0/1 with PPQ timing, note on/off and note velocities. This is a **16th-note quantized import**, up to **64 bars**, mapping PhianoSheets-named parts (or fallback MIDI channels) to the six lanes. Unrecognized DAW controller automation, exotic messages, arbitrary channel mappings and high-resolution microtiming are *not* preserved. Imported files reset swing and humanization to avoid double-applying timing. Store a portable `.phiano.json` for full project fidelity.

Browser project autosave and portable JSON import/export remain compatible with v0.1 projects, and MIDI still exports as the same format 1 multitrack file. This release does not add VST3 or local SF2 support.

## Local development

Node 20.19+ / Node 22.12+ recommended.

```bash
npm install
npm run dev
npm run check
```

Open the dev URL. The first play requires a user gesture to start Web Audio. To build the deployable static site: `npm run build`; publish the resulting `dist/` folder.

## GitHub Pages (first public testing stage)

**Target URL:** https://michaelwave369.github.io/PhianoSheets/

1. In the GitHub repository, select **Settings → Pages → Build and deployment → Source: GitHub Actions**. This one-time repository setting cannot be performed by the ordinary workflow token. The site URL is not considered live until a successful deployment and an HTTP check.
2. Merge the Pages deployment PR to `main`. `.github/workflows/pages.yml` will test, build, check output paths and upload `dist/` using the official Pages actions. Every later push to `main` automatically redeploys the site.
3. In **Actions → Deploy PhianoSheets to GitHub Pages**, inspect **Publish site** and **Verify public page and assets**. If the Pages setting was enabled after the first run failed, use **Run workflow** to redeploy.
4. Open the URL above with the browser cache disabled. Verify six tracks are visible, Generate Song works, Play/Stop/Loop produce audible playback, piano-roll edits persist, mixer mute/solo controls affect auditioning, and MIDI + JSON exports download. Check mobile viewport and network-offline fallback synthesis too.

To reproduce the production Pages build locally:

```bash
npm install
npm run check:pages
npm run preview -- --mode pages
```

For local preview, Vite serves this Pages build under `/PhianoSheets/`; navigate there. `npm run build` remains root-based for local and future Netlify hosting. CI runs both build modes so future changes cannot silently break one.

> **Deployment boundary:** PhianoSheets is a static client-side app. No API keys, server, or paid services are needed for the built-in synthesizer. The optional SoundFont patches load remotely when requested and require internet access.

### GitHub Pages retry troubleshooting

If **Publish site** fails after the build and upload succeed:

- **`Current status: updating_pages` followed by a timeout:** GitHub accepted the artifact but its Pages backend did not finish publishing in time. This is not a Vite compilation failure. Check the repository's Pages configuration and GitHub's service status.
- **`Multiple artifacts named "github-pages"`:** Re-running an older workflow run can accumulate artifacts with the same name. Never retry the old run indefinitely. Use **Actions → Deploy PhianoSheets to GitHub Pages → Run workflow → main** for a **new run ID**, or push a new commit to `main`.
- New runs after this fix use per-attempt artifact names to prevent old uploads from colliding with the fresh attempt.
- Treat the site as deployed **only** when both **Publish site** and **Verify public page and assets** succeed.

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
