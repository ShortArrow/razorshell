import { probeConflicts } from "./inspect";
import { showToast } from "./inspecttoast";
import { isTextField, keyEventHandling } from "./keyhandling";
import { keyChord } from "./keychord";
import { getActiveKeymap, initKeymap } from "./keymapstore";
import { getMessage } from "./languages";
import { Keymap, TextField } from "./operation";
import { loadUrlPolicy, subscribeUrlPolicy } from "./urlpolicy";
import { UrlPolicy, resolveAction } from "./urlrules";

console.log("extension razorshell loaded");

const inspectMessage = "razorshell-inspect";

let enabled = true;
let inspecting = false;

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
    if (!event.isTrusted) return;
    if (!enabled) return;
    const target = event.target;
    if (!isTextField(target)) return;
    keyEventHandling(event, target);
  },
  { capture: true },
);

function chordLabel(entry: Keymap): string {
  return keyChord({
    key: entry.key,
    ctrlKey: entry.ctrl === true,
    altKey: entry.alt === true,
    shiftKey: entry.shift === true,
  }).join("+");
}

function conflictLines(conflicts: Keymap[]): string[] {
  return conflicts.map((entry) => `${chordLabel(entry)} — ${entry.label}`);
}

function reportConflicts(conflicts: Keymap[]): void {
  const lines = conflictLines(conflicts);
  if (conflicts.length === 0) {
    console.log("razorshell inspect: no conflicts", []);
    showToast(getMessage("inspect_no_conflicts")(), []);
    return;
  }
  console.log("razorshell inspect: conflicts", lines);
  showToast(getMessage("inspect_conflicts_title")(), lines);
}

function inspectField(field: TextField): void {
  reportConflicts(probeConflicts(field, getActiveKeymap()));
}

function stopInspecting(): void {
  if (!inspecting) return;
  inspecting = false;
  document.documentElement.style.cursor = "";
  document.removeEventListener("click", onInspectClick, { capture: true });
  document.removeEventListener("keydown", onInspectKeydown, { capture: true });
}

function onInspectClick(event: MouseEvent): void {
  const target = event.target;
  if (!isTextField(target)) return;
  event.preventDefault();
  event.stopPropagation();
  stopInspecting();
  inspectField(target);
}

function onInspectKeydown(event: KeyboardEvent): void {
  if (!event.isTrusted || event.key !== "Escape") return;
  stopInspecting();
}

function startInspecting(): void {
  if (inspecting) return;
  inspecting = true;
  document.documentElement.style.cursor = "crosshair";
  document.addEventListener("click", onInspectClick, { capture: true });
  document.addEventListener("keydown", onInspectKeydown, { capture: true });
  showToast(getMessage("inspect_mode_hint")(), []);
}

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message.type !== inspectMessage) return;
  startInspecting();
});
