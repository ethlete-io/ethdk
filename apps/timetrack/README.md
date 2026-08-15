# timetrack

The desktop shell for `@ethlete/timetrack`. The library is the deterministic part — it holds the
model, the correlation pipeline and the providers, and it never makes a call or touches a file. This
app is the half that does: it owns the encrypted database, the keychain, every outbound request, and
the collectors that watch the day.

`plans/timetrack.md` in the repo root is the living spec.

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
and the sources screen offers the button that asks for it; granting it needs no restart. Expect to
grant it again after a rebuild, because macOS keys the grant to the binary it saw.

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

## What the host owns

| Command                                                  | Port it satisfies        |
| -------------------------------------------------------- | ------------------------ |
| `http_request`                                           | `TimetrackTransport`     |
| `secret_read` / `secret_write`                           | `TimetrackSecretStore`   |
| `events_*`, `agent_session_cursors`, `compacted_through` | `TimetrackEventStore`    |
| `ledger_*`                                               | `TimetrackLedgerStore`   |
| `run_process`                                            | `TimetrackProcessRunner` |
| `oauth_authorize`                                        | The Google connect flow  |

The TypeScript adapters are in `src/host/`; `injectHostPorts()` hands the core a `TimetrackPorts`.

Two constraints the code depends on:

- **A non-2xx response is data, not an error.** The providers read the status and body to tell a
  quota breach from a bad token, so `http_request` reports every response it gets.
- **`run_process` runs an allowlist.** The webview may ask for `git` and the agent CLIs and nothing
  else — an open spawn command would turn any script that reaches the webview into code execution.
- **`oauth_authorize` owns the redirect.** It binds the loopback port, so it is what builds the
  `redirect_uri`, the PKCE challenge and the `state`. It reports the redirect and the verifier back
  with the code, because the token exchange is rejected unless it repeats the same pair.

## Connecting Google Calendar

Each user registers their own OAuth client, so there is a one-time setup in the Google Cloud console:

1. Create a project, then enable the **Google Calendar API** in it.
2. Configure the OAuth consent screen as **External**, and add your own address under **Test users**.
   Google shows an unverified-app warning until you do.
3. Create an OAuth client of type **Desktop app**. No redirect URI has to be registered — Google
   allows any `127.0.0.1` port for an installed application.
4. Paste the client id and the client secret into Settings, press **Connect**, then pick the
   calendars that count as work. Nothing is read until a calendar is picked.

## Still to build

The confirm step that executes a Tempo sync, and the hard pause. See the phase 1 list in
`plans/timetrack.md`.
