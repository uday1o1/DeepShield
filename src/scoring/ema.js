let ema = 0, alpha = 0.3;
let count = 0, N = 8, K = 3;

export function emaUpdate(raw) {
  ema = alpha * raw + (1 - alpha) * ema;
  count = Math.max(0, Math.min(N, (raw >= 1 ? count + 1 : raw >= 0 ? (raw >= 0.5 ? count + 1 : Math.max(0, count - 1)) : 0)));
  return ema;
}

export function shouldTrigger(raw, smoothed, threshold) {
  // Simple “above threshold K of last N” heuristic
  if (smoothed >= threshold && count >= K) return true;
  return false;
}

export function resetEma() {
  ema = 0;
  count = 0;
}
