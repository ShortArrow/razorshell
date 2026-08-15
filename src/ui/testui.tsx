import React, { useState } from "react";
import { getMessage } from "../languages";
import { keyEventHandling } from "../keyhandling";
import { keyChord, selectionSummary } from "../keychord";
import { TextField } from "../operation";

interface LastStatus {
  chord: string[];
  handled: boolean;
  code: string;
}

const inputText = "hello world new order";
const textareaText = "first line\nsecond line\nthird";

function statusOf(event: React.KeyboardEvent<TextField>): LastStatus {
  return {
    chord: keyChord(event.nativeEvent),
    handled: event.nativeEvent.defaultPrevented,
    code: event.nativeEvent.code,
  };
}

function StatusPanel({ status }: { status: LastStatus | null }) {
  if (status === null) {
    return <div data-testid="last-status" className="flex items-center gap-2">
      <span className="text-sm opacity-80">last status: -</span>
    </div>;
  }
  return <div data-testid="last-status" className="flex flex-wrap items-center gap-2">
    <span className="text-sm opacity-80">last status:</span>
    <span className="flex items-center gap-1">
      {status.chord.map((label, index) => <kbd key={index} className="kbd kbd-sm text-base-content">{label}</kbd>)}
    </span>
    <span className={status.handled ? "badge badge-primary" : "badge badge-ghost"}>
      {status.handled ? "handled" : "pass-through"}
    </span>
    <code className="text-xs opacity-80">{status.code}</code>
  </div>;
}

export function TestApp() {
  const [status, setStatus] = useState<LastStatus | null>(null);
  const [inputSelection, setInputSelection] = useState<string>(
    selectionSummary({ selectionStart: null, selectionEnd: null, value: inputText }));
  const [textareaSelection, setTextareaSelection] = useState<string>(
    selectionSummary({ selectionStart: null, selectionEnd: null, value: textareaText }));

  const handleKeyDown = (
    event: React.KeyboardEvent<TextField>,
    setSelection: (summary: string) => void,
  ) => {
    keyEventHandling(event.nativeEvent, event.currentTarget);
    setStatus(statusOf(event));
    setSelection(selectionSummary(event.currentTarget));
  };

  return <>
    <div className="flex flex-col w-full gap-3">
      <h2 className="h2">
        <span className="tooltip tooltip-bottom" data-tip={getMessage("tooltip_test_area")()}>Test Area</span>
      </h2>
      <div className="card bg-base-200">
        <div className="card-body gap-3">
          <label className="input input-bordered flex items-center">
            <input
              type="text"
              data-testid="test-input"
              aria-label={`${getMessage("tooltip_test_area")()} (single line)`}
              className="grow"
              defaultValue={inputText}
              onKeyDown={(e) => handleKeyDown(e, setInputSelection)}
              onKeyUp={(e) => setInputSelection(selectionSummary(e.currentTarget))}
              onSelect={(e) => setInputSelection(selectionSummary(e.currentTarget))}
              onInput={(e) => setInputSelection(selectionSummary(e.currentTarget))}
            />
          </label>
          <p data-testid="test-input-selection" className="text-xs opacity-80 m-0">{inputSelection}</p>
          <textarea
            data-testid="test-textarea"
            aria-label={`${getMessage("tooltip_test_area")()} (multiple lines)`}
            className="textarea textarea-bordered w-full"
            rows={3}
            defaultValue={textareaText}
            onKeyDown={(e) => handleKeyDown(e, setTextareaSelection)}
            onKeyUp={(e) => setTextareaSelection(selectionSummary(e.currentTarget))}
            onSelect={(e) => setTextareaSelection(selectionSummary(e.currentTarget))}
            onInput={(e) => setTextareaSelection(selectionSummary(e.currentTarget))}
          />
          <p data-testid="test-textarea-selection" className="text-xs opacity-80 m-0">{textareaSelection}</p>
          <div className="divider m-0"></div>
          <StatusPanel status={status} />
        </div>
      </div>
    </div>
  </>;
}
