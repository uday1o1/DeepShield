export async function scoreFrameStub(videoFrame) {
  const off = new OffscreenCanvas(224, 224);
  const ctx = off.getContext("2d", { willReadFrequently: true });
  // @ts-ignore: drawImage accepts VideoFrame in modern Chrome
  ctx.drawImage(videoFrame, 0, 0, 224, 224);
  const { data } = ctx.getImageData(0, 0, 224, 224);
  let mean = 0; for (let i = 0; i < data.length; i += 4) mean += data[i];
  mean /= (data.length / 4);
  let varAcc = 0; for (let i = 0; i < data.length; i += 4) { const d = data[i] - mean; varAcc += d*d; }
  const variance = Math.min(1, Math.sqrt(varAcc / (data.length / 4)) / 64);
  return variance; // 0..1 placeholder
}
