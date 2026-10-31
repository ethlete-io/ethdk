# Open: 1. Studio app

## 1. Studio app (native and WebKit)

### 1.2 Studio freezes at 100% CPU during frame reloads - not reproduced (L2697, L2965, L3076)

- **Pain:** Studio hung two times. Cmd+R and SIGTERM did not help. Only a kill of the WebContent
  process helped.
- **Where:** fast reloads of sketch frames while we drew the Sketches page.
- **Fix done:** `frame.ts` has no top-level await during an iframe removal. A native test with 40
  replacements passed.
- **Open:** a 100-cycle run started, but nobody recorded the result. Run it again.
- **Options not taken:** a bounded log of module-load failures with the active frame; a native
  menu item that creates the webview again.
- **Decision (Tom, 2026-10-29):** run the 100-cycle test over SSH on ethlete-mac when it is on.
- **Result (2026-10-29, ethlete-mac, macOS 15.7.7):** 100 cycles with 3 frames: 1 hang in 4 runs
  (after batch 80, WebContent at 100% CPU until the watchdog). 40 cycles passed. Other sessions
  loaded the Mac at the time. Next: 10 runs of 100 on an idle Mac after a fresh `nx build cli`.
- **Result 2 (2026-10-29, fresh `dist`, Mac mostly idle):** 1 hang in 10 runs of 100 (run 6, after
  batch 74). Sample `/tmp/wk-samples/hang-6.txt`: main thread 100% busy in
  `MicrotaskQueue::performMicrotaskCheckpoint` -> `ScriptModuleLoader::evaluate` ->
  `WTF::URLParser` (`parseIPv4Host`), no deadlock. Same shape as the first two hangs. The probe used
  a LAN IPv4 URL; a run against `localhost` is not done. Next: repeat 10 x 100 on `localhost`
  (run the server on the Mac or tunnel over SSH), then decide between a minimal WebKit repro for
  upstream and a workaround (e.g. never remove a frame while its module evaluates).
- **Result 3 (2026-10-29, `localhost` URL over an SSH tunnel, fresh `dist`):** 0 hangs in 10 runs
  of 100. Each run passed batch 100 in about 16 s. No stack: no hang to sample. Load (1 min) 4.3 to
  5.5 before the runs; the probe adds this load. The Mac screen was locked, so the probe in
  `/tmp/wk-probe` turned off window occlusion and hidden-page timer throttling. Without this
  change, all runs stopped at batch 12 or 13 with all processes idle; also with `127.0.0.1`. This
  is page suspension, not finding 1.2. The orphaned `nx tauri:dev` (100% CPU) also loaded the Mac
  in these invalid runs 1 to 4; it was stopped before the valid runs.
- **Result 4 (2026-10-29, LAN IPv4 URL `http://192.168.1.152:<port>`, the unthrottled probe of
  Result 3, `dist` of 19:47):** 0 hangs in 30 runs of 100 cycles. Each run passed batch 100 in
  16.3 to 16.4 s. Load (1 min) 2.4 to 5.1. No hang, so no sample. With Result 3: 0 hangs in 4000
  cycles on both hosts. The LAN IPv4 path is not the trigger. Results 1 and 2 differ from 3 and 4
  in two ways: the throttled probe, and an older `frame.ts` (later changes `43cec7ae9`,
  `144e2d843`).
- **Probe change:** `tools/scripts/verify-webkit-frame-reloads.swift` now always turns off window
  occlusion and hidden-page timer throttling. The probe tests frame replacement, and a throttled
  page only gives false stops at batch 12 or 13 on a locked or covered screen. Checked: 100 cycles
  pass on the locked Mac.
- **Recommendation:** close as not reproduced; no workaround and no upstream repro without a
  reproducing case. Reopen with a `sample` of WebContent if Studio hangs again. A hang plus a
  manual WebContent kill during a pinch can also cause finding 1.1.
- **Decision (Tom, 2026-10-30):** close as not reproduced. Reopen with a WebContent `sample` at
  the next hang.

### 1.5 Studio logs a nested Tokio runtime panic - open

- **Pain (Tom, 2026-10-29):** frequent `tokio-rt-worker` panic: "Cannot start a runtime from within a runtime" at Tokio 1.54.1 scheduler/multi_thread/mod.rs:89.
- **Investigation:** no concrete nested-runtime caller found in Studio commands or the pinned CEF event dispatch. No speculative runtime fix applied.
- **Diagnostic built:** Studio preserves the existing panic hook and force-captures a backtrace to stderr. Requires a rebuilt/restarted native app. Four focused Rust agent tests and rustfmt pass.
- **Next:** capture the next panic's full stack plus triggering action, then fix that call path. Root cause remains open.
- **Static search (2026-10-30, `claude-sdk58`):** no `block_on` caller in the Studio host, the
  pinned Tauri checkout (`9d1a5b1`, including `tauri-runtime-cef`), the updater, or `fix-path-env`.
  `tokio-rt-worker` is the Tokio default thread name, so it does not name the runtime. Dead end
  without a stack.
- **Panic log:** the hook now also appends each report (time, thread, message, backtrace) to
  `ethlete-studio-panics.log` in the temp dir (`/tmp` on Linux). On the next panic, read that
  file and the last Studio action, then fix that call path.
- **Other reported output:** DevTools remote debugging disallowed by system admin, rejected Blink Widget message, Mesa loader permission denied for `/usr/lib64/gbm/dri_gbm.so`, and CEF browser-info timeouts. Their relation to the panic is unproven; retain them with the next stack.
