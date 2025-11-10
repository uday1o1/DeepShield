const DEFAULT_THRESHOLD = 0.80;
let lastNotifAt = 0;

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

function isYouTube(url) {
  return !!url && /https?:\/\/(www\.)?youtube\.com\//i.test(url);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function pingContent(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "DF_PING" }, () => {
      resolve(!chrome.runtime.lastError);
    });
  });
}

async function ensureContent(tabId) {
  const alive = await pingContent(tabId);
  if (alive) return true;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content/content.js"]
    });
    return await pingContent(tabId);
  } catch (e) {
    console.warn("Failed to inject content script:", e);
    return false;
  }
}

// Popup -> start
chrome.runtime.onMessage.addListener(async (msg, _sender, sendResponse) => {
  if (msg?.type === "CMD_START") {
    const tab = await getActiveTab();
    if (!tab?.id || !isYouTube(tab.url)) {
      sendResponse?.({ ok: false, error: "Not a youtube.com tab." });
      return true;
    }
    const ready = await ensureContent(tab.id);
    if (!ready) {
      sendResponse?.({ ok: false, error: "Content script not available." });
      return true;
    }
    await chrome.storage.local.set({ df_sessionActive: true, df_sessionCount: 0, df_sessionTabId: tab.id });
    chrome.action.setBadgeText({ text: "ON" });
    chrome.tabs.sendMessage(tab.id, { type: "DF_START" });
    sendResponse?.({ ok: true });
    return true;
  }

  if (msg?.type === "CMD_STOP") {
    const st = await chrome.storage.local.get(["df_sessionTabId"]);
    if (st.df_sessionTabId) chrome.tabs.sendMessage(st.df_sessionTabId, { type: "DF_STOP" });
    await chrome.storage.local.set({ df_sessionActive: false, df_sessionCount: 0, df_sessionTabId: null });
    chrome.action.setBadgeText({ text: "" });
    sendResponse?.({ ok: true });
    return true;
  }
});

// Content -> background
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type === "DF_HIT") {
    const st = await chrome.storage.local.get(["df_sessionActive", "df_sessionCount"]);
    if (!st.df_sessionActive) return;

    const newCount = (st.df_sessionCount || 0) + 1;
    await chrome.storage.local.set({ df_sessionCount: newCount });
    chrome.action.setBadgeText({ text: String(newCount) });

    // throttle notifications (6s min)
    const now = Date.now();
    if (now - lastNotifAt > 6000) {
      lastNotifAt = now;
      chrome.notifications.create({
        type: "basic",
        iconUrl: "assets/icon128.png",
        title: "Possible deepfake detected",
        message: "A sampled frame crossed your confidence threshold.",
        silent: true
      });
    }
    return;
  }

  if (msg?.type === "DF_SESSION_OFF") {
    await chrome.storage.local.set({ df_sessionActive: false, df_sessionTabId: null });
    chrome.action.setBadgeText({ text: "" });
  }
});
