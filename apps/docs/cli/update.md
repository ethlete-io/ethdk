# Updating the SDK

`et update` moves a repo's `@ethlete/*` dependencies to a newer version and runs the migrations those versions ship. It replaces the two things a developer had to do by hand: find out which version is current, and remember which codemod belongs to which release.

```bash
yarn et update
```

Never bump an `@ethlete/*` range by hand. The version that lands is what selects the migrations, so a hand-written bump skips every one of them without saying so.

## What one run does

1. Reads every `@ethlete/*` dependency of every `package.json` in the repo, in `dependencies`, `devDependencies` and `peerDependencies`.
2. Asks the registry which version each dist tag points at, and picks one target per package.
3. Prints the plan, one line per package.
4. Writes the new ranges into every manifest that declares the package, keeping the `^` or `~` each range was written with.
5. Records the plan in `.ethlete/update/pending.json`, so an interrupted run can be continued.
6. Runs the install with the package manager the repo already uses.
7. Reads the migration manifest out of every **freshly installed** package, and selects the migrations the update crossed.
8. Runs each codemod, oldest version first.
9. Writes everything that needs a decision to `.ethlete/update`.

Step 7 is why the install comes first: the migrations of a version ship inside that version.

## Every manifest, not only the root

An Nx repo keeps a `package.json` per buildable library, and Nx syncs the `@ethlete/*` versions a library imports into it. Those manifests are part of the update: one target is picked per package, then written into every manifest and field that declares it. `node_modules`, `dist`, `coverage`, `tmp` and dot directories are skipped.

The count of manifests that were read is printed above the plan, and the count that changed after they are written.

## Which version it picks

The target follows the dist tag the installed version belongs to. A repo on `5.0.0-next.40` follows `next` and lands on the newest `next`; a repo on `4.9.0` follows `latest`. The tag is printed, so the choice is never silent.

A dist tag can point backwards. If the tag this command picks by itself is older than the version the repo is on, the tag is stale and the package is reported instead of downgraded. An explicit `--tag` or `--to` is taken as asked, so `--tag latest` still moves a repo off the prerelease line.

```bash
yarn et update --check                    # what would change, writes nothing, exits 1 while pending
yarn et update core                       # only @ethlete/core
yarn et update core query                 # two of them
yarn et update --tag latest               # leave the prerelease line
yarn et update core --to 5.0.0-next.55    # an exact version, for the one package you name
```

A package may be named short (`core`) or in full (`@ethlete/core`).

A range no single version can be written into - `workspace:*`, `>=5 <6` - is reported and left alone, together with the version it would have moved to.

## Flags

| Flag             | Effect                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `--check`        | Print the plan and exit 1 while an update is pending. Writes nothing, so CI can run it.                       |
| `--dry-run`      | Print the plan, plus the migrations the **installed** versions know about. The target may ship more.          |
| `--tag <tag>`    | The dist tag to update to, instead of the one the installed version is on.                                    |
| `--to <version>` | An exact version. Name exactly one package with it.                                                           |
| `--from <p@ver>` | The version a package migrates from, when the installed one is already newer than what the migrations expect. |
| `--no-install`   | Write `package.json` and stop. Install yourself, then run `--continue`.                                       |
| `--continue`     | Run the migrations of an update that was written but never finished.                                          |
| `--ai`           | Hand every agent-assisted task to the command in [`updateAgentCommand`](/cli/config).                         |
| `--force`        | Update even when the working tree has uncommitted changes.                                                    |

The working tree must be clean, because the codemods rewrite files and you need a diff you can read. `--force` skips that check.

## When something fails

An install or a codemod that fails stops the run and leaves `.ethlete/update/pending.json` behind. Fix the cause, then continue:

```bash
yarn et update --continue
```

Do not start over. `package.json` already holds the new versions, so a fresh run finds nothing pending and skips every migration the interrupted run had not reached yet.

## The task list

A codemod cannot make a decision about your product, and some changes have no codemod at all. Those land in `.ethlete/update`:

