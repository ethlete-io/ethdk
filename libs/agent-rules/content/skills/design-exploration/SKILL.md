---
name: design-exploration
description: How a visual design exploration runs - the step size, what to put in front of the user at each stop, and when you may commit. Read BEFORE any visual design work on a sketch, a prototype, a theme, a palette, or the look of a component. The user is the designer; you find and frame, and you never pick the fix alone.
kind: skill
scope: both
vars: [storybookUrl]
---

# Design exploration

A design exploration is a dialog. **The user is the designer. You find and frame. The user
chooses.** A finding is not a licence to pick the fix.

The unit of work is one open question, with every answer drawn side by side at the same
geometry: a **sketch** on a product, or a **call** in a repository with the old setup. A variant wins
or loses only against the other variants of its question.

## The rules

1. **One open call at a time.** Take one question. Draw its variants. Stop.
2. **Put the variants in the call, then name your pick.** Two to four variants, drawn for
   real, side by side, labelled, with what each one costs. Your pick is a proposal.
3. **Commit only when the user says commit.**
4. **A clear rejection starts the next call.** Settle and record the rejected call, then draw
   the next focused question automatically, within the user's original scope. Stop only when the
   user asks to pause or end the exploration, or when their feedback leaves no grounded next
   question.
5. **Keep the answer short.** 120 words at most.

Confirm the step size once, at the start. Do not ask again at every stop. A task is not
finished while the user is still talking about it.

## What one stop looks like

- The question, in one sentence.
- The sketch (or call slug) to look at.
- The variants, labelled A, B, C, one line each.
- Your pick, one line on why.
- Nothing else. No next step, no second finding.

**Do not send a screenshot.** The user keeps the call open. Screenshot only for your own
check that a variant renders.

If a second defect appears, add it to the open list and give it one line. Do not draw it.

## Where the variants are drawn

The exploration's plan file names the tool. Two shapes exist.

**A repository with a `.ethlete/design` folder** keeps one design system per **product**, and the
user reads and decides in Ethlete Studio. The tool is `et design`, from `@ethlete/cli`; run
`et design --help` for every command.

```
.ethlete/design/
  config.json                         the port and one `products` entry each
  <product>/<layer>/<part>/           layer: foundations, components, elements, pages
  <product>/flows/<name>.json         a flow: pages and their states joined by lines
  <product>/sketches/<layer>-<name>/  an open sketch: sketch.json and one folder per variant
  <product>/comments/<id>.json        a comment the user wrote in Studio
  calls/                              old calls: Legacy, read-only
```

Studio no longer takes new calls. **New work goes to a product, never to a new call**; do not run
`et design new`. Old calls stay in Studio's Legacy tab as reference for moving them into a
product. They take no picks and no new variants.

### Create a product

```bash
et design product new <name> [--base @ethlete/components|<path>] [--from-project <name>]
```

It writes the `config.json` entry and the empty layer folders. A product on `@ethlete/components`
takes the SDK as its base, so its parts start from the real components rendered with `ng()`.
Without a base it gets the presets phone (390x844) and desktop (1440x900). `--from-project` copies
`styles`, `head`, `providers` and `themes` from an old project entry. Studio never writes
`config.json`; the command does.

### Propose a change as a sketch

A change to a part, or a new part, is a **sketch**: the question is the part, the variants are the
answers. Variants are drawn at the same geometry, and one variant wins only against the others.

```bash
et design sketch new <layer>/<name> --variants a,b --by <model id> [--product <p>]   # each variant starts as a copy of the part
et design sketch report <layer>/<name> --variant b --by <model id> "phone"         # tell Studio what you build now
et design sketch check [<layer>/<name>]                                            # each variant laid over the product
et design sketch ready <layer>/<name> --by <model id>                              # now the user can pick
```

A variant mirrors the product layout and holds only the parts it changes. Draw two to four
variants, each with what it costs, and run `sketch check` before `ready`. A variant with problems
cannot be picked. Use `sketch list` to see the open ones.

Name the variant you work on with `--variant`. Studio marks it as drawing, and hides its frames,
while the latest report names it. The report also records your model id as an author of that
variant, and a merge writes the picked variant's authors into the part's `madeBy`.

### Combine variants in a new round

