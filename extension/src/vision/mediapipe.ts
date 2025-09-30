import { FilesetResolver, FaceDetector, FaceDetectorResult } from "@mediapipe/tasks-vision";

let detector: FaceDetector | null = null;

export async function getFaceDetector(): Promise<FaceDetector> {
  if (detector) return detector;

  const wasmBase = chrome.runtime.getURL("vendor/mediapipe/wasm");
  const vision = await FilesetResolver.forVisionTasks(wasmBase);

  detector = await FaceDetector.createFromOptions(vision, {
    runningMode: "VIDEO",
    baseOptions: { modelAssetPath: undefined }, // built-in short-range face detector
    minDetectionConfidence: 0.5
  });

  return detector;
}

export type MPFace = {
  bbox: { x:number; y:number; width:number; height:number }; // normalized 0..1
  score: number;
};

export function toBoxes(res: FaceDetectorResult, width: number, height: number): MPFace[] {
  return (res.detections ?? []).map(d => {
    const bb = d.boundingBox;
    return {
      bbox: {
        x: bb.originX / width,
        y: bb.originY / height,
        width: bb.width / width,
        height: bb.height / height
      },
      score: d.categories?.[0]?.score ?? 0
    };
  });
}
