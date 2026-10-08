# timetrack

The desktop shell for `@ethlete/timetrack`. The library is the deterministic part — it holds the
model, the day pipeline and the providers, and it never makes a call or touches a file. This
app is the half that does: it owns the encrypted database, the keychain, every outbound request, and
the collectors that watch the day.

`plans/timetrack/roadmap.md` in the repo root lists the work still to build.

## Prerequisites

A Rust toolchain (`rustup`, stable) plus the platform's webview and crypto build dependencies.

Fedora:

```bash
sudo dnf install -y webkit2gtk4.1-devel libsoup3-devel librsvg2-devel \
  libayatana-appindicator-gtk3-devel gtk3-devel patchelf perl
```

`perl` is the whole point of that last entry: Fedora may only have `perl-interpreter`, its minimal
perl, and `rusqlite`'s `bundled-sqlcipher-vendored-openssl` feature builds OpenSSL from source with a
`Configure` script that reaches all over perl's standard library — `FindBin`, `IPC::Cmd`,
`File::Compare`, `File::Copy`, `Pod::Html`, `Time::Piece` and more. Install the full `perl`
metapackage. Do **not** add them one at a time: `Configure` aborts on the first module it misses, so
each install reveals exactly one more and the whole exercise takes as many rounds as there are
modules. (`perl-core` is not a Fedora 44 package.)

Building OpenSSL rather than linking the system one is deliberate: it is the difference between a
clean checkout building everywhere and every machine needing its own `OPENSSL_DIR` — Fedora has
`openssl-devel`, but macOS ships LibreSSL with no headers.

macOS needs only Xcode's command line tools — perl there already ships all of these. Install the
toolchain with Homebrew (`brew install rustup && rustup toolchain install stable`); `sh.rustup.rs`
does not resolve on every network, and the formula installs `rustup` without `rustup-init`.

### The Accessibility permission, on macOS

The window source collects idle time and the frontmost application without any permission, and the
**window title** only with Accessibility. Until it is granted the source reports `macos-app-only`
and the sources screen offers the button that asks for it; granting it needs no restart. macOS keys
the grant to the binary it saw, so an unsigned build asks again after every rebuild - the signing
identity below is what stops that.

### The signing identity, on macOS

Run this once per machine. It needs no login password and works over SSH:

```bash
apps/timetrack/src-tauri/tools/macos-dev-identity.sh
```

It creates a self-signed code-signing certificate in a keychain of its own
(`~/Library/Keychains/timetrack-dev-signing.keychain-db`, password in
`~/.config/timetrack/dev-signing-keychain-password`) and puts that keychain on the search list.
`tools/macos-dev-sign.sh` signs a build with it:

- `yarn timetrack` (`tauri dev`) - the cargo runner in `src-tauri/.cargo/config.toml` signs the
  binary before each start.
- A debug `.app` - `npx nx run timetrack-app:tauri:dev-app` bundles and signs it. Without node,
  run `tools/macos-dev-sign.sh target/debug/bundle/macos/Timetrack.app` in `src-tauri` after
  `tauri build --debug --bundles app`.

An unsigned or ad-hoc build is identified by its file hash, which every build changes. Two grants
then break at each rebuild:

- **Every keychain item** asks for the login password again. "Always Allow" writes the binary's
  identity into the item's ACL, and the app reads several items on boot.
- **The Accessibility and local network permissions** have to be granted again.

A certificate gives every build the designated requirement
`identifier "io.ethlete.timetrack" and certificate leaf = H"…"`, so both grants hold. The first
signed start asks once per item; answer "Always Allow". A release build has its own certificate, so
dev and release each hold their own grant on the same items.

Dev and release builds share the keychain service and the data directory, both keyed by
`io.ethlete.timetrack`.

To undo it:

```bash
security delete-keychain ~/Library/Keychains/timetrack-dev-signing.keychain-db
rm ~/.config/timetrack/dev-signing-keychain-password
```

An identity named "Timetrack Dev Signing" in the login keychain is from an earlier version of the
script and unused: `security delete-identity -c "Timetrack Dev Signing" ~/Library/Keychains/login.keychain-db`.

A plain `tauri build` signs ad-hoc at most. Set `APPLE_SIGNING_IDENTITY` to sign a bundle.

## Running it

```bash
yarn timetrack                     # dev server + the Tauri window
yarn timetrack:build               # a bundled desktop app
npx nx serve timetrack-app         # the Angular half alone, in a browser
```

`nx serve` on its own reaches no host command — every port is a Tauri `invoke` — so the app reports
that it is not running inside the shell rather than failing obscurely. Use it for UI work only.

`tauri:dev` and `tauri:build` are deliberately outside the default CI pipeline and the `ci-check`
skill: they need a Rust toolchain and a per-OS matrix that the Angular libraries do not.

`yarn timetrack` builds the host with the `transcribe` cargo feature, so it compiles whisper.cpp and
needs `cmake` on the `PATH`. The call transcript stays off until it is turned on in Settings.

## Where the window comes back

The window's size, its position and whether it was maximised or minimised are stored in
`window-placement.json` beside the database. It is written when the window is closed to the tray and
when the app quits, and applied before the window is drawn — which is why the main window is declared
`"visible": false` in `tauri.conf.json`: `placement::restore` is the only thing that shows it. It is
applied again on every reveal, because a window hidden to the tray is unmapped and the compositor
decides the geometry of every window it maps.

Three limits are worth knowing:

