# Open: 7. Open checks

These fixes are built, but nobody checked them in the real Studio.

1. The status-watch reload with `et design sketch report`: the Studio side is verified headless; the Rust side (the
   watcher) needs the Tauri host.
2. The `stale` footer: the Studio side is verified headless; the Rust side (`is_stale`) needs the Tauri host.
3. Shot size against live size on the human's HiDPI window.
4. Round d on macOS WebKit, at 800 %, and on touch.
