async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
function isYouTube(url) {
  return !!url && /https?:\/\/(www\.)?youtube\.com\//i.test(url);
}

async function refreshUI() {
  const st = await chrome.storage.local.get(["df_sessionActive", "df_sessionCount", "df_threshold"]);
  document.getElementById("status").textContent = st.df_sessionActive ? "ON" : "OFF";
  document.getElementById("count").textContent = st.df_sessionCount || 0;

  const th = typeof st.df_threshold === "number" ? st.df_threshold : 0.8;
  document.getElementById("slider").value = th;
  document.getElementById("thVal").textContent = th.toFixed(2);

  document.getElementById("startBtn").style.display = st.df_sessionActive ? "none" : "block";
  document.getElementById("stopBtn").style.display  = st.df_sessionActive ? "block" : "none";
}

async function startClicked() {
  const tab = await getActiveTab();
  const warn = document.getElementById("warn");
  warn.style.display = "none";

  if (!isYouTube(tab?.url)) {
    warn.textContent = "Open a youtube.com watch page to start.";
    warn.style.display = "block";
    return;
  }

  chrome.runtime.sendMessage({ type: "CMD_START", tabId: tab.id }, (resp) => {
    if (chrome.runtime.lastError || resp?.ok === false) {
      warn.textContent = resp?.error || "Could not start on this tab.";
      warn.style.display = "block";
    } else {
      refreshUI();
    }
  });
}

async function stopClicked() {
  chrome.runtime.sendMessage({ type: "CMD_STOP" }, () => refreshUI());
}

async function sliderChanged(e) {
  const v = Number(e.target.value);
  document.getElementById("thVal").textContent = v.toFixed(2);
  await chrome.storage.local.set({ df_threshold: v });
  // push to active tab immediately (optional)
  const tab = await getActiveTab();
  if (isYouTube(tab?.url)) {
    chrome.tabs.sendMessage(tab.id, { type: "DF_SET_THRESHOLD", value: v });
  }
}

document.getElementById("startBtn").addEventListener("click", startClicked);
document.getElementById("stopBtn").addEventListener("click", stopClicked);
document.getElementById("slider").addEventListener("input", sliderChanged);

// live updates while popup is open
chrome.storage.onChanged.addListener((changes) => {
  if (changes.df_sessionCount || changes.df_sessionActive || changes.df_threshold) refreshUI();
});

refreshUI();
