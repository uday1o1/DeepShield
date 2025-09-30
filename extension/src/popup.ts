const startBtn = document.getElementById('start') as HTMLButtonElement | null;
const stopBtn  = document.getElementById('stop')  as HTMLButtonElement | null;

startBtn?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'START_ANALYSIS' });
});

stopBtn?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_ANALYSIS' });
});
