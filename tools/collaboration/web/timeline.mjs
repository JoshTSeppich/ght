// Pure timing helpers shared by the scrubber and regression tests.
export function totalDuration(frames) { return frames.reduce((sum, f) => sum + (f.duration_ms ?? 100), 0); }
export function frameAt(frames, elapsed) {
  const total = totalDuration(frames);
  if (!total) return 0;
  let t = ((elapsed % total) + total) % total;
  for (let i = 0; i < frames.length; i++) { t -= frames[i].duration_ms ?? 100; if (t < 0) return i; }
  return frames.length - 1;
}
export function stepFrame(frame, delta, count) { return count ? ((frame + delta) % count + count) % count : 0; }
