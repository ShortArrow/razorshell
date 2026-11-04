import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { browserChords } from "../browserchords";
import { dispatchKey } from "../keyhandling";
import { keyChord } from "../keychord";
import { Keymap } from "../operation";
import { defaultKeymap } from "../keymap";
import { advances, FieldState, SkippedStep, skippedFor, stepsFor, TutorialStep } from "../tutorial";
import { onPageRevisit, readAssignedShortcuts } from "./shortcuts";

function stateOf(field: HTMLInputElement): FieldState {
  return { value: field.value, selectionStart: field.selectionStart ?? 0, selectionEnd: field.selectionEnd ?? 0 };
}

function chordOf(entry: Keymap): string[] {
  return keyChord({ key: entry.key, ctrlKey: entry.ctrl === true, altKey: entry.alt === true, shiftKey: entry.shift === true });
}

function StepPrompt({ step, keymap }: { step: TutorialStep; keymap: readonly Keymap[] }) {
  const entry = keymap.find((candidate) => candidate.id === step.operationId)!;
  return <p data-testid="tutorial-step" className="flex flex-wrap items-center gap-2 m-0">
    <span>{entry.label}:</span>
    <span className="flex items-center gap-1">
      {chordOf(entry).map((label, index) => <kbd key={index} className="kbd kbd-sm">{label}</kbd>)}
    </span>
  </p>;
}

/** An operation's name, from the defaults, since a skipped one may be missing from the keymap in force. */
function labelOf(operationId: string): string {
  return defaultKeymap.find((entry) => entry.id === operationId)?.label ?? operationId;
}

function SkippedNote({ skipped }: { skipped: SkippedStep }) {
  const why = skipped.reason === "unassigned" ? "no key assigned" : `needs ${labelOf(skipped.step.restsOn!)}`;
  return <p data-testid="tutorial-skipped" className="m-0 text-sm opacity-70">
    Skipped: {labelOf(skipped.step.operationId)} ({why})
  </p>;
}

/**
 * What Chrome holds for Ctrl+W and Ctrl+T, which act only once the user assigns
 * them on Chrome's shortcuts page (ADR-0011), read again whenever the user
 * comes back to this tab.
 */
function BrowserShortcuts() {
  const [assigned, setAssigned] = useState<Record<string, string>>({});

  useEffect(() => {
    const refresh = () => {
      void readAssignedShortcuts().then(setAssigned).catch(() => {});
    };
    refresh();
    return onPageRevisit(refresh);
  }, []);

  return <div className="flex flex-col gap-1 text-sm">
    <p className="m-0">Ctrl+W and Ctrl+T act only once assigned on Chrome's shortcuts page:</p>
    {browserChords.map((chord) => <p key={chord.command} data-testid={`tutorial-command-${chord.command}`} className="m-0">
      {chord.label}: {assigned[chord.command] === undefined
        ? "—"
        : <kbd className="kbd kbd-sm">{assigned[chord.command]}</kbd>}
    </p>)}
  </div>;
}

function DoneCheck() {
  return <svg data-testid="tutorial-done-check" aria-hidden="true" viewBox="0 0 48 48" className="w-16 h-16">
    <circle cx="24" cy="24" r="22" className="fill-success" />
    <path d="M14 25l7 7 13-15" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
      className="stroke-success-content" />
  </svg>;
}

/**
 * The tutorial's lessons over the given keymap, under a note for each step it
 * leaves out and why: one step at a time, its field put in the step's Given
 * state, and the next step shown once a key the keymap handled leaves the
 * field in the Then state (ADR-0018). `celebrate` is called
 * once, as the last step passes; the field then stays, read-only, showing what
 * that step left in it.
 */
export function TutorialApp({ keymap, celebrate }: { keymap: readonly Keymap[]; celebrate?: () => void }) {
  const steps = stepsFor(keymap);
  const [index, setIndex] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const step = steps[index];

  const putGiven = () => {
    const input = field.current;
    if (input === null || step === undefined) return;
    input.value = step.given.value;
    input.setSelectionRange(step.given.selectionStart, step.given.selectionEnd);
  };

  useLayoutEffect(putGiven, [step]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (step === undefined) return;
    dispatchKey(event.nativeEvent, event.currentTarget, keymap);
    if (advances(step.then, stateOf(event.currentTarget), event.nativeEvent.defaultPrevented)) {
      setIndex(index + 1);
      if (index + 1 === steps.length) celebrate?.();
    }
  };

  return <div className="flex flex-col w-full gap-3">
    {skippedFor(keymap).map((skipped) => <SkippedNote key={skipped.step.operationId} skipped={skipped} />)}
    {step !== undefined && <StepPrompt step={step} keymap={keymap} />}
    <input
      ref={field}
      type="text"
      data-testid="tutorial-field"
      aria-label="Tutorial field"
      className="input w-full font-mono"
      readOnly={step === undefined}
      onKeyDown={handleKeyDown}
    />
    {step === undefined
      ? <div data-testid="tutorial-done" className="flex flex-col items-center gap-3">
        <DoneCheck />
        <p className="m-0">Done. Every step passed.</p>
        <BrowserShortcuts />
      </div>
      : <button type="button" data-testid="tutorial-reset" className="btn btn-sm self-start" onClick={putGiven}>
        Reset
      </button>}
  </div>;
}
