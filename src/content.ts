import { loadContentEditableSetting, subscribeContentEditableSetting } from "./contenteditablesetting";
import { analyzeHandlerSource } from "./handleranalysis";
import { showToast } from "./inspecttoast";
import { dispatchEditableKey, isEditableTarget, isTextField, keyEventHandling, resolveEventTarget } from "./keyhandling";
import { keyChord } from "./keychord";
import { Chord } from "./keymapmerge";
import { getActiveKeymap, initKeymap } from "./keymapstore";
import { getMessage } from "./languages";
import { Keymap } from "./operation";
import { loadUrlPolicy, subscribeUrlPolicy } from "./urlpolicy";
import { UrlPolicy, resolveAction } from "./urlrules";

console.log("extension razorshell loaded");

const inspectMessage = "razorshell-inspect";
const stateMessage = "razorshell-state";

let enabled = true;
let inspecting = false;
let editableEnabled = false;

function applyEditableSetting(value: boolean): void {
  editableEnabled = value;
}

function reportState(): void {
  if (window !== window.top) return;
  chrome.runtime.sendMessage({ type: stateMessage, enabled }).catch(() => {});
}

let urlPolicy: UrlPolicy | null = null;

function applyUrlPolicy(policy: UrlPolicy) {
  urlPolicy = policy;
  enabled = resolveAction(location.href, policy) !== "deny";
  reportState();
}

// A same-document navigation keeps this script alive at a new location, so the
// decision has to be taken again against the policy already in hand.
function reapplyUrlPolicy(): void {
  if (urlPolicy === null) return;
  applyUrlPolicy(urlPolicy);
}

// The console is this script's only surface: an init that fails silently
// leaves the keybindings inert with nothing to diagnose from.
loadUrlPolicy({ migrate: window === window.top }).then(applyUrlPolicy).catch(console.error);
subscribeUrlPolicy(applyUrlPolicy);
document.addEventListener("razorshell-navigate", reapplyUrlPolicy);
window.addEventListener("popstate", reapplyUrlPolicy);
window.addEventListener("hashchange", reapplyUrlPolicy);
loadContentEditableSetting().then(applyEditableSetting).catch(console.error);
subscribeContentEditableSetting(applyEditableSetting);
initKeymap().catch(console.error);

// Delegate at document level so text fields added after page load are
// also covered, unlike per-element listeners bound once at injection.
document.addEventListener(
  "keydown",
  (event) => {
    if (!event.isTrusted) return;
    if (!enabled) return;
    const target = resolveEventTarget(event);
    if (isTextField(target)) {
      keyEventHandling(event, target);
      return;
    }
    if (!editableEnabled || !isEditableTarget(target)) return;
    dispatchEditableKey(event, target, getActiveKeymap());
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

const queryEvent = "razorshell-inspect-query";
const resultEvent = "razorshell-inspect-result";
const queryTimeout = 300;

interface InspectReport {
  sources: string[];
  observed: Chord[];
}

const emptyReport: InspectReport = { sources: [], observed: [] };

function parseReport(detail: unknown): InspectReport {
  if (typeof detail !== "string") return emptyReport;
  try {
    const parsed = JSON.parse(detail) as Partial<InspectReport>;
    return {
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      observed: Array.isArray(parsed.observed) ? parsed.observed : [],
    };
  } catch {
    return emptyReport;
  }
}

/**
 * Asks the page world what it has registered and observed for this element,
 * treating silence as a page carrying no hook, never as a failure to report.
 */
function queryPageWorld(target: EventTarget): Promise<InspectReport> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (report: InspectReport) => {
      if (settled) return;
      settled = true;
      document.removeEventListener(resultEvent, onResult);
      resolve(report);
    };
    const onResult = (event: Event) => finish(parseReport((event as CustomEvent).detail));
    document.addEventListener(resultEvent, onResult);
    setTimeout(() => finish(emptyReport), queryTimeout);
    target.dispatchEvent(new CustomEvent(queryEvent, { bubbles: true, composed: true }));
  });
}

function sameChord(left: Chord, right: Chord): boolean {
  return (
    left.key === right.key &&
    (left.ctrl === true) === (right.ctrl === true) &&
    (left.alt === true) === (right.alt === true) &&
    (left.shift === true) === (right.shift === true)
  );
}

function entryChord(entry: Keymap): Chord {
  return { key: entry.key, ctrl: entry.ctrl === true, alt: entry.alt === true, shift: entry.shift === true };
}

function entryLine(entry: Keymap): string {
  return `${chordLabel(entry)} — ${entry.label}`;
}

function observedConflicts(observed: Chord[], keymap: Keymap[]): Keymap[] {
  return keymap.filter((entry) => observed.some((chord) => sameChord(chord, entryChord(entry))));
}

interface StaticAnalysis {
  conflicts: Keymap[];
  unknown: number;
}

function chordKey(chord: Chord): string {
  return `${chord.key} ${chord.ctrl === true} ${chord.alt === true} ${chord.shift === true}`;
}

function analyzeSources(sources: string[], keymap: Keymap[]): StaticAnalysis {
  const chords = keymap.map(entryChord);
  const hits = new Set<string>();
  let unknown = 0;
  for (const source of sources) {
    const found = analyzeHandlerSource(source, chords);
    if (found.length === 0) {
      unknown += 1;
      continue;
    }
    for (const chord of found) hits.add(chordKey(chord));
  }
  return {
    conflicts: keymap.filter((entry) => hits.has(chordKey(entryChord(entry)))),
    unknown,
  };
}

function buildLines(report: InspectReport, keymap: Keymap[]): string[] {
  const confirmed = observedConflicts(report.observed, keymap);
  const { conflicts, unknown } = analyzeSources(report.sources, keymap);
  const lines: string[] = [];
  if (confirmed.length > 0) {
    lines.push(getMessage("inspect_observed_title")());
    for (const entry of confirmed) lines.push(entryLine(entry));
  }
  if (conflicts.length > 0) {
    lines.push(getMessage("inspect_static_title")());
    for (const entry of conflicts) lines.push(entryLine(entry));
  }
  if (unknown > 0) lines.push(`${getMessage("inspect_unknown_listeners")()}${unknown}`);
  return lines;
}

async function inspectTarget(target: EventTarget): Promise<void> {
  const report = await queryPageWorld(target);
  const lines = buildLines(report, getActiveKeymap());
  if (lines.length === 0) {
    console.log("razorshell inspect: no conflicts", []);
    showToast(getMessage("inspect_no_conflicts")(), []);
    return;
  }
  console.log("razorshell inspect", lines);
  showToast(lines[0], lines.slice(1));
}

function stopInspecting(): void {
  if (!inspecting) return;
  inspecting = false;
  document.documentElement.style.cursor = "";
  document.removeEventListener("click", onInspectClick, { capture: true });
  document.removeEventListener("keydown", onInspectKeydown, { capture: true });
}

function onInspectClick(event: MouseEvent): void {
  const target = resolveEventTarget(event);
  const inspectable = isTextField(target) || (editableEnabled && isEditableTarget(target));
  if (!inspectable || target === null) return;
  event.preventDefault();
  event.stopPropagation();
  stopInspecting();
  inspectTarget(target).catch(console.error);
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

document.addEventListener("razorshell-status-query", () => {
  document.dispatchEvent(
    new CustomEvent("razorshell-status", {
      detail: JSON.stringify({ enabled, contentEditable: editableEnabled }),
    }),
  );
});
