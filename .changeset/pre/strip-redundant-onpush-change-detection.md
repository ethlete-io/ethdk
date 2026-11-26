---
'@ethlete/components': patch
'@ethlete/cdk': patch
'@ethlete/core': patch
'@ethlete/contentful': patch
'@ethlete/query': patch
---

Remove the now-redundant `changeDetection: ChangeDetectionStrategy.OnPush` declaration (and its `ChangeDetectionStrategy` import) from all components. OnPush is the default change detection strategy since Angular 22, so this is a no-op cleanup with no behavioral change.
