/** Pure timing plan shared by browser audition and offline WAV rendering. */
import { grooveNote, TRACKS, PPQ } from './generator.js';

export function scheduleSong(song) {
  const bpm = Math.min(300, Math.max(30, Number(song.settings.bpm) || 92));
  const secondsPerTick = 60 / (bpm * PPQ);
  const bars = Math.max(1, Number(song.settings.bars) || 8);
  const duration = bars * 4 * PPQ * secondsPerTick;
  const events = [];
  TRACKS.forEach((track, index) => {
    for (const note of song.tracks[track.id] || []) {
      const grooved = grooveNote(note, song.settings, index);
      if (!Number.isFinite(grooved.tick) || !Number.isFinite(grooved.durationTicks)) continue;
      const time = grooved.tick * secondsPerTick;
      if (time >= duration) continue;
      events.push({
        track,
        n: grooved,
        time,
        duration: Math.max(0.01, Math.min(grooved.durationTicks * secondsPerTick, duration - time)),
      });
    }
  });
  events.sort((a, b) => a.time - b.time);
  return { events, duration, bpm };
}
