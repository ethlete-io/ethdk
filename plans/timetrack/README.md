# Timetrack planning

The main plan is still `plans/timetrack.md`. It holds the locked decisions, the provider
notes and the host notes for the whole app. Read it first.

This directory holds the per-feature plans that came after it.

| Plan                                                   | What it covers                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [`roadmap.md`](./roadmap.md)                           | The order of the rest of the work: the milestones, and what ends each one.              |
| [`time-and-token-spend.md`](./time-and-token-spend.md) | The model: concurrent work streams, and the token spend collected per stream.           |
| [`vertical-slices.md`](./vertical-slices.md)           | Where the v2 core lives, and what slice 1 does. Read this second.                       |
| [`draw-the-day.md`](./draw-the-day.md)                 | M2, slices 2a and 4: one day screen, the pipeline under it, and what a band is.         |
| [`name-the-ticket.md`](./name-the-ticket.md)           | M3, slice 2b: which ticket a band books to, which epic, and how a meeting is named.     |
| [`e2e-strategy.md`](./e2e-strategy.md)                 | How every flow is proven: the fake backend, the seed, the clock, and what stays manual. |
| [`name-the-window.md`](./name-the-window.md)           | How a terminal and a dev-server tab get named. Hardens slice 1; it is not a slice.      |

## How a plan here relates to the main plan

A plan here may contradict `plans/timetrack.md`, and one of them does. Where that happens the
plan here says so, and names the section it replaces. Do not fold it back into the main plan
until the feature is built.

## The glossary and the decision records

The vocabulary lives in [`libs/timetrack/CONTEXT.md`](../../libs/timetrack/CONTEXT.md), and the
decisions that are hard to reverse live in `libs/timetrack/docs/adr/`. A plan here uses those terms
and never redefines one.

## Which plan wins

`roadmap.md` wins on **order**. It replaces the slice table in `vertical-slices.md`, and it says
which milestone comes next and what ends it. Agreed with Tom on 2026-09-10.

`vertical-slices.md` wins on **the shape of v2**: where the module and the route live, what slice 1
does, the rules that carry over, and the no-git-flow decision. Agreed with Tom on 2026-09-08.

A per-slice plan wins on the detail of its own slice. Where it disagrees about order, the roadmap
is right.
