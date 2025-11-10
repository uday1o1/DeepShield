(() => {
  'use strict';

  if (window.__DFW_INSTALLED__) return;
  window.__DFW_INSTALLED__ = true;
  console.log('[Deepfake Watch] content script loaded on', location.href);

  let stream = null;
  let reader = null;
  let running = false;
  let lastSample = 0;

  // EMA & trigger
  let ema = 0, alpha = 0.3;
  let aboveCount = 0, windowN = 8, windowK = 3;
  let threshold = 0.8;

  // track video id to reset between videos
  let lastVid = null;

  // ---- helpers
  function resetEma() { ema = 0; aboveCount = 0; }
  function emaUpdate(raw) {
    ema = alpha * raw + (1 - alpha) * ema;
    aboveCount = Math.max(0, Math.min(windowN, (raw >= 0.5 ? aboveCount + 1 : Math.max(0, aboveCount - 1))));
    return ema;
  }
  function shouldTrigger(smoothed) { return smoothed >= threshold && aboveCount >= windowK; }

  async function loadThreshold() {
    const st = await chrome.storage.local.get("df_threshold");
    threshold = Number(st.df_threshold ?? 0.8);
  }

  function currentVideoId() {
    try { return new URL(location.href).searchParams.get("v"); } catch { return null; }
  }

  function watchUrlChanges() {
    let prev = location.href;
    setInterval(() => {
      if (location.href !== prev) {
        prev = location.href;
        const vid = currentVideoId();
        if (vid && vid !== lastVid) {
          lastVid = vid;
          resetEma();
        }
      }
    }, 500);
  }

  // ---- capture (OLD logic: plain constraints)
  async function startCapture() {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const [vTrack] = s.getVideoTracks();
    vTrack.onended = () => stopSession();
    return s;
  }

  function makeReader(s) {
    const [vTrack] = s.getVideoTracks();
    const msp = new MediaStreamTrackProcessor({ track: vTrack });
    return msp.readable.getReader();
  }

  // ---- stub scorer (replace with real model later)
  async function scoreFrameStub(videoFrame) {
    const off = new OffscreenCanvas(224, 224);
    const ctx = off.getContext('2d', { willReadFrequently: true });
    // @ts-ignore
    ctx.drawImage(videoFrame, 0, 0, 224, 224);
    const { data } = ctx.getImageData(0, 0, 224, 224);
    let mean = 0; for (let i = 0; i < data.length; i += 4) mean += data[i];
    mean /= (data.length / 4);
    let varAcc = 0; for (let i = 0; i < data.length; i += 4) { const d = data[i] - mean; varAcc += d*d; }
    return Math.min(1, Math.sqrt(varAcc / (data.length / 4)) / 64);
  }

  // ---- session control
  async function startSession() {
    if (running) return;
    running = true;
    await loadThreshold();
    resetEma();

    try {
      stream = await startCapture();
    } catch {
      running = false;
      try { chrome.runtime.sendMessage({ type: 'DF_SESSION_OFF' }); } catch {}
      return;
    }

    reader = makeReader(stream);
    lastVid = currentVideoId();
    lastSample = 0;
    loop();
  }

  async function stopSession() {
    if (!running) return;
    running = false;
    try { reader?.releaseLock(); } catch {}
    try { stream?.getTracks().forEach(t => t.stop()); } catch {}
    stream = null; reader = null;
    try { chrome.runtime.sendMessage({ type: 'DF_SESSION_OFF' }); } catch {}
  }

  async function loop() {
    while (running && reader) {
      const { value: frame, done } = await reader.read();
      if (done || !frame) break;

      const now = performance.now();
      if (now - lastSample >= 3000) {
        lastSample = now;
        const raw = await scoreFrameStub(frame);
        const smoothed = emaUpdate(raw);
        if (shouldTrigger(smoothed)) {
          try { chrome.runtime.sendMessage({ type: 'DF_HIT' }); } catch {}
          aboveCount = Math.max(0, aboveCount - 2); // cooldown
        }
      }
      frame.close();
    }
  }

  // ---- messaging
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'DF_PING') { sendResponse({ ok: true }); return true; }
    if (msg.type === 'DF_START') { startSession(); sendResponse({ ok: true }); return true; }
    if (msg.type === 'DF_STOP')  { stopSession();  sendResponse({ ok: true }); return true; }
    if (msg.type === 'DF_SET_THRESHOLD') { threshold = Number(msg.value); return true; }
  });

  // boot
  try { chrome.runtime.sendMessage({ type: 'DF_READY' }); } catch {}
  watchUrlChanges();
})();
