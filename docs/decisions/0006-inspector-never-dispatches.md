# ADR-0006: The inspector never dispatches key events

Date: 2026-08-15
Status: accepted

## Context

The inspector lists page shortcuts that collide with razorshell's
bindings. The first implementation dispatched each chord as a
synthetic keydown and read `defaultPrevented` — which runs the
page's handlers, so probing Ctrl+k on a mail composer would open its
link dialog. Firing page actions from a diagnostic was ruled out.

## Decision

Three sources, none of which dispatches an event:

- A MAIN-world script patches `EventTarget.prototype.addEventListener`
  at document_start and records every keydown handler's source text.
  `analyzeHandlerSource` in src/handleranalysis.ts marks a chord as a
  possible conflict when the source carries the quoted key or its
  keyCode, the asserted modifier names, and `preventDefault`.
- Listeners whose source yields nothing are reported as a count of
  unanalyzable listeners, never silently dropped.
- During real, trusted input the same script detects a page handler
  calling `preventDefault` — the call, not the flag, so razorshell
  cancelling first cannot mask it — and accumulates the chord as a
  confirmed conflict.

## Criteria

Whether arbitrary handler code consumes a chord is undecidable in
general, and the sites where conflicts matter most route every key
through one dispatcher whose source names no keys. A heuristic that
stayed silent there would certify Gmail as conflict-free; admitting
"n listeners could not be analyzed" keeps the report honest.
Observation turns ordinary typing into ground truth at zero risk.

## Alternatives rejected

- Synthetic dispatch: certain, but executes the page's shortcut
  actions.
- chrome.debugger with DOMDebugger.getEventListeners: reads listener
  locations without running them, but costs the "debugger"
  install warning and a persistent debugging infobar, and still
  cannot map dispatcher-style handlers to chords.

## Cost

Static detection only catches handlers that test keys inline;
confirmed conflicts appear only after the user has pressed the chord
once on that page.
