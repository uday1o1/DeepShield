const DEFAULT_THRESHOLD = 0.80;

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    df_threshold: DEFAULT_THRESHOLD,
    df_sessionActive: false,
    df_sessionCount: 0,
    df_sessionTabId: null
  });
  chrome.action.setBadgeBackgroundColor({ color: "#000" });
  chrome.action.setBadgeText({ text: "" });
});

// Ping helper to see if the content script is alive
async function ping(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "DF_PING" }, () => {
      const ok = !chrome.runtime.lastError;
      resolve(ok);
    });
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;

  // Only operate on YouTube tabs
  if (!/https?:\/\/(www\.)?youtube\.com\//i.test(tab.url)) {
    chrome.action.setBadgeText({ text: "" });
    chrome.notifications?.create?.({
      type: "basic",
      iconUrl: "assets/icon48.png",
      title: "Deepfake Watch",
      message: "Open a YouTube tab, then click the icon to start."
    });
    return;
  }

  const { df_sessionActive } = await chrome.storage.local.get("df_sessionActive");
  const alive = await ping(tab.id);

  if (!alive) {
    // Try to inject the content script (MV3)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content/content.js"]
      });
    } catch (e) {
      console.warn("Failed to inject content script:", e);
    }
  }

  if (!df_sessionActive) {
    await chrome.storage.local.set({ df_sessionActive: true, df_sessionCount: 0, df_sessionTabId: tab.id });
    chrome.action.setBadgeText({ text: "ON" });
    chrome.tabs.sendMessage(tab.id, { type: "DF_START" }, () => {
      if (chrome.runtime.lastError) {
        // If still failing, clear state
        chrome.action.setBadgeText({ text: "" });
        chrome.storage.local.set({ df_sessionActive: false, df_sessionTabId: null });
      }
    });
  } else {
    const { df_sessionTabId } = await chrome.storage.local.get("df_sessionTabId");
    if (df_sessionTabId) {
      chrome.tabs.sendMessage(df_sessionTabId, { type: "DF_STOP" });
    }
    await chrome.storage.local.set({ df_sessionActive: false, df_sessionCount: 0, df_sessionTabId: null });
    chrome.action.setBadgeText({ text: "" });
  }
});

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type === "DF_HIT") {
    const st = await chrome.storage.local.get(["df_sessionActive", "df_sessionCount"]);
    if (!st.df_sessionActive) return;
    const newCount = (st.df_sessionCount || 0) + 1;
    await chrome.storage.local.set({ df_sessionCount: newCount });
    chrome.action.setBadgeText({ text: String(newCount) });
  }
  if (msg?.type === "DF_SESSION_OFF") {
    await chrome.storage.local.set({ df_sessionActive: false, df_sessionTabId: null });
    chrome.action.setBadgeText({ text: "" });
  }
  if (msg?.type === "DF_READY") {
    // no-op, but confirms content script is loaded
  }
});
