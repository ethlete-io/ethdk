# Timetrack security audit

Date: 2026-09-16. Status: findings recorded; remediation not implemented.

## Scope and conclusion

Source review of the Rust host, desktop capabilities, frontend, and relevant
`libs/timetrack` code. Timetrack has useful protections, but should not yet be
considered watertight for the personal information it collects.

The principal attack chain is renderer compromise → unrestricted native commands →
personal files, provider credentials, and the database encryption key. No remote entry
point or working XSS exploit was established. Findings that require renderer compromise
are failures of containment, not evidence that an arbitrary website can currently exploit
the app. The agent API findings instead require access to its local bearer token, normally
available to processes running as the same OS user.

This was not a packaged-app penetration test. `cargo audit` was unavailable, but the Rust
lockfile was queried against OSV and Yarn's advisory scan was run; their results appear below.
No production credentials or personal records were read to demonstrate the findings. The only
execution proof was a harmless Git alias printing a marker; it verified the argument-level bypass,
not an end-to-end exploit through Tauri.

## Findings

### SEC-01 — High: process allowlist permits arbitrary command execution

Evidence: [`process.rs`](../../apps/timetrack/src-tauri/src/process.rs), `run_process`.

The host checks the executable name but accepts arbitrary arguments, working directory,
and stdin. Git can execute shell commands through a command-line alias. This harmless
proof printed `TIMETRACK_COMMAND_EXECUTION_CONFIRMED`:

```sh
git -c 'alias.timetrack-security-proof=!printf TIMETRACK_COMMAND_EXECUTION_CONFIRMED' timetrack-security-proof
```

A script able to invoke this command through the renderer can execute commands with the
user's privileges. The executable allowlist does not provide the intended containment.

Remediation: replace the general runner with specific operations whose arguments are
constructed and validated by the host. Constrain working directories and environment as
appropriate. Do not rely on executable names alone.

Verification: exercise the actual IPC boundary with malicious Git configuration arguments
and other unsupported operations; confirm rejection while supported collection and model
operations still work.

### SEC-02 — High: internal database key is exposed through secret commands

Evidence: [`secrets.rs`](../../apps/timetrack/src-tauri/src/secrets.rs), `secret_read`,
`secret_write`, and `secret_delete`; [`keychain.rs`](../../apps/timetrack/src-tauri/src/keychain.rs),
`DATABASE_KEY_ACCOUNT`.

The commands accept arbitrary keychain account names within Timetrack's service, including
`database-key`. A compromised renderer can request the encryption key and provider tokens.
It can also replace or remove the database key, potentially making stored data inaccessible
after restart. This does not imply access to arbitrary other applications' keychain services.

Remediation: keep internal keys inaccessible through IPC. Keep provider credentials in Rust
and attach them to narrowly scoped provider requests there. Allow only explicitly supported
credential-management operations from the settings UI.

Verification: reject read, write, and delete requests for internal accounts from every
webview; verify normal credential setup and provider requests without returning tokens to
the renderer.

### SEC-03 — High: caller controls the log reader's confinement root

Evidence: [`logs.rs`](../../apps/timetrack/src-tauri/src/logs.rs), `agent_log_root` and
`agent_log_lines`.

The file's canonical path is checked against a root supplied by the same IPC caller.
Supplying `/` as the root on Unix defeats the intended confinement and permits reading
accessible newline-delimited text files outside the agent log directories. The reader
does not require that the file was previously listed or that it is a JSONL log.

Remediation: resolve approved roots in the host, independently of each read request.
Validate canonical paths against those roots and account for symlinks. If custom roots
remain supported, authorize their registration separately.

Verification: reject a file outside approved roots even when the caller supplies its parent
or `/` as the root; cover traversal and symlink escapes as well as valid logs.

### SEC-04 — High: window lock does not restrict sensitive API access

