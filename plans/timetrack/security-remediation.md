# Timetrack security remediation

Tracks the fix of every finding in `security-audit.md`. One row per finding. Verified means
the finding was reproduced in the source before the fix. Fixed means the code changed and a
test covers it.

| ID                            | Verified | Fixed | Where                                                   |
| ----------------------------- | -------- | ----- | ------------------------------------------------------- |
| SEC-01 process allowlist      | yes      | yes   | `src-tauri/src/process.rs`                              |
| SEC-02 keychain accounts      | yes      | yes   | `src-tauri/src/secrets.rs`                              |
| SEC-03 log root               | yes      | yes   | `src-tauri/src/logs.rs`                                 |
| SEC-04 lock vs agent API      | yes      | part  | `src-tauri/src/lock.rs`, `app/agent/agent-endpoint.ts`  |
| SEC-05 command capabilities   | yes      |       | `src-tauri/build.rs`, `capabilities/`                   |
| SEC-06 HTTP without TLS       | yes      | yes   | `src-tauri/src/http.rs`, `libs/timetrack/.../client.ts` |
| SEC-07 discovery permissions  | yes      | yes   | `src-tauri/src/agent.rs`, `ingest.rs`                   |
| SEC-08 retention              | yes      | no    | out of scope, see below                                 |
| SEC-09 fail-open lock         | yes      |       | `app/window-lock.ts`                                    |
| SEC-10 tray while locked      | yes      |       | `app/tray-readout.ts`                                   |
| SEC-11 process timeout        | yes      | yes   | `src-tauri/src/process.rs`                              |
| SEC-12 OAuth listener         | yes      | yes   | `src-tauri/src/oauth.rs`                                |
| SEC-13 connection cap         | yes      | yes   | `src-tauri/src/agent.rs`, `ingest.rs`                   |
| SEC-14 cursor metadata        | yes      |       | `collectors/agent-session-collector.ts`                 |
| SEC-15 title redaction        | yes      |       | `collectors/agent-session-collector.ts`                 |
| SEC-16 Tempo paging           | yes      |       | `libs/timetrack/src/lib/tempo/client.ts`                |
| SEC-17 Google revoke          | yes      |       | `libs/timetrack/src/lib/google-auth/tokens.ts`          |
| SEC-18 refresh race           | yes      |       | `libs/timetrack/src/lib/google-auth/token-source.ts`    |
| SEC-19 HTTP deadlines         | yes      | yes   | `src-tauri/src/lib.rs`, `http.rs`                       |
| SEC-20 Rust advisories        | yes      |       | `Cargo.lock`                                            |
| SEC-21 Angular advisory       | yes      |       | `package.json`                                          |
| SEC-22 CLI export mode        | yes      |       | `libs/agent-rules/src/lib/timetrack-command.ts`         |
| SEC-23 CLI terminal escapes   | yes      |       | `libs/agent-rules/src/lib/timetrack-command.ts`         |
| SEC-24 stale discovery        | yes      |       | `libs/agent-rules/src/lib/timetrack.ts`, `agent.rs`     |
| SEC-25 conflicting edit flags | yes      |       | `libs/agent-rules/src/lib/timetrack-command.ts`         |

## SEC-08 is not fixed here

`planRetention` is unused because compaction does not exist. ADR 0002 records why: deleting a
raw event before a block replaces it destroys the only record of that day. A retention pass
shipped without compaction would therefore delete data, not minimize it. The fix is the
compaction feature, not a security patch. The finding stands.

## Where this stands

Two commits so far, both with their own unit tests in the Rust host, all 172 passing.

Done: SEC-01, SEC-02, SEC-03, SEC-06 (host half), SEC-07, SEC-11, SEC-12, SEC-13, SEC-19,
and the host half of SEC-04 (the agent endpoint and a settings write are refused while the
window is locked).

Still open, in the order to take them:

1. SEC-05. Register the commands in `build.rs` with
   `tauri_build::try_build(Attributes::new().app_manifest(AppManifest::new().commands(&[…])))`,
   list every command from `lib.rs` in `capabilities/default.json` as `allow-<command>`, and
   give `capabilities/widget.json` only what the widget window uses. Check which commands the
   widget really invokes before writing that list.
2. SEC-09 `app/window-lock.ts`. The `catchError` sets `ready` true and `isLocked` false for any
   error. Fail open only where there is no shell: `'__TAURI_INTERNALS__' in globalThis` is the
   test `host/invoke.ts` already uses.
3. SEC-10 `app/tray-readout.ts`. Publish a generic locked readout as soon as the window locks,
   and hold back every later one until it unlocks.
4. SEC-14 and SEC-15 `collectors/agent-session-collector.ts`. `persist$` filters the events but
   passes `collection.cursors` through whole, so a private cwd and an excluded title are stored.
   Sanitize the cursor beside the events, and run `redactEventTitles` over the kept events the
   way the window, calendar and ingest collectors do.
5. SEC-16 `libs/timetrack/src/lib/tempo/client.ts`. `tempoPaged$` follows `metadata.next` as an
   absolute URL with the bearer token attached. Accept only the `TEMPO_API_BASE` origin.
6. SEC-17 and SEC-18 `libs/timetrack/src/lib/google-auth/`. `revokeGoogleToken$` maps every
   status to success; `renew$` stores a grant that lands after `invalidate`.
7. SEC-06 core half: `normalizeJiraHost` and `normalizeGitLabHost` still accept an explicit
   `http://` host. The host transport now refuses it, so this is the message, not the boundary.
8. SEC-22 to SEC-25 in `libs/agent-rules/src/lib/`. Exclusive `0600` export, terminal-escape
   stripping on printed provider text, `redirect: 'error'` plus a server proof in the discovery
   file, and a refusal of conflicting edit flags.
9. SEC-20 and SEC-21, the dependency updates.

Each library change needs a changeset. `@ethlete/timetrack` and `@ethlete/agent-rules` are
both published.
