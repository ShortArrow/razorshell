/**
 * @file yank.ts
 * @brief Inserting ring text into a field, and the record that lets a yank-pop
 *        replace what a yank just put there.
 *
 * Insertion goes through `execCommand("insertText")`, which is what makes the
 * yank join the field's own undo stack and raise an `input` event the page can
 * see — the same reasoning, and the same measured basis (2026-08-20), as the
 * deletion in `killregion.ts`. Where `execCommand` is absent or refuses (jsdom,
 * and any engine that drops it) the value is spliced instead; that path puts the
 * right text in the right place but claims no undo and emits no event, exactly
 * the degradation `applyKillRegion` documents.
 *
 * Yank-pop is a replacement, and a replacement aimed at the wrong range destroys
 * text the user never offered. So it never trusts its own memory: the recorded
 * region must still read back as the text that was inserted, in the same
 * element, or the pop is refused outright.
 */
import type { TextField } from "./operation";

/**
 * What the last yank put into a field, and where.
 *
 * The field is held weakly. A record outlives the yank only until the next
 * command, but nothing guarantees a next command: a page that removes the field
 * — an SPA swapping a view, a dialog closing — would otherwise leave this module
 * pinning the detached element, and through it the subtree, for as long as the
 * frame lives. A strong reference here buys nothing, because a record whose
 * field is gone can never verify anyway.
 *
 * The leak fix has no behavioral test: garbage collection cannot be forced from
 * a test, so nothing can observe the difference between a weak and a strong
 * reference. Reviewers must check this one by reading it.
 */
interface YankRecord {
  field: WeakRef<TextField>;
  start: number;
  end: number;
  text: string;
}

let lastYank: YankRecord | null = null;

/**
 * Inserts text at the caret, replacing any active selection, and records the
 * region so a following yank-pop knows what it may replace.
 */
export function applyYank(field: TextField, text: string): void {
  if (field.readOnly || field.disabled) return;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  replaceRange(field, start, end, text);
  lastYank = { field: new WeakRef(field), start, end: start + text.length, text };
}

/**
 * Replaces what the last yank inserted with `text`, re-recording the new region.
 *
 * The caller must have checked `canYankPop` first; this repeats the check rather
 * than trusting it, because acting on a stale record is the one failure mode
 * that costs the user text.
 */
export function applyYankPop(field: TextField, text: string): boolean {
  if (!canYankPop(field)) return false;
  const record = lastYank!;
  replaceRange(field, record.start, record.end, text);
  lastYank = { field: new WeakRef(field), start: record.start, end: record.start + text.length, text };
  return true;
}

/**
 * Whether the region the last yank recorded still holds exactly what was put
 * there, with the caret still resting at its end.
 *
 * The verification is text AND place, and both halves are load-bearing. The text
 * check catches a value that changed under the record — a page script rewriting
 * the field, an undo. The place check catches everything that moved the caret
 * without changing that region, and that is the wider class: an arrow key, a
 * click, a selection, a keystroke elsewhere in the field.
 *
 * The place check is also what makes the ring's last-command tracking honest. A
 * keystroke matching no binding never reaches the dispatcher's reporting path,
 * so it cannot announce itself to the ring and cannot break the chain that way.
 * What such a keystroke does do is move the caret, and this is the check that
 * sees it — which is why an unmatched key can be left unreported safely.
 *
 * The selection must be collapsed: a range ending exactly at the recorded end
 * still means the user selected something, and replacing the record's region
 * would discard that selection's own text.
 *
 * A field the record can no longer reach — collected, so the weak reference is
 * dead — is a mismatch like any other.
 */
export function canYankPop(field: TextField): boolean {
  if (lastYank === null) return false;
  if (lastYank.field.deref() !== field) return false;
  if (field.selectionStart !== lastYank.end) return false;
  if (field.selectionEnd !== lastYank.end) return false;
  return field.value.slice(lastYank.start, lastYank.end) === lastYank.text;
}

/** Forgets the recorded region, so no later pop can act on it. */
export function noteYankPopFailure(): void {
  lastYank = null;
}

/**
 * Drops the recorded region, as the frame going quiet would.
 *
 * The companion to `clearRing`: the entries and the record describe one state
 * between them, and clearing only the entries leaves a record pointing at text
 * no rotation can reach — a pop that cancels the key while doing nothing.
 */
export function clearYankRecord(): void {
  lastYank = null;
}

/** Selects a range and writes text over it, natively where the engine allows. */
function replaceRange(field: TextField, start: number, end: number, text: string): void {
  field.setSelectionRange(start, end);
  if (!insertText(field, text)) {
    field.value = field.value.slice(0, start) + text + field.value.slice(end);
  }
  const caret = start + text.length;
  field.setSelectionRange(caret, caret);
}

/** The native insertion, reported as whether the engine actually performed it. */
function insertText(field: TextField, text: string): boolean {
  if (typeof document.execCommand !== "function") return false;
  field.focus();
  try {
    return document.execCommand("insertText", false, text);
  } catch {
    return false;
  }
}
