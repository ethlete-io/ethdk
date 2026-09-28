# timetrack stream, ticket, settings scan - open findings

Scan of `libs/timetrack/src/lib/{stream,ticket,settings}` and `libs/timetrack/src/index.ts` from 2026-09-28. 0 High, 2 Medium, 18 Low, 1 Spec. Skipped: spec and story files. `jira/`, `gitlab/`, `reason/` and `model/` were read only where a finding depends on them. The scope holds no RxJS subscriptions, timers or DOM listeners, so it has no leak findings. The observables are cold one-shot pipes.

## settings

- Medium: `withoutStandIn` records the refusal as `{ repoPath, branch }` and drops `openedForWorkPath` (`settings/stand-in.ts:95-97`). `isStandInRefused` also does not compare directories (`model/stand-in.ts:160`). If a user deletes the placeholder for one directory on a base branch, the app refuses every directory of that base branch. Add `workPath` to `StandInRefusal`, its parse and its match. M Verified.
- Low: the settings read accepts any string as the Jira and GitLab host (`settings/parse.ts:440,442`), and `normalizeJiraHost` / `normalizeGitLabHost` keep an `http://` scheme. A host typed as `http://…`, or as `company.atlassian.net@other.host`, sends the Basic-auth token in plain text or to another host. Check for an `https:` URL with a bare hostname when you read the setting and when the user types it. S Re-rated from Medium: the Rust `http_request` (`src-tauri/src/http.rs` `is_private_enough`) refuses every non-https URL except loopback, so no token goes out in plain text; only the `user@host` typo case remains, and the user types that value.
- Low: two JSDoc blocks are stacked on `parseTimetrackSettings` (`settings/parse.ts:414-424`). The first one describes `readTimetrackSettings` and is attached to nothing. S
- Low: `createdAt` parsing is written out again in `asProjectLink`, `asMeetingNaming` and `asCallNaming` (`settings/parse.ts:233,257,284`). Use `asDate`. S
- Low: `backgroundProjects` is deduplicated before it is upper-cased (`settings/parse.ts:455`), so `abc` and `ABC` are both kept. S
- Low: `asCallNaming` does not range-check `weekday` or `startMinute` (`settings/parse.ts:289,292`). A hand-edited value is kept, and it never matches. Clamp both values, as the other numeric fields are clamped. S
- Low: `effectiveNoWorkContextApps` removes duplicates case-sensitively but filters case-insensitively (`settings/rules.ts:69-71`). A user entry `Spotify` next to the shipped `spotify` appears twice. S
- Low: `repoProjectRows` and `RepoProjectRow` are public exports, but only `projectPathRows` uses them (`settings/repo-project.ts:54,77`). The path normalisation is repeated in `repo-project.ts:7,87,120` and in `project-link.ts:4`. S

## ticket

- Low: `writeTicketWithAgent$` and `writeParentWithAgent$` cut the summary to 255 characters before they unmask it (`ticket/write.ts:382,476`). A real name is often longer than its pseudonym, so the unmasked summary can be longer than 255 and Jira then rejects the create. Cut the summary after `unmaskNames`. S Re-rated from Medium: the prompt asks for under 80 characters, so this needs an agent summary near 255 characters.
- Low: the duplicate guard in `fileTicketOnce$` reads only the first page of issues with `statusCategory != Done` (`jira/candidates.ts:35,45`). If `ticket.initialStatus` is a Done-category status, or if the project has more open issues than one page holds, the guard misses the earlier issue. M
- Low: `notesFor` repeats `notesForAll` (`ticket/draft.ts:49-100`). Replace it with `notesForAll({ contextIds: [contextId] })`. S
- Low: `messageOf`, `gitSpec` and `git$` are copied between `ticket/start-execute.ts:63-80` and `ticket/repair-execute.ts:28-42`. S
- Low: `repairedMergeRequestTitle` puts the issue key into a `RegExp` without escaping it (`ticket/repair.ts:89`). S
- Low: `planBranchRepair` adds the `dirty-tree` refusal before the retitle-only branch (`ticket/repair.ts:217-235`). A retitle does not touch the working tree, but uncommitted changes still block it. S

## stream

- Medium: `stillFocused` pushes the tail sample onto `observed` after the sort (`stream/stream-day.ts:985`). If a git, editor or agent sample is later than `windowsSeenThroughMs`, `samples` goes out of order. The `next` stretch then runs backwards, and the tail's focus is added to the wrong context. Insert the tail at its sorted position. S Verified.
- Low: `classifyCalls` pairs call edges in input order, but it sorts the focus events (`stream/calls.ts:258-262`). `closeAbandonedCalls` has the same problem (`stream/calls.ts:361`). Unsorted events pair a `call-end` with the wrong start or drop the end. Sort the call events first. S Re-rated from Medium: every caller passes events from `eventsBetween$`, which the store returns `ORDER BY at_ms`, so only a future caller is exposed.
- Low: `matches` compiles each user pattern again for every call, twice per call (`stream/calls.ts:100-111`, called at `:298-299`). Compile the patterns once for each `classifyCalls` run. S
- Low: `streamDay` runs `breakGaps` twice, once directly and once inside `breakWindows` (`stream/stream-day.ts:1449-1450`, `stream/breaks.ts` `breakWindows`). `remote.includes(prompt)` makes the prompt split quadratic (`stream-day.ts:1445`). `promptOriginAt` filters and sorts all input events again for each prompt (`stream/prompt-origin.ts:30`). S
- Low: `breakGaps` spreads every work span into `Math.min` / `Math.max` (`stream/breaks.ts`, `workFrom` / `workTo`), and `remoteWorkWindows` spreads its prompts in the same way. A very large array throws `RangeError`. Use a loop. S
- Low: comments break the AGENTS.md allowlist. `sessionAt` points to a plan slice (`stream/stream-day.ts:615-616`). The sticky comment narrates a past bug with a Figma tab (`stream-day.ts:1187-1192`). S

## Spec

- Spec: no spec covers `withoutStandIn` on a stand-in with a work path, or `isStandInRefused` for a sibling directory. S
