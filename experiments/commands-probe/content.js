// Answers whether the focused element is a text field the real extension
// would act on. Deliberately the same test razorshell uses.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "probe-focus") return;
  const el = document.activeElement;
  const types = ["text", "search", "url", "tel", "password"];
  const focused =
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && types.includes(el.type)) ||
    (el instanceof HTMLElement && el.isContentEditable);
  sendResponse({ textFieldFocused: focused });
});
