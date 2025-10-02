function panelEl() { return document.getElementById("dfw-panel"); }

export function ensurePanel() {
  if (panelEl()) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("src/content/panel.css");
  document.documentElement.appendChild(link);

  const el = document.createElement("div");
  el.id = "dfw-panel";
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
}

export function bindControls(onToggle) {
  const btn = document.getElementById("dfw-toggle");
  const pause = document.getElementById("dfw-pause");
  const reset = document.getElementById("dfw-reset");
  const slider = document.getElementById("dfw-slider");
  const val = document.getElementById("dfw-val");

  btn.onclick = () => {
    const starting = btn.textContent === "Start";
    btn.textContent = starting ? "Stop" : "Start";
    onToggle();
  };
  pause.onclick = () => btn.click();
  reset.onclick = () => document.dispatchEvent(new CustomEvent("dfw:reset"));

  slider.oninput = async (e) => {
    const t = Number(e.target.value);
    val.textContent = t.toFixed(2);
    await chrome.storage.local.set({ df_threshold: t });
  };
  document.addEventListener("dfw:reset", () => setDot("amber"));
}

export async function restoreThreshold() {
  const st = await chrome.storage.local.get("df_threshold");
  const t = Number(st.df_threshold ?? 0.8);
  const slider = document.getElementById("dfw-slider");
  const val = document.getElementById("dfw-val");
  if (slider) slider.value = String(t);
  if (val) val.textContent = t.toFixed(2);
}

export async function getThreshold() {
  const st = await chrome.storage.local.get("df_threshold");
  return Number(st.df_threshold ?? 0.8);
}

export function setDot(state) {
  const dot = document.getElementById("dfw-dot");
  const btn = document.getElementById("dfw-toggle");
  const colors = { green: "#3fb950", amber: "#f59e0b", red: "#ff3b30" };
  if (dot) dot.style.background = colors[state] || colors.green;
  if (btn) btn.textContent = state === "green" ? "Start" : "Stop";
}

export function toast(msg, tone="alert") {
  const t = document.getElementById("dfw-toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.toggle("safe", tone === "info");
  t.style.display = "block";
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.style.display = "none", 4200);
}
