---
status: accepted
governs: ['libs/cli/design/define-part.ts']
open: B290
decided: 2026-11-18
source: finding 343, the human on the shell-project-switch grid; builder slice B290
---

# A part names the states in which it scrolls

A part that can hold a scroll container draws both cases on purpose: a state where the content fits and a state
where it scrolls (finding 343). `definePart({ scrolls })` lists the states that draw a box with more content than it
shows. `design check` fails with SCROLLS when a box with `overflow: auto` or `scroll` scrolls in a state the list does
not name, and when a listed state draws no scrolling box, so the scroll bar shows only in a state that asks for it. An
embedded part's scroll box counts for the state of its host; `checks.skip: ['SCROLLS']` exempts a part on purpose.
The states that scroll on purpose today are listed; the few fitting states that overflow by accident go into the
rule baseline with finding 343 (ADR 0201). Rejected: baselining every state that scrolls today.
