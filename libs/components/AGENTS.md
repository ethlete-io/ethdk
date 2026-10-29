# components

## Splitting a large stylesheet: styles-only components

A component's CSS is injected when that component is **first instantiated**, and a
`@Component` with an empty template exists only to carry a stylesheet. Together those
two facts are how a big sheet stops being a tax on every consumer:

- **CSS that belongs to a stamped child** goes on that child (e.g. the table's expander
  chrome lives on `table-expander-cell.component.css`) - a table without expansion never
  creates the cell, so the rules never reach the document.
- **CSS that belongs to an opt-in feature** goes in a styles-only component the _feature_
  references, mounted with `injectStyleManager().mount(TheStylesComponent)` - see
  `ButtonStylesDirective` / `ButtonPropertiesStylesComponent`, and
  `etTableVirtualScroll` → `TableVirtualScrollStylesComponent`. Because only the feature
  references it, an app that doesn't import the feature doesn't bundle its CSS either.
- **CSS for a base capability that most tables don't use** (the table's detail-row
  animation) can be mounted on demand from an `effect` when the capability turns on. That
  saves injection and style recalculation, not bundle size - the reference is still static.

The style manager de-duplicates per component type, so mounting from many instances
injects one `<style>`. A mounted sheet stays in the document, but Angular removes a
component's own `<style>` with its last instance and re-appends it after everything else,
so a rule that overrides the base sheet must outweigh it
(`.et-table-row.et-table-row--box`), never merely follow it. Reach for this when a sheet
grows past a few hundred lines and an identifiable slice of it serves a minority of
consumers - `form-field` is the next candidate.
