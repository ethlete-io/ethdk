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
  trigger = signal<SelectTriggerDirective | null>(null);

  /** @internal */
  registerTrigger(dir: SelectTriggerDirective) {
    this.trigger.set(dir);
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

| Range       | Domain                    |
| ----------- | ------------------------- |
| 1000 – 1099 | Select                    |
| 1100 – 1199 | Combobox                  |
| 1200 – 1299 | Overlay                   |
| 1300 – 1399 | Menu                      |
| 1400 – 1499 | Tooltip                   |
| 1500 – 1599 | Toggletip                 |
| 1600 – 1699 | Stream (components)       |
| 1700 – 1799 | Notification (components) |

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

### CSS native nesting

Use CSS native nesting (no pre-processor) inside the `styles` block whenever child selectors have a clear structural parent. Nest child class rules directly inside their parent block — this keeps the stylesheet structure in sync with the template's DOM hierarchy and eliminates repetitive BEM prefix repetition.

```css
.et-stream-consent {
  display: flex;

  .et-stream-consent-placeholder {
    padding: var(--et-stream-consent-placeholder-padding);

    .et-stream-consent-placeholder-text {
      color: var(--et-stream-consent-placeholder-text-color);
    }
  }
}
```

Do **not** nest pseudo-classes or modifier classes that apply to the host element itself (e.g. `:host`, `[disabled]`) — those stay at the top level.

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

## Behavioral Component-Directives

Some Tier 2 pieces need to render **behavioral template logic** (e.g. showing content slot A vs. slot B based on state) rather than just passing through content. This is too opinionated for a plain `@Directive` but also doesn't belong in the Tier 3 component because a user who wants full template control should still be able to use it.

The pattern is a **behavioral component-directive**: a `@Component` whose template contains conditional or slot-orchestration logic instead of `<ng-content />`.

Rules:

- Selector is **dash-case** for both element and attribute form: `et-foo-conditional, [et-foo-conditional]`
  - dash-case distinguishes it from regular camelCase attribute directives at a glance
- Injects the Tier 2 token to read state; **does not** provide its own token
- Lives alongside the Tier 2 directive — it is **not** Tier 3
- Has no `hostDirectives` — it relies on an ancestor Tier 2 directive in the injector chain
- The **Tier 3** component places it in its template and provides the `ng-template` slots internally

```ts
// Behavioral component-directive (Tier 2 layer)
@Component({
  selector: 'et-stream-consent-conditional, [et-stream-consent-conditional]',
  template: `
    @if (consent.isGranted()) {
      <ng-container [ngTemplateOutlet]="consent.contentSlot()?.templateRef ?? null" />
    } @else {
      <ng-container [ngTemplateOutlet]="consent.placeholderSlot()?.templateRef ?? null" />
    }
  `,
  ...
})
export class StreamConsentConditionalComponent {
  protected consent = inject(STREAM_CONSENT_TOKEN);
}

// Tier 3 — batteries included
@Component({
  selector: 'et-stream-consent',
  template: `
    <et-stream-consent-conditional>
      <ng-template etStreamConsentContent>
        <ng-content />
      </ng-template>

      <ng-template etStreamConsentPlaceholder>
        <div class="et-stream-consent-placeholder">
          <p>{{ placeholderText() }}</p>
          <button etStreamConsentAccept>{{ acceptLabel() }}</button>
        </div>
      </ng-template>
    </et-stream-consent-conditional>
  `,
  hostDirectives: [{ directive: StreamConsentDirective }],
  styles: `
    @property --et-stream-consent-accept-bg { syntax: '<color>'; inherits: false; initial-value: #000; }
    @property --et-stream-consent-accept-color { syntax: '<color>'; inherits: false; initial-value: #fff; }
  `,
  ...
})
export class StreamConsentComponent {
  placeholderText = input('Please accept the terms to watch this content.');
  acceptLabel = input('Accept & Watch');
}
```

Consumer usage of Tier 3 (zero config):

```html
<et-stream-consent>
  <et-youtube-player [videoId]="id" />
</et-stream-consent>
```

Consumer usage of the behavioral component-directive directly (custom template, same behavior logic):

```html
<div etStreamConsent>
  <et-stream-consent-conditional>
    <ng-template etStreamConsentContent>...</ng-template>
    <ng-template etStreamConsentPlaceholder>...</ng-template>
  </et-stream-consent-conditional>
</div>
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

## Folder Structure

Complex components are split across subfolders inside their domain directory. The folder name reflects the architectural tier of its contents.

```
libs/cdk/src/lib/components/select/
├── index.ts                  ← barrel: re-exports headless/ and component files
│
├── headless/                 ← Tier 2: all behavior, zero visual opinion
│   ├── index.ts
│   ├── select.directive.ts
│   ├── select-trigger.directive.ts
│   ├── select-panel.directive.ts
│   ├── select-item.directive.ts
│   ├── select-search.directive.ts
│   ├── select-clear-btn.directive.ts
│   └── internals/            ← not re-exported; used only within this domain
│       ├── select-key-manager.ts
│       └── select-filter.ts
│
├── select.component.ts       ← Tier 3: @Component files with CSS/HTML templates
├── select.component.html
├── select.component.css
├── select-option.component.ts
├── select-option.component.html
└── select-option.component.css
```

### What goes where

| Folder                | Contents                                                          | Rule                                                                  |
| --------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| `headless/`           | `@Directive`, state files, tokens, animation utilities, DI tokens | No `templateUrl`, no `styleUrl`, no CSS — zero visual opinion         |
| `headless/internals/` | Composable factories, pure helpers used only inside this domain   | Same rule as `headless/`; not part of the public headless API surface |
| domain root           | `@Component` with `.html` + `.css`                                | Has a template and/or styles — owns design tokens                     |

The distinction is mechanical: if a file has a `templateUrl` or `styleUrl`, it lives in the domain root alongside `headless/`. Everything else belongs in `headless/` (or `headless/internals/` if it is not part of the public API).

### Domain infrastructure — stays at the root

Not every file in a domain belongs to the headless/component split. When a domain is large enough to contain multiple sub-domains (e.g. `stream/` contains `consent/`, `error/`, `pip/`, `platform/`), there will be **domain-wide infrastructure** that those sub-domains all share:

```
stream/
├── stream-manager.ts          ← root provider factory
├── stream-manager.types.ts    ← shared types consumed by all sub-domains
├── stream-player.ts           ← shared token + interface
├── stream-player-slot.ts      ← factory used by all platform directives
├── stream-player-slot.directive.ts  ← cross-cutting @Directive for all slot components
├── stream-config.ts           ← config shape + inject helper
├── stream-errors.ts           ← error codes
├── stream-script-loader.ts    ← shared utility
├── stream.types.ts            ← shared types
├── stream.imports.ts          ← Angular aggregation array (public API surface)
├── pip-manager.ts             ← root provider factory for pip sub-domain
├── pip-chrome-manager.ts      ← root provider factory for pip chrome
├── consent/                   ← sub-domain (has headless/ inside)
├── error/                     ← sub-domain (has headless/ inside)
├── pip/                       ← sub-domain (has headless/ inside)
└── platform/                  ← sub-domain group (each platform dir has headless/ inside)
```

These root files are the **infrastructure glue** — not the headless half of a component. They live at the domain root because every sub-domain imports from them.

**Do NOT** create a `headless/` folder at the domain root level to hold infrastructure. `headless/` only emerges when **both** a headless directive and a presentational component exist at the same level — a `@Directive` alone is not sufficient reason to create `headless/`. When a domain root contains only infrastructure files (no `@Component` files), file naming suffixes (`.directive.ts`, `.types.ts`, etc.) already communicate the distinction; adding `headless/` would provide no useful signal.

| File type at domain root                          | Rule                   |
| ------------------------------------------------- | ---------------------- |
| Managers, root provider factories                 | Domain root            |
| Shared types, tokens, interfaces                  | Domain root            |
| Shared utilities, script loaders                  | Domain root            |
| Cross-cutting directives (serve the whole domain) | Domain root            |
| Angular import aggregation arrays                 | Domain root            |
| `@Directive` specific to one sub-domain           | Sub-domain `headless/` |
| `@Component` with template/styles                 | Sub-domain root        |

### Barrel exports

The `headless/` subfolder has its own `index.ts`. The domain root `index.ts` re-exports from `headless/` and from each component file directly. `headless/internals/` is intentionally **not** re-exported from `headless/index.ts` — it is only imported via relative paths by files within the same domain.

```ts
// headless/index.ts
export * from './select.directive';
export * from './select-trigger.directive';
// …

// index.ts (domain root)
export * from './headless';
export * from './select.component';
export * from './select-option.component';
// …
```

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
