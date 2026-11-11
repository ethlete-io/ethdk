# Ethlete Studio on the CEF runtime (Linux)

Status: slice 1 done (2026-10-26). Slice 2 done (2026-10-26) except a release run on CI; a local
cli-cef build gives a 157 MiB deb and a 120 MiB rpm with CEF, `cli-runtime` and updater signatures.

## Why

WebKitGTK 2.54 shows a transitioned element at its start position for one frame when a transition
ends, and it froze on live `backdrop-filter` iframes. A scratch CEF build of Studio
(`~/dev/scratch/studio-cef`, not in the repo) showed neither; Tom chose CEF for Linux only. macOS
and Windows keep wry (WKWebView, WebView2).

## Slice 1 - dev build on CEF

Rust host on `tauri-runtime-cef` from the tauri `feat/cef` branch, commit
`9d1a5b176e337c8395362a4e7c99bac99b36a1d1` (still tauri 2.11.5, so no API changes):
`#[tauri_runtime_cef::cef_entry_point]` on `main`, `.runtime(tauri_runtime_cef::Cef::default())`,
`[patch]` of the tauri crates, `dpi` patched to winit-gtk4 `3d7c7cd`. All CEF code gated on
`target_os = "linux"`. CEF forces X11 (XWayland on niri) and sets `GDK_BACKEND=x11`, which leaks into
child processes.

## Slice 2 - CI and release bundles

Verified on `feat/cef`:

- The CLI picks the runtime from the manifest: a linked `tauri-runtime-cef` selects CEF. No flag.
  The npm CLI is `@tauri-apps/cli-cef` (3.0.0-alpha.27, bin `tauri`); today the repo uses
  `@tauri-apps/cli` 2.11.4.
