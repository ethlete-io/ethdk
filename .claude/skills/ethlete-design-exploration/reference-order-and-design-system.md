# Design exploration: the order of a design and drawing from the design system

## The order of a design

A product design runs in this order. Each stage settles in calls before the next starts, and
each stage draws with what the stages before it settled (the wireframes draw with the kit only):

1. **Wireframes**: early, rough concepts of the main flows (a legacy call with `mode: 'wireframe'`;
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

2. **Foundations**: colours, colour themes and surface themes (the project's `themes` in
   `config.json`), plus the type scale, spacing and radius.
3. **Logo and CI**, if the project needs them.
4. **Components**, the inventory is their queue, from the SDK ones rendered with `ng()`, themed and set up for the project.
   Each accepted one becomes a design-system entry.
5. **Larger elements**: the shell, the navigation, headers, lists, built from the entries.
6. **Pages**, built from the elements and the entries.
7. **The working prototype**: the pages joined with `ngStates` and `flow.on`.

Do not start a stage before the one above it is settled, and do not draw a page from parts that
are not in the design system. If the user asks for a later stage first, say which earlier stage
is missing, and draw that first.

The stages map onto the layers of a product: wireframes, foundations, components, elements, pages. A settled
Legacy call with a stage counts for that stage in this order.

A later stage can show that an earlier one is incomplete. If a page needs a part that the system
does not have, add it to the inventory. A part becomes a component only when at least two hosts
draw the same case. Until then it stays in the one element or page that draws it. When a second
host draws it, open a component sketch, and list in its brief every host and every case each one
draws, so the component covers them all.

A component documents its states per axis, not every combination: for example kind, end mark and
interaction (rest, hover, focus-visible, selected, inert), plus only the combinations that look
different. A smaller piece with no states of its own, such as an icon set, is a foundation asset,
not a component.

When each of several cases is drawn at rest and in the same interactions, build the states and their grid with
`interactionRows(rows, { interactions: ['hover', 'active'], force: (props, interaction) => ({ ...props, interaction }) })`
from `@design-system` and spread the result into `definePart`; never write those states and the grid by hand.
`sketch check` prints `grid <rows> x <columns> ok`, or the states the grid leaves out; a state in two cells
fails it as `GRID`, in `design check` too.
Interaction states (a state name whose last word is hover, focus, pressed, active or selected, such as `row-hover`) live only on a control
part, one whose `controls` declare a control of a checked kind. On a shell, element or page they fail as
`CONTROL-STATE`: declare the component's controls (Q164), or extract the button or row as its own control part and draw its states there.
A drawn `button`, `a[href]`, `input`, `select`, `textarea` or control role without `data-et-control` on it or around
it is `CONTROL-PART-INPUT`: no control check sees it. Wrap it in `control(markup, name)` from
`@ethlete/components/design/control` and declare the name in `controls`; a sketch fails on one it adds,
`design check` only warns of one a merged part already draws. On a reused control part's render,
`control(drawn.body, name)` renames its control: never string-replace `data-et-control`.
`definePart({ interactions })` forces an interaction on the part's root only. To draw one element of the part
hovered, focused, pressed or disabled, such as one row of a list, wrap that element's markup in
`forceInteraction(markup, 'hover')` from `@design-system` inside `render`, driven by a prop; never write
`data-et-force` by hand.

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

**Colours come from the two SDK theming systems, never from tokens of your own.** A raised or
floating area sets a surface scope (`data-et-surface` or a surface scope class) and takes its
background, text, border and interaction states from the `et-surface` tokens of that scope. An
accent, a warning or a danger colour comes from the SDK colour theming (`--et-theme-color-*` under a
colour theme scope). Foundations define only the inputs of these themes. Never add a tier class
(`bg-surface-raised`), an accent utility or a `var(--accent)` to a part or to the product
stylesheet. Give a raised or floating area `data-et-auto-surface` and an interactive one
`data-et-surface-interactive`, never a picked `et-surface--<name>` class: the frame resolves them by elevation like
`etAutoSurface` and `etSurfaceInteractive`. Give a warning, error or success accent
`data-et-semantic-color="<type>"`, never a picked `et-color--<name>` class: the frame resolves it by type like
`injectSemanticColorTheme`. Read the theming skill of the SDK before the first colour in a drawing. `et design check` reports
a denied class from the product's `deniedClasses` list in `config.json`.

A part is one folder, `<product>/<layer>/<part>/`, with its drawing and states. Read the parts of
the product before the first drawing of a session. **A part exists only because the user picked a
sketch.** A `chosen` verdict in an old call is not enough. Never change a part's look without a
sketch the user decided.
