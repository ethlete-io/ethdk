---
status: accepted
built: 7707b8413
decided: 2026-11-01
source: the decisions logs and builder status of the parallel backlog and the wireframes handoff (deleted in B597), rulings of the human of 2026-10-29 to 2026-11-01 (Q-numbered) that no ADR recorded
---

# Studio rulings of 2026-10-30 to 11-01, before the ADRs

The Q-numbered rulings of the first Studio dogfood weeks. Look rulings that live in a design part or in `libs/components`
are not repeated here; the part and its note are the record. What stays is the standing rule.

## How agents work

- Overnight, the grill session decides alone only inside existing rules (token choice, spacing on the grid, states after
  a decided pattern). A new look becomes a sketch round. Public API, breaking change and release are noted for the human
  with a recommendation (Q96).
- A sketch goes to `ready` only when nothing waits on it: no open decision, no helper, no "adapt once X is decided". The
  question goes to the human first, then the sketch changes, then `ready`.
- When the human decides a sketch detail in the grill chat, the builder merges that sketch per the decision (draws the
  combined variant first when none exists) and builds the lib change. The lead may merge decided SDK sketches: picks that
  apply decided rules only, and sketches with only today's variant (Q152, Q172). Undecided rounds wait for the human.
- Each turn the builder runs `design sketch list` and merges every sketch that is "picked"; the Studio pick does not merge.
- An agent never gives a go or an acceptance for the human.
- Building a merged design into `apps/ethlete-studio` is a design test. Every slice reports next to what it built:
  **missed design** (a state, part or behaviour the design lacks, so the agent decided it), **invented** (built but not in
  the design), **worked around** (the design, the tool or the SDK), **too big** (a component that should be split in the
  design first). The agent does not resolve these alone: a missed design or an invention is a design question, a
  workaround is a friction fix, a too-big component is a split in the design.
- Codex agents are started through `codex-agent.mjs` until the human has weighed the alternative (a Codex tmux session
  behind the agent-sessions mailbox). Needs its own grill round.

## Studio scope and after the MVP

- The yardstick for a task: the human designs Studio's own UI in Studio with agents, and each friction becomes a fix to the
  tool. The MVP was reached on 2026-11-01 (26 of 26 Studio parts clean in `design check --complete`).
- After the MVP, unless one blocks the human while designing (then it is friction and in scope): the CEF runtime, more
  motion work, the old-chats list, wireframes, smart navigation of the chat (Q128: Studio opens the result when the human
  still looks at the view the message came from, otherwise the reply shows a link), a full performance investigation of
  Studio, the design server and `design check` until Studio never freezes (Q184).
- The SDK builder makes no brand-new components for now. Of the new-look options only the scale rows (sizes, density, item
  sizes) and options Studio itself uses come early; every other one stays an open point on its part (Q183).
- Studio shows only the SDK base parts Studio uses (Q178, ADR 0067).
- Open, no decision yet: the unlinked Studio parts and `studio-view.component.ts` without a part (Q247, Q248: recommended
  `elements/canvas-frames` to `canvas-frame-grid.component.ts`, `studio-view` to `elements/shell-main`); the demo frame of
  `components/floating-action`, whose two-element frame breaks the one-element path normalisation of Q243 (recommended:
  teach the normalisation); the four missing states of the SDK checkbox variant d (option.disabled, select-all hover,
  active, disabled) before its lib port; a `design dom <part>` command that prints the rendered HTML of a part; a way to
  schedule a session restart for a time (`restart <name> --at <time>`) so a session at the usage limit resumes after the
  reset.
- Everything else that the MVP push taught, the human wants fixed in the system so that it cannot happen again: one
  measure that shows every blocker (plain `design check` hides what `design ready` draws), a warning on a `dist/libs`
  older than the lib sources, button colours living in the SDK part and in the lib, a design server that is older than the
  CLI saying "restart" instead of "no system view", forced hover and active never applied to disabled states, detection
  rules that are too narrow at first, parts that cannot use `!` or glued class strings, and default ports that never
  collide (the tomflix design server and the docs-examples app both use 4403).

## Look rules that stay valid

- Light scheme (Q99, Q102): edges, rings, focus rings, indicators, dots, text and icons use ink; a mint fill keeps a 1 px
  inset ink edge in light only; buttons keep their mint fill. Dark is unchanged.
- Form controls (Q108-Q113, Q125, Q126): every frame is 3:1 against its surface, also in error, and the error uses the full
  danger tone; the placeholder is 4.5:1 and lighter than the value; readonly shows a signal that is not only colour; focus
  is the strongest state (a 2 px frame, no halo) and a focused field does not change on hover; the required marker needs
  4.5:1; a slider thumb is 3:1 against page and rail and its fill 3:1 against the rail; an invalid slider has no own mark.
- Hover and pressed (Q101, Q139, Q151): a filled button hovers to the theme's `-active` token; an error hover is
  `light-dark(primary -hover, ink-active)`, a small step over rest.
- Control frames use `surface-interaction`; container edges keep `surface-border` (Q188). Dark elevation uses one ring mix,
  35 % `--et-surface-ring` (Q98).
- A product without a light scheme declares `schemes` in `.ethlete/design/config.json` and draws one copy (Q103). Every
  other frame kind draws a Light and a Dark copy (Q92, Q174); sketch matrix cells stay single.
- Icon-only tabs: `et-tab` takes an `ariaLabel` bound to the trigger (Q180).

## Chat

- One global chat, a collapsible panel on the right that survives navigation; the `/agent` page and the old call inputs are
  gone; "New chat" clears it, there is no list of old chats unless asked for (Q120, Q129, Q130).
- Every message carries the current view as context (product, part, sketch, variant, selection); a chip above the input
  shows it and one click removes it (Q127).

## Comment editor

The comment editor stays open only while focus is inside it, Send included. Without focus it closes; there is no open but
unfocused editor. Closing does not send; keeping or discarding the draft is not decided.
