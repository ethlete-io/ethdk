# Design to code

Status: decided (Tom, 2026-10-31), not built.

## Goal

A merged design becomes code under the control of the system, not of the agent. Tom: "Das System muss machen was
geht, der Agent hat sonst zu viel Freiraum." No implementation without Tom's go (Q153).

### Design to code decisions (Tom, 2026-10-31)

- Q154 check, not generate: the agent implements the design. The system renders the real Angular component in the
  same states and compares it pixel by pixel with the merged design. The goal for SDK components is one shared
  source (the design draws the real template and CSS); the mocks with the real component CSS are close to it today.
- Q155 open points: the system computes a list of open points per part. Studio shows it on the part, and
  `et design check` prints it. A part can be set `ready` only when the list is empty. The system enforces this.
- Q156 the list counts:
  1. A missing state, against the state list for that kind of component (a button without `focus`).
  2. A contrast under the rule: under 3:1 for frames and icons, under 4.5:1 for text.
  3. An open comment on the part.
  4. A sketch in progress, or ready but not merged.
  5. An open question in a plan that names the part. Built last (the system must read the plans).
  6. A part with no linked component (Q157).
  7. The implementation differs from the design (Q159), or the part has no go (Q158).
  8. A missing transition or motion between states.
- Q157 link: the part names its component itself, for example
  `implements: 'apps/ethlete-studio/src/app/…/tree-row.component.ts'`; a page part names its route. No name-based
  guessing. A part without a link is an open point.
- Q158 go: an explicit "Go" action per part in Studio. It stores the design state Tom released. The CLI refuses an
  implementation of a part without a go. A new design change needs a new go.
- Q159 compare: the part declares the inputs per state; the system forces hover, focus and active in the browser.
  Both sides render in the same Chromium with the same fonts. Tolerance 0 px; an exemption per state (for example an
  animation) only with Tom's OK, and it shows as an open point.
- Q160 task: the system gives the agent a fixed task: the part, the released state, the states changed since the
  last implementation, the allowed files, and the target "compare green". The system rejects an implementation that
  changes other files or has a red compare.
- Q161 SDK too: the same flow for the `sdk` product and `libs/components` (go, task, compare). A lib change also
  needs a changeset and docs; the system checks both. This replaces the hand edit after an SDK merge.
- Q162 MVP scope: only the open-point list (Q155, Q156) and the link (Q157) are in the MVP. Go, task and compare come
  after the MVP, before the first implementation. The motion editor is not in the MVP. Tom: the global chat was not
  MVP either ("da haben wir nun schon den Salat"); keep the MVP strict.

- Q164 state list (Tom, 2026-10-31): open point 1 reuses the control requirements of `et design complete`
  (`libs/cli/src/lib/design/design-command.ts:96`); new kinds go into that table. A component part that declares no
  `controls` gets the open point "no controls declared"; page parts are exempt.

- Q165 foundations (Tom, 2026-10-31): foundations count as linked. They implement tokens, not a component, so they
  never get the "unlinked" open point and can become ready.
- Q166 sketch without a part (Tom, 2026-10-31): a sketch for a part that does not exist yet gets no open point. Leave
  it until Studio lists sketches as their own entries.
