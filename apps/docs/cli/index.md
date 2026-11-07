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

A running `et design` watches the cli it was started from. Once a rebuild or reinstall of the cli has finished writing, the server restarts itself from the new build on the same port, in the same process, so Studio keeps it and no shot is drawn with old code.

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
every frame loads, in order; omitted, it comes from the base, and without a base value it defaults
to `["foundations/tokens"]`.

`generatedFiles` lists files of the product folder that a generator writes, for example
`["foundations/colors/colors.css"]`. The part hash skips them, so regenerating one does not make
`design check` warn that the part changed outside a sketch. An edit to any other file of the part still does.

`schemes` lists the colour schemes the product draws, `"light"`, `"dark"` or both. Studio draws a copy of
every frame per scheme, so a product whose CSS has no light scheme declares `["dark"]` and gets one copy.
Omitted, it comes from the base, and without a base value it defaults to both.

`base` can also point into `node_modules`, at a design product an installed package ships:

```json
{
  "products": {
    "app": { "base": "node_modules/@ethlete/components/design/sdk" }
  }
}
```

The base folder needs a `config.json` above it that declares the product under the folder's name. Its
parts' `@system/*` imports resolve to the parts of the product that draws them. `et design` writes no
`tsconfig.json` into a base outside the checkout or inside `node_modules`; the typecheck config it
generates in `node_modules/.design-explore` covers the base parts.

`render.packages` maps a package pattern to the checkout folder `ng()` and the drawings load it from.
Left out, it defaults to `{ "@ethlete/*": "node_modules/@ethlete/*" }` in a checkout without `dist/libs`,
so a consumer repo only sets `base`. A checkout that builds its own packages maps them, for example
`{ "@ethlete/*": "dist/libs/*" }`.

Run anywhere inside a repo checkout that has `libs/cli`, `et design` refuses with exit 1 and prints the rebuild command (`NX_NO_CLOUD=true npx nx build cli`) when the `libs/cli` sources differ from what the running build was made from. The check compares a hash of `src`, `design` and `playwright` with the one `nx build cli` records in `build-info.json`. A checkout without `libs/cli` sources, as with an installed package, skips it.

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

`et design check` fails with `SDK-ATTRIBUTE-VALUE` when a part's stylesheet selects an SDK component class with an
input value the component does not declare, such as `.et-window-control-button[data-shape='caption']` while the
button takes only `square` and `round`: the app cannot draw that look without an SDK change. The rule reads the
declaration file of the built `@ethlete/components` the drawings render from.

`et design check` fails with `SDK-PRIVATE-VAR` when a part's stylesheet sets a private `--_et-*` variable of an SDK
component, such as `--_et-window-control-button-icon-size`: the app cannot rely on it without an SDK change. The `sdk`
product mirrors the SDK and is exempt.

`et design check` fails with `HARD-CODED-MOTION` when a `transition` or `animation` declaration
outside `foundations/` holds a literal duration, delay or easing, for example `120ms` or `ease`.
Take them from a foundations token instead: `transition: opacity var(--duration-appear) var(--ease-standard)`.

A part declares `motions` next to its `states`: `motions: { fold: { from: 'closed', to: 'open' } }`, each between two of its
states, with optional `at` (shot times in ms), `interrupt`, `viewTransition` and `play(ctx)`. A rule in `rules` names its motion:
`{ on: 'click .open', to: 'open', motion: 'fold' }`. `et design check` fails with `MOTION-STATE` when `from` or `to` is no state of
the part, with `MOTION-NAME` when a rule names a motion the part does not declare, and with `MOTION` when motion code calls
`requestAnimationFrame`, `setInterval` or `setTimeout`. `et design list` shows the motions without `play`.
A motion with `from` equal to `to` is the looping motion inside that state. `unreachable: [{ from: 'empty', to: 'default', reason: '…' }]`
marks a pair no user reaches; `et design check` fails with `MOTION-UNREACHABLE-STATE`, `MOTION-UNREACHABLE-REASON` or
`MOTION-UNREACHABLE-LITERAL` for an unknown state, an empty reason or a value that is no literal, and with `MOTION-UNREACHABLE-REACHABLE` when a pair marked unreachable also has a motion.
A part whose states all switch without motion declares `instant: 'reason'` instead of listing every pair: it covers every pair of different states (a loop in an ongoing-work state is still asked for), `et design check` fails with `MOTION-INSTANT` when the value is no non-empty string literal, and `design sketch ready` prints `NOTE <sketch> <variant>: <part> declares instant state switches` for each variant that declares it. Keep `unreachable` for pairs no user reaches.

In a frame, a rule switches the part by a morph: the tool draws the new state and changes only what differs in the existing DOM,
so CSS transitions and `@starting-style` run. The named motion then runs `play(ctx)`, inside a View Transition with
`viewTransition: true`. `ctx.at(ms, fn)` runs on the tool's clock, `ctx.random()` is seeded and `ctx.rect(selector)` measures in
the `from` state.

`et design motion shots <layer>/<name> <motion>` draws a motion from its `from` state at 0, 25, 50, 75 and 100 % of its run and
at its `at` times, in full and in reduced motion (`--mode full|reduced` picks one), into one contact sheet with a row per mode. It
pauses every animation and steps the `ctx.at` clock, so each keyframe is the same in every run. Next to the sheet it writes a JSON
file with the end of each mode, its keyframe times and one track per animation: element, kind, properties, start, delay,
duration, iterations and easing. It takes `--variant <key>` of the part's open sketch, `--preset` or `--width`, `--scale`,
`--surface`, `--color`, `--scheme` and `--out`. A track's element is `[data-et-key="..."]` where the element sets one, otherwise its selector. Each
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

