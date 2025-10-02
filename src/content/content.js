import { startCapture, stopCapture, makeFrameReader } from "../capture/tabCapture.js";
import { ensurePanel, setDot, toast, bindControls, restoreThreshold, getThreshold } from "../ui/overlay.js";
import { setupYouTubeNavigationHooks } from "./ytNav.js";
import { emaUpdate, resetEma, shouldTrigger } from "../scoring/ema.js";
import { scoreFrameStub } from "../scoring/scorerStub.js";

let reader, running = false;
let lastSample = 0;

ensurePanel();
bindControls(() => running ? stopSession() : startSession());
restoreThreshold();
setupYouTubeNavigationHooks(onVideoChange);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "DF_START") startSession();
  if (msg?.type === "DF_STOP") stopSession();
});

async function startSession() {
  if (running) return;
  running = true;
  resetEma();
  setDot("amber");
  try {
    const stream = await startCapture();
    reader = makeFrameReader(stream);
    loop();
  } catch {
    running = false;
    setDot("red");
    toast("Permission denied for tab capture.", "warn");
    chrome.runtime.sendMessage({ type: "DF_SESSION_OFF" });
  }
}

async function stopSession() {
  if (!running) return;
  running = false;
  await stopCapture(reader);
  reader = null;
  setDot("green");
  chrome.runtime.sendMessage({ type: "DF_SESSION_OFF" });
}

async function loop() {
  while (running && reader) {
    const { value: frame, done } = await reader.read();
    if (done || !frame) break;
    const now = performance.now();
    if (now - lastSample >= 3000) {
      lastSample = now;
      const score = await scoreFrameStub(frame); // replace later with real model
      const ema = emaUpdate(score);
      const threshold = await getThreshold();
      if (shouldTrigger(score, ema, threshold)) {
        setDot("red");
        toast(`Possible deepfake risk (score ${ema.toFixed(2)})`);
        chrome.runtime.sendMessage({ type: "DF_HIT" });
      } else {
        setDot(ema >= threshold * 0.85 ? "amber" : "green");
      }
    }
    frame.close();
  }
}

function onVideoChange() {
  resetEma();
  toast("New video detected — analysis reset.", "info");
}
