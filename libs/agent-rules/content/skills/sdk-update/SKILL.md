---
name: sdk-update
description: Update the @ethlete/* packages in this repo with `et update`, and work the migration tasks it leaves behind - the codemods it runs itself, the recommendations a human must decide, and the tasks written as a prompt for you. Read whenever this repo moves to a newer @ethlete version, when a task list under .ethlete/update is present, or when the user asks you to apply an SDK migration.
kind: skill
scope: consumer
requires: ['@ethlete/cli']
vars: [docsBaseUrl, lintCommand]
---

# Updating the @ethlete SDK

`et update` moves this repo's `@ethlete/*` dependencies to a newer version and runs the migrations
those versions ship. Never bump an `@ethlete/*` range by hand: the version that lands is what selects
the migrations, so a hand-written bump skips every one of them silently.

## 1. See what is pending

```bash
yarn et update --check
```

It prints one line per package, `installed → target`, and exits 1 while an update is pending. It
writes nothing. The target follows the dist tag the installed version is on: a repo on a `-next`
prerelease stays on `next`.

Name a package to limit the run, short or in full:

```bash
yarn et update core            # only @ethlete/core
yarn et update core --to 5.0.0-next.55
yarn et update --tag latest    # leave the prerelease line
```

## 2. Run it

The working tree must be clean - the codemods rewrite files, and you need a diff you can read.
Commit or stash first, then:

```bash
yarn et update
```

In order, it writes the new ranges into every `package.json` in the repo that declares the package -
an Nx library manifest included, not only the root one - runs the install, reads the migrations out of
the freshly installed packages, runs every codemod, and writes what is left to `.ethlete/update`.

If the install or a codemod fails, the run stops and leaves `.ethlete/update/pending.json` behind.
Fix the cause, then continue - do not start over, or the migrations of the versions already installed
are skipped:

```bash
yarn et update --continue
```

## 3. Work the task list

Two files describe what is left. Read the JSON one when you work through the list yourself:

| File                              | What it holds                                                         |
| --------------------------------- | --------------------------------------------------------------------- |
| `.ethlete/update/tasks.md`        | The report for a human: what moved, what applied, what is left        |
| `.ethlete/update/tasks.json`      | The same tasks as data: `kind`, `instructionsFile`, `docsUrl`         |
| `.ethlete/update/<pkg>-<name>.md` | One task in full: what moved, plus the instructions the package ships |

Every task carries a `kind`, and the kind decides who acts:

- **`assisted`** - written for you. The task file states one change to apply across this repo. Read the
  whole file before the first edit, then apply it. These are the changes no codemod can make, so expect
  a decision per call site rather than one pattern.
- **`manual`** - a recommendation for the developer. It needs a product or design decision, or a
  command with answers only they have. Do not guess the answer. Report the task and what it needs.
- **`unsupported`** - a codemod that could not run here, because this repo has no Nx. The task carries
  the exact command. Ask before running it: it rewrites files.

## 4. Finish

1. Run the type check and `{%lintCommand%}` for every project you changed.
2. Run the tests that cover what you touched.
3. Delete the task files you finished under `.ethlete/update`, and leave the ones you could not decide.
4. Tell the user, per task: what you changed, and what still needs their decision.

## Rules

- **Never invent a migration.** Only the tasks in `.ethlete/update` and the guides they link are real.
  A rewrite you reasoned out from a version number is a guess.
- **Never edit the generated report to make it look done.** Deleting a finished task file is right;
  deleting an entry you did not work is not.
- **One task at a time.** Each has its own diff, so a failure stays readable.
- The version notes and every guide a task links live at {%docsBaseUrl%}.
