# Design exploration: products, sketches and rounds

### Create a product

```bash
et design product new <name> [--base @ethlete/components|<path>] [--from-project <name>]
```

It writes the `config.json` entry and the empty layer folders. A product on `@ethlete/components`
takes the SDK as its base, so its parts start from the real components rendered with `ng()`.
Without a base it gets the presets phone (390x844) and desktop (1440x900). A product's own `presets`
replace its base's whole: a desktop-only app lists `desktop` alone and draws no phone state. `--from-project` copies
`styles`, `head`, `providers` and `themes` from an old project entry. Studio never writes
`config.json`; the command does.

Every frame loads the product's tokens stylesheets once, before the part's own `styles`, so a part
never imports the tokens and never adds them to its `styles`. The product's config `tokens` lists
those parts in load order (`["foundations/tokens"]` when left out); a listed part that does not
exist yet is skipped. A product's own copy of a listed part, or a sketch of it, replaces the base's
in every frame. Never list a `tokens.css` in config `styles`.

A part file default-exports its `definePart(...)` and may also export named helpers, such as a piece of its
markup: `import { studioMark } from '@system/foundations/logo'`. Import a piece from the part that draws it;
never copy its markup into another part. A piece that uses the part's classes needs its stylesheet too
(`@system/foundations/logo.css?inline`), or from the part's default export when the part sets
`definePart({ styles })`: every drawing of that part gets it, so `render` returns only extra styles, or `drawing({ body })` with none. The layer
rules hold for these imports as well.

A component a host embeds exports its markup as such a helper, and a wrapper only its own frame needs, such as
padding that makes room for a focus ring, goes in `render` alone, never in that helper: the host places the
component itself and would inherit the wrapper's offset.

A product whose app uses Tailwind lists one stylesheet in config `styles` that imports the app's styles and
registers the drawing folders with `@source './'`. Sketches then use the app's utilities; plain CSS stays for what
utilities cannot express, such as camera geometry.

### Propose a change as a sketch

A change to a part, or a new part, is a **sketch**: the question is the part, the variants are the
answers. Variants are drawn at the same geometry, and one variant wins only against the others.

```bash
et design sketch new <layer>/<name> --variants a,b --by <model id> [--like <layer>/<name>] [--variant-note a=<text>]… [--product <p>]   # each variant starts as a copy of the part
et design sketch new <layer>/<name> <layer>/<name>… --variants a --by <model id>   # one change across several parts: one sketch, one ready, one merge
et design sketch target add <layer>/<name> <layer>/<name> --by <model id>   # add a part to an open sketch's targets, seeded into each variant
et design sketch report <layer>/<name> --variant b --by <model id> "phone"         # tell Studio what you build now
et design sketch report <layer>/<name> --variant b --by <model id> --done         # you stopped drawing b; Studio shows its frames
et design sketch check [<layer>/<name>] [--fix]                                    # each variant laid over the product
et design sketch ready <layer>/<name> --by <model id>                              # now the user can pick
et design sketch reject <layer>/<name> --variant b [--reason <text>] --by <model id> # only when the user rejected b; no pick or merge until reopened
et design sketch reopen <layer>/<name> --variant b [--reason <text>] --by <model id> # only when the user takes b back; the rejection stays in the history
```

One change across several parts (an alias removal, a token rename) is one sketch with several targets: each
variant holds every target, and `ready` compares them all. `ready` and `preview` also name every part a `shared/`
edit reaches.

Variants are alternatives. A variant never stands for a state of another variant: a hidden or
collapsed mode of variant d is a further state of d, not a variant e. Before you draw a new control,
look for a control that already does the job (an active rail button that toggles its panel), and
draw that first.

A section of an app is a page under `pages/`, never a state of the shell. An element holds its
own chrome only. A sketch on an element adds no state whose difference is page content in a slot.

A variant mirrors the product layout and holds only the parts it changes. Draw two to four
variants, each with what it costs, and run `sketch check` before `ready`. A variant with problems
cannot be picked. A part in a variant keeps every state the part has in the product: `sketch check`
and `sketch ready` fail on a dropped state, and warn when two stylesheets of one part define the same class. A problem the product already had prints as `NOTE (was there before)` and fails
neither. Use `sketch list` to see the open ones.
`sketch check` also runs tsc over each variant with its `@shared/` and `@system/` imports, so never write a
tsconfig of your own. It warns of a variant stylesheet that restyles a class of `shared/`, of a
variant file nothing imports, and of a `shared/` export the variant does not import; `design check` warns of
an export in a merged part's `shared/` that nothing imports, and (`STALE-REPLACE`) of a `.replace('<…')` or
`.replace(/<…/)` on markup that neither the part nor a part it uses draws. To delete a file of a part, delete it in the variant: a merge deletes the
product file the picked variant no longer holds.