- The bundler copies `libcef.so`, the `.pak` files, `icudtl.dat`, locales and `chrome-sandbox` into
  deb and rpm (`chrome-sandbox` setuid 4755 in deb). AppImage goes through `sharun_cef.rs` and is
  broken upstream (tauri-apps/tauri#16204); without setuid it needs user namespaces, which
  Ubuntu 23.10+ restricts.
- CEF binaries: the CLI sets `CEF_PATH` (default `<data_dir>/tauri-cef`) and `cef-dll-sys` downloads
  into it. The branch CI uses `cargo install export-cef-dir` and caches `~/.local/share/cef` on the
  cef version.
- `tauri-plugin-updater` 2.12 reads the whole bundle into memory; no size cap.

Steps (all done; `.github/actions/cef` caches the extracted distribution in `~/.cache/tauri-cef`):

1. Install `@tauri-apps/cli-cef` for the Studio Linux leg only. The other legs and Timetrack keep
   `@tauri-apps/cli`, because cli-cef is a 3.0 alpha.
2. `.github/workflows/publish.yml` job `apps-bundle` (l.119-123): for Studio on Linux drop
   `libwebkit2gtk-4.1-dev`, add `libgtk-3-dev` and what the build asks for.
3. Cache the CEF dir on the cef crate version from `Cargo.lock`; export `CEF_PATH`.
4. Build only deb and rpm for Studio on Linux until #16204 is fixed. The upload globs and
   `latest.json` need no change.
5. Check that `bundle.resources` (`cli-runtime`) and the CSP still work under CEF. `cli-runtime` was
   empty in every bundle: `nx build` emptied `dist/apps/ethlete-studio` after it was written, so
   `beforeBuildCommand` now builds first. CSP not checked in a release build.
6. Changeset for `ethlete-studio`; release paragraph in `AGENTS.md`.

Risks: unreleased branch pinned by commit (a fix needs a new rev and a new npm alpha); X11 only;
open Linux issues for focus (#16251, #16351), drag and drop (#16131), window drag (#16294) and IPC
with DevTools open (#15764); bundles grow by about 100-200 MB.

## As built (B469) - macOS spike, 2026-11-10

Spike on ethlete-mac (Intel i7, x86_64, macOS 15.6), `tauri-runtime-cef` at the same rev, `@tauri-apps/cli-cef`
3.0.0-alpha.27, CEF 151 (`cef-dll-sys` 151.8.1). Not committed: the release would then link CEF on macOS, which is
the human's decision. The change is three gates: `tauri-runtime-cef` under
`cfg(any(target_os = "linux", target_os = "macos"))` (the Wayland crates stay Linux only), `tauri-runtime-wry` under
`cfg(target_os = "windows")`, and the same `any(...)` on `cef_entry_point` in `main.rs` and on `.runtime(Cef)` in
`lib.rs`. `cargo check` and the build pass with no other code change; `Cargo.lock` does not change.

1. **Runs.** `tauri build --bundles app,dmg` bundles `Chromium Embedded Framework.framework` and five helper apps
   (`<binary> Helper`, `(GPU)`, `(Renderer)`, `(Plugin)`, `(Alerts)`), built at bundle time. CEF downloads into
   `~/.cache/tauri-cef` (505 MB). A cold build takes about 5 min, a warm one 2 min. Studio starts, opens the
   project, and the sketch `components/button` shows six live frames from the design server, with no console error.
   This needed the CSP fix of finding 699; the WKWebView release build has the same defect.
2. **Size (x64).** WKWebView: `.app` 109 MiB (94 MiB of it `cli-runtime`), `.dmg` 30.1 MiB, update `.app.tar.gz`
   about 30 MiB. CEF, signed: `.app` 443 MiB (framework 326 MiB), `.dmg` 177.2 MiB, update tarball 177.6 MiB. So each
   download and each update grows by about 147 MiB. Apple Silicon not measured; the framework is of a similar size.
3. **Signing.** With a throwaway self-signed identity in a temporary keychain (the CI path), the bundler signs 13
   items inner first (framework libraries, framework, helpers, binary, app) with hardened runtime. The helpers get
   `allow-jit`, `allow-unsigned-executable-memory` and `disable-library-validation`.
   `codesign --verify --deep --strict` passes, the `.dmg` is signed, the signed app runs, and `spctl` rejects it,
   as it rejects today's bundle. **Notarization is not tested:** it needs an Apple Developer Program membership,
   a "Developer ID Application" certificate and notary credentials (App Store Connect API key or Apple ID with an
   app password). None exists; the release identity is self-signed. Hardened runtime, the precondition, is in place.

Seen on the way: macOS asks for notification permission twice, for "Ethlete Studio" and for "ethlete-studio Helper"
(the helper name comes from the binary name). A CEF window that other windows cover paints nothing, so
`screencapture -l` gives a black picture; check over CDP instead. Each run logs
`process_requirement.cc ... Signature validation of current process failed (-67030)`; it has no effect seen.
Finding 700 has the two upstream defects of the debug port.

## As built (B482) - release smoke, 2026-11-10

Cause: no check opened a release build of Studio, so the CSP of finding 699 shipped unseen. Fix: `yarn
studio:release-smoke` (`tools/studio-release-smoke/smoke.mjs`) starts a macOS CEF release bundle once with an empty
`HOME` (only `design-roots.json` naming the checkout), opens `sdk` `sketch:components/button` through the remembered
view, and fails unless a frame paints with no CSP refusal and no console error (`Log.entryAdded` error,
`Runtime.consoleAPICalled` error, `Runtime.exceptionThrown`, iframes included via auto-attach). Without `--app` it
builds: a throwaway worktree at HEAD, `lib.rs` patched to `RemoteDebugging::Port { port: 9339 }` (the shipped build
pins remote debugging off and ignores Chromium switches, so a shipped bundle has no console a script can read),
`@tauri-apps/cli-cef@3.0.0-alpha.27 tauri build --bundles app --no-sign`, target dir `dist/studio-release-smoke/target`.
Measured: the CSP is compiled into the binary as a string, so the bite takes two builds; `--csp-from <rev>` merges the
old `app.security` block over the current one through `tauri build --config` (keys the old block lacks become `null`).
Build time on ethlete-mac: cold 9:17, warm 2:02.

Bite: `yarn studio:release-smoke --csp-from f08f0a3d1^` must fail naming the refusals, `yarn studio:release-smoke`
must pass.

Verified: both bundles build; the patched bundle opens the DevTools port and lists the page `http://tauri.localhost/`.

Not verified: the bite itself. The run was on a locked screen (`CGSSessionScreenIsLocked`), where the Studio page
answers no CDP command (`Runtime.enable` and `Runtime.evaluate` time out; a CDP-created `about:blank` target in the
same browser answers), also with `--disable-backgrounding-occluded-windows` and `--disable-renderer-backgrounding`.
The smoke now refuses to start on a locked screen. Also not verified: Windows (WebView2, no runtime here) and Linux
CEF. Not wired into `publish.yml`: the smoke needs its own patched build (2-9 min) and an unlocked GUI session, and
ADR 0197 keeps slow steps from holding a release; recommendation: a separate `workflow_dispatch` job on
`macos-15-intel` after the first local bite passes. Seen on the way: running a shipped bundle on the real `HOME`
re-pins `devtools.remote_debugging.allowed: false` (finding 700a), which is why the smoke uses its own `HOME`.

## As built (B482, ADR 0255) - console log instead of the debug port, 2026-11-10

What: Studio sets the CEF runtime's `on_console_message` hook (`WebviewWindowBuilderCefExt`, tauri-runtime-cef
`src/tauri_ext.rs`, fed by the display handler in `src/cef_impl/client/display.rs`) on its main window and appends
each `Error`/`Fatal` message as one line (`<unix ms> ERROR <source>:<line> <message>`, newlines escaped) to
`console.log` in the app log directory (`~/Library/Logs/io.ethlete.studio/` on macOS), always on; the file is dropped at
start once it passes 1 MiB. `ETHLETE_STUDIO_CONSOLE_LOG` overrides the path. To attach the hook, the `main` window is
`"create": false` in `tauri.conf.json` and `src-tauri/src/console_log.rs` builds it in `setup` (the macOS WebKit
rebuild path goes through the same builder). Windows (wry) has no hook and writes nothing.

The smoke (`tools/studio-release-smoke/smoke.mjs`) no longer patches `lib.rs` and no longer reads CDP (`cdp-log.mjs`
is gone): it starts the bundle with its own `HOME`, `ETHLETE_STUDIO_CONSOLE_LOG` and `ETHLETE_STUDIO_SMOKE_VIEW`
(the remembered view as JSON). With the last one set, the app adds an initialization script that seeds
`ethlete-studio.call-view` when it is empty and, once a sketch frame paints, writes
`console.error('[studio-release-smoke] painted <n> of <m> live frames')`. The smoke waits for that marker line, waits
8 s more, then fails on any other line (CSP refusals split out). Without the marker it fails as "no frame painted".
`--app` now takes any bundle, a shipped one included.

Verified: `cargo check`, `cargo clippy --all-targets`, the two `console_log` unit tests; a bundle built from the
working tree carries the new code. Ran `yarn studio:release-smoke --app <that bundle>` on a locked screen: FAIL, no
frame painted in 90 s, empty log. Suspect: CEF on a locked macOS session never runs the page; the CEF profile's
`Local Storage` held no key, so even the initialization script did not run.

Not verified: that the hook writes a line from a real bundle (needs an unlocked screen), the bite
(`yarn studio:release-smoke --csp-from f08f0a3d1^` must fail naming the refusals, plain `yarn studio:release-smoke`
must pass), the Windows and Linux builds of `console_log.rs`.

## As built (B482 rest, findings 746 and 749) - the macOS smoke passes, 2026-11-10

The empty log on macOS had a config cause, not the locked screen: `tauri.macos.conf.json` replaced the `windows` array
without `"create": false`, so Tauri built the window without the hook (ccf39547a, with a Rust test that every platform
config sets it). The smoke now opens the sketch target from `sketch.json` (4871b83a3), counts painted shot pictures
(e50636eaf) and names what it waits for (7f7042561). Verified on an unlocked Mac: plain smoke PASS, 0 CSP refusals and
0 console errors; the bite `--csp-from 'f08f0a3d1^'` FAIL with 17 CSP refusals. Not verified: the Windows and Linux
builds of `console_log.rs`. The smoke needs a fresh `dist/libs/cli`, else the design server stops and the smoke reports
only "sketch view missing".

## As built (B480) - Windows spike on `rack`, 2026-11-11: blocked by Smart App Control

Set up on `rack` (Windows 11 Pro, PowerShell 5.1 over SSH, every script sent as
`powershell -NoProfile -EncodedCommand <base64 UTF-16LE>`): `winget install -e --silent` of `Git.Git` (2.55.0),
`OpenJS.NodeJS.LTS` (v24.19.0; `OpenJS.NodeJS --version 24.17.0` has no winget package), `Rustlang.Rustup`
(rustc 1.99.1, `stable-x86_64-pc-windows-msvc`) and `Microsoft.VisualStudio.2022.BuildTools` with
`--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended`, all without a prompt. Scratch copy:
`git archive HEAD` (cd85458e0) unpacked to `C:\b480\ethdk`, `git init` there. `yarn install` passed in 87 s. The
spike patch, scratch only: `tauri-runtime-cef` and every `any(target_os = "linux", target_os = "macos")` gate in
`Cargo.toml`, `main.rs`, `lib.rs` and `console_log.rs` widened by `target_os = "windows"`, the Windows
`tauri-runtime-wry` dependency dropped, and its three `#[cfg(target_os = "windows")]` items in `lib.rs` and
`console_log.rs` turned off.

1. **Runs: not measured.** `cargo check` (with `CEF_PATH=C:\b480\cef`) failed after 142 s:
   `could not execute process ...\build-script-build (never executed)`, `Eine Anwendungssteuerungsrichtlinie hat
diese Datei blockiert. (os error 4551)`. Cause: Smart App Control is on in enforce mode
   (`HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy` `VerifiedAndReputablePolicyState = 1`; the CodeIntegrity
   log has event 3118 "Smart App Control Block" for each). It blocked 4 cargo `build-script-build.exe`, dart-sass's
   `dart.exe` (`spawn UNKNOWN [plugin angular-sass]` in `query:build:production`) and the swc native `.node` module.
   So neither the Rust host nor the Angular frontend builds on `rack` today. The CEF download never started
   (`C:\b480\cef` absent).
2. **Live frames: not measured** (no build).
3. **Size: not measured** (no bundle).
4. **Signature: not measured.** Suspect: the unsigned NSIS installer and an unsigned CEF bundle are blocked
   the same way on any PC with Smart App Control in enforce mode, so signing on Windows may be a must, not an
   option. The current Windows installer is not signed.

Also found: the Nx targets `core:build-generators`, `query:build-generators` and `components:build-generators`
run `rm -rf`, which `cmd` does not know; with `C:\Program Files\Git\usr\bin` first on `PATH` they pass. Any native
Windows build of the repo needs that.

Open for the human: Smart App Control cannot be turned back on without a Windows reinstall, and `rack` is a guest
PC. The spike goes on only after one of: turning Smart App Control off on `rack`, a Windows PC or VM without it,
or the move of the dev PC to Windows. The setup above and the patch stay in `C:\b480` on `rack`.
