# Parallel backlog - decisions: Studio MVP scope, r2 and dogfood, build slices

### Studio MVP scope (Tom, 2026-10-31)

The yardstick for every new task. Tom: "ziel 1 war Studio zu nutzen um Studio zu designen um Studio dadurch besser zu
machen".

- Q131 MVP: Tom designs Studio's own UI in Studio, with agents. Every friction he finds becomes a fix to the tool.
  The MVP is done when all Studio pages are designed this way and merged.
- Q132 SDK rounds: no new sketches that Studio does not need. Studio uses button, form-field, select, input,
  textarea, tree and slider. Open rounds and their findings and lib fixes are finished; other open rounds wait for
  Tom's merge after the MVP.
- Q133 builder 33: after the slider fix, the input/textarea r2 rounds and the open findings, draw Studio pages and
  Studio parts as sketches for Tom to review in Studio.
- Q134 builder 57: finish the shot invalidation bug (friction). Build the global chat up to the view-context chip
  (Q127). Smart navigation (Q128) is after the MVP.
- Q135 after the MVP, unless one blocks Tom while he designs Studio (then it is friction and in scope): CEF runtime,
  more motion work, the SDK catalog in Studio, existing-code import, the git-free designer workflow, the old-chats
  list, wireframes.
- Q178 (Tom, 2026-10-31; moved into the MVP by Q218): Studio shows only the SDK base parts the Studio product actually uses, not
  every SDK part.
- Q184 after the MVP (Tom, 2026-10-31): a full performance investigation of Studio, the design server and
  `design check` (over 2 minutes for `--product studio` at 22:05; Tom, same day). The
  renderer still freezes again and again after the merge-freeze fix (`373e73641`); Tom: "das darf nicht passieren,
  die app fühlt sich dann nicht gut an und man muss lange warten". Measure where the main thread and the server
  loop block (merges, sketch lists, shot rendering, reloads), then fix until Studio never freezes.
- Q136 shot cache on disk (Tom, 2026-10-31, option b): build it now, before the view-context chip. Today the shots
  live only in memory, so a Studio restart (an edit under `src-tauri/**`) re-renders every part. The disk cache must
  keep shots across a restart and still invalidate on a render-path change (same rules as the in-memory key after
  the sha1 fix `42392387e`).
- Q137 builder 33 order (Tom, 2026-10-31, option a): the SDK rounds Studio needs, then the Studio pages and parts as
  sketches (Q133), then the other SDK components. This lifts the Q132 stop on new SDK sketches for the time after
  the Studio sketches.
- Lead call (Q96, 2026-10-31): chat MVP scope pushed (Q127 in `9d6a2789d`). Builder 57 next: (1) close the two Q127
  context gaps (no part source path; the context sends the picked variant, not the variant Tom looks at); (2)
  dogfood the MVP loop on its own ports and fix plain bugs, sending new looks or behaviour as questions.
- Q138 floating-action over a grey row (Tom, 2026-10-31, option b): the floating trigger gets the Q99a 1px inset
  ink edge in light only, for 3:1 against a light grey row (today the fill is 1.13, the Q105 shadow 1.19-1.46). Dark
  stays as is (fill 10.96). Round re-check `c3807b19f`.
- Q139 error-theme hover tones (Tom, 2026-10-31, option b): a hover in the error state uses the theme's next stronger
  tone (`-active` instead of `-hover`), the same rule as Q101 for filled buttons. Today the checkbox error hover is
  2.77 on dark and the text-field hover ink about 2.8 on white. No theme generator change.
  Refined as Q151 (Tom, 2026-10-31, option b): one tone for both schemes made the light hover (3.76) weaker than the
  light rest (4.83). The error hover is `light-dark(primary -hover, ink-active)`: 6.47 light / 4.76 dark, a small
  step over rest (4.83 / 3.71) per Q111. Also for dropzone and switch (their error border lost on hover; same bug as
  the Q100 checkbox, lead call).
