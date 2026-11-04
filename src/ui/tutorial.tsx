import React, { useLayoutEffect, useRef, useState } from "react";
import { dispatchKey } from "../keyhandling";
import { keyChord } from "../keychord";
import { Keymap } from "../operation";
import { advances, FieldState, stepsFor, TutorialStep } from "../tutorial";

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

function DoneCheck() {
  return <svg data-testid="tutorial-done-check" aria-hidden="true" viewBox="0 0 48 48" className="w-16 h-16">
    <circle cx="24" cy="24" r="22" className="fill-success" />
    <path d="M14 25l7 7 13-15" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
      className="stroke-success-content" />
  </svg>;
}

/**
 * The tutorial's lessons over the given keymap: one step at a time, its field
 * put in the step's Given state, and the next step shown once a key the keymap
 * handled leaves the field in the Then state (ADR-0018). `celebrate` is called
 * once, as the last step passes.
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

  if (step === undefined) {
    return <div data-testid="tutorial-done" className="flex flex-col items-center gap-3">
      <DoneCheck />
      <p className="m-0">Done. Every step passed.</p>
    </div>;
  }

  return <div className="flex flex-col w-full gap-3">
    <StepPrompt step={step} keymap={keymap} />
    <input
      ref={field}
      type="text"
      data-testid="tutorial-field"
      aria-label="Tutorial field"
      className="input w-full font-mono"
      onKeyDown={handleKeyDown}
    />
    <button type="button" data-testid="tutorial-reset" className="btn btn-sm self-start" onClick={putGiven}>
      Reset
    </button>
  </div>;
}
