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
- `et design [checkout]` - serve the design system in the `.ethlete/design` folder of a checkout to Ethlete Studio (the current repo by default, or a path, or `--checkout <path>`). `et design check` checks the system and names each problem. Studio's tiles are pictures the server draws in headless Chromium, so they need `playwright` or `playwright-core` (with its Chromium) in the checkout or next to the cli; without it a tile stays blank. An edit redraws only the parts it reaches: a file that a product stylesheet only scans as a Tailwind `@source` redraws its own parts and their importers, while an edit of the stylesheet or a file it `@import`s redraws every part.

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

`et design check` fails with `HARD-CODED-MOTION` when a `transition` or `animation` declaration
outside `foundations/` holds a literal duration, delay or easing, for example `120ms` or `ease`.
Take them from a foundations token instead: `transition: opacity var(--duration-appear) var(--ease-standard)`.

A part declares `motions` next to its `states`: `motions: { fold: { from: 'closed', to: 'open' } }`, each between two of its
states, with optional `at` (shot times in ms), `interrupt`, `viewTransition` and `play(ctx)`. A rule in `rules` names its motion:
`{ on: 'click .open', to: 'open', motion: 'fold' }`. `et design check` fails with `MOTION-STATE` when `from` or `to` is no state of
the part, with `MOTION-NAME` when a rule names a motion the part does not declare, and with `MOTION` when motion code calls
`requestAnimationFrame`, `setInterval` or `setTimeout`. `et design list` shows the motions without `play`. Playing them, with
shots and a timeline, comes in a later release.

`et design check` fails with `INLINE-SVG` when a part outside `foundations/`, or a TS file below its
folder, writes an `<svg>` inline. Put the icon in `assets/` and draw it with a helper that a
foundations part exports. An `<svg>` that the code computes, for example the edges of a flow
diagram, passes with a `data-et-drawing` attribute.

`et design check` fails with `CONTRAST` when a text in a drawn state is below WCAG 2 AA against its
drawn background, with semi-transparent layers composited: 4.5:1, or 3:1 for large text (24px, or
18.66px bold). Text inside a disabled control, or in the label of one, is exempt: a `<label for>` or wrapping label, or an `aria-labelledby` target. A part lists token pairs to compute in
`contrast: { pairs: [{ text: ['--text'], on: ['--surface'] }] }`, and exempts text with
`contrast: { exceptions: [{ selector: '.watermark', reason: 'decorative' }] }`.

A product's `shared/` folder (`.ethlete/design/<product>/shared/`) holds helper modules that are
no part, such as a layout several parts draw with. Any part imports them as `@shared/<path>`;
they never appear in Studio's tree or `et design list`. Inside a sketch, `@shared/<path>` looks
in the variant's `shared/`, then the sketch's, then the product's, then the base's. A part's
`merged.json` hash covers the shared files it reaches, so editing one marks each importer changed.
At a merge, a sketch `shared/` file with the path of a product shared file replaces that file;
the rest moves into the target's folder as before.

`et design sketch merge <layer>/<name> --variant <key> --allowed-by <plan ref> --by <model>` merges a
sketch the user has not picked in, only when `<key>` is its one live (not rejected) variant; both flags
go together, and `accepted.json` logs the plan; the part note stays. With two live variants the user picks in Studio.

`et design sketch merge` and `sketch discard` resolve the addressed comments on the sketch's
variants, and a merge also those addressed comments of the merged parts that have no sketch; open
comments stay open. `et design comment resolve-ended [--product <product>]` resolves the addressed
comments whose sketch no longer exists.

Token validation follows relative, `@shared/` and `@system/` imports through helpers and CSS
imports. A variant's `shared/` overrides take precedence; unused sketch-shared files do not supply
token definitions. Pixel comparisons for sketches use fresh rendering results on each request,
so an earlier failed or matching screenshot does not determine a later comparison.
A screenshot of a state shows the end of every finite CSS animation and transition, so an
element that fades in with `@starting-style` is drawn fully visible. An infinite animation keeps
running.

A pixel comparison gives one box per cluster of changed pixels: changes closer than 16 pixels
merge, and at most eight boxes remain. `et design shot <part> --variants --crop changed` writes one
contact sheet per cluster (`<out>-area-1.png`, `<out>-area-2.png`, …; a single cluster keeps
`<out>`), and Studio's changed area stacks one enlarged crop per cluster below the whole page.

`et design part remove <layer>/<name> --product <product> --by <model>` refuses removal while
application source imports files under that part, and reports each importing file and line.
Remove or update those imports first.

`sketch ready` merges a sketch on its own only when no state of the target changes a pixel and
no state of a part that `sketch preview` lists under `shows` changes either. Otherwise the sketch
stays ready, and the output names each changed part and state.
Every variant must draw the same; one changed variant is enough to stop it. A variant draws its
own part stylesheets, also where the product stylesheet `@import`s the merged file.

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
const { states, grid } = interactionRows(
  { rest: { open: false }, open: { open: true } },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'Describe this part.',
  states,
  grid,
  controls: {
    unchanged: { kind: 'disclosure', input: ['pointer', 'keyboard'], surfaces: { body: 'open' } },
  },
  render: ({ open, interaction }) => drawing({ body: html`…` }),
});
```

`pointer` input needs `hover` and `active`, and `keyboard` input needs `focus-visible`. The part
draws them with `interactionRows`: its `grid` needs a column for each of them, and every row
needs a state in each of those columns, so the open row is drawn hovered too. Flat states such as
`hovered` and `pressed` fail with `CONTROL-GRID-MISSING`. Each forced state must force the
interaction on the control, for example with `forceInteraction`, and draw different pixels in
the control's box than the same frame at rest. A `disclosure` also needs a state that
draws it collapsed, and the state `surfaces.body` names must draw its body visible and not empty.
A forced interaction that changes the background, text, border or shadow colour of the control
or an element in it must fade: a property with a computed `transition-duration` of 0 fails with
`CONTROL-TRANSITION-MISSING`. A colour that the element inherits or takes from `currentColor`
fades with its source. A CSS `:hover` rule, a `title` or a state name alone does not count. The part must also match the
hash `merged.json` records for it, so a frame drawn after the last merge or accept does not count.

A page does not draw the interactions of its controls. A page control names the component or
element that draws it in `part`, instead of `input`, and that part must be design complete
itself. The page still draws the collapsed state and the body in its own placement:

```ts
controls: {
  unchanged: { kind: 'disclosure', part: 'components/disclosure', surfaces: { body: 'unchanged-open' } },
},
```

Only the `disclosure` kind is checked so far. A part that declares no `controls` fails with
`CONTROLS-MISSING`. The other codes are `REQUIREMENT-MISSING`, `CONTROL-GRID-MISSING`, `CONTROL-UNDRAWN`,
`CONTROL-TRANSITION-MISSING`, `CONTROL-UNKNOWN`, `CONTROL-KIND`, `CONTROL-PART-MISSING`, `CONTROL-PART-INCOMPLETE` and
`PART-UNREVIEWED`. `sketch ready` and `check` do not run
it, so a partial round stays reviewable.
