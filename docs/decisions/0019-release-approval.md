# ADR-0019: A release tag is checked and tested, and the release is published only once its owner approves

Status: Draft

## Context

`.github/workflows/release.yml` runs on every pushed `v*` tag and goes
straight through: tests, build, a check that the tag names the
manifest's version, the zip, and `softprops/action-gh-release`, which
publishes the GitHub Release. Pushing the tag is the step that cannot
be taken back, so every tag waits on a person who has loaded `dist/`
and tried the build, and on that same person to type the tag.

The tag check compares the tag with `src/manifest.json` only. A tag on
a commit off main, or a version with no CHANGELOG section, passes.

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
- The person who approves first loads the build and tries it. The
  check that used to come before the tag comes before the approval.
- A tag is then an ordinary step of cutting a release. A rejected one
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
