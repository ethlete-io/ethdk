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
   pointed at `apps/timetrack/src/design/calls`, whatever project the work was for.
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
`.ethlete/design/calls`. Most have 3 to 4 options in one round; the two large
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

## The drawing language: no framework

A drawing is a **value, not a component**. `@design-explore` exports `html` and `css`, which tag a
template literal so Prettier formats it and an editor highlights it, and `drawing()`, which types
the pair the frame renders. The frame injects the styles and writes the body into its root.

The count that settled it. Across the 141 Angular drawings there was not one `signal()`,
`inject()`, `effect()`, lifecycle hook or `(click)` handler, and not one import of a real
`@ethlete` component. What they used was `@if` (118), `@for` (62), `[class.…]` (70) and
`[style.…]` (78) over a constant fixture. Angular was charging a full compiler for a template
engine, and its compiler is what kept breaking.

What the change buys:

- **Nothing compiles a template.** Vite's esbuild strips the types. A broken drawing throws a
  JavaScript error with a real line number, not a template compile error.
- **The CSS loses its selector prefix.** Every rule was hand-scoped with the component selector,
  because `ViewEncapsulation.None` makes styles global. A drawing owns its whole frame, so the
  prefix goes and the host rules move to `#root`.
- **The barrel failure stops mattering for drawings**, because a plain drawing imports nothing
  from the libraries.

Rejected: **htmx** swaps server fragments on user events, and a drawing has neither. **Vue** is
still a compiler and a runtime, bought for reactivity no drawing uses. **Plain HTML files** have
no loop, so a column of eight variants becomes copy-paste and a fixture change stops reaching the
picture. **Lit** is the same template literals plus a runtime that would go unused.

Every drawing converts and Angular leaves the design server. The frame renders both shapes while
the conversion runs, so every state of the tree works. A design-mode call that one day has to draw
a real `et-button` can get the Angular loader back; none does today.

## Still open

- **How a frame renders a component out of another project's checkout.** The barrel failure
  (`ERR_INSUFFICIENT_RESOURCES`) that the old tool never solved. It no longer touches drawings,
  which import nothing from the libraries, but a call that wants the real component library still
  has to pre-bundle it.

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

Two views. `/` opens on the checkout's projects, then lists that project's calls under one band per
feature, with a filter box and a choice of
order (by name, or the calls with open options first), draws every variant of the selected call in
frames served by that checkout's design server — a column of thumbnails beside the one under study —
and writes `accept`, `reject` and `open again` back into the call
file. The four verbs write a first draft of the prompt into an editable box under the frame, and
`accept` and `reject` also write the verdict. The box sends through the agent bridge, and the
run's events read beside the frame. The selected call and option are remembered in
`localStorage`, so a reload comes back to them. So is the agent session of each call, with the size
it grew to; a session past 70% of the 200k limit offers the handoff described below. `/agent` is the agent console. `design_project`
reads `.ethlete/design/config.json` from the checkout, so Studio needs no config of its own.

Studio starts the checkout's design server itself. When a checkout is set, the host probes the
port the config names and runs `yarn design` there if nothing answers, so the frame is never empty.
A server somebody else started is left alone and only reads as running; a server Studio started
carries a Stop control and ends with the app. The header names the port and the state, and the
last lines the server printed read below it while the port stays silent.

## The next round Tom asked for

Studio stays an Angular app. The alternative, plain HTML and JavaScript, would cost more to write
and to change: the frames already render Angular components, the repo's lint rules, theming and
component library apply to Studio's own surface, and an agent writing a feature here follows
patterns it can read out of the repo instead of hand-rolled DOM code.

1. ~~**A welcome screen that selects a project.**~~ Done. Studio opens on a grid of the checkout's
   projects, and the list then holds one project. The choice is remembered.
2. ~~**One more layer above a call.**~~ Done. `call.ts` declares `feature`, the host reads it, and
   the list draws one band per feature. A call that names none reads under "No feature". The
   feature is a field, not a folder level, so no call folder moves.
3. ~~**A remembered agent session.**~~ Done. A run reports its session and how much it reads,
   Studio keeps both per call and CLI, and the next run of that call continues it. A meter beside
   the session shows how full it is. Past 70% of 200k a "Hand off" control appears: it asks the
   full session to write its state into `handoff.md` next to the call, then drops the session, and
   the next verb tells the fresh session to read that file. Nothing happens without the user.
