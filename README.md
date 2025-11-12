# DeepShield

A Chrome extension that analyzes video frames from a YouTube **watch** tab you share, checks them with a deepfake detector, and **warns via system notifications**. Control everything from the **popup**—no page overlay.

## Features

* **Popup controls:** Start / Stop, confidence slider, detection counter
* **Notifications** on possible detections; **badge** shows count
* Works across **YouTube SPA** navigation (auto-resets per video)
* Local processing using **getDisplayMedia** (user-consented screen share)

## Quick Start

1. Load unpacked at `chrome://extensions` (Developer mode → **Load unpacked**).
2. Open a YouTube **watch** page: `https://www.youtube.com/watch?v=...`.
3. Click the extension icon → **Start**.

   * In the share dialog, prefer **This Tab**; if not shown, choose **Window → your browser window**.
4. Adjust **Confidence** in the popup. **Stop** to end the session.

## Project Structure

```
deepfake-watch/
├─ manifest.json
├─ popup.html
├─ popup.js
├─ src/
│  ├─ background/background.js
│  └─ content/content.js
└─ assets/
   ├─ icon16.png
   ├─ icon48.png
   └─ icon128.png
```

## How It Works

* **Popup** sends `CMD_START / CMD_STOP` and writes the confidence threshold.
* **Background** ensures the content script is present, tracks session state, updates the badge, and shows notifications on detection (`DF_HIT`).
* **Content script** requests screen share, samples frames periodically, scores them, smooths with EMA, and signals detections to background.

## Configuration (in code)

* Sampling interval: `content.js` → `now - lastSample >= 3000` (ms).
* EMA & trigger: `alpha`, `windowK`, `windowN`.
* Default threshold: `background.js` → `DEFAULT_THRESHOLD`.

## Permissions

`storage`, `scripting`, `activeTab`, `notifications`
Host permissions: `*://*.youtube.com/*`

## Privacy

Analyzes **only** what you explicitly share via the browser’s screen-share prompt. Processing stays **local**.

## Troubleshooting

* “Could not start on this tab”: ensure you’re on a `youtube.com/watch` page; reload the extension; pick **Window** in the share dialog if **This Tab** isn’t listed.
* No notifications: check OS/browser notification permissions.
