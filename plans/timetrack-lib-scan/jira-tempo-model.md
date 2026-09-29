# timetrack jira, tempo, model, reason, store scan - open findings

Scan of `libs/timetrack/src/lib/{jira,tempo,model,reason,store}` from 2026-09-28. 0 High, 1 Medium, 3 Low, 0 Spec (second pass included; verified 2026-09-28: 6 confirmed, 4 re-rated, 0 refuted, 1 unverified). Skipped: all specs. The second pass read `jira/{adf,fields,hierarchy,projects,myself,status}.ts`, `tempo/attributes.ts`, `model/{event,evidence,context,field-source,statement,tokens,meeting-naming}.ts` and `reason/prompt.ts`; `model/event.ts` was read for its functions only.

## tempo

- Low (fixed 2026-09-29: `ledgerEntriesForRange$` reads the neighbouring day keys and places each entry by the instant in its proposal id; no migration): the ledger stores `day` as `localDayKey(from, boundary)` at write time (`tempo/execute.ts:153,192`), and `entriesForDay$` reads by that key. After the user changes the boundary, entries for late-night rows sit under the other day. The review day then misses them, sees the worklog as foreign, and creates a second one. Fix: re-key the ledger on a boundary change, or read the ledger by the instant range instead of the stored key. M Re-rated from Medium: no duplicate, because the orphaned worklog reads as foreign and `subtractForeignTime` takes its whole duration off the same-issue proposal, so the create plans zero time; the real loss is that the app no longer owns or updates that worklog.
- Low: `searchJiraIssues$` stops at `maxPages` and gives no signal (`jira/search.ts:63`), so a caller cannot tell a complete history from a truncated one. `tempoPaged$` now errors instead. Several callers pass `maxPages: 1` on purpose to read the top N, so this needs a `truncated` flag or a separate top-N read. S

## jira

- Medium: the picker sends typed text to `text ~` with only `"` and `\` escaped (`jira/picker.ts:46`). Lucene reserved characters such as `( ) [ ] : ! ^ ~ ?` make Jira answer 400, so the picker fails on text like `fix (login)`. Escape the reserved set with `\\`, or strip it. S Unverified: needs a live Jira Cloud call; Cloud text search may ignore reserved characters inside a quoted phrase rather than answer 400.
- Low: `fetchJiraCreatableTypes$` uses `GET /rest/api/3/issue/createmeta?expand=projects.issuetypes.fields` (`jira/createmeta.ts:63`), which Atlassian deprecated. Move to `/rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes`. M

## Spec gaps

- Spec (fixed 2026-09-29: `tempo/preview.spec.ts`, `store/ledger-range.spec.ts`): no spec changes the boundary between two syncs and checks the ledger. S

## second pass

- Low: `suggestedParenting` is `parent-field` whenever any type is off level 0 (`jira/hierarchy.ts:87-89`). Almost every instance has Sub-task and Epic, so the report says `parent-field` even when the configured parent and child sit on the same level, which is the case the JSDoc warns about. Derive it from the configured parent and child types, or drop the field. S
