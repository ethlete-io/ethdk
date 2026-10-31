# Parallel backlog - decisions: overnight, input and textarea, morning, chat

### Overnight decisions (Tom, 2026-10-31)

- Q93 (was Q91): a selected tree row in the light scheme gets a stronger background tint, no edge bar. Built as a
  sketch round on sdk `components/tree`; Tom picks by merge.
- Q94: no Rust for render speed. The 2c measurement showed the time goes to Chromium and Vite, not the host.
  Reopen only if a new measurement shows a host hot spot.
- Q95: elevation on dark surfaces gets a sketch round on sdk `foundations/colors` (or the elevation part): a) a
  1 px light ring from a surface-theme token, b) stronger shadows in the dark scheme only, c) a top-edge
  highlight. No variant changes the background (one background per surface theme).
- Q96: overnight the grill session decides alone only inside existing rules (token choice, spacing on the
  grid, states after a decided pattern) and records each one here. New looks become sketch rounds. No builder
  merges a round; merging stays with Tom. Risky points (public API, breaking change, release) are noted for Tom
  with a recommendation.
- Tom: keep the tree committed, push from time to time, and check CI.
- Grill decision (inside Q51): the switch focus ring uses the ink token, like the tree focus ring. It is part of
  the switch round `f49f5ab8a` (all variants). The light on-track fill (primary, 1.33:1 on the light panel) gets
  its own round later.
- Tom: the swap between the live iframe and the shot image (both ways) flickers. Optimise it: keep the old view
  until the new one has painted, then switch in one step. Queued for `ethlete-sdk-57`.
- Grill decision (inside Q60): Studio chat sends `tools: null`, so the one MCP server never starts from Studio.
  Wire it now; the chat prompt names the call and the variant. Queued for `ethlete-sdk-57`.
- Q93 round ready: sdk `components/tree` r1 "Light selected row tint" (`0a75f4f34`), builder pick b
  (32/38/44 %, ink 4.74-4.56:1). A pure tint stops at about 1.2:1 against the panel (ink falls under 4.5:1 above
  47 %). Grill decision: add variant d now (56-64 % tint with a darker selected-row ink), so Tom sees the full
  range in one review.
- Q93 variant d added: 56/60/64 % tint, label ink 80 % mixed with black (ink vs fill about 6:1, fill vs panel
  1.27:1). A merge of d needs a darker selected ink (new generator token or a color-mix in tree.component.css).
- Q95 round ready: new part sdk `foundations/elevation`, r1 "Dark elevation edge" (`466dfc5b5`), dark only. Edge
  vs base / pane on panel: today 1.76/1.50, a ring 2.61/2.22, b shadows 1.92/1.86, c highlight 1.76/1.50. Builder
  pick a. Grill decision: add variant d, the ring at the strength that reaches 3:1 (about 29 %). A merge needs a
  lib change: generator emits `--et-surface-ring` per surface theme (light = border); select-panel, floating
  panels and the menu use it.
- Generator bug: in foundations/colors `colors.css`, `.et-surface--default-dark` sits in both the dark and the
  dark-elevated blocks, so the dark-elevated values win. Grill decision: a round for Tom (a today, b fixed), not a
  silent fix, because tonight's merges were reviewed against today's look.
- MCP from Studio chat wired in `8454ff6e0` (real haiku turn called `mcp__studio__call`; Tauri window not
  verified). Open for Tom (Q97): Studio has no selected call/variant, so the /agent chat page has two text inputs,
  Call and Variant. Builder recommendation: open the chat from a call's view with both filled in, and drop the
  inputs.
- Q95 variant d added: ring at 30 % (3.12:1 vs the base, 2.64:1 vs the panel fill). Builder pick stays a (quieter).
- Tooltip round ready: sdk `components/tooltip` r1 "Pane edge" (`058c0fd85`). In dark the fill equals the base
  (1.00:1); only the 1 px border marks it (1.73:1). b = `--et-surface-ring` at 24 % (2.12:1), c = 35 % (3.1:1).
  Light unchanged. Builder pick b. Open for Tom (Q98): decide the dark ring once for elevation and tooltip. For
  WCAG 3:1 one mix does not fit both (elevation needs 30 % over the fill, tooltip 35 % over the base): use 35 %
  for both, or per-surface values in the generator.
- Generator bug, revised: cause `tools/scripts/generate-sdk-tokens.mjs:56` keeps `isDefault: true` on the
  elevated surfaces. No sdk part uses `.et-surface--default-dark`, dark shots of a and b are byte-identical. Grill
  decision: fix the generator directly (no visible change). The round on foundations/colors (`a862255fc`) is moot;
  only Tom discards it in Studio (morning list).
