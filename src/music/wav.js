/** A dependency-free PCM WAV writer. Accepts AudioBuffer-like objects for tests. */
const writeAscii = (view, offset, value) => {
  for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
};
export function encodeWavPCM16(buffer) {
  const channels = Number(buffer.numberOfChannels);
  const frames = Number(buffer.length);
  const sampleRate = Number(buffer.sampleRate);
  if (!Number.isInteger(channels) || channels < 1 || channels > 2 ||
      !Number.isInteger(frames) || frames < 1 ||
      !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new Error('Invalid audio buffer for WAV export');
  }
  const dataBytes = frames * channels * 2;
  if (dataBytes > 512 * 1024 * 1024) throw new Error('WAV buffer exceeds 512 MB');
  const ab = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(ab);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // uncompressed PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);
  const sources = Array.from({length: channels}, (_, ch) => buffer.getChannelData(ch));
  let offset = 44;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const raw = sources[channel][frame];
      const sample = Math.max(-1, Math.min(1, Number.isFinite(raw) ? raw : 0));
      view.setInt16(offset, Math.round(sample < 0 ? sample * 32768 : sample * 32767), true);
      offset += 2;
    }
  }
  return new Uint8Array(ab);
}
export function downloadWav(buffer, title = 'phianosheets') {
  const bytes = encodeWavPCM16(buffer);
  const blob = new Blob([bytes], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phianosheets') + '.wav';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
