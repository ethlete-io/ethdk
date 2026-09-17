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

## The agent bridge

**Studio detects which agent CLIs are installed and offers them as a choice.** It never
assumes one. A missing CLI is simply an option that is not offered.

**Later, a round may run more than one of them on the same question.** Ask Claude and
Codex to draw the same thing, and the round comes back with more diverse answers to pick
from. Two consequences to build for from the start, even before the feature exists:

- An option records **which agent drew it, and on which model** — for example Sonnet,
  Opus or Fable under one CLI, and Tera, Luna, Sol or Astra under another. A round can
  therefore mix both the CLI and the model, and you can see who produced which answer.
  Two options from the same CLI on different models are a real comparison.
- **The model is never a fixed union in the code.** The list belongs to the CLI, it
  differs per CLI, and it changes without Studio changing. Studio asks the CLI what it
  offers, or stores the name as written; it never ships an enum that goes stale.
- The bridge is **one interface with an implementation per CLI**, not a `claude -p` call
  with a flag. A second CLI must be an added implementation, never a rewrite.

## How the workflow behaves

Decided with Tom on 2026-09-17. These three answers replace the questions that stood here.

**A build shows the frame and the agent's stream side by side.** The option card splits in
two: a live frame on the left that redraws every time the agent writes a file, and the
agent's tool log with an elapsed timer on the right. Watching a drawing appear is the
point, so the frame is not optional. The stream says why it looks the way it does. This
needs a dev server per project checkout and a file watcher, and that cost is accepted.

**Verbs fill an editable prompt box, and you send it.** An option carries `accept`,
`iterate`, `reject` and `more like this`. A verb does not run the agent. It writes a first
draft of the prompt into a box under the round. You change the draft, then you send it. You
always see the exact text the agent gets, so a bad result is a bad prompt you can read.
`accept` and `reject` also write the verdict back to the call file.

**The conversation stays split for now, and moves into Studio later.** Studio holds the
claim, the cost, the verdict and the prompt behind every option. Planning a whole call, and
debugging a broken frame, stay in a CLI session outside Studio. Tom: "for now 1 to keep the
scope in check, later on the chat should move fully into studio". So the first Studio runs
one-shot jobs and records verdicts. Build nothing that a full transcript view would have to
tear out: the agent bridge streams turns, it does not return one finished answer.

## Still open

- **How a frame renders a component out of another project's checkout.** The barrel failure
  (`ERR_INSUFFICIENT_RESOURCES`) that the old tool never solved. The live frame above makes
  it urgent rather than theoretical.

## Order of work

1. Thinnest Studio that runs one call end to end, with the agent wired in.
2. From then on, every change to Studio is decided inside Studio.

## Current state

`apps/ethlete-studio` matches the Timetrack app: build configurations, Rust targets, eslint,
Tailwind with generated surface and colour themes, zoneless change detection, a hash-location
router, and a cold-Observable Tauri bridge in `src/host`. Run it with `yarn studio`.

The Rust host exposes `workspace_status`, `workspace_diff`, `workspace_check` and
`workspace_root`, the agent bridge (`agent_list`, `agent_run`, `agent_cancel`) with one
implementation per CLI, and the call model (`design_project`, `design_set_verdict`). A command
only answers when it is listed in `build.rs` **and** in `src-tauri/capabilities/default.json`;
two tests in `lib.rs` read the invoke handler and check both files.

Two views. `/` lists every call of a checkout, draws the selected option in a frame served by
that checkout's design server, and writes `accept`, `reject` and `open again` back into the call
file. `/agent` is the agent console. `design_project` reads `design-explore.config.json` from the
checkout, so Studio needs no config of its own.

Studio does not start the checkout's design server yet. The frame stays empty until `yarn design`
runs in that checkout.