Each variant's note, what it is and what it costs, goes in with `sketch new --variant-note a=<text>`, once
per variant: `sketch.json` keeps it apart from the part's `definePart({ note })`, and Studio shows it in the
variant's head. A merge keeps the part's note, takes its `--note`, or gives a new part the picked variant's note.
`sketch new` and `sketch variant` write their files in the checkout's Prettier format; after an edit,
`sketch check --fix` formats the variants before it checks them. A sketch command
without `--product` takes the product that holds the sketch.

Start a new part from a close one with `--like`: `sketch new pages/inbox --like pages/system`
copies the product's `pages/system` into each variant, renamed to the target and without its
`madeBy`; `--like pages/system:b` copies variant b of the open sketch on it, with that sketch's
`shared/` folder.

Rendering for one variant lives in that variant's files. `shared/` holds only code every variant
uses: do not give a shared helper a parameter, branch, import or style rule that only one variant, or
a variant you dropped, needs. A merge takes `shared/` whole, so what stays there ships with the pick.

Code the variants of one sketch have in common (sample data, a switch, a helper) goes in the
sketch's `shared/` folder, next to the variant folders, never into copies per variant. A part in a
variant imports it as `@shared/<path>`, and a shared file may import `@system/...` and
`@shared/...`. A part outside a sketch may not import `@shared/`. A variant that needs a shared file
changed holds its own copy at `<variant>/shared/<path>`; `@shared/<path>` finds that copy first, and a merge
of that variant takes it. On a merge, `shared/` moves into
the target's folder as `shared/` with its imports made relative; when no part imports it, it is
dropped. With several targets, each takes only the files it imports, directly or through another
shared file; a file nobody imports goes back to the target that held it, and the merge refuses one no
target held. `sketch new` refuses targets whose `shared/` folders hold one path with different contents. Only the target may import it: a merge refuses while another part of the picked variant
does, so move that code into the part. `sketch new` prints each file it puts in `shared/`, for example
the `shared/` folder of a merged page: edit it there, as part of the sketch, not in a variant copy.

```ts
// sketches/pages-flows/shared/flow-data.ts
export const flows = [{ name: 'Checkout', steps: 4 }];

// sketches/pages-flows/a/pages/flows/flows.ts
import { flows } from '@shared/flow-data';
```

An asset (a mark, logo, icon, picture or font) is one file in `.ethlete/design/<product>/assets/`,
never a copy inlined into parts. A part imports it as `@assets/<file>`: the default import is a URL
for `<img src>`; an SVG that must follow tokens (`currentColor`, `var(--accent)`) imports with
`?raw` and goes inline, for example `@assets/icons/<name>.svg?raw`. A stylesheet, the product's
`styles.css` or a part's, uses `url('@assets/<file>')`, for example in an `@font-face`. A foundation
part may wrap an asset in a named export. A product finds its base product's assets too. A sketch
variant adds or changes an asset in its own `<variant>/assets/` folder (`sketch new` and `sketch variant`
print it next to the part file), and a merge copies it into the product's. Size an inline SVG with
`svgAsset(mark, { size: 32 })` from `@design-system`, never by replacing its `width`/`height` as a
string; `class` and `attrs` (`{ 'aria-hidden': 'true' }`) set the rest of the root's attributes. `design check` fails an SVG asset with no root `<svg>` or without
`xmlns="http://www.w3.org/2000/svg"` (an `<img src>` and an image viewer do not draw it). The part hash behind `design check` and "changed outside a sketch" counts the bytes of
the assets a part uses.

Every change to a merged part goes through a sketch, also a small one: new copy, sample data, an
added state. When there is nothing to choose, the sketch has one variant (`--variants a`), and the
user merges it or comments on it. Never edit a merged part directly, or the user cannot compare or
comment on the change in Studio. `design check` warns, and Studio marks the part "changed", when a
merged part changed outside a sketch; only a merged sketch on that part clears it.

A sketch on a foundations part such as `foundations/tokens` keeps the part's overview drawing: the
variant adds its token group as a state, or extends that group's state. It never replaces the
drawing with a demo scene, since the merge would drop every other group. A demo may be an extra state.

