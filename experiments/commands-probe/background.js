// The command only ever fires if the user managed to assign Ctrl+W to it in
// chrome://extensions/shortcuts — which is the fact this probe measures.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "rubout-or-close") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  let focused = false;
  try {
    const reply = await chrome.tabs.sendMessage(tab.id, { type: "probe-focus" });
    focused = reply?.textFieldFocused === true;
  } catch {
    // No content script (chrome:// page etc.): treat as not focused.
  }
  if (focused) {
    // Visible proof the chord was intercepted while typing.
    await chrome.action.setBadgeText({ tabId: tab.id, text: "W" });
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#5d1cff" });
  } else {
    // "Give it back to the browser": reproduce the close ourselves.
    await chrome.tabs.remove(tab.id);
  }
});
