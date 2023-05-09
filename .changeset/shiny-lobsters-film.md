---
'@ethlete/core': major
---

Remove `DestroyService` in favor of `createDestroy()` method. `createDestroy()` can only be used from within an injection context and will assert otherwise.

Before:

```ts
import { DestroyService } from '@ethlete/core';

@Component({
  selector: 'my-component',
  template: `...`,
  providers: [DestroyService],
})
export class MyComponent {
  private readonly _destroy$ = inject(DestroyService).destroy$;
}
```

After:

```ts
import { createDestroy } from '@ethlete/core';

@Component({
  selector: 'my-component',
  template: `...`,
})
export class MyComponent {
  private readonly _destroy$ = createDestroy();
}
```