- Q92 built in `03a2369fb` (Light and Dark column groups, `frame.html?scheme=`; Tauri window not checked). Grill
  decision (inside Q92): non-grid part frames (pages, declared-width parts, flow frames) also show Light then Dark,
  side by side, or stacked when a frame is too wide for two in a row. Legacy call shots keep the Studio colour mode
  (Q69). A part without a dark scheme still shows both groups, so the fault is visible.
- Switch r2 "On track in light" ready (same sketch, assumes r1 pick b). d (pick): mint fill + 1 px ink inset
  ring (5.48:1), ink dash and thumb; e: on track filled in ink, light loses the mint.
- Mint under 3:1 in light is one system question (like Q75/Q87): `ethlete-sdk-33` scans libs/components and
  proposes one rule with variants instead of one round per part. For Tom as Q99.
- Noted for Tom, low priority: the choice-field label line box clips by under 1 px at sm and lg (line-height
  1.2, overflow hidden). No glyph is cut.
- Q92 non-grid frames built (`aa6165ad5`). Lead decisions under Q96: keep the 1024 px side-by-side threshold;
  merge-preview frames also draw Light + Dark (they show what lands); the sketch matrix stays one copy (a variant
  comparison, already wide).
- Q59 lead decisions under Q96: 6a shows the first token with the track's value in foundations declaration order,
  plus "+N" when more tokens share it; the title lists all names and the raw value. 6b: opening the timeline makes
  the frame live and drives it; closing it leaves the frame live, resumed at 1x.
- Q59 6b built (`840272d27`). Lead decisions: keep the hidden keyframe image and the "in the live frame" header;
  a preset or Reduced change makes the new frame live too; opening the timeline focuses the driven frame. For Tom:
  only the first colour-scheme copy is driven, and a `from` state in a part grid cell keeps images (both accepted
  for now).
- `sketch ready` vs render issues (found on description-list): ready runs only static checks, so a render OVERFLOW
  passes. Lead decision under Q96: ready runs the render check and refuses on a render issue, also one the product
  part already has, unless a `data-et-skip` mark names it; no browser prints "RENDER CHECK SKIPPED" and accepts.
- Grid reveal with a hung shot (found in the 6b check): reveal waits only on image load or error, so a shot that
  never answers hides the grid forever. Lead decision under Q96: reveal once every cell is loaded, failed, or in the
  existing slow state (over 2 s), so the user sees per-cell slow marks.
- Q59 6a token names: Jost renders "--" as an en dash. Lead decision under Q96: token names use font-mono, like
  the element name above them. As built ("Show motion token names in the mono font"): a token name gets
  `font-mono`, a raw value keeps the body font. Spec checked to fail without the fix; no real-browser check.
  As built ("Reveal a Studio frame grid when a shot is slow"): a cell settles when its shot turns slow and keeps
  the failed min size. Chromium, studio-lab `components/button` with the 5 solid light shots held: the grid revealed
  at ~2.3 s with those 5 cells "Rendering", the rest drawn; released, they swapped to loaded.

### Input and textarea decisions (Tom, 2026-10-31)

From input r1 (`da383db15`) and textarea r1 (`4bacbaf9b`). Asked in chat as Q104-Q116 by a fresh grill session
that missed the handoff; renumbered here because Q104/Q105 were already taken.

- Q106 (L1): `et-form-field > et-description` gets the same inline-start padding as hint and errors. Patch.
- Q107 (L2): `.et-input-native::-webkit-search-cancel-button { appearance: none }`. Patch. No et- clear button until
  a case needs one.
- Q108: every input frame is at least 3:1 against its surface, also in error; error uses the full danger tone.
  Follows Q42 (inputs keep their own 3:1 tokens).
- Q109: the placeholder is at least 4.5:1 and still lighter than the value.
- Q110: readonly needs a visible signal that is not only a colour; a dashed frame is the candidate.
- Q111: focus is always the strongest input state: a 2px frame in ink or accent, no halo ring (focus stays on while
  typing). Hover is a small step over rest, only on unfocused fields; a focused field does not change on hover.
- Q112: a text prefix (for example "€", "https://") sits about 4px from the value; an icon prefix keeps the full
  affix gap.
- Q113: the required marker is not exempt (checkbox r1 only listed it as open). It needs 4.5:1, so the danger text
  tone gets lighter in dark. Applies to all form fields.
- Q114: rules Q108-Q113 are drawn first as an r2 round of input and textarea (plus checkbox and radio shots for the
  danger text), then built in one lib commit after Tom merges.
