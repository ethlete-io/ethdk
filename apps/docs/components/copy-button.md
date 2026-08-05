# Copy button

`etCopyButton` copies a value to the clipboard on click and ticks a `copied()` signal for a short delay - the icon-swap feedback pattern every copy-to-clipboard control wants, as a directive rather than a fixed component. It carries no template or styling of its own; compose it onto `et-icon-button`, `et-button`, or a plain native button, and swap the content off `copied()`. Import `COPY_BUTTON_IMPORTS`.

```ts
import { COPY_BUTTON_IMPORTS } from '@ethlete/components';
```

```html
<button #copyBtn="etCopyButton" [text]="installCommand" et-icon-button etCopyButton type="button">
  @if (copyBtn.copied()) {
  <i etIcon="et-check"></i>
  } @else {
  <i etIcon="et-clipboard-check"></i>
  }
</button>
```

## Live demo

<StoryEmbed id="components-copy-button--default" height="120px" />

## Why a directive, not a component

Every consumer already has an opinion about what the button should look like - an icon button, a text button with a "Copy"/"Copied!" label, or a bare native button - and none of that changes what happens on click. `etCopyButton` owns only the click → clipboard → timed reset behavior; the template and any design tokens belong to whatever button you compose it with.

## Options

| Input        | Type                       | Default | Description                                                                                                   |
| ------------ | -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `text`       | `string \| (() => string)` | `''`    | The value to copy. A getter is evaluated at copy time, so nothing is re-serialized on every change detection. |
| `resetDelay` | `number`                   | `1200`  | How long `copied()` stays `true` after a successful copy, in ms.                                              |

| Output        | Type           | Description                               |
| ------------- | -------------- | ----------------------------------------- |
| `copySuccess` | `output<void>` | The value actually reached the clipboard. |

| Member     | Type              | Purpose                                                                                     |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------- |
| `copied()` | `Signal<boolean>` | Whether the last copy is still within its `resetDelay` window - drives the icon/label swap. |

Read `exportAs="etCopyButton"` (`#copyBtn="etCopyButton"`) to reach `copied()` from the template, or `inject(CopyButtonDirective)` from a wrapping component.

## Accessibility

The directive sets `data-copied` on the host while `copied()` is true - style off that attribute if you want a state beyond the icon/label swap (e.g. a tooltip). It does not manage focus or announce anything itself; give the button a static `aria-label` (or visible text) that describes what it copies, since the label swap alone isn't reliably announced by every screen reader.

## Theming

No design tokens - `etCopyButton` renders nothing of its own. Whatever button you compose it with (`et-icon-button`, `et-button`, `et-text-button`) provides the visual chrome and picks up the ambient [color theme](/core/theming) the normal way.
