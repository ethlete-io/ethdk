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

Three consequences worth knowing before changing it:

- **The window carries out every operation**, and the host addresses it by label. A broadcast would
  make a second window file the same ticket a second time, and no reply can undo that.
- **A non-200 status means the endpoint could not carry the request at all.** Whether the operation
  succeeded is in the body, because a key Jira does not know says nothing about the endpoint.
- **`worklog.add` writes a row onto the day**, not a Tempo worklog. It goes through the same review as
  every other row, which is what keeps it from double-booking against what the evidence proposed.

## Connecting Google Calendar

Each user registers their own OAuth client, so there is a one-time setup in the Google Cloud console.
The consent screen now lives under **Google Auth Platform**, in the **Overview**, **Branding**,
**Audience**, **Clients** and **Data access** tabs:

1. Create a project, then enable the **Google Calendar API** in it.
2. Open **APIs & Services → OAuth consent screen**, which redirects to the Google Auth Platform. Run
   **Get started** and set the audience to **External**.
3. On the **Audience** tab, leave the publishing status at **Testing** and add your own address under
   **Test users**. Google shows an unverified-app warning until you do.
4. On the **Data access** tab, add the two scopes from `GOOGLE_CALENDAR_SCOPES`
   (`libs/timetrack/src/lib/google-auth/oauth.ts`): `calendar.events.readonly` and
   `calendar.readonly`. Both are sensitive, but a project in **Testing** needs no verification.
5. On the **Clients** tab, create a client of type **Desktop app**. No redirect URI has to be
   registered — Google allows any `127.0.0.1` port for an installed application.
6. Paste the client id and the client secret into Settings, press **Connect**, then pick the
   calendars that count as work. Nothing is read until a calendar is picked.

## Still to build

The confirm step that executes a Tempo sync, and the hard pause. See the phase 1 list in
`plans/timetrack.md`.
