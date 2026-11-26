# Open: 1. Studio app

### 1.5 Studio logs a nested Tokio runtime panic - open

- **Pain:** frequent `tokio-rt-worker` panic "Cannot start a runtime from within a runtime" (Tokio 1.54.1,
  scheduler/multi_thread/mod.rs:89).
- **Searched:** no `block_on` caller in the Studio host, the pinned Tauri checkout (`9d1a5b1`, with `tauri-runtime-cef`),
  the updater or `fix-path-env`. No speculative fix applied.
- **Built:** the panic hook keeps the existing hook, force-captures a backtrace to stderr and appends each report (time,
  thread, message, backtrace) to `ethlete-studio-panics.log` in the temp dir.
- **Next:** on the next panic, read that file and the last Studio action, then fix that call path.
- **Other output, relation unproven:** DevTools remote debugging disallowed, a rejected Blink Widget message, Mesa loader
  permission denied for `/usr/lib64/gbm/dri_gbm.so`, CEF browser-info timeouts.
