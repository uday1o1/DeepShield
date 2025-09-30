import { initSession } from "./session";

export type FaceCrop = { id: number; bitmap: ImageBitmap };
const SIZE = 224;

export async function analyzeBatch(crops: FaceCrop[]): Promise<{ id:number; score:number }[]> {
  if (!crops.length) return [];
  const session = await initSession();
  // @ts-ignore
  const ort = (await import("onnxruntime-web"));

  const N = crops.length;
  const data = new Float32Array(N * 3 * SIZE * SIZE);

  for (let n=0; n<N; n++) {
    const off = new OffscreenCanvas(SIZE, SIZE);
    const ctx = off.getContext("2d")!;
    ctx.drawImage(crops[n].bitmap, 0, 0, SIZE, SIZE);
    const img = ctx.getImageData(0, 0, SIZE, SIZE).data;
    for (let i=0, px=0; i<img.length; i+=4, px++) {
      const r = img[i] / 255, g = img[i+1] / 255, b = img[i+2] / 255;
      const y = (px / SIZE) | 0, x = px % SIZE, idx = y * SIZE + x;
      const base = n * 3 * SIZE * SIZE;
      data[base + idx] = r;
      data[base + SIZE*SIZE + idx] = g;
      data[base + 2*SIZE*SIZE + idx] = b;
    }
    crops[n].bitmap.close();
  }

  const input = new ort.Tensor("float32", data, [N, 3, SIZE, SIZE]);
  const out = await session.run({ "input": input });
  const key = out["prob"] ? "prob" : Object.keys(out)[0];
  const arr = Array.from(out[key].data as Float32Array);

  return arr.map((score, i) => ({ id: crops[i].id, score }));
}
