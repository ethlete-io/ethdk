---
'@ethlete/cli': patch
---

The design server resolves a relative Tailwind `@source` or `source()` folder to its real path, so Tailwind no longer scans gitignored build folders (such as `src-tauri/target`) when the folder is reached through a symlink.
