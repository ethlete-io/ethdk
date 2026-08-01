---
'@ethlete/components': minor
---

Calendar: a replaceable header, and no more NG0956 in consumers' dev consoles.

- **`ng-template etCalendarHeader`** projected into `et-calendar` renders instead of its own header,
  keeping the grid and its styling. The template receives the headless directive, so it has the same
  state the default header uses - `headerLabel()`, `previous()`/`next()`, `canGoPrev()`/`canGoNext()`,
  `zoomOut()`, `view`. Going fully headless (`[etCalendar]` + `[etCalendarGrid]` + `[etCalendarCell]`)
  was always an option; this is the middle ground, which is what "custom header" usually means.
- **`et-calendar` exposes its headless directive as `headless`**, for chrome that sits outside the
  component: `<et-calendar #cal>` then `cal.headless.headerLabel()`.
- **Fixed: the calendar warned NG0956 twice per navigation in dev.** Re-creating the grid is how its
  enter transition runs, and it got there by keying a one-item `@for` on the visible unit - which
  Angular reports as an expensive tracking mistake, in every consumer's console, on every step. It now
  renders through one of two identical `@if` branches flipped per change (`transitionParity` on the
  headless directive), which re-creates exactly the same way and says nothing.
