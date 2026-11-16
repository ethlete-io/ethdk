---
status: accepted
open: B529
decided: 2026-11-16
source: doc-agent session 2026-11-16, morning round
---

# OverlayRef gets a size update and no animation state

A fifagg match overlay widens from 800 to 1220 px while open; fifagg writes max-width on the pane, and a breakpoint
re-apply overwrites it. Asked whether OverlayRef should get a method that updates width and height for the active
breakpoint and survives a re-apply, with that recommendation, the human answered "q6ok".

fifagg also asked for an enter/leave animation state on OverlayRef. Asked with the recommendation not to build it until a
second consumer needs it, since afterOpened/beforeClosed cover fifagg, the human answered "q7ok".

OverlayRef gets a size update for the active breakpoint that a breakpoint re-apply keeps. OverlayRef gets no animation
state; fifagg keeps afterOpened/beforeClosed.