- Q152 merge after a chat decision (Tom, 2026-10-31): when Tom decides a sketch detail in the grill chat, the builder
  merges that sketch per the decision (draw the combined variant first if none exists), then builds the lib change.
  Tom does not merge it again in Studio. Rounds he has not decided in chat still wait for his merge in Studio. Applies
  now to: floating-action variant d (Q138), input r2 and textarea r2 (Q140-Q144).
- Q153 MVP end (Tom, 2026-10-31): the MVP ends when the Studio designs are ready and merged. No implementation of a
  Studio design in `apps/ethlete-studio` without Tom's explicit go. Tom: many points are still not fully defined,
  and the tooling should say so. Open plan (grill next): the system that turns a design into Angular components,
  updates them, and checks that they match the current design. "Das System muss machen was geht, der Agent hat
  sonst zu viel Freiraum."
- Lead calls on the chat brief (Q96, 2026-10-31; plain fixes so Q145/Q146 work, after 57's real agent_run run
  `5ce4e9e4f`): (1) the brief and the allowlist use Studio's `cli_entry(checkout)` (`node <entry> design check|shot`),
  not `npx et`, which does not resolve in ethlete-sdk; (2) the brief says a change to a merged part goes through a
  sketch (`design sketch new`), the existing rule for every agent; (3) "fix the problems in the parts you changed",
  not every old check problem; (4) the brief names the `font-ui-*` / `text-ui-*` utilities and says the product
  stylesheet defines them; (5) chat runs get `--setting-sources project`, so Tom's global CLAUDE.md (ListAgents,
  peer messaging) does not load; (6) the Stop label fix.
- Q163 Storybook danger ink (Tom, 2026-10-31, option a, now): `apps/storybook/src/themes.ts` gets the light-scheme
  danger ink tones of the SDK foundation (`.ethlete/design/sdk/foundations/colors/colors.css`: ink 185,28,28,
  hover 153,27,27, active 127,29,29). Today Storybook uses one ink set for both schemes (light danger text 2.77).
  App theme data, no lib change.
- Q171 default dark surface (Tom, 2026-10-31, option b): sketch `foundations/colors` r1 (`a862255fc`) variant b.
  `.et-surface--default-dark` must not get the dark-elevated values. Merge per Q152, then fix
  `tools/scripts/generate-sdk-tokens.mjs:56` (`isDefault: false` for the elevated surfaces) so `yarn sdk:tokens:check`
  passes.
- Q172 merges by the grill lead (Tom, 2026-10-31): Tom allowed the lead to merge the decided SDK sketches: picks that
  apply decided rules only, and sketches with only today's variant. Undecided rounds still wait for Tom.
- Q174 both schemes in a sketch (Tom, 2026-10-31, option a): Studio shows each sketch variant in light and in dark
  side by side. Cause: accent-on-light a, b and c looked identical to Tom because Studio showed only dark, where the
  three are equal by design. The render queue serves the viewed frames first (lead call, sent to 57).
- Q180 icon-only tabs (Tom, 2026-10-31, from his tabs comment "es fehlen varianten mit icons"): `et-tab` gets an
  optional `ariaLabel` input, bound to the trigger button, so an icon-only tab has an accessible name. Then the tabs
  sketch adds icon-only states next to `icons` and `primary-icons` (`ad6cf7701`). Changeset and tabs docs guide.
- Q183 new SDK looks after the MVP (Tom, 2026-10-31): of the Q182 audit, only the scale rows (sizes, density,
  item sizes; lead merges under Q172) and new-look options that the Studio app itself uses come now. Every other
  new-look option (for example bracket double-elimination, tree selection modes) goes to the post-MVP roadmap and
  stays visible as an open point on its part. Tom also: the SDK builder makes no brand-new components for now, only
  work on the existing ones.

### Input/textarea r2 and chat dogfood decisions (Tom, 2026-10-31)

From input r2 (`6760644ee`, checkbox/radio `93a856190`), textarea r2 (`478d57480`) and builder 57's dogfood run.
Tom took every recommendation.

- Q140 focus colour, input and textarea alike: the surface text colour (17.9 light / 17.2 dark) for the 2px focus
  frame (input variant e, textarea variant d). The theme ink (5.48 light) loses to the light hover (6.69), against
  Q111.
