### 4.12 One serial draw queue for every shot - fixed, open points

- **Pain:** the merge compare, canvas shots and thumbnails share one Chromium and one queue
  (`createDrawQueue` in `libs/cli/src/lib/design/thumb.ts`). A compare waits behind every queued
  thumbnail, so "Comparing…" can run 25 s for 3.5 s of work.
- **Fix options:** a priority lane for the compare; or two or three pages in parallel; or drop
  queued thumbnails that are no longer on screen.
- **Fix done:** a priority lane in `createDrawQueue`. Every `pictureOf` call (merge compare, merge
  preview, shot commands) and every `/__design/shot` without `priority=low` is high. Studio's canvas
  images send `&priority=low`. A high request for a shot that waits in the low lane promotes it.
- **Open:** the frame in view still waits behind off-screen frames, because Studio loads every
  canvas `<img>` at once; lazy loading would fix it. An aborted request does not drop its queued
  thumbnail. Not measured again after the fix.
