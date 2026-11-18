---
name: app-releases
description: "How the Tauri apps and the SDK are released: publish.yml, signing, updater key, CEF runtime. Read before touching publish.yml, tools/changesets-action, tauri.conf.json, Cargo files, release scripts or the updater."
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
`plugins.updater.endpoints` lists the GitHub release first and
`https://elrond.invalid/updates/<app>/latest.json` second (ADR 0342, 0345; `elrond.invalid` stands in for
elrond's real host): the plugin tries the next endpoint when one fails or answers non-2xx, so the
self-hosted one takes over once the repo is private. Keep that order until every installed app has it.
elrond pulls (ADR 0346): `apps-release` uploads `latest-elrond.json` next to `latest.json`, with each url
rewritten to `$MIRROR_BASE/<app>/<tag>/<file>`; elrond mirrors those files and serves it as `<app>/latest.json`.
`MIRROR_BASE` in publish.yml and the second endpoint change together.

On Linux both apps, and on macOS Studio, run on Tauri's CEF (Chromium) runtime from its `feat/cef`
branch (ADR 0249); Timetrack on macOS and both apps on Windows run on wry. The Studio macOS bundle is
built by `@tauri-apps/cli-cef` too and is about 147 MiB larger. Studio's `tauri`, `tauri:dev` and `tauri:build` targets go through
`tools/scripts/studio-tauri.mjs`, which picks cli-cef off Windows: the plain CLI starts a bare binary
that cannot find the CEF framework. The branch's `tauri` has no runtime of its own, so `lib.rs` names one per platform, and
a plugin whose crates.io release asks for tauri's `wry` feature is patched to plugins-workspace's
`feat/cef` branch. Building needs the GTK 4
headers (`sudo dnf install gtk4-devel`, `libgtk-4-dev` on Debian). The first build downloads CEF
(~1.8 GB unpacked) into `src-tauri/target/cef`. Studio appends every console error of its window to `console.log` in its app log
directory (`~/Library/Logs/io.ethlete.studio/` on macOS; `ETHLETE_STUDIO_CONSOLE_LOG` overrides the path), and
`yarn studio:release-smoke` reads that file, so a shipped bundle needs no debug port.

## Private switch

The repository variable `CI_SELF_HOSTED` (ADR 0342, 0344) is unset, so CI runs on `ubuntu-latest`. Set to `true`, every
Linux job runs on `[self-hosted, linux, x64, ethdk]` (the org runner `runner-ethlete`). A pull request from a fork stays on
`ubuntu-latest`. Not switched: the Tauri bundles and the macOS WebKit job. Leave it off until the runner group admits
this repo.

The switch also moves publishing (ADR 0345, 0346): off, `publish.yml` and `api-models.yml` publish to npmjs through
trusted publishing (OIDC); on, they publish to the Verdaccio in the repository variable `VERDACCIO_URL`
(`http://78.46.42.73:54873`) with the repository secret `VERDACCIO_TOKEN`, no provenance (`publish.yml` through
`tools/scripts/release-verdaccio.mjs`). Verdaccio needs a token to read `@ethlete/*` too, so each consumer (bvb-, dfb-,
dyn-, fut-, vbl-frontend, fifa) maps the scope in its `.yarnrc.yml` before the npmjs packages are deleted:
`npmScopes: ethlete: { npmRegistryServer: "http://78.46.42.73:54873/", npmAuthToken: "${VERDACCIO_TOKEN}" }` and
`unsafeHttpWhitelist: ["78.46.42.73"]`.
