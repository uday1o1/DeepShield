import * as ort from "onnxruntime-web";

let session: ort.InferenceSession | null = null;

export async function initSession(): Promise<ort.InferenceSession> {
  if (session) return session;

  const providers: ort.InferenceSession.SessionOptions["executionProviders"] = [];
  // @ts-ignore
  if ("gpu" in navigator) providers.push("webgpu");
  providers.push("wasm");

  session = await ort.InferenceSession.create(
    chrome.runtime.getURL("models/deepshield.onnx"),
    { executionProviders: providers, graphOptimizationLevel: "all" }
  );

  // Warmup
  const warm = new ort.Tensor("float32", new Float32Array(1 * 3 * 224 * 224), [1, 3, 224, 224]);
  await session.run({ "input": warm });

  return session;
}
