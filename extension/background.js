chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url.includes("radiko.jp")) return;

  const seconds = command === "skip-forward" ? 10 : -10;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sec) => {
      window.dispatchEvent(new CustomEvent('radiko-skip-request', {
        detail: { seconds: sec }
      }));
    },
    args: [seconds],
    world: "MAIN"
  });
});
