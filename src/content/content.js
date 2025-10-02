(() => {
  'use strict';

  // ---- One-time install guard (prevents double init) ----
  if (window.__DFW_INSTALLED__) {
    console.debug('[Deepfake Watch] already installed');
    return;
  }
  window.__DFW_INSTALLED__ = true;
  console.log('[Deepfake Watch] content script loaded on', location.href);

  // ---- State ----
  let stream = null;
  let reader = null;
  let running = false;
  let lastSample = 0;

  // EMA + trigger window
  let ema = 0, alpha = 0.3;
  let aboveCount = 0, windowN = 8, windowK = 3;

  // Last video id (to avoid repeated resets)
  let _lastVideoId = null;

  // ---- Helpers: EMA & Threshold ----
  function resetEma() { ema = 0; aboveCount = 0; }
  function emaUpdate(raw) {
    ema = alpha * raw + (1 - alpha) * ema;
    // simple window heuristic
    aboveCount = Math.max(0, Math.min(windowN, (raw >= 0.5 ? aboveCount + 1 : Math.max(0, aboveCount - 1))));
    return ema;
  }
  function shouldTrigger(smoothed, threshold) {
    return smoothed >= threshold && aboveCount >= windowK;
  }
  async function getThreshold() {
    const st = await chrome.storage.local.get('df_threshold');
    return Number(st.df_threshold ?? 0.8);
  }

  // ---- UI panel (inline CSS + DOM) ----
  function ensurePanel() {
    if (document.getElementById('dfw-panel')) return;

    const css = `
#dfw-panel{position:fixed;right:16px;bottom:16px;z-index:2147483647;background:rgba(17,17,24,.92);color:#fff;font:12px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:12px;border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.35);width:240px;backdrop-filter:blur(6px)}
#dfw-hdr{display:flex;align-items:center;justify-content:space-between;gap:8px}
#dfw-dot{width:10px;height:10px;border-radius:50%;background:#3fb950}
#dfw-ctl{margin-top:8px;display:grid;gap:8px}
#dfw-slider{width:100%}
#dfw-note{font-size:11px;color:#c9c9d3}
#dfw-btns{display:flex;gap:8px}
#dfw-btns button{flex:1;padding:6px 8px;border-radius:8px;border:0;background:#2b2b36;color:#fff;cursor:pointer}
#dfw-btns button:hover{background:#393949}
#dfw-toast{position:fixed;right:16px;bottom:102px;z-index:2147483647;background:#ff3b30;color:#fff;padding:10px 12px;border-radius:12px;display:none;max-width:320px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
#dfw-toast.safe{background:#f59e0b}
`;
    const style = document.createElement('style');
    style.textContent = css;
    document.documentElement.appendChild(style);

    const el = document.createElement('div');
    el.id = 'dfw-panel';
    el.innerHTML = `
      <div id="dfw-hdr">
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="dfw-dot"></span><strong>Deepfake Watch</strong>
        </div>
        <button id="dfw-toggle">Start</button>
      </div>
      <div id="dfw-ctl">
        <label>Warn at: <span id="dfw-val">0.80</span></label>
        <input id="dfw-slider" type="range" min="0.5" max="0.95" step="0.01" value="0.8">
        <div id="dfw-note">Local analysis via tab capture. Probabilistic, not proof.</div>
        <div id="dfw-btns"><button id="dfw-pause">Pause</button><button id="dfw-reset">Reset</button></div>
      </div>
      <div id="dfw-toast"></div>
    `;
    document.body.appendChild(el);

    document.getElementById('dfw-toggle').onclick = () => running ? stopSession() : startSession();
    document.getElementById('dfw-pause').onclick  = () => running && stopSession();
    document.getElementById('dfw-reset').onclick  = () => { resetEma(); setDot('amber'); };

    document.getElementById('dfw-slider').oninput = async (e) => {
      const t = Number(e.target.value);
      document.getElementById('dfw-val').textContent = t.toFixed(2);
      await chrome.storage.local.set({ df_threshold: t });
    };

    restoreThresholdUI();
  }

  async function restoreThresholdUI() {
    const t = await getThreshold();
    const s = document.getElementById('dfw-slider');
    const v = document.getElementById('dfw-val');
    if (s) s.value = String(t);
    if (v) v.textContent = t.toFixed(2);
  }

  function setDot(state) {
    const dot = document.getElementById('dfw-dot');
    const btn = document.getElementById('dfw-toggle');
    const colors = { green: '#3fb950', amber: '#f59e0b', red: '#ff3b30' };
    if (dot) dot.style.background = colors[state] || colors.green;
    if (btn) btn.textContent = state === 'green' ? 'Start' : 'Stop';
  }

  function toast(msg, tone = 'alert') {
    const t = document.getElementById('dfw-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.toggle('safe', tone === 'info');
    t.style.display = 'block';
    clearTimeout(t._hide);
    t._hide = setTimeout(() => (t.style.display = 'none'), 4200);
  }

  // ---- YouTube video-change detection (safe + throttled) ----
  function currentVideoId() {
    try { return new URL(location.href).searchParams.get('v'); }
    catch { return null; }
  }

  function handleVideoChange() {
    const vid = currentVideoId();
    if (vid && vid !== _lastVideoId) {
      _lastVideoId = vid;
      resetEma();
      toast('New video detected — analysis reset.', 'info');
    }
  }

  function setupYouTubeNavigationHooks(onChange) {
    // Debounce to avoid floods
    let pending = false;
    const debounced = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { onChange(); pending = false; });
    };

    // YouTube SPA events (preferred)
    document.addEventListener('yt-navigate-finish', debounced, true);
    document.addEventListener('yt-page-data-updated', debounced, true);

    // History API fallbacks
    const _push = history.pushState;
    const _replace = history.replaceState;
    history.pushState = function() { const r = _push.apply(this, arguments); queueMicrotask(debounced); return r; };
    history.replaceState = function() { const r = _replace.apply(this, arguments); queueMicrotask(debounced); return r; };
    window.addEventListener('popstate', debounced);

    // Mutation fallback that ignores our own panel
    const panel = () => document.getElementById('dfw-panel');
    const mo = new MutationObserver((mutList) => {
      const pnl = panel();
      if (pnl && mutList.every(m => pnl.contains(m.target))) return; // ignore our UI
      debounced();
    });
    mo.observe(document.body || document.documentElement, { childList: true, subtree: true });

    // Simple URL poller as the last-resort safety net
    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        debounced();
      }
    }, 500);
  }

  // ---- Tab capture & frame reader ----
  async function startCapture() {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const [vTrack] = s.getVideoTracks();
    vTrack.onended = () => stopSession(); // user clicked "Stop sharing"
    return s;
  }
  function makeFrameReader(s) {
    const [vTrack] = s.getVideoTracks();
    // MediaStreamTrackProcessor is available in Chromium-based browsers
    const msp = new MediaStreamTrackProcessor({ track: vTrack });
    return msp.readable.getReader();
  }

  // ---- Stub scorer (replace with real model later) ----
  async function scoreFrameStub(videoFrame) {
    const off = new OffscreenCanvas(224, 224);
    const ctx = off.getContext('2d', { willReadFrequently: true });
    // draw the VideoFrame directly
    // @ts-ignore
    ctx.drawImage(videoFrame, 0, 0, 224, 224);
    const { data } = ctx.getImageData(0, 0, 224, 224);
    // brightness variance heuristic -> 0..1
    let mean = 0; for (let i = 0; i < data.length; i += 4) mean += data[i];
    mean /= (data.length / 4);
    let varAcc = 0; for (let i = 0; i < data.length; i += 4) { const d = data[i] - mean; varAcc += d * d; }
    const variance = Math.min(1, Math.sqrt(varAcc / (data.length / 4)) / 64);
    return variance;
  }

  // ---- Session control + sampling loop ----
  async function startSession() {
  if (running) return;
  running = true;
  resetEma();
  setDot('amber'); // shows "Stop" while we're prompting

  try {
    // Ask to share this tab (simple constraints work across Chrome/Brave)
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch (e) {
    // User cancelled or blocked permission -> revert UI to idle
    running = false;
    setDot('green');                    // <— forces button text to "Start"
    toast('Permission denied for tab capture.', 'info');
    try { chrome.runtime.sendMessage({ type: 'DF_SESSION_OFF' }); } catch {}
    return;
  }

  // If we got here, capture is on
  const [vTrack] = stream.getVideoTracks();
  vTrack.onended = () => stopSession(); // user hit "Stop sharing" bubble

  reader = makeFrameReader(stream);
  lastSample = 0;
  loop();
}

async function stopSession() {
  if (!running) { setDot('green'); return; }
  running = false;

  try { reader?.releaseLock(); } catch {}
  try { stream?.getTracks().forEach(t => t.stop()); } catch {}

  stream = null;
  reader = null;

  setDot('green');                      // <— forces button text to "Start"
  try { chrome.runtime.sendMessage({ type: 'DF_SESSION_OFF' }); } catch {}
}


  async function stopSession() {
  if (!running) { setDot('green'); return; }
  running = false;

  try { reader?.releaseLock(); } catch {}
  try { stream?.getTracks().forEach(t => t.stop()); } catch {}

  stream = null;
  reader = null;

  setDot('green');                      // <— forces button text to "Start"
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
        const threshold = await getThreshold();

        if (shouldTrigger(smoothed, threshold)) {
          setDot('red');
          toast(`Possible deepfake risk (score ${smoothed.toFixed(2)})`);
          chrome.runtime.sendMessage({ type: 'DF_HIT' });
          // Cool-down a bit
          aboveCount = Math.max(0, aboveCount - 2);
        } else {
          setDot(smoothed >= threshold * 0.85 ? 'amber' : 'green');
        }
      }

      frame.close();
    }
  }

  // ---- Background <-> Content messaging ----
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'DF_PING') {
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === 'DF_START') {
      startSession();
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === 'DF_STOP') {
      stopSession();
      sendResponse({ ok: true });
      return true;
    }
  });

  // Let background know we’re alive
  try { chrome.runtime.sendMessage({ type: 'DF_READY' }); } catch {}

  // ---- Boot ----
  ensurePanel();
  setupYouTubeNavigationHooks(handleVideoChange);
  // Initialize last video id immediately
  _lastVideoId = currentVideoId();
})();