- Q167 missing motion, open point 8 (Tom, 2026-10-31): follows `plans/ethlete-studio/motion.md` ("hover and press
  are states, so they are motions too"). Every state pair of the Q164 control table that a user reaches by an
  interaction needs a motion in both directions, for example rest <-> hover, rest <-> press, collapsed <-> expanded,
  closed <-> open, hidden <-> visible. A colour change is enough as a motion (a short token transition). One open
  point per missing pair and direction, for example "no motion collapsed -> expanded". Focus may have a motion but
  does not need one (no open point). Rest <-> disabled needs a motion too (Tom), although the app sets it, not the
  user. A state that shows ongoing work (loading, pending, indeterminate progress, a spinner) needs a looping motion
  inside that state, plus the motions into it and out of it (Tom). How a part declares a looping motion is a builder
  call.
- Q168 every state change is a motion (Tom, 2026-10-31), replaces the pair list of Q167: every ordered pair of a
  part's states needs a motion, including combined states (hover -> hover + disabled while the pointer stays), an
  element that mounts or unmounts (select body, dialog open and close), and a move inside the part (a tab underline
  that follows the active tab by FLIP, a sidebar that morphs into a detailed state on hover and back on exit). A part
  may mark a pair as unreachable, with a reason; only such a pair gives no open point. Focus stays optional. The
  looping motion for ongoing work and "a colour change is enough" from Q167 stay.
- Q169 contrast of frames and icons (Tom, 2026-10-31): the render check gets a 3:1 measure for borders and icon fills,
  as a follow-up of slice 2. Today it measures text only.
- Q170 large text (Tom, 2026-10-31): the WCAG large-text rule stays. Text from 24px, or from 18.66px bold, passes at
  3:1; other text needs 4.5:1. This refines Q156.
- Q173 states are user states (Tom, 2026-10-31): `states` holds only the states a user can reach in one instance.
  Showcase variants (size, theme, tone, group) move to the existing grid or variant axis, and motion points count
  only `states`. The builder migrates the design data of both products (studio, sdk), with `et design check` as the
  guide. Reason: point 8 gave about 3,750 motion points per product, mostly pairs of showcase variants that never
  animate into each other.
- Q175 which borders need 3:1 (Tom, 2026-10-31): only borders that identify a control (control boundaries, focus,
  state, and the frame that wraps a control such as the form-field) are measured, as WCAG 1.4.11 asks. Decorative
  panel, card and swatch borders give no finding. Icons stay as built. Tom: "we do not tell a designer that they may
  only build high-contrast apps" - the check enforces the WCAG minimum, never more.
- Q176 Studio interaction colours (Tom, 2026-10-31): the Studio Tailwind theme gets the surface interaction colours
  (hover, pressed), so `hover:`/`active:` utilities draw in Studio sketches. `et design complete` names an unknown
  utility class instead of reporting "draws no different pixel".
- Q177 menu vs select (Tom, 2026-10-31): the Q164 control table splits kind `menu` (action items: hover, focus,
  active; no selected) from `select`/`listbox` (selected look required).
- Q179 a product uses another product as its kit (Tom, 2026-10-31): a product may name another product as its kit
  (studio -> sdk). A control part a page uses (for example `components/switch`) resolves in the kit product when
  the product itself has no such part, so `complete --product studio` no longer reports "no part
  components/switch". Gaps of a kit part do not block the consuming page; they stay the kit part's own open points.
  No copies of kit parts in the consuming product (two sources drift). So a Studio page may keep an `et-switch`;
  in the pages/inbox round the switch, the toggle button (b) and the segment (c) are a variant pick by merge.
- Q181 control states belong to control parts (Tom, 2026-10-31): sketch `elements/shell-main` rendered the whole
  shell ~23 times only to show hover, focus, pressed and selected of the collapse button and of rows. Tom: "sowas
  muss das tooling erkennen das darf nicht passieren". Two checks:
  - Error (blocks the sketch and `complete`): interaction states (hover, focus/focus-visible, pressed/active,
    selected) are allowed only on a control part (a part whose root is a control: button, row, option, the Q164
    control kinds). On any other part (layout element, shell, page) such a state is an error that names the element
    to extract as its own part. No threshold.
  - Hint (does not block): a state whose pixel difference to the base state covers less than about 10 % of the
    frame reports "extract the changed element as its own part", for example a small badge that changes on a big
    card.
- Q185 old merged states under the control-state rule (Tom, 2026-10-31): interaction states that were already merged
  on a non-control part (sdk carousel, scrollable, match, table, bracket) are reported as an open point on the part
  but do not block a round that adds no new such state. A newly added violation stays a blocking error. Extracting
  the controls of those five sdk parts comes after the MVP (Studio uses none of them).
- Q182 a part shows every option value of its mock (Tom, 2026-10-31): the merged sdk button part shows only `md` and
  one `sm` row, while the lib has `xs`-`xl`; the sketch agent picked the values and no check caught it.
  - Tool check (error, blocks `ready` and `complete`): every mock option with a literal union type (for example
    `size`, `variant`) has each value on the part's grid. A value may be left out only with a stated reason.
  - Cleanup: builder 33 audits every merged sdk part against its mock and adds the missing values; button gets a
    size axis with all five sizes.
  - Re-merge: added values are new drawings, so the part goes to Tom as a new round; where a value follows only
    from decided rules (for example a size that scales a decided shape), the lead merges it under Q172.

## Not decided

- Where the go and the released state are stored (builder call).

## Build slices (builder ethlete-sdk-57)

1. Built (`cae5fb9c6`): `definePart({ implements })` takes a `PartLink`: `'<repo path>.component.ts'`, or
   `{ route: '/x' }` for a `pages/` part. Rule `system/rules/implements.ts`: `IMPLEMENTS-MISSING` (no such file)
   and `IMPLEMENTS-SHAPE` (not a literal, wrong form for the layer, absolute path, route without `/`).
   `system/open-points.ts` is pure: `OPEN_POINT_KINDS` holds the Q156 order, `openPointsOf()` lists the points per
   part; `read-open-points.ts` reads them for a product. Open comment = any comment not `resolved` (an answered one
   counts). Unmerged sketch = any sketch folder that targets the part. Unlinked = no `implements`; foundations do
   not count. `et design check` prints them after the problems; the exit code is unchanged. Studio API not touched.
   Verified: 419 cli design tests, tsc, lint; the new check specs fail without the change; one real check run.
   Not built: a new-part sketch has no part to attach to; routes are not checked against the router.
2. Built (`02a6049bc`, `97ab889ed`, `8b5b314d3`, `f8d126bd5`):
   - Missing state: every check prints "no controls declared" for a component part. The per-control gaps
     (`CONTROL-UNDRAWN`, `CONTROL-GRID-MISSING`, `REQUIREMENT-MISSING` of `completenessGapsOf`) need a full draw per
     part, so they print only with `et design check --complete`. `partsCompletenessOf` draws many parts with one
     server and browser. Pages and foundations are exempt.
   - Contrast: the render check's `CONTRAST` findings per part. Text keeps the WCAG large-text rule (Q170). New
     3:1 measure (Q169, Q175): borders only of controls (native inputs, `[data-et-control]`, control roles) and of
     the nearest bordered ancestor that wraps a control inside its part; icons (`svg` fill or stroke, best paint
     counts). Disabled, invisible and excepted elements are skipped.
   - Missing motion (Q168): every ordered pair of `states`, static, on every check. A pair with a `focus` state is
     exempt. A loop is a motion with `from === to`; an ongoing-work state (name contains loading, pending, busy,
     progress, indeterminate or spinner) needs one. `definePart({ unreachable: [{ from, to, reason }] })` drops a
     pair; rules `MOTION-UNREACHABLE-STATE`, `-REASON`, `-LITERAL`. Foundations are exempt.
   - Verified: specs that fail without each change, the design folder (916 tests), both tsc configs, lint.
     Not verified: a full `check --complete` run on a real product, and its run time.
   - Known: about 3,750 motion points per product, because `states` holds showcase variants. Q173 moves them out.
     `changed-parts.spec.ts` has a timing test that fails sometimes under load.

- In progress: Q181 control-state check (error on non-control parts, <10 % pixel hint), with two freeze follow-ups
  (`foldersOf` ENOENT, unchanged `<product>/tsconfig.json` rewrite).

3. Not started: the list on the part in Studio, and `sketch ready` / part ready refused while the list is not empty.
4. Last: point 5, open plan questions that name the part.
