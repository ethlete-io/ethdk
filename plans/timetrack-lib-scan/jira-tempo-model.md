# timetrack jira, tempo, model, reason, store scan - open findings

Scan of `libs/timetrack/src/lib/{jira,tempo,model,reason,store}` from 2026-09-28. 0 High, 2 Medium, 7 Low, 2 Spec (second pass included; verified 2026-09-28: 6 confirmed, 4 re-rated, 0 refuted, 1 unverified). Skipped: all specs. The second pass read `jira/{adf,fields,hierarchy,projects,myself,status}.ts`, `tempo/attributes.ts`, `model/{event,evidence,context,field-source,statement,tokens,meeting-naming}.ts` and `reason/prompt.ts`; `model/event.ts` was read for its functions only.

## tempo

- Low: the ledger stores `day` as `localDayKey(from, boundary)` at write time (`tempo/execute.ts:152,191`), and `entriesForDay$` reads by that key. After the user changes the boundary, entries for late-night rows sit under the other day. The review day then misses them, sees the worklog as foreign, and creates a second one. Fix: re-key the ledger on a boundary change, or read the ledger by the instant range instead of the stored key. M Re-rated from Medium: no duplicate, because the orphaned worklog reads as foreign and `subtractForeignTime` takes its whole duration off the same-issue proposal, so the create plans zero time; the real loss is that the app no longer owns or updates that worklog.
- Low: the drift check compares `proposal.durationMs` with a remote value in whole seconds (`tempo/diff.ts:217`), while the write rounds to seconds (`tempo/write.ts:19`). A duration that is not a whole second plans a `changed-in-tempo` update on every sync. Compare `Math.round(ms / 1000)` on both sides. S
- Low: `tempoPaged$` and `searchJiraIssues$` stop at `maxPages` and give no signal (`tempo/client.ts:197`, `jira/search.ts:63`). A caller cannot tell a complete day or history from a truncated one, and the sync then treats missing worklogs as deleted. Return a `truncated` flag or throw. S

## jira

- Medium: the picker sends typed text to `text ~` with only `"` and `\` escaped (`jira/picker.ts:46`). Lucene reserved characters such as `( ) [ ] : ! ^ ~ ?` make Jira answer 400, so the picker fails on text like `fix (login)`. Escape the reserved set with `\\`, or strip it. S Unverified: needs a live Jira Cloud call; Cloud text search may ignore reserved characters inside a quoted phrase rather than answer 400.
- Low: `fetchJiraCreatableTypes$` uses `GET /rest/api/3/issue/createmeta?expand=projects.issuetypes.fields` (`jira/createmeta.ts:63`), which Atlassian deprecated. Move to `/rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes`. M

## reason

- Medium: `agentProcessSpec` always sends Claude-only flags (`--print`, `--system-prompt`, `--output-format json`, `--json-schema`, ...) (`reason/spec.ts:13`), and `agentOutputDocument` reads only Claude's envelope (`reason/envelope.ts:14`). Settings offer `codex` as a command (`reason/model.ts:50`), so every reasoning run with `codex` fails. Build a per-command spec and envelope reader, or remove `codex` from `REASONING_COMMANDS`. M Re-rated from High: no settings screen offers a command choice; only a hand-edited settings document reaches `codex`, which `settings/parse.ts:340` accepts.
- Low: `tempo/diff.ts:7` keeps its own FNV-1a copy; the reason copies now use `model/fnv.ts`. Build its hex string from `fnv1aHash`. S

## Spec gaps

- Spec: no spec runs `previewTempoSync$` or `fetchTempoDayCoverage$` with a boundary other than midnight and a row after midnight. S
- Spec: no spec changes the boundary between two syncs and checks the ledger. S

## second pass

- Low: `suggestedParenting` is `parent-field` whenever any type is off level 0 (`jira/hierarchy.ts:87`). Almost every instance has Sub-task and Epic, so the report says `parent-field` even when the configured parent and child sit on the same level, which is the case the JSDoc warns about. Derive it from the configured parent and child types, or drop the field. S
- Low: `findMarkerAttribute` and `canHoldWorklogMarker` have no caller outside their spec (`tempo/attributes.ts:93,97`), and `tempo/marker.ts:11` still names `findMarkerAttribute`. Delete them, or wire the marker setting through them. S
