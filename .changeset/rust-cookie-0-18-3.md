---
'ethlete-studio': patch
'timetrack-app': patch
---

Update the Rust `cookie` crate to 0.18.3 to fix RUSTSEC-2026-0594 (private cookie nonces can repeat in processes that fork).
