/**
 * @file service.ts
 * @brief The background worker, forwarding the toolbar click to the content
 *        script as a request to enter inspect mode.
 */

const inspectMessage = "razorshell-inspect";

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  chrome.tabs.sendMessage(tab.id, { type: inspectMessage }).catch(() => {});
});
