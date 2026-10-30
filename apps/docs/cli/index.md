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

`generated` lists stylesheets a command generates from one part, for example SDK theme classes generated
from a colours part:

```json
{
  "generated": [
    {
      "part": "foundations/colors",
      "command": ["node", "tools/scripts/generate-studio-themes.mjs"],
      "stylesheets": ["apps/ethlete-studio/src/styles/themes.css"]
    }
  ]
}
```

A frame of a sketch variant that changes the part runs the command from the checkout root with
`--part <the variant's part stylesheet> --out <folder>`, and loads each listed stylesheet from
`<folder>/<its checkout path>` where the product stylesheet imports it. The command writes nothing
else. A merged frame loads the checked-in files.

The Studio's `generate-studio-themes.mjs` makes a colour theme of every token `--x` in the colours part
that has `--x-hover`, `--x-active`, `--x-disabled`, `--x-text`, `--on-x` and `--on-x-disabled`. To add
a theme, add that block to the part; `accent` becomes the default theme `brand`, and `danger`, `warning`
and `success` get their semantic type.

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
`requestAnimationFrame`, `setInterval` or `setTimeout`. `et design list` shows the motions without `play`.

In a frame, a rule switches the part by a morph: the tool draws the new state and changes only what differs in the existing DOM,
so CSS transitions and `@starting-style` run. The named motion then runs `play(ctx)`, inside a View Transition with
`viewTransition: true`. `ctx.at(ms, fn)` runs on the tool's clock, `ctx.random()` is seeded and `ctx.rect(selector)` measures in
the `from` state.

`et design motion shots <layer>/<name> <motion>` draws a motion from its `from` state at 0, 25, 50, 75 and 100 % of its run and
at its `at` times, in full and in reduced motion (`--mode full|reduced` picks one), into one contact sheet with a row per mode. It
pauses every animation and steps the `ctx.at` clock, so each keyframe is the same in every run. Next to the sheet it writes a JSON
file with the end of each mode, its keyframe times and one track per animation: element, kind, properties, start, delay,
duration, iterations and easing. It takes `--variant <key>` of the part's open sketch, `--preset` or `--width`, `--scale`,
`--surface`, `--color` and `--out`. A track's element is `[data-et-key="..."]` where the element sets one, otherwise its selector. Each
shot is cut to the union of the part and the animated elements over all keyframes, so an overshoot is not clipped and the frames line
up. Limits: an animation or step that starts after 30 s is not drawn, and an infinite animation does not count towards `end`. The
timeline in Studio comes in a later release.

`interrupt: <ms>` switches the part back to its `from` state at that time, so the shots and tracks show the whole run, also how a
spring hands over. The reverse runs the part's motion from `to` to `from` when it declares one (its `ctx.at` counts from the
interrupt, and it never uses a View Transition); without one, only the CSS transitions run back. A forward `ctx.at` step after the
interrupt is dropped, an animation the switch cancels ends there, and the interrupt time is one of the keyframes. The JSON names
`interrupt`.

`spring({ damping, frequency })` from `@design-system` samples a spring into an easing token for `foundations`: `damping` is the
damping ratio (below 1 it overshoots), `frequency` the undamped frequency in Hz. It returns `easing`, a `linear(...)` function,
and `duration`, the ms until it settles (10 s at most); as a string it reads `<duration>ms <easing>`, so
`` `--motion-capsule: ${spring({ damping: 0.6, frequency: 2 })};` `` gives a token for `transition: width var(--motion-capsule)`.

