export async function startCapture() {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const [vTrack] = stream.getVideoTracks();
  vTrack.onended = () => stopCapture();
  return stream;
}

export function makeFrameReader(stream) {
  const [vTrack] = stream.getVideoTracks();
  const msp = new MediaStreamTrackProcessor({ track: vTrack });
  return msp.readable.getReader();
}

export async function stopCapture(reader) {
  try { reader?.releaseLock(); } catch {}
  const tracks = (await navigator.mediaDevices.getDisplayMedia?.streams) || []; // defensive
  // The actual stream tracks are owned by the caller; just stop what we have access to
  if (tracks && tracks.forEach) tracks.forEach(t => t.stop());
}
