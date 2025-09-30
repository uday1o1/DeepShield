// Bottom-right summary panel
const panel = document.createElement("div");
panel.id = "deepshield-overlay";
panel.innerHTML = `<div><strong>DeepShield</strong> <span id="ds-score">—</span></div>
<div class="bar"><div class="fill" id="ds-fill"></div></div>`;
document.documentElement.appendChild(panel);
const scoreEl = panel.querySelector("#ds-score") as HTMLElement;
const fillEl  = panel.querySelector("#ds-fill") as HTMLElement;

// Fullscreen canvas for boxes
const canvas = document.createElement("canvas");
canvas.id = "deepshield-canvas";
document.documentElement.appendChild(canvas);
const ctx = canvas.getContext("2d")!;

function resizeCanvas() { canvas.width = innerWidth; canvas.height = innerHeight; }
resizeCanvas(); addEventListener("resize", resizeCanvas);

function toPx(b:{x:number;y:number;width:number;height:number}) {
  return { x: b.x * canvas.width, y: b.y * canvas.height, w: b.width * canvas.width, h: b.height * canvas.height };
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "FACES") {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let top = 0;
    for (const f of msg.faces as Array<{id:number;score:number;smooth:number;bbox:any}>) {
      const risk = f.smooth;
      const {x,y,w,h} = toPx(f.bbox);
      ctx.lineWidth = 3;
      ctx.strokeStyle = risk > 0.7 ? "red" : risk > 0.4 ? "orange" : "lime";
      ctx.strokeRect(x, y, w, h);
      ctx.font = "12px system-ui"; ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x, y-18, 60, 16);
      ctx.fillStyle = "white";
      ctx.fillText(`${Math.round(risk*100)}%`, x+6, y-6);
      if (risk > top) top = risk;
    }
    const pct = Math.round(top * 100);
    scoreEl.textContent = (msg.faces as any[]).length ? `Top risk: ${pct}%` : "—";
    fillEl.style.width = `${pct}%`;
    panel.style.background = top > 0.7 ? "rgba(150,0,0,.75)" : top > 0.4 ? "rgba(160,120,0,.75)" : "rgba(0,120,60,.75)";
  }
});
