import { captureActiveTabStream } from "./tabCapture";
import { getFaceDetector, toBoxes } from "./vision/mediapipe";
import { IoUTracker } from "./inference/tracker";
import { EMA } from "./inference/smoothing";
import { analyzeBatch } from "./inference/pipeline";

let processing = false;
let reader: ReadableStreamDefaultReader<VideoFrame> | null = null;

const tracker = new IoUTracker();
const ema = new EMA(12); // ~12-frame half-life

chrome.runtime.onMessage.addListener((msg) => {
  (async () => {
    if (msg.type === "OFFSCREEN_START") start();
    if (msg.type === "OFFSCREEN_STOP")  stop();
  })();
  return true;
});

async function start() {
  if (processing) return;
  processing = true;

  const stream = await captureActiveTabStream();
  const [track] = stream.getVideoTracks();
  const processor = new MediaStreamTrackProcessor({ track });
  reader = processor.readable.getReader();

  loop();
}

async function loop() {
  if (!reader) return;
  const { value: frame, done } = await reader.read();
  if (done || !processing || !frame) return;

  try {
    // throttle detection (every ~4th frame)
    if ((performance.now() | 0) % 4 === 0) {
      const width = frame.displayWidth, height = frame.displayHeight;

      // Detect faces
      const detector = await getFaceDetector();
      const res = detector.detectForVideo(frame, performance.now());
      const dets = toBoxes(res, width, height);

      // Track IDs
      const tracked = tracker.update(dets.map(d => d.bbox));

      // Build crops
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

      // Smooth + payload
      const faces = scores.map(s => {
        const sm = ema.update(s.id, s.score);
        const tb = tracked.find(t => t.id === s.id)!.bbox;
        return { id: s.id, score: s.score, smooth: sm, bbox: tb };
      });

      // Send to active tab
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
        if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "FACES", faces });
      });
    }
  } catch (e) {
    console.warn(e);
  } finally {
    frame.close();
    if (processing) loop();
  }
}

function stop() {
  processing = false;
  if (reader) { reader.releaseLock(); reader = null; }
}
