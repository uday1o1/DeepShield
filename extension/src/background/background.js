// src/background/background.js
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    df_sessionActive: false,
    df_sessionCount: 0,
    df_threshold: 0.8
  });
});

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const tab = await activeTab();
    if (!tab) return sendResponse({ ok: false, error: "No active tab." });

    if (msg.type === "CMD_START") {
      await chrome.storage.local.set({ df_sessionActive: true, df_sessionCount: 0 });
      chrome.tabs.sendMessage(tab.id, { type: "DF_START" }, (resp) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse(resp || { ok: true });
        }
      });
      return;
    }

    if (msg.type === "CMD_STOP") {
      await chrome.storage.local.set({ df_sessionActive: false });
      chrome.tabs.sendMessage(tab.id, { type: "DF_STOP" }, () => sendResponse({ ok: true }));
      return;
    }

    if (msg.type === "DF_BUMP_COUNT") {
      chrome.storage.local.get(["df_sessionCount"]).then((st) => {
        const next = (st.df_sessionCount || 0) + 1;
        chrome.storage.local.set({ df_sessionCount: next });
      });
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "DF_NOTIFY") {
      const p = msg.payload?.pFake ?? 0;
      chrome.notifications?.create?.({
        type: "basic",
        iconUrl: "assets/icon48.png",
        title: "DeepShield",
        message: `High deepfake risk: ${(p * 100).toFixed(1)}%`
      });
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "Unknown command" });
  })();
  return true; // async
});