`tokenSheet({ title, note, scope, css, sample, sampleOf, sampleClass, only, pixels, styles, setup })` from `@design-system` draws a
`foundations` part as one sheet, the same in every product: a `sample` panel, then a row per custom property declared in `css`
(the part's own `./<name>.css?inline`), kept by `only`, with the value the drawing resolves and `sampleOf(name)` next to it.
`pixels` adds the px size of a rem value. `styles` and `setup` are the part's own, added after the sheet's. The sheet uses the
product's `--space-*`, `--text-*`, `--surface*` and `--font-*` tokens, so no part types a value by hand.
`note` is text or markup drawn under the title. `scope` is a class list put on the sheet's root, which is also where values
are read, so tokens scoped to a theme class resolve: `scope: 'et-surface--dark et-color--brand'`.

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

`iconSheet({ view, title, note, icons, sizes, size, columns })` draws a `foundations/icons` part the same way. `icons` lists
`{ name, svg, grid?, padding? }`, `svg` being the raw asset. `view: 'catalogue'` shows every icon at each of `sizes` with its
name; `view: 'construction'` shows each icon `size` px large on its grid, with the grid lines, the centre lines and the padding
box (`padding` grid units, `grid / 8` by default). An icon's grid is `grid`, else the larger side of its viewBox; icons on
different grids are drawn in one group per grid.

```ts
iconSheet({
  view,
  title: 'Icons',
  icons: [
    { name: 'check', svg: check },
    { name: 'times', svg: times, grid: 512 },
  ],
});
```

`logoSheet({ marks })` draws a `foundations/logo` part. Each mark `{ title, svg, sizes, onLight? }` gets a row under its
`title`: the raw `svg` asset at each of `sizes` in px, and, when `onLight` lists sizes, the mark at those sizes on a light bar.

```ts
logoSheet({
  marks: [
    { title: 'Mark at app-icon sizes', svg: mark, sizes: [16, 32, 512], onLight: [16, 32] },
    { title: 'Line mark in the rail', svg: markLine, sizes: [16, 24, 32] },
  ],
});
```

A flow line (`<product>/flows/<name>.json`) animates when it has `"transition": "view"`. `et design motion flow <flow> <line>`
draws the `from` page, then morphs it to the `to` page inside a same-document View Transition, stepped and shot like a motion, in
the whole viewport of `--preset` (the product's first preset by default). The `to` page's styles, with its
`::view-transition-*` rules, arrive with its markup, so the `from` page is captured unchanged; the `from` page's styles stay
loaded. Name the line by its `id` when it has one, otherwise as `<part>#<state>→<part>#<state>` (`->` works too), for example
`{ "from": { "part": "pages/list", "state": "rest" }, "to": { "part": "pages/detail", "state": "rest" }, "id": "open", "transition": "view" }`.
It takes `--mode`, `--scale`, `--surface`, `--color`, `--scheme`, `--product` and `--out`; the JSON names the line, its label and both ends.

`et design mcp` serves the design tools to an MCP client over stdio, in the working directory of the session: `parts`,
`call`, `check`, `shot`, `motion_shots`, `sketch_new`, `sketch_report`, `sketch_ready`, `sketch_merge`, `sketch_discard`, `sketch_variant`, `sketch_round`, `sketch_list`, `sketch_check`, `sketch_preview`, `sketch_rebase`, `comment_reply`, `inbox` and
`inbox_done`. Each runs the `et design` command of the same name and takes its flags as arguments; `product` may be left out
when the workspace has one product, and every write takes `by`. `shot` returns the contact sheet image, drawn the same way as
the Studio screenshots; `motion_shots` returns the sheet image and the JSON of its tracks. `call` takes a `call` and a
`variant` and returns its `call.ts`, its `fixture.ts`, the variant file to draw into and the frame URL; `check` with a `call`
(and a `variant`) lints that variant, type-checks the calls and renders the call instead of checking a product. Started with
`--receipt <path>`, the server passes it on to that check: `et design check --receipt <path>` writes the call, the variant,
`ok`, the time and the output as JSON. Part files are written with the agent's own file tools. Register it in `.mcp.json` as
`{ "command": "npx", "args": ["et", "design", "mcp"] }`.

The design server answers the same draw for Studio: `GET /__design/motion?product=&part=&motion=` takes `sketch` and
`variant`, `mode` (`full` by default), `preset` or `width`, `scale`, `surface` and `color`, and answers JSON with `from`,
`to`, `mode`, `preset`, `width`, `end`, `tracks` and `keyframes: [{ ms, src }]`. Each `src` is the same URL with `frame=<ms>`
and answers that keyframe as a PNG. The draw is kept until a change redraws the part.

`GET /__design/queue` answers the render queue as JSON: `queued` and `rendering` draws, `oldestMs` (the age of the oldest
waiting or running draw, `null` when idle), `failedTotal`, and `failed: [{ part, state, status, message, at }]` with the
last 20 shots that failed, newest first. Studio shows it in its footer.

`et design check` fails with `INLINE-SVG` when a part outside `foundations/`, or a TS file below its
folder, writes an `<svg>` inline. Put the icon in `assets/` and draw it with a helper that a
foundations part exports. An `<svg>` that the code computes, for example the edges of a flow
diagram, passes with a `data-et-drawing` attribute.

`et design check` fails with `TOP-LEVEL-AWAIT` when a module a frame loads awaits at the top level: a part, a
file it reaches, or a call variant. WebKit can hang for good when a frame is removed while such a module evaluates.
A part awaits inside its `render`; a call variant default-exports a promise of its drawing.

`et design check` fails with `INLINE-UI-IN-PAGE` when a page, a file its folder holds, or a `shared/` file it imports
writes interactive UI as markup instead of embedding an element or component part: a `<button>`, `<input>`, `<select>`
or `<textarea>`, a raw SDK tag such as `<et-switch>` or attribute such as `et-button`, or bare markup with an interactive
`role`, a `tabindex` or a `data-et-action`. A string that patches such a tag into embedded markup, like
`.replace(/<button/, '<button data-x')`, counts too. Markup that carries `data-et-part` is an embedded part's and passes.
The message names the part to create, or the SDK part to embed. The rule also runs on every sketch variant, so it blocks
`et design sketch ready` and the merge. Places that still wait for their move are listed in `OPEN_INLINE_UI`, by file,
enclosing declaration, kind and count, and warn instead; the list only shrinks: an extra hit in a listed place fails, and
so does an entry with fewer hits left than it allows.

`et design check` warns with `STALE-REPLACE` when a `.replace` or `.replaceAll` pattern with a `<` matches no markup of
the part or the parts it uses. A replace on markup a package draws, such as `button(options).replace(...)` with `button`
from `@ethlete/components`, is not checked: the rule cannot read that markup.

`et design check` fails with `CANONICAL-CLASS` when a Tailwind class in a part, in a TS file below
its folder, or in a file of a `shared/` folder that it imports, has a canonical form under the product's stylesheets, as Tailwind IntelliSense reports it:
with a 10px rem base, write `w-2xl` instead of `w-[420px]`.

`et design check` fails with `CLASS-UNDEFINED` when a class in the markup of those same files parses
as a Tailwind utility with a value but compiles to no CSS against the product's stylesheets:
`bg-surface-sunken` once the theme no longer defines `--color-surface-sunken`. Tailwind emits nothing
for such a class, so it fails silently in the browser. `et-` classes, names Tailwind does not parse,
and classes the product's stylesheets or the file itself give a rule pass. A sketch fails only on a
class it adds.

`et design check` fails with `CLASS-GLUED-INTERPOLATION`, which blocks `sketch ready` and a merge, when a class in an `html` template of a part, or of a TS file below its
folder, has no space between it and a `${...}` interpolation, as in `shadow-lg${props.class}`. Tailwind's scanner reads
both as one candidate and emits no CSS for the class. A class built by interpolation (`et-icon--${name}`, `md:${name}`) passes.

`et design check` fails with `DENIED-CLASS` when a part outside `foundations/`, a TS file below its
folder, or a `shared/` file it imports uses a class or a `var(--name)` reference that a pattern in the
product's `deniedClasses` matches. Each entry holds a regular expression and the fix the line prints:
`"deniedClasses": [{ "pattern": "^bg-surface-raised$", "fix": "use bg-et-surface-bg in a data-et-surface scope" }]`.
The rule tests a class without its variants, its `!` and its opacity, so `hover:bg-surface-raised/50`
counts as `bg-surface-raised`. It fails with `DENIED-STYLESHEET` when the product's own stylesheets,
outside `foundations/`, define what would expose a denied name: a custom property, a `--color-*` theme
value, an `@utility` or a class rule. A sketch fails only on a denied class it adds. `sketch ready`, `sketch merge` and `design accept` refuse on all three rules.

A product that sets `"nativeTitle": "deny"` in its config also fails `et design check` with `NATIVE-TITLE` on a native `title`
attribute on an HTML element in the markup strings of its design files, with the line; elements with a dash in
their name are components and pass. Off when the flag is left out.

A product that sets `"commandText": "deny"` fails `et design check` with `COMMAND-TEXT` on command text (`npx`, `nx`,
`yarn`, a `--flag`, a `NAME=value`) in the visible text of its drawings or of its harness app templates. Off when
the flag is left out.

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
The border of a control, or of a frame that hugs one, needs 3:1. The outer border of a floating panel is not
checked, because its surface step and its shadow set it apart: an SDK overlay pane (`.et-overlay`), or an element
with a shadow and an `et-surface--<name>` class unlike that of its nearest surface ancestor.

A part names the code that builds it in `implements`: a component or element names the path of its
`.component.ts` from the repository root, `implements: 'apps/app/src/app/tree-row.component.ts'`, and a page
names its route, `implements: { route: '/system' }`, and for compare the presentational component the route renders,
`implements: { route: '/inbox', component: 'apps/app/src/app/inbox/inbox.component.ts' }`. `et design check` fails
with `IMPLEMENTS-MISSING` when a path does not exist, and with `IMPLEMENTS-SHAPE` when the link is not a literal or not
the shape of its layer. It fails with `STATE-NOT-IN-COMPONENT` when a state sets a value of a phase or state union the
linked component takes as `input()` or `model()` (a type named `…Phase` or `…State`, or an inline union on an input
named `phase` or `state`) but is not named after that value: `sending: { phase: 'busy' }` must be the state `busy`
(`busy-long` is fine).

`et design check --product <name> --rules --base <rev|range>` also fails with `IMPLEMENTATION-UNCOMPARED` on each file
`git diff <base>` names that the app component of an implemented part reaches and that changed since the part's
`implemented.json` record, and names the part. CI passes the pushed range. `et design compare --affected` (or
`et design task <part> --verify <rev>`) compares and records the part again, which clears it.

`et design check` fails with `UNBOUND-INPUT` when an `input()` or `model()` of an app component that implements a part is
bound by no template of the app (a consumer binds it with `[x]`, `[(x)]` or a plain attribute), and with `SAMPLE-DEFAULT`
when such an input defaults to sample data, an `…_SAMPLE` or `…_ROWS` identifier. Known hits sit on lists in
`libs/cli/src/lib/design/system/rules/*-known.ts` and print as `(known)` warnings; a listed input that is bound or fixed
again fails until it comes off the list.

`et design check` fails with `ORPHAN-ENDPOINT` when the design server answers an endpoint that no app code calls. An
endpoint built from a bare segment, `productUrl(address, 'comment')`, counts as called only when an app file calls the
host function that builds it; an import alone does not count.

`et design check` warns with `PENDING-STATE-MISSING` on an `emit:` action of a part whose app handler reaches a host
invoke or HTTP call while the part draws no pending state (no `pending`, `busy`, `loading` or `spinner` in its sources).
The trace starts at the output's binding on the implementing component's own tag and follows method calls, re-emitted
outputs, service subjects and the branch an emitted `kind` literal picks; it stops at a handler that opens an overlay.

### Slow rules

Some rules need the app running in a browser, so they do not run with the static checks.
`et design check --product <name> --slow [--part <layer>/<name>…] [--base <rev>]` runs them on a product with a
`harness`, prints each problem as `<product> <part>: <RULE> <file>: <message>`, and exits 1 on a problem:

- `APP-SPEC` runs the specs related to each part's app files with the vitest config in `harness.specs`. A failing
  spec counts on the innermost part whose app files hold the file it tests, else on `(product)`. Without
  `harness.specs` the rule is off.
- `UNCOVERED-REGION` opens every state of the `harness.live` spec and reports each visible region no part covers, on
  the page part of that live page, else on `(product)`.
- `IMPLEMENTS-UNRENDERED` runs in the same pass: for each part the page's design embeds, it checks that the app
  renders the part's `implements` component at the spot the design draws the part. A part whose component appears at
  none of its spots on that page is reported on the page part, naming the embedded part's file.
- `VISIBLE-CHANGE` draws each harness part in the app at the base and at HEAD and fails a part that looks different
  without a picked or merged sketch in between. The base is `--base`, else the merge base of HEAD and
  `harness.baseBranch`, else of the branch `origin/HEAD` names. CI passes the pull request's base.
- `COMPARE` and `SDK-ERROR` compare a part implemented at its current design with its design, and report an SDK error
  the harness page logs.

Each part's result is stored in `node_modules/.cache/ethlete-design/<product>/slow-checks.json` with the hash of its
inputs: its design, its app files and their specs, the live spec, and the base. A part whose stored result is missing
or has other inputs is pending, so it is not build-ready yet. `et design serve` keeps the results fresh: every 15
seconds it reruns the parts whose inputs changed and then held still, one run at a time. Set
`ETHLETE_DESIGN_SLOW_CHECKS=off` to turn that off.

After the checks, `et design check` lists the open points of each product: one line per part, with the total,
for example `components/tree-row: 1 open comment (c-1); sketch ready, not merged`. A point is a
comment the user has not resolved (an addressed one too, listed as `c-2 addressed, waits on the user`), or a sketch on the part that is not merged yet. A part outside `foundations/` without `implements` is
not an open point: `et design check` lists those on one `UNLINKED <product>: <part>, ...` line. Outside `foundations/` and `pages/`, every ordered pair of a part's states needs a
motion unless it is `unreachable` or a state name contains `focus`, for example `no motion collapsed -> expanded`, and
a state whose name contains `loading`, `pending`, `busy`, `progress`, `indeterminate` or `spinner`, or whose drawing
holds `aria-busy="true"` or a loading button whatever its name, needs a looping motion: `no looping motion in loading`. The list does not change the exit code. The render step runs even when a static rule fails, so both
kinds of findings show in one run. A part that does not load or draw gets no render rule checked: one line names
it, for example `NOT CHECKED studio render rules on 1 part: components/menu - it did not draw, see RENDER above`,
and without a browser one line counts every part, `NOT CHECKED studio render rules on all 80 parts - <why>`. A
finding in a part the product takes from its base, before or in the render, does not fail the product: one line
counts them, for example `94 findings in base product sdk (UTILITY-CSS 94) - they do not block this product; run et design check --product sdk for the base's own`. A part the product
overrides is checked as its own.

The render check also asks whether each declared action can be reached in every state that draws it. `UNREACHABLE`
fails an element with `data-et-action` that the state hides (`visibility: hidden`, or `display: none` from CSS - a
`hidden` attribute is left out), fades to `opacity: 0`, draws at zero size, gives `pointer-events: none`, or buries
so that a click at every point of its unclipped box lands on another element, for example `UNREACHABLE studio
pages/sketches far-out at desktop: … - "Übernehmen" (emit:merge) is hidden (visibility: hidden) in a state that
declares it`. `COVERED` fails an action where another element takes the click at any of its sample points, opaque or
transparent (a transparent button laid over it counts), or an opaque element of another subtree paints above one; a
projected region (`slot(...)`, `data-et-projected`) fails only under an opaque element. Open overlay panes and
tooltips do not count. Neither rule is silenced by a `CLIPPED` skip; an element panned or clipped fully out of view is
not judged. A canvas whose content pans on the wheel is swept: the check pans each clipping ancestor of an action
in 32 px steps right, left, down and up to its end and judges the actions at every position, so an action that a
sticky column or a header covers only after a pan fails with the position in the finding (`… when <canvas> is
panned 384px right`).

The design server answers the same list as JSON: `GET /__design/open-points?product=` lists every part with
open points as `{ drawn: false, parts: [{ part, points }] }`, and `&part=<layer>/<name>` answers one part as
`{ part, drawn, points }`. Contrasts and missing control states need a draw, so only `&draw=true` with a `part`
lists them; it draws that part as `design check` does, which takes seconds. A bad parameter answers 400, an
unknown part 404, and a draw that cannot run 503. The one-part answer also holds the part `hash` and its `ready`
mark, or `null`.

A part is ready only when its open-point list is empty and `et design actions` passes for it.
`et design ready components/chip --product app-a --by tom [--url …]` draws the part, prints its open points and exits 1
while there are any; then it runs the action check on the harness app (`--url`, or one it starts) and exits 1 with the
failed lines. With `--url` and a live spec it also runs `et design actions --live` for the part and adds its failed
lines prefixed `live `; without `--url` the refusal notes that it checked the part harness only. Otherwise it stores the part hash, who and when in `.ethlete/design/<product>/ready.json`
(the base's file for a part the product takes from its base). Any edit of the part changes its hash, and the mark
then reads as not ready. `et design check` prints a `READY <product>: <parts>` line after the open
points when a mark holds.

A go releases a part for implementation. `et design go components/chip --product app-a --by tom` stores the part hash,
who and when in `.ethlete/design/<product>/go.json`, next to `ready.json`. A go needs no empty open-point list. Any edit
of the part changes its hash, and the go then reads as stale: the design changed, so the part needs a new go. A part
with an `implements` link and no current go has the open point `no go`, or `go is stale` after a change. Studio sends
`POST /__design/part-go?product=` with `{ part, by }` and optional `hash`: 400 without `by`, 404 for an unknown part,
409 when the part changed since `hash`. The one-part open-point answer also holds `go`. `et design check` prints a
`GO <product>: <parts>` line when a go holds.

`--by tom` is the guarded path: `et design go <part> --product app-a --by tom --note "Impl Q113"` needs a note that names
an `Impl Qnn` entry of the current `plans/**/*.md`, committed. It shows the go and asks `Record this as Tom? [y/N]`, and
records nothing without a yes. When stdin is not a TTY it refuses and names `et design go --batch <file>`, so an agent
cannot give Tom's go. A design file of the part that is uncommitted or committed after the decision is no refusal: the
confirm line names it, for example `go studio components/chip - Impl Q98 - design changed after Impl Q98 (5e554809b)`.
The note is stored in the go entry. `et design accept --by tom` asks the same way. Any other `--by` and Studio's go
button need no note and no confirm.

A go also stores `actions`, the sorted `data-et-action` keys every state of the part draws. `et design check` fails
`ACTION-LOST` for a key a go stored that no part of the product draws now: moving an action to another part is fine,
dropping it is not. A new go of the part stores its current keys and so confirms the removal. A go stored before
`actions` is not checked.

A product can list what its users can do in `.ethlete/design/<product>/capabilities.json`: a `capabilities` array of
`{ "id", "label", "place" }`, where `place` is `{ "part", "action" }`, the part and the `data-et-action` key that draw
the capability. `et design check` fails `CAPABILITY-PLACE` for a place whose part does not declare that action, and for
an entry without a place. An entry without a place that names its backlog item in `missing` (`"missing": "B157"`) is a
warning instead, so the list of known gaps can only shrink: a new entry needs a place or a backlog item, and an entry
that has a place again must drop `missing`.

A part declares in `coverage` what its design must draw to cover the real inputs, and `et design check` warns on each
gap:

- `branches`: per layout branch, the widest and tallest `real` input from the product's listing and the sample size
  each state draws in that branch. `COVERAGE-RANGE` when no sample is as wide or as tall as the real input.
- `zoom`: the zoom extremes of the view and, per status (drawing, paused, failed), the state that draws it at each
  extreme. `COVERAGE-ZOOM` for each status and extreme without a state.
- `async`: per mark the view reads asynchronously, the state that draws it while unknown, or `null`.
  `COVERAGE-ASYNC` for `null`.
- `chrome`: the labels of the live chrome around a part that draws the tool itself. `SAMPLE-CHROME` when a text inside
  a `data-et-sample` region repeats one.

A state that marks the same `data-et-status` twice inside one `data-et-view` region (or twice in a state without such
regions) is a `STATUS-TWICE` warning, in every part.

An agent that prepares Tom's goes writes a go list, a JSON array, and Tom runs `et design go --batch <file>`:

```json
[
  {
    "part": "components/chip",
    "product": "studio",
    "action": "go",
    "note": "Impl Q98",
    "verify": "d85d4129c"
  }
]
```

A sketch merge as Tom is an entry with `"action": "merge"` and no `verify`: `{ "part": "pages/system", "product": "studio",
"action": "merge", "variant": "a", "note": "Impl Q99" }`. `variant` is optional and picks the only live variant of a
sketch nobody picked in Studio; without it the sketch needs a pick. The check refuses a sketch that is missing or not
ready, naming `design sketch ready <part> --by <model id> --product <name>`; a merge runs the same code as
`et design sketch merge`, and its note is the reason and the plan reference.

`action` is `go`, `accept` or `merge`, `note` names the `Impl Qnn` decision (an accept entry uses it as its note) and the optional
`verify` names the commit of the part, which must exist. The command checks every entry first and refuses the whole list
when one fails, then lists all entries with their notes in one `Record these <n> as Tom? [y/N]` prompt and records them
all, by `tom`, on a yes.

The part hash of ready, go and implemented is the design hash: the part folder, the shared and asset files it uses, and
every file it reaches through imports - other `@system` parts, `@ethlete/<lib>/design` mocks and the fixtures. Each
mark stores the hash of every one of those files next to it, so an edit of an imported part or an SDK mock makes the
mark stale too. `task --verify` also stores in `implemented.json` the hash of each repository file the app component
reaches: relative imports, `templateUrl` and `styleUrl` files, and for an `@ethlete/*` import (resolved through the
`tsconfig.base.json` paths to `libs/*/src`) only the files that declare the imported names. `et design check` prints
`STALE <product> <part>: design <files>; app <files>` for each part with a ready mark or an implemented record whose
ready mark or go no longer holds, or whose app files changed, and names the changed files; such a part no longer
counts as done. A mark stored before the file lists holds while the old folder-only hash does: the first
`et design check` moves it to the design hash and prints `REHASHED <product>: <part> (go, ready, implemented)`, and one
whose folder changed since, or that reaches a file outside its folder (an imported part, a mock) committed or edited
after the record's `at`, stays stale and is not moved, listed with `files unknown: recorded before file lists`.

An edit that changes no pixel keeps its review. `et design go` and `et design accept` draw every state of
the part as `design compare` draws the design side and store the hash of each picture in
`.ethlete/design/<product>/pictures.json`, under `review` (at the `merged.json` hash) and `go` (at the go hash).
`et design check` stores the pictures of a review or go that holds and has none at its hash yet, which covers Studio's
go button and sketch merges, and the `record` pictures of a merged part unchanged since its merge. When a merged part
changed outside a sketch, `et design check` draws every state again and compares it with the pictures at the
`merged.json` hash. With every state identical it records the new hash in `merged.json` and prints
`HELD <product> <part>: changed outside a sketch, every state draws as before`. Otherwise it prints
`PICTURES CHANGED <product> <part>: <states>` and opens an old/new edit sketch to pick from. The check never writes a
go: a go holds only while the part hash does, so an edit that moves the hash leaves the go stale, however small the edit.

`et design task components/chip --product app-a` prints what implementing a part with a current go takes: the go hash,
the `implements` component, each state with its props, the states new or changed since the last implementation, the
allowed files and the target, compare green, then a line naming the SDK surface and colour theming and the theming skill; `sketch new` ends its next steps with the same line. The allowed files are the folder of the component,
`.changeset/*.md`, the generated harness map of the product, and for the product `sdk` also `apps/docs/components/**`. The task refuses a part without a go, with a stale go,
without an `implements` link, or with only a route link: add the `component` of the page to the link. A page part's
allowed folder is the folder of that component.
`.ethlete/design/<product>/implemented.json` keeps the part hash and a props hash per state of the last implementation;
when the part changed but no state's props did, the task lists all states. `--verify [<rev>]` checks the files of a
commit (default `HEAD`) or a range `a..b` against the allowed files and exits 1 with any file outside them. When the
files pass, it runs compare over all states, on `--url` or a server it starts as compare does, and only when every
state is ok it records the part hash, the time and a props hash per state in `implemented.json`.

`et design compare pages/system --product app-a --live --sketch a --url <dev server>` compares the live states of a page
against the design states of variant `a` of its open sketch instead of the merged design.

`et design compare components/chip --product app-a --url http://localhost:4200` compares each state of a part, or the
one `--state` names, with the app. It refuses a part as `task` does, except a part that changed since its go: that
runs too and its output starts with an `unapproved:` line, because only `task --verify`, `ready` and `accept` hold the
go gate. For each state it draws the design frame and
opens `<url>/__design-harness?part=<part>&state=<state>&props=<JSON>` in the same Chromium, with the same viewport and
device scale, and shoots the `[data-design-harness-host]` element. The app owns that dev-only route and mounts the
`implements` component with the state's props inside the host. Compare sets the host to the design frame root's font
family, size, weight, style, line height and letter spacing, so a part that inherits its type is judged in the design's
type, not the app body's. Pixels compare at tolerance 0, and a size mismatch
fails too. It prints one line per state, `default ok`, `removable DIFF 12 px` or `removable SIZE 120x32 vs 118x32`, and
keeps the design, app and diff pictures of each failing state in a temp folder it prints. It exits 0 only when every
state is ok, and names the URL when the page shows no host element. Without `--url` it builds the
product's harness app (`nx run <project>:build:development`) into a temp folder, serves it on a free port with every
unknown path answered by its `index.html`, and stops the server and removes the folder afterwards, also on failure or
Ctrl-C. This works next to a running dev server of the same app. When another nx process runs the same build, it
fails at once and asks for `--url`.

`et design compare --affected --product app-a` compares every implemented part whose app files changed since its
`implemented.json` record, the parts a shared change reaches, in one run on one harness. Each part's output starts with
`== <part> (changed: <files>)`. A part whose states are all ok gets its actions check on the same harness, and when every
action works its record is written again with the current app file hashes. A part whose design changed since its record
is not recorded: that needs `task --verify`. It exits 1 unless every affected part is recorded. A UI item is done when
it shows in the app and `compare --affected` is green (ADR 0203); `check --rules --base` and the design rules gate
refuse a change that leaves an implemented part uncompared and name the parts.

Compare runs in a resident design process of the checkout. The first compare starts it detached and prints
`starting the resident design process (cold start, ~N s)`; later ones send it their request, get its output and exit
code back, and reuse its design server, Chromium and harness app, which it rebuilds only when an input of the build
changed. It exits after 30 minutes without a request, and `et design stop` ends it at once. Its discovery file and log
are in `tmp/design-resident/` of the checkout. When it does not answer, compare prints one line and runs in its own
process; in CI (`CI` set) or with `ETHLETE_DESIGN_RESIDENT=0` it always does.

`et design actions components/chip --product app-a [--url …] [--state <name>]` checks what each control does. Every
interactive element of a design (button, link, field, an element with an interactive role or `tabindex` 0 or more)
declares its action in `data-et-action`: the state a press reaches (`data-et-action="open"`) or the output it fires
(`data-et-action="emit:collapse"`). From each state that forces no interaction, and from each open-surface state
after a click on its trigger, the command opens the harness page, clicks the element and, in fresh pages, presses
Enter and Space on it; a switch, checkbox or radio gets Space only, as a native checkbox does. A state action passes when the host shot equals that state's design picture at 0 px; a key
compares with `<state>-focus-visible` where the part draws one. An output action passes when the mounted component
emits it; the harness records outputs on `window.__etDesignEmits`. It fails on an app element whose design element
declares nothing, on a declared design element the app lacks, and names a key whose keydown default the app prevented.
States run in batches of a few with a fresh browser each, so a part with many states does not exhaust memory.
It needs no go. `et design complete` fails an undeclared interactive element as `ACTION-UNDECLARED`.

It also checks the pointer focus of every focusable element (`tabindex` other than -1, button, `a[href]`, field,
select, `contenteditable`) in two fresh pages: a real mouse click at its centre, after Tab presses that leave focus elsewhere (a script focus rings only when the last input was a key), must leave no focus ring (a visible
`outline`: style not none, width above 0, a colour that is not transparent), reported as
`<element> pointer focus FAILED shows a focus ring after a pointer click`. Text entry is exempt, because browsers always
show `:focus-visible` there. Keyboard focus (after a Shift press) must show a ring, an outline or a changed `box-shadow`;
when it does not, the line is `ok (warning: …)` and not a failure, because another indicator such as a focus-within
wrapper may draw it. An element whose click navigates away is skipped.

`et design actions [<layer>/<name>] --product app-a --live [--url …]` runs the same check on the app's real pages
instead of the part harness. It needs a development build (`window.ng`) and the product's live spec
(`"harness": { …, "live": "apps/my-app/design-live.json" }`) with a `"shell"` selector of the app's shell component,
for example `"shell": "app-shell-page"`. On the first state of each live page it presses every control the shell
component's view owns, and every control in an overlay, with click, Enter and Space, and passes when the page design
declares the action and the press reaches it: the shell output fires, or the declared state's `aria-expanded` values
show. It then compares each control's outcome across pages (outputs, expanded controls, a gained `aria-current`, added
and removed controls) and prints one `drift` line naming each page when they differ. With a part it presses only the
controls that part draws. The same pointer-focus check runs on every control the press reaches, as a `<control> pointer
focus` line per page.

The harness route reads its parts from a generated map. A product names its app and the map file in `config.json`,
`"harness": { "app": "apps/my-app", "map": "apps/my-app/src/app/design-harness/design-harness-parts.ts" }`, and
`et design harness --product app-a` writes one lazy import per part whose `implements` names a component, keyed by
`<layer>/<name>` and formatted with the checkout's Prettier. A route-only link adds no entry, and an empty map is valid.
`--check` exits 1 when the file differs from what the links give; `compare` and `task --verify` refuse a stale map. The
app mounts the route only in a development build, outside its shell: Ethlete Studio and the docs examples app bootstrap
a harness root instead of the app when the path ends in `/__design-harness`.

A product whose part stylesheets hold a `prefers-color-scheme` query or `light-dark(` renders two
colour schemes. The check then draws each state in the light and in the dark scheme, and a finding
names the scheme, for example `2.1:1 in the dark scheme`. Any other product is measured once.

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

`sketch target add <sketch> <part> --by <model id>` adds a part to the targets of an open sketch, and
`sketch target remove <sketch> <part> --by <model id>` drops one (both take `--product <name>`). `add` follows the layer rule of
`UPWARD-DEPENDENCY`: the part is allowed only when the layer of some existing target may use the part's layer, or the
part's layer may use it. A second `elements` part is refused next to an `elements` target, a `pages` part is allowed. A part that breaks the rule is
refused up front and nothing is written:

```
elements/tag-list cannot target elements/tag (UPWARD-DEPENDENCY): elements may use foundations, components, not elements
```

`remove` deletes the target and its folder in every variant. It refuses the main target (the first one; discard the
sketch instead) and a part that is no target of the sketch.

A sketch of a part the product takes from its base (`et design sketch new components/button --product studio`)
merges into the base: the part folder in the base, and the base's `merged.json`. `sketch new … --override` opens it as a
product override instead, and the merge writes a product copy. When the product overrides the part already, `sketch new`
refuses without one of two flags: `--override` sketches the product copy, and `--into-base` starts from the copy, merges
into the base and removes the copy with its `merged.json` entry. A part of a built-in base takes `--override` only.

A part holds one open sketch, or one per name: `sketch new components/card --name alt --variants x` opens a second one
next to the first, in its own folder (`sketches/components-card.alt`), with its own `sketch.json` and the id
`components/card@alt`. Pass that id to every sketch command (`sketch ready components/card@alt`). A sketch opened without
`--name` keeps its folder and id, and two sketches on a part cannot share a name.

`sketch ready` refuses while a target of a live variant does not load. It also runs the render check on the variants and refuses on a render issue the merged part does not already show (same rule, detail and element, also when the part moved its demo frame into `frame`); `design check` still lists the old ones. An element marked `data-et-skip` stays out, and a missing browser skips the check with a `RENDER CHECK SKIPPED` line.

`sketch ready` also refuses while a live variant adds an open point the sketch can close itself to a target: no
controls declared or a missing motion (contrasts and missing control states already fail the render check). A point
the merged part already has is listed as a `NOTE` and does not block; a new part blocks on all of its points. Points
that exist only outside the sketch do not count: the sketch itself, no `implements`, open comments.

A sketch goes to `ready` only when no change to it waits on anything. `et design sketch hold components/button --until
"the radius token lands" --by <model id>` records the wait in `sketch.json`: a `ready` sketch goes back to in progress
and leaves the merge queue, and `sketch ready` refuses with the `--until` text and the `et design sketch release <part> --by <name>` command. Make the change, then
`et design sketch release components/button --by <model id>` removes the hold. `sketch list` and `sketch check` show it.

`sketch ready` also refuses (rule `UNUSED`) while the files of a live variant, with the `shared/` files they import, keep
an import nothing uses, a parameter a named function never reads, a parameter of a `shared/` function no call passes, or a
class no drawing uses (`et-` classes of the SDK are not checked): code of another candidate must not reach a merge. Keep
rendering for one candidate in that variant's files and only common code in `shared/`.

`sketch ready` also refuses a live variant that adds nothing visible: one that draws every state of a target pixel
for pixel like another live variant, or like the current part when the sketch has more than one live variant. A
variant that matches another in some states only is fine. A lone variant that draws like the current part is a change
without a visible difference, which `sketch ready` merges by itself. The Studio sketch view shows each column's first
state (the current part's states first), so `sketch ready` also refuses a variant whose first shown state draws like
the current part's or an earlier variant's: make a state the variant changes its first state.

`sketch ready` also refuses (`SHOT-NOT-VIEWED`) while a live variant draws a pixel diff against the product (the
same diff that stops the merge on its own, below) and no shot of that variant was handed out since the variant last
changed. `et design shot <layer>/<name> --states --variants` records a view for each variant on its sheet, and so does
`GET /__design/shot?...&sketch=<target>&variant=<key>` without `priority=low`; an edit of the variant's files or of the
sketch's `shared/` folder makes the view stale. The views live in `node_modules/.design-explore/viewed-shots/`, per
checkout. A sketch whose variants draw like the product, and a new part, are not held back.

`sketch ready` also refuses (`SAMPLE-MARK-DRIFT`) while one sample carries different marks in two states of a
target. A part opts in with `sample: { id: 'sample', marks: ['same', 'look'] }`: every instance a host draws with a
prop `sample` is identified by that value, and its `marks` props must be equal in every state of the host. A host state
that shows another sample passes another id. The line names the part, the id, both states and the differing marks.

The agent that drew such a variant takes it out of the open set with `et design sketch withdraw <part> --variant <key>
--by <model id>`. It refuses unless `--by` is a model id (not `designer`) that drew the variant, and the variant draws
the same pixels as a sibling variant in its first changed state. `sketch.json` keeps it as a rejection with the status
`withdrawn`, who withdrew it and the reason `identisch mit <sibling>`; `sketch list` shows it as withdrawn, and Studio
treats it like a rejected variant. `sketch reject`, `reopen` and `withdraw` refuse a `--by` that is neither `designer`
nor a model id (`claude-…`, `gpt-…`, `gemini-…`, `codex-…`).

`sketch check` skips a withdrawn or rejected variant and prints one `NOTE <target> <variant>: withdrawn, not checked` (or `rejected, not checked`) line for it. `sketch check` fails on the same `UNUSED` problems. It warns of every other reason `sketch ready` would refuse that
does not depend on the sketch's status, as `ready will refuse: <reason>` lines, and still passes: a variant that does
not load, an open point a live variant adds, a running round without a note, a sample whose marks drift, and a variant that adds nothing visible
or that the sketch view shows like another. Its last line then reads `check ok - ready will refuse <count> (see
above)`. A hold and an already `ready` sketch are refused only by `sketch ready`.

`sketch check` fails with `ROUND-NOT-READY <target>: round <key> is drawn but still in progress` when nothing else would make
`sketch ready` refuse and the sketch is neither `ready` nor on hold: the round is drawn and only waits for `sketch ready`
(or `sketch hold`). `sketch report --done` refuses the same round with the same message (a round without a note is not
drawn yet).

`et design sketch merge <layer>/<name> --variant <key> --allowed-by <plan ref> --by <model>` merges a
sketch the user has not picked in, only when `<key>` is its one live (not rejected) variant; both flags
go together, and `accepted.json` logs the plan; the part note stays. With two live variants the user picks in Studio.

`sketch merge --decided-by <name>` records who picked the variant in `merged.json` (`user` without it): give it the name
the designer told you at this terminal, for example `tom`. It does not go with `--allowed-by`, which records the plan.

`sketch ready` also draws each live variant's changed parts at rest and refuses with
`CONTROL-UNDECLARED <part> - … (variant <key>)` for a control the variant draws that no `controls` entry declares, unless
the merged part draws that same control undeclared. Declare it with `data-et-control` or `control(markup, name)`.

`et design sketch merge` and `sketch discard` resolve the addressed comments on the sketch's
variants, and a merge also those addressed comments of the merged parts that have no sketch; the open
comments on the variants become addressed. A merge leaves a thread open when it has no reply yet or its
last entry asks a question. `et design comment resolve-ended [--product <product>]` resolves the addressed
comments whose sketch no longer exists.

Token validation follows relative, `@shared/` and `@system/` imports through helpers and CSS
imports. A variant's `shared/` overrides take precedence; unused sketch-shared files do not supply
token definitions. Pixel comparisons for sketches use fresh rendering results on each request,
so an earlier failed or matching screenshot does not determine a later comparison.
A screenshot of a state shows the end of every finite CSS animation and transition, so an
element that fades in with `@starting-style` is drawn fully visible. An infinite animation keeps
running.

A pixel comparison gives one box per cluster of changed pixels: changes closer than 16 pixels
merge, and at most eight boxes remain. `et design shot <part> --variants --crop changed` compares every
drawn state of every shown variant with the merged part, a state the merged part does not draw with its first state,
and writes one contact sheet per cluster (`<out>-area-1.png`, `<out>-area-2.png`, …; a single cluster keeps
`<out>`), and Studio's changed area stacks one enlarged crop per cluster below the whole page.
`--crop <x,y,width,height>` with a box outside the content writes an empty transparent picture of the crop size and prints a note naming the content box.

`--surface <name>` only puts the `et-surface--<name>` class on the frame root; the colour scheme
stays light, so `light-dark()` and theme rules bound to `prefers-color-scheme` still draw their
light branch. `--scheme dark` (or `light`) pins the scheme the way Studio's scheme copies do; pass
both, e.g. `--surface dark --scheme dark`, to check a dark theme.

A part gets its surfaces by elevation, as the app does, not by a picked `et-surface--<name>` class. The frame gives
each element with `data-et-auto-surface` the registered surface theme of the same type one elevation above the
surface it sits on (outer first; without such a theme it keeps the parent's), like `etAutoSurface`, and gives each
element with `data-et-surface-interactive` the hover, focus and pressed tint of `etSurfaceInteractive`. It reads the
themes from the `.et-surface--<name>` rules of the loaded stylesheets, resolves again after every state switch, and
`et design task` maps both attributes to these `@ethlete/core` directives. The root surface comes from the frame
root (`--surface`, or the product's `:root`).

The floating panes from `@ethlete/components/design` carry `data-et-auto-surface` unless you pass a `surface`:
`dialog()`, `alertDialog()`, `anchoredDialog()` (from `design/anchored-dialog`), `menu()`, `selectPanel()` and
`tooltip()`. `anchoredDialog({ content, arrow, placement })` draws a popover pane in flow, with its arrow, so a
part places it under the drawn trigger.

A part never picks a colour theme name either. `data-et-semantic-color="<type>"` (`success`, `warning` or `error`)
gets the `et-color--<name>` class of the registered colour theme of that type, swapped for the surface it sits on,
like `injectSemanticColorTheme(<type>)` bound to `[etProvideColor]`, which `et design task` names as the mapping.
Without a theme of that type the frame sets nothing; the SDK throws when the component reads that theme. An auto
surface also gets the class of its new surface's `colorThemeVariants` swap of the inherited accent, as
`etProvideSurface` does. The frame reads the types from `--et-color-theme-type` and the swaps from
`--et-surface-color-theme-variants`, which the `@ethlete/core` theme generators write; regenerate the theme CSS
once to get them. The root default colour theme stays as the product provides it.

`et design part remove <layer>/<name> --product <product> --by <model>` refuses removal while
application source imports files under that part, and reports each importing file and line.
Remove or update those imports first.

`sketch ready` merges a sketch on its own only when no state of the target changes a pixel and
no state of a part that `sketch preview` lists under `shows` changes either. Otherwise the sketch
stays ready, and the output names each changed part and state. A state that looks changed is drawn once more on both sides first, so one odd picture under load does not stop the merge. A frame that never draws fails the drawing with its URL instead of giving a blank picture.
Every variant must draw the same; one changed variant is enough to stop it. A variant draws its
own part stylesheets, also where the product stylesheet `@import`s the merged file.

When `sketch ready` merges a sketch by itself it writes the shared files `merged.json` and `accepted.json` (and the base's
`merged.json`), and prints one `et design commit-hunks <file> --part <part>` line for each file it changed. That command
commits only the entries of the named part (an object key, or the list entries whose `part` it is; repeat `--part` for
several) as HEAD plus those entries for that path, and leaves the entries of every other part uncommitted in the working
file. A locked `.git/index.lock` is retried with a short backoff, up to ten times. `--message` sets the commit message; the default is `chore(repo): Record <part> in <file>`. It works on `go.json`,
`implemented.json`, `ready.json`, `pictures.json` and the other part-keyed files too. There is no auto-commit in `ready`.

A problem the product already had does not fail a variant: `sketch check` and `sketch ready` print one count line per
variant, `NOTE elements/hero a: 2 problems were there before (design check lists them)`.

When the product has a live spec, `sketch check` and `sketch ready` also report a `LIVE` problem for each `"design"`
state name the spec maps for a part of the sketch that neither the variant nor the merged design has.

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

A bare `data-et-surface` on the part's root element marks the part's own surface and needs no control; a bare one anywhere else is a gap.

`pointer` input needs `hover` and `active`, and `keyboard` input needs `focus-visible`. The part
draws them with `interactionRows`: its `grid` needs a column for each of them, and every row
needs a state in each of those columns, so the open row is drawn hovered too. In any grid, a row that draws a state in one
column and none in another leaves an empty cell: the shot sheet draws it as "not drawn", and `sketch check` prints it
on the grid line (`draws no selected active`). A row whose forced elements are only SDK components rendered through
`ng()` with no class, inline style or styled content of the part's own, no rule of the part's stylesheet that selects
it, and no wrapper that sets `--et-*` vars or `data-et-semantic-color` is drawn at rest only: Studio, `shot`, `compare`
and the visible-change gate skip its interaction states, and `compare` names them (`skipped 3 interaction states
(unchanged SDK controls): ...`), though `shot --state <name>` alone, without `--states` or `--variants`, still draws one you name. A shot refused for its flags prints which flag is missing or conflicts (for example `--at needs --variants`) before the usage line. Flat states such as
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

`sketch check` warns, without failing, when the "Aktuell" column of the Studio sketch view would draw only placeholders: every state
left after the states each variant draws unchanged fold away is new in the sketch. The line reads
`Aktuell shows only placeholders: open "<state>" to compare`.
It also warns `VARIANT-UNCHANGED` for a live variant whose every state draws the same pixels as Aktuell, in every
frame: such a variant offers no decision.

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
| `field`          | nothing; with `input: ['pointer']` it needs hover but no `active`                                                                                                   |
| `row`            | a state that draws it selected, and one that forces hover on it while selected                                                                                      |
| `tooltip`        | the visible tooltip `surfaces.tooltip` names, drawn next to the control in this part                                                                                |

Selected means `aria-selected`, `aria-checked` or `aria-pressed` set to `true`, or an
`aria-current`. A selected row or option must look different from an unselected one: its
computed colours, opacity, shadow or font weight, or those of an element in it, must differ.
An option that never takes focus, such as one a listbox names with `aria-activedescendant` on its
control, proves focus-visible without a forced interaction: in a shown surface, the option whose
`id` an `aria-activedescendant` names must look different, by the same computed look, from a plain
option in that surface that is not selected, active or forced. An option with
`data-active-source="keyboard"` counts the same way. A `row` control with
`data-active-source="keyboard"` proves its focus-visible the same way, against a plain row.
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
without a `data-et-control` is a `CONTROL-UNDECLARED` hint: it does not fail `et design complete`, and the sketch
check fails on one a sketch adds as `CONTROL-PART-INPUT`. Mark a native control with `control(markup, name)` from
`@ethlete/components/design/control` and declare the name in `controls`. On a reused control part's render,
`control(drawn.body, name)` renames its control. The focus container of a composite
widget (role `menu`, `menubar`, `listbox`, `tree`, `treegrid`, `grid`, `tablist` or `radiogroup`
with `tabindex="-1"` or `aria-activedescendant`) is not a control: it needs no declaration, and
the items inside it are checked as controls. A marker on a wrapper that is not a
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
carries `data-et-slot` and stays the host's. The same holds for the markup of an exported `const` or
`function` helper of a part module, such as `studioMenu()`, and for the markup passed in as its
arguments. A control inside an embedded part is not declared on the host, unless the host declares it
with `part` naming that part; the host fails once per owning part that is not design complete itself, as
`CONTROL-PART-INCOMPLETE`. A rule in a CSS file of the host's folder that styles an element inside
an owned part fails as `CONTROL-OVERRIDDEN`, unless the host marks it with `data-et-control` and
declares it. On the owned root itself, outer layout (margin, size, position, inset, flex and grid
placement, transform) is not an override.

A demo frame around a part, such as padding and a page background that only present its states, goes in
`definePart({ frame })`, not in `render`. `frame(body, props)` wraps the body of each state the tool draws of the part
itself; a part that calls `render` of this one gets it without the frame, so the host needs no override to remove it.

```ts
export default definePart({
  note: 'An open popover anchored to its trigger',
  states: { open: { placement: 'bottom-end' } },
  frame: (body) => `<div class="anchored-dialog-frame">${body}</div>`,
  render: ({ placement }) => drawing({ body: anchoredDialog({ placement }), styles }),
});
```

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
