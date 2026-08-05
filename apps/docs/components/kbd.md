# Kbd

`et-kbd` renders a keyboard shortcut as keycaps - one cap per key, printed with the glyphs the reader's own platform uses. Writing `keys="mod+k"` gets `⌘ K` on a Mac and `Ctrl K` everywhere else, so a shortcut hint in a menu, an empty state or a help panel is correct on both without the app branching on the user agent. Import `KBD_IMPORTS`.

```ts
import { KBD_IMPORTS } from '@ethlete/components';
```

```html
<et-kbd keys="mod+k" />
```

## Live demo

<StoryEmbed id="components-kbd--default" height="420px" />

## Options

| Input      | Type                 | Default    | Description                                                 |
| ---------- | -------------------- | ---------- | ----------------------------------------------------------- |
| `keys`     | `string`             | _required_ | The chord, as keys joined by `+` - e.g. `mod+shift+k`.      |
| `platform` | `'apple' \| 'other'` | detected   | Renders this platform's glyphs instead of the detected one. |

## Write `mod`, not `meta` or `ctrl`

`mod` is the primary modifier: `⌘` on Apple platforms, `Ctrl` on every other. It is the key that makes the component worth using, and the one to reach for whenever an app binds the conventional "Command on Mac, Control on Windows" shortcut.

`meta` and `ctrl` stay distinct for the cases where the binding really is one specific key - `meta` renders `⌘` on Apple and `Meta` elsewhere, `ctrl` renders Apple's own `⌃` glyph and `Ctrl` elsewhere. Reach for them only when the shortcut is not the `mod` convention.

## Naming keys

Key names are case-insensitive and several spellings resolve to the same key, so the same string an app already uses in its shortcut config usually works unchanged:

| Key            | Also accepted            | Apple         | Other         |
| -------------- | ------------------------ | ------------- | ------------- |
| `mod`          |                          | `⌘`           | `Ctrl`        |
| `meta`         | `cmd`, `command`         | `⌘`           | `Meta`        |
| `ctrl`         | `control`                | `⌃`           | `Ctrl`        |
| `alt`          | `option`                 | `⌥`           | `Alt`         |
| `shift`        |                          | `⇧`           | `Shift`       |
| `enter`        | `return`                 | `↵`           | `Enter`       |
| `tab`          |                          | `⇥`           | `Tab`         |
| `backspace`    |                          | `⌫`           | `Backspace`   |
| `delete`       | `del`                    | `⌦`           | `Del`         |
| `esc`          | `escape`                 | `Esc`         | `Esc`         |
| `space`        | `spacebar`               | `Space`       | `Space`       |
| `up` … `right` | `arrowup` … `arrowright` | `↑ ↓ ← →`     | `↑ ↓ ← →`     |
| `pageup`       | `pgup`                   | `PgUp`        | `PgUp`        |
| `pagedown`     | `pgdn`                   | `PgDn`        | `PgDn`        |
| `home`, `end`  |                          | `Home`, `End` | `Home`, `End` |
| `plus`         |                          | `+`           | `+`           |

Anything not in the table renders as written with its first letter capitalized, so `f5` becomes `F5` and single letters are uppercased. Because `+` separates the keys, the literal plus key is spelled `plus`: `mod+plus`.

## Pinning the platform

The platform is detected from the browser once, and is `'other'` wherever there is no `navigator` - so a server render and a non-Apple client agree, and only an Apple client corrects itself on hydration.

Override it per call site with the `platform` input, or app-wide by providing `KBD_PLATFORM`:

```ts
import { KBD_PLATFORM } from '@ethlete/components';

providers: [{ provide: KBD_PLATFORM, useValue: 'apple' }];
```

Pin it when the shortcut is not the reader's to press - documentation about another platform, or a visual test that must render the same glyphs on every machine.

## In a menu

A [menu](/components/menu) item's trailing slot is `et-menu-item-shortcut`, which is a muted text slot rather than a keycap. Nest an `et-kbd` inside it when the shortcut should read as keys:

```html
<button et-menu-item>
  New file
  <et-menu-item-shortcut><et-kbd keys="mod+n" /></et-menu-item-shortcut>
</button>
```

The slot is `aria-hidden`, on the grounds that a menu item's shortcut is a hint and the binding itself is what matters - so nesting a kbd there does not add an announcement.

## Accessibility

Each key is a real `<kbd>` element, nested inside the host the way HTML nests keys within a larger input. The caps are `aria-hidden`, because a screen reader reading `⌘` announces the glyph's Unicode name rather than "Command". In their place the host carries a visually hidden, spelled-out version of the chord - `mod+alt+up` announces as "Command Option Arrow up" on Apple and "Control Alt Arrow up" elsewhere.

`et-kbd` is not interactive and never takes focus. It documents a shortcut; binding the keys is the app's job.

## Theming

Public design tokens: `--et-kbd-gap` (default `3px`, between caps), `--et-kbd-key-min-inline-size` (`18px`), `--et-kbd-key-padding-inline` (`5px`), `--et-kbd-key-border-radius` (`4px`), `--et-kbd-font-size` (`11px`), `--et-kbd-font-weight` (`500`).

All of them inherit, so setting them once on a menu, a toolbar or a help panel configures every cap inside it. The cap's own colors are not tokens: the text is `--et-surface-color-muted-solid`, the border `--et-surface-border-solid`, and the fill a `color-mix()` tint of `--et-surface-interaction-solid`, so a cap reads correctly on every registered surface and elevation without configuration. See [theming](/core/theming) for the token set.
