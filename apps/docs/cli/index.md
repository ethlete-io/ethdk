# @ethlete/cli

Repo tooling. The package installs a single binary, `et`, with six commands: `et release` turns pending changesets into a tagged, pushed release commit, [`et api`](/cli/api) runs the backend an app talks to from a checkout on your own machine, [`et auth`](/cli/auth) writes the git host token a private dependency needs, [`et update`](/cli/update) moves the `@ethlete/*` packages to a newer version and runs the migrations they ship, [`et migrations`](/cli/update#migration-levels) runs the optional ones when the app is ready, and [`et doctor`](/cli/config#et-doctor) checks that machine's setup.

```bash
yarn add --dev @ethlete/cli@next
```

`et update` ships on the `next` tag; the `latest` release does not have it yet.

`et release` needs no configuration: it drives the tools already present in your repo (`git`, your package manager, and your existing `.changeset/` setup). `et api` and `et doctor` read two files described in [Local APIs](/cli/api) and [Local config](/cli/config).

## `et release`

```bash
yarn et release
```

The command runs the full release sequence synchronously and aborts on the first failing step:

1. **Checks for uncommitted changes** (`git status --porcelain`) and aborts if the working tree is dirty (unless [`--force`](#flags)).
2. **Asks for confirmation** - a reminder not to release a version that was already released from another branch. Press <kbd>Enter</kbd> to continue; typing anything else aborts.
3. Runs `changeset version` - consumes the pending changesets, bumps package versions and writes changelogs. If there are no pending changesets, the command aborts here.
4. Stages only the files the version step changed (package versions, changelogs, consumed changesets) and commits them as `Release versions`, or the [`--message`](#flags) you pass (your pre-commit and commit-msg hooks run here). If the commit fails, the command stops before any tag exists, and names the commands that finish the release once the staged files are committed.
5. Runs `changeset git-tag` (Changesets 3) or `changeset tag` (Changesets 2) - tags the release commit once per released package version.
6. Runs `git push --follow-tags` (unless [`--skip-push`](#flags)).

Changesets runs through the package manager the repo uses (`yarn changeset`, `pnpm exec changeset`, `bunx changeset` or `npx changeset`), detected from `packageManager` in `package.json` or the lockfile.

### Flags

| Flag          | Alias | Default            | Effect                                                                                                                      |
| ------------- | ----- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `--force`     | `-f`  | off                | Proceed even when the working tree has uncommitted changes (they are left uncommitted and stay out of the release commit).  |
| `--skip-push` | `-sp` | off                | Do everything except the final `git push --follow-tags`, e.g. to inspect the release commit and tags before publishing.     |
| `--message`   | `-m`  | `Release versions` | The release commit message, e.g. `--message "chore(release): Release versions"` when a commitlint hook rejects the default. |
| `--help`      | `-h`  |                    | Print the flags and run nothing. An unknown flag is rejected the same way, before any step runs.                            |

### Requirements

- A git repository with a clean working tree (or `--force`).
- `@changesets/cli` in the root `package.json`, with Changesets set up (`.changeset/config.json` and pending changeset files) - the CLI shells out to `changeset version` and `changeset git-tag` (or `tag` on Changesets 2) rather than reimplementing them. Without `@changesets/cli` the command stops before the prompt.

## Other commands

- [`et api`](/cli/api) - start, stop and inspect the containers of a local backend, and move its checkout to the right branch.
- [`et auth`](/cli/auth) - write a GitLab token into composer's `auth.json`, after checking that it can fetch code.
- [`et update`](/cli/update) - move the `@ethlete/*` packages to a newer version, run the codemods those versions ship, and report what needs a decision.
- [`et migrations`](/cli/update#migration-levels) - list the recommended and optional migrations the app has not run, and run one of them.
- [`et doctor`](/cli/config#et-doctor) - report every problem with this machine's config and API checkouts at once.

Running `et` with no command, `--help` or an unknown command prints the command list.