`tokenSheet({ title, css, sample, sampleOf, sampleClass, only, pixels, styles, setup })` from `@design-system` draws a
`foundations` part as one sheet, the same in every product: a `sample` panel, then a row per custom property declared in `css`
(the part's own `./<name>.css?inline`), kept by `only`, with the value the drawing resolves and `sampleOf(name)` next to it.
`pixels` adds the px size of a rem value. `styles` and `setup` are the part's own, added after the sheet's. The sheet uses the
product's `--space-*`, `--text-*`, `--surface*` and `--font-*` tokens, so no part types a value by hand.

```ts
import { definePart, tokenSheet } from '@design-system';
import tokens from './spacing.css?inline';

export default definePart({
  note: 'The spacing scale.',
  states: { scale: {} },
  render: () =>
    tokenSheet({
      title: 'Spacing',
      css: tokens,
      sample: '',
      sampleOf: (name) => `<span style="width: var(--${name})"></span>`,
      pixels: true,
    }),
});
```

A flow line (`<product>/flows/<name>.json`) animates when it has `"transition": "view"`. `et design motion flow <flow> <line>`
draws the `from` page, then morphs it to the `to` page inside a same-document View Transition, stepped and shot like a motion, in
the whole viewport of `--preset` (the product's first preset by default). The `to` page's styles, with its
`::view-transition-*` rules, arrive with its markup, so the `from` page is captured unchanged; the `from` page's styles stay
loaded. Name the line by its `id` when it has one, otherwise as `<part>#<state>→<part>#<state>` (`->` works too), for example
`{ "from": { "part": "pages/list", "state": "rest" }, "to": { "part": "pages/detail", "state": "rest" }, "id": "open", "transition": "view" }`.
It takes `--mode`, `--scale`, `--surface`, `--color`, `--product` and `--out`; the JSON names the line, its label and both ends.

`et design mcp` serves the design tools to an MCP client over stdio, in the working directory of the session: `parts`,
`check`, `shot`, `motion_shots`, `sketch_new`, `sketch_report`, `sketch_ready`, `sketch_merge`, `sketch_discard`, `inbox` and
`inbox_done`. Each runs the `et design` command of the same name and takes its flags as arguments; `product` may be left out
when the workspace has one product, and every write takes `by`. `shot` returns the contact sheet image, drawn the same way as
the Studio screenshots; `motion_shots` returns the sheet image and the JSON of its tracks. Part files are written with the
agent's own file tools. Register it in `.mcp.json` as `{ "command": "npx", "args": ["et", "design", "mcp"] }`.

The design server answers the same draw for Studio: `GET /__design/motion?product=&part=&motion=` takes `sketch` and
`variant`, `mode` (`full` by default), `preset` or `width`, `scale`, `surface` and `color`, and answers JSON with `from`,
`to`, `mode`, `preset`, `width`, `end`, `tracks` and `keyframes: [{ ms, src }]`. Each `src` is the same URL with `frame=<ms>`
and answers that keyframe as a PNG. The draw is kept until a change redraws the part.

`et design check` fails with `INLINE-SVG` when a part outside `foundations/`, or a TS file below its
folder, writes an `<svg>` inline. Put the icon in `assets/` and draw it with a helper that a
foundations part exports. An `<svg>` that the code computes, for example the edges of a flow
diagram, passes with a `data-et-drawing` attribute.

`et design check` warns with `STALE-REPLACE` when a `.replace` or `.replaceAll` pattern with a `<` matches no markup of
the part or the parts it uses. A replace on markup a package draws, such as `button(options).replace(...)` with `button`
from `@ethlete/components`, is not checked: the rule cannot read that markup.

`et design check` fails with `CANONICAL-CLASS` when a Tailwind class in a part, in a TS file below
its folder, or in a file of a `shared/` folder that it imports, has a canonical form under the product's stylesheets, as Tailwind IntelliSense reports it:
with a 10px rem base, write `w-2xl` instead of `w-[420px]`.

`et design check` fails with `UTILITY-CSS` when the CSS of a part outside `foundations/` holds a
declaration that a Tailwind utility of the product draws: a layout keyword such as `display: flex`, or
the value of a token that a `@theme` block registers. Put the utility in the markup. A rule whose
selectors all end on an SDK `.et-*` element passes. A file of a `shared/` folder is checked when such a part imports it.
A product whose stylesheets import no `tailwindcss` is not checked. `sketch check` and `sketch ready` run both rules
on each variant, the sketch's `shared/` folder included.

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
the rest moves into the target's folder as before - with several targets, into each target that imports it.

A sketch changes its targets' layers and the layers below them. A variant may also hold a host of a target from a higher
layer (a page that imports the component) when the edit only changes its imports and how it spells the imported names,
such as `commentPinStyles` to `commentPin.styles`; the merge writes it with the targets.

A sketch of a part the product takes from its base (`et design sketch new components/button --product studio`)
merges into the base: the part folder in the base, and the base's `merged.json`. `sketch new … --override` opens it as a
product override instead, and the merge writes a product copy. When the product overrides the part already, `sketch new`
refuses without one of two flags: `--override` sketches the product copy, and `--into-base` starts from the copy, merges
into the base and removes the copy with its `merged.json` entry. A part of a built-in base takes `--override` only.

`sketch ready` refuses while a target of a live variant does not load.

A sketch goes to `ready` only when no change to it waits on anything. `et design sketch hold components/button --until
"the radius token lands" --by <model id>` records the wait in `sketch.json`: a `ready` sketch goes back to in progress
and leaves the merge queue, and `sketch ready` refuses with the `--until` text. Make the change, then
`et design sketch release components/button --by <model id>` removes the hold. `sketch list` and `sketch check` show it.

`sketch ready` also refuses (rule `UNUSED`) while the files of a live variant, with the `shared/` files they import, keep
an import nothing uses, a parameter a named function never reads, a parameter of a `shared/` function no call passes, or a
class no drawing uses (`et-` classes of the SDK are not checked): code of another candidate must not reach a merge. Keep
rendering for one candidate in that variant's files and only common code in `shared/`.

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
stays ready, and the output names each changed part and state. A state that looks changed is drawn once more on both sides first, so one odd picture under load does not stop the merge. A frame that never draws fails the drawing with its URL instead of giving a blank picture.
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
needs a state in each of those columns, so the open row is drawn hovered too. In any grid, a row that draws a state in one
column and none in another leaves an empty cell: the shot sheet draws it as "not drawn", and `sketch check` prints it
on the grid line (`draws no selected active`). Flat states such as
`hovered` and `pressed` fail with `CONTROL-GRID-MISSING`. Each forced state must force the
interaction on the control, for example with `forceInteraction`, and draw different pixels in
the control's box than the same frame at rest. When a descendant of the control draws an interaction or carries
its disabled mark, such as a frame its `:hover` rule styles or a trigger with `aria-disabled`, mark that descendant
with `data-et-control-part`: the check forces each interaction on the control and on every control part in it, and
counts `disabled` or `aria-disabled="true"` on any of them. A `disclosure` also needs a state that
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

Each `kind` adds its own requirements:

| Kind             | Needs besides the interactions of its `input`                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disclosure`     | a state that draws it collapsed, and the visible body `surfaces.body` names                                                                                         |
| `button`         | `active`                                                                                                                                                            |
| `select`, `menu` | the visible surface `surfaces.open` names, with an option in it (`role="option"`, `role="menuitem"` or `data-et-option`) drawn hovered, focus-visible, and selected |
| `row`            | a state that draws it selected, and one that forces hover on it while selected                                                                                      |
| `tooltip`        | the visible tooltip `surfaces.tooltip` names, drawn next to the control in this part                                                                                |

Selected means `aria-selected`, `aria-checked` or `aria-pressed` set to `true`, or an
`aria-current`. A selected row or option must look different from an unselected one: its
computed colours, opacity, shadow or font weight, or those of an element in it, must differ.
An option that never takes focus, such as one a listbox names with `aria-activedescendant` on its
control, proves focus-visible without a forced interaction: in a shown surface, the option whose
`id` an `aria-activedescendant` names must look different, by the same computed look, from a plain
option in that surface that is not selected, named or forced.
`disabled: true` on a control also needs a state that draws it `disabled` or
`aria-disabled="true"` with a look of its own; without it, no disabled state is required.

With `part`, the interactions, the selected and disabled looks and the option states come from
that part; the surfaces stay with the host. A page that uses a select draws its open surface once
in its own placement, and a closed select never counts as open:

```ts
controls: {
  preset: { kind: 'select', part: 'components/select', surfaces: { open: 'preset-open' } },
},
```

Options inside a surface belong to the surface's control, so they need no marker of their own.
A part inherited from the product's base is checked against the `merged.json` of the base.

The check also discovers controls in each state's rendered DOM, so leaving out a declaration does
not pass. A native control (`button`, `a[href]`, `input`, `select`, `textarea`, `summary`,
`[tabindex]`), an interactive ARIA role or a known SDK control (`et-select`, `[et-button]`, ...)
without a `data-et-control` fails as `CONTROL-UNDECLARED`. A marker on a wrapper that is not a
control itself declares the controls inside it. An element with `cursor: pointer` or a matching
`:hover` rule outside any control fails as `CONTROL-UNCLASSIFIED`. Controls inside a control that
names a `part` belong to that part, and a page embedded with `embedPage` is not walked. A part
without controls passes when it draws none.

`embedPage(page, { state, width, height, scale, mark, css })` from `@design-system` draws another page
of the product in a frame of its own. The embedding page's styles never reach into that frame, so
`mark` and `css` apply inside it: every element matching the `mark` selector gets
`data-et-embed-marked` and an accent outline, and `css` is added as a stylesheet, for example to show
the new look of a part next to the old one.
`et design check` warns with `EMBED-SCALE` when an element around a frame with a `scale` scales it
again (`transform`, `scale` or `zoom`), so the page shrinks twice: set the scale in one place.

A part that another part renders owns its controls. Every rendered part root carries
`data-et-part="<layer>/<name>"`, stamped automatically, and markup a host passes in through props
carries `data-et-slot` and stays the host's. A control inside an embedded part is not declared on
the host; the host fails once per owning part that is not design complete itself, as
`CONTROL-PART-INCOMPLETE`. A rule in a CSS file of the host's folder that styles an element inside
an owned part fails as `CONTROL-OVERRIDDEN`, unless the host marks it with `data-et-control` and
declares it. On the owned root itself, outer layout (margin, size, position, inset, flex and grid
placement, transform) is not an override.

A page also fails as `INVENTORY-UNAPPROVED` until the user approves its control inventory in
Studio: each rest frame with a numbered box over every control it draws. The approval stores the
page's control ids and part hash in `.ethlete/design/<product>/inventory.json`; an added or removed
control id or any edit of the page reopens it. A page with an undeclared or unclassified control
cannot be approved, and no CLI command approves one. The design server answers
`GET /__design/inventory?product=&part=` and `POST /__design/inventory-approve?product=` with
`{ part, hash, by }`.

`et design complete <layer>/<name> --variant <key>` runs the same check on a variant of the part's
open sketch, so a sketch can show it closes its gaps before it is merged. Every part is drawn as the
variant draws it; a part the variant changes is not merged yet, so it never fails as
`PART-UNREVIEWED`. An exception or inventory approval holds the merged part's hash, so it reads as
reopened on a variant that changes that part.

`et design complete --request <layer>/<name>.<control>.<requirement> --reason <text>` asks for an
exception to one requirement, for example `components/zoom-chip.fit.active`. It writes a pending
entry to `.ethlete/design/<product>/exceptions.json`, and a pending entry still fails. Only the
approve button in Studio (`POST /__design/exception-approve?product=` with `{ key, by }`) records
`by`, `at` and the part hash; then the gap it names passes. Any later edit of the part reopens it.
`GET /__design/exceptions?product=` lists every exception with its state, and `design complete`
prints one `EXCEPTION` line for each exception of the checked parts.

`et design complete <layer>/<name> --handoff` gives a part the `handoff` status when it passes, and
writes it to `.ethlete/design/<product>/handoff.json`; a failing part gets nothing. App work builds
only `handoff` parts. `et design complete --handoff [--product <product>]` re-checks every `handoff`
part, prints `HANDOFF <part> complete` or `HANDOFF <part> regressed` with its gaps, and exits 1 when
one regressed. CI runs it for the `studio` product in the Build job.

The other codes are `REQUIREMENT-MISSING`, `CONTROL-GRID-MISSING`, `CONTROL-UNDRAWN`,
`CONTROL-TRANSITION-MISSING`, `CONTROL-UNKNOWN`, `CONTROL-KIND`, `CONTROL-PART-MISSING`, `CONTROL-PART-INCOMPLETE`, `CONTROL-OVERRIDDEN` and
`PART-UNREVIEWED`. `sketch ready` and `check` do not run
it, so a partial round stays reviewable.
