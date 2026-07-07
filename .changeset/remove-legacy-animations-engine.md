---
'@ethlete/cdk': major
---

Remove all `@angular/animations` `trigger()` usage from the CDK. The accordion and inline tab body were the last two components relying on the legacy animations engine; the accordion now uses a pure CSS `grid-template-rows` transition and the inline tab body drives its portal lifecycle directly. Consumer apps can now drop `provideAnimations()`/`provideNoopAnimations()` entirely, which restores synchronous route-view removal under zoneless change detection and removes the brief old/new view overlap flash on navigation (#3005).

Breaking changes:

- Removed the `accordionAnimations` export (`@angular/animations` trigger metadata).
- Removed the `tabAnimations` export (`@angular/animations` trigger metadata).
- Removed the unused `animationDuration` input from `et-inline-tab-body` (was already a no-op).
