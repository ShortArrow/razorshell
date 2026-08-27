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

/** What the last yank put into a field, and where. */
interface YankRecord {
  field: TextField;
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
  lastYank = { field, start, end: start + text.length, text };
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
  lastYank = { field, start: record.start, end: record.start + text.length, text };
  return true;
}

/**
 * Whether the region the last yank recorded still holds exactly what was put
 * there. A different element, an edited value, or a caret-driven change since —
 * anything that makes the record no longer describe the field — answers no.
 */
export function canYankPop(field: TextField): boolean {
  if (lastYank === null) return false;
  if (lastYank.field !== field) return false;
  return field.value.slice(lastYank.start, lastYank.end) === lastYank.text;
}

/** Forgets the recorded region, so no later pop can act on it. */
export function noteYankPopFailure(): void {
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
