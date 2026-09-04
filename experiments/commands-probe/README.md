# Commands-API reserved-chord probe

Chrome reserves Ctrl+W (and Ctrl+T, Ctrl+N) before the renderer, so a
content script can never cancel them. The one documented way around is
the commands API: a user can assign a chord to an extension command in
`chrome://extensions/shortcuts`, and an assigned command is dispatched
instead of the browser action. Whether that page ACCEPTS a reserved
chord, and whether the assignment then really beats tab-close, cannot
be measured by this repository's harness — CDP-injected keys skip the
browser's accelerator path entirely — so this probe exists for a human
with a real Chrome.

The probe's command routes by focus: with a text field focused it only
paints a "W" badge on the toolbar icon (proof of interception while
typing); with nothing focused it closes the tab itself through
`chrome.tabs.remove`, reproducing the browser behavior it displaced.
The messaging and both focus states are smoke-tested headlessly; only
the assignment and interception need hands.

## Protocol

1. `chrome://extensions` → Load unpacked → this directory.
2. `chrome://extensions/shortcuts` → "Razorshell C-w probe" → pencil →
   press Ctrl+W. Record whether the field accepts it.
3. If accepted, in a THROWAWAY tab: focus a text input, press Ctrl+W —
   expected: the tab stays and the icon shows a purple "W" badge. Then
   click empty page space (nothing focused) and press Ctrl+W —
   expected: the tab closes.
4. Optionally repeat step 2 with Ctrl+T and Ctrl+N and record each.

## Result

| Question | Observed | Date |
|---|---|---|
| Shortcuts page accepts Ctrl+W | (unrecorded) | |
| Focused: intercepted, badge shown, tab stays | (unrecorded) | |
| Unfocused: tab closes via tabs.remove | (unrecorded) | |
| Ctrl+T / Ctrl+N accepted | (unrecorded) | |
