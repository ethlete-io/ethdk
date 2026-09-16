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
