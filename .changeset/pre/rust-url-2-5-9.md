---
'ethlete-studio': patch
'timetrack-app': patch
---

Update the Rust `url` crate to 2.5.9 to fix RUSTSEC-2026-0592 (stack overflow in `Url::origin()` on nested `blob:` URLs).
