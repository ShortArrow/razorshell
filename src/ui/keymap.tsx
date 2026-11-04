import { useCallback, useEffect, useState } from "react";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { browserChords } from "../browserchords";
import { keyChord } from "../keychord";
import { defaultKeymap } from "../keymap";
import { Chord, findConflict, typingKeyRefusal } from "../keymapmerge";
import {
  clearAllKeymapOverrides,
  clearKeymapOverride,
  getActiveKeymap,
  getKeymapOverrides,
  onKeymapChange,
  saveKeymapOverride,
} from "../keymapstore";
import { getMessage } from "../languages";
import { Keymap } from "../operation";
import { onPageRevisit, openShortcutsPage, readAssignedShortcuts } from "./shortcuts";

const modifierKeys = ["Control", "Alt", "Shift", "Meta"];

/** What an unassigned browser command shows in the current column. */
const noShortcut = "—";

/**
 * @fn shortcutLabels
 * @brief Split a Chrome shortcut string into the parts the kbd chips render.
 * @details Chrome prints a chord as `Ctrl+Shift+W`. The row shows what Chrome
 *          holds rather than a re-derivation of it, so the string is split
 *          rather than parsed into a Chord: a modifier this build does not model
 *          still has to appear on the row that names it.
 * @param string shortcut - The shortcut as chrome.commands reports it
 * @return string[] - The chord's parts, in Chrome's own order
 */
function shortcutLabels(shortcut: string): string[] {
  return shortcut.split("+").map((part) => part.trim()).filter((part) => part !== "");
}

function ChipRow({ labels, testid }: { labels: string[]; testid?: string }) {
  return (
    <span className='flex items-center gap-1' data-testid={testid}>
      {labels.map((label, index) => (
        <span key={index} className='flex items-center gap-1'>
          {index > 0 ? <span>+</span> : null}
          <kbd className='kbd text-base-content'>{label}</kbd>
        </span>
      ))}
    </span>
  );
}

function chordLabels(entry: Chord): string[] {
  return keyChord({
    key: entry.key,
    ctrlKey: entry.ctrl === true,
    altKey: entry.alt === true,
    shiftKey: entry.shift === true,
  });
}

function ChordView({ entry, testid, overridden }: { entry: Chord; testid?: string; overridden?: boolean }) {
  const labels = chordLabels(entry);
  return (
    <span className='flex items-center gap-1' data-testid={testid}>
      {labels.map((label, index) => (
        <span key={index} className='flex items-center gap-1'>
          {index > 0 ? <span>+</span> : null}
          <kbd className={overridden ? 'kbd text-primary' : 'kbd text-base-content'}>{label}</kbd>
        </span>
      ))}
    </span>
  );
}

function labelOf(id: string): string {
  const entry = defaultKeymap.find((candidate) => candidate.id === id);
  return entry ? entry.label : id;
}

function isOverridden(active: Keymap, fallback: Keymap): boolean {
  return (
    (active.unassigned === true) !== (fallback.unassigned === true) ||
    active.key !== fallback.key ||
    (active.ctrl === true) !== (fallback.ctrl === true) ||
    (active.alt === true) !== (fallback.alt === true) ||
    (active.shift === true) !== (fallback.shift === true)
  );
}

/**
 * @fn refusalTestid
 * @brief Name the one refusal line after whichever refusal it is carrying.
 * @param conflict - The chord already held by another row, or null
 * @param typingKey - The chord that would shadow typing, or null
 * @return string - The testid the line renders under
 */
function refusalTestid(
  conflict: { id: string } | null,
  typingKey: { id: string } | null,
): string {
  if (conflict) return `conflict-${conflict.id}`;
  if (typingKey) return `typing-${typingKey.id}`;
  return 'keymap-no-conflict';
}

