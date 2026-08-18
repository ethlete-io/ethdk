# Command palette

`et-command-palette` is a dialog that searches every command an application registered, ranks them as
the reader types, and runs the one they choose. Reach for it when actions live in many places and a
reader should not have to find the right screen first. For a short list of actions attached to one
button, use a [menu](/components/menu) instead.

Commands come from a **registry**, not from a template. That is the whole point: a lazily loaded
feature area registers its own commands, and they appear in the same palette.

```ts
import { COMMAND_PALETTE_IMPORTS, injectCommandPalette, registerCommands } from '@ethlete/components';
```

## Setup

Two parts, in any order:

1. Register commands wherever they belong, with `registerCommands`.
2. Open the palette - either with `injectCommandPalette().open()`, or by adding
   `etCommandPaletteShortcut` to an element so a key chord opens it.

You never place `<et-command-palette>` in a page yourself. It is opened as a dialog.

```ts
@Component({
  selector: 'app-root',
  template: ` <div etCommandPaletteShortcut>…</div> `,
  imports: [COMMAND_PALETTE_IMPORTS],
})
export class AppComponent {
  private router = inject(Router);

  constructor() {
    registerCommands([
      { id: 'row.add', label: 'Add row', group: 'Rows', run: () => this.addRow() },
      { id: 'settings', label: 'Open settings', shortcut: 'mod+,', run: () => this.router.navigate(['/settings']) },
    ]);
  }
}
```

## Live demo

<StoryEmbed id="components-overlays-command-palette--default" height="420px" />

## Registering commands

`registerCommands(source)` is the normal route. Call it in an injection context; the commands are
removed again when the component or service that registered them is destroyed, so a lazily loaded
feature's commands leave the palette with it.

The source is either a plain array or a **signal**. A signal keeps a command's own state current
without a second registration - useful for a command that depends on a selection:

```ts
registerCommands(
  computed(() => [
    {
      id: 'row.delete',
      label: 'Delete row',
      group: 'Rows',
      disabled: !this.selectedRow(),
      run: () => this.deleteRow(),
    },
  ]),
);
```

For a registration that must outlive the component that made it, call
`injectCommandPaletteRegistry().register(source)` and keep the returned handle. It has one method,
`destroy()`, which removes the commands again.

There is one registry per application. Add `provideCommandPaletteRegistry()` to a component's
`providers` to give that subtree its own set instead.

### The command

| Field         | Type                 | Default  | Description                                                                                  |
| ------------- | -------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `id`          | `string`             | required | Identifies the command. Registering a second command with the same id replaces the first.    |
| `label`       | `string`             | required | What the row reads, and what the query is matched against.                                   |
| `run`         | `() => void`         | required | Run when the row is chosen. The palette closes first, so this may open another overlay.      |
| `group`       | `string`             | -        | Heading the command is listed under. Commands without one are listed before any group.       |
| `description` | `string`             | -        | A second line on the row. Not matched against the query.                                     |
| `keywords`    | `string[]`           | -        | Extra words the query matches, for names a reader searches by but the label does not use.    |
| `icon`        | `RegisteredIconName` | -        | Rendered before the label. The name must be registered in the application.                   |
| `shortcut`    | `string`             | -        | Printed on the row as keycaps, in `et-kbd` syntax. The palette only displays it - see below. |
| `disabled`    | `boolean`            | `false`  | The command is listed, but cannot be run and is skipped by the arrow keys.                   |
| `priority`    | `number`             | `0`      | Orders commands that match the query equally well, highest first.                            |

A command's `shortcut` is **display only**. The palette prints it so a reader can learn it; binding it
is the application's job. That keeps one command from silently claiming a key another feature needs.

## How the ranking works

The palette matches a query as a **subsequence**, so `ct` finds `Create table` and `ous` finds
`Open user settings`. Each match is scored, and the matched characters are marked in the row.

What the score rewards, in order of weight:

- An unbroken run of characters, growing with the length of the run. This is what puts an exact
  substring first: on `user`, `Add user` outranks `Unset serial`.
- A character at the start of the label or of a word, including a `camelCase` hump and a digit after a
  letter. So `h1` marks the `H` and the `1` of `Heading 1 style`.
- A match that also agrees in case.

Gaps between matched characters cost, and so does distance from the start of the label.

A `keywords` match scores like a label match, less a fixed penalty, so an exact keyword hit can still
beat a weak hit on a label. When only a keyword matched there is nothing in the label to mark, and the
row renders unmarked.

Equal scores are broken by `priority`, then by the shorter label, then alphabetically, so the same
query always produces the same order. An empty query keeps every command, ordered by `priority` and
otherwise in the order it was registered.

## The keyboard shortcut

`etCommandPaletteShortcut` opens the palette on a key chord, and closes it again on the same chord. It
listens on the document, so put it on the application's root component - not on the element a reader
must focus first.

