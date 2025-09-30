chrome.runtime.onMessage.addListener((msg) => {
  (async () => {
    if (msg.type === "START_ANALYSIS") {
      await ensureOffscreen();
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      chrome.runtime.sendMessage({ type: "OFFSCREEN_START", tabId: tab?.id });
    }
    if (msg.type === "STOP_ANALYSIS") {
      chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP" });
      await closeOffscreen();
    }
  })();
  return true;
});

async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument();
  if (!has) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["BLOBS"],
      justification: "Run local AI inference on captured tab frames."
    });
  }
}

async function closeOffscreen() {
  if (await chrome.offscreen.hasDocument()) {
    await chrome.offscreen.closeDocument();
  }
}
