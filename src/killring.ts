/**
 * @file killring.ts
 * @brief The kill ring: what kills put in, what yanks take out, and the chain
 *        state machine that decides when consecutive kills are one entry.
 *
 * State is module-level and therefore frame-local. Each frame — the top document
 * and every same-process iframe — runs its own copy of the content script and so
 * owns its own ring; text killed in one frame is never visible in another. None
 * of it is persisted: the ring dies with the frame, and `clearRing` is called
 * when the URL policy turns the frame off, so text killed while the extension
 * was allowed cannot be yanked back after it is denied.
 *
 * Nothing here touches the DOM. `elementToken` is an opaque object reference the
 * caller supplies — the field element, or a contenteditable root — compared only
 * by identity, and `caretAfter` is the caret position the kill left behind. That
 * keeps the whole state machine testable as pure state, and keeps the decision
 * about what counts as "the same place" in one readable place.
 */

/** Entries the ring holds before the oldest is dropped. */
export const ringCapacity = 10;

/**
 * The largest entry the ring stores, in UTF-16 code units.
 *
 * A kill past this size still happens — the text still leaves the field — it is
 * simply not remembered, so a stray Ctrl+K on a novel-sized textarea cannot pin
 * megabytes in the frame for as long as the page lives.
 */
export const ringEntrySizeLimit = 100000;

/** Which end of the caret a kill took its text from. */
export type KillDirection = "forward" | "backward";

/** What a caller reports after removing text from a field. */
export interface KillRecord {
  direction: KillDirection;
  text: string;
  elementToken: object;
  /**
   * Where the caret was when this kill started, and therefore what the previous
   * kill must have left behind for the two to be one run.
   *
   * A forward kill takes text ahead of the caret and leaves it where it was, so
   * this equals `caretAfter`. A backward kill takes text behind the caret and
   * pulls it left, so the two differ — and it is this one, not `caretAfter`,
   * that the chain has to compare against.
   */
  caretBefore: number;
  /** Where the caret sits now, and where the next kill must start to chain. */
  caretAfter: number;
  /** False for a password field: the kill happens, the text is not kept. */
  storable: boolean;
}

/**
 * Where a chained kill would have to land to join the newest entry.
 *
 * The element is held weakly. The chain is transient — the next foreign command
 * drops it — but nothing guarantees a next command, and a page that removes the
 * field after a kill would otherwise leave this module pinning the detached
 * element and its subtree for the life of the frame. Nothing is lost by holding
 * it weakly: a chain whose element is gone could never match a later kill.
 *
 * The leak fix has no behavioral test — garbage collection cannot be forced from
 * a test, so no assertion can tell a weak reference from a strong one. Reviewers
 * must check this one by reading it.
 */
interface ChainState {
  elementToken: WeakRef<object>;
  caretAfter: number;
}

/** Newest first: index 0 is what a plain yank inserts. */
let entries: string[] = [];

/** Non-null only while the last command was a storable kill. */
let chain: ChainState | null = null;

/** The entry a rotation would replace next, or null when no yank is in flight. */
let yankIndex: number | null = null;

/** The ring as text, newest first. A copy — callers cannot reach the state. */
export function ringSnapshot(): string[] {
  return [...entries];
}

/** What a plain yank inserts, or undefined when nothing has been killed. */
export function newestEntry(): string | undefined {
  return entries[0];
}

/** Drops every entry and every chain, as the frame going quiet would. */
export function clearRing(): void {
  entries = [];
  chain = null;
  yankIndex = null;
}

/**
 * Records a kill that has already happened.
 *
 * An empty region is not an event: nothing is stored and the chain is left
 * exactly as it was, so Ctrl+K at the end of a line does not split a run in two.
 * A non-storable kill breaks the chain, because the text between the previous
 * entry and the next one is gone and concatenating across the hole would fabri-
 * cate a line the user never had.
 *
 * While the chain holds, a forward kill appends to the newest entry and a
 * backward kill prepends, which is what makes Ctrl+U then Ctrl+K at one caret
 * give back the whole line in its original order.
 */
export function recordKill(record: KillRecord): void {
  yankIndex = null;
  if (record.text === "") return;
  if (!record.storable) {
    chain = null;
    return;
  }
  const chained = chain !== null && isSamePlace(chain, record);
  const merged = chained ? concatenate(entries[0], record) : record.text;
  if (merged.length > ringEntrySizeLimit) {
    chain = null;
    return;
  }
  if (chained) entries[0] = merged;
  else push(merged);
  chain = { elementToken: new WeakRef(record.elementToken), caretAfter: record.caretAfter };
}

/**
 * Reports that some other command ran, so the next kill starts a fresh entry and
 * a rotation is no longer legal.
 *
 * The token is accepted for symmetry with `recordKill` and ignored: any command
 * that is not a kill breaks the chain wherever it happened.
 */
export function noteForeignCommand(_elementToken?: object): void {
  chain = null;
  yankIndex = null;
}

/**
 * Starts a yank sequence at the newest entry, or reports an empty ring by
 * returning undefined — the caller must then leave the key to the browser rather
 * than swallow it.
 */
export function beginYank(): string | undefined {
  chain = null;
  if (entries.length === 0) {
    yankIndex = null;
    return undefined;
  }
  yankIndex = 0;
  return entries[0];
}

/**
 * Advances to the next-older entry, wrapping at the end.
 *
 * Legal only while a yank sequence is in flight; anything else since the last
 * yank — a kill, another binding — returns undefined, and the caller must then
 * do nothing at all rather than replace text it can no longer account for.
 */
export function rotateYank(): string | undefined {
  if (yankIndex === null || entries.length === 0) return undefined;
  yankIndex = (yankIndex + 1) % entries.length;
  return entries[yankIndex];
}

/**
 * Whether a kill starts exactly where the previous one left the caret.
 *
 * The comparison is the previous kill's `caretAfter` against this one's
 * `caretBefore`, and the asymmetry is the whole point: "same place" means the
 * user did not move between the two kills, which is a question about where this
 * kill BEGAN, not about where it will end up. Comparing `caretAfter` to
 * `caretAfter` asks whether both kills finish in the same spot — true by
 * coincidence for two forward kills, since a forward kill leaves the caret
 * where it found it, and structurally false for two backward kills, which walk
 * the caret left every time. For a forward kill the two compared numbers
 * coincide, so only a backward kill tells the correct comparison from the wrong
 * one.
 *
 * An element the chain can no longer reach — collected since — is a mismatch,
 * so a dead reference starts a fresh entry rather than chaining onto one.
 */
function isSamePlace(state: ChainState, record: KillRecord): boolean {
  return state.elementToken.deref() === record.elementToken && state.caretAfter === record.caretBefore;
}

/** Readline's accumulation order: forward kills append, backward kills prepend. */
function concatenate(entry: string, record: KillRecord): string {
  return record.direction === "forward" ? entry + record.text : record.text + entry;
}

/** Adds a new newest entry, dropping the oldest once the ring is full. */
function push(text: string): void {
  entries.unshift(text);
  if (entries.length > ringCapacity) entries.length = ringCapacity;
}
