// offscreen.js

import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js";
import "@mediapipe/face_detection";
import "@mediapipe/camera_utils";

let session;
let initialized = false;
let faceDetector;
let stream;
let intervalId;
let ema = 0;
const alpha = 0.3;          // EMA smoothing factor
let alertThreshold = 0.7;   // default sensitivity
const SAMPLE_INTERVAL = 3000; // every 3 seconds

// Utility Functions
function softmax2([a, b]) {
  const m = Math.max(a, b);
  const e0 = Math.exp(a - m);
  const e1 = Math.exp(b - m);
  const s = e0 + e1;
  return [e0 / s, e1 / s];
}

function updateEMA(prob) {
  ema = alpha * prob + (1 - alpha) * ema;
  return ema;
}

function tensorFromImageData(imageData) {
  const { data, width, height } = imageData;
  const tensor = new Float32Array(3 * width * height);
  let j = 0;
  for (let i = 0; i < data.length; i += 4) {
    tensor[j] = data[i] / 255;         // R
    tensor[j + width * height] = data[i + 1] / 255; // G
    tensor[j + 2 * width * height] = data[i + 2] / 255; // B
    j++;
  }
  return tensor;
}

// Face Detector Setup
async function setupFaceDetector() {
  const { FaceDetection } = await import("https://cdn.jsdelivr.net/npm/@mediapipe/face_detection");
  faceDetector = new FaceDetection({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
  });
  faceDetector.setOptions({
    model: "short",
    minDetectionConfidence: 0.5,
  });
  console.log("MediaPipe face detector loaded.");
}

// Model Loader
export async function loadModel() {
  const modelUrl = chrome.runtime.getURL("models/mobilenetv3_deepfake_int8.onnx");
  const providers = navigator.gpu ? ["webgpu", "wasm"] : ["wasm"];
  session = await ort.InferenceSession.create(modelUrl, { executionProviders: providers });
  console.log(`Model loaded (${providers[0]})`);
  await setupFaceDetector();
  initialized = true;
}

// Frame Processor
async function analyzeFrame(video) {
  if (!initialized) return;
  const canvas = new OffscreenCanvas(224, 224);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, 224, 224);
  const imageData = ctx.getImageData(0, 0, 224, 224);
  const tensorData = tensorFromImageData(imageData);
  const input = new ort.Tensor("float32", tensorData, [1, 3, 224, 224]);

  const output = await session.run({ input });
  const logits = Array.from(output.output.data);
  const [p_real, p_fake] = softmax2(logits);
  const smoothed = updateEMA(p_fake);

  const result = {
    real: p_real.toFixed(3),
    fake: p_fake.toFixed(3),
    smoothed: smoothed.toFixed(3),
    riskLevel: smoothed >= alertThreshold ? "high" : smoothed >= 0.5 ? "medium" : "low",
  };

  chrome.runtime.sendMessage({ type: "DEEPFAKE_SCORE", result });
}

// Stream Management
export async function startCapture() {
  if (stream) return;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    console.log("Stream started. Beginning analysis...");
    intervalId = setInterval(() => analyzeFrame(video), SAMPLE_INTERVAL);
  } catch (err) {
    console.error("Capture error:", err);
  }
}

export function stopCapture() {
  if (intervalId) clearInterval(intervalId);
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  console.log("Capture stopped.");
}

// Message Handling
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === "LOAD_MODEL") {
    await loadModel();
  } else if (msg.type === "START_ANALYSIS") {
    await startCapture();
  } else if (msg.type === "STOP_ANALYSIS") {
    stopCapture();
  } else if (msg.type === "SET_THRESHOLD") {
    alertThreshold = msg.value;
    console.log(`Threshold set to ${alertThreshold}`);
  }
});
