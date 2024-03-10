// Example: Listen for page load event
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded');

    // Example: Send a message to the background script
    chrome.runtime.sendMessage({ greeting: 'Hello from content script!' }, function(response) {
        console.log('Response from background script:', response);
    });
});
