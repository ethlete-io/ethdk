---
'@ethlete/components': patch
---

Let a grid widget type its own `data` input. `GridComponentRegistration` and
`GridItemActionsComponent` now accept a read-only `Signal<TData>`, so a component
declaring `input.required<MyPayload>()` registers without a cast - `InputSignal<T>`
is invariant in `T` and made every registration need one.
