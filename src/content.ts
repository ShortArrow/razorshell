import { isTextField, keyEventHandling } from "./keyhandling";
import { initKeymap } from "./keymapstore";
import { loadUrlPolicy, subscribeUrlPolicy } from "./urlpolicy";
import { UrlPolicy, resolveAction } from "./urlrules";

console.log("extension razorshell loaded");

let enabled = true;

function applyUrlPolicy(policy: UrlPolicy) {
  enabled = resolveAction(location.href, policy) !== "deny";
}

loadUrlPolicy().then(applyUrlPolicy);
subscribeUrlPolicy(applyUrlPolicy);
initKeymap();

// Delegate at document level so text fields added after page load are
// also covered, unlike per-element listeners bound once at injection.
document.addEventListener(
  "keydown",
  (event) => {
    if (!enabled) return;
    const target = event.target;
    if (!isTextField(target)) return;
    keyEventHandling(event, target);
  },
  { capture: true },
);
