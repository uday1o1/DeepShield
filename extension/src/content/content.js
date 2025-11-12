// src/content/content.js
// General pipeline: user-initiated tab sharing -> face crop (MediaPipe) -> ONNX inference (ORT Web) -> threshold/EMA -> bump count

let session = null;
let running = false;
let stream = null;
let timer = null;
let threshold = 0.8;
let ema = 0;
const ALPHA = 0.3;          // EMA smoothing
const SAMPLE_MS = 3000;     // every 3 seconds

// Load ONNX Runtime Web once
let ortMod = null;
async function loadORT() {
  if (ortMod) return ortMod;
  ortMod = await import("https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js");
  return ortMod;
}

// Lazy-load MediaPipe face detection
let faceDetector = null;
async function ensureFaceDetector() {
  if (faceDetector) return faceDetector;
  const { FaceDetection } = await import("https://cdn.jsdelivr.net/npm/@mediapipe/face_detection");
  const fd = new FaceDetection({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${f}`
  });
  fd.setOptions({ model: "short", minDetectionConfidence: 0.5 });
  faceDetector = fd;
  return faceDetector;
}

function softmax2([a, b]) {
  const m = Math.max(a, b);
  const e0 = Math.exp(a - m);
  const e1 = Math.exp(b - m);
  const s = e0 + e1;
  return [e0 / s, e1 / s];
}

function emaUpdate(p) {
  ema = ALPHA * p + (1 - ALPHA) * ema;
  return ema;
}

async function loadModel() {
  if (session) return session;
  const ort = await loadORT();
  const modelUrl = chrome.runtime.getURL("models/mobilenetv3_deepfake_int8.onnx");
  const providers = (navigator.gpu ? ["webgpu", "wasm"] : ["wasm"]);
  session = await ort.InferenceSession.create(modelUrl, { executionProviders: providers });
  return session;
}

function toTensorCHW224(imgData) {
  const { data } = imgData;
  const out = new Float32Array(3 * 224 * 224);
  let idx = 0;
  for (let i = 0; i < data.length; i += 4) {
    out[idx] = data[i] / 255;                         // R
    out[idx + 224 * 224] = data[i + 1] / 255;         // G
    out[idx + 2 * 224 * 224] = data[i + 2] / 255;     // B
    idx++;
  }
  return out;
}

async function cropFaceTo224(video) {
  // Try face detection; fallback to center crop
  try {
    await ensureFaceDetector();
    const tmp = new OffscreenCanvas(video.videoWidth, video.videoHeight);
    const tctx = tmp.getContext("2d", { willReadFrequently: true });
    tctx.drawImage(video, 0, 0);
    const bitmap = await createImageBitmap(tmp.transferToImageBitmap());
    const detections = await new Promise((resolve) => {
      faceDetector.onResults((res) => resolve(res.detections || []));
      faceDetector.send({ image: bitmap });
    });
    if (detections.length) {
      const b = detections[0].boundingBox;
      const sx = Math.max(0, b.xCenter - b.width / 2);
      const sy = Math.max(0, b.yCenter - b.height / 2);
      const sw = Math.min(video.videoWidth - sx, b.width);
      const sh = Math.min(video.videoHeight - sy, b.height);
      const out = new OffscreenCanvas(224, 224);
      const octx = out.getContext("2d", { willReadFrequently: true });
      octx.drawImage(video, sx, sy, sw, sh, 0, 0, 224, 224);
      return octx.getImageData(0, 0, 224, 224);
    }
  } catch (_) {
    // ignore and center-crop
  }
  const w = video.videoWidth, h = video.videoHeight;
  const size = Math.min(w, h);
  const sx = Math.floor((w - size) / 2);
  const sy = Math.floor((h - size) / 2);
  const out = new OffscreenCanvas(224, 224);
  const octx = out.getContext("2d", { willReadFrequently: true });
  octx.drawImage(video, sx, sy, size, size, 0, 0, 224, 224);
  return octx.getImageData(0, 0, 224, 224);
}

async function analyzeOnce(video) {
  const fd = await cropFaceTo224(video);
  const chw = toTensorCHW224(fd);
  const ort = await loadORT();
  const sess = await loadModel();
  const tensor = new ort.Tensor("float32", chw, [1, 3, 224, 224]);
  const outputs = await sess.run({ input: tensor });
  const logits = Array.from(outputs.output.data);      // raw logits
  const [, pFake] = softmax2(logits);                  // convert to prob
  const smoothed = emaUpdate(pFake);

  if (smoothed >= threshold) {
    chrome.runtime.sendMessage({ type: "DF_BUMP_COUNT" });
    chrome.runtime.sendMessage({ type: "DF_NOTIFY", payload: { pFake: smoothed } });
  }
}

async function start() {
  if (running) return { ok: true };
  running = true;
  ema = 0;

  const st = await chrome.storage.local.get(["df_threshold"]);
  threshold = typeof st.df_threshold === "number" ? st.df_threshold : 0.8;

  // Ask user to share current tab (works on all sites)
  stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: "browser" },
    audio: false,
    preferCurrentTab: true
  });

  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  await video.play();

  await loadModel();
  timer = setInterval(() => analyzeOnce(video), SAMPLE_MS);
  return { ok: true };
}

function stop() {
  running = false;
  if (timer) clearInterval(timer);
  timer = null;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "DF_START") {
    start().then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === "DF_STOP") {
    stop();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === "DF_SET_THRESHOLD") {
    threshold = Number(msg.value) || 0.8;
    chrome.storage.local.set({ df_threshold: threshold });
    sendResponse({ ok: true });
    return true;
  }
});
