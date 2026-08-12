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
  libayatana-appindicator-gtk3-devel gtk3-devel patchelf perl-FindBin
```

`perl-FindBin` is needed because `rusqlite`'s `bundled-sqlcipher-vendored-openssl` feature builds
OpenSSL from source, and its `Configure` script needs that module. Building OpenSSL rather than
linking the system one is deliberate: it is the difference between a clean checkout building
everywhere and every machine needing its own `OPENSSL_DIR`.

macOS needs only Xcode's command line tools — perl there already ships `FindBin`.

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

The TypeScript adapters are in `src/host/`; `injectHostPorts()` hands the core a `TimetrackPorts`.

Two constraints the code depends on:

- **A non-2xx response is data, not an error.** The providers read the status and body to tell a
  quota breach from a bad token, so `http_request` reports every response it gets.
- **`run_process` runs an allowlist.** The webview may ask for `git` and the agent CLIs and nothing
  else — an open spawn command would turn any script that reaches the webview into code execution.

## Still to build

The collectors (window and idle, the inotify watch on `.git/HEAD`, the reader behind
`AgentSessionLogReader`), Google's OAuth dance, the day-review UI, and the tray. See the phase 1
list in `plans/timetrack.md`.
