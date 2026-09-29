# timetrack jira, tempo, model, reason, store scan - open findings

Scan of `libs/timetrack/src/lib/{jira,tempo,model,reason,store}` from 2026-09-28. 0 High, 1 Medium, 1 Low, 0 Spec (3 Low and 1 Spec fixed 2026-09-29: `ledgerEntriesForRange$`, `searchJiraIssues$` errors past `maxPages`, createmeta per-project read; second pass included; verified 2026-09-28: 6 confirmed, 4 re-rated, 0 refuted, 1 unverified). Skipped: all specs. The second pass read `jira/{adf,fields,hierarchy,projects,myself,status}.ts`, `tempo/attributes.ts`, `model/{event,evidence,context,field-source,statement,tokens,meeting-naming}.ts` and `reason/prompt.ts`; `model/event.ts` was read for its functions only.

## jira

- Medium: the picker sends typed text to `text ~` with only `"` and `\` escaped (`jira/picker.ts:46`). Lucene reserved characters such as `( ) [ ] : ! ^ ~ ?` make Jira answer 400, so the picker fails on text like `fix (login)`. Escape the reserved set with `\\`, or strip it. S Unverified: needs a live Jira Cloud call; Cloud text search may ignore reserved characters inside a quoted phrase rather than answer 400.

## second pass

- Low: `suggestedParenting` is `parent-field` whenever any type is off level 0 (`jira/hierarchy.ts:87-89`). Almost every instance has Sub-task and Epic, so the report says `parent-field` even when the configured parent and child sit on the same level, which is the case the JSDoc warns about. Derive it from the configured parent and child types, or drop the field. S Open: the field is in the agent contract (`agent-api/model.ts`, `libs/agent-rules/src/lib/timetrack*.ts`) and the `instance` op reads no settings on purpose, so dropping or deriving it is a contract decision.
