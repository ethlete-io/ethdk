---
'@ethlete/eslint-plugin': minor
---

Make the OnPush change detection rules Angular-version aware. Since OnPush is the default from Angular 22, declaring it is now redundant:

- Add `no-redundant-on-push-change-detection`, which flags and auto-fixes explicit `changeDetection: ChangeDetectionStrategy.OnPush` on `@Component`, and removes the now-unused `ChangeDetectionStrategy` import when it is no longer referenced. Active on Angular >= 22.
- `require-on-push-change-detection` now only applies on Angular <= 21, where OnPush is opt-in.

Both rules resolve the workspace's Angular major version automatically (overridable via `settings.ethlete.angularMajor`) and stay inert when they don't apply, so exactly one of them is ever active for a given Angular version.
