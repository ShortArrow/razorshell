# Razorshell

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ShortArrow/razorshell)

Razorshell is a Chrome extension that gives text fields the readline
keys of a bash prompt: `Ctrl` + `a` to the start of the line,
`Ctrl` + `k` to kill to its end, `Ctrl` + `y` to yank it back. It acts
inside inputs and textareas, optionally inside rich text editors, and
leaves the rest of the page to the browser.

![Razorshell mascot](./image/razorshell.svg)

<p align="center">
  <img src="./image/demo.gif" alt="Each chord moving the caret and deleting lines in the options test area">
</p>

<p align="center">
  <a href="./image/demo.webm">▶ Full demo video (webm, 20s): test area, URL policy probe, rebinding</a>
</p>

## Install

Every `v*` tag publishes a zip of the built extension on the
[Releases page](https://github.com/ShortArrow/razorshell/releases).
Chrome loads it unpacked:

1. Download `razorshell-<version>.zip` from the latest release and
   unzip it.
2. Open `chrome://extensions`, turn on Developer mode, and choose
   "Load unpacked". The folder is the one holding `manifest.json`.
3. Focus any text field and press `Ctrl` + `a`. The caret jumps to the
   start of the line.

To build from a checkout instead, run `pnpm install` and `pnpm build`;
`dist/` is the folder to load.

## Key bindings

The bindings ship in four states. Bound by default is what works after
install. Opt-in bindings exist in the keymap table but take their chord
only when you assign it, because the chord is one the browser uses
inside a text field. Two more chords Chrome reserves for itself, and
you assign them in Chrome's own shortcuts page. The rest is readline
that Razorshell does not implement.

### Bound by default

<!-- markdownlint-disable md013 -->

<!-- keymap:implemented:start -->

| Shortcut                | Description                           |
| ----------------------- | ------------------------------------- |
| `Ctrl` + `a`            | move cursor to the beginning          |
| `Ctrl` + `b`            | move cursor to the previous character |
| `Ctrl` + `d`            | delete char                           |
| `Ctrl` + `e`            | move cursor to the end                |
| `Ctrl` + `f`            | move cursor to the next character     |
| `Ctrl` + `h`            | backward delete char                  |
| `Ctrl` + `k`            | delete to the end of the line         |
| `Ctrl` + `u`            | delete to the beginning of the line   |
| `Ctrl` + `y`            | yank                                  |
| `Ctrl` + `/`            | undo                                  |
| `Ctrl` + `Shift` + `_`  | undo                                  |
| `Alt` + `b`             | move cursor to the previous word      |
| `Alt` + `c`             | capitalize word                       |
| `Alt` + `d`             | kill word                             |
| `Alt` + `f`             | move cursor to the next word          |
| `Alt` + `l`             | downcase word                         |
| `Alt` + `t`             | transpose words                       |
| `Alt` + `u`             | upcase word                           |
| `Alt` + `y`             | yank pop                              |
| `Alt` + `Backspace`     | backward kill word                    |

<!-- keymap:implemented:end -->

Killed text goes onto a kill ring. `Ctrl` + `k`, `Ctrl` + `u`,
`Alt` + `d` and `Alt` + `Backspace` all put what they remove on it,
and consecutive kills at one caret join into a single entry in the
order readline keeps. `Ctrl` + `y` puts the newest entry back, and
`Alt` + `y` straight after a yank cycles to the entry before it. The
ring is per frame, holds ten entries, is never written to storage, and
never keeps text killed in a password field.

`Ctrl` + `k` at the end of a line takes the newline and joins the next
line onto it. Three presses from the start of a line put the line, the
newline and the line after it onto the ring as one entry, so a single
`Ctrl` + `y` gives all of it back. At the very end of the field there
is no newline to take and the key does nothing.

`Ctrl` + `d` and `Ctrl` + `h` delete one character and stay off the
ring, so a character delete between two kills keeps them apart instead
of splicing them together. Both take a whole grapheme: an emoji built
from a surrogate pair or joined by zero-width joiners goes in one press
rather than leaving a fragment behind.

`Ctrl` + `/` and `Ctrl` + `Shift` + `_` both step back through the
field's own undo history, the same history `Ctrl` + `z` walks. Every
edit Razorshell makes goes through that history, so `Ctrl` + `z` takes
a kill or a recase back.

`Alt` + `u`, `Alt` + `l` and `Alt` + `c` recase the word ahead of the
caret and leave the caret at its end. They measure from the caret, as
readline does, so mid-word `Alt` + `u` uppercases only the tail. A word
already in the target case is not rewritten at all. `Alt` + `t` swaps
the word before the caret with the one after it; on a line with fewer
than two words it does nothing and still consumes the key, which is how
readline's bell translates to a browser.

Some default chords are browser shortcuts too. While a text field has
focus Razorshell takes them; outside one the browser keeps them.

| Chord               | Browser meaning it shadows           | When Razorshell takes it            |
| ------------------- | ------------------------------------ | ----------------------------------- |
| `Ctrl` + `y`        | Redo on Windows and Linux            | Only while the ring holds an entry  |
| `Ctrl` + `d`        | Bookmark this page                   | Whenever a text field has focus     |
| `Ctrl` + `h`        | History                              | Whenever a text field has focus     |
| `Alt` + `Backspace` | Undo, on Windows                     | Whenever a text field has focus     |

`Ctrl` + `z` is untouched and still undoes everywhere.

### Opt-in bindings

These ship unbound because the chord readline gives them is one you
press all day in the browser. The keymap table shows the suggested
chord in its default column and `—` as current. Press the row's rebind
button and type the chord to take it; reset on the row gives the
browser key back. See
[ADR-0012](docs/decisions/0012-unassigned-keymap-entries.md).

<!-- keymap:optin:start -->

| Suggested shortcut      | Description                           |
| ----------------------- | ------------------------------------- |
| `Ctrl` + `c`            | kill whole field                      |
| `Ctrl` + `j`            | accept line                           |
| `Ctrl` + `o`            | open line                             |

<!-- keymap:optin:end -->

Kill whole field is bash's `Ctrl` + `c` with one difference: the whole
value, every line of a textarea, goes onto the ring instead of being
discarded, so a slip is one `Ctrl` + `y` from undone. Accept line is
readline's `Ctrl` + `j`, which is Enter: in an input it submits the
form, in a textarea it inserts a newline. Open line is Emacs'
`Ctrl` + `o`: a newline goes in at the caret and the caret stays before
it. Accept line and open line act only where they can, so in an input
with no form, or an input asked for a newline, the key stays with the
browser.

### Reserved chords you assign in Chrome

Chrome handles `Ctrl` + `w` (close tab) and `Ctrl` + `t` (new tab)
before any page sees the keystroke, so no extension can take them from
a content script, and Chrome refuses to let a manifest suggest them. What
Chrome does allow is an assignment you make yourself.

| Chord          | Description                                             |
| -------------- | ------------------------------------------------------- |
| `Ctrl` + `w`   | unix-word-rubout: kill back to the previous whitespace  |
| `Ctrl` + `t`   | transpose-chars: swap the two characters at the cursor  |

The keymap table's last two rows are these chords, grayed until you
assign them. The button on each opens `chrome://extensions/shortcuts`,
a page an ordinary link cannot reach. Find Razorshell's two entries
there and assign the chords.

Once assigned, the chord reaches Razorshell instead of the browser
while a text field has focus. `Ctrl` + `w` kills back to the last
whitespace, which is coarser than `Alt` + `Backspace`: in a shell it
swallows a whole path or a hyphenated token in one press. It joins the
kill ring like any other kill. `Ctrl` + `t` swaps the two graphemes
around the cursor through the field's own undo history.

Outside a text field the browser behaviour is still there. Press
`Ctrl` + `w` with nothing focused and the tab closes; `Ctrl` + `t`
opens a tab. Razorshell reproduces the action it displaced rather than
swallowing the key, and the same holds on a page your URL rules deny.
`Ctrl` + `n` is not offered: readline's C-n is next-history, and a text
field has no history to step through. See
[ADR-0011](docs/decisions/0011-reclaimed-reserved-chords.md).

### Not implemented

These readline chords have no counterpart in Razorshell. Most need
something a text field does not have, such as a command history.

| Shortcut         | readline operation                    |
| ---------------- | ------------------------------------- |
| `Ctrl` + `l`     | clear-screen                          |
| `Ctrl` + `p`     | previous-history                      |
| `Ctrl` + `r`     | reverse-search-history                |
| `Ctrl` + `]`     | character-search                      |
| `Ctrl` + `@`     | set-mark                              |
| `Alt` + `p`      | non-incremental-reverse-search-history |
| `Alt` + `.`      | yank-last-arg                         |

`bind -p | grep -E '^"\\(e|C)'` in bash lists the full set.

<!-- markdownlint-enable md013 -->

## Options page

Right-click the toolbar icon and choose Options, or open it from
`chrome://extensions`. Every change is written to `chrome.storage.sync`
before the page shows it, reaches open tabs without a reload, and
survives a browser restart. A write the browser refuses is shown beside
the control it belongs to, and the control goes back to what storage
holds.

### URL rules

Each rule pairs a pattern with allow or deny. Rules apply in list
order; the first match decides, and a page no rule matches takes the
default action, which starts as allow. A pattern is exact, glob or
regex. In a glob, `*` and `?` stay inside one path segment and `**`
crosses `/`, so `https://example.com/**` covers a site and
`https://example.com/*` covers one path segment. A URL tester above
the list shows which rule a URL hits and what happens to it. The
toolbar icon carries a badge on tabs where the rules turn Razorshell
off.

### Keymap

Each row shows an action, its default chord and its current chord.
Press the rebind button, then the new chord; a chord another row
already holds is refused and that row is named. Reset on a row returns
it to its default, and reset-all clears every override. Opt-in rows
and the two Chrome-assigned rows sit at the bottom, grayed while
unassigned.

### Rich text editors

Off by default. Turning it on applies the bindings inside
`contenteditable` editors such as Gmail's composer. Line motions and
kills there follow the visual line the browser renders. Editors and
fields inside open shadow roots are reached as well. The default is
off because rich editors ship their own shortcuts, and `Ctrl` + `k` as
"insert link" is common; the inspector below shows what a page already
handles.

### Import and export

Export downloads every setting as one JSON file. Import applies a
pasted or chosen file. The file is validated first, and a refusal
names the field; an import applies all of its keys or none.
[config.sample.json](config.sample.json) shows the format.

### Language and theme

Tooltips localize into eleven languages. They follow the browser
language unless the select overrides it; the rest of the page is
English. The theme toggle switches between light and dark.

## Find conflicts with a page

Click the toolbar icon, then click a text field on the page. A toast
reports which of the current bindings the page already handles: chords
the page has been seen cancelling during real typing, chords its
handler code names, and a count of listeners that could not be
analyzed. Nothing is dispatched to the page, so the check never fires a
page's own shortcut.

## Works well with Vimium

[Vimium](https://github.com/philc/vimium) gives the rest of the browser
vim keys: it scrolls, follows links and switches tabs while no text
field has focus, and steps back the moment one does, which is where
Razorshell takes over. The two do not collide: Vimium speaks unmodified
keys outside text fields, Razorshell speaks `Ctrl` and `Alt` chords
inside them.

## Limits

- macOS is not supported. Option composes glyphs, so `event.key` for
  Option+F is `ƒ` and the `Alt` bindings never match.
- `email` and `number` inputs keep their native behaviour. The
  selection API the operations rely on does not exist on those types.
- Fields inside closed shadow roots are out of reach by platform
  design.
- Chrome's [reserved shortcuts](https://developer.chrome.com/docs/extensions/reference/api/commands#key-combinations)
  cannot be taken by an extension; only the two above are offered,
  and only through Chrome's own assignment.

## Develop

`pnpm check` runs the typecheck, lint, unit tests and story tests.
`pnpm build` writes `dist/`, which the Playwright end-to-end suite
loads as the extension. Design decisions are one-page records under
[docs/decisions](docs/decisions/README.md), the claim the suites
support is in [docs/assurance.md](docs/assurance.md), and changes are
listed in [docs/CHANGELOG.md](docs/CHANGELOG.md).

## License

[MIT](LICENSE).
