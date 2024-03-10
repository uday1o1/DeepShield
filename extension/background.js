// Listen for events, such as when the extension is installed, updated, or a message is received
chrome.runtime.onInstalled.addListener(function() {
    console.log('Extension installed');
});

// Example: Listen for messages from content scripts or other parts of the extension
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log('Message received:', message);

    // Example: Send a response back to the sender
    sendResponse({ received: true });
});
