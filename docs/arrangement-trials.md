# Rung 5: Controlled Arrangement Listening Chamber

This is a local, open-source A/B preference experiment, **not** a health test.

## The question

Holding the musical arrangement, tempo, timing, timbres, filter, mixer, master gain and effects fixed, does a listener prefer one A4 reference over another? Rung 5 compares the entire arrangement when its musical duration is at most 120 seconds, or uses an identical eight-bar excerpt if it is longer. The two frequency conditions are generated without regenerating notes or applying a second randomization to groove.

Changes to reference pitch can interact with tone color, filtering and playback equipment; a difference in stated preference does not identify its underlying cause. This rung tests A4 reference in 12-tone equal temperament. It does not test just intonation in complete songs.

## Procedure

1. Generate or load an arrangement, and set mixer, instrument voices, and FX.
2. Select two **different** A4 references from 432, 435, 440 and 443 Hz. The underlying tuning engine supports 415–466 Hz; presets are used here to keep the initial protocol manageable.
3. Choose full-song auto mode, or force an eight-bar excerpt. If the arrangement lasts more than 2 minutes, auto uses an eight-bar excerpt to avoid holding two huge WAV buffers in memory. Choose an excerpt start bar if appropriate.
4. Select **Render both conditions**. The current browser's OfflineAudioContext renders each condition sequentially. Loaded local samples are respected. Online GM SoundFonts always fall back to the built-in synth for offline render.
5. The result uses a common PCM RMS playback level by reducing the louder render. This is only approximate level matching, not LUFS or psychoacoustically calibrated loudness.
6. Play A and B at least once. A/B identity is randomly assigned each trial, not displayed until the CSV is exported. Record A, B or no preference. For each new vote, the assignment is randomized again.
7. Optionally **Reveal & End Session** for descriptive counts; export trial-by-trial CSV for further analysis. New Session starts clean. All trial records are in-memory and vanish on refresh if not exported.

## Data and reproducibility

A CSV row includes order, A/B reference assignments, preference, plays per condition, song title, seed-relevant composition settings, actual excerpt scope, bar range, note count, and a local FNV-1a-style source fingerprint generated from song notes, song settings (normalizing A4), mixer and master. The fingerprint is **not** cryptographic provenance; it is a convenient reproducibility aid, not a secret or secure signature. The tool does not capture listener identity, microphone, heart rate or biometrics.

Full song comparison uses the same note timing, as the source arrangement is passed unchanged except for A4. For excerpts, note onsets are offset into the short clip and boundary-crossing notes are clipped; the resulting arrangement and deterministic groove are identical for both tuning references, though relative timing at the cropped boundary may differ from the full-song playback.

## Confounds and limitations

- Browsers/audio interfaces/headphones may have frequency-dependent response. The listener is not isolated from knowing the pair of tuning references. Random A/B labels are **single-blind to ordering**, not a blinded clinical study.
- Fixed mixing settings do not guarantee identical perceived loudness. Equal PCM RMS is not equal perceived loudness.
- This is a test of **preference**, not relaxation, neural entrainment, health or a universally correct frequency.
- One session/user cannot establish population-level outcomes. For research, pre-register the endpoint, randomize/counterbalance order, hold hardware and volume constant, recruit multiple independent consenting listeners, and report sample sizes and uncertainty.
- Whole-song comparisons use two stereo Float32 audio buffers in browser memory; the 120-second boundary and sequential offline rendering limit but do not eliminate memory pressure. Do not repeatedly render multiple tabs on low-memory devices.
- Project audio and results remain on-device. Local sample files are not embedded in CSV; a listener who wants full reproducibility must keep the same authorized sample bank.
- Downloaded results reveal the A/B assignments; once opened, a participant cannot remain blind to previous condition choices.

## Next rung ideas

- True loudness calibration and a configurable short-clip window for full arrangements.
- Balanced block randomization and participant/session pseudonyms when appropriate.
- Paired repeated measures with confidence intervals, preregistered analysis and cross-participant aggregation.
- Adaptive temperament applied across chord changes using MPE/per-note pitch approaches; compare rendered PCM where MIDI support is not reliable.
