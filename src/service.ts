/**
 * @file service.ts
 * @brief The background worker, forwarding the toolbar click to the content
 *        script as a request to enter inspect mode, reflecting the per-tab
 *        effective state of razorshell on the toolbar badge, and routing the
 *        two reclaimed chords by what the active tab has focused.
 */

import { commandAction, type FocusState } from "./commandroute";

const inspectMessage = "razorshell-inspect";
const stateMessage = "razorshell-state";
const focusQueryMessage = "razorshell-focus-query";
const runOperationMessage = "razorshell-run-operation";
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

/**
 * What the tab reports about its focus, or a not-focused answer.
 *
 * Every failure collapses to the same conservative reading: a chrome:// page or
 * the Web Store admits no content script, a frame still starting up has no
 * listener yet, and both raise here. Treating silence as "no text field" is what
 * makes the reclaimed chord fall back to the browser action the user expects
 * anywhere razorshell is not actually running.
 */
async function askFocus(tabId: number): Promise<FocusState> {
  try {
    const reply = (await chrome.tabs.sendMessage(tabId, { type: focusQueryMessage })) as
      | { textFieldFocused?: boolean; enabled?: boolean }
      | undefined;
    return {
      textFieldFocused: reply?.textFieldFocused === true,
      enabled: reply?.enabled !== false,
    };
  } catch {
    return { textFieldFocused: false, enabled: false };
  }
}

/**
 * A chord the user assigned in chrome://extensions/shortcuts, routed by focus.
 *
 * The listener is a shell: it gathers the two facts the decision needs and hands
 * them to `commandAction`, which is pure and unit-tested — the reserved chords
 * cannot be pressed under CDP (see R7 and the 2026-08-20 measurement record), so
 * keeping the decision out of the worker is what lets it be tested at all.
 *
 * The `close-tab` and `new-tab` arms are not fallbacks but the feature: taking a
 * chord from the browser means owing back what it did.
 */
chrome.commands.onCommand.addListener((command) => {
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return;
    const action = commandAction(command, await askFocus(tab.id));
    switch (action.kind) {
      case "run":
        await chrome.tabs.sendMessage(tab.id, {
          type: runOperationMessage,
          operation: action.operation,
        });
        return;
      case "close-tab":
        await chrome.tabs.remove(tab.id);
        return;
      case "new-tab":
        await chrome.tabs.create({});
        return;
      case "ignore":
        return;
    }
  })().catch(() => {});
});
