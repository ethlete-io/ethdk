Restarted because: context at 71% of the 200k budget.

<!-- Session state of the grill/docs agent. Delete once resumed. -->

# Handoff: grill/docs session (doc-agent), 2026-11-05 afternoon

Talk to Tom in German (`/doc-agent` skill). **Tom is afk**: collect design questions, one short line per event, no
grill round until he says he is back. Findings go to `plans/ethlete-studio/design-to-code.md` as `N\. ` paragraphs
(last is 457), rows in `STATUS.md` (last is B395). Latest ADR is 0196. Done rows are deleted; when you close a row,
set `built: <sha>` in the ADR that opens it in the same commit (finding 455). SDK migration findings and Tom's
decisions on them live in `plans/et-update-findings.md` (sections 1-10, fifagg items 10-14 in section 10).
Commit scope for ADRs is `repo` (commitlint rejects `ethlete-studio`). Commit retry loop: wait for `.git/index.lock`,
then `git commit -- <paths>` once; do not retry on a hook failure.

## Sessions

- `ethlete-sdk-0d`: Studio builder, restarted once today. Works B388 (full studio check into CI): done 8134c8d50
  (scheme dedupe), 7826ed3b9 (LOST-SURFACE boxed only), 9821804fb (SKIP-SCOPE once per part); open: COVERED
  exemptions, CLI sheets, HINT prefix, small drawing edits, then full run. It opens sketches for the side panel
  `aside.st-shell-side` and the comment-draft popover (96 real LOST-SURFACE); Tom picks by merge. Then B391 -> B369
  -> queue. "Studio rules" `--slow` stays red on `pages/system` until B288 (ADR 0196). Last CI 42025926914 green
  except that.
- `ethlete-sdk-ff`: SDK migration session (handoff `.claude/handoffs/sdk-migration-findings.md`, restarts soon).
  B385 a-e done, f gql part 0c02de9b1; finding 14 f9357ecbb; finding 11 specs e1f1aa645 (not reproducible; waits for
  the fifagg generator options from fifagg-frontend-3d). Next: finding 12, non-identifier receiver gap
  (`this.creators.legacyX`), then the devtools mount provider (Tom's decision in section 10: panel attaches itself
  from a provider in the same production gate, migrator removes `<et-query-devtools-lazy>`), then B387 cross-host
  cookie as a grill question for Tom, B386. Commits locally; 0d pushes.
- `fifagg-frontend-3d` (fifagg-frontend-c3 is gone): triages 142 fifagg E2E failures on `chore/query-v3-migration`;
  sends migrator findings here. Record them in section 10 and forward to ff.

## Open

- No collected grill question.
- Uncommitted: none after this commit (finding 11 result in `plans/et-update-findings.md` is in it).
- Issue ethlete-io/ethdk#3167: comment posted, no answer yet.
- B365 cause (explorer wheel lag) unknown.
- A Bash hook blocks any command whose text contains "design check"; write such text with Write.
