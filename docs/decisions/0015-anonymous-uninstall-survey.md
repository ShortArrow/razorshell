# ADR-0015: an anonymous form asks why the user uninstalled

Date: 2026-10-22
Status: accepted

## Context

Razorshell has few users and almost no feedback. Issue forms now take
problem reports and binding requests, but the most telling signal for a
small extension is why someone removed it, and that person has no
reason to open the repository. Chrome can open one address of the
extension's choosing after an uninstall (`chrome.runtime.setUninstallURL`),
with no permission.

## Decision

- After an uninstall Chrome opens a Google form titled "Razorshell
  Uninstallation Feedback". It asks why (one multiple-choice question),
  the version, and for optional comments. Every question is optional,
  and the form collects no email address and needs no sign-in.
- The service worker registers the address on every start, with the
  running version prefilled through the form's prefill parameters, so an
  answer names the build the user left. src/uninstall.ts builds it.
- The extension sends nothing itself: the version reaches the form only
  in the address Chrome opens, and only if the user submits.

## Criteria

The person answering has just decided the extension is not worth
keeping, so every step costs answers. An anonymous form with one choice
to tick asks the least. With so few users, each answer matters more than
the uniformity of keeping all feedback on GitHub.

## Alternatives rejected

- A GitHub issue form: nearly every user has an account, but a public,
  named issue saying why they left is a heavy thing to write, and "just
  trying it out" or "did not suit me" would rarely be posted.
- No uninstall page: the departure that explains most would stay silent.
- Telemetry from the extension: a keystroke extension that sends data
  costs trust and store disclosures out of proportion to the gain.

## Cost

The form lives outside the repository and must be kept in step by hand:
its version question is addressed by an entry id fixed in
src/uninstall.ts, and a form rebuilt from scratch gets new ids.
