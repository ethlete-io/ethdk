# @ethlete/cli

Repo tooling. The package installs a single binary, `et`, with three commands: `et release` turns pending changesets into a tagged, pushed release commit, [`et api`](/cli/api) runs the backend an app talks to from a checkout on your own machine, and [`et doctor`](/cli/config#et-doctor) checks that machine's setup.

```bash
yarn add --dev @ethlete/cli
```

`et release` needs no configuration: it drives the tools already present in your repo (`git`, `yarn`, and your existing `.changeset/` setup). `et api` and `et doctor` read two files described in [Local APIs](/cli/api) and [Local config](/cli/config).

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

### Flags

| Flag          | Alias | Default | Effect                                                                                                                   |
| ------------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `--force`     | `-f`  | off     | Proceed even when the working tree has uncommitted changes (they get committed into the release commit - use with care). |
| `--skip-push` | `-sp` | off     | Do everything except the final `git push --follow-tags`, e.g. to inspect the release commit and tags before publishing.  |

### Requirements

- A git repository with a clean working tree (or `--force`).
- Yarn, with Changesets set up (`.changeset/config.json` and pending changeset files) - the CLI shells out to `yarn changeset version` / `yarn changeset tag` rather than reimplementing them.

## Other commands

- [`et api`](/cli/api) - start, stop and inspect the containers of a local backend, and move its checkout to the right branch.
- [`et doctor`](/cli/config#et-doctor) - report every problem with this machine's config and API checkouts at once.

Running `et` with no command, `--help` or an unknown command prints the command list.