```html
<div etCommandPaletteShortcut>…</div>
<div etCommandPaletteShortcut="mod+shift+p">…</div>
```

| Input                      | Type     | Default   | Description                    |
| -------------------------- | -------- | --------- | ------------------------------ |
| `etCommandPaletteShortcut` | `string` | `'mod+k'` | The chord, in `et-kbd` syntax. |

It is opt-in on purpose. Nothing in this library takes a global key without being asked.

`mod` resolves to Command on Apple platforms and Control everywhere else, so one chord suits both -
and [`et-kbd`](/components/kbd) prints it with the right glyph. The chord is matched on the physical
key rather than on `event.key`, because on macOS the Option modifier rewrites `event.key` to the
layout's alternate glyph.

The same matching is available on its own, for a chord of your own:

```ts
matchesKbdChord(event, { keys: 'mod+k', platform: inject(KBD_PLATFORM) });
```

## Opening it yourself

```ts
private palette = injectCommandPalette();

protected openPalette() {
  this.palette.open();
}
```

`open()` returns the [overlay ref](/components/overlays), so you can react to the close. The palette is
defined as a centered dialog by `COMMAND_PALETTE_OVERLAY`; it is held near the top of the viewport
rather than in the middle, because the list grows downwards as the reader types.

## Options

On `et-command-palette` itself, forwarded to the `[etCommandPalette]` behavior:

| Input        | Type      | Default | Description                                                         |
| ------------ | --------- | ------- | ------------------------------------------------------------------- |
| `query`      | `string`  | `''`    | What the reader typed. Two-way, so a consumer can seed or clear it. |
| `closeOnRun` | `boolean` | `true`  | Whether choosing a command closes the palette.                      |

## Labels

Every string the palette renders itself is localizable, English and German built in:

```ts
provideCommandPaletteLabels({ placeholder: 'Rechercher une commande…' });
```

| Label         | English default         | Shown when                                 |
| ------------- | ----------------------- | ------------------------------------------ |
| `placeholder` | `Search for a command…` | Always, in the empty search field.         |
| `searchLabel` | `Search for a command`  | Accessible name of the field and the list. |
| `empty`       | `No matching command`   | The query matched nothing.                 |
| `noCommands`  | `No commands available` | Nothing is registered at all.              |

See [localization](/components/localization) for how the label systems fit together.

## Accessibility

The search field is the only focusable element. It is a `combobox` with `aria-autocomplete="list"`,
pointed at the result list by `aria-controls`, and at the row that Enter would run by
`aria-activedescendant`. The list is a `listbox`, each heading labels a `group`, and each row is an
`option` carrying `aria-selected` and, when disabled, `aria-disabled`.

Rows are deliberately **not** focusable. Focus stays in the field so a reader can keep typing, which
is what `aria-activedescendant` exists for. Pointing at a row marks it active without moving focus.

| Key            | Action                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| `ArrowDown`    | Moves to the next row, wrapping at the end. Skips disabled rows.                    |
| `ArrowUp`      | Moves to the previous row, wrapping at the start.                                   |
| `Home` / `End` | First or last row - once the query is empty, so text editing keeps them until then. |
| `Enter`        | Runs the active row.                                                                |
| `Escape`       | Clears the query, or closes the palette when the query is already empty.            |

The active row is scrolled into view as the arrow keys reach it.

`ET4800` is thrown in dev mode when the search field is placed outside a palette, and `ET4801` when the
shortcut is given a chord of modifiers with no key, which could never fire.

## Theming

Colors resolve from the app-registered surface and color themes - the palette hardcodes none. The
panel paints the overlay's own surface elevation, and re-applies the color context from wherever it was
opened, since an overlay pane does not inherit it through the DOM. A matched run of characters is drawn
in `--et-theme-color-ink-solid`. See [theming](/core/theming).

| Token                                      | Default | Applies to                              |
| ------------------------------------------ | ------- | --------------------------------------- |
| `--et-command-palette-max-height`          | `60vh`  | The panel.                              |
| `--et-command-palette-padding`             | `8px`   | Around the result list.                 |
| `--et-command-palette-search-height`       | `48px`  | The search field.                       |
| `--et-command-palette-search-font-size`    | `15px`  | The search field.                       |
| `--et-command-palette-item-font-size`      | `14px`  | A row's label.                          |
| `--et-command-palette-item-height`         | `40px`  | A row's minimum height.                 |
| `--et-command-palette-item-padding-inline` | `10px`  | A row, and the group headings.          |
| `--et-command-palette-item-gap`            | `10px`  | Between a row's icon, text and keycaps. |
| `--et-command-palette-item-border-radius`  | `6px`   | A row.                                  |
| `--et-command-palette-item-icon-size`      | `16px`  | A row's icon.                           |

## Error codes

The command palette uses the `ET48xx` range - see
[error codes](/components/error-codes#command-palette-et48xx).
