/**
 * @file richtexthint.ts
 * @brief The one-time hint that rich text editors are off by default (ADR-0014).
 *
 * With the contenteditable opt-in off, a bound chord pressed in a rich editor
 * does nothing, and nothing says why. The first press that would have acted
 * there shows a hint naming the setting; the profile then remembers it and the
 * hint never returns. The key itself is never taken: the hint only watches.
 *
 * The decision is kept apart from the content script and its storage so it can
 * be tested as plain state: the caller supplies how to read and write the
 * record, how to show the hint, and the keymap in force.
 */

import { keymaching } from "./keymap";
import { Keymap } from "./operation";

export interface RichTextHintDeps {
  /** Whether this profile has already been shown the hint. */
  read: () => Promise<boolean>;
  /** Records that the hint has been shown. A rejection means it was not recorded. */
  write: () => Promise<void>;
  show: () => void;
  keymap: () => Keymap[];
}

export interface RichTextHint {
  /**
   * Considers one keydown in a rich editor while the opt-in is off. Resolves
   * once any hint has been shown; never cancels the event.
   */
  offer: (event: KeyboardEvent) => Promise<void>;
}

/**
 * Builds the hint for one frame.
 *
 * Only the first qualifying press in a frame consults storage; every later one
 * is ignored without a read, so typing in a rich editor costs nothing after
 * that. The hint is shown only after its record is written, because a hint
 * that could not be recorded would come back on every page.
 */
export function createRichTextHint(deps: RichTextHintDeps): RichTextHint {
  let considered = false;
  return {
    async offer(event: KeyboardEvent): Promise<void> {
      if (considered || event.isComposing) return;
      if (!wouldActInRichText(event, deps.keymap())) return;
      considered = true;
      if (await deps.read()) return;
      try {
        await deps.write();
      } catch {
        return;
      }
      deps.show();
    },
  };
}

/** Whether a bound entry with a rich text counterpart matches the press. */
function wouldActInRichText(event: KeyboardEvent, keymap: Keymap[]): boolean {
  return keymap.some((entry) => entry.editableOperation !== undefined && keymaching(event, entry));
}
