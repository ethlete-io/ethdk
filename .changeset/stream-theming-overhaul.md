---
'@ethlete/components': minor
---

Stream: theming overhaul and cleanups.

- The PiP chrome now provides a surface theme scope (`type: 'dark'`, elevation 1) - it is mounted into `document.body` and previously had no theme context at all.
- The PiP window glass background derives from the surface theme (`60%` of `--et-surface-background-solid`) instead of hardcoded `rgba(0, 0, 0, 0.6)`; `--et-pip-bg` remains as an override hook but is no longer a registered `@property`.
- The featured-cell ring in PiP grid mode uses `--et-theme-color-primary-solid` instead of hardcoded `#3b82f6`; `--et-stream-pip-chrome-featured-ring-color` remains as an override hook (no longer a registered `@property`). The hover ring and resize handles now derive from surface tokens too.
- Scrollable: `ScrollableErrorCode` is removed in favor of `SCROLLABLE_ERROR_CODES`, matching every other domain's naming.
- Internal: platform iframes set the legacy `scrolling` attribute via the renderer instead of the deprecated DOM property.
