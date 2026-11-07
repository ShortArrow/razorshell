# ADR-0019: A release tag is checked and tested, and the release is published only once its owner approves

Status: Accepted

## Context

`.github/workflows/release.yml` runs on every pushed `v*` tag, and its
last step, `softprops/action-gh-release`, publishes a GitHub Release
with the zip of `dist/`. Anyone who loads the extension unpacked takes
it from there, so a published release cannot be taken back once it
has been downloaded. Whether a build is fit to publish is known only
after a person has loaded it and tried it.

A tag can name a commit off main, or a version the manifest or the
CHANGELOG does not carry, and only a check in the workflow stops it.

## Decision

- `release.yml` has two jobs.
  - `verify` runs without approval. It stops unless the tagged commit
    is on main, the tag is `v` and the version in `src/manifest.json`,
    and `docs/CHANGELOG.md` has a `## [<version>]` section. Then it
    runs the unit and story tests, lint, the build and the e2e suite,
    and uploads `razorshell-<tag>.zip` as an artifact.
  - `publish` needs `verify` and runs in the `release` environment,
    which waits for the repository owner's approval and admits only
    `v*` tags. It downloads the zip and creates the GitHub Release.
    Rejecting the approval publishes nothing.
- The person who approves first loads the build and tries it.
- A tag is an ordinary step of cutting a release, taken without
  waiting on that check. A tag whose approval is rejected
  is removed with `git push --delete origin <tag>` and
  `git tag -d <tag>`.
- Submitting the zip to the Chrome Web Store stays a manual step after
  the release.

## Criteria

The step that cannot be taken back should be the one a person takes
on purpose, after looking, and it should come after every check a
machine can make. A published release is read from the Releases page
by anyone who loads the extension unpacked, so a wrong one reaches
users before it can be deleted.

## Alternatives rejected

- Keeping the single job and checking before the tag. The tag starts
  publishing at once, so whoever pushes it has to be the person who
  checked, and a slip in the version or the branch is found only
  after the release exists.
- Publishing a draft release and making it public by hand. The draft
  is not checked against main or the CHANGELOG, and making it public
  is a click outside the workflow that leaves no record of who
  approved it.

## Cost

Each release waits for one click on the run's page in GitHub. The
`release` environment, its required reviewer and its tag rule live in
the repository settings, outside the files, and have to be set up
once. A release whose approval waits more than 30 days expires and
needs the tag pushed again.
