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

## Rung 3A: Sound Lab and WAV bounce (v0.3)

The browser now exposes additional per-track controls for the **same six MIDI lanes**:

- **Voice selection:** Auto (play the optionally loaded online GM SoundFont patch, with built-in fallback) or built-in sine, triangle, sawtooth, square and pluck voices on pitched lanes. Drums stay on their synthesized kit.
- **Filter:** Per-track low-pass frequency sweep. 100% is essentially open; reducing it darkens the track.
- **Delay:** Per-track send to a shared tempo-synced eighth-note delay. Includes controlled feedback and a compressor after the master bus.
- **WAV export:** An uncompressed **44.1 kHz stereo, 16-bit PCM WAV** rendered with Web Audio \`OfflineAudioContext\`. It uses the same deterministic note schedule, builtin synth/drum voices, volume, pan, mute/solo, filter, delay and master level as browser audition.
- **Persistence:** The existing \`.phiano.json\` projects (v1/v2) remain loadable; version 3 adds master volume and the new mixer effects/voice selections.

### Known boundaries

**Important SoundFont distinction:** WAV bounce currently uses the **built-in synth** for every pitched track, even if online GM SoundFonts were loaded for listening in the browser. The WAV export preserves the notes, mix and effects, but it does **not** capture remote sampled SoundFont playback. If you want FL Studio to use your own sample instruments, export MIDI as before and assign instruments there.

An offline render needs to hold the whole audio buffer in memory, so WAV export has a 4-minute arrangement limit plus a 2-second effect tail. Long or complex projects can consume substantial RAM on phones. WAV export is a one-shot file operation; it does not play a generated song or run a server. If offline rendering is unavailable, MIDI export remains functional.

Direct local \`.sf2\`/\`.sfz\` ingestion, additional sample layers, audio stems, reverb and effect automation remain for a following Rung 3B. No third-party samples have been added to this repository.

## Rung 3B: Local sampler and WAV stems (v0.3B)

The Sound Lab can now load **instrument samples from local files** without contacting a cloud service or including third-party samples in the repository.

- **Single WAV:** Load a WAV sample and play it pitched from MIDI note C4 (60). This is a simple one-region sampler, not a chromatically multisampled instrument.
- **SFZ plus WAV files:** Select an \`.sfz\` with its referenced WAV samples in the same picker, or select their folder using a browser with directory input support. Supported core regions and opcodes: \`<control> default_path\`, \`<global>\`, \`<group>\`, \`<region>\`, \`sample\`, \`key\`/\`lokey\`/\`hikey\`, \`lovel\`/\`hivel\`, \`pitch_keycenter\`, \`tune\`, \`volume\`, \`loop_mode\`, \`loop_start\`/\`loop_end\`, \`ampeg_attack\`/\`ampeg_release\`.
- **SoundFont 2 (SF2):** A built-in limited RIFF/sfbk reader interprets preset/instrument/sample zones, basic pitch and velocity ranges, attenuation, tuning and mono PCM16 sample looping. Choose the preset in the Sound Lab after loading the file. More complex SF2 behaviors (stereo-linked zones, modulators, complete envelopes, effects, filter generators, and all SoundFont modulators) are **not** supported yet. Unsupported preset zones may be skipped.
- **Audio stems:** The **STEMS ZIP** button creates six individual WAV files (\`drums.wav\`, \`bass.wav\`, \`chords.wav\`, \`melody.wav\`, \`arp.wav\`, \`lead.wav\`) inside one ZIP, with each track's sound choice, effects, pan, channel level and the master level. Tracks are rendered in isolation, ignoring live mute/solo state for inclusion. **Length limit: 2 minutes** due to browser memory pressure. The existing combined WAV export remains capped at 4 minutes. The ZIP uses stored/uncompressed entries.
- **Offline parity:** Locally loaded sample banks can play in browser audition **and** are supplied to the offline WAV/stem renderer. Online GM SoundFonts from \`soundfont-player\` remain preview-only.
- **Existing exports:** The six-track MIDI format 1 output is unchanged and remains the most faithful route into FL Studio for reassigning DAW instruments.

**Local file privacy and persistence:** The browser reads local sample files only after you select them. Sample bytes are kept in memory, not uploaded, not copied into a \`.phiano.json\` project, and not saved to localStorage. Reload the samples after reopening a project or refreshing the page. If you selected LOCAL without loading the bank this session, WAV/stem export blocks with an explicit reload warning rather than silently substituting a synth.

**Licensing:** Use samples and SoundFonts you have permission to load, redistribute or publish. This repository does not bundle third-party sample packs. SFZ includes a broad instrument language; this is a documented practical subset. Some commercial or elaborate banks may not play correctly.

**Suggested field test:** Select a pitched track → LOAD SAMPLE FILES → select your SF2, WAV, or SFZ+WAVs → choose LOCAL SAMPLE BANK → listen → EXPORT WAV → open in FL Studio. For a shorter song, use STEMS ZIP and import the six WAV files as stems. Compare their timing against the original MIDI arrangement. Stereo stem summing may differ slightly from a combined master mix because each stem is compressed separately.

## Rung 3C: FL Studio Production Pack (v0.3C)

The **DAW PACK ZIP** button exports the working project as a single, organized file, built around the six separate MIDI and WAV tracks that already export to FL Studio.

**Included in one ZIP**:
- \`arrangement.mid\`: the existing format-1 multitrack MIDI export, untouched.
- \`drums.wav\`, \`bass.wav\`, \`chords.wav\`, \`melody.wav\`, \`arp.wav\`, \`lead.wav\`: six stereo PCM16 WAV stems aligned from time zero. All have the same number of audio frames and include the same two-second tail.
- \`project.phiano.json\`: the editable project, mixer, tempo, arrangement and musical notes.
- \`manifest.json\`: BPM, key, scale, seed, track names, GM MIDI channel/program numbers, audio format, timeline alignment and note counts.
- \`README.txt\`: practical FL Studio import instructions.

To use it in **FL Studio**, extract the archive, set the song tempo shown in the README, and drag the six WAV stems onto separate audio lanes starting at bar 1. Or import \`arrangement.mid\` to assign your own instruments. Avoid double-playing the MIDI arrangement with the audio stems unless you intend to layer sounds.

The existing **STEMS ZIP** export still produces only six WAV files. Both exporters now share one sequential offline stem renderer, with per-track progress. This keeps the two file formats musically consistent and avoids rendering multiple complete songs at once.

**Limits:** Stems and Production Packs remain capped at **two minutes per song**, and can be memory-intensive on low-RAM devices. Each stem is compressed independently, so six summed stems will not necessarily match the combined WAV bounce exactly. Online GM SoundFonts remain audition-only; local sample banks are included in offline renders, but **the sample files themselves are never embedded or uploaded**. Projects using local samples require the original files to be selected again after refresh. WAV render, MIDI export and GitHub Pages remain unchanged.

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
- **Rung 3: Advanced audio.** v0.3 adds offline WAV bounce, filter/delay and synth voices; remaining work includes local `.sf2`/`.sfz` support via a suitable licensed sampler engine, velocity layers, effects sends, audio export, better time-synchronized transport, playback metering and automation.
- **Rung 4: Native plugin output.** Reuse a portable composition core in a desktop **VST3/CLAP** plugin host shell (e.g. JUCE or iPlug2), MIDI output, host tempo/transport sync, parameter automation, plugin validation, installer/signing. Browser apps cannot themselves emit a VST3 binary; this requires separate native code and builds. AU can follow for macOS.
- **Rung 5: Phi ecosystem integrations.** MoreBounceLabs Writer's Room, PhiOS audio workflows, MIDI pattern libraries and cross-app project handoff.

## Safety and licensing

MIT project code. The optional third-party SoundFont library and sample patch data have their own licenses. Verify and honor those licenses before bundling sample assets for distribution; patches are loaded remotely by default and are not committed here.

Built to help creators turn ideas into something they can actually finish.


## Rung 4: Phi Harmonic Research Lab (v0.4)

A4 reference control (415–466 Hz), temperament/interval explorer, acoustic partial-beating readouts, in-browser 432/440 blind preference trials and CSV export. Browser playback, local samples, and offline WAV/stem exports honor the project A4. MIDI exports non-440 references via a per-channel RPN pitch-bend-range message and pitch bend; verify DAW support. Online GM SoundFonts fall back to built-in synth when reference differs from A440. The whole-song temperament remains 12-TET; just intonation is laboratory audition-only. No health benefits are implied or proven. See [Rung 4 research and protocol](docs/harmonic-lab.md).
