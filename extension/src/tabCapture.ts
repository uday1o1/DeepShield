export async function captureActiveTabStream(): Promise<MediaStream> {
  return await new Promise((resolve, reject) => {
    chrome.tabCapture.capture(
      { video: true, audio: false, videoConstraints: { mandatory: { maxWidth: 1280, maxHeight: 720 } } },
      (stream) => stream ? resolve(stream) : reject(new Error(chrome.runtime.lastError?.message))
    );
  });
}
