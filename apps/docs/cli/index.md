# @ethlete/cli

Release tooling for repos that version with [Changesets](https://github.com/changesets/changesets). The package installs a single binary, `et`, whose one command - `et release` - turns your pending changesets into a tagged, pushed release commit in one step.

```bash
yarn add --dev @ethlete/cli
```

There is no configuration: the CLI drives the tools already present in your repo (`git`, `yarn`, and your existing `.changeset/` setup).

## `et release`

```bash
yarn et release
```

The command runs the full release sequence synchronously and aborts on the first failing step:

1. **Checks for uncommitted changes** (`git status --porcelain`) and aborts if the working tree is dirty (unless [`--force`](#flags)).
2. **Asks for confirmation** - a reminder not to release a version that was already released from another branch. Press <kbd>Enter</kbd> to continue; typing anything else aborts.
3. Runs `yarn changeset version` - consumes the pending changesets, bumps package versions and writes changelogs.
4. Runs `yarn changeset tag` - creates a git tag per released package version.
5. Stages everything and commits as `Release versions` (your pre-commit hooks run here).
6. Runs `git push --follow-tags` (unless [`--skip-push`](#flags)).

## Flags

| Flag          | Alias | Default | Effect                                                                                                                       |
| ------------- | ----- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `--force`     | `-f`  | off     | Proceed even when the working tree has uncommitted changes (they get committed into the release commit - use with care).     |
| `--skip-push` | `-sp` | off     | Do everything except the final `git push --follow-tags`, e.g. to inspect the release commit and tags before publishing them. |

There are no other commands or flags - running `et` with anything else prints the list of available commands (`release`).

## Requirements

- A git repository with a clean working tree (or `--force`).
- Yarn, with Changesets set up (`.changeset/config.json` and pending changeset files) - the CLI shells out to `yarn changeset version` / `yarn changeset tag` rather than reimplementing them.
