# ADR-0009: Storage writes are pessimistic

Status: Accepted

## Context

Every setting on the options page lives in `chrome.storage.sync`,
which has quotas — a per-item size, a total size, and a write rate.
Exceeding any of them rejects the promise; nothing else reports it.

A control that changes its view before the write resolves keeps
showing a setting storage refused, one that exists only in memory.
The rejection surfaces as an unhandled promise in a console nobody
has open, and the user learns of it at the next reload, when the
setting they watched take effect is gone. The controls concerned are
the keymap store (src/keymapstore.ts) and its call sites
(src/ui/keymap.tsx), the theme toggle (src/ui/theme.tsx), the rich
text toggle (src/ui/richtext.tsx), the language select
(src/ui/language.tsx) and the URL rule editor (src/ui/url.tsx).

## Decision

The write is the commit point. State and the rendered view change
only after `chrome.storage.sync.set` resolves; a rejection shows the
Error's message inline next to the control it belongs to
(`data-testid` ending `-save-error`), and the view resyncs by
reading storage rather than by keeping either value. The next write
that succeeds clears the message.

Resyncing reads must not write. `loadUrlPolicy` runs the legacy
`urls` migration, which is a write, so the failure path passes
`{ migrate: false }`.

## Criteria

A settings page has one job: to say what the settings are. A control
showing a value storage does not hold fails at that job, and fails
silently — the user has no reason to doubt it until the state
disappears. Waiting for the write costs a round trip to local disk,
which is beneath notice at the rate a human toggles a checkbox.

## Alternatives rejected

- Optimistic display with a rollback only on error: the rollback
  still leaves a window in which the page asserts something
  false, and the sync quota is exactly the case where that window
  ends in a reversal the user did not ask for.
- Reporting failures through a toast or the console: a message that
  disappears, or one behind devtools, does not answer "is this
  setting saved?" at the moment the user asks it. The answer belongs
  beside the control.
- Retrying the write: quota exhaustion does not clear on a retry,
  and a rate-limit retry hides a failure the user can act on by
  removing rules.

## Cost

Each control carries its own error element and a resync path, which
is more code than a fire-and-forget `set`. The resync itself can
fail — storage is what refused in the first place — and when it does
the shown save error stays and the view keeps what it last read,
which is the older of two truthful states rather than a false one.
