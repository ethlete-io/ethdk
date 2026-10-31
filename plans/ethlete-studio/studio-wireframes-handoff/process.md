# Wireframes handoff: goal, structure, order, process

## Goal

Design Ethlete Studio in its own design product `studio` (`.ethlete/design/studio/`, base
`.ethlete/design/sdk`), real look, and fix the design tool by using it. The tool fixes are the main
output; the design is the side product (Tom, 2026-10-29). Every friction with Studio or the design CLI
goes as a finding with fix options into `plans/ethlete-studio/design-system-actions.md`. Fix the
findings in `libs/cli` and `apps/ethlete-studio`, then move each fixed entry, number kept, to
`design-system-actions-fixed.md`. Talk to Tom in German.

## Structure (fixed today, Tom: "das system fällt doch schon wieder auseinander")

- `elements/shell-main`: chrome ONLY (rail, floating side panel, canvas paper). Props `section`,
  `product`, `side`, `content`, `panel?: 'hidden'`. States `open`, `hidden` (hidden = panel gone,
  active rail bubble loses its fill; a click on the active section bubble toggles the panel).
- `elements/part-tree`: the dense tree (12 px-ish, no numbers). State `components-open`.
- `elements/canvas-frames`: frames of the real base button (`@system/components/button`, states
  filled / outline / tonal). State `default`, export `defaultFrames`.
- `pages/system`: composes the three. Child state props are named exports, because
  `part.states[...]` types as `Props | undefined` (finding in the plan).
- A section of the app is a PAGE, never a state of the shell.

## Order agreed with Tom

1. All pages first: `pages/inbox` next, then Sketches (variant matrix), Flows, merge compare.
2. Components after all pages (button, switch, tree row, comment card, project switcher...).
3. Page states (empty, loading, error, comment draft), then build into the real app.

## Process (do not re-litigate)

- The agent designs, Tom picks. One sketch at a time, 2-4 real alternative variants; a variant
  never stands for a state of another variant. No yes/no questions on content.
- One fresh opus subagent per sketch round; brief: skim `.agents/skills/ethlete-design-exploration/SKILL.md`,
  `sketch new <part> --variants a,b,c --round "<title>" --by claude-opus-5-5 --product studio`
  (`sketch variant` only adds to an open sketch), look at every shot via the read-only
  `curl "http://localhost:4402/__design/shot?product=studio&part=<layer>/<name>&state=<s>&width=1440&sketch=<layer>/<name>&variant=<v>"`
  (pages: `&preset=desktop`), no `sketch ready`, no commit, no stash, no git add, no zsh command
  in a variable. It reports friction; you write it into the plan and commit.
- Every change to a merged part is a sketch, also a small one; with nothing to choose, one variant
  (`--variants a`). Never edit a merged part directly (Tom, 2026-10-28).
- You look at the shots yourself, then `design sketch ready <part> --product studio --by ...`.
- After Tom merges: `design check --product studio`, prettier on the part files, commit at once.
- CLI: `node dist/libs/cli/src/index.js design ...`; build `NX_NO_CLOUD=true npx nx build cli`.
- Comments are now RESOLVED, not deleted (15bb60c99): `inbox done`, `--round`, merge, discard set
  `resolved`; Studio shows them behind "Show resolved".
- Studio folds states no variant changes (fba692ad6) and folds older rounds on a new round
  (24c887f1b). Tom must restart Studio to get CLI changes.

## Done at handoff

- `button` is a leaf in `elements/part-tree` (b7ea4084d): the tree lists frames, not states.
- `pages/inbox` variant a merged (180c2ed9d). Data reworked (0d3010b34): threads are an exchange
  between the human and Claude; the only human-to-human case is a teammate QC pass. Every future
  comment or inbox drawing must follow this model.
- Inbox groups: active part on top, "Andere" below (12bb47fdc). States `open`, `with-resolved`,
  `active-only`, `active-clear`, `all-clear` (801b28111, 0a7466ca9). Agents mixed (Claude, Codex,
  Gemini) with provider logos from `pages/inbox/agent-logos.ts`. Studio is agent-agnostic: UI copy
  says "Agent", never "Claude". Comments are committed to git (plan "Comments live in git").