- **Wayland lets no client place its own window.** The position applies on X11, macOS and Windows
  only. On Wayland the compositor places the window and the stored position reads `0,0`.
- **A window rule that fixes the size beats the app.** A niri rule with `default-column-width` or
  `default-window-height` for app-id `timetrack` overrules the stored size at every open, and no
  request from the app takes it back. Leave the size out of the rule and niri honours the stored one.
- **A tiling compositor may have no minimize.** niri has none, so the stored `minimized` does nothing
  there.

A window hidden to the tray is not stored as minimised. Reopening it is how the user asks for it back,
and a start with no window at all reads as an app that failed to open.

## What the host owns

| Command                                                  | Port it satisfies        |
| -------------------------------------------------------- | ------------------------ |
| `http_request`                                           | `TimetrackTransport`     |
| `secret_read` / `secret_write`                           | `TimetrackSecretStore`   |
| `events_*`, `agent_session_cursors`, `compacted_through` | `TimetrackEventStore`    |
| `ledger_*`                                               | `TimetrackLedgerStore`   |
| `run_process`                                            | `TimetrackProcessRunner` |
| `oauth_authorize`                                        | The Google connect flow  |
| `agent_reply`, `agent_status`                            | The agent endpoint       |

The TypeScript adapters are in `src/host/`; `injectHostPorts()` hands the core a `TimetrackPorts`.

Two constraints the code depends on:

- **A non-2xx response is data, not an error.** The providers read the status and body to tell a
  quota breach from a bad token, so `http_request` reports every response it gets.
- **`run_process` runs an allowlist.** The webview may ask for `git` and the agent CLIs and nothing
  else — an open spawn command would turn any script that reaches the webview into code execution.
- **`oauth_authorize` owns the redirect.** It binds the loopback port, so it is what builds the
  `redirect_uri`, the PKCE challenge and the `state`. It reports the redirect and the verifier back
  with the code, because the token exchange is rejected unless it repeats the same pair.

## The agent endpoint

A coding agent in any repository on this machine reaches Jira through this app, so no checkout holds
a Jira token. `ethlete-agents timetrack …` in `@ethlete/agent-rules` is the client; the contract is
`libs/timetrack/src/lib/agent-api/`.

`agent.rs` binds a loopback socket, writes the port and a per-run token into `agent.json` beside the
database (mode `0600`), and hands each request to the main window. It interprets nothing but the
`op`, exactly as the ingest endpoint interprets nothing but `atMs` and `kind` — the window is where
the Jira client, the settings and the day already live, and a second implementation of any of them in
Rust would be a second set of rules about what may be written.

Four consequences worth knowing before changing it:

- **The window carries out every operation**, and the host addresses it by label. A broadcast would
  make a second window file the same ticket a second time, and no reply can undo that.
- **A non-200 status means the endpoint could not carry the request at all.** Whether the operation
  succeeded is in the body, because a key Jira does not know says nothing about the endpoint.
- **`worklog.add` writes a row onto the day**, not a Tempo worklog. It goes through the same review as
  every other row, which is what keeps it from double-booking against what the evidence proposed.
- **`day.edits` is the only write into the review store from outside the window.** It names rows by
  the ids `day.rows` answers, and both move the app's own review to that day, so nothing changes a day
  the user cannot see. It may correct a row's times, its name, its note and whether it syncs; it may
  not split, merge or delete one.

## Connecting Google Calendar

A release build carries one shared Google OAuth client, so a user registers nothing.

1. Open **Settings** and press **Connect**. The browser opens Google's consent page.
2. Until the app is verified, Google shows an **unverified app** screen. Click **Advanced**, then
   **Go to Timetrack (unsafe)**, and continue.
3. Press **Allow**, then pick the calendars that count as work. Nothing is read until a calendar is
   picked.

When Google later rejects the stored access (revoked, or expired), Settings shows **Reconnect Google
Calendar**. Press it and allow again.

### Maintainers: the shared client

Done once, by the team:

1. Create one Google Cloud project and enable the **Google Calendar API** in it.
2. Under **Google Auth Platform**, run **Get started** and set the audience to **External**. On the
   **Audience** tab, publish the app to **Production**.
3. On the **Data access** tab, add the two scopes from `GOOGLE_CALENDAR_SCOPES`
   (`libs/timetrack/src/lib/google-auth/oauth.ts`): `calendar.events.readonly` and
   `calendar.readonly`. Both are sensitive, so Google shows the unverified-app screen until the app
   passes verification.
4. On the **Clients** tab, create a client of type **Desktop app**. No redirect URI has to be
   registered; Google allows any `127.0.0.1` port for an installed application.
5. Store the client id and secret as the GitHub secrets `TIMETRACK_GOOGLE_CLIENT_ID` and
   `TIMETRACK_GOOGLE_CLIENT_SECRET`. `publish.yml` passes them to the bundle build, and
   `src-tauri/src/google_client.rs` bakes them in with `option_env!`. A build without them logs a
   warning and ships no client. A Desktop client's secret is not confidential, but it stays out of
   the repository.

A local build without these variables has no shared client, so Settings shows the client fields. To
try one locally, export both variables before `yarn timetrack`.

### Your own client (advanced)

A client of your own wins over the shared one. In Settings press **Use your own OAuth client**, or
use it for a build without a shared client. Setup is the maintainer steps above in your own project,
with two differences: leave the publishing status at **Testing** and add your address under **Test
users** (a project in Testing needs no verification), then paste the client id and secret into
Settings and press **Connect**.

## Still to build

See `plans/timetrack/roadmap.md`.
