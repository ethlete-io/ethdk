# @ethlete/query-devtools

The in-app inspector for [`@ethlete/query`](https://www.npmjs.com/package/@ethlete/query): queries,
stacks, sequences, auth providers, sockets, the cache, an event log, plus armed faults, mocks and
response overrides.

## Installation

```bash
yarn add -D @ethlete/query-devtools
```

## Usage

Instrumentation is turned on separately, by `provideQueryDevtools()` from `@ethlete/query`. Mount
the panel through `<et-query-devtools-lazy>`, which renders only the floating toggle button and
downloads the panel the first time it is opened.

```ts
import { provideQueryDevtools } from '@ethlete/query';

bootstrapApplication(AppComponent, {
  providers: [provideQueryDevtools()],
});
```

```ts
import { QueryDevtoolsLazyComponent } from '@ethlete/query-devtools/lazy';

@Component({
  selector: 'app-root',
  imports: [QueryDevtoolsLazyComponent],
  template: `<et-query-devtools-lazy />`,
})
export class AppComponent {}
```

`<et-query-devtools>` from `@ethlete/query-devtools` is the same panel loaded eagerly.

## Documentation

https://ethlete-sdk-docs.web.app/query-devtools/
