# Ethlete Studio on the CEF runtime

Linux (slices 1 and 2), the macOS spike (B469) and the macOS release smoke are built; git and ADR 0242, 0249, 0250,
0255, 0258 and 0266 hold them. This file keeps the open rest.

## Risks that stay

Unreleased `tauri-runtime-cef` branch pinned by commit (a fix needs a new rev and a new npm alpha, `@tauri-apps/cli-cef`
is a 3.0 alpha); CEF forces X11 on Linux; open upstream issues for focus (#16251, #16351), drag and drop (#16131),
window drag (#16294) and IPC with DevTools open (#15764); AppImage broken upstream (#16204), so Linux ships deb and rpm;
bundles grow by about 100-200 MB (macOS about 147 MiB). Notarization on macOS is untested: it needs an Apple Developer
Program membership, a "Developer ID Application" certificate and notary credentials, and none exists. CSP of a Linux
release build not checked.

## B480 Windows spike on `rack`

State after findings 870, 874 and 878: the CEF release build runs on `rack` and the button sketch paints (Local Network
Access to loopback is allowed in the CEF runtime, 37eebcfda); installer 141.17 MiB, installed 453 MiB, not signed. The
smoke probe counts `ethlete-canvas-frame-cell[data-painted]` and fails with `FAILED: nothing painted` after 60 s; not
verified live. Smart App Control is off on `rack` (ADR 0266).

Open:

- Signature: whether an unsigned NSIS installer and CEF bundle are blocked on a PC with Smart App Control in enforce
  mode, so signing on Windows may be a must. Not measured. The current Windows installer is not signed.
- The human confirms the switch to Windows after the spike (ADR 0242).
- Any native Windows build of the repo needs `C:\Program Files\Git\usr\bin` first on `PATH`: the Nx targets
  `core:build-generators`, `query:build-generators` and `components:build-generators` run `rm -rf`.
- The spike patch is scratch only (`C:\b480` on `rack`): `tauri-runtime-cef` and the `linux`/`macos` gates in
  `Cargo.toml`, `main.rs`, `lib.rs` and `console_log.rs` widened by `windows`, the Windows `tauri-runtime-wry`
  dependency dropped.

## B482 release smoke

`yarn studio:release-smoke` passes on macOS (0 CSP refusals, 0 console errors) and its bite
`--csp-from 'f08f0a3d1^'` fails with 17 CSP refusals. Open:

- It is not wired into `publish.yml`: it needs its own build (2-9 min) and an unlocked GUI session, and ADR 0197 keeps
  slow steps from holding a release. Recommendation: a separate `workflow_dispatch` job on `macos-15-intel`.
- Not verified: the Windows and Linux builds of `console_log.rs`; Linux CEF and Windows WebView2 smoke runs.
- It needs a fresh `dist/libs/cli`, else the design server stops and the smoke reports only "sketch view missing".
