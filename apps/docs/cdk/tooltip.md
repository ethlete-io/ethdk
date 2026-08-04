# Tooltip

`[etTooltip]` attaches a hover/focus-triggered label to any element, positioned with [floating-ui](https://floating-ui.com/) and announced to screen readers via `aria-describedby`.

::: warning Superseded by @ethlete/components
New code should use the [components tooltip](/components/tooltip) (`TOOLTIP_IMPORTS`). `etTooltip` and
`placement` are unchanged; `tooltipAriaDescription` becomes `etTooltipAriaDescription`. The global
`provideTooltipConfig()` / `TOOLTIP_CONFIG` layer is gone - configure each tooltip through its own inputs -
and the arrow and surface come from the [theming systems](/core/theming) instead of hardcoded CSS. This
page documents the CDK version, which still receives bug fixes.
:::

```html
<button etTooltip="Delete this item" type="button">
  <i etIcon="et-times"></i>
</button>
```

```ts
import { TooltipImports } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-overlay-tooltip--default" height="320px" />

## Options

| Input                    | Default    | Purpose                                                                                                                       |
| ------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `etTooltip`              | `null`     | The content: a plain string, or a `TemplateRef` for rich markup. `null` detaches the tooltip entirely.                        |
| `tooltipAriaDescription` | `null`     | Text for `aria-describedby` - required when the content is a template.                                                        |
| `placement`              | `'bottom'` | Any floating-ui [placement](https://floating-ui.com/docs/computePosition#placement). Flips automatically when it doesn't fit. |

## Templates

Pass a `TemplateRef` for anything richer than a sentence. Because a template has no text the accessibility layer can read, give it `tooltipAriaDescription` as well:

```html
<p [etTooltip]="tooltipTpl" tooltipAriaDescription="Ranked by total points">Ranking</p>

<ng-template #tooltipTpl>
  <strong>How this is ranked</strong>
  <p>Total points across all matches…</p>
</ng-template>
```

## Global configuration

`provideTooltipConfig()` sets the defaults for an injector scope - the app root, a feature route, or a single component:

```ts
providers: [provideTooltipConfig({ placement: 'top', offset: 12 })],
```

| Option            | Default    | Purpose                                                           |
| ----------------- | ---------- | ----------------------------------------------------------------- |
| `placement`       | `'bottom'` | Preferred side.                                                   |
| `offset`          | `8`        | Distance from the trigger, in px (or a floating-ui offset).       |
| `arrowPadding`    | `8`        | Keeps the arrow away from the container's rounded corners.        |
| `viewportPadding` | `8`        | Minimum gap to the viewport edge before flipping.                 |
| `containerClass`  | -          | Extra class(es) on the tooltip container.                         |
| `customAnimated`  | `false`    | Drop the default enter/leave animation - see [Styling](#styling). |

Only `placement` is also a per-instance input; everything else is config-level.

## Behavior

- **Hover** opens after a 300ms delay. Pressing the mouse down during that delay cancels it, so clicking a button never flashes its tooltip.
- **Focus** opens immediately, but only for _visible_ focus - a click that focuses the button does not open the tooltip, keyboard tabbing does.
- Hover and focus are tracked separately: the tooltip stays while either is active, and closes when both are gone.
- <kbd>Escape</kbd> closes it.
- It closes automatically when the trigger scrolls out of view.

## Accessibility

The tooltip element itself is `aria-hidden` - it is never read as a live region. Instead, the trigger is wired up with Angular CDK's `AriaDescriber`, which points `aria-describedby` at an off-screen copy of the text. That way the description reaches screen readers whether or not the tooltip is visible, and the visual tooltip stays purely visual.

The description comes from `tooltipAriaDescription`, falling back to `etTooltip` when it is a plain string. **A template-only tooltip with no `tooltipAriaDescription` is invisible to screen readers** - always pass one.

Never put interactive content in a tooltip: it can't be reached by hover, and it disappears on blur. Use a [toggletip](/cdk/toggletip) instead.

## Styling

The structural styles ship in the CDK's [global stylesheet](/cdk/#styles). Style against `et-tooltip`. The container also gets any `containerClass` from the config, and `et-with-default-animation` unless `customAnimated` is set - clear that flag when you want to drive the enter/leave transition yourself through the [animation classes](/core/animations).
