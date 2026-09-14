# The app files an epic, and Jira owns the hierarchy after it

M4 said the app never writes an epic, because the project manager owns them. Tom's project manager
handed epics over for one project on 2026-09-14, and that is a per-project fact rather than a rule.
Without it a stand-in with no matching epic has no ending the user can reach alone.

So the app files an epic on a press. **Jira decides whether it may, and the user decides whether it
should.** `/rest/api/3/issue/createmeta?projectKeys=<KEY>` returns the issue types this user may
create in this project, with their required fields. No epic type in the answer means no epic button.
A stored per-project flag was rejected: it would be a second copy of a fact Jira already holds, and it
would be wrong the moment a permission changes. `createmeta` reports what Jira permits and never what
the team agreed, so the report to the project manager stays present in every state and is never hidden
by a permission.

**After the write, Jira owns the hierarchy.** A task the project manager moves under a different epic
stays moved. The band keys on the task, so a moved parent changes no band and no worklog; the slug rung
re-reads the parent from Jira and never replays the epic the app created. There is no drift warning and
no repair offer. Without this rule the app would argue with a person who already decided.

**A create cannot be undone.** Tom's account cannot delete an issue, so a ticket can be moved and never
removed, and a duplicate is permanent. Nothing retries a create today — the Jira client has no retry,
only an optional `timeoutMs`. The guard therefore lives under `createJiraIssue$` (`jira/create.ts:78`)
rather than in the screen that calls it: four call sites exist already, and one is the agent endpoint
(`agent-endpoint.ts:177`), which another repository reaches with nobody watching. It has two parts,
against two different failures. An in-flight lock stops the double press. A pre-flight search — this
project, this exact summary, created by me, inside a short window — stops the retry after a lost
response: a match is shown and nothing is created.

## Consequences

- **The record is written between creates, and Jira is the truth when the record is wrong.** The card
  may file three issues on one press. Each created key goes onto the stand-in record before the next
  create starts, and the card re-checks Jira for the epic by summary whenever it opens.
- **A preselected epic may lean forward; a create may not.** A preselect is a bind, and a bind creates
  nothing, so it fires at `likely` as well as `certain`. The create button carries the extra ceremony
  instead: close matches above it, and the full statement of what it will file.
- **A required field the app cannot fill hands off to the browser**, with the summary and description
  pre-filled. The app learns the value from recent issues of that type in that project, and keeps what
  the user chose where it guessed wrong. Growing a field editor for whatever `createmeta` returns was
  rejected as a second Jira form.
- **The epic takes no branch-subject field.** `JiraIssueInput.subjectField` feeds branch naming, and
  nobody cuts a branch from an epic.
- **The fake backend must refuse a delete, permanently.** A test that cleans up by deleting proves
  nothing about a user who cannot.