| File                       | What it holds                                                          |
| -------------------------- | ---------------------------------------------------------------------- |
| `tasks.md`                 | The report: what moved, which codemods applied, what is left.          |
| `tasks.json`               | The same tasks as data, for an agent or a script.                      |
| `<package>-<migration>.md` | One task in full: what moved, plus the instructions the package ships. |
| `pending.json`             | Only while a run is unfinished.                                        |

`.ethlete/` is gitignored, so the list is yours, not the repo's.

Each task carries a kind:

- **`auto`** never appears here - it ran.
- **`manual`** is a recommendation. It needs a decision, or a command with answers only you have.
- **`assisted`** is written as a prompt: one change to apply across the repo, of the kind no codemod can make.
- **`unsupported`** is a codemod that could not run, because the repo has no Nx. The task carries the exact command.

## Agent-assisted tasks

An `assisted` task file states one change and how to apply it. Hand it to an agent yourself, or let `et update --ai` do it. The command comes from `updateAgentCommand` in [`ethlete.config.local.json`](/cli/config):

```json
{
  "updateAgentCommand": "claude -p"
}
```

`et update --ai` runs it once per assisted task, in order, so each run has one change to make. The path of the task file replaces `<prompt>` in the command, or is appended when the command names no place for it:

```json
{
  "updateAgentCommand": "claude --permission-mode acceptEdits -p \"Apply the migration in <prompt>\""
}
```

Nothing runs an agent unless `--ai` is passed, and no agent is auto-detected: without the key, `--ai` names the key and stops.

Repos that use `@ethlete/agent-rules` also get the `sdk-update` skill, which teaches an agent how to work the whole list on its own.

## Requirements

- A `package.json` at the repo root. Library manifests deeper in the repo are found from there.
- Network access to the registry, which is read from `npm_config_registry` when npm set it.
- Nx, for the codemods. The migrations ship as Nx generators, so a repo without Nx gets each one reported as a command instead. Everything else works.

## Authoring a migration

A package declares its migrations in `migrations.json` at its own root, and points at it from `package.json`:

```json
{
  "ethlete": { "migrations": "./migrations.json" }
}
```

```json
{
  "migrations": [
    {
      "name": "surface-interaction-swatch",
      "version": "5.0.0-next.46",
      "kind": "auto",
      "description": "Rewrite surface theme interactionColor maps into the swatch shape.",
      "generator": "@ethlete/core:migrate-surface-interaction-swatch",
      "docs": "/core/theming"
    },
    {
      "name": "seo-directive-removed",
      "version": "5.0.0-next.41",
      "kind": "assisted",
      "description": "SeoDirective is gone. Every call site moves to the apply*Binding function for its key.",
      "instructions": "./migrations/seo-directive-removed.md",
      "docs": "/core/seo"
    }
  ]
}
```

| Field          | Meaning                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `name`         | Unique inside the package, and stable: it names the migration in every report.                    |
| `version`      | The version the change landed in. The migration is pending for an update that crosses it.         |
| `kind`         | `auto`, `manual` or `assisted`.                                                                   |
| `description`  | One line. It is the summary a developer reads first.                                              |
| `generator`    | `auto` only: the Nx generator that rewrites the code.                                             |
| `options`      | `auto` only: flags handed to the generator, for example `{ "skipFormat": true }`.                 |
| `instructions` | A markdown file next to the manifest: the recommendation for `manual`, the prompt for `assisted`. |
| `docs`         | A path on this site, for example `/components/button`.                                            |

A migration is selected when `installed < version <= target`. Two rules follow from that:

- Set `version` to the version the change **shipped** in, not the one being developed.
- Never change the `version` of a published entry. A repo that already passed it would run it again.

The instruction files must ship with the package. In an Angular library that means an entry in `ng-package.json`:

```json
{
  "assets": ["migrations.json", { "glob": "**/*.md", "input": "migrations", "output": "./migrations" }]
}
```
