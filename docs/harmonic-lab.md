# Rung 4: Phi Harmonic Research Lab

PhianoSheets includes an exploratory tuning laboratory designed to test, not assume, claims about musical reference pitch.

## What we can measure

- A4 reference: adjustable 415–466 Hz (432, 435, 440 and 443 Hz presets).
- Cents difference relative to 440; frequency for each MIDI pitch.
- Tonic-anchored just-intonation vs equal-tempered intervals, including selected partial beat rates.
- Small, session-only blinded A/B preference trials: identical synthesized sine C-major triads, one at 432 and the other at 440. Randomized A/B labels; user can export a CSV or clear the session.

A reference pitch **does not** alter equal-tempered interval ratios. A temperament does. Harmonic beat-rate examples are simple acoustic measures, not validated predictors of liking, stress, or health.

## Composition/export integration

The composition is still **12-tone equal temperament**, with a custom project A4. When tuning is changed, playback is stopped and subsequently restarts at the new reference. Browser built-in oscillator voices and WAV/stem/DAW-Pack offline renders use the project A4. Local WAV/SFZ/SF2 sample playback is transposed by the same ratio. Drums are unaffected.

Online GM SoundFont patches are preview-only and are **not** independently retunable in this release. When A4 differs from 440, the online GM playback path is bypassed in favor of the built-in synth. At A440, the old SoundFont behavior is preserved.

MIDI 1.0 has no universal A4 metadata field. For non-440 A4, the exported pitched tracks send MIDI RPN 0,0 to select a +/-2-semitone pitch bend range, then a corresponding channel pitch bend. **DAW and plug-in support varies**: some instruments ignore bend, reset it, or override the range. WAV stems provide the most predictable reference-pitch handoff; for MIDI, verify tuning in your destination instrument. Standard A440 MIDI is unchanged. Pure/just temperament is lab audition-only, not baked into the song/MIDI.

The DAW Pack manifest records the A4 reference and the MIDI bend convention. Legacy project JSON defaults to A440.

## Reproducible listening protocol

Start by keeping volume, listening setup, oscillator waveform and chord identical while switching A/B. Record preference without knowing which reference each button uses. Repeat with breaks, and optionally export an anonymous CSV. The trial playback here is **not** calibrated or double-blind. Anonymized lab CSV data is held in-memory within this browser tab; it is not automatically sent anywhere.

The demonstration can establish a personal preference in a given context. It cannot establish clinical effects or a universal optimum. A more rigorous protocol would randomize order across participants, control playback hardware and levels, preregister hypotheses, collect independent physiological data with appropriate consent, and separate pitch reference, temperament, timbre and tempo.

## Scientific context

- [ISO 16:1975](https://www.iso.org/standard/3601.html) specifies A4 = 440 Hz as a standard musical pitch. Its current status does not imply physiological optimality.
- [Calamassi & Pomponi (2019), double-blind crossover pilot, n=33](https://pubmed.ncbi.nlm.nih.gov/31031095/) found a modest heart-rate difference favoring 432 under the study conditions; larger controlled replication is needed.
- [Hohneck et al. (2025), randomized crossover, n=43](https://pubmed.ncbi.nlm.nih.gov/39844155/) compared 432 with 443 Hz body monochord interventions in cancer patients. Most between-intervention cardiovascular outcomes did not significantly differ; this does not establish a universal medical benefit.
- [Marjieh et al. (2024), Nature Communications](https://www.nature.com/articles/s41467-024-45812-z) report 235,440 consonance judgments and substantial timbral effects on preferences for harmonic and inharmonic intervals.

## Next research rungs

1. Controlled matched arrangement export at multiple references, with a properly randomized listening interface.
2. Tempo/timbre/temperament factorial design, preference analyses and uncertainty estimates.
3. Per-note tuning of whole arrangements, using MPE/MIDI tuning standards where reliably supported, or rendered WAV as fallback.
4. Optional user-provided physiological measurements, with explicit opt-in, privacy protection and no health claims.

No external samples, model services, microphone permissions or data collection services are needed to use the lab.