Evidence: [`agent.rs`](../../apps/timetrack/src-tauri/src/agent.rs), request dispatch;
[`agent-endpoint.ts`](../../apps/timetrack/src/app/agent/agent-endpoint.ts), `dayEvents$` and
`carryOut$`; [`app.component.ts`](../../apps/timetrack/src/app/app.component.ts), unconditional
endpoint initialization; [`store.rs`](../../apps/timetrack/src-tauri/src/store.rs),
`events_between` and `set_app_settings`.

The agent API continues operating while the window is locked. Its bearer token grants
access to raw day events without privacy filtering, along with Jira creation and review
edits. There is no per-client or per-operation authorization. Processes running as the same
OS user can normally read the discovery token, so the lock is not a boundary against them.

Native data commands also lack lock checks. An IPC caller can change the lock settings
without authenticating. Although the code describes the lock as a window lock, it must not
be presented as protecting access to stored personal information under these conditions.

Remediation: enforce access rules in Rust, separating background collection from interactive
reads and sensitive writes. Require explicit scopes for agent clients, including raw evidence
access, and define whether any scope may operate while locked. Protect lock-setting changes
with authentication. Scope credentials and results to the minimum needed by each operation.

Verification: with a release build locked, attempt raw evidence reads, review mutations,
Jira creation, secret access, and lock-setting changes through their real entry points.
Confirm that background collection continues under the resulting policy.

### SEC-05 — Medium: custom commands are not restricted by window capabilities

Evidence: [`build.rs`](../../apps/timetrack/src-tauri/build.rs),
[`lib.rs`](../../apps/timetrack/src-tauri/src/lib.rs), and
[`widget.json`](../../apps/timetrack/src-tauri/capabilities/widget.json).

