# Icon

Inline-SVG icons rendered by the `[etIcon]` attribute directive — no icon font, no component wrapper. Icons are tree-shakeable constants registered per component (or once at the app root) via `provideIcons()`, and the built-in set can be swapped app-wide with [`provideIconOverrides()`](#overriding-the-built-in-icons).

```ts
import { CHEVRON_ICON, ICON_IMPORTS, TIMES_ICON, provideIcons } from '@ethlete/components';

@Component({
  imports: [ICON_IMPORTS],
  providers: [provideIcons(CHEVRON_ICON, TIMES_ICON)],
  template: `
    <i class="size-6" etIcon="et-chevron"></i>
    <i class="size-6 rotate-90" etIcon="et-chevron"></i>
  `,
})
```

## Live demo

<StoryEmbed id="components-icon--default" height="320px" />

## How it works

- An icon is an `IconDefinition` — `{ name, variant?, data }` with an inline SVG string. The SDK ships a small built-in `et-*` set (`PLUS_ICON`, `CHEVRON_ICON`, `TIMES_ICON`, `ARROW_RIGHT_ICON`, `PENCIL_ICON`, …); your own icons are just more constants.
- `provideIcons(...icons)` registers them for the injector scope it's provided in. Registering the same name+variant twice throws in dev mode.
- `[etIcon]` renders the SVG via `innerHTML`, adds `aria-hidden="true"` (unless given a [`label`](#accessibility)) and the classes `et-icon et-icon--<name>`.
- `variant` selects between registered variants of the same name. When unset, a variant-less registration wins, falling back to the `'solid'` variant. With a variant set, the host also gets an `et-icon--<name>--<variant>` class.

## Sizing & color

There is deliberately **no size or color input** — the SVGs use `width/height="100%"` and `currentColor`, so both come from CSS:

```html
<i class="size-6 text-red-500" etIcon="et-times"></i>
```

Dev mode validates every registered SVG for this: it must have `xmlns`, `width/height="100%"`, and no hardcoded colors (opt out per usage with `allowHardcodedColor` for intentionally multi-colored artwork).

### Inside SDK components the size is already set

The `size-*` class above is only needed for a **standalone** icon. Every SDK component with an
icon slot sizes (and colors) the projected icon itself — pass a bare `<i etIcon="…">` and leave
the class off, otherwise you fight the component's own rule:

```html
<!-- correct: the button decides how big its icon is -->
<button et-button size="sm">Save <i etIcon="et-arrow-right"></i></button>

<!-- wrong: an explicit size overrides the size the button picked for its `size` -->
<button et-button size="sm">Save <i class="size-6" etIcon="et-arrow-right"></i></button>
```

What each slot resolves to:

| Slot                                                                       | Icon size                                          |
| -------------------------------------------------------------------------- | -------------------------------------------------- |
| [`[et-button]`](/components/button), `[et-text-button]`                    | `1em` — scales with the button's font size         |
| [`[et-icon-button]`](/components/button), `[et-fab]`                       | from the `size` input (`xs` 1.4rem → `xl` 2.8rem)  |
| [`[et-menu-item]`](/components/menu) and menu selection items              | `--et-menu-item-icon-size` (default `16px`)        |
| [`[etInputPrefix]` / `[etInputSuffix]`](/components/forms#the-field-shell) | `--et-form-field-affix-icon-size` (default `16px`) |
| Window control buttons, chip remove, select option check                   | the component's own token                          |

Form field affixes take either a text glyph (`@`, `€`, `.com`) or an icon — no size class needed
either way:

```html
<et-form-field appearance="box">
  <et-label>API key</et-label>
  <i etIcon="et-lock" etInputPrefix></i>
  <et-input [formField]="form.apiKey" />
  <i etIcon="et-check" etInputSuffix></i>
</et-form-field>
```

<StoryEmbed id="components-forms-input--icon-affixes" height="200px" />

Only a **direct** child of the affix is sized this way — an icon nested inside an affix control
(an `[et-icon-button]` suffix, say) keeps the size that control gives it.

The same holds for the built-in `et-*` icons the SDK renders as chrome — the select arrow and
clear button, the password reveal toggle, the number input steppers, the date/time picker
triggers, the calendar and scrollable chevrons. Those sizes come from the surrounding component,
so an icon you swap in via [`provideIconOverrides()`](#overriding-the-built-in-icons) needs no
sizing either.

## Typed icon names

The `etIcon` input is typed against the augmentable `EthleteIconNameRegistry` interface — augment it (or use the [generator below](#generating-icons)) to get string-literal completion for your app's icon set instead of plain `string`.

## Generating icons

Instead of hand-writing `IconDefinition`s, an Nx generator produces them from an installed SVG icon package:

```bash
yarn nx g @ethlete/components:icons
```

It reads a config file (default `src/icons.json`) listing the icons you use:

```json
{
  "variants": ["solid"],
  "icons": ["shield", "user", { "name": "star", "variants": ["solid", "light"] }]
}
```

and writes two files: the `IconDefinition` constants (default `src/generated/et-icons.ts`) — import and pass the ones each component needs to `provideIcons()` individually, so unused icons stay tree-shakeable — and a `.d.ts` that augments `EthleteIconNameRegistry` / `EthleteIconVariantRegistry` so `etIcon` names and variants are string-literal typed. Each SVG is normalized on the way in — `width/height="100%"`, `fill="currentColor"`, license comments stripped — so the output passes the dev-mode validation above.

The `source` option defaults to `'auto'`, which detects Font Awesome (pro, then free) in `node_modules`; any package with a `svgs/<variant>/<name>.svg` layout works when named explicitly. Paths are configurable via `--configPath` / `--outputPath` / `--typesOutputPath`. Re-run the generator whenever the config changes — missing icons warn and are skipped rather than failing the run. No need to remember the options you used: the header comment of both generated files (`et-icons.ts` and `et-icon-registry.d.ts`) contains the exact command to regenerate them.

## Overriding the built-in icons

Every SDK component self-registers the built-in `et-*` icons it renders (the select chevron, the picker calendar/clock, close buttons, …). To swap those for your own set — e.g. your Font Awesome icons from the [generator above](#generating-icons) — provide `provideIconOverrides()` **once** at the app root:

```ts
import { provideIconOverrides } from '@ethlete/components';
import { ET_CHEVRON, ET_TIMES } from './generated/et-icons';

bootstrapApplication(AppComponent, {
  providers: [
    // Your et-chevron / et-times now render everywhere the SDK uses them.
    provideIconOverrides({ name: 'et-chevron', data: ET_CHEVRON.data }, { name: 'et-times', data: ET_TIMES.data }),
  ],
});
```

- `name` autocompletes to the built-in set (`ET_BUILT_IN_ICON_NAMES` / the `EtBuiltInIconName` type) — you don't have to guess which names the SDK renders. Any other string still type-checks, for registering brand-new icons.
- Overrides are matched by `name` (and `variant`) and merged **on top of** each component's own `provideIcons()` — so you only list the icons you want to change; everything else keeps its built-in default.
- Because it's a separate provider, an app-root override reaches into components that self-register the same name — a plain root `provideIcons()` can't, since the component's own registration shadows it.
- Registering a name that no built-in uses simply makes that icon available to every `[etIcon]` under the same injector. Provide it lower in the tree (e.g. on a feature component) to scope the override to a subtree instead of the whole app.
- The same dev-mode SVG validation applies to override data.

## Accessibility

Icons are **decorative by default**: the directive sets `aria-hidden="true"`, because an icon almost
always sits beside the text it illustrates and announcing it again is noise. Meaning then comes from
the host — visible text next to the icon, or an `aria-label` on icon-only controls (see
[icon buttons](/components/button)).

When the icon **is** the content, give it a `label`:

```html
<!-- a lone status glyph in a table cell: nothing else says what it means -->
<i [etIcon]="'et-circle-check'" label="Verified"></i>
```

That makes the host `role="img"` with the label as its accessible name, and drops the `aria-hidden`.
Name what the icon **means**, not what it depicts — `"Verified"`, not `"checkmark"`.

Reach for it only when nothing else names the thing. Inside a button that already has an
`aria-label`, or beside visible text, a labelled icon just says everything twice.

## Error codes

Icon problems throw [`ET18xx` errors](/components/error-codes#icon-et18xx) — missing registrations and unknown names always, SVG validation in dev mode.
