# Razorshell

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ShortArrow/razorshell)

This is a browser extension that adds bash shell-like keyboard shortcuts to textboxes.

![main image](./image/razorshell.svg)

<p align="center">
  <img src="./image/demo.gif" alt="Each chord moving the caret and deleting lines in the options test area">
</p>

<p align="center">
  <a href="./image/demo.webm">▶ Full demo video (webm, 20s): test area, URL policy probe, rebinding</a>
</p>

## Features

<!-- markdownlint-disable md013 -->

### Implemented

These work today.

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

Killed text goes onto a kill ring: consecutive kills join into one entry,
`Ctrl` + `y` puts the newest entry back, and `Alt` + `y` immediately after a
yank cycles to the entry before it. On Windows and Linux `Ctrl` + `y` is the
browser's redo, and Razorshell shadows it while the ring has something to
paste; with an empty ring the key is left alone and redo still works.

The word kills join that ring — `Alt` + `d` and `Alt` + `Backspace` chain with
each other and with the line kills — while `Ctrl` + `d` and `Ctrl` + `h` delete
a single character and deliberately stay off it, so a character delete between
two kills keeps them apart instead of splicing them together. Both take a whole
grapheme: an emoji built from a surrogate pair or joined by zero-width joiners
goes in one press rather than leaving a fragment behind. Three of these shadow
something while a text field has focus: `Alt` + `Backspace` is Windows' other
name for undo (`Ctrl` + `z` is untouched and still undoes), `Ctrl` + `d` is the
bookmark shortcut, and `Ctrl` + `h` is the history shortcut. `Ctrl` + `/` and
`Ctrl` + `Shift` + `_` both reach the field's own undo history, which is the
same history `Ctrl` + `z` walks.

`Alt` + `u`, `Alt` + `l` and `Alt` + `c` recase the word ahead of the caret and
leave the caret at its end; `Alt` + `t` swaps the word before the caret with the
one after it. All four follow readline, which means from the caret rather than
from the start of the word it sits in: mid-word, `Alt` + `u` uppercases only the
tail. They edit through the field's own undo history, so `Ctrl` + `z` takes a
recase back, and a word already in the target case is not rewritten at all.
`Alt` + `t` on a line with fewer than two words does nothing while still
consuming the key, which is how readline's bell translates to a browser.

`Ctrl` + `k` at the end of a line now takes the newline and joins the next line
onto it, instead of doing nothing. Three presses from the start of a line put
the line, the newline and the line after it onto the ring as one entry, so a
single `Ctrl` + `y` gives all of it back. At the very end of the field there is
no newline to take and the key still does nothing.

### Planned (not implemented yet)

Listed for reference; none of these are wired up.

| Shortcut         | Description                           |
| ---------------- | ------------------------------------- |
| `Ctrl` + `c`     | Exit text box                         |
| `Ctrl` + `l`     | clear screen                          |
| `Ctrl` + `p`     | previous history                      |
| `Ctrl` + `r`     | reverse search history                |
| `Ctrl` + `\`     |                                       |
| `Ctrl` + `[`     |                                       |
| `Ctrl` + `]`     | character search                      |
| `Ctrl` + `?`     |                                       |
| `Ctrl` + `@`     |                                       |
| `Ctrl` + `Space` |                                       |
| `Alt` + `p`      | non incremental reverse serch history |
| `Alt` + `.`      | yank last arg                         |

reference `bind -p | grep -E '^"\\(e|C)'`

<!-- markdownlint-enable md013 -->

- [⛔] Browser tab-related shortcuts are reserved and cannot be overwritten
  - [Certain Chrome shortcuts cannot be overridden](https://developer.chrome.com/docs/extensions/reference/api/commands#key-combinations)
- [🚧] Verify shortcut registered and make alart
  - [verify commands registered](https://developer.chrome.com/docs/extensions/reference/api/commands?hl=en#verify_commands_registered)

## Works well with Vimium

[Vimium](https://github.com/philc/vimium) gives the rest of the browser
vim keys: it scrolls, follows links and switches tabs while no text
field has focus, and steps back the moment one does — exactly where
Razorshell takes over. The two do not collide: Vimium speaks unmodified
keys outside text fields, Razorshell speaks `Ctrl`/`Alt` chords inside
them.
