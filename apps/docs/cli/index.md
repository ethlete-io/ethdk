# @ethlete/cli

Repo tooling. The package installs a single binary, `et`, with seven commands: `et release` turns pending changesets into a tagged, pushed release commit, [`et api`](/cli/api) runs the backend an app talks to from a checkout on your own machine, [`et auth`](/cli/auth) writes the git host token a private dependency needs, [`et update`](/cli/update) moves the `@ethlete/*` packages to a newer version and runs the migrations they ship, [`et migrations`](/cli/update#migration-levels) runs the optional ones when the app is ready, [`et doctor`](/cli/config#et-doctor) checks that machine's setup, and `et design` serves the design system of a checkout to Ethlete Studio.

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

- [`et api`](/cli/api) - start, stop and inspect the containers of a local backend, move its checkout to the right branch, and load seed data into it.
- [`et auth`](/cli/auth) - write a GitLab token into composer's `auth.json`, after checking that it can fetch code.
- [`et update`](/cli/update) - move the `@ethlete/*` packages to a newer version, run the codemods those versions ship, and report what needs a decision.
- [`et migrations`](/cli/update#migration-levels) - list the recommended and optional migrations the app has not run, and run one of them.
- [`et doctor`](/cli/config#et-doctor) - report every problem with this machine's config and API checkouts at once.
- `et design [checkout]` - serve the design system in the `.ethlete/design` folder of a checkout to Ethlete Studio (the current repo by default, or a path, or `--checkout <path>`). `et design check` checks the system and names each problem. Studio's tiles are pictures the server draws in headless Chromium, so they need `playwright` or `playwright-core` (with its Chromium) in the checkout or next to the cli; without it a tile stays blank.

Running `et` with no command, `--help` or an unknown command prints the command list.

## Design product configuration

In `.ethlete/design/config.json`, a product can hide parts inherited from its base:

```json
{
  "products": {
    "studio": {
      "base": ".ethlete/design/sdk",
      "hideBaseParts": ["foundations/tokens"],
      "tokens": ["foundations/colors", "foundations/type", "foundations/spacing"]
    }
  }
}
```

`hideBaseParts` defaults to an empty list. It hides inherited parts from the resolved system;
a product's own part with the same key remains available. `tokens` lists the parts whose CSS
every frame loads, in order; omitted, it defaults to `["foundations/tokens"]`.

`et design check` warns with `TOKEN-SELECTOR` when a listed token stylesheet contains a selector
outside `:root`, `html`, `body` or an SDK `.et-*` scope. Keep preview layout styles in the drawing
instead of the globally loaded token CSS.

Token validation follows relative, `@shared/` and `@system/` imports through helpers and CSS
imports. A variant's `shared/` overrides take precedence; unused sketch-shared files do not supply
token definitions. Pixel comparisons for sketches use fresh rendering results on each request,
so an earlier failed or matching screenshot does not determine a later comparison.

`et design part remove <layer>/<name> --product <product> --by <model>` refuses removal while
application source imports files under that part, and reports each importing file and line.
Remove or update those imports first.

`et design sketch check` and `sketch ready` also verify that the merger can write the target's
note and authors. A variant that delegates to a shared factory keeps a `definePart` object with
a literal `note` in its own target file:

```ts
export default definePart({
  ...sharedPart(options),
  note: 'Describe this part.',
});
```

`et design complete <layer>/<name> [--product <product>]` exits 1 while the part is not complete
for implementation. A part declares its controls in `definePart({ controls })` and marks each
one in its markup with `data-et-control="<id>"`, and each surface with
`data-et-surface="<id>.<surface>"`:

```ts
export default definePart({
  note: 'Describe this part.',
  states: { rest: {}, hovered: {}, focused: {}, open: {} },
  controls: {
    unchanged: { kind: 'disclosure', input: ['pointer', 'keyboard'], surfaces: { body: 'open' } },
  },
  render: () => drawing({ body: html`…` }),
});
```

`pointer` input needs a state that forces `hover` on the control, and `keyboard` input one that
forces `focus-visible`, for example with `forceInteraction`. The forced frame must draw different
pixels in the control's box than the same frame at rest. A `disclosure` also needs a state that
draws it collapsed, and the state `surfaces.body` names must draw its body visible and not empty.
A CSS `:hover` rule, a `title` or a state name alone does not count. The part must also match the
hash `merged.json` records for it, so a frame drawn after the last merge or accept does not count.
Only the `disclosure` kind is checked so far. A part that declares no `controls` fails with
`CONTROLS-MISSING`. The other codes are `REQUIREMENT-MISSING`, `CONTROL-UNDRAWN`,
`CONTROL-UNKNOWN`, `CONTROL-KIND` and `PART-UNREVIEWED`. `sketch ready` and `check` do not run
it, so a partial round stays reviewable.
