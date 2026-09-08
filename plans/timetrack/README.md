# Timetrack planning

The main plan is still `plans/timetrack.md`. It holds the locked decisions, the provider
notes and the host notes for the whole app. Read it first.

This directory holds the per-feature plans that came after it.

| Plan                                                   | What it covers                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [`time-and-token-spend.md`](./time-and-token-spend.md) | The model: concurrent work streams, and the token spend collected per stream.           |
| [`vertical-slices.md`](./vertical-slices.md)           | Where the v2 core lives, and the slices that deliver it. Read this second.              |
| [`e2e-strategy.md`](./e2e-strategy.md)                 | How every flow is proven: the fake backend, the seed, the clock, and what stays manual. |

## How a plan here relates to the main plan

A plan here may contradict `plans/timetrack.md`, and one of them does. Where that happens the
plan here says so, and names the section it replaces. Do not fold it back into the main plan
until the feature is built.
