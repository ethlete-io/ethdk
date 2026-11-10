# Windows test PC (later)

Status: idea, not started. Raised by the human on 2026-11-10.

The machine is `rack`, one of the two guest game PCs set up from the human's home-server repo
(`~/umbau-elrond/elrond/spiele-pcs/`, README and `pcs.tsv`): a Minisforum AR900i (Intel), Windows with a local account,
no graphics card, 2.5 G cable, SSH target `trbor@192.168.1.115`, MAC `58:47:CA:75:FE:EF`. The SSH login gives
PowerShell. `sh spiele-pc.sh status|an|aus|ssh rack` in that folder checks it, wakes it by Wake-on-LAN, or opens a shell.
On 2026-11-10 `status` reported it off (or SSH gone). `~/.ssh/config` on the Linux dev PC has no entry for it yet.

Do not change the game setup on it (Steam, Apollo, autologon, energy settings from `einrichten.ps1`): guests play on it
through Moonlight. Dev tools go next to that setup, in a scratch folder.

Goal: a third remote test machine next to `ethlete-mac`, for Windows-only checks: the Tauri bundles of Studio and
Timetrack (MSI or NSIS, signing, the updater), WebView2 behavior, and a Windows build of the Rust host.

## Open when the work starts

- Add a `Host rack` entry to `~/.ssh/config`; check that the key login works when the PC is on.
- Whether WSL2 is installed, and whether dev work may run while guests play.
- Toolchain: Node and Yarn versions from the repo, Rust with the MSVC target, WebView2 runtime, Git.
- A scratch checkout path, the same way `ethlete-mac` uses one (see the `app-releases` skill and the memory on Rust
  checks on other targets).
- How it fits the planned move of the dev setup to Windows and WSL2 (from 2026-11-01).
