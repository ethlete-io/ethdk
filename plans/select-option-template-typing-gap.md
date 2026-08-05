# `et-select`: `[options]` + `etSelectOptionTemplate` loses extra field typing

Found 2026-08-05 migrating `fut-frontend`'s hub app off `@ethlete/cdk`'s combobox onto
`et-select` (`@ethlete/components@1.0.0-next.36`).

Several sites bind `[options]` to an array whose entries carry more than `{value, label}` - e.g.
`{ value, label, email? }` for a "partnership manager" picker, rendered with a custom row via
`<ng-template etSelectOptionTemplate let-option>{{ option.email }}</ng-template>` (the docs'
own "Large option lists" example does the same: `let-user`, then `user.email`).

`SelectComponent`/`SelectDirective` aren't generic over the option type - `options` is typed
`SelectOptionData[]` (`TValue = unknown`), so `etSelectOptionTemplate`'s context type is always
the base `SelectOptionData<unknown>` regardless of what's actually bound. `option.email` (or any
field beyond `value`/`label`) is a compile error (`TS2339`), even though the docs example
implies it "just works." The values are genuinely there at runtime (the docs are right that
"extra fields ... are kept and handed to the row template") - only the *type* is lost.

**Workaround used**: skip `[options]` + `etSelectOptionTemplate` for these sites and project
`<et-select-option>` manually via `@for` instead (typed off the real array), e.g.:

```html
<et-select [formField]="form.managerUuid" filterMode="external" (queryChange)="search($event)">
  <input etSelectSearch />
  @for (option of managers(); track option.value) {
    <et-select-option [value]="option.value" [label]="option.label">
      <span class="grid gap-0.5">
        <span>{{ option.label }}</span>
        @if (option.email) { <span class="text-fut-surface-muted">{{ option.email }}</span> }
      </span>
    </et-select-option>
  }
</et-select>
```

This works and is fully typed, but forfeits the `[options]` path's built-in virtualization for
what were, in this app, always small (tens of entries) lookup lists - not a real loss here, but it
would be for a genuinely large option set with per-row extra fields.

**Suggested fix:** make `SelectComponent` (or at least the `[options]` input and
`etSelectOptionTemplate`'s context type) generic over the option's extra-fields shape, e.g.
`SelectOptionData<TValue, TExtra = unknown>`, so `[options]="managers()"` with
`managers: (SelectOptionData<string> & { email?: string })[]` flows through to the template
context instead of widening to `unknown`.
