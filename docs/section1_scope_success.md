# Section 1 — Scope & Success (MVP)

## Coverage Mode

* **Mode:** Site-agnostic via `tabCapture`.
* **Rationale:** Works on all sites (YouTube, TikTok, news platforms) without per-site integration or CORS issues. Keeps the architecture simple and scalable.

## Primary Goal

Alert the user in real time if a video they’re watching might be a deepfake, using only **on-device** analysis and no cloud dependency.

## Target User

General web users watching online videos for entertainment, information, or news.

## Privacy Model

Fully local inference. No frame or audio data ever leaves the device.

---

## Signals

* **MVP:** Vision-only deepfake artifact detector (ONNX, quantized).
* **Phase 2:** Add lip-sync A/V consistency check.
* **Phase 3:** Add physiology (rPPG) signal.
* **Rationale:** Vision-only is light enough for CPU inference and sufficient for an initial release.

---

## User Experience

* **Trigger:** User clicks the extension icon and grants capture permission (after being told the processing is fully local).
* **Feedback UI:** Displays **percentage confidence** that current content is deepfake-like.
* **Behavior:** If confidence exceeds the user-set sensitivity threshold, show an alert; otherwise stay quiet.
* **Controls:** Sensitivity slider in settings; per-site toggles optional later.
* **Accessibility:** Keyboard shortcut toggle, ARIA-labeled elements.

---

## Performance Targets

* **Hardware Baseline:** CPU-only inference on typical mid-range laptops.
* **Sampling:** Analyze every 2–3 seconds.
* **Latency:** ≤ 300 ms per decision window.
* **Power Use:** No more than 10% battery drain per hour while active.
* **Model Size:** ≤ 25 MB (quantized).
* **Backends:** Prefer WebGPU when available; otherwise WASM (SIMD + threads).

---

## Accuracy Targets

* ≥ 80% of deepfakes detected with ≤ 10% false alarms (AUC ≈ 0.8).
* Handle “insufficient signal” gracefully (e.g., face too small → no decision).

---

## Bucketing & Hysteresis

* **Thresholds:** Low < 0.40; Medium < 0.70; High ≥ 0.70.
* **Stability:** Require ± 0.05 change or two consecutive frames to shift buckets.

---

## Platform & Permissions

* **Browser:** Chrome 121 +.
* **Hardware:** Works acceptably on CPU; optional WebGPU acceleration.
* **Permissions:**

  * `tabCapture` – to capture tab video/audio.
  * `offscreen` – to run inference persistently.
  * `storage` – for model cache (IndexedDB).
  * `activeTab`, `scripting` – to inject UI overlay.
* **Store Rationale:** “Needed only to analyze the currently viewed tab’s video locally for deepfake detection.”

---

## Privacy & Policy

* 100 % on-device; no uploads or external APIs.
* Zero telemetry.
* Clear disclaimer: “This tool estimates risk of synthetic media; results are not proof.”

---

## MVP Exit Criteria

1. Works via tabCapture on major sites (YouTube, TikTok, etc.).
2. Performs real-time vision-based detection entirely on-device.
3. Displays percentage-based confidence overlay that updates every 2–3 seconds.
4. Provides sensitivity slider to control alert threshold.
5. Achieves AUC ≥ 0.8 with ≤ 10% false positives on test clips.
6. Operates within power limit (≤ 10% battery per hour).

---

## Non-Goals / Constraints

* No deep audio analysis or rPPG in MVP.
* No still-image fake detection.
* No external APIs; completely free and open implementation.

---

## Owner / Date / Version

* **Owner:** Uday Arora
* **Date:** 2025-11-10
* **Version:** v0.1
