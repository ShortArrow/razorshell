/**
 * @file service.ts
 * @brief The background worker, forwarding the toolbar click to the content
 *        script as a request to enter inspect mode, and reflecting the
 *        per-tab effective state of razorshell on the toolbar badge.
 */

const inspectMessage = "razorshell-inspect";
const stateMessage = "razorshell-state";
const disabledBadgeText = "✕";
const disabledBadgeColor = "#b91c1c";

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  chrome.tabs.sendMessage(tab.id, { type: inspectMessage }).catch(() => {});
});

function showState(tabId: number, enabled: boolean): void {
  chrome.action
    .setBadgeText({ tabId, text: enabled ? "" : disabledBadgeText })
    .catch(() => {});
  if (enabled) return;
  chrome.action
    .setBadgeBackgroundColor({ tabId, color: disabledBadgeColor })
    .catch(() => {});
}

chrome.runtime.onMessage.addListener(
  (message: { type?: string; enabled?: boolean }, sender) => {
    if (message.type !== stateMessage) return;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    showState(tabId, message.enabled === true);
  },
);
