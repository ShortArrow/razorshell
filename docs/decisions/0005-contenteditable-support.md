# ADR-0005: contenteditable support is opt-in and Selection-based

Date: 2026-08-15
Status: accepted

## Context

Rich text editors (Gmail compose, Notion, Lexical/ProseMirror-based
editors) are contenteditable trees, not form fields; the operations
in src/operation.ts read `value` and `selectionStart`, which do not
exist there. src/editableoperation.ts holds the contenteditable
counterparts, addressed by the same entry ids.

## Decision

- Off by default. `enableContentEditable` in storage.sync turns it
  on; a toggle on the options page and, later, init.lua write the
  same key.
- Movement uses `Selection.modify` with character / word /
  lineboundary granularity. Deletion extends the selection to the
  line boundary and runs `document.execCommand("delete")`.
- Event targets resolve through `event.composedPath()[0]`, so
  editors and fields inside open shadow roots are reached. Closed
  shadow roots stay out of reach by platform design.

## Criteria

Rich editors ship their own shortcuts (Ctrl+k as "insert link" is
common), so silently taking those keys after an update would break
existing users; opting in per the inspector's conflict report keeps
that decision with the user. `Selection.modify` delegates visual
line and word boundaries to the browser, which no hand-written Range
walk reproduces reliably across wrapped lines. `execCommand`,
deprecated but stable, keeps native undo and fires the input events
frameworks listen for; `Range.deleteContents` does neither.

## Alternatives rejected

- Manual Range arithmetic for line boundaries: wrapped lines make
  the visual boundary depend on layout, which Ranges cannot see.
- `beforeinput`-based deletion dispatch: not honoured for
  synthetic dispatches by the editors tested.
- Default on: takes Ctrl+k and friends away from Gmail users on
  update day.

## Cost

jsdom implements neither `Selection.modify` nor `execCommand`, so
this path is verified by the Playwright E2E suite, not unit tests.
