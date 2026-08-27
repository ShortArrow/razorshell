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

| Shortcut     | Description                           |
| ------------ | ------------------------------------- |
| `Ctrl` + `a` | move cursor to the beginning          |
| `Ctrl` + `b` | move cursor to the previous character |
| `Ctrl` + `e` | move cursor to the end                |
| `Ctrl` + `f` | move cursor to the next character     |
| `Ctrl` + `k` | delete to the end of the line         |
| `Ctrl` + `u` | delete to the beginning of the line   |
| `Ctrl` + `y` | yank                                  |
| `Alt` + `b`  | move cursor to the previous word      |
| `Alt` + `f`  | move cursor to the next word          |
| `Alt` + `y`  | yank pop                              |

<!-- keymap:implemented:end -->

Killed text goes onto a kill ring: consecutive kills join into one entry,
`Ctrl` + `y` puts the newest entry back, and `Alt` + `y` immediately after a
yank cycles to the entry before it. On Windows and Linux `Ctrl` + `y` is the
browser's redo, and Razorshell shadows it while the ring has something to
paste; with an empty ring the key is left alone and redo still works.

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
| `Ctrl` + `_`     | Redo                                  |
| `Ctrl` + `?`     |                                       |
| `Ctrl` + `@`     |                                       |
| `Ctrl` + `Space` |                                       |
| `Alt` + `p`      | non incremental reverse serch history |
| `Alt` + `u`      | up case word                          |
| `Alt` + `l`      | down case word                        |
| `Alt` + `d`      | kill word                             |
| `Alt` + `c`      | change to capital                     |
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
