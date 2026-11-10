# Windows test PC (later)

Status: decided (ADR 0258): `rack` runs the Windows CEF spike B480, after the night shift. In the coming weeks `rack` belongs to the builder alone (no guests). Raised by the human on 2026-11-10.

The machine is `rack`, one of the two guest game PCs set up from the human's home-server repo
(`~/umbau-elrond/elrond/spiele-pcs/`, README and `pcs.tsv`): a Minisforum AR900i (Intel), Windows with a local account,
no graphics card, 2.5 G cable, SSH target `trbor@192.168.1.115`, MAC `58:47:CA:75:FE:EF`. The SSH login gives
PowerShell. `sh spiele-pc.sh status|an|aus|ssh rack` in that folder checks it, wakes it by Wake-on-LAN, or opens a shell.
On 2026-11-10 `status` reported it off (or SSH gone). `~/.ssh/config` on the Linux dev PC has no entry for it yet.

Do not change the game setup on it (Steam, Apollo, autologon, energy settings from `einrichten.ps1`): guests play on it
through Moonlight. Dev tools go next to that setup, in a scratch folder.

Goal: a third remote test machine next to `ethlete-mac`, for Windows-only checks: the Tauri bundles of Studio and
Timetrack (MSI or NSIS, signing, the updater), WebView2 behavior, and a Windows build of the Rust host.

## Probe (2026-11-10, night)

`rack` is on and the key login works (`ssh -o BatchMode=yes trbor@192.168.1.115`). Windows 11 Pro, i9-13900HX, 64 GB
RAM, 110 GB free on C:. Installed: WSL (`wsl.exe`), WebView2 154.0.4258.62. Missing: Node, Yarn, Git, Rust (cargo,
rustup). The login shell is PowerShell 5.1: `&` and `$` in a quoted command break, and a script piped to stdin or an
`scp` reset the connection once. A script runs reliably as `powershell -NoProfile -EncodedCommand <base64 UTF-16LE>`.

## Open when the work starts

- Add a `Host rack` entry to `~/.ssh/config`; check that the key login works when the PC is on.
- Whether WSL2 is installed, and whether dev work may run while guests play.
- Toolchain: Node and Yarn versions from the repo, Rust with the MSVC target, WebView2 runtime, Git.
- A scratch checkout path, the same way `ethlete-mac` uses one (see the `app-releases` skill and the memory on Rust
  checks on other targets).
- How it fits the planned move of the dev setup to Windows and WSL2 (from 2026-11-01).
