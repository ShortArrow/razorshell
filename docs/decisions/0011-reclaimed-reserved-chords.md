# ADR-0011: reserved chords are reclaimed by opt-in, and pay back what they displace

Date: 2026-09-05
Status: accepted

## Context

Ctrl+W and Ctrl+T are readline's `unix-word-rubout` and
`transpose-chars`, and both are chords Chrome handles before the
renderer sees the keystroke. A content script cannot cancel either;
`preventDefault` on the keydown never runs, because there is no
keydown. The extension's whole delivery mechanism — a document-level
listener in every frame — has no reach here.

The commands API is the one documented way in. A command the user
assigns in chrome://extensions/shortcuts is dispatched to the
extension INSTEAD of the browser action. On 2026-09-05 a probe
(experiments/commands-probe) established in a real Chrome that the
shortcuts page accepts a manual Ctrl+W assignment and that the
assigned command then fires with a text field focused, while the tab
stays open. The harness cannot reproduce this: CDP-injected keys skip
the accelerator path entirely on Windows and Linux.

Chrome refuses `suggested_key` for a reserved chord outright, so
shipping these as defaults is not merely inadvisable — the manifest
would not load.

## Decision

- Two commands in the manifest, `unix_word_rubout` and
  `transpose_chars`, both with NO `suggested_key`. They arrive
  unassigned and stay inert until the user assigns them.
- Descriptions localize through `__MSG_` keys, so the shortcuts page
  names them in the browser's language.
- `chrome.commands.onCommand` in the service worker asks the active
  tab whether a razorshell text field has focus and whether the URL
  policy leaves the extension on in that frame, then routes:
  focused and enabled runs the operation in the content script;
  anything else REPRODUCES THE BROWSER ACTION — `tabs.remove` for
  Ctrl+W, `tabs.create` for Ctrl+T.
- The routing is a pure function, `commandAction` in
  src/commandroute.ts. The listener gathers two facts and calls it.
- The options page carries a section explaining the opt-in with a
  button that opens the shortcuts page through `chrome.tabs.create`.
- Ctrl+N is NOT among them.

## Criteria

Reproducing the displaced action is the load-bearing half. A user who
assigns Ctrl+W has not asked to lose tab-close; they have asked for
the rubout where a rubout makes sense. Leaving the unfocused case
silent would make an assignment cost the user a browser shortcut they
use hundreds of times a day, and the assignment is one-way — it lives
in Chrome's settings, not the extension's, so an uninstall does not
obviously undo it. Paying the action back is what makes the opt-in
safe to accept.

A denied frame takes the same arm as an unfocused one, deliberately.
Razorshell is off there by the user's own policy, so the honest
behaviour is the browser's.

The decision is pure because it cannot be pressed. The reserved chord
never reaches the harness, so a decision embedded in the listener
would have no test at all; extracted, three of its four classes are
unit-tested and the fourth — the message path — is driven from the
service worker in e2e. What remains is interception itself, which
rests on the manual measurement and is recorded as R9.

Ctrl+N is omitted because readline's C-n is `next-history`, and a
text field has no history to step to. The other two name operations
that mean something in a textarea; C-n would be a reserved chord
claimed for nothing, costing the user new-window for no gain.

## Alternatives rejected

- `suggested_key` for the two chords: Chrome rejects reserved chords
  there, and the manifest fails to load.
- Claiming the chord and staying silent outside a text field: takes a
  daily browser shortcut away as the price of a rubout.
- Routing inside the listener: leaves the decision untestable, since
  the chord that triggers it cannot be pressed under CDP.
- A `commands` entry for Ctrl+N: an operation with no referent.
- Handling the reclaimed chords through the ordinary keymap: they
  never arrive as keydowns, so no dispatcher would ever see them.

## Cost

No new permission is required. `tabs.create`, `tabs.remove` and
`tabs.query` work without the `tabs` permission — that permission
only unlocks reading `url` and `title` from Tab objects, which the
routing never does (focus comes from the content script over
messaging). This was measured by stripping the permission from a
built copy and driving all three calls from the service worker; the
URLs came back hidden and every call succeeded. Taking `tabs` would
have added the "read your browsing history" warning and disabled the
extension for existing users until re-approval.

The two operations reach fields only through the message path, so
they have no contenteditable counterpart: the worker's reply targets
`isTextField` and declines a rich-text root, the same refusal the
case operations make.

Half of C1.18 is manual and dated. It decays; a Chrome that stopped
dispatching assigned reserved chords would leave the suites green.
