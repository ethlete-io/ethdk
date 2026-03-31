# SDK Component Architecture

This document defines the component design system used across `libs/cdk`. Every complex component in this SDK follows a three-tier model that separates behavior from presentation, enabling full customization while keeping a great out-of-the-box experience.

---

## The Three-Tier Model

### Tier 1 — Primitives (`libs/core`)

Pure behavior, zero domain awareness, reusable in any component. No opinion on DOM structure or visual design.

Examples: `ListKeyManagerDirective`, `OverlayDirective`, `DragHandleDirective`

Rules:

- No dependency on any `libs/cdk` domain
- No `hostDirectives` pointing to Tier 2/3 code
- May declare **private** (`--_`) `@property` tokens when the primitive owns and sets them
- Must **not** declare public (`--et-`) design tokens — those belong to the consuming Tier 3 component

---

### Tier 2 — Headless Compositions (`libs/cdk`)

All behavior + state for a domain component, zero visual opinion. These are the "shadcn layer" — users who need full template control build on top of these.

Examples: `SelectDirective`, `SelectTriggerDirective`, `SelectPanelDirective`

Rules:

- Lives in `libs/cdk` alongside its Tier 3 counterpart
- Holds all inputs, host bindings, and state
- Sub-directives/components self-register via DI (see [Self-Registration Pattern](#self-registration-pattern))
- No required template structure imposed on the user
- May declare **private** (`--_`) `@property` tokens when the directive owns and sets them (e.g. a component-directive that measures its own dimensions)
- Must **not** declare public (`--et-`) design tokens — Tier 3 owns those

---

### Tier 3 — Default Components (`libs/cdk`)

Opinionated template + design tokens + Tier 2 directive as `hostDirective`. Covers 90% of use cases with zero configuration.

Examples: `SelectComponent`, `SelectTriggerComponent`, `SelectPanelComponent`

Rules:

- Uses `hostDirectives` to apply the Tier 2 directive; forwards all inputs via `inputs: [...]`
- Owns all `@property` design token declarations
- Template includes the required sub-directives so the user never has to think about them
- Styling is entirely overridable via the public design token API
- Consumes theme CSS custom properties (e.g. `--et-color-primary`) but does **not** include `ProvideThemeDirective` itself. The consumer applies `[etProvideTheme]="themeName"` on the component's host element from outside, which adds the scoping class (`${prefix}-theme--${name}`) and activates the palette for the subtree. The only exception are containers that live outside the normal DOM tree (eg. overlay/portal) — they cannot rely on CSS cascade, so they need to get the current theme from the context in which they are rendered and apply it via `ProvideThemeDirective` themselves.

---

## Self-Registration Pattern

Sub-directives register themselves with the parent directive via DI rather than the parent querying children via `viewChild`. This removes the `viewChild` requirement from user code entirely.

```ts
// Sub-directive registers upward
@Directive({ selector: '[etSelectTrigger]' })
export class SelectTriggerDirective {
  private select = inject(SelectDirective, { optional: true });

  constructor() {
    this.select?.registerTrigger(this);
  }
}

// Parent directive accepts registrations
@Directive({ selector: '[etSelect]' })
export class SelectDirective {
  private _trigger = signal<SelectTriggerDirective | null>(null);

  registerTrigger(dir: SelectTriggerDirective): void {
    this._trigger.set(dir);
  }
}
```

The parent's state consumes the registered signals with null guards, so partial registration is handled gracefully (or throws in dev mode — see below).

---

## Must-Haves vs Optionals

Each Tier 2 directive declares which sub-components are required vs optional.

**Required**: absence breaks the core UX contract. Missing one throws in dev mode.  
**Optional**: absence disables a feature gracefully without errors.

### Dev mode enforcement

Use `afterNextRender` — it fires after all constructor self-registrations have run. Wrap the entire call in `if (ngDevMode)` so the scheduler registration, closure, and all dev-only imports are fully tree-shaken from the production bundle. Use `RuntimeError` with the domain error code so the message is clearly labelled in logs:

```ts
import { afterNextRender } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { SelectErrorCode } from './select-errors';

if (ngDevMode) {
  afterNextRender(() => {
    if (!this._trigger()) {
      throw new RuntimeError(
        SelectErrorCode.MISSING_TRIGGER,
        '[SelectDirective] A required [etSelectTrigger] element was not found in the template. ' +
          'Add an element with the etSelectTrigger directive.',
      );
    }
  });
}
```

See the [Error & Warning System](#error-warning-system) section for how to define error codes.

### Classification guide

| Sub-component        | Classification | Reason                                       |
| -------------------- | -------------- | -------------------------------------------- |
| `[etSelectTrigger]`  | Required       | No trigger → select cannot be opened         |
| `[etSelectPanel]`    | Required       | No panel → nothing to show when opened       |
| `[etSelectItem]`     | Required       | No items → select has nothing to choose from |
| `[etSelectClearBtn]` | Optional       | Not every select needs a clear button        |
| `[etSelectSearch]`   | Optional       | Not every select needs a search field        |

---

## Error & Warning System

All dev-mode errors and warnings thrown by SDK components use `RuntimeError` from `@ethlete/core` instead of the native `Error`. This ensures:

- A consistent `ET{code}: message` format in every log
- Numeric codes that are searchable in the docs site
- Full tree-shaking when wrapped in `if (ngDevMode)`

### Defining error codes

Each component domain owns a `const` error code object in a co-located `*-errors.ts` file. Codes are plain numbers — no TypeScript `enum` (enums are not tree-shakeable in all configurations). For smaller files, the error codes may be defined directly in the main directive file.

```ts
// select-errors.ts
export const SelectErrorCode = {
  MISSING_TRIGGER: 1000,
  MISSING_PANEL: 1001,
  MISSING_ITEM: 1002,
} as const;
```

### Code range allocation

To avoid collisions, each component domain owns a fixed numeric range:

| Range       | Domain       |
| ----------- | ------------ |
| 1000 – 1099 | Select       |
| 1100 – 1199 | Combobox     |
| 1200 – 1299 | Overlay      |
| 1300 – 1399 | Menu         |
| 1400 – 1499 | Tooltip      |
| 1500 – 1599 | Toggletip    |
| 1600 – 1699 | _(reserved)_ |

Add new domains by claiming the next free hundred block.

### Message format

Messages must follow this template:

```
[DirectiveName] <what is wrong>. <how to fix it>.
```

Example:

```
[SelectDirective] A required [etSelectTrigger] element was not found in the template. Add an element with the etSelectTrigger directive.
```

The `RuntimeError` constructor auto-prefixes this as `ET1000: [SelectDirective] …` — giving log lines that are directly searchable in the docs site.

---

## Inputs with SDK Defaults

Tier 2 directives expose all configurable values as `input()` with sensible defaults rather than hardcoded constants. This includes values that were previously `readonly` class constants. `model()` usage is also fine for 2-way bound values. Same applies to `output()`.

```ts
// ❌ Before
readonly PANEL_PLACEMENT: OverlayPlacement = 'bottom-start';

// ✅ After (on Tier 2 directive)
panelPlacement = input<OverlayPlacement>('bottom-start');
```

The Tier 3 template binds `[placement]="state.panelPlacement()"`. Users override via the forwarded input.

---

## Design Token Naming Convention

Public `@property` declarations live in the Tier 3 component's `styles`. Private (`--_`) tokens may be declared by any tier that owns and sets them — typically a Tier 2 component-directive that measures or computes a value and exposes it to its subtree via a host binding.

### Public tokens

User-customizable, documented, stable API surface. Named:

```
--et-{component}-{property}
--et-{component}-{state}-{property}
```

Examples:

```css
--et-select-bg
--et-select-border-radius
--et-select-border-color
--et-select-open-border-color
--et-select-panel-max-height
--et-select-item-height
```

### Private / internal tokens

Set by JavaScript or derived internally. Not part of the public API. Named with `--_` prefix:

```
--_et-{component}-{property}
```

Examples:

```css
--_et-select-trigger-height   /* set via [style.--_et-select-trigger-height.px] */
--_et-select-panel-width
```

The `--_` prefix signals "don't touch this" — it mirrors the upcoming CSS native private custom property convention and is already understood by tooling.

### `inherits` rule

- `inherits: true` — tokens that must cascade to child elements (layout/spacing values)
- `inherits: false` — tokens that are component-local and must not bleed into children

### Declaration example

```css
@property --et-select-bg {
  syntax: '<color>';
  inherits: false;
  initial-value: #ffffff;
}

@property --_et-select-trigger-height {
  syntax: '<length>';
  inherits: true;
  initial-value: 40px;
}
```

---

## Component-Directives

A component-directive is a `@Component` with an **attribute selector** and a `<ng-content>` template. It gives the user full freedom over which element type to use while still enabling styles, `@property` declarations, and internal `viewChild`/`contentChild` queries. We need to be careful with this pattern since there can only be one component directive per element plus the element itself must be a native HTML element.

```ts
@Component({
  selector: '[etSelectTrigger]',
  template: `<ng-content />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: `
    @property --_et-select-trigger-height {
      syntax: '<length>';
      inherits: true;
      initial-value: 40px;
    }
  `,
  host: {
    class: 'et-select-trigger',
    '[style.--_et-select-trigger-height.px]': 'height()',
  },
})
export class SelectTriggerDirective {
  private select = inject(SelectDirective, { optional: true });
  private dims = signalHostElementDimensions();

  height = computed(() => this.dims().offset?.height ?? 40);

  constructor() {
    this.select?.registerTrigger(this);
  }
}
```

Usage — the host element is user-chosen:

```html
<button etSelectTrigger>Open</button>
<div etSelectTrigger role="combobox">Open</div>
```

Use a component-directive (over a plain `@Directive`) when the piece of Tier 2 needs any of:

- `styles` / `@property` declarations
- Internal `viewChild` or `contentChild`
- A guaranteed single content slot via `<ng-content>`

---

## Library Placement

| Tier                   | Location    | Reasoning                                      |
| ---------------------- | ----------- | ---------------------------------------------- |
| 1 — Primitives         | `libs/core` | Generic, domain-free, reusable anywhere        |
| 2 — Headless           | `libs/cdk`  | Domain-specific behavior stays with its domain |
| 3 — Default components | `libs/cdk`  | Co-located with Tier 2 counterpart             |

---

## Migration Strategy

Existing components are widely used in production. Migration is non-breaking and done in phases.

### Phase 1 — Introduce Tier 2 alongside existing components (non-breaking)

- Create `{component}.directive.ts` (Tier 2) next to the existing `{component}.component.ts`
- Existing components are **untouched**
- Both APIs coexist; Tier 2 is opt-in

### Phase 2 — Next major version: existing components become Tier 3 wrappers

- Old component gets `hostDirectives: [Tier2Directive]` with forwarded inputs
- Selector and public input names are preserved — no breaking change for template users
- Only callers doing `inject(OldComponent)` break → they need `inject(Tier2Directive)`

### Phase 3 — Deprecate and migrate old injection patterns

- Deprecated APIs emit warnings in dev mode
- NX schematics in `migrations.json` handle the `inject(OldComponent)` → `inject(Tier2Directive)` rename automatically
- Changeset classification: `✨ Major` (breaking injection API change)

---

## User Experience at Each Tier

### Tier 3 — Default (zero config)

```html
<et-select [formControl]="control">
  <et-select-option value="de">Germany</et-select-option>
  <et-select-option value="at">Austria</et-select-option>
</et-select>
```

### Tier 2 — Custom template, same SDK behavior

The user brings their own template but reuses all keyboard handling, open/close state, accessibility, and form integration.

```ts
@Component({
  hostDirectives: [
    {
      directive: SelectDirective,
      inputs: ['placeholder', 'multiple', 'panelPlacement', 'disabled'],
    },
  ],
  template: `
    <button etSelectTrigger>{{ state.displayValue() }}</button>

    <div etSelectPanel>
      <input etSelectSearch placeholder="Filter..." />
      <ng-content />
    </div>
  `,
})
export class MySelect {
  protected state = inject(SelectDirective);
}
```

Usage is identical to the default from the consumer's perspective:

```html
<my-select [formControl]="control">
  <my-select-option value="de">Germany</my-select-option>
</my-select>
```

### Tier 1 — Fully custom (primitives only)

```ts
// Compose a select entirely from scratch using OverlayDirective,
// ListKeyManagerDirective and your own state logic.
// No SDK opinions at all.
```
