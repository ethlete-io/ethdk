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
   This needed the CSP fix of finding 698; the WKWebView release build has the same defect.
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
Finding 699 has the two upstream defects of the debug port.