- Q115 (L3): textarea padding-block centres the first line like the input (13.5px at md). Patch; the changeset says a
  rows=1 textarea grows by 15px.
- Q116 (L4): `[data-resize='vertical']` gets `min-block-size: 1lh`. Patch.
- Q117: keep the browser resize grip; draw its position (corner vs 13px inside) as an r2 variant.
- Q118: no fade on scrolled textarea content; text scrolls to the frame edge like a native textarea (r2 variant).

### Morning decisions (Tom, 2026-10-31)

- Q97 rejected: the Studio chat's Call/Variant inputs and the MCP `call` tool build on the old `.ethlete/design/calls`
  system (last touched 2026-10-26). Tom: "calls? das ist doch das alte system". Follow-up question open.
- Q98: one dark ring mix for elevation and tooltip, 35 % `--et-surface-ring`. Condition from Tom: the builder first
  reads the theming skill (surface system, including auto surface) and checks that panes and tooltips also look good,
  not only pass 3:1.
- Q99: rule a. In light, edges, rings, focus rings, indicators, dots, text and icons use ink; mint fills stay with a
  1 px inset ink edge; buttons keep their mint fill. Dark unchanged.
- Q100: hover and error borders in primary are a lib bug; error resolves through the semantic error theme. Patch.
- Q101: a filled et-button hovers to the theme's `-active` token; pressed goes 16 % further (button r1 b).
- Q103: a product without a light scheme (studio, studio-lab) draws one colour-scheme copy.
  As built (builder 57, 2026-10-31): a product declares `schemes` in `.ethlete/design/config.json` (`["light"]`,
  `["dark"]` or both; inherited from its base; both when absent; a bad list is a `SCHEMES` problem and falls back to
  both). `studio` and `studio-lab` declare `["dark"]`. `/__design/system` sends the list; every frame kind that had
  two copies draws one, pinned to `?scheme=dark`, with no scheme label or Light/Dark grid heading. A Studio on an
  older CLI keeps both copies. Verified: 7 new specs failed at HEAD and pass (Studio 411, CLI design 878 tests), tsc
  and lint clean, the real config resolves `studio`/`studio-lab` to dark and `sdk` to both. Not verified: a running
  Studio; the :4402 server serves `schemes` only after a restart on the new CLI.
- Q104: a stat-tile without a success theme falls back to the inherited theme with a dev-mode warning. Patch.
- Q105: the floating trigger gets a light shadow only while it floats, faded in with opacity only.
- Q119 (otp, 33's "Q103"): filled and empty otp segments look the same; every segment gets the 3:1 input frame
  (Q108). Caret and focus frame show the next segment.
- Q102: the Q99a inset ink edge draws only in light. In dark ink is mint (13.50:1), so the edge adds a second line
  and no contrast. Applies to every part.
- Q120 (replaces Q97): calls are legacy and go away once the existing calls are migrated. The Studio chat becomes a
  new, global system: one chat that stays open while Tom moves between pages, parts and sketches. When the agent
  opens a sketch, the same chat goes on; no new chat per view. Details (how the chat learns the current view) are
  the next grill round.
- Slider r1 (`63d4f261a`) lib bugs, all patches: Q121 (S1) the value bubble no longer covers the label (host flag
  when a thumb label template exists, 18px block-start space). Q122 (S2) the range slider's interaction box is
  `max(44px, var(--et-slider-thumb-size))` like et-slider; the changeset says it grows by 16px. Q123 (S3) vertical
  tick labels get a grid column sized to the longest label. Q124 (S4) end bubbles and tick labels clamp at the ends.
- Q125: slider contrast rule: the thumb is at least 3:1 against the page and the rail; the fill is at least 3:1
  against the rail; the rail itself may stay light (a dark rail takes the fill's contrast away).
- Q126: an invalid slider gets no own mark; the error text under the field carries it, like every form field.

### Global Studio chat decisions (Tom, 2026-10-31)

Follows Q120. Built on products, parts, sketches and variants; nothing on legacy calls.

- Q127: like Copilot, every message carries the current view as context automatically: product, part, sketch,
  variant, and the selection when one exists (a clicked frame or state). A chip above the input shows it; one click
  removes it.
- Q128: the agent navigates smartly. If Tom asked for something on view X and is still on X (waiting), Studio opens
  the result directly. If Tom has moved on to other work, the chat shows a link instead. The chat stays open either
  way.
- Q129: the chat is a collapsible panel on the right that survives navigation. The `/agent` page goes away.
- Q130: one running chat with a "New chat" button; a list of old chats only when Tom asks for it.
