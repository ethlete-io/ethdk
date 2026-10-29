---
name: app-releases
description: How the Tauri apps (timetrack-app, ethlete-studio) and the SDK are released - publish.yml, the vendored Changesets action, versions:sync, the per-OS bundles, signing, the auto-updater key, and the CEF runtime on Linux. Read before touching publish.yml, tools/changesets-action, tauri.conf.json, Cargo files, the release scripts, or the app updater.
---

# App and SDK releases

`publish.yml` runs the vendored Changesets action in `tools/changesets-action` (upstream
`changesets/action` v2 plus a Slack notification). Its README names the upstream commit.

The two Tauri apps are versioned the same way, under the names `timetrack-app` and
`ethlete-studio`. Each is a private workspace package, so `changeset version` bumps it but
never publishes it, and `yarn versions:sync` copies the new version into `tauri.conf.json`,
`Cargo.toml` and `Cargo.lock`. Those three files are generated - change the app's
`package.json`, or write a changeset, and run `yarn versions:sync`. `yarn versions:check`
fails CI on drift.

When `publish.yml` finds an app version with no GitHub release, it builds the Linux (deb, rpm),
macOS (dmg, Apple Silicon and Intel) and Windows (NSIS installer) bundles and publishes them as the release `<app>@<version>`. The Linux bundles carry CEF
and are built by `@tauri-apps/cli-cef`, so they are deb and rpm only - a CEF AppImage is broken
upstream (tauri-apps/tauri#16204). The macOS bundle is
signed with a self-signed identity, so a keychain grant survives an update. It is not notarized, and
the Windows installer is not signed. `tools/scripts/macos-release-identity.sh` makes the identity;
running it again replaces it, and each keychain item then asks once more.

The apps update themselves with `tauri-plugin-updater`. The same job signs each update bundle with the
key in the secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and writes
`latest.json` into the fixed release `<app>-updates`, which the app reads at startup. The public key is
`plugins.updater.pubkey` in `tauri.conf.json`. `tools/scripts/tauri-updater-key.sh` makes the key pair.
Do not run it again: an installed app accepts only its own key, so a new key stops every update. Only a
release build checks for updates, and `createUpdaterArtifacts` is on in CI only.

On Linux, both apps run on Tauri's CEF (Chromium) runtime from its `feat/cef` branch, and macOS and
Windows on wry. The branch's `tauri` has no runtime of its own, so `lib.rs` names one per platform, and
a plugin whose crates.io release asks for tauri's `wry` feature is patched to plugins-workspace's
`feat/cef` branch. Building needs the GTK 4
headers (`sudo dnf install gtk4-devel`, `libgtk-4-dev` on Debian). The first build downloads CEF
(~1.8 GB unpacked) into `src-tauri/target/cef`.
