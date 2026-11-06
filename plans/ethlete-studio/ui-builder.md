# Second builder (UI): slices

The second builder session (ADR 0198) records its slices here, so its notes do not collide with the first builder's
uncommitted edits in `design-to-code.md`. Order: A1, A2, A3, then A36 as a sketch with variants.

## A1 title bar to the merged design (as built)

`design compare components/title-bar` on 2026-11-06: `windows` and `windows-update` differ (variant f's 46 px caption
tiles, the red close and the left-only padding on Windows are not in the app); `linux-full-notice` and
`windows-notice` cannot be compared (the design's `notice` prop has no app input, the app draws no "Neu starten"
button with `emit:restart`). The twelve forced interaction states of the rows other than `linux-full-update` printed
no line at all.

Slice: a `caption` shape on the SDK window control button, the Windows caption tiles and the error close in the app
title bar, and a `notice` input with a `restart` output that the shell binds.

As built: `caption` shape on the SDK window control button (46 px full-height tile, 10 px glyph, the hover, focus and
press tints of the design); the app title bar draws the Windows caption tiles with the error-theme close, pads only the
left on Windows, and takes `notice` and a `restart` output that shell-main binds to the code watch. `code-notice` is
folded into the title bar. Per finding 484 (ADR 0010) the cause text stays as the built look through an app-only
`noticeText` input (the restart cases and the CLI-dirty hint), marked as needing approval: the sketch
`components/title-bar` with a = built text, b = cause as SDK tooltip, c = no hint opens next.

Verified: `design compare components/title-bar` all 14 states ok and every declared action works (before the
`noticeText` input; the harness never sets it); title-bar and shell-main specs 22/22; lint clean. Not verified: the
twelve skipped interaction states (finding 483), the real Windows window, the text against a design (none exists).