export function KeymapApp() {
  const [keymap, setKeymap] = useState<Keymap[]>(() => getActiveKeymap());
  const [overrides, setOverrides] = useState<Record<string, Chord>>(() => getKeymapOverrides());
  const [capturing, setCapturing] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ id: string; withId: string } | null>(null);
  const [typingKey, setTypingKey] = useState<{ id: string; reason: string } | null>(null);
  const [saveError, setSaveError] = useState<string>('');
  const [assigned, setAssigned] = useState<Record<string, string>>({});

  /**
   * @fn applyMutation
   * @brief Await a store mutation, showing the refusal and resyncing the rows when it fails.
   * @param Promise<void> mutate - The pending write, rejecting when storage refused it
   * @return void
   */
  const applyMutation = useCallback((mutate: Promise<void>) => {
    mutate
      .then(() => setSaveError(''))
      .catch((failure: unknown) => {
        setSaveError(failure instanceof Error ? failure.message : String(failure));
        // The rows showed the mutation optimistically. Storage refused it, so
        // reading the store back is what makes display and storage agree again.
        setKeymap(getActiveKeymap());
        setOverrides(getKeymapOverrides());
      });
  }, []);

  useEffect(() => {
    const refresh = () => {
      setKeymap(getActiveKeymap());
      setOverrides(getKeymapOverrides());
    };
    const release = onKeymapChange(refresh);
    refresh();
    return release;
  }, []);

  useEffect(() => {
    let live = true;
    const refresh = () => {
      void readAssignedShortcuts().then((current) => {
        // The read outlives the unmount when the page is closed mid-flight, and
        // setting state on a released component is what the guard stops.
        if (live) setAssigned(current);
      });
    };
    const release = onPageRevisit(refresh);
    refresh();
    return () => {
      live = false;
      release();
    };
  }, []);

  useEffect(() => {
    if (capturing === null) return;
    const onKeydown = (event: KeyboardEvent) => {
      if (modifierKeys.includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      setCapturing(null);
      if (event.key === "Escape") return;
      const chord: Chord = {
        key: event.key,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
      };
      const refusal = typingKeyRefusal(chord);
      if (refusal !== null) {
        setTypingKey({ id: capturing, reason: refusal });
        return;
      }
      const collision = findConflict(chord, getActiveKeymap(), capturing);
      if (collision) {
        setConflict({ id: capturing, withId: collision });
        return;
      }
      applyMutation(saveKeymapOverride(capturing, chord));
    };
    document.addEventListener("keydown", onKeydown, { capture: true });
    return () => document.removeEventListener("keydown", onKeydown, { capture: true });
  }, [capturing, applyMutation]);

  const startCapture = (id: string) => {
    setConflict(null);
    setTypingKey(null);
    setCapturing(id);
  };

  const resetOne = (id: string) => {
    setConflict(null);
    setTypingKey(null);
    applyMutation(clearKeymapOverride(id));
  };

  const resetAll = () => {
    setConflict(null);
    setTypingKey(null);
    applyMutation(clearAllKeymapOverrides());
  };

  const overriddenCount = Object.keys(overrides).length;

  return (
    <div className='flex flex-col w-full gap-3'>
      <div className='flex items-center gap-2'>
        <h2 className='h2 m-0'>Keymap</h2>
        <button
          className='btn btn-xs btn-ghost btn-square'
          data-testid='keymap-reset-all'
          aria-label={getMessage('keymap_reset_all')()}
          title={getMessage('keymap_reset_all')()}
          disabled={overriddenCount === 0}
          onClick={resetAll}
        >
          <ArrowPathIcon className='w-4 h-4' />
        </button>
      </div>
      <table className='table table-sm'>
        <thead>
          <tr>
            <th>action</th>
            <th>default</th>
            <th>current</th>
            <th><span className='sr-only'>rebind</span></th>
          </tr>
        </thead>
        <tbody>
          {keymap.map((entry, index) => {
            const fallback = defaultKeymap[index];
            const overridden = isOverridden(entry, fallback);
            // An unassigned opt-in row (ADR-0012) reads like an unassigned
            // browser-managed row: the three reading cells carry the marking,
            // the cell holding the assign button does not.
            const unassigned = entry.unassigned === true;
            const cell = unassigned
              ? { 'aria-disabled': 'true' as const, className: 'align-middle text-base-content/50' }
              : { className: 'align-middle' };
            const warning = unassigned ? null : typingKeyRefusal(entry);
            const rebindLabel = capturing === entry.id
              ? getMessage('keymap_press_key')()
              : getMessage(unassigned ? 'keymap_assign' : 'keymap_rebind')();
            return (
              <tr key={entry.id}>
                <td {...cell}>
                  <span className='tooltip tooltip-top' data-tip={entry.description ? entry.description() : ""}>
                    {entry.label}
                  </span>
                </td>
                <td {...cell}><ChordView entry={fallback} /></td>
                <td {...cell}>
                  {unassigned
                    ? <span data-testid={`current-${entry.id}`}>{noShortcut}</span>
                    : <ChordView entry={entry} testid={`current-${entry.id}`} overridden={overridden} />}
                  {warning === null ? null : <p className='text-warning text-sm m-0' data-testid={`warning-${entry.id}`}>{warning}</p>}
                </td>
                <td className='align-middle'>
                  <div className='flex items-center gap-2'>
                    <button
                      className='btn btn-sm btn-square'
                      data-testid={`rebind-${entry.id}`}
                      aria-label={rebindLabel}
                      title={rebindLabel}
                      onClick={() => startCapture(entry.id)}
                    >
                      {capturing === entry.id
                        ? <span className='loading loading-dots loading-xs' />
                        : <PencilSquareIcon className='w-4 h-4' />}
                    </button>
                    <button
                      className={`btn btn-sm btn-ghost btn-square ${overridden ? '' : 'invisible'}`}
                      data-testid={`reset-${entry.id}`}
                      aria-label={getMessage('keymap_reset')()}
                      title={getMessage('keymap_reset')()}
                      onClick={() => resetOne(entry.id)}
                    >
                      <ArrowPathIcon className='w-4 h-4' />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {browserChords.map((entry) => {
            const shortcut = assigned[entry.command];
            const bound = shortcut !== undefined;
            // The dimming is announced rather than only painted: axe exempts
            // disabled-marked content from color-contrast, so the gray has to
            // ride on the marking. It goes on the three READING cells and not
            // on the row, because the row also holds the Assign button — the
            // one thing an unassigned row is for. Marking the row disabled
            // would describe that button as unavailable to assistive tech, and
            // Playwright's actionability check reads the ancestor and refuses
            // to click it, which is the same judgement a screen reader makes.
            const disabled = bound
              ? {}
              : { 'aria-disabled': 'true' as const, className: 'align-middle text-base-content/50' };
            const cell = bound ? { className: 'align-middle' } : disabled;
            return (
              <tr key={entry.command} data-testid={`browser-row-${entry.command}`}>
                <td {...cell}>
                  <span className='tooltip tooltip-top' data-tip={getMessage('tooltip_reclaimed')()}>
                    {entry.label}
                  </span>
                </td>
                <td {...cell}><ChordView entry={entry.chord} /></td>
                <td {...cell}>
                  {bound
                    ? <ChipRow labels={shortcutLabels(shortcut)} testid={`browser-current-${entry.command}`} />
                    : <span data-testid={`browser-current-${entry.command}`}>{noShortcut}</span>}
                </td>
                <td className='align-middle'>
                  <div className='flex items-center gap-2'>
                    {bound
                      ? (
                        <button
                          className='btn btn-sm btn-ghost btn-square'
                          data-testid={`manage-${entry.command}`}
                          aria-label={getMessage('keymap_manage_in_chrome')()}
                          title={getMessage('keymap_manage_in_chrome')()}
                          onClick={openShortcutsPage}
                        >
                          <ArrowTopRightOnSquareIcon className='w-4 h-4' />
                        </button>
                      )
                      : (
                        <button
                          className='btn btn-sm'
                          data-testid={`assign-${entry.command}`}
                          onClick={openShortcutsPage}
                        >
                          {getMessage('keymap_assign')()}
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className='min-h-6' data-testid='keymap-save-error'>
        {saveError === '' ? null : <span className='text-error'>{saveError}</span>}
      </div>
      <p
        className='text-error min-h-6 m-0'
        data-testid={refusalTestid(conflict, typingKey)}
      >
        {conflict
          ? `${labelOf(conflict.id)} — conflicts with: ${labelOf(conflict.withId)}`
          : typingKey
            ? `${labelOf(typingKey.id)} — ${typingKey.reason}`
            : ''}
      </p>
    </div>
  );
}
