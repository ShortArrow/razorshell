# Razorshell

This is a browser extension that adds bash shell-like keyboard shortcuts to textboxes.

![main image](./image/razorshell.svg)

## Features

<!-- markdownlint-disable md013 -->

| Shortcut                | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `Ctrl` + `a`            | Go to start of line                             |
| `Ctrl` + `b`            | Go backward character                           |
| `Ctrl` + `c`            | Exit text box                                   |
| ~~`Ctrl` + `d`~~        | Delete character                                |
| `Ctrl` + `e`            | Go to end of line                               |
| `Ctrl` + `f`            | Go forward character                            |
| ~~`Ctrl` + `h`~~        | backspace                                       |
| `Ctrl` + `k`            | kill line                                       |
| `Ctrl` + `l`            | clear screen                                    |
| `Ctrl` + `p`            | previous history                                |
| `Ctrl` + `r`            | reverse search history                          |
| ~~`Ctrl` + `t`~~        | transpose characters                            |
| `Ctrl` + `u`            | Delete from the cursor to the start of the line |
| ~~`Ctrl` + `w`~~        | Delete character before                         |
| `Ctrl` + `y`            | Paste the yanked                                |
| `Ctrl` + `\`            |                                                 |
| `Ctrl` + `[`            |                                                 |
| `Ctrl` + `]`            | character search                                |
| `Ctrl` + `_`            | Redo                                            |
| `Ctrl` + `?`            |                                                 |
| `Ctrl` + `@`            |                                                 |
| `Ctrl` + `Space`        |                                                 |
| `Alt` + `f` (`Esc`,`f`) | Go forward word                                 |
| `Alt` + `b` (`Esc`,`b`) | Go backward word                                |
| `Alt` + `p`             | non incremental reverse serch history           |
| `Alt` + `u`             | up case word                                    |
| `Alt` + `l`             | down case word                                  |
| `Alt` + `d`             | kill word                                       |
| `Alt` + `c`             | change to capital                               |
| `Alt` + `.`             | yank last arg                                   |

reference `bind -p | grep -E '^"\\(e|C)'`

<!-- markdownlint-enable md013 -->

- [⛔] Browser tab-related shortcuts are reserved and cannot be overwritten
  - [Certain Chrome shortcuts cannot be overridden](https://developer.chrome.com/docs/extensions/reference/api/commands#key-combinations)
- [🚧] URL allow/deny list
  - changeable allow list mode or deny list mode
- [🚧] Verify shortcut registered and make alart
  - [verify commands registered](https://developer.chrome.com/docs/extensions/reference/api/commands?hl=en#verify_commands_registered)
