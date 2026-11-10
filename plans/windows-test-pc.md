# Windows test PC (later)

Status: idea, not started. Raised by the human on 2026-11-10.

The human has a Windows PC with an Intel CPU (a guest PC in the rack). It should already be reachable over SSH.
`~/.ssh/config` on the Linux dev PC has no entry for it yet.

Goal: a third remote test machine next to `ethlete-mac`, for Windows-only checks: the Tauri bundles of Studio and
Timetrack (MSI or NSIS, signing, the updater), WebView2 behavior, and a Windows build of the Rust host.

## Open when the work starts

- Host name or IP, user, and SSH key; add a `Host` entry to `~/.ssh/config`.
- Which shell the SSH login gets (PowerShell or cmd), and whether WSL2 is installed.
- Toolchain: Node and Yarn versions from the repo, Rust with the MSVC target, WebView2 runtime, Git.
- A scratch checkout path, the same way `ethlete-mac` uses one (see the `app-releases` skill and the memory on Rust
  checks on other targets).
- How it fits the planned move of the dev setup to Windows and WSL2 (from 2026-11-01).
