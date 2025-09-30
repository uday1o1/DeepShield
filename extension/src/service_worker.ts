console.log("[DeepShield] service worker loaded");

chrome.runtime.onMessage.addListener((msg) => {
  (async () => {
    try {
      if (msg.type === "START_ANALYSIS") {
        console.log("[DeepShield] START_ANALYSIS");
        const ok = await ensureOffscreen();
        if (!ok) {
          console.error("[DeepShield] offscreen NOT created");
          return;
        }
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab?.id) {
          console.warn("[DeepShield] No active tab id");
          return;
        }
        safeSendRuntime({ type: "OFFSCREEN_START", tabId: tab.id });
      }

      if (msg.type === "STOP_ANALYSIS") {
        console.log("[DeepShield] STOP_ANALYSIS");
        // Only try to stop if the offscreen doc exists
        if (await chrome.offscreen.hasDocument()) {
          safeSendRuntime({ type: "OFFSCREEN_STOP" });
          await closeOffscreen();
        } else {
          console.log("[DeepShield] no offscreen to stop");
        }
      }
    } catch (e) {
      console.error("[DeepShield] SW error:", e);
    }
  })();
  return true;
});

async function ensureOffscreen(): Promise<boolean> {
  try {
    const has = await chrome.offscreen.hasDocument();
    if (has) {
      console.log("[DeepShield] offscreen already present");
      return true;
    }
    console.log("[DeepShield] creating offscreen (IFRAME_SCRIPTING)...");
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["IFRAME_SCRIPTING"],
      justification: "Run local AI inference on captured tab frames."
    });
    console.log("[DeepShield] offscreen created");
    return true;
  } catch (e) {
    console.warn("[DeepShield] offscreen create failed, retry with BLOBS:", e);
    try {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["BLOBS"],
        justification: "Run local AI inference on captured tab frames."
      });
      console.log("[DeepShield] offscreen created (BLOBS)");
      return true;
    } catch (e2) {
      console.error("[DeepShield] offscreen create failed (BLOBS):", e2);
      return false;
    }
  }
}

async function closeOffscreen() {
  try {
    const has = await chrome.offscreen.hasDocument();
    if (has) {
      console.log("[DeepShield] closing offscreen");
      await chrome.offscreen.closeDocument();
    }
  } catch (e) {
    console.warn("[DeepShield] closeOffscreen error:", e);
  }
}

// Send without throwing "receiving end does not exist"
function safeSendRuntime(payload: any) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    chrome.runtime.sendMessage(payload).catch(() => {});
  } catch {}
}