The build does not register an application command permission manifest. The widget's
limited capability list therefore does not restrict the sensitive custom commands in
`invoke_handler`. Tauri documents that application commands are available to all app windows
and webviews by default: [Tauri capabilities](https://tauri.app/security/capabilities/).

Remediation: register custom commands in the application permission manifest, define their
permissions, and grant each window only the operations it requires. Combine these static
permissions with the runtime authorization in SEC-04.

Verification: invoke sensitive custom commands from the widget and confirm rejection by
Tauri's permission boundary; confirm that the widget's intended operations still work.

### SEC-06 — Medium: configured HTTP hosts can receive credentials without TLS

Evidence: [`jira/client.ts`](../../libs/timetrack/src/lib/jira/client.ts),
`normalizeJiraHost` and `jiraRequest$`;
[`gitlab/client.ts`](../../libs/timetrack/src/lib/gitlab/client.ts),
`normalizeGitLabHost` and the authenticated request builder;
[`http.rs`](../../apps/timetrack/src-tauri/src/http.rs), `http_request`.

Both provider clients accept explicit `http://` hosts and attach credentials. The native
transport does not require HTTPS or restrict request destinations. A misconfigured HTTP
host can expose tokens and returned personal information to network interception. The
general transport also gives a compromised renderer a native outbound channel that the
webview's CSP does not constrain.

Remediation: require HTTPS in the host, validate provider destinations, and constrain
redirects. Attach credentials only after destination validation. Any development exception
should be explicit and unavailable to ordinary production provider configuration.

Verification: reject HTTP provider URLs before sending credentials; test unapproved
destinations and redirect targets using synthetic tokens and a controlled server.

### SEC-07 — Medium: discovery tokens are written before permissions are restricted

Evidence: `write_discovery` in
[`agent.rs`](../../apps/timetrack/src-tauri/src/agent.rs) and
[`ingest.rs`](../../apps/timetrack/src-tauri/src/ingest.rs).

The code writes the secret before applying Unix mode `0600`. On first creation, a permissive
umask and traversable parent directories can expose the token to another local user during
that interval. Existing correctly restricted files do not necessarily have the same exposure.
The actual accessibility depends on the machine's directory permissions and umask.

Remediation: create secret files with mode `0600` from the outset inside a `0700` directory,
use safe atomic replacement, and avoid following an unexpected symlink. Verify equivalent
access restrictions on supported non-Unix platforms.

Verification: under a permissive umask, ensure that neither an initial file nor a replacement
is ever readable by another user; test unexpected existing file types and symlinks.

### SEC-08 — Medium: raw personal information has no working retention cleanup

Evidence: [`retention.ts`](../../libs/timetrack/src/lib/store/retention.ts), unused retention
planning; [`ADR 0002`](../../libs/timetrack/docs/adr/0002-spend-outlives-raw-events.md), which
records retention as accepted but not built. The app exposes deletion through its adapter
but does not schedule the policy or call it to clean up raw events.

The nominal 30-day policy is not enforced. Raw evidence accumulates indefinitely, increasing
the amount of personal information exposed by a later compromise. This is a privacy and
data-minimization failure, not an independent path into the application.

Remediation: implement compaction and retention together, preserve the intended spend
aggregates, show cleanup status, and provide explicit deletion controls. Define what survives
in review records, derived data, and backups rather than treating raw-event deletion as a
complete erasure policy.

Verification: seed records on both sides of the retention boundary and exercise the scheduled
cleanup, including restart, compaction lag, and failure recovery. Confirm the promised retained
aggregates and the absence of expired raw records.

## Additional findings from the second pass

These findings were identified by further source inspection on 2026-09-16. They have not
been reproduced against a packaged application. Severity reflects their narrower
preconditions and must not be read as evidence of a remote exploit.

### SEC-09 — Medium: authentication failures can leave the app unlocked

Evidence: [`window-lock.ts`](../../apps/timetrack/src/app/window-lock.ts), the error handler
for the initial lock-state request; [`lock.rs`](../../apps/timetrack/src-tauri/src/lock.rs),
`can_lock`, `WindowLock::new`, and `WindowLock::apply`.

Any error fetching the initial lock state sets `ready` to true and `isLocked` to false.
The fallback intended for browser previews is not restricted to previews. Separately, the
host starts unlocked, or clears the lock when applying settings, if the platform reports
that it cannot verify the owner. That behavior also applies to release builds: a saved
preference to lock does not take precedence over authentication becoming unavailable.

This is a fail-open design, distinct from SEC-04's missing API authorization. A particular
attacker-triggerable IPC failure was not established; the source establishes the unsafe
failure behavior, not how frequently it occurs on packaged platforms.

Remediation: separate preview behavior from production behavior. When locking is configured,
authentication or lock-state failures should show a blocked/error state and retain the lock,
with an explicit recovery path rather than displaying private data.

Verification: inject lock-state failures and simulate unavailable authentication in release
configuration. Confirm that no private view mounts and the host remains locked.

### SEC-10 — Medium: tray activity remains visible while the window is locked

Evidence: [`tray-readout.ts`](../../apps/timetrack/src/app/tray-readout.ts), `formatActivity`
and the continuous publication of readouts; [`format.ts`](../../apps/timetrack/src/app/day-review/format.ts),
`formatBlockLabel`; [`tray.rs`](../../apps/timetrack/src-tauri/src/tray.rs), `tray_set_readout`;
[`lock.rs`](../../apps/timetrack/src-tauri/src/lock.rs), `lock`.

The tray menu receives repository and branch names, activity times, and daily totals without
checking the lock. Locking hides the main window and emits an event, but does not clear the
tray text or suppress subsequent updates. Someone at an unlocked desktop can inspect this
information while Timetrack itself is locked. The widget does have a lock-aware display;
that does not protect the separate native tray menu.

Remediation: immediately replace sensitive tray text with a generic locked status when the
app locks, and reject or redact further sensitive readouts in the host until unlock.

Verification: lock during activity, inspect the tray immediately and after a collection tick,
and confirm repository names, branches, times, and totals are absent. This concerns the app
lock, not a claim that the tray is accessible through the operating system's lock screen.

### SEC-11 — Medium: process timeout does not terminate the process

Evidence: [`process.rs`](../../apps/timetrack/src-tauri/src/process.rs), `run_process`;
[`reason/provider.ts`](../../libs/timetrack/src/lib/reason/provider.ts), `retry(1)`.

The timeout drops the future waiting for process output but neither explicitly kills the
child nor enables `kill_on_drop`. Tokio documents that dropping the child handle leaves
the process running by default: [Tokio process cancellation](https://docs.rs/tokio/latest/tokio/process/).
Closing pipes may cause some children to exit, but this is not a termination guarantee.
The reasoning retry can start another model process while the first is still running,
allowing continued processing, resource use, and potentially billable requests after the
app reports a timeout.

Remediation: enforce host-owned timeout limits, terminate and reap the child on cancellation,
and handle descendants using platform-appropriate process groups or job objects. Bound
captured output and concurrent processes as well.

Verification: use a harmless child that survives closed pipes and creates a descendant;
confirm both terminate on timeout before a retry starts, and that cancellation reaps them.

### SEC-12 — Low: one unauthenticated connection can stall OAuth authorization

Evidence: [`oauth.rs`](../../apps/timetrack/src-tauri/src/oauth.rs), `wait_for_code`.

The callback listener accepts one connection and awaits an unbounded `read_line` before
accepting another. A local process that finds the callback port can connect and send no
newline, blocking the real browser callback until the overall authorization timeout. It
does not need the OAuth state or verifier. Sending a very long line also has no explicit
byte limit. This is an availability issue, not an OAuth token theft finding.

Remediation: bound request-line size, apply a short per-connection deadline, and continue
accepting legitimate callbacks despite idle or malformed clients. Keep the overall OAuth
deadline and existing state/PKCE checks.

Verification: hold an idle socket open while a valid callback arrives, and send an oversized
line. The valid callback should still succeed and oversized input should be rejected within
a bounded resource budget.

### SEC-13 — Low: loopback listeners have no aggregate connection limit

Evidence: `start` in [`agent.rs`](../../apps/timetrack/src-tauri/src/agent.rs) and
[`ingest.rs`](../../apps/timetrack/src-tauri/src/ingest.rs).

Each accepted connection creates a task before authentication, without a concurrency cap.
Per-request size limits and deadlines exist, but do not bound the number of simultaneous
sockets and buffers. The agent listener also combines the five-second read budget with the
60-second answer budget around the whole request, so an unauthenticated idle connection
can occupy a slot for approximately 65 seconds. Another local account can connect without
knowing the token and attempt resource exhaustion. No stress test or measured exhaustion
threshold was run against the user's app.

Remediation: cap concurrent connections and in-flight authorized operations, enforce the
read deadline separately from the answer deadline, and reject excess work without an
unbounded queue. Consider bounded reporter bookkeeping on the ingest endpoint as well.

Verification: in an isolated test instance, exceed a small configured connection cap and
verify bounded memory/socket use and continued service for legitimate clients.

## Findings from collectors, provider integrations, and dependency checks

### SEC-14 — High: private and excluded agent-session data persists in cursor metadata

Evidence: [`agent-session-collector.ts`](../../apps/timetrack/src/collectors/agent-session-collector.ts),
`persist$`; [`collect.ts`](../../libs/timetrack/src/lib/agent-session/collect.ts), cursor creation;
[`event-store.ts`](../../apps/timetrack/src/host/event-store.ts), `toStoredCursor`.

Filtering is applied to events, but every parsed cursor is persisted unchanged. A cursor holds the
session title, current working directory, and session metadata. As a result, a title rejected by an
exclusion rule and a path marked private still enter the encrypted database. Synthetic execution of
the real collection pipeline confirmed both cases. This breaks the Settings promise that denied data
is never stored and undermines a private project link.

Remediation: sanitize or omit title, cwd, and session metadata before cursor persistence whenever
the record is private or excluded. Retain only the minimal opaque progress state needed to avoid
re-reading logs. Migrate and scrub already stored cursor data.

Verification: collect synthetic private and denied sessions, inspect cursor rows directly, and
confirm that resumability remains intact without the sensitive metadata.

### SEC-15 — Medium: agent-session titles bypass the URL-secret redaction

Evidence: [`agent-session-collector.ts`](../../apps/timetrack/src/collectors/agent-session-collector.ts),
which appends session events directly; [`title.ts`](../../libs/timetrack/src/lib/store/title.ts),
the redaction function used by other collectors.

Window, calendar, and ingest collectors redact URL queries and fragments before persistence.
The agent-session collector does not. A title containing a signed URL, reset link, or access token
therefore reaches the encrypted store intact unless an exclusion rule happens to match it. A
synthetic event confirmed that the shared redactor would change the title but the collector omits it.

Remediation: apply the same redaction after exclusions and before storing every title-bearing
agent-session event; extend the repair pass to the affected historical records and cursor titles.

Verification: use synthetic agent titles containing query and fragment secrets, then verify that
neither events nor cursors retain them.

### SEC-16 — High: Tempo paging can forward its bearer token to an arbitrary origin

Evidence: [`tempo/client.ts`](../../libs/timetrack/src/lib/tempo/client.ts), `tempoRequest$` and
`tempoPaged$`; [`http.rs`](../../apps/timetrack/src-tauri/src/http.rs), unrestricted host transport.

Tempo's `metadata.next` is treated as an arbitrary absolute URL and receives the normal
`Authorization: Bearer` header. A compromised, malicious, or redirecting Tempo endpoint can return
a next cursor such as `http://attacker.example/...`; Timetrack will send the Tempo token there.
Synthetic execution of the actual pager confirmed forwarding to an arbitrary HTTP origin.

Remediation: accept only HTTPS cursor URLs with the exact Tempo API origin, or derive subsequent
pages from a validated cursor token. Reject cross-origin and downgrade URLs before credentials are
attached.

Verification: return synthetic cross-origin, HTTP, user-info, and redirecting next links; confirm
no request containing the bearer token leaves the approved origin.

### SEC-17 — Medium: Google disconnect treats failed revocation as success

Evidence: [`tokens.ts`](../../libs/timetrack/src/lib/google-auth/tokens.ts), `revokeGoogleToken$`;
[`google-account.ts`](../../apps/timetrack/src/app/google/google-account.ts), `disconnect$`.

`revokeGoogleToken$` maps every HTTP response to success. The caller then deletes the local refresh
token and reports a successful disconnect even when Google returned a server failure. The user can
reasonably believe access was withdrawn while the remote grant remains active. Synthetic execution
confirmed that a 500 response completes as success.

Remediation: accept only successful responses (and the documented idempotent response, if any) as
revocation. If remote revocation fails, clearly report the failure and let the user choose between
retrying and local-only removal.

Verification: simulate 2xx, invalid-token, and 5xx responses; ensure the UI accurately reports
whether remote authorization remains potentially active.

### SEC-18 — Medium: an in-flight Google refresh can restore an access token after disconnect

Evidence: [`token-source.ts`](../../libs/timetrack/src/lib/google-auth/token-source.ts), `renew$`
and `invalidate`; [`google-account.ts`](../../apps/timetrack/src/app/google/google-account.ts),
`disconnect$`.

Disconnect invalidates the in-memory token source but cannot cancel a refresh already in flight.
When that refresh later succeeds, its `tap(store)` restores a usable access token, despite the local
refresh token having been removed. Synthetic execution confirmed this race.

Remediation: attach a generation/cancellation token to token-source operations, discard results
from earlier generations after disconnect, and cancel the underlying request where possible.

Verification: start a deferred refresh, disconnect before it resolves, then resolve it; every later
credential request must return `null` unless the account is explicitly reconnected.

### SEC-19 — Medium: the default HTTP client has no request deadline or response-size bound

Evidence: [`lib.rs`](../../apps/timetrack/src-tauri/src/lib.rs), construction of `reqwest::Client`;
[`http.rs`](../../apps/timetrack/src-tauri/src/http.rs), full response buffering. Reqwest's defaults
leave the total and read timeouts unset in the installed version.

An allowed provider or a renderer that reaches the general transport can keep a request open or send
an arbitrarily large response, consuming a connection and memory. This compounds SEC-06's unrestricted
transport authority. A server-side response-size cap is absent as well.

Remediation: use a host-owned transport with connect, total, and idle-read deadlines; stream with a
strict maximum response size; use narrower provider-specific request functions rather than accepting
arbitrary URLs and headers.

Verification: use controlled slow and oversized responses and confirm bounded time, memory, and
meaningful error handling.

### SEC-20 — Medium: shipped network stack contains known Rust advisories

Evidence: `Cargo.lock`, checked against OSV on 2026-09-16. All 595 registry packages were queried.
Timetrack directly reaches `rustls 0.23.43` and `h2 0.4.15` through `reqwest 0.13.4`.

`rustls 0.23.43` is affected by TLS handshake encryption-boundary handling fixed in `0.23.45`;
the advisory describes a network confidentiality impact. [RustSec RUSTSEC-2026-0285](https://rustsec.org/advisories/RUSTSEC-2026-0285.html)
`h2 0.4.15` is affected by unbounded empty DATA-frame queuing, fixed in `0.4.16`.
[RustSec RUSTSEC-2026-0258](https://rustsec.org/advisories/RUSTSEC-2026-0258.html)

The scan also found `glib 0.18.5` with a known unsound iterator implementation through the Linux
Tauri/WebKit stack; no use of the affected iterator was established in Timetrack.
[RustSec RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)

Remediation: update the dependency graph until patched releases are selected, regenerate
`Cargo.lock`, and add a repeatable Rust advisory check to CI.

Verification: re-run the OSV/RustSec scan and `cargo tree -i rustls -i h2` after the update.

### SEC-21 — Medium: production renderer depends on vulnerable Angular releases

Evidence: `yarn npm audit --all --recursive --json`, run on 2026-09-16, reports installed
`@angular/core`, `@angular/compiler`, and `@angular/common` version `22.0.7`. The compiler/core
sanitization bypass is fixed in `22.1.0`; it can become XSS where attacker-controlled values reach
affected directive host bindings. [GitHub advisory GHSA-hh8m-fm6v-7cvg](https://github.com/advisories/GHSA-hh8m-fm6v-7cvg)

The audit reported 119 advisory entries across the monorepo. Many are development-only or belong to
other applications, so this finding does not claim all apply to the packaged Timetrack application.
The installed Angular vulnerability is a production dependency and should be upgraded even though
this audit did not find an affected Timetrack host-binding pattern.

Remediation: upgrade Angular to a patched compatible release, update the lockfile, and make
dependency audit triage part of the release process. Track build-only and unrelated-workspace
advisories separately from the packaged application.

Verification: rebuild the production bundle, run Timetrack tests, and rerun the audit with no
affected Angular versions.

## Timetrack CLI findings

### SEC-22 — Medium: `day --out` exports raw evidence as broadly readable plaintext

Evidence: [`timetrack-command.ts`](../../libs/agent-rules/src/lib/timetrack-command.ts),
`writeFileSync(out, JSON.stringify(found))` in the `day` command.

The export contains raw personal evidence but is created without restrictive permissions or exclusive
creation. New files inherit `0666 & ~umask`, which is `0644` under the common umask `022`; the CLI
also recommends `/tmp/day.json`. Existing files retain their permissions, are overwritten, and a
symlink destination is followed. Synthetic execution confirmed the insecure write arguments.

Remediation: create exports exclusively with mode `0600`, reject symlinks and unexpected existing
destinations, and require an explicit overwrite action. Warn that the export is sensitive.

Verification: check new exports under a permissive umask and test existing files, symlinks, and
directory traversal cases without using real evidence.

### SEC-23 — Low: CLI prints untrusted text without terminal-control escaping

Evidence: [`timetrack-command.ts`](../../libs/agent-rules/src/lib/timetrack-command.ts), formatting
and `console.log` calls for issue fields, errors, and API responses.

Jira-supplied summaries and subjects reach the terminal unchanged. An actor able to introduce control
sequences into returned text can clear, reposition, or otherwise spoof terminal output; clipboard
effects depend on the terminal. No command execution was established, and acceptance of these bytes
by a real Jira instance was not tested.

Remediation: escape terminal control characters in all human-readable output, including API error
text. Keep JSON output as data, not terminal-formatted text.

Verification: mock issue and error strings containing ANSI controls; human-readable output must
render escaped text rather than execute a terminal control sequence.

### SEC-24 — Medium: stale discovery can enable local server impersonation

Evidence: [`timetrack.ts`](../../libs/agent-rules/src/lib/timetrack.ts), discovery and `fetch`;
[`agent.rs`](../../apps/timetrack/src-tauri/src/agent.rs), ephemeral loopback binding and discovery
file handling.

The CLI authenticates to the server by sending the discovery bearer token but does not authenticate
the server. After Timetrack exits, a local attacker able to bind the former ephemeral port can answer
requests made using the stale discovery file, read their bodies, and return invented successful data.
The attacker does not need the old token beforehand. The fetch also permits redirects; a malicious
listener can redirect the request away from loopback. Browser fetch normally strips `Authorization`
on a cross-origin redirect, so this is not a claim that the bearer token is forwarded cross-origin.

This is source-reviewed rather than reproduced against a running desktop app. It requires a local
attacker that can identify and bind the freed port before the CLI request.

Remediation: prefer OS-authenticated local IPC, or add server authentication bound to discovery
material; reject redirects; remove discovery files at clean shutdown. File cleanup alone does not
authenticate the server.

Verification: in an isolated account test, replace a stopped app with a harmless listener on its
former port and confirm the CLI rejects its response before exposing a request body or accepting data.

### SEC-25 — Low: conflicting CLI edit flags silently discard a requested edit

Evidence: [`timetrack-command.ts`](../../libs/agent-rules/src/lib/timetrack-command.ts), edit
argument parsing and request construction.

The command presents one edit operation but accepts conflicting flags. For example, `--issue DEMO-2
--state rejected` sends only the issue change, silently ignoring the rejection. Synthetic execution
of the actual command confirmed this behavior. It is an integrity and operator-safety defect, not an
authorization bypass.

Remediation: reject more than one requested edit or define and clearly display an intentional
multi-field edit form before making the request.

Verification: test every incompatible flag combination and confirm no request is issued until the
command is unambiguous.

## Remediation order and remaining review

Address SEC-01 through SEC-05 first, then SEC-14 through SEC-16 and SEC-22 through SEC-24:
they respectively expose the sensitive data path, agent log privacy, provider tokens, and CLI export
or endpoint boundaries. Include SEC-09 and SEC-10 in the lock remediation. Then enforce transport
timeouts, correct Google disconnect behavior, update dependencies, fix discovery-file creation,
implement retention, and address the availability and CLI integrity findings.
Regression checks should exercise real host and IPC boundaries; frontend-only checks do not
establish these protections.

Existing protections to preserve include SQLCipher, OS keychain storage, a restrictive CSP,
loopback-only listeners, bearer authentication, browser-origin rejection, and OAuth state
and PKCE checks. These reduce risk but do not compensate for the findings above.

The dependency scans are now complete but require triage and remediation. Outstanding work includes
packaged-platform tests, runtime checks of keychain and file permissions, and end-to-end verification
of every remediation.
The source review also observed opt-in model reasoning with user-configured name masking;
this is not a general guarantee that free text contains no personal information. Outbound
model payloads and agent evidence responses need a separate privacy review covering what
the user expects to leave the machine.
