# @ethlete/timetrack

The framework-agnostic core of the Ethlete time-tracking helper: it turns raw observations of
a working day into blocks, and blocks into issue attributions, so a desktop shell can present a
reviewable set of worklogs.

The design and its rationale live in `plans/timetrack.md`; the branch grammar this consumes is
`@ethlete/agent-rules/git-flow`, specified in `plans/git-flow-system.md`.

## What is here today

- **`model/`** - the four layers of the data model. `CollectedEvent` (raw, append-only) →
  `ActivityBlock` (contiguous same-context time) → `WorklogProposal` (attributed, reviewable) →
  `SyncedWorklog` (exists in Tempo). Plus `Evidence` and `Confidence`.
- **`correlate/sessionize`** - observations to blocks: presence splits, flap absorption,
  optional working-hours clamping.
- **`correlate/attribute`** - blocks to issues, through the branch grammar. Deterministic; a
  block it cannot attribute stays unattributed rather than being guessed at.
- **`transport/`** - the ports the host supplies. The core issues no network call, spawns no
  process and touches no keychain of its own.

## What it deliberately does not do

No HTTP, no filesystem, no Angular, no Tauri. Jira, Tempo and Google all reject browser-origin
requests and the tokens must never be readable from a webview, so every outbound call goes
through the host's `TimetrackTransport`. That is also what lets the correlation pipeline - the
part with the actual logic - run in `vitest` against fixture event streams.

## Usage

```ts
import { attribute, sessionize } from '@ethlete/timetrack';

const blocks = sessionize({ events });
const attributed = blocks.map((block) => attribute({ block, config, resolveBase }));
```

`sessionize` is edge-triggered by design: window focus and commits fire on change, so a quiet
ten minutes inside one context is work, not absence. Real idleness has to arrive as a presence
event; `maxUnobservedMs` is only the safety valve for a stretch nothing observed at all.

`attribute` returns `confidence: 'certain'` only for a fully conforming branch name, `'likely'`
for a partial or inherited key, and `'weak'` for a key scraped out of a window title. Per the
plan's trust model, `weak` never syncs until a human accepts it.
