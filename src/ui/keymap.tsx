import { useCallback, useEffect, useState } from "react";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { browserChords } from "../browserchords";
import { keyChord } from "../keychord";
import { defaultKeymap } from "../keymap";
import { Chord, findConflict } from "../keymapmerge";
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

const modifierKeys = ["Control", "Alt", "Shift", "Meta"];

const shortcutsUrl = "chrome://extensions/shortcuts";

/** What an unassigned browser command shows in the current column. */
const noShortcut = "—";

/**
 * @fn openShortcutsPage
 * @brief Open Chrome's shortcuts page in a tab.
 * @details A page cannot navigate to a `chrome://` URL — the anchor does
 *          nothing — but an extension page may open one through
 *          `chrome.tabs.create`, which is why every affordance for these rows is
 *          a button rather than a link.
 * @return void
 */
function openShortcutsPage(): void {
  void chrome.tabs.create({ url: shortcutsUrl });
}

/**
 * @fn onPageRevisit
 * @brief Call back when the page is looked at again after being away.
 * @details The browser-managed rows read a binding this page cannot change: the
 *          user assigns it on another tab, and comes back. Nothing in this
 *          document changes when they do, so the signal is the page becoming
 *          current again — visibilitychange for the tab switch,
 *          focus for the cases visibility does not cover, such as returning
 *          from another window over the same visible tab.
 *
 *          Both arms are gated on having actually been away. A bare `focus`
 *          listener also fires for same-tab focus churn — an extension page
 *          being scripted, a devtools detach — and each spurious call is a
 *          `chrome.commands.getAll()`, which WAKES THE SERVICE WORKER. That
 *          measurably delayed an unrelated content script's policy report in
 *          the e2e suite, so the read is spent only when the answer could have
 *          moved.
 * @param listener - Receives no arguments
 * @return () => void - Releases both listeners
 */
function onPageRevisit(listener: () => void): () => void {
  let away = document.visibilityState !== "visible";
  const revisit = () => {
    if (!away) return;
    away = false;
    listener();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") revisit();
    else away = true;
  };
  window.addEventListener("focus", revisit);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("focus", revisit);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/**
 * @fn readAssignedShortcuts
 * @brief What Chrome currently has bound for each declared command.
 * @details Chrome lists every declared command whether or not it is assigned,
 *          reporting an unassigned one with an empty shortcut. Commands the
 *          descriptors do not name are dropped, and a build whose `commands`
 *          surface is missing resolves to nothing bound rather than throwing —
 *          the rows then read as unassigned, which is the honest answer.
 * @return Promise<Record<string, string>> - Shortcut by command name, absent when unassigned
 */
async function readAssignedShortcuts(): Promise<Record<string, string>> {
  const all = await chrome.commands?.getAll?.() ?? [];
  const assigned: Record<string, string> = {};
  for (const command of all) {
    if (command.name === undefined) continue;
    if (command.shortcut === undefined || command.shortcut === "") continue;
    assigned[command.name] = command.shortcut;
  }
  return assigned;
}

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
    active.key !== fallback.key ||
    (active.ctrl === true) !== (fallback.ctrl === true) ||
    (active.alt === true) !== (fallback.alt === true) ||
    (active.shift === true) !== (fallback.shift === true)
  );
}

export function KeymapApp() {
  const [keymap, setKeymap] = useState<Keymap[]>(() => getActiveKeymap());
  const [overrides, setOverrides] = useState<Record<string, Chord>>(() => getKeymapOverrides());
  const [capturing, setCapturing] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ id: string; withId: string } | null>(null);
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
    setCapturing(id);
  };

  const resetOne = (id: string) => {
    setConflict(null);
    applyMutation(clearKeymapOverride(id));
  };

  const resetAll = () => {
    setConflict(null);
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
            return (
              <tr key={entry.id}>
                <td className='align-middle'>
                  <span className='tooltip tooltip-top' data-tip={entry.description ? entry.description() : ""}>
                    {entry.label}
                  </span>
                </td>
                <td className='align-middle'><ChordView entry={fallback} /></td>
                <td className='align-middle'>
                  <ChordView entry={entry} testid={`current-${entry.id}`} overridden={overridden} />
                </td>
                <td className='align-middle'>
                  <div className='flex items-center gap-2'>
                    <button
                      className='btn btn-sm btn-square'
                      data-testid={`rebind-${entry.id}`}
                      aria-label={capturing === entry.id ? getMessage('keymap_press_key')() : getMessage('keymap_rebind')()}
                      title={capturing === entry.id ? getMessage('keymap_press_key')() : getMessage('keymap_rebind')()}
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
        data-testid={conflict ? `conflict-${conflict.id}` : 'keymap-no-conflict'}
      >
        {conflict
          ? `${labelOf(conflict.id)} — conflicts with: ${labelOf(conflict.withId)}`
          : ''}
      </p>
    </div>
  );
}