- Q141 readonly signal: dashed frame (variant d). No lock icon; the lock already means "secret" on the API key field.
- Q142 readonly focus: a 2px dashed frame in the focus colour (Q140). Today the lib draws no focus frame there.
- Q143 rest frame: input and textarea use the same value, the input one (4.74 light / 6.94 dark).
- Q144 textarea resize grip in the corner (variant d), so text scrolls to the frame edge (Q118).
- Q145 Studio brief for the chat agent through `--append-system-prompt` in `agent_claude.rs`: how to check a change
  (`et design check`, a shot), no changeset for design files, use the product type tokens. Rust edit, Studio restarts.
- Q146 the brief points at the foundations/type part (`font-ui-medium`, `font-ui-strong`). No check warning yet; add
  one only if the agent still uses raw font classes.
- Q147 chat messages render a markdown subset: code, bold, lists. No tables, no images.
- Q148 a click on a part grid cell selects that state; the context line names the state.
- Q149 a sketch selection label reads like `pages/system · desktop (context)`, no repeats.
- Q150 opening the chat keeps Tom's zoom; Studio re-fits only when the view was fitted before.
  As built Q145-Q150 (builder 57, 2026-10-31):
  - Q145/Q146 `e902ae12a`: `STUDIO_BRIEF` in `agent_claude.rs` goes in through `--append-system-prompt` on runs
    without a tool server (the chat). Call runs get none. It names `npx et design check`, `npx et design shot
<layer>/<name> --states`, no changeset under `.ethlete/`, and the `foundations/type` tokens (`text-ui-sm`,
    `font-ui-medium`, `font-ui-strong`). Verified: cargo tests (one fails without the change), clippy, fmt. Not
    verified with a real chat run.
  - Q147 `06c986d1e`: `chat/chat-markdown.ts` parses paragraphs, fenced code, `-`/`1.` lists, inline code and bold
    into a typed tree; the panel renders it with control flow, no innerHTML. An unclosed fence runs to the end of
    the message. No nested lists, links, tables or images.
  - Q148/Q149 `2ac793020`: `DesignCanvasComponent.selectedCellId` (a click on a `[data-cell-id]` cell; resets with
    the frame selection); `ViewContext.state` reads `filled · hover` (no `rest`). A second click keeps the cell;
    grid padding clears the state. A sketch matrix frame reads `<part> · <size> (<state or context>)`; other
    frames drop a name another name contains.
  - Q150 `96ec2fe9f`: no code change. The canvas already re-fits on a width change only while it follows a fit
    (`following`); a manual zoom sets it to null. Specs lock this in. The dogfood re-fit came from a view that was
    still in its first fit. `focusFrame` keeps following its frame.
    Verified: 448 app tests, app and spec tsc, lint on the changed files; each new spec fails without its change.
    Not verified in Tom's Studio.
    As built (`f3727c4c8`): `libs/cli/src/lib/design/shot-store.ts`. An entry is keyed by the cli build stamp plus
    the memory cache key, and holds the picture, a scope string (drawn parts, fixtures, a listing of the shared
    directories) and the sha1 of every input file from the module graph (part, imports, product stylesheets, package
    files, tokens, config). A lookup rehashes the inputs; any change, a missing file or a corrupt entry is a miss.
    Entries live in `node_modules/.design-explore/shots-<checkout hash>/`, only for the shared listening server, and
    past 512 MB the oldest go. Verified: specs for a restart that keeps the shot (failed before the fix) and for a part,
    package, stylesheet or new shared file that redraws it; tsc, lint; a live check on own ports, 348 ms first draw,
    32 ms from disk. Not verified in Tom's Studio. Earlier fix `42392387e`: a rebuild that writes a package file back
    with the same bytes redraws nothing.

#### Build slices (builder ethlete-sdk-57)

1. Q129, built (`d3003cfc3`): a collapsible chat panel on the right of the app shell. Its state lives in a root store, so it
   survives navigation. Follow-up messages resume the same agent session. The `/agent` page and its call inputs
   go away; the Rust call tools stay as they are, and the chat sends `tools: null`.
