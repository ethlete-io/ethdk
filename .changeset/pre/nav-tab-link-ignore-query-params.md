---
'@ethlete/components': minor
---

`et-nav-tab-link` now ignores query params when deciding whether it is active, so a link with `[queryParams]` stays selected on its route whatever the URL's query; pass `[routerLinkActiveOptions]` to restore the router's `subset` matching.
