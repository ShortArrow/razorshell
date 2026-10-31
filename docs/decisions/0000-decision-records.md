# ADR-0000: Decision records state the decision in force

Status: Accepted

## Context

A decision that holds today is read by whoever is about to change the
code it constrains. That reader needs what is decided now and the
forces behind it, not the order in which it was reached. When a
decision changes and the change lands in a new record, the decision
in force is spread over two files, and the reader has to follow the
chain to learn which parts still hold.

## Decision

- One file per decision under `docs/decisions/`, numbered from 0001.
  This record is the policy itself.
- When a decision changes, its record is rewritten in place to state
  the decision in force. The design it replaces moves to
  Alternatives rejected, with the reason it was dropped. Git history
  keeps every earlier text.
- A record carries a status — Draft, Accepted or Withdrawn — and no
  date. It becomes Accepted only when it has no open questions. A
  decision that no longer applies is Withdrawn, and its number is
  never reused.
- A record keeps its file name when its title is rewritten, so a
  commit or CHANGELOG entry that named the old title still reaches it
  through `git log -p` on that path.
- Records are written in the present tense. Why a change was made
  belongs to its commit message; why the design is this way belongs
  here, while the reason holds.

## Criteria

A reader should learn what holds from one file. The history of that
file answers "what were the forces then", which a chain of
superseding records answered only by being read in full.

## Alternatives rejected

- Records frozen when written, superseded by later ones: the decision
  in force needs the whole chain, and the index needs notes saying
  which parts of an older record no longer apply.

## Cost

The text a decision had when it was made is no longer in the
working tree; reading it takes `git log -p` on the record's path.