Studio never combines variants. When the user asks for one in a comment ("solid like a, outline
like b"), draw it as a new variant in a new round:

```bash
et design sketch variant <layer>/<name> c --from a --by <model id> --round "Solid a, outline b" --note "r1 showed pill and square; the user wants a's solid with b's outline"
```

`--from` copies a variant into the new one, sets the sketch back to in progress and clears the
pick; it refuses while the decision is a discard (the user picks a variant first). Without `--round` the new variant joins the running round; with it, `--note` is required and
goes on the running round: what it showed and why its variants lost. Older variants stay pickable.
Letters continue across rounds (r1: a, b; r2: c, d). Draw the combined variant, then answer the
comment with `inbox done` and mark the sketch `ready` again. `sketch new --round <title>` names
round 1.

### Your model id: `--by`

Every command that writes takes `--by <model id>` and fails without it: `sketch new`, `variant`, `report`,
`ready`, `rebase`, `merge`, `discard`, `inbox done` and `comment reply`. The id is the exact model
id as free text, for example `claude-opus-5-5`, `gpt-5.6-sol` or `gemini-3-argon`. Studio shows it
on the variant, the reply and the part, so the user sees which model made what.

**Never guess your id.** Use the one your prompt names. If your prompt names none and you do not
know your own exact id, ask the coordinator or the user before you write.

### The user decides, Studio merges

The user picks a variant, or discards the sketch, in Studio. **Studio merges on the user's click.
Never run `sketch merge` or `sketch discard` yourself, and never pick a variant.** Both refuse
while the sketch has open comments, so handle those first. If a part the variant replaces changed
in the product since the sketch was created, the merge refuses: bring each variant up to date, run
`et design sketch rebase <layer>/<name>`, and mark it `ready` again. `sketch preview <layer>/<name>
<variant>` lists the elements and pages a merge changes. The note on a part records why it has its
current shape, and the merge sets it from the user's reason.

### Read the inbox

The user comments on a state of a part in Studio, at a point, or on a sketch variant.

```bash
et design inbox [--json] [--product <p>]   # open comments and pick/discard decisions, oldest first
et design inbox done <id> --note <text> --by <model id>   # set the part note, delete the comment thread
et design comment reply <id> --by <model id> <text> [--question]   # answer a comment thread (takes --product)
```

Read the inbox at the start of a session and after each sketch you mark `ready`. Answer a comment
by changing the sketch or the part, then `inbox done <id> --note "…"`. The note replaces the `note` of the part the comment was made on (for a sketch variant, the product's part), so write it to explain the whole shape of the part, and pass the old note unchanged when it still holds. `done` fails without `--note`; only the user withdraws a comment without one, in Studio. `done` also stores your `--by` where the comment sat: in the authors of the sketch variant, or in the `madeBy` of the part. A pick or discard decision is the user's
cue, not yours to act on beyond what Studio already did.

A comment is a thread: the user and you both reply. When a comment is unclear, ask with
`comment reply --question` instead of guessing. The thread then moves to the "waiting for the user" group
(`waitingForUser` in `--json`) and returns to the inbox when the user answers. A thread there is
not work for you, but it still blocks `sketch merge` and `sketch discard` until it is done.

Pass `--question` only when you cannot go on without the user's answer. Studio lists only those
threads under "Questions for you". A report of what you did is no question: reply without the
flag, and the thread shows as "answered" until the user withdraws it or replies.

### Draw a flow

A flow joins states of pages into a path the user reads left to right in Studio's Flows view.
It is `<product>/flows/<name>.json`; `position` and `label` are optional:

```json
{
  "frames": [{ "part": "pages/library", "state": "empty", "position": { "x": 0, "y": 0 } }],
  "lines": [
    {
      "from": { "part": "pages/library", "state": "empty" },
      "to": { "part": "pages/film-detail", "state": "default" },
      "label": "user adds a film"
    }
  ]
}
```

A line may join two states of one page. Lines hold for every preset. Without `position`, Studio
lays the frames out along the lines.

### Draw a wireframe

A page that has no parts yet draws grey stand-ins from the wireframe kit; only pages may import it:

```ts
import { box, textLines, image, button, input, icon } from '@design-system/kit';
```

Signatures are in `libs/cli/design/wireframe-kit.ts`: `box(children, { direction, gap, padding, width, height, grow, plain })`,
`textLines({ lines, width, size })`, `image({ width, height })`, `button(label, { primary })`,
`input({ label, placeholder, width })`, `icon({ size })`. Studio lists such a page under
"Wireframes" with its kit-use count. A shell is a normal element named by purpose (`shell-main`).
A dialog without its own URL is an element that a page state shows ("login open"). Examples in
`.ethlete/design/studio-lab`: `pages/film-detail`, `elements/shell-main`, `elements/login-dialog`,
`flows/sign-in.json`.

### Check a product

```bash
et design check --product <name>   # layer dependencies, hard-coded colours, copied components, scripted motion, tsc
et design system --json            # each part's origin, note, states, presets and problems
```

Without `--product`, `check` covers every product. A part may only use its own layer and the
layers below it (see "The order of a design"). Rule `FLOW` reports a misshaped flow file, a frame
naming a missing part or state, a duplicate state, and a line to a state that is not a frame of
the flow. Rule `WIREFRAME-KIT` reports a non-page importing the kit. Pass the changed files to the check below as before.

A project's `config.json` entry can name `themes`, `{ "surface": [...], "color": [...] }`; a
frame asked for a theme gets the `et-surface--<name>` and `et-color--<name>` classes on its root,
so a drawing must take its colours from the theme tokens and never set a surface or colour class
on its own root. An inner panel may set `et-surface--<name>`.

`et design [checkout]` serves the frames; the checkout defaults to the working directory and
`DE_PORT` overrules the port. In the ethlete SDK the user reads Studio, started with `yarn studio`,
which serves the frames itself: do not start `yarn design` next to it. Studio carries its own copy
of the tool, so a checkout that installs nothing still draws.

Three constraints on a drawing file:

- **Never import a package barrel.** The libraries resolve to source, so one barrel makes the
  browser request every module and the requests fail with `ERR_INSUFFICIENT_RESOURCES`. Import
  the one file you need.
- **The fixture is shared, and a variant may not change it.**
- **One file per variant**, so a broken variant breaks its own frame only.

A `<script>` in a drawing never runs. For behavior give the drawing a `setup(root)` function
(called once after the markup is in `root`, no cleanup, wire one delegated listener). Render each
state of a prototype with `ngStates({ closed: …, open: … }, { imports })` and swap them with
`setup: flow.on([{ click: '.trigger', go: 'open' }])`. To draw an open overlay, open it in the
template (`<et-select [open]="true">`); `ng()` returns the real panel and the frame places it.
`ngStates` wraps the states in `<div data-de-states style="display: contents">`, so a selector
rule must not depend on that wrapper.

**A repository with a sketch Storybook** draws every variant in the **same** story, side by
side, under the real geometry the thing ships in. The default Storybook is
{%storybookUrl%}; an app with its own sketch Storybook names its port in the plan file.

Either way:

- Sketches take inputs only and stay out of the application's build.
- Prototype, never refactor. Do not touch the shipped component until the treatment is
  settled.
- Keep the rejected variants drawn, marked as rejected.

## The order of a design

A product design runs in this order. Each stage settles in calls before the next starts, and
each stage draws with what the stages before it settled:

1. **Foundations**: colours, colour themes and surface themes (the project's `themes` in
   `config.json`), plus the type scale, spacing and radius.
2. **Logo and CI**, if the project needs them.
3. **Wireframes**: early, rough concepts of the main flows (a legacy call with `mode: 'wireframe'`;
   in a product, draw them with the wireframe kit, see "Draw a wireframe"). They show
   which components the product needs, not how they look. The stage ends with an inventory in
   the wireframe call: every part the wireframes need, each mapped to the SDK component it
   starts from, or marked new with the component call that draws it. The inventory is the
   queue of component calls:

   ```ts
   inventory: [
     { part: 'Search field', sdk: 'et-input' },
     { part: 'Match card', new: true, call: 'tomflix/components/match-card' },
   ],
   ```

4. **Components**, from the SDK ones rendered with `ng()`, themed and set up for the project.
   Each accepted one becomes a design-system entry.
5. **Larger elements**: the shell, the navigation, headers, lists, built from the entries.
6. **Pages**, built from the elements and the entries.
7. **The working prototype**: the pages joined with `ngStates` and `flow.on`.

Do not start a stage before the one above it is settled, and do not draw a page from parts that
are not in the design system. If the user asks for a later stage first, say which earlier stage
is missing, and draw that first.

The stages map onto the layers of a product: foundations, components, elements, pages. A settled
Legacy call with a stage counts for that stage in this order.

A later stage can show that an earlier one is incomplete. If a page needs a part that the system
does not have, add it to the inventory and open a component sketch for it. Never draw the part
inline in the page.

## Draw from the design system

A call that invents its own button, field or row does not match the calls beside it. **Before
you draw a part, look for it in this order, and draw new only when none of them has it:**

1. The product's design system, `.ethlete/design/<product>/` (and its base).
2. The real SDK components, rendered on the design server with `ng()` from `@design-explore`:

   ```ts
   const field = await ng(`<et-form-field><et-label>Name</et-label><et-input /></et-form-field>`, {
     imports: ['FORM_FIELD_IMPORTS', 'INPUT_IMPORTS'],
   });
   ```

   The template is a real Angular template, and `imports` names exports of
   `@ethlete/components`. The project's `providers` module in `config.json` supplies the themes.
   Render every component of a drawing in **one** `ng()` call: each call is a new app, so two
   calls repeat element ids. The server renders the built package, so in the SDK rebuild
   `dist` after a component change.

   To draw a form state (a value, an error, a touched field), give `ng()` (or `ngStates()`)
   `fields`. Each entry becomes a signal form field the template binds as
   `[formField]="fields.<name>"`. An error is a kind (`'required'`) or a kind and a message. A
   field shows its errors only when it is touched:

   ```ts
   const form = await ng(
     `<et-form-field><et-label>Email</et-label><et-input [formField]="fields.email" /></et-form-field>`,
     {
       imports: ['FORM_FIELD_IMPORTS', 'INPUT_IMPORTS'],
       fields: { email: { value: 'ada@', errors: [{ kind: 'email', message: 'Not an email' }], touched: true } },
     },
   );
   ```

3. Only then a new drawing. Build it from the two above, and say in the variant's `claim`
   that the part is new.

A part is one folder, `<product>/<layer>/<part>/`, with its drawing and states. Read the parts of
the product before the first drawing of a session. **A part exists only because the user picked a
sketch.** A `chosen` verdict in an old call is not enough. Never change a part's look without a
sketch the user decided.

## Check before you look

A broken build draws an overlay, so a screenshot of it looks like a design. **One check
covers that, and it is the whole gate.** Name the files you changed, never a whole project,
which is far slower and can fight the user's own editor.

With `et design`, run the checker from the checkout it draws:

```bash
et design check --lint <changed files> --tsconfig
```

`--tsconfig` with no path types every call of the checkout. `--checkout <path>` names another
one.

With a Storybook, copy {%resource:check-story.mjs%} to the **repository root** first:

```bash
node check-story.mjs --lint <changed files> --tsconfig apps/<app>/.storybook/tsconfig.json
```

Both take about four seconds and need no dev server. Then stop and hand the slug to the
user. Do not also render it in a browser: it costs a browser launch, and both tools
transpile without type checking, so the render reports `ok` on a file that does not
compile. Open it only when the check passes and the drawing still does not appear:

```bash
et design check --call <slug>             # every variant of the call
et design check --call <slug> --variant b # one of them
node check-story.mjs --tsconfig <path> --story <story-id>
```

## Delegating a sketch

Every brief names `model: opus`, and every prompt names the exact model id the sub-agent runs on,
for example "Your model id is `claude-opus-5-5`; pass `--by claude-opus-5-5` to every write
command." You know the id because you chose the model; the sub-agent does not, and must not guess.

1. **One agent per sketch.** It draws all the variants of the sketch. Give it the sketch folder, the
   fixture it must not change, and the claim of each variant. Do not spawn one agent per
   variant: each would re-read the skill, the call, the fixture and the example, about 45-57k
   tokens each, so the cost is several times higher. Calls are independent, so several calls
   can run at once, one agent each.
2. **One check-and-fix agent, after the drawing agents return.** Give it the changed files
   and the call slug. It runs the check above, fixes what it reports, and repeats until the
   check says `ok`. It may not change what a variant draws, only what stops it rendering.
3. **One write-up agent, once the user settles the sketch in Studio.** Give it the verdict in the
   user's own words and the plan file. It records what won, what lost and why, it sets each
   variant's `verdict` in an old call's `call.ts` (a product sketch needs none; the merge sets the note). It runs while you open
   the next call.

## Screenshots

**Off by default.** The user has the call open and sends you a picture when something looks
wrong. Take one only when the code cannot tell you whether two variants really differ, and
never to put in front of the user. Copy {%resource:shoot-template.mjs%} to the repository
root.

```bash
node shoot.mjs <story-id> 1100 760 out.png
```

- `waitUntil: 'networkidle'` never settles on an iframe that holds a live dev server
  connection. Use `'domcontentloaded'`.
- `:hover`, `:focus-visible` and `:active` need a CDP session and `CSS.forcePseudoState`.
  Several hold open at once, so one image shows them all. The template does this.

## Writing it down

Every settled call goes in the exploration's plan file: what won, what lost, and why. Keep
an **Open** list for the calls not yet made. A rejected variant written down stops the next
session from drawing it again. After a clear rejection, use that record to frame and draw the
next call; do not wait for the user to type “continue”.