Name the variant you work on with `--variant`. Studio marks it as drawing, and hides its frames,
while the latest report names it. `sketch new` starts no report, so `report --done` follows only a report
of your own; it prints the next steps. `sketch new`, `sketch variant` and each report record your
model id as an author of the variants they write, and `sketch ready` records it on every variant
that has no author yet. A merge adds the picked variant's authors to the `madeBy` the part file
already holds, and never removes it.

### Combine variants in a new round

Studio never combines variants. When the user asks for one in a comment ("solid like a, outline
like b"), draw it as a new variant in a new round:

```bash
et design sketch variant <layer>/<name> c --from a --by <model id> --round "Solid a, outline b" --note "r1 showed pill and square; the user wants a's solid with b's outline"
```

`--from` copies a variant into the new one, sets the sketch back to in progress and clears the
pick; it refuses while the decision is a discard (the user picks a variant first). Without `--round` the new variant joins the running round; with it, `--note` is required and
goes on the running round: what it showed and why its variants lost. Older variants stay pickable.
The command prints the notes of the previous round. Fix a round's title or note later with `sketch round <layer>/<name> <round> --title … --note … --by <model id>`; `sketch list` shows each sketch's rounds.
Letters continue across rounds (r1: a, b; r2: c, d). `sketch variant <layer>/<name> c,d --from a` adds
several variants at once; with `--round` they all start the new round. A new round answers the comments on the
`--from` variant and marks them "addressed in round" with the new round's key. A variant without `--round` fails while the sketch has open comments and lists them: a variant that answers a comment starts a new round. Draw the combined
variant and mark the sketch `ready` again. `sketch new --round <title> --note <text>` names
round 1 and sets its note; `--round` without `--note` fails. `sketch ready` refuses while the running round has no note; set it with `sketch round`.
`sketch ready` also shoots every state of every variant and of the product's part: when not one pixel differs
in any of them, it merges the sketch itself and logs it as an `auto` entry in the product's `accepted.json`
("No visible change in any state: merged automatically."). Any difference or failed shot leaves it `ready`.
A problem the product already had before the merge does not block it (the check prints it as a note); only a problem the merge adds does.
Run `sketch ready` again on a `ready` sketch to repeat the check and the auto merge.

Mark a sketch `ready` only when no change to it waits on anything: no open decision, no helper still to
land, no "once X is decided I adapt the sketch". A pending change keeps the sketch in work and out of the
merge queue: ask first, make the change, then mark it `ready`. Record the wait with
`et design sketch hold <layer>/<name> --until "<what it waits on>" --by <model id>` (a `ready` sketch goes back
in progress) and `sketch release` it once the change is in.

### Your model id: `--by`

Every command that writes takes `--by <model id>` and fails without it: `sketch new`, `variant`, `report`,
`ready`, `rebase`, `merge`, `discard`, `inbox done` and `comment reply`. The id is the exact model
id as free text, for example `claude-opus-5-5`, `gpt-6.1-sol` or `gemini-3-argon`. Studio shows it
on the variant, the reply and the part, so the user sees which model made what.

**Never guess your id.** Use the one your prompt names. If your prompt names none and you do not
know your own exact id, ask the coordinator or the user before you write.

### The user decides, Studio merges

The user picks a variant, or discards the sketch, in Studio. **Studio merges on the user's click.
Never run `sketch merge` or `sketch discard` yourself, and never pick a variant.** Both mark
the open comments on the sketch's variants addressed: the user's click answers them. Comments on the
product's parts stay. If a part the variant replaces changed
in the product since the sketch was created, the merge refuses: bring each variant up to date, run
`et design sketch rebase <layer>/<name>`, and mark it `ready` again. `sketch preview <layer>/<name>
<variant>` lists the elements and pages a merge changes. The note on a part records why it has its
current shape. The user's reason is optional: with one, the merge sets the note from it; without
one, the part keeps the `note` the picked variant file holds, so write that note while you draw.

After the user approves a direct edit of a merged part (no sketch), run `et design accept <layer>/<name> --product <p> --by <model id> --note <why>` so `design check` stops warning `changed outside a sketch`. Never accept an edit the user did not approve.

To drop a merged part the user no longer wants (folded back into its host, say), run `et design part remove <layer>/<name> --product <p> --by <model id>`: it deletes the folder, its `merged.json` entry and its tsconfig path, and resolves its comments. It refuses while another part imports it or an open sketch targets it. Never `git rm` a part by hand.
