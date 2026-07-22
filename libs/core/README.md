# @ethlete/core

Angular framework primitives for the Ethlete SDK — signal-based DOM observation, the surface/color theming systems, the animation and overlay engines, and a toolbox of directives, pipes and utilities. Component-less; every other `@ethlete/*` UI library builds on it.

## Installation

```bash
yarn add @ethlete/core
```

## Usage

```ts
import { injectCurrentBreakpoint, signalHostElementDimensions } from '@ethlete/core';

@Component({/* … */})
export class ExampleComponent {
  breakpoint = injectCurrentBreakpoint();
  dimensions = signalHostElementDimensions();
}
```

## Documentation

Full guides on the docs site:

- [Overview](https://ethlete-sdk-docs.web.app/core/)
- [Element signals](https://ethlete-sdk-docs.web.app/core/element-signals) & [signal utilities](https://ethlete-sdk-docs.web.app/core/signal-utils)
- [Theming](https://ethlete-sdk-docs.web.app/core/theming)
- [Animations](https://ethlete-sdk-docs.web.app/core/animations) & [overlay runtime](https://ethlete-sdk-docs.web.app/core/overlay-runtime)
- [Providers](https://ethlete-sdk-docs.web.app/core/providers), [SEO](https://ethlete-sdk-docs.web.app/core/seo) & [utilities](https://ethlete-sdk-docs.web.app/core/utilities)
