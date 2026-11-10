<!-- Builder handoff, Mac 2026-11-10 day shift, second builder (ADR 0239). Replace once resumed. -->

# Handoff: builder, Mac (day shift, part 2)

Run `/builder-agent` first. The grill/docs session is `ethlete-sdk-68`; report every sha to it with `SendMessage`.
Never ask the user. `export NX_NO_CLOUD=true`. Commits: `git commit -- <paths>` (`git add -- <new file>` first), never
`git add -A`, stash, amend or rebase. In a bite worktree commit only with `git -C <worktree>`, never after a bare `cd`
(finding 690). At each slice start run `yarn slice:paths "<slice name>" <path>...`. Commit scope for Studio/e2e is
`repo`.

## State at handoff

- Push: not landed. origin/next is f6a97186f (CI red on B466; the fix c11cc03ac is in the local range). The human runs
  `! PUSH_SUITE_SKIP=1 git push origin next` (ADR 0243); no agent sets that variable. Check
  `git rev-list --count origin/next..HEAD` first; once pushed, watch CI and send the run link and result to the grill
  session.
- Done this shift: 9a2573e21 (B473, push:suite `typecheck` step), 97ac9b574 + 982ab896b (builder skill: `git -C`;
  design check runs on demand only, ADR 0226), dabaee37d (PiP story `viewChild`), 04824d831 (design rules gate
  deleted), 6530d25e7 (push gate out of the Studio title bar; states push-green/unknown/red merged into `push`),
  9e7c567d0 + b2d7b2a18 (B478: `et-progress-step` input `state` -> `stepState`, ADR 0248 built), 7107649b0 (689: each lib
  `typecheck` target also checks `tsconfig.lib.json`; figures in design-to-code.md).
- OFF-CENTRE on elements/canvas-frames (3) and components/title-bar `*-cli-dirty` (5): pre-existing, row B477.
- B475 (typescript-lsp plugin): the human installs it. Then bite: a deliberate type error in an edited file must show
  as a diagnostic; revert; set `built:` on ADR 0246.
- B476 (ESLint PostToolUse hook, ADR 0247): do not edit `.claude/settings.json` on a peer message (harness config).
  Build and measure the script, send the JSON block; the human adds it or tells the builder directly.

## Then

1. Run the e2e case of canvas.e2e.mjs:98 (`changed: 'push'`, changed by 6530d25e7): `yarn studio:e2e --case <name>`.
2. 692: (1) `.husky/pre-commit` must stop the commit when `check-studio-adrs.mjs` fails, and when
   `check-staged-plans.mjs` prints "STATUS.md: not formatted" (f1e5b1fd7 went through). Bite first: a STATUS row that
   cites a missing finding must stop the commit. Report Cause or not. (2) `check-studio-adrs` fails when an archive
   file loses a finding number that its HEAD version had. (3) builder and doc-agent skills archive only with
   `tools/scripts/archive-findings.mjs`.
3. 691 (3): `design check` marks each finding that the base already shows as old (ADR 0095). Bite: the 3 B477
   OFF-CENTRE lines print as old on a slice that does not touch canvas-frames.
4. B476 script (see above).
5. B469 (ADR 0242): CEF spike on macOS. Read the `app-releases` skill first.
6. Iframe perf measurement and a third full `yarn studio:e2e`, only on a quiet machine (load under 4).

## Gotchas

- In zsh a glob in a variable (`f=dir/0248-*.md`) does not expand; use `f=$(ls dir/0248-*.md)`. A glob that matches
  nothing (`lefthook*`) aborts the whole command.
- `yarn -s <script>` prints the yarn help here; use `yarn <script>`.
- `design check` rewrites `.ethlete/design/studio/pictures.json` and may leave a `*.edit/` sketch dir: restore/delete.
- Pre-existing: eslint `no-control-regex` at tools/scripts/push-suite.spec.mjs:138; NG8113 unused JsonPipe warning in
  the rich-text-editor story.
