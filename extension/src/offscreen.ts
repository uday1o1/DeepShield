
async function loop() {
  if (!reader) return;
  const { value: frame, done } = await reader.read();
  if (done || !processing || !frame) return;

  try {
    const now = performance.now();
    // throttle detection every ~4 frames
    if ((Math.floor(now/16) % 4) === 0) {
      const width = frame.displayWidth, height = frame.displayHeight;

      const detector = await getFaceDetector();
      const res = detector.detectForVideo(frame, now);
      const dets = toBoxes(res, width, height);

      const tracked = tracker.update(dets.map(d => d.bbox));

      const crops = await Promise.all(tracked.map(async (t) => {
        const sx = Math.max(0, t.bbox.x) * width;
        const sy = Math.max(0, t.bbox.y) * height;
        const sw = Math.min(1, t.bbox.x + t.bbox.width) * width - sx;
        const sh = Math.min(1, t.bbox.y + t.bbox.height) * height - sy;
        const bmp = await createImageBitmap(frame, sx, sy, sw, sh, { resizeWidth: 224, resizeHeight: 224 });
        return { id: t.id, bitmap: bmp };
      }));

      const scores = await analyzeBatch(crops);

      const faces = scores.map(s => {
        const raw = isFinite(s.score) ? s.score : 0.0;
        const clamped = Math.max(0, Math.min(1, raw));
        const sm = ema.update(s.id, clamped);
        const tb = tracked.find(t => t.id === s.id)!.bbox;
        return { id: s.id, score: clamped, smooth: sm, bbox: tb };
      });

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
