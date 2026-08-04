# Button

`[et-button]` is a behavior layer for `<button>` and `<a>` elements: it normalizes the disabled state across both tags, keeps the `type` attribute honest, and adds a toggle (`pressed`) state. It ships no visual design - the look is yours.

::: warning Superseded by @ethlete/components
New code should use the [components button](/components/button) (`BUTTON_IMPORTS`). `ButtonComponent` and
`ButtonDirective` keep their names, but the successor is a real button system: `variant`, `size` and `color`
inputs wired into the [surface and color theming](/core/theming) systems instead of CSS-only classes, plus
`loading`, icon buttons, FABs and text buttons. `disabled`, `type` and `pressed` carry over. For
`[et-query-button]` there is no direct successor - bind the query to the button's `loading` input, see
[Query button](#query-button) below. This page documents the CDK version, which still receives bug fixes.
:::

```html
<button et-button>Save</button>

<a [routerLink]="['/somewhere']" et-button>Go somewhere</a>
```

```ts
import { ButtonImports } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-buttons-button--default" height="160px" />

## Options

| Input      | Default    | Purpose                                                                      |
| ---------- | ---------- | ---------------------------------------------------------------------------- |
| `disabled` | `false`    | Sets both `disabled` and `aria-disabled`; on an `<a>`, also `tabindex="-1"`. |
| `type`     | `'button'` | `'button' \| 'submit' \| 'reset' \| 'menu'`. Only applied on a `<button>`.   |
| `pressed`  | `false`    | Toggle state: sets `aria-pressed` and the `et-pressed` class.                |

The directive reads the host tag once at construction and binds accordingly, so an anchor never gets a `type` attribute and a button never gets a `tabindex`. That is the whole point of `type` defaulting to `'button'`: an unadorned `<button>` inside a form submits it, and this default stops that from happening by accident.

`pressed` is for toggle buttons - a filter that is on, a "favorite" that is set. Because it renders `aria-pressed`, use it only where the button really toggles something; for a button that navigates or submits, leave it alone.

## Headless

`ButtonDirective` has no selector of its own - it is meant to be composed as a `hostDirective`, which is how `[et-button]` and `[et-query-button]` are built. Use it to give a component of your own the same behavior without inheriting the CDK's markup:

```ts
@Component({
  selector: '[my-fancy-button]',
  hostDirectives: [{ directive: ButtonDirective, inputs: ['disabled', 'type', 'pressed'] }],
  template: '<ng-content />',
})
export class MyFancyButtonComponent {}
```

It also exposes `disabled$` and `type$` observables, and `exportAs: 'etButton'` for template references.

## Query button

`[et-query-button]` extends the button with `@ethlete/query` lifecycle state - loading, success and failure flashes, and disabling to prevent double submits. It is documented on the [Query error & button](/cdk/query-error#query-button) page.

## Accessibility

Disabled is expressed as both the native `disabled` attribute and `aria-disabled`. That matters for the anchor case, where `disabled` means nothing to the browser: the directive adds `tabindex="-1"` so a disabled link leaves the tab order, but it does **not** intercept clicks or navigation - handle that yourself, or use a `<button>` when the control isn't really a link.

Everything else stays native. The element keeps its own role, keyboard activation and focus behavior, because it _is_ a real `<button>` or `<a>` - there is no `role="button"` on a `<div>` anywhere in this component.

## Styling

The CDK button ships no visual styles at all - its stylesheet is empty by design, and the [global stylesheet](/cdk/#styles) adds nothing for it either. Style against `et-button` (with `et-pressed` for the toggle state) and the two wrapper elements it renders, `et-button-content` and `et-button-text`, which exist so you can lay out an icon next to the label without touching the projected content.
