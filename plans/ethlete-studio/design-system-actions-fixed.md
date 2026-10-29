### 3.23 A problem in another part stops the auto merge - fixed

- **Pain:** `sketch ready pages/start` showed no visible change, but did not merge: "the check
  failed after the merge". The only problem was `SVG-ASSET` on the merged
  `assets/studio-mark.svg`, which the sketch does not touch. A problem that was there before the
  merge blocks every auto merge until another sketch fixes it.
- **Where:** the check after the auto merge (3.17) in `libs/cli/src/lib/design/system/sketch/`.
- **Fix done:** a merge restores the old files only on problems it adds; older ones print as
  `NOTE (was there before)`. `sketch ready` on a `ready` sketch runs the unchanged check and the
  auto merge again. Real case: `pages/start` then merged automatically.
- **Was:** block only on problems the merge adds. Compare the problem list before and after
  the merge, and print the old ones as a note.
- **Also:** after the problem was fixed, a second `sketch ready pages/start` printed "ready, not
  in progress" and did not try the auto merge again. Let `sketch ready` on a `ready` sketch run the
  unchanged check again.
- **Open:** the merge failure message does not name the problem. `sketch check` and `sketch ready`
  have no `--root`, so a scratch copy of `.ethlete/design` cannot be tested.

### 3.19 The merge preview compare grid is unreadable and slow - fixed, one open point

- **Pain:** the compare grid of the merge preview fits at 3-4% zoom, and the text is not readable.
  "Comparing…" ran over 25 s on a sketch whose change touches five parts.
- **Where:** the merge preview in `sketch-view.component.ts` (`apps/ethlete-studio`).
- **Fix done:** the preview opens fitted to its first changed row (`fitTo` on the design canvas);
  Fit still shows the whole column. While it compares, Studio shows the part count and the seconds so far.
- **Cause of the 25 s:** not the compare. One shared Chromium draws all shots in one serial queue
  (`createDrawQueue` in `libs/cli/src/lib/design/thumb.ts`). 22 cold pictures took 3.5 s; behind 42
  queued shots, 9.9 s. See 4.12.
- **Was:** fit to the first changed row, not to the whole column. Show progress while it
  compares.
