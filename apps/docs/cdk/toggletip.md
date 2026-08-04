# Toggletip

Like a [tooltip](/cdk/tooltip), but click-triggered and explicitly controlled - so it can hold interactive content. Use it for "what does this mean?" popovers, inline help and small forms hanging off a button.

::: warning Superseded by @ethlete/components
New code should use the [components toggletip](/components/toggletip) (`TOGGLETIP_IMPORTS`). The roles
split: `etToggletip` now carries the _content_ and the separate `[etToggletipTrigger]` marks the trigger,
instead of one directive owning both plus a `showToggletip` boolean. `ToggletipCloseDirective` keeps its
name. The global `provideToggletipConfig()` / `TOGGLETIP_CONFIG` layer is gone - configure each toggletip
through its own inputs - and the arrow and surface come from the [theming systems](/core/theming). This
page documents the CDK version, which still receives bug fixes.
:::

```html
<button
  [showToggletip]="isOpen"
  (click)="isOpen = !isOpen"
  (toggletipClose)="isOpen = false"
  type="button"
  etToggletip="Points are awarded per match win."
>
  <i etIcon="et-chevron"></i>
</button>
```

```ts
import { ToggletipImports } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-overlay-toggletip--default" height="320px" />

## You own the open state

Unlike the tooltip, the toggletip has no built-in trigger handling: `showToggletip` opens and closes it, and you set that from a click. The `toggletipClose` output fires whenever the toggletip closes itself - <kbd>Escape</kbd>, an outside click, or the close directive - and you must write `false` back to your state there, or the next click will toggle the wrong way.

## Options

| Input           | Default    | Purpose                                                                              |
| --------------- | ---------- | ------------------------------------------------------------------------------------ |
| `etToggletip`   | `null`     | The content: a plain string, or a `TemplateRef` for rich, interactive markup.        |
| `showToggletip` | `false`    | Open state. Mounting/unmounting happens on the next frame after this changes.        |
| `placement`     | `'bottom'` | Any floating-ui [placement](https://floating-ui.com/docs/computePosition#placement). |

| Output           | Fires when                                          |
| ---------------- | --------------------------------------------------- |
| `toggletipClose` | The toggletip has finished closing, for any reason. |

## Interactive content

The reason to reach for a toggletip over a tooltip: the content stays put while the pointer moves into it, so it can contain links, buttons and inputs.

```html
<button
  [showToggletip]="isOpen"
  [etToggletip]="helpTpl"
  (click)="isOpen = !isOpen"
  (toggletipClose)="isOpen = false"
  type="button"
>
  Help
</button>

<ng-template #helpTpl>
  <p>Points are awarded per match win.</p>
  <a routerLink="/rules">Read the full rules</a>
  <button etToggletipClose type="button">Close</button>
</ng-template>
```

`[etToggletipClose]` (also `[et-toggletip-close]`) closes the toggletip from inside its own content - it resolves the owning toggletip through DI, so it needs no wiring.

## Global configuration

`provideToggletipConfig()` sets defaults for an injector scope:

```ts
providers: [provideToggletipConfig({ placement: 'top', offset: 12 })],
```

| Option            | Default    | Purpose                                                     |
| ----------------- | ---------- | ----------------------------------------------------------- |
| `placement`       | `'bottom'` | Preferred side.                                             |
| `offset`          | `8`        | Distance from the trigger, in px (or a floating-ui offset). |
| `arrowPadding`    | `8`        | Keeps the arrow away from the container's rounded corners.  |
| `viewportPadding` | `8`        | Minimum gap to the viewport edge before flipping.           |
| `containerClass`  | -          | Extra class(es) on the toggletip container.                 |
| `customAnimated`  | `false`    | Drop the default enter/leave animation.                     |

## Behavior

While open, the toggletip listens for <kbd>Escape</kbd> and for clicks anywhere outside its own container - both unmount it and emit `toggletipClose`. It also closes automatically when the trigger scrolls out of view. The listeners exist only while it is mounted, so a page full of closed toggletips costs nothing.

Note that the outside-click listener also fires for a click on the trigger itself, which is what makes a second click on the trigger close it rather than reopen it.

## Accessibility

<kbd>Escape</kbd> closes the toggletip from anywhere, which is the escape hatch keyboard users expect from a popover. Beyond that, the CDK toggletip does not manage focus or wire ARIA between trigger and panel: it does not trap focus, move focus into the content on open, or restore it on close.

For content that needs any of that - a form, a menu, anything a keyboard user must reach - either add the wiring yourself (`aria-expanded` and `aria-controls` on the trigger, focus management on open/close) or reach for a [menu](/cdk/menu) or an [overlay](/cdk/overlays), which handle it. The successor in `@ethlete/components` closes this gap.

## Styling

The structural styles ship in the CDK's [global stylesheet](/cdk/#styles). Style against `et-toggletip`, plus any `containerClass` from the config and `et-with-default-animation` unless `customAnimated` is set - clear that flag to drive the enter/leave transition yourself through the [animation classes](/core/animations).
