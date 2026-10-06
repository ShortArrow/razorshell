# ADR-0014: a one-time hint says rich text editors are off

Date: 2026-10-07
Status: accepted

## Context

Rich text support is off by default (ADR-0005), so a bound chord
pressed in Gmail's composer or a Notion page does nothing. Nothing on
the page says why, and a user who installed the extension for its keys
reads the silence as the extension being broken. The setting that would
fix it sits on the options page, which a user who thinks the extension
is broken has no reason to open.

The default itself stays: ADR-0005 keeps it off because rich editors
own chords such as Ctrl+K (insert link), and taking them on update day
would break existing users.

## Decision

- With the opt-in off, the first keydown in a contenteditable root that
  matches a bound chord with a rich text counterpart shows a toast:
  the title says Razorshell is off in rich text editors, the line names
  the "Enable in rich text editors" setting and says the tip shows once.
  The toast is the inspector's (src/inspecttoast.ts), dismissed by a
  click or after eight seconds.
- The key is never taken. The hint only watches; the keydown reaches the
  page exactly as it does without the hint.
- The record that the hint was shown lives in `chrome.storage.local`
  under `richTextHintShown`. A frame consults storage at most once, and
  the hint is shown only after the record is written.
- Chords with no rich text counterpart, unassigned opt-in chords, plain
  typing and presses inside an IME composition do not count.
- The decision lives in src/richtexthint.ts as a function of injected
  read, write, show and keymap, so it is unit-tested as plain state.

## Criteria

Once per profile is the line between telling and nagging. The user
pressing a chord in a rich editor is the one moment the information is
both relevant and wanted; after they have seen it, either they turn the
setting on or they have decided not to, and repeating it would only cost
them the editor's own shortcut feedback.

`local` rather than `sync`: the record describes this browser having
been told, not a preference. It should not travel in exports, and a new
browser profile is a reasonable place to tell the user again.

Writing before showing: a hint that could not be recorded would come
back on every page load, which is the nag this decision exists to avoid.

## Alternatives rejected

- Opening the options page on install: it fires before the user has met
  the problem, in a tab they close, and says nothing at the moment the
  keys fail.
- A hint on every press, or every page: Gmail users press Ctrl+K for
  links many times a day.
- Turning rich text on by default: ADR-0005's reason stands.
- A badge on the toolbar icon: the badge already means "off on this
  page by URL rule" (ADR-0001), and a second meaning would muddle both.

## Cost

One more storage key, one more pair of messages in eleven locales, and
the content script's keydown path now does work for rich editors while
the opt-in is off. That work is a keymap match on the first qualifying
press per frame and nothing after it.
