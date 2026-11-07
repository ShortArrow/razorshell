# ADR-0018: A tutorial opens from the toolbar icon's menu and advances on the field state each chord produces

Status: Accepted

## Context

After install nothing opens: src/service.ts registers no `onInstalled`
handler. What tells a user which keys to try is the README and the
options page's test area, which they have to find and which names no
chord to try. Ctrl+W and Ctrl+T work only
after the user assigns them in `chrome://extensions/shortcuts`, and
nothing in the extension says so where the user is.

Content scripts do not run on extension pages, so a page of the
extension that wants the keys handles them itself, as the test area in
src/ui/testui.tsx does by calling `keyEventHandling`, which reads the
keymap in force through `getActiveKeymap`.

## Decision

- The toolbar icon's context menu carries a "Tutorial" item. The
  service worker creates it with `chrome.contextMenus` in the `action`
  context on `onInstalled`, and a click opens `tutorial.html` in a new
  tab. The manifest gains the `contextMenus` permission, which Chrome
  installs without a warning, so an update to a version that adds it
  does not disable the extension.
- Nothing opens by itself, on install or on update.
- `tutorial.html` is a page of its own, an ESM entry of
  `vite.config.ts` beside the options page. It shows one step at a
  time, each a single text field.
- A step is a Given, a When and a Then over the field's state, which
  is its `value`, `selectionStart` and `selectionEnd`:
  - Given: the value and caret the field is reset to as the step opens.
  - When: the operation to try, shown as the chord the keymap in force
    binds it to, so a rebound key is shown as rebound.
  - Then: the state the operation leaves.
- The step advances when a keydown that the keymap handled leaves the
  field in the Then state. A state reached by mouse, arrow keys or
  typing does not advance it. A Reset button puts the Given state back.
  Once the last step passes, the field stays, read-only, showing what
  that step left in it, since otherwise the effect of its chord is
  never seen.
- The steps, in order: Ctrl+A, Ctrl+E, Alt+B, Ctrl+K, Ctrl+Y. A step
  whose operation the keymap in force leaves unassigned is shown as
  skipped, with its name, and the next step opens. A step that rests
  on an earlier one is skipped with it: the Ctrl+Y step needs the text
  the Ctrl+K step killed.
- The last step is about Ctrl+W and Ctrl+T. A button opens
  `chrome://extensions/shortcuts`, and the step reads
  `chrome.commands.getAll()` to show whether each of the two commands
  has a shortcut. It does not wait for one; the tutorial ends here
  either way.
- Below it, the done screen names three sections of the options page
  by their headings, Keymap, Rich text editors and URL policy, each
  with what it does and how it starts, and a button opens the options
  page with `chrome.runtime.openOptionsPage`. They are pointers, not
  steps: the tutorial's field is a plain input under no URL rule, so
  neither a rich text editor nor a rule can be tried in it.
- As the last step the field judges passes, the page throws one burst
  of confetti, drawn with CSS by src/ui/celebrate.ts. A user who asks
  for reduced motion gets none.
- Progress is not stored. Each open starts at the first step.
- The page's strings are English literals, as on the options page
  (ADR-0007).
- The menu item's title is localized: each locale under `src/_locales`
  carries a `menu_tutorial` key, read with `chrome.i18n.getMessage`.
  Chrome shows the title, as it shows the extension's name and the
  two commands' descriptions, which the locales already translate.

## Criteria

The tutorial is for a user who has just installed and wants to know
what the keys do. They learn a chord by pressing it and seeing the
field change, so a step judges the result in the field, not a click on
"next". Judging only the state would let a step pass by arrow keys,
which teaches nothing about the chord, so the key that produced the
state has to be one the keymap handled.

The icon's menu is where a user looks for something the extension
offers, and it stays there, so the tutorial can be taken again at any
time, not only once.

## Alternatives rejected

- Opening the tutorial on install. It interrupts whatever the user was
  doing, and the menu reaches the same page whenever it is wanted.
- A tutorial section inside the options page. The options page is the
  reference for every setting; a step-by-step lesson is a different
  reader's need, and the two would compete for the same screen.
- The side panel (`chrome.sidePanel`). Its use is a guide beside a
  real page, but every step judges only the tutorial's own field, so
  the page beside it plays no part; the panel is narrow for a field, a
  chord and its controls; and Playwright has no way to open it, while
  a tab is opened and asserted like any page.
- An Alt+Y (yank-pop) step after Ctrl+Y. It acts only with two
  entries on the kill ring, so its Given would rest on kills made in
  earlier steps, and it is the next key for a user already at home
  with Ctrl+Y rather than one to learn first. The README describes it.
- Advancing on the field state alone. Arrow keys and the mouse reach
  most Then states without the chord.
- Advancing on the keydown alone. A chord that matched but left the
  field unchanged, such as Ctrl+Y with an empty kill ring, would pass.
- canvas-confetti for the burst. A single burst would bring in a 25 KB
  library and its type package.

## Cost

A permission, a context menu entry, one more page and build entry, and
the stories, screenshots and e2e cases a page carries. A step's Given
and Then are fixed text, so a change to how an operation behaves
changes the step's Then with it. The confetti's motion is code of our
own, so tuning how it looks is ours too. Outside English, the menu item
is in the user's language and the page it opens is not.
