---
'ethlete-studio': patch
---

`yarn studio` and the `tauri` targets run Studio through `@tauri-apps/cli-cef` on macOS and Linux, so the dev host finds the CEF framework instead of panicking at start.
