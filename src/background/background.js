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

chrome.action.onClicked.addListener(async (tab) => {
  const { df_sessionActive } = await chrome.storage.local.get("df_sessionActive");
  if (!df_sessionActive) {
    await chrome.storage.local.set({ df_sessionActive: true, df_sessionCount: 0, df_sessionTabId: tab.id });
    chrome.action.setBadgeText({ text: "ON" });
    chrome.tabs.sendMessage(tab.id, { type: "DF_START" });
  } else {
    const { df_sessionTabId } = await chrome.storage.local.get("df_sessionTabId");
    if (df_sessionTabId) chrome.tabs.sendMessage(df_sessionTabId, { type: "DF_STOP" });
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
});
