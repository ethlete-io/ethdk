---
'@ethlete/components': minor
---

Breaking: `NAV_TAB_IMPORTS` no longer holds `OverlayNavTabLinkComponent`. Import `OVERLAY_NAV_TAB_IMPORTS` for `et-overlay-nav-tab-link`; the migration adds it where a template uses one. Router nav tabs bundle about 2 kB gz less.
