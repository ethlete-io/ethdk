# Ethlete Studio — vision

A project-based, project-aware, agentic design tool. It replaces `tools/design-explore`
(the `yarn design` page on :4402), which proved the idea but is too bare to live in.

## What is wrong with the tool it replaces

Tom's words, in order of weight:

1. **No SPA magic.** The page is one `innerHTML` string with no framework. Every
   interaction is a full reload and it hurts badly.
2. **The agent lives in another window.** You drive the tool from a Claude CLI in a
   second window. That split feels unnatural — the agent belongs inside the app.
3. **Every project's design files land in this repo.** `design-explore.config.json`
   points at `apps/timetrack/src/design/calls`, whatever project the work is for.
4. **Talking costs walls of text.** The design conversation happens in a chat
   transcript instead of in the tool.

What the code shows, on top of that:

- **No write-back.** The UI has no "choose this" control. A verdict, a round note and
  the ordering are set by hand-editing `call.ts`. The URL knows what you picked; the
  file never learns.
- **The prose is what goes stale**, and nothing checks it. The page detects two failure
  modes: a duplicate round key, and a declared round with no options.
- **A frame cannot import an `@ethlete` barrel.** Libs resolve to source, so a barrel
  dies with `ERR_INSUFFICIENT_RESOURCES`. Today `providers` is `[]` and `Wrapper` is
  `null`, so a drawing gets no DI environment at all.
- **One `frameWidth` per call.** No viewport comparison, no per-option geometry, no
  light/dark toggle, no zoom beyond the fixed 0.32 contact-sheet scale.
- **Compare caps at two.** Two picks get a wipe; three or more degrade to a blink cycle.
  Picks never cross calls.
- **One `callsRoot` per config**, so one project's calls per running server.
- `check-call.mjs` (eslint, then `tsc --noEmit`, then Playwright against the live page)
  is run by hand and sits in no CI target.

## What carries over

The **call → rounds → options** model works and stays. 22 calls exist under
`apps/timetrack/src/design/calls`. Most have 3 to 4 options in one round; the two large
ones are `kerbe/06-break-label` (24 options over 7 rounds) and `kerbe/08-lane-headers`
(10 over 3).

What must get better inside that model: **the UI has to show what changed between
iterations.** Today a round is a row of finished pictures; the reasoning for the step is
prose in `claim` and `cost`. Studio should make the delta visible.

## Decisions taken

| Question                                 | Answer                                                                                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where does a project's design work live? | **In the project's own repo.** Studio is told about a checkout and writes that project's calls and option components into it. Nothing lands in `ethlete-sdk` unless the design is for `ethlete-sdk`. |
| Wireframe mode vs design mode            | **Wireframe ignores detailed logic and hover states. It shows the bare workflow, mocked.** Design mode draws the real thing.                                                                         |
| How do we bootstrap?                     | **Build a rough Studio by hand, then iterate on Studio inside Studio.** It will be ugly at first. Everything now in `apps/ethlete-studio/src` may be thrown away.                                    |

## Still open

- **The agent bridge.** Headless `claude -p`, a Codex equivalent, or both behind one
  interface. Not chosen yet.
- **Live feedback while the agent builds.** Tom wants to watch a drawing being produced,
  not wait for a finished row.
- **Which UI actions drive the agent** — pick a variant to iterate on, accept one, reject
  one — and what each one sends.
- Whether the design conversation itself moves into the app, replacing chat.

## Order of work

1. Thinnest Studio that runs one call end to end, with the agent wired in.
2. From then on, every change to Studio is decided inside Studio.

## Current state

`apps/ethlete-studio` is set up to match the Timetrack app: build configurations, Rust
targets, eslint, Tailwind with generated surface and colour themes, zoneless change
detection, a hash-location router, and a cold-Observable Tauri bridge in `src/host`. The
one view is a placeholder that prints `git status`. The Rust host exposes
`workspace_status`, `workspace_diff` and `workspace_check`, all run from the repository
root. Run it with `yarn studio`.
