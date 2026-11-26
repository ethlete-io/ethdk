---
'@ethlete/components': minor
---

Cascader: new `et-cascader` / `[etCascader]` (`CASCADER_IMPORTS`) - a generic hierarchy value control that browses an abstract `CascaderDataSource<T>` level by level (sync array, `Promise` or `Observable`, each level lazy-loaded). Miller columns on desktop, single-column drill in a bottom sheet on mobile; `selectableLevels` (`'leaf'` | `'any'`), `path`/`pathValue` chain, per-column loading/empty/error states with retry, full ARIA tree keyboard navigation, and signal-forms integration. Error block `ET3300`–`ET3399`.

Deep hierarchies stay compact: the desktop panel shows at most `maxVisibleColumns` (default 3) columns side by side, showing the whole drilled trail as a breadcrumb row below the columns once it overflows. All drilled levels ride a sliding track, so collapsing into a crumb (and navigating back out of one) is a coordinated slide rather than a pop. Navigating back is non-destructive - a crumb click or Arrow Left past the window edge slides the column window without discarding the deeper drill. Headless: `visibleColumns()`, `breadcrumbPath()`, `visibleColumnStart()`, `showColumn()`.
