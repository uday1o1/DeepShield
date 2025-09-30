import { captureActiveTabStream } from "./tabCapture";
import { getFaceDetector, toBoxes } from "./vision/mediapipe";
import { IoUTracker } from "./inference/tracker";
import { EMA } from "./inference/smoothing";
import { analyzeBatch } from "./inference/pipeline";

console.log("[DeepShield] offscreen loaded");

let processing = false;
let reader: ReadableStreamDefaultReader<VideoFrame> | null = null;

const tracker = new IoUTracker();
const ema = new EMA(12);

console.log("[DeepShield] offscreen loaded");

chrome.runtime.onMessage.addListener((msg) => {
  (async () => {
    if (msg.type === "OFFSCREEN_START") start();
    if (msg.type === "OFFSCREEN_STOP")  stop();
  })();
  return true;
});

async function start() {
  if (processing) return;
  console.log("[DeepShield] offscreen start");
  processing = true;

  try {
    const stream = await captureActiveTabStream();
    const [track] = stream.getVideoTracks();
    if (!track) throw new Error("No video track from tabCapture");
    const processor = new MediaStreamTrackProcessor({ track });
    reader = processor.readable.getReader();
    loop();
  } catch (e) {
    console.error("[DeepShield] tabCapture error:", e);
    processing = false;
  }
}

async function loop() {
  if (!reader) return;
  const { value: frame, done } = await reader.read();
  if (done || !processing || !frame) return;

  try {
    const now = performance.now();

    // Throttle ~ every 4 frames
    if ((Math.floor(now/16) % 4) === 0) {
      const width = frame.displayWidth, height = frame.displayHeight;

      // Face detection
      const detector = await getFaceDetector();
      const res = detector.detectForVideo(frame, now);
      const dets = toBoxes(res, width, height);

      // Track → crops
      const tracked = tracker.update(dets.map(d => d.bbox));
      const crops = await Promise.all(tracked.map(async (t) => {
        const sx = Math.max(0, t.bbox.x) * width;
        const sy = Math.max(0, t.bbox.y) * height;
        const sw = Math.min(1, t.bbox.x + t.bbox.width) * width - sx;
        const sh = Math.min(1, t.bbox.y + t.bbox.height) * height - sy;
        const bmp = await createImageBitmap(frame, sx, sy, sw, sh, { resizeWidth: 224, resizeHeight: 224 });
        return { id: t.id, bitmap: bmp };
      }));

      // Inference
      const scores = await analyzeBatch(crops);

      const faces = scores.map(s => {
        const clamped = Math.max(0, Math.min(1, isFinite(s.score) ? s.score : 0));
        const sm = ema.update(s.id, clamped);
        const tb = tracked.find(t => t.id === s.id)!.bbox;
        return { id: s.id, score: clamped, smooth: sm, bbox: tb };
      });

      chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
        if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "FACES", faces });
      });
    }
  } catch (e) {
    console.error("[DeepShield] loop error:", e);
  } finally {
    frame.close();
    if (processing) loop();
  }
}

function stop() {
  console.log("[DeepShield] offscreen stop");
  processing = false;
  if (reader) { reader.releaseLock(); reader = null; }
}
