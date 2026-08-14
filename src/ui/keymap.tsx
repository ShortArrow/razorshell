import { useEffect, useState } from "react";
import { ArrowPathIcon, EllipsisHorizontalIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
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

  useEffect(() => {
    const refresh = () => {
      setKeymap(getActiveKeymap());
      setOverrides(getKeymapOverrides());
    };
    onKeymapChange(refresh);
    refresh();
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
      saveKeymapOverride(capturing, chord);
    };
    document.addEventListener("keydown", onKeydown, { capture: true });
    return () => document.removeEventListener("keydown", onKeydown, { capture: true });
  }, [capturing]);

  const startCapture = (id: string) => {
    setConflict(null);
    setCapturing(id);
  };

  const resetOne = (id: string) => {
    setConflict(null);
    clearKeymapOverride(id);
  };

  const resetAll = () => {
    setConflict(null);
    clearAllKeymapOverrides();
  };

  const overriddenCount = Object.keys(overrides).length;

  return (
    <div className='flex flex-col w-full gap-3'>
      <h2 className='h2'>Keymap</h2>
      <table className='table table-sm'>
        <thead>
          <tr>
            <th>{getMessage('keymap_col_action')()}</th>
            <th>{getMessage('keymap_col_default')()}</th>
            <th>{getMessage('keymap_col_current')()}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {keymap.map((entry, index) => {
            const fallback = defaultKeymap[index];
            const overridden = isOverridden(entry, fallback);
            return (
              <tr key={entry.id}>
                <td>
                  <span className='tooltip tooltip-top' data-tip={entry.description ? entry.description() : ""}>
                    {entry.label}
                  </span>
                </td>
                <td><ChordView entry={fallback} /></td>
                <td>
                  <ChordView entry={entry} testid={`current-${entry.id}`} overridden={overridden} />
                </td>
                <td>
                  <div className='flex items-center gap-2'>
                    <button
                      className='btn btn-sm btn-square'
                      data-testid={`rebind-${entry.id}`}
                      aria-label={capturing === entry.id ? getMessage('keymap_press_key')() : getMessage('keymap_rebind')()}
                      title={capturing === entry.id ? getMessage('keymap_press_key')() : getMessage('keymap_rebind')()}
                      onClick={() => startCapture(entry.id)}
                    >
                      {capturing === entry.id
                        ? <EllipsisHorizontalIcon className='w-4 h-4' />
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
        </tbody>
      </table>
      <p
        className='text-error min-h-6 m-0'
        data-testid={conflict ? `conflict-${conflict.id}` : 'keymap-no-conflict'}
      >
        {conflict
          ? `${labelOf(conflict.id)} — ${getMessage('keymap_conflict_with')()}${labelOf(conflict.withId)}`
          : ''}
      </p>
      <div>
        <button
          className='btn btn-sm'
          data-testid='keymap-reset-all'
          disabled={overriddenCount === 0}
          onClick={resetAll}
        >
          {getMessage('keymap_reset_all')()}
        </button>
      </div>
    </div>
  );
}
