# @ethlete/core

Angular framework primitives — the component-less foundation every other Ethlete library builds on: signal-based DOM observation, the theming systems, the animation and overlay engines, and a toolbox of directives, pipes and utilities.

Everything is imported from the single package entry:

```ts
import { signalElementDimensions, injectCurrentBreakpoint, provideSurfaceThemesWithTailwind4 } from '@ethlete/core';
```

## Signals

- [Element signals](/core/element-signals) — element dimensions, intersection, mutations, scroll state and children as signals, plus signal-driven class/attribute/style bindings. **Start here.**
- [Signal utilities](/core/signal-utils) — media-query and router signals, breakpoint-aware inputs, `controlValueSignal`, animated numbers, signal plumbing (`syncSignal`, `previousSignalValue`, …) and recipes like cursor drag scroll and scroll restoration.

## Theming & motion

- [Theming](/core/theming) — the surface (elevation-aware neutrals) and color (semantic accent palettes) theming systems: registering themes, the CSS token contract and the provide/interactive directives.
- [Animations](/core/animations) — the CSS-class-driven enter/leave lifecycle (`etAnimatedLifecycle`, `*etAnimatedIf`), animation observation and FLIP helpers.
- [Overlay runtime](/core/overlay-runtime) — the low-level floating-layer engine behind the [components overlay system](/components/overlays).

## Interaction

- [Scrolling](/core/scrolling) — pure scroll-geometry primitives: `scrollToElement`, visibility checks and snap-target math.
- [Drag & resize](/core/drag-resize) — the drag-handle directive and resize-handles component that power grid and PIP interactions.
- [Directives & pipes](/core/directives-pipes) — click-outside, `*etRepeat`, the scroll observer, markdown/MIME pipes and the match-normalization pipes.

## App services

- [Providers](/core/providers) — breakpoint observer, locale, focus-visible tracker, renderer, style manager, boundary element and user consent.
- [SEO](/core/seo) — signal-based head management: title composition, meta/Open Graph/Twitter tags, links and JSON-LD structured data.

## Foundation

- [Utilities](/core/utilities) — the DI provider-tuple pattern, `RuntimeError`, host listeners, form helpers and validators, cookies and session memory, deep clone/equal, swipe tracking and more.

## Also in the package

- **Props system** (`createProps`, `[etProps]`, …) — experimental machinery for a props-binding component pattern. It's exported but not used by the shipped component libraries; treat it as internal until it stabilizes.
- **Nx generators** — `tailwind-4-color-theme` and `tailwind-4-surface-theme` generate the theme CSS and type registrations described in [Theming](/core/theming).
