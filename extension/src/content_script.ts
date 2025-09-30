// Load thresholds (defaults if file missing)
type Thresholds = { t1: number; t2: number; ema_half_life_frames: number };
let THR: Thresholds = { t1: 0.4, t2: 0.7, ema_half_life_frames: 12 };
(async () => {
  try {
    const url = chrome.runtime.getURL("thresholds.json");
    const res = await fetch(url);
    if (res.ok) THR = await res.json();
  } catch {}
})();

// ---------------- Panel with controls ----------------
const panel = document.createElement("div");
panel.id = "deepshield-overlay";
panel.innerHTML = `
  <div><strong>DeepShield</strong> <span id="ds-score">—</span></div>
  <div class="bar"><div class="fill" id="ds-fill"></div></div>
  <div class="controls">
    <button id="ds-pause">Pause</button>
    <button id="ds-stop">Stop</button>
  </div>
`;
document.documentElement.appendChild(panel);

const scoreEl = panel.querySelector("#ds-score") as HTMLElement;
const fillEl  = panel.querySelector("#ds-fill") as HTMLElement;
const pauseBtn = panel.querySelector("#ds-pause") as HTMLButtonElement;
const stopBtn  = panel.querySelector("#ds-stop") as HTMLButtonElement;

// ---------------- Fullscreen canvas ----------------
const canvas = document.createElement("canvas");
canvas.id = "deepshield-canvas";
document.documentElement.appendChild(canvas);
const ctx = canvas.getContext("2d")!;

function resizeCanvas() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resizeCanvas();
addEventListener("resize", resizeCanvas);

// ---------------- Helpers ----------------
function toPx(b: {x:number;y:number;width:number;height:number}) {
  return { x: b.x * canvas.width, y: b.y * canvas.height, w: b.width * canvas.width, h: b.height * canvas.height };
}
function colorFor(risk:number) {
  if (risk >= THR.t2) return "red";
  if (risk >= THR.t1) return "orange";
  return "lime";
}
function panelBg(risk:number) {
  if (risk >= THR.t2) return "rgba(150,0,0,.75)";
  if (risk >= THR.t1) return "rgba(160,120,0,.75)";
  return "rgba(0,120,60,.75)";
}

// ---------------- Control buttons ----------------
let paused = false;

pauseBtn.onclick = () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  chrome.runtime.sendMessage({ type: paused ? "OFFSCREEN_STOP" : "OFFSCREEN_START" });
};

stopBtn.onclick = () => {
  paused = false;
  pauseBtn.textContent = "Pause";
  chrome.runtime.sendMessage({ type: "STOP_ANALYSIS" });
  // Clear overlay UI
  scoreEl.textContent = "—";
  fillEl.style.width = "0%";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

// ---------------- Listen for inference results ----------------
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "FACES" && !paused) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let top = 0;
    for (const f of msg.faces as Array<{id:number;score:number;smooth:number;bbox:any}>) {
      const risk = Math.max(0, Math.min(1, f.smooth)); // clamp
      const {x,y,w,h} = toPx(f.bbox);
      ctx.lineWidth = 3;
      ctx.strokeStyle = colorFor(risk);
      ctx.strokeRect(x, y, w, h);
      ctx.font = "12px system-ui";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const label = `${Math.round(risk*100)}%`;
      const tw = ctx.measureText(label).width + 12;
      ctx.fillRect(x, y-18, Math.max(60, tw), 16);
      ctx.fillStyle = "white";
      ctx.fillText(label, x+6, y-6);
      if (risk > top) top = risk;
    }
    const pct = Math.round(top * 100);
    scoreEl.textContent = (msg.faces as any[]).length ? `Top risk: ${pct}%` : "—";
    fillEl.style.width = `${pct}%`;
    panel.style.background = panelBg(top);
  }
});
