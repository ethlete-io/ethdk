---
'@ethlete/components': major
---

Remove `activeUnderline` from `provideTabsConfig`: the active underline is always on unless a tab bar sets `[activeUnderline]="false"`. The `tabs-active-underline` migration removes the key from `provideTabsConfig({...})` calls.