4. ~~**One chat surface.**~~ Done. The call `studio/00-chat-surface` asked where the conversation
   lives and drew three answers: a right rail, a bottom dock, and a drawer over the drawing. Tom
   chose **the right rail**. Width is the cheaper dimension to give up: a frame that runs out of
   height has nowhere to go, and a drawer hides both what was said and the drawing it talks about.
   So the prompt box, the run's actions and every earlier turn share one column at the right edge,
   oldest turn at the top, the prompt box at its foot. A conversation now outlives the run that
   made it: `sessions.ts` stores every turn beside the session id, one per call and CLI, and keeps
   the last `TURN_LIMIT`. A reload shows what the resumed session holds, so the rail never claims
   the agent remembers more than it does; dropping the session drops its turns with it.
5. ~~**Studio does the boilerplate.**~~ Done. The three verbs that open a round - Iterate, Reject
   and More like this - now ask two things before they draft: how many variants, and what the round
   asks. Studio then writes the round into `call.ts`, one entry per variant, and one empty component
   file per variant, and the prompt names those files. `name`, `claim` and `cost` stay empty: only
   the drawing can argue them, so the agent writes them once it has drawn. A key is taken only when
   no option claims it **and** no `option-<key>.ts` already exists, so an orphaned file is never
   overwritten.
6. ~~**Tools the agent can call.**~~ Done. Studio is the tool server itself: the binary started
   with `mcp` speaks stdio MCP and answers `read_call`, `read_fixture` and `check_call`. Every tool
   takes no argument, because Studio already holds the checkout, the call, the variant and the
   design port, so a run can never name the wrong call. Claude Code gets the server through
   `--mcp-config`, with `--strict-mcp-config` so a design run pays for no server the checkout
   happens to configure; Codex gets it through two `-c mcp_servers.studio.*` overrides. A second
   CLI stays one more implementation. `check_call` writes its result into a receipt file under the
   temporary directory, keyed by checkout, call and variant, so Studio reads it back with
   `design_check` and the frame footer says `check passed`, `check failed` or `not checked`. The
   hard rules are a fixed section of every prompt draft: never import a package barrel, never
   change the fixture, one component file per variant, run `check_call` after every edit. The check
   **reports** and never blocks: Accept always works, because a small visual call is worth ruling on
   whether or not a check ran.
7. ~~**A workbench that shows every variant at once.**~~ Done. The option tab strip is gone. A
   narrow scrolling column of thumbnails stands at the left of the stage, and the variant under
   study takes the rest of the width and the full height, because a drawing of an application is
   tall as well as wide. The verbs, the variant name, its verdict and the frame address sit under
   the large picture. A thumbnail carries no control of its own: every verb belongs to the variant
   under study. A verdict reads without a word — a rejected tile falls to `opacity: 0.32`, a chosen
   one keeps full strength with an accent border and its name in the accent, an open one is plain —
   and the tile under study carries a full-strength border. Three calls under
   `.ethlete/design/calls/studio/` settled that shape: `01-workbench`, `02-tile-controls`
   and `03-verdict-mark`.

   The fourth question, how a thumbnail is taken, was dropped instead of put to a call. A tile is
   the variant's own frame, scaled down with a CSS transform: Studio already loads one frame per
   variant, so a live tile needs no new machinery and cannot go out of date. Staleness was never
   the hard part either — `tools/design-explore/check-call.mjs:88` already launches a headless
   Chromium and `tools/design-explore/server.mjs:80` already watches the calls folder, so a
   background shooter is small work. A captured picture is still worth building later, because a
   live tile costs one running copy of the drawing per variant.

8. ~~**Wireframe mode.**~~ Done. `call.ts` carries an optional `mode: 'wireframe'`, the host reads
   it, and the workbench says `Mode: wireframe` or `Mode: design` under the picture and switches it
   with one press. The mode belongs to the **call**, so every variant of it is drawn under the same
   rules and the thumbnail column compares like with like. It changes **the agent's rules only**: a
   wireframe prompt asks for the bare workflow, every value mocked, no logic, no hover, focus,
   pressed or disabled state, and nothing spent on the finish. A design prompt asks for the real
   thing. Nothing renders differently, so a variant already drawn keeps its picture when the mode
   turns over. `design` writes no field, because a call that names no mode already draws the real
   thing and the two must not read as different calls.

9. **A workflow that creates the work itself.** Studio starts a new project, adds a task under it
   and adds a call under a task, writing the config and the files each one needs. Today every one
   of those is hand-written in an editor. The naming is open: today a drawing is an option inside a
   call, and the new layer above is called a task here only to have a word for it.

### The names

Tom settled them: **project → feature → call → variant**. A project holds features, a feature holds
calls, and a call holds the variants drawn for it.

`variant` is decided but not yet renamed. The code, the call files and the design server still say
`option`. A rename rewrites every `call.ts`, and four call folders in the tree are another session's
uncommitted work, so it waits for a clean tree and gets its own commit.

Open, and Tom decides: whether a live tile survives a call of two dozen variants, or the column has
to move to captured pictures. A tile also assumes a 16:9 window, because the design server reports
no frame height.
