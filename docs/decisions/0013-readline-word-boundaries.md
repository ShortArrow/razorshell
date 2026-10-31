# ADR-0013: word motions follow readline's alphanumeric words

Status: Accepted

## Context

readline's forward-word, backward-word, kill-word,
backward-kill-word, the three case operations and transpose-words
share one word unit: a run of characters for which `rl_alphabetic`
holds, which is `isalnum`. Punctuation separates words, so Alt+F from
the start of `foo-bar baz` stops at 3 and Alt+U uppercases `foo`
alone.

The whitespace unit belongs to one command alone, readline's
`unix-word-rubout` (C-w), which this extension implements in its own
module with its own boundary (ADR-0011). The two units differ exactly
on punctuation: C-w swallows a path or a hyphenated token in one
press, and the word commands take it a segment at a time.

In contenteditable the word operations run on the editing engine's
own word unit through `Selection.modify` (ADR-0005), which is not a
whitespace split either.

## Decision

- A word character is a letter or a digit, `\p{L}` or `\p{N}`, plus
  a combining mark `\p{M}`, so accented text in decomposed form
  stays one word. Everything else separates words. The test is made
  per code point, so a letter outside the BMP is one word character.
- `cursor.getEndOfWord` and `cursor.getTopOfWord` take that unit and
  otherwise keep their shape: forward-word skips non-word characters
  and then the word after them, backward-word the mirror. The word
  kills, the case operations and transpose-words read the same
  predicate (`isWordCharacter`), so each still covers exactly the
  span its motion crosses.
- Ctrl+W keeps the whitespace boundary of `rl_unix_word_rubout`. On
  `foo bar-baz` with the caret at the end the rubout removes
  `bar-baz` and Alt+Backspace removes `baz`, as in readline.

## Criteria

The bindings exist to be readline's, and a user's muscle memory from
bash is the specification they are checked against. With this unit
a text field and a rich text editor draw the same kind of boundary,
and C-w keeps the reason it is bound separately: swallowing a path or
a hyphenated token in one press.

## Alternatives rejected

- Whitespace words, splitting on space, tab, newline and carriage
  return only. C-w and Alt+Backspace become extensionally equal: on
  2026-09-05 an exhaustive search over every string up to length six
  on `{a, space, newline}` found no caret where they differed, so
  Ctrl+W is no coarser than Alt+Backspace. The case operations and
  transpose-words carry punctuation along with their words where
  readline does not, and a text field disagrees with a rich text
  editor on what Alt+Backspace removes.
- ASCII-only `isalnum` (`[A-Za-z0-9]`), which is readline's in the C
  locale. It makes every CJK character and every accented letter a
  separator, so Alt+F would cross `日本語` one character at a time
  and stop inside `café`.

## Cost

Alt+Backspace takes a URL or path one segment per press; the whole
token needs Ctrl+W, which ships unassigned. That is readline's own split between the two commands.
