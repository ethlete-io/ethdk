# Ethlete Studio on the CEF runtime (Linux)

Status: slice 1 in progress (2026-10-26). Slice 2 researched, not started.

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

Steps:

1. Install `@tauri-apps/cli-cef` for the Studio Linux leg only. The other legs and Timetrack keep
   `@tauri-apps/cli`, because cli-cef is a 3.0 alpha.
2. `.github/workflows/publish.yml` job `apps-bundle` (l.119-123): for Studio on Linux drop
   `libwebkit2gtk-4.1-dev`, add `libgtk-3-dev` and what the build asks for.
3. Cache the CEF dir on the cef crate version from `Cargo.lock`; export `CEF_PATH`.
4. Build only deb and rpm for Studio on Linux until #16204 is fixed. The upload globs and
   `latest.json` need no change.
5. Check that `bundle.resources` (`cli-runtime`) and the CSP still work under CEF.
6. Changeset for `ethlete-studio`; release paragraph in `AGENTS.md`.

Risks: unreleased branch pinned by commit (a fix needs a new rev and a new npm alpha); X11 only;
open Linux issues for focus (#16251, #16351), drag and drop (#16131), window drag (#16294) and IPC
with DevTools open (#15764); bundles grow by about 100-200 MB.