2. Q127, built (`9d6a2789d`): a root view-context store that the system and sketch views write (product, part, sketch, variant,
   selection). A chip above the input shows it; one click removes it for the next message.
3. Q128, after the MVP (Studio MVP scope, 2026-10-31), not built now: during a run, Studio compares the frame revisions to find the part or sketch the run changed. If the view
   is still the one the message was sent from, Studio opens the result; otherwise the reply shows a link.
4. Q130: a "New chat" button that clears the messages and the session. No list of old chats (grill, 2026-10-31).

As built, slice 2 (`9d6a2789d`): `injectViewContext()` in `apps/ethlete-studio/src/app/chat/view-context.ts`. The
system view writes product, part and the clicked frame (`DesignCanvasComponent.selectedId`); the sketch view writes
sketch, sketch dir and the picked variant, and wins. A legacy call view writes nothing. `send` puts one line
`Studio view: product …, part …, sketch … (dir …), variant …, selected frame ….` in front of the prompt; the chat
shows the chip text muted above the user's own text. A removed chip stays away until the view changes or a message
goes. Gaps: no part source path (`ListedPart` has none); the variant is the picked one, not the one looked at.
Verified: 425 app tests, tsc, lint; the specs fail without the behaviour; a headless check with a faked design
server showed the chip, the remove, and the preamble. Not verified with a real design server.

5. Q127 gaps, built (`4d8f359ea`, `24fa2c9cc`): `ListedPart.file` (relative to the workspace, from
   `listSystem`) goes into the line as `part … (file …)`; a sketch names its target part's file. The variant is the
   selected frame's variant, else the one with the most visible frame area (`areasInView` in `canvas-math.ts`, the
   canvas signal `frameAreasInView` at rest), else the only one; the pick shows as `picked a` when it differs.
   Verified: app tests, 887 cli design tests, tsc, lint; specs fail without the change. Not verified in a running
   Studio; the in-view rule only by the pure spec.
6. Dogfood, done (2026-10-31): a headless Studio on own ports, with real `claude` sonnet runs bridged into the
   stub. The agent found the part file from the context line alone. The frame redrew about 0.4 s after the edit.
   Follow-ups resumed the session. A sketch from the chat appeared in about 3 s. Fixed: `edf553ea7` (the finished
   line repeated the last message) and `8b35a636f` (sketch check, new and ready wrote the four design tsconfigs
   again with the same bytes, so Vite reloaded every frame). Open design questions went to the grill: a Studio brief
   with `--append-system-prompt` (design check, no changeset, type tokens), markdown in messages, a grid-cell state
   as the selection, a shorter sketch selection label, and the canvas zoom when the chat opens. Not exercised: the
   real Rust `agent_run`, Stop, Codex, chip removal, the disk cache across a restart.

As built, slice 1 (`d3003cfc3`): `injectChatStore()` in `apps/ethlete-studio/src/app/chat/chat-store.ts` (root
provider) holds the CLI, the model, the entries, the session and the open flag. `ChatPanelComponent` sits beside
the router outlet in `app.component.ts`, 420px wide when open. A follow-up message resumes the session; a CLI change
clears it. The open flag is stored as `chatOpen` in the remembered view; the panel starts closed. The "New chat"
button of slice 4 is in too. Verified: 419 app tests, spec and app typecheck, build, lint on the changed files;
the resume spec and the panel specs fail without the behaviour. Not verified yet: the panel by eye (a headless
check runs).

### Open point: elevation on dark surfaces (Tom feedback, 2026-10-30, design round decided in Q95)

Seen on sdk `foundations/colors`, "Surface, dark": the `Resting` and `Raised` shadow samples are almost
invisible; on "Surface, light" the shadows work. On dark UIs an elevated element usually also gets a lighter
background, but a raised background breaks the surface system (one background per surface theme). Needs its own
design round: how elevation reads on a dark surface within the surface theming. Doc only for now, nothing to
build.
