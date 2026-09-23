# @ethlete/timetrack

## 0.1.0-next.7

### Patch Changes

- A checkout linked to a project no longer takes a coincidental issue from another project, and an open stand-in a sibling checkout holds for the same branch slug now names the band.

## 0.1.0-next.6

### Minor Changes

- A placeholder now says which checkout, and which piece of it, its name stands for. Two of them may
  carry one name: a spec track and the branch that implements it are both called after the feature.
- Disconnecting a Google account now fails with `GoogleRevokeError` unless Google confirms the
  revocation, and a refresh that lands after `invalidate()` no longer restores the access token.
- An e2e world seed can now say what reading the window lock does, including a host that is
  there and does not answer.
- A Jira or GitLab host that is not `https` is now refused before the token is attached, and the
  settings screen says so under the field. Plain `http` stays available on loopback alone.
- A Tempo `metadata.next` cursor is now followed only on Tempo's own HTTPS origin. Any other URL
  raises `TempoCursorError` instead of sending the Tempo token there.
- The agent may now choose from the issues the user's recent Tempo history names, not only the ones
  the day itself reached. New `fetchTempoHistory$` answers both out of one read.
- Two new agent endpoint ops: `day.rows` answers the rows a day drew with the id each edit names, and
  `day.edits` corrects one. `timetrack rows` and `timetrack edit` reach both.
- A new `settings.rules` agent op, and an `ethlete-agents timetrack rules` command, read the rules that
  name a day's work out of the encrypted store.
- Collect the token spend of every coding-agent turn as an `agent-usage` event, read from the Claude Code session log.
- New `backgroundProjects` setting: a band of one of those projects keeps only the time no other band
  claims, so the library you sit in all day stops overlapping the work you book.
- Every row now books a whole 15-minute increment, named or not, and any part of an increment books
  the whole of it. The raw observed time stays on `observedMs`.
- The day counts only time a worklog can hold as unattributed, and reports a day as short of its target
  only once the day is over.
- A checkout that swapped to the branch naming its issue now books the unnamed work before it to that
  issue, as one band that marks the swap.
- A meeting row now comes from a call the machine heard, named by the calendar rather than proposed by
  it. Naming one is remembered for its whole calendar series.
- Add `parseCodexSessionLog()`: the Codex CLI's rollout logs read for their sessions and each turn's
  token spend. A cursor now carries the session state a log states once rather than per record.
- Agent-log cursors now go through the same project links and exclusion rules as the events beside
  them, so a denied title and a private checkout's path are no longer stored.
- A short list of applications ships as no work context, media players and messengers, and
  `holdsWorkApps` takes any of them back one at a time.
- The Sources view says which editor on this machine holds the heartbeat reporter, and names the
  command that installs it into one that does not.
- A call a rule excludes is drawn as a band that books nothing, rather than dropped.
- Fold every unnamed band of one checkout into one row, whatever branch each was on, and warn when
  a row you edited names only proposals the engine no longer builds.
- Pull request activity on github.com is read through `gh`, beside GitLab's. It stores no token, it is
  off until the switch in Settings is on, and it says when GitHub's 300-event cap cut a window short.
- GitLab activity is read through `glab`, which holds its own login, so the app stores no token to
  collect. A source now reports "not installed" and "not logged in" as two distinct states.
- The Sources view installs the heartbeat reporter into an editor from a button, using the extension
  the app bundle ships. It names the checkout command only when the build ships none.
- `mergeBlocks` now merges per track — the same issue, or the same context while nothing has named it —
  so a day that moves between two checkouts every minute is a few bands and not hundreds.
- Settings gain `noWorkContextApps`: applications the user says never hold a checkout, reported with
  their own `no-work-context` cause instead of as unjudged time.
- A checkout whose project's hours nearly all sit on one issue now has that issue offered for the whole checkout, on one click. Nothing is written without it.
- Calls and meetings now share one lane on the day timeline, instead of splitting one kind of row over
  two columns.
- `reviewDay()` now takes `rows: DayRows` and derives its meeting, timer and fill checks itself. The v1
  pipeline is gone: `correlateDay()`, `sessionize()` and `DayCorrelation` are removed, so `streamDay()`
  builds every day.
- Adds `writeParentWithAgent$` and `parentWritingRequest`, which have the local agent write the parent
  a ticket rolls up to. The payload carries no issue list, because the call picks nothing.
- `streamDay()` takes the project links and drops a checkout a private link covers: no line, no
  evidence, no spend. `TimetrackProjectLink` and `matchProjectLink()` move to the model, so a reader
  outside `correlate` can honour a link.
- `READABLE_MS` is exported: the duration under which `formatDurationMs` reads `0m`, so a caller can
  drop a line that would carry no number.
- Remember which issue a call belongs to when the calendar never held it, keyed on the call itself
  rather than on a calendar series.
- A row now books the time its band covers, so a band drawn from 13:15 to 13:45 logs 30 minutes rather
  than a shorter time.
- A branch with no issue key now inherits one from a sibling checkout that shares its branch slug,
  picked by elimination from the children of the epic that sibling books under.
- Every row and every break a day shows now starts and ends on a 15-minute boundary.
- A written ticket can now be given the spec its work sits under. `specForCommits$` finds it from the
  files the commits touched, and both prompts take its title and intent as the frame for the ticket.
- Adds `readSpecHeader` and `touchedDirectories`, which take the sendable slice of a spec
  document: its title, its type, its tags, the epic it names and its opening section. Nothing else.
- A rule may now name a band with a stand-in, at the same two rungs an issue rule sits on. Such a band
  is drawn and counted as waiting on a ticket, and no sync writes it.
- A band may now be named by a stand-in: a name you give work that Jira does not hold a ticket for yet.
  It takes bands across days and checkouts, books nothing, and resolves to an issue in one act.
- Add `streamDay()`: what a local day was worked on, for how long and what the agents spent, one line
  per checkout. `backfillAgentSpend$()` fills in the spend of days collected before it.
- Add the `@ethlete/timetrack/testing` entry point: a stateful fake Jira, Tempo, GitLab and git backend, plus the seedable world the app's end-to-end suite drives.
- Filing a ticket now reads what Jira permits the account and says so before the press, refuses to file
  a second issue with a summary the project already holds, and drafts the parent a description.
- `streamDay()` books a turn to its checkout by working directory alone, so an agent that ran while
  nobody was at the machine still bills. Each stream reports that time as `unattendedMs`, outside both
  presence and engaged time.
- `unmaskedWords` now returns each word with a `likelyName` flag and puts the name-shaped ones first,
  so a German payload no longer buries the one client name the list is missing.
- An unnamed focus row carries the window titles behind it, each with its own total, longest first. A
  private checkout keeps none.
- Unnamed focus is now judged against the span: a `gap` is an application that names checkouts
  elsewhere, and one that never names a checkout reads as `unknown`.
- `streamDay` reports `focusMs` and `unnamedFocus`: the focused-window time no checkout took, per
  application and per cause, so the Other applications line can be read apart.
- The window source status reports what it reads on this machine, and the fake world seeds it, so a
  missing capability no longer reads as a wrong number.
- A day no longer books the hours an agent worked alone: a scheduled prompt is not presence, and a
  band nobody was at the machine for is never proposed to Tempo.

### Patch Changes

- Work on a base branch now splits by the directory its commits touched. A feature branch is left
  whole, because the branch already names the piece of work.
- Work done on a base branch before the branch for it was cut now reads as that branch's work, where
  the checkout's directories cannot say which piece of work it was. Those minutes were unnamed before.
- Let the reviewer say what a stretch of the day was. `DayReviewEdits` now carries statements: a
  `present` one clips every break out of its window, an `away` one draws a break over it.
- Clip a break against the calls the user attended after both are snapped to the grid. The snap
  could push a break end into a meeting after every measurement was done.
- A commit now says which directory it worked in. `workPathOf` reads it from the files the commit
  changed.
- A name drafted from a branch or a directory drops the date it leads with. The date says when the
  work was filed, which the days of the record already say.
- The issue picker offers what the row's own lane was named with before, in a group above the rest
  of the list.
- A placeholder now opens per directory of a base branch, not per checkout. An attribution rule and a
  stand-in both carry the work path they were opened for.
- A row named to a placeholder by hand shows that placeholder's name again. The edit blanked the
  issue key, and an empty key is not an absent one, so the band drew with no name at all.
- Splitting a checkout-wide placeholder no longer refuses over a day with no commit. It always
  removes the record and its checkout-wide rule, so later branches can get records of their own.
- A piece of a split placeholder is now named by its own directory alone. It carried the old
  checkout-wide name in front of it, which put one feature's name on another feature's work.
- A checkout that ran two agent sessions one after the other is now cut into one stretch each, instead
  of one stretch for the whole day.
- Let a timer run hold presence like a call, so no break is drawn over one. A timer is the user's
  own statement that they work.
- An e2e world seed can now declare the review overrides earlier days already hold, so a test can
  start from a day somebody reviewed before it.
- Let an agent delete a placeholder through `timetrack standins --remove`, and report
  which checkout and branch each one covers. A record of the wider grain blocked every
  branch of its checkout, and only a click could clear it.
- A placeholder can be given another name: `timetrack standins --rename <id> --name <text>`. Its
  days and the rules that name it stay, which a delete and a fresh record would lose.
- Read presence from a call the user attended, not from one a rule made work. A meeting nobody
  typed in used to open a gap the day drew a break over.
- Where two agent sessions of one checkout ran at the same time, the shared minutes now book once, to the session the user prompted last.
- Rows: an application earns a lane of its own only when `workApps` names it, so a day screen holds checkouts, calls, meetings and the break rather than a band per browser window.
- Calls: `CallWindow.attendedMs` reports how long a call's own window was in front, and a call under `minAttendedMs` no longer counts as work, so a voice room left open is separated from a meeting by evidence rather than by a rule.
- A call the microphone is still in stays on the day instead of being closed the next time the window reloads.
- Calls: a call is named only from a standing commitment in Tempo history, never from the default meetings issue, so a microphone that opened no longer books a ticket it says nothing about.
- A call the microphone still holds now survives a restart of the app, instead of being cut into fragments too short to draw.
- Calls: a call now reads its window title when the two sources report the application id in different case, so a call rule can judge the title instead of the bare app id.
- Calls: a call now reads the last window title inside its settle window, so a join that passes through another room is named after the room it lands in rather than the one it crossed.
- A work path is cut to the project its checkout declares, not to a fixed depth. Where a repository
  declares none, its own commits pick the grain between them.
- A band the reviewer named or hid no longer counts as unattributed time, and both day warnings now say where to look: which lanes hold the unnamed work, and which call the observed work runs under.
- Event store: every collected event now carries a dedupe key, so a sample the host repeats after a reload, or a log read from the top again, stores once.
- Review: `hideRow` and `showRow` take a row off the timeline and put it back, and `DayReview.hidden` holds what was taken off, so a row can be dropped from a day without being deleted or counted as unattributed.
- `createJiraIssue$` takes an `assigneeAccountId` and writes it to the issue's `assignee` field. Absent,
  it files the issue unassigned, exactly as before.
- `moveJiraIssueTo$` moves an issue to the status of a given name, and
  `TimetrackTicketSettings.initialStatus` names the one a filed ticket starts in.
- Review: `mergeRows` keeps the first row's `laneKey`, so a merged row stays in the column it was drawn in instead of falling into the unnamed lane.
- The day now warns when a remembered answer books to a ticket Jira has recorded no change on for a
  quarter, naming the band and how long the ticket has been quiet.
- Stop a band the day was told is not work taking minutes from a background band. A call a
  rule excluded, or a row the reviewer rejected, now claims none of them. Only the first cut
  held that rule.
- A session that switched branch is now one stretch, named after the branch it spent longest on.
- `childTypeNameFor` answers the issue type a new child of a given parent must be: a creatable type on
  the nearest level below it. An Epic parent yields a Task, a Story parent a sub-task.
- Settings: `projectPathRows` lists watched repositories and stated directories together, so a link on a repository is reported once rather than twice.
- A background band no longer claims the quarter-hour a running day is still in, so a checkout with seconds of presence cannot book it before the work beside it claims it
- Say which placeholder holds a whole checkout, and refuse a delete that would strand
  the days it covers. A checkout answered by a placeholder no longer reports as named
  by an issue.
- A placeholder that covered a whole checkout can be cut into one per directory its commits worked in.
  `timetrack standins --split <id>` reads the directories and the user picks the pieces.
- A split can name the checkout of a record that holds none, and a claimed directory the commits
  never named opens a piece of its own.
- Model: `streamKeyRepoPath` reads the checkout back out of a `streamKey`, so a screen that holds a lane key can reach the repository path without parsing the key format itself.
- The issue picker offers a lane its own tickets again, and a new `lane.issues` operation reports what
  it reads.
- Read the day's presence against what the user said. `StreamDay` now carries its presence windows,
  and `statedPresence` applies the statements to them.
- The agent endpoint answers a new `day.events` operation, which returns the evidence one day holds.
  The store is encrypted, so this is the only way to read a real day from outside the app.
- An `idle-start` an agent keeps working through no longer starts a break. A person waiting on a turn
  is at the machine, so the stretch holds until the agent stops as well.
- Both agent parsers read the prompts a person typed as `agent-prompt` events: an instant, a session and
  a checkout, never the text. They key like spend, so a log read again stores each one once.
- `streamDay()` reports `ambiguousNames`: the checkout names a window claimed that two checkouts share.
  The time folds into the other-applications line, and the day now says why.
- `ReasoningOptions` takes a `language`, which `agentProcessSpec` appends to every system prompt it
  builds. `reasoningOptionsOf` reads it off a settings document, so one option reaches all four calls.
- A band now finds a person up to the day's `gapFillMs` either side of itself, so a short absence no longer reads `Nobody was here`. A stretch nobody watched is a wall the grace cannot cross.
- A linked checkout no rule could name now opens its own stand-in, named from the day's own evidence. Every later day of that checkout lands on the same one.
- The band a cut took now meets the row beside it in its lane, so a running day no longer opens and closes a quarter-hour hole.
- A band a stand-in names now reads as that name rather than "Not yet named", and the tray says how much of the day waits on a ticket.
- A call a rule counts as work now takes the minutes a background band ran under it, and a reported `behind` stretch sits on the day's own increment.
- `cutBackground` now reports the stretches it took from a background band as `DayRows.behind`, instead of dropping them where no reader can see them.
- Give a block the branch the day knows for its checkout, not only the branch its own
  sample carried. Nothing lands on no branch any more, where no rule and no placeholder
  could reach it.
- A row loses its key to a proposal over a branch swap only when a repository rule named
  it. A branch rule keeps stating its row.
- A stretch the user was away for is now a break even when an agent ran through it. The two numbers
  answer different questions: `breaks` says who was there, `unattendedMs` says what ran.
- A break now has to sit inside the day's work, so a machine left on before the first block or after
  the last no longer reads its idle hours as time away from the desk.
- An `idle-start` now ends presence whatever an agent is doing, so a break is written while agent work
  keeps recording. Each prompt buys 15 minutes back off the break it ends.
- `streamDay` now reports `breaks` and `breakMs`: the gaps between two stretches of presence that no
  agent worked through and no pause covered.
- Exclusion rules now apply per calendar occurrence, and a Google account with a rejected refresh token reports that it stopped working instead of retrying forever.
- A call row keeps the issue you named it after when a meeting you accepted merely overlaps it, so a call with no fixed start no longer books to the wrong ticket.
- Draw calls and meetings in lanes of their own on the day screen, instead of beside the work no rule
  could place.
- A remembered call now names a stand-in as well as an issue, so a weekly call with no ticket is asked about once. `CallNaming.issueKey` became `target`, and `NamedIssue` became `NamedWork`.
- A call a rule counts as work now proposes its own weak row in the day review, on the same issue a meeting lands on. Time a meeting already claims is cut out first.
- A call now cuts its own application out of the day's blocks, so a browser window focused during a
  Meet no longer draws a band beside the call row. Work in any other application during a call is kept.
- A call is named after the channel joining it switched to, not the one it left.
- A gap longer than `maxBreakMs` is no longer a break: a machine left on overnight reported the night
  itself as time away from the desk, whether or not the screen was locked in it.
- A call the app was killed in the middle of no longer counts to now. The next run ends it where the
  watching stopped, so a killed run cannot claim every hour since.
- A GitLab or calendar failure now clears on the next clean run. It used to clear only in the append step, which a run with no credential never reaches, so a fixed token left the old error on screen.
- A meeting inside a background row now cuts that row in two rather than leaving it whole, so the hour
  is booked once. A new warning names two rows that still claim the same minutes.
- A row now carries `WorklogProposal.laneKey`, the checkout most of its time sat in, so a day screen
  can give each checkout its own lane. `streamKeyLabel` reads a stream key as a name.
- The day review can now open a stand-in for a context, name a row with one, and grow a stand-in's day list on every day it covers.
- A day now starts at a configured hour, so work past midnight stays on the evening it came from.
- Dragging one end of a row now pins that end only. The other end keeps following the day's own row, matched by lane, so moving a row's start no longer freezes it while the work goes on.
- An end a drag pinned now stays pinned. Growing a row at one end and then at the other keeps both, instead of handing the first end back to the day's own row.
- A row drawn over a band a rule excluded now cuts that band: the minutes it covers become
  the drawn row, and the rest of the room stays `Not counted`.
- A row whose ends a reviewer both fixed now claims the band it was cut from even after the band's id changed, so the day draws that stretch once instead of twice.
- The v2 day reads editor heartbeats to name the checkout a window title cannot. A meeting title is no longer quotable evidence.
- The fake Jira backend now answers `createmeta`, so a spec can drive the guard that reads what an
  account may create. `notCreatable` names the types it refuses, which stay in `/issuetype`.
- The e2e fake world serves seeded agent session logs, and its store now honours dedupe keys and keeps
  cursors, so a collector's re-read behaves the way the real store makes it behave.
- The test fixture can seed a specification and the files each commit touched, so a spec-backed ticket
  can be driven end to end.
- A day's sliver bands are folded into the band of their own lane, so one checkout is no longer drawn as a run of bands too small to read.
- Git scan: a worktree no longer books the whole repository's commits as its own — a commit is read once
  and named by the checkout that holds its branch.
- Ask for the GitLab token scope the activity feed needs. `/events` is documented as `read_user` or `api`, and `read_api` does not cover it, so a token made from the old instruction answered 403.
- A window that names no checkout and holds the focus for under two minutes now takes the context it
  interrupted, so a day of short flicks is no longer one row per flick. A break also ends a row.
- A glance between two windows of an application that names no work is dropped with them. It used to
  take that application's context, which gave a media player back the lane its own blocks were denied.
- A meeting whose microphone opened twice - a pre-join device check, or a call that dropped - now reads as one call.
- A Google token error now names which request failed and keeps Google's own description. A rejected
  authorization code no longer reports that the stored token needs a reconnect.
- New `readHeadBranches$()` reads the branch a checkout was on at an instant from its reflog, so a day
  holding no git event for a checkout can still name its branch.
- A rejected Jira call now reports what Jira said. `errorMessages` and the field names in `errors` are
  read off the response body, so a 400 on a create names the field instead of only the status.
- `MergeOptions.maxLaneSpanRatio` lets a band of one checkout span further than a band of several, so
  twenty short touches of one browser read as a few rows rather than twenty.
- The day counts calls, from which process holds the microphone. `TimetrackCallRules` decide at read time whether a call was work, and default to no.
- A row drawn on the timeline now stays in the lane it was drawn in, rather than falling into No
  checkout. A meeting taken from the day notes lands in Calls & meetings beside the day's other calls.
- `matchTicketWithAgent$` asks the agent only what already tracks a stretch of work: the parent and an
  open issue that may be it. It writes no summary and no description.
- `mergeBlocks` no longer draws a band far past the work behind it: a row spans at most twice the time
  it observed, and `WorklogProposal.stretches` says where inside a band that time sat.
- Stop drawing a stretch of focus shorter than five seconds as a band of its own, so a lane holding a
  quarter of an hour reads as a few bands rather than twenty slivers.
- The app now meters its own model calls. What a run spent lands under the reserved provider
  `timetrack`, and the day gives it a line of its own: no checkout books it, and it rebuilds no
  presence.
- `repoNamingDecisions`, the `naming.offers` op and `ethlete-agents timetrack naming` say why a checkout was offered no name.
- A row is no longer pushed past its own last evidence, so a running day stops drawing a band in the future.
- An application that names no work now proposes no row: `buildRows` takes `noWorkContext`, and a
  transient dialog takes the context of the block it interrupted.
- Deleting a stand-in the app opened now refuses its checkout, so no replacement appears seconds later, and a record no rule names any more is dropped on load. The settings screen allows a refused checkout again.
- New acts for naming work Jira does not hold yet: `openStandIn`, `openStandIns`, `standInNameFor`, `withNamedStandIn` and `setRowStandIn`.
- Stop drawing the app's own window as a band on the day screen. Its minutes still hold presence and
  still fold into the other-applications line.
- The parent picker no longer offers a sub-task, which Jira accepts as a parent in no hierarchy.
  `JiraIssue` now carries `isSubtask`, read from Jira's own flag on the issue type.
- An issue picker now reads a typed number as an issue key, so `2049` finds `BD-2049` in any project
  rather than nothing.
- An issue picker now searches Jira: it reads its own project, typed text reaches the query, and a
  whole issue key is answered by that issue whatever its project or status.
- `applyExclusionRules` tests a title pattern against the checkout an `agent-prompt` names, as it already
  does for a turn's spend. A rule that hides a repository now hides its prompts too.
- `streamDay()` rebuilds a day no window observed from the prompts the user typed, with a turn bridging
  the minutes between two of them. It reports the rebuilt part as `rebuiltMs`. See ADR 0006.
- A rebuilt day keeps a turn for a checkout no project link covers, and names a stream after a
  directory only when something says the directory is a checkout. See ADR 0006.
- `fetchRecurringPatterns$` reads the user's own Tempo history into the standing commitments the
  recurrence rung attributes from, which nothing produced before, so the rung named nothing.
- A background row now gives way to a meeting the reviewer grew over it, and the band behind it takes the minutes, so the day stops booking them twice.
- A URL in a window title is stored without its query string, and a focus that does not move no longer reads as time no window watched.
- `repairStoredTitles$` applies the window-title redaction to the titles already stored, which the rule could not reach because it only runs on the way in.
- A stand-in can now be answered. The day header counts what waits on a ticket and opens a list that resolves one to an issue, undoes that while no day it held reached Tempo, or deletes it.
- Cut a placeholder's rule back when it becomes a real issue. It covered the whole
  checkout; the ticket is one piece of work, so the resolve narrows to the branches the
  placeholder held, base branches apart.
- A band nothing has named now reads its observed time. Rounding spreads a day's increments over its
  rows, so thirty unnamed bands each read `15m`; `reviewDay` rounds a band once naming it makes it a
  worklog.
- A row keeps its id while a band beside it grows, so a live day no longer redraws a band that never moved.
- Take the branch out of an unnamed row's id. A band of a checkout holds every branch
  it worked, so the id named whichever block came first and moved while the day ran.
- A row named to a stand-in now reads that record at review time. Resolving the stand-in gives the row the issue key, and deleting it puts the row back to unnamed.
- `streamDay` now builds the day's bookable rows, on the same ladder, merge and rounding `correlateDay` uses.
- Re-read a merged row: a rule that named every block in it never saw which branch the
  row holds. A row spanning a branch swap keeps its key as a proposal instead of syncing
  on its own.
- A row a repository-wide attribution rule names now reviews as `likely` rather than `weak`, so it
  arrives ticked for the sync. A donating rule names no issue and stays `weak`.
- `AgentApiRules` now carries `callRules`, `meetingNamings` and `callNamings`. Without them the
  operation that exists to say why a band went unnamed could answer for work blocks only, and said
  nothing at all about the call lane.
- Shortening a row no longer deletes the rest of the band it came from. What is left is
  drawn as its own row, and a room a rule excluded stays `Not counted`.
- `specForCommits$` answers null when the host call throws, rather than ending the stream.
  `shasFromEvidence` takes evidence instead of details, and reads a sha off commit evidence only.
- The two limits that mark a stand-in as overdue are now on the Day tab of the settings, instead of only in the settings file. Both are held in range wherever they are read.
- An agent reads the open stand-ins through `standIn.list` and `ethlete-agents timetrack standins`. It may list them and never write one.
- A stand-in no longer opens for a checkout an issue already answers. It waits for the Tempo history, it leaves a checkout the day still offers an issue for, and it never replaces a rule that names one.
- Open a placeholder per branch, not per checkout. A checkout does several unrelated
  pieces of work in a day, so one placeholder drew over all of them and named them
  after whichever came last. A base branch gets none.
- A stand-in now opens only for a checkout the host discovered. A directory an agent ran in no longer opens a second one for work the checkout already holds, and none opens before the discovery answers.
- `status` and `ethlete-agents timetrack status` report `tempoReady`. Without a Tempo token the app reads no worklog history, and nothing said so.
- `streamDay()` keeps unrelated windows off a checkout: the sticky context now comes only from a
  window title, and only inside the application that set it.
- A written summary no longer carries an adjective that only adds emphasis, such as "vollständig" or
  "comprehensive". Both the ticket prompt and the parent prompt now ask for words that earn their place.
- Name a branch swap after the branch the unnamed work was mostly on. A band that
  passed through a base branch on the way in reported that branch instead.
- A written ticket now states the work to do in the present tense, in the language of the evidence,
  with a shorter summary. It used to read as a report of what was already done.
- A timed run under a minute now proposes no row, and a real run gets a lane of its own instead of sitting among the work nothing could place.
- A window title an agent changed no longer ends a stretch away that the idle source closed itself. The
  window source reports a title change as a focus event, so a break the user took kept splitting in two.
- A band nobody was at the machine for now keeps the key the ladder named it, on `withheldIssueKey`.
  It still books nothing and never syncs. Refusing to book a band and forgetting what it was are two
  separate decisions.
- The mask warning read only ASCII, so a name with an umlaut was never reported and always sent.
  Word boundaries and the capital test now use Unicode properties.
- A window evidence row names the application when the window source reports no title, so untitled windows no longer collapse into one blank row.
- A directory named with a leading dot no longer counts as a piece of work. `.changeset`, `.github`
  and `.claude` are the checkout's own tooling, so a commit there is bookkeeping for another piece.
- Two agent sessions of one checkout that ran at the same time are now two stretches that overlap, and the checkout books both.

## 0.1.0-next.5

### Minor Changes

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`5bd2f14`](https://github.com/ethlete-io/ethdk/commit/5bd2f14d27877c7db23c7fc878bb55bf5376bac4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Agent sessions: a cursor now records its checkout, so `resyncAgentSessionCursors()` can rewind the logs under a path and `agentSessionResyncOffers()` can name the skipped checkouts a new project link covers.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`3657156`](https://github.com/ethlete-io/ethdk/commit/36571560c755468459a87da9d9ec5764d976ee96) Thanks [@github-actions](https://github.com/apps/github-actions)! - `ethlete-agents timetrack instance` reports the Jira instance's own levels and the custom fields a
  branch subject could go in, so a setup step reads the answer instead of guessing it.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`8072455`](https://github.com/ethlete-io/ethdk/commit/8072455df2987b382e537e34a7810401bca01211) Thanks [@github-actions](https://github.com/apps/github-actions)! - Agent sessions are stored only for checkouts a project link covers, so work Tempo could never bill no
  longer fills the database.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`d73d386`](https://github.com/ethlete-io/ethdk/commit/d73d38685721714021f5e7ac86997506486770fc) Thanks [@github-actions](https://github.com/apps/github-actions)! - How long the window waits after you go idle before it locks is now a setting, `lockAfterIdleMs`,
  rather than a fixed minute.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`46e883b`](https://github.com/ethlete-io/ethdk/commit/46e883b8e814a79df5cc882955aaa225ffeac69f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Settings: add `lockWindow`, which says whether the app locks its window until the account password is given. Collection never stops for it.

### Patch Changes

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`7465f4f`](https://github.com/ethlete-io/ethdk/commit/7465f4f095839a4d289e5ebf92f14818465c36aa) Thanks [@github-actions](https://github.com/apps/github-actions)! - A repository that donates its time no longer takes an issue key off a recurring Tempo pattern or a
  browser tab. The block stays unattributed, so the day places it beside the work it was done for.

## 0.1.0-next.4

### Minor Changes

- [`f132d0b`](https://github.com/ethlete-io/ethdk/commit/f132d0b64e322c5823c9f50adeedecf388c5aa65) Thanks [@TomTomB](https://github.com/TomTomB)! - A coding agent in any repository can ask the app about Jira over a loopback endpoint, so no checkout
  needs a token of its own.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`65147f8`](https://github.com/ethlete-io/ethdk/commit/65147f8f5bff8387f33061e811d34a09748e21f2) Thanks [@github-actions](https://github.com/apps/github-actions)! - Reconstruct a day in a project that does not follow the branch grammar: attribution rules
  name a repository's or a branch's issue, and a repository with no tickets of its own donates
  its time to the work beside it.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`0adabf7`](https://github.com/ethlete-io/ethdk/commit/0adabf7541b3fcc31422710ebf60e60ff777c2e9) Thanks [@github-actions](https://github.com/apps/github-actions)! - A branch that names no issue can now be repaired from the day view, once a ticket is filed for it.

- [`55a5fb5`](https://github.com/ethlete-io/ethdk/commit/55a5fb55c72d76072d91a26ffd75575a1548e105) Thanks [@TomTomB](https://github.com/TomTomB)! - A day now counts the time Tempo already holds against its target, so a day logged by hand no longer reports itself as short.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`eab3cc4`](https://github.com/ethlete-io/ethdk/commit/eab3cc4b99704fdd847fab5b15d950c0625b864c) Thanks [@github-actions](https://github.com/apps/github-actions)! - The week view and the end-of-day reminder no longer call a day unfinished when Tempo already holds its
  time; a new `TimetrackCoverageStore` port keeps what the Sync preview read, so both still answer
  offline.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`dce484d`](https://github.com/ethlete-io/ethdk/commit/dce484d3d25069b4327f93fc4230a3668eead1b4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Editor heartbeats: a new `editor` source names the checkout, branch and directory being edited, and
  an `ingest` module carries the wire format a reporter posts to the app's local endpoint.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`8ceb0bd`](https://github.com/ethlete-io/ethdk/commit/8ceb0bd3782015662eb8fe1b5709eb55fba23fff) Thanks [@github-actions](https://github.com/apps/github-actions)! - Say when a day is not finished: `dayNudge()` words the one reminder a day gets, from what the local
  ledger says is still owed. `TimetrackSettings` gains a `nudge` field.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`dac26ff`](https://github.com/ethlete-io/ethdk/commit/dac26ff902c3c5683891a3d76b40d3e594d66a8f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Log a pause shorter than `gapFillMs` as the work around it, so the day stops coming up
  short of its target across a run of small idle gaps.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`f668325`](https://github.com/ethlete-io/ethdk/commit/f668325b2ee5885b03dd6bd703205d6ee9fd1e3d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Read GitLab merge-request activity: `collectGitLabEvents$` stores what you pushed, commented on and
  approved, and `mergeRequestActivity()` turns it into the issue behind the merge request's own branch —
  so reviewing somebody else's work reaches the Task being reviewed.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`c8045d4`](https://github.com/ethlete-io/ethdk/commit/c8045d46d11cb675e12a78d8ac05787163e5d065) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the Google OAuth half the calendar provider was waiting on: the code exchange, the refresh, the
  revoke, and a token source that hands out an access token that is valid right now.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`59df547`](https://github.com/ethlete-io/ethdk/commit/59df54780d54e8044ecf8b3b3ecc7b5245f1ce09) Thanks [@github-actions](https://github.com/apps/github-actions)! - Correlate a hard pause: `pauseWindows()` reads the stretches collection was stopped for out
  of a day's events, and `correlateDay()` takes them as `pauses` so no row is billed for time
  nothing watched.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`ce9ca31`](https://github.com/ethlete-io/ethdk/commit/ce9ca31886c7f720a9ecd1320e87218d91c93335) Thanks [@github-actions](https://github.com/apps/github-actions)! - Own Tempo worklogs per day: the ledger port now reads `entriesForDay$(day)`, so a worklog whose
  proposal the day stopped producing is deleted instead of reading as somebody else's.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`d4ede59`](https://github.com/ethlete-io/ethdk/commit/d4ede598eb18cce86993988a6aa2459715f48e65) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `moveRowBoundary()`, which moves the instant two adjacent worklog rows meet at without changing
  the pair's total, so a split can be placed exactly rather than only halved.

- [`b70453e`](https://github.com/ethlete-io/ethdk/commit/b70453e774c19aa821ef7365520a0712c8105e3a) Thanks [@TomTomB](https://github.com/TomTomB)! - Settings hold picked Jira projects (`favoriteProjects`) instead of typed key prefixes, an issue key
  in free text is only read against them, and a reviewer can now write, move and remove a row the
  collectors never saw.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`47df13d`](https://github.com/ethlete-io/ethdk/commit/47df13dcf26f65ac7539edf90033b884823e5fe2) Thanks [@github-actions](https://github.com/apps/github-actions)! - A path can now be linked to a Jira project or marked private, so a side project on the same machine proposes nothing and fills in no timesheet.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`7f62cbc`](https://github.com/ethlete-io/ethdk/commit/7f62cbca2ea6e2891a800c4edeb9a12f17a1d272) Thanks [@github-actions](https://github.com/apps/github-actions)! - A day review can now ask your own `claude` CLI what the work it could not name belongs to. The answer
  arrives as a `weak` suggestion with its reason attached, so nothing syncs unread.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`3b2b253`](https://github.com/ethlete-io/ethdk/commit/3b2b253e08c552ff0f4a67410e4dde3678a82418) Thanks [@github-actions](https://github.com/apps/github-actions)! - Work a day found that no issue covers can now be filed as a Jira ticket from the review, and the new
  key becomes the standing rule for that context.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`39c64e7`](https://github.com/ethlete-io/ethdk/commit/39c64e7262b9dbe20f33d28552d019853396b4a1) Thanks [@github-actions](https://github.com/apps/github-actions)! - Read a week of days at once: `reviewWeek()` answers which days still owe something, from the same
  local ledger the end-of-day reminder reads. Adds `startOfWeekKey()`, `weekDayKeys()`,
  `shiftWeekKey()` and `describeDayReviewGap()`, which words a gap for every surface that reports one.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`840886b`](https://github.com/ethlete-io/ethdk/commit/840886b4d0f47cbab1ea3229ebc2ff550068f0b7) Thanks [@github-actions](https://github.com/apps/github-actions)! - A new Start view files a ticket, creates the branch the grammar names for it and opens a draft merge request.

### Patch Changes

- [`de287bc`](https://github.com/ethlete-io/ethdk/commit/de287bc48aef0daa96103614ae32ceb5eec03610) Thanks [@TomTomB](https://github.com/TomTomB)! - A day no longer counts an agent session that ran while the user was away, and a lone late sample no longer stretches the block before it.

- [`c60c430`](https://github.com/ethlete-io/ethdk/commit/c60c4301d218c740c198f21b0fa2d05d652c1f7a) Thanks [@TomTomB](https://github.com/TomTomB)! - New `currentAttribution`, which names the issue the work happening now would be logged on and how sure the day is of it.

- [`9e23593`](https://github.com/ethlete-io/ethdk/commit/9e23593b03f371d707efce92c47d39132ed66e32) Thanks [@TomTomB](https://github.com/TomTomB)! - A day no longer labels blocks `HEAD`, including events a collector already stored with that branch.

- [`f89ab22`](https://github.com/ethlete-io/ethdk/commit/f89ab22b87a07465683fab32161d98d98af6bc2e) Thanks [@TomTomB](https://github.com/TomTomB)! - A Claude Code session in a detached checkout no longer reports `HEAD` as its branch.

- [#3066](https://github.com/ethlete-io/ethdk/pull/3066) [`68bf132`](https://github.com/ethlete-io/ethdk/commit/68bf1324db1a4c1c4b447941a2dec254352e31c9) Thanks [@github-actions](https://github.com/apps/github-actions)! - Tempo sync: time you logged in Tempo by hand now counts against the day, so a sync no longer writes
  a second copy of it.

- [`67f9d12`](https://github.com/ethlete-io/ethdk/commit/67f9d12e34b19c18ccb9b2b3b25a520c9f6c7d4e) Thanks [@TomTomB](https://github.com/TomTomB)! - A reasoning run now reports why it proposed nothing, so a failed run is no longer read as an answer.

- [`13e944c`](https://github.com/ethlete-io/ethdk/commit/13e944c95f33074908b2a359b97aefce4d5d7ba8) Thanks [@TomTomB](https://github.com/TomTomB)! - A new ticket now reads the instance's projects, leads its description with what the work says it was, and can have the local agent write both fields.

- [`46fe3fe`](https://github.com/ethlete-io/ethdk/commit/46fe3fe98abbcc0618aa6f06e911318d26f854e9) Thanks [@TomTomB](https://github.com/TomTomB)! - A ticket draft now suggests its parent, offers the open issues that may already track the work, and lets the agent pick both.

## 0.1.0-next.3

### Minor Changes

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`4d39606`](https://github.com/ethlete-io/ethdk/commit/4d396066840f10f124d0db53e2fc570a7b60f087) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `currentActivity`, which reads a day's events and blocks as one present-tense statement for a tray
  or status readout, reporting idle over a stale block.

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`056feed`](https://github.com/ethlete-io/ethdk/commit/056feedd6b1498c426e4ea7b9c1a3909e43767d7) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `dedupeKeyOf`, the identity a re-collected event is recognised by, so a git scan can re-read a
  window of history without appending the same commit or branch switch a second time.

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`58fd1e4`](https://github.com/ethlete-io/ethdk/commit/58fd1e455981cb516e380d949138f0098ed86dbc) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add timer runs — `TimerRun`, `matchTimerRuns` and `correlateDay`'s `timerRuns`. A run displaces the
  reconstruction underneath it, so a timed hour is never proposed twice.

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`7715bf9`](https://github.com/ethlete-io/ethdk/commit/7715bf9bad85b5e3fc828fd28771eb93e589d965) Thanks [@github-actions](https://github.com/apps/github-actions)! - `sessionize` now follows the focused window's repository, so with several editor windows open on
  different checkouts a title naming one re-points the block instead of leaving it on the branch last
  committed to.

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`49aa421`](https://github.com/ethlete-io/ethdk/commit/49aa421abe46ee3005e0c2b163a664caddffee26) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the settings layer — `TimetrackSettings`, `parseTimetrackSettings`, `effectiveExclusionRules` and
  the `TimetrackSettingsStore` port, plus `readJiraCredentials$`/`readTempoCredentials$` and `has$` and
  `delete$` on `TimetrackSecretStore`.

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`a132fc8`](https://github.com/ethlete-io/ethdk/commit/a132fc861f997850977edf57ccc9911007816754) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the read-only half of a Tempo sync — `previewTempoSync$` resolves the account, the issue ids and
  the day's remote worklogs into a `TempoSyncPlan`, and `fetchJiraMyself$` reads the account id every
  Tempo call is scoped to.

## 0.1.0-next.2

### Minor Changes

- [`eed8060`](https://github.com/ethlete-io/ethdk/commit/eed80604a2b9b5a2e68fec3b7f56f02060021388) Thanks [@TomTomB](https://github.com/TomTomB)! - Add the day-review layer: `reviewDay()` applies a day's local edits over a freshly correlated day, so
  re-correlating never discards a row a reviewer has already touched.

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`0fcbab9`](https://github.com/ethlete-io/ethdk/commit/0fcbab92b0da0061ce2d5fcea411ebba0b293d80) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the Google Calendar provider and `matchMeetings()`, which turns an accepted event whose conference
  a window title names into a worklog row of its own.

## 0.1.0-next.1

### Minor Changes

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`3b21416`](https://github.com/ethlete-io/ethdk/commit/3b21416847c982e75d9a0b1ba573752cbc68f470) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `collectAgentSessions$()` and the `AgentSessionLogReader` port, which read each agent session log
  from a persisted cursor so a run collects only what was appended since the last one.

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`b39d77c`](https://github.com/ethlete-io/ethdk/commit/b39d77c350735b4ec158869ff238ac9e076ae105) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `parseClaudeCodeSessionLog()`, which reads a Claude Code session log into sampled agent-session
  events from its metadata alone.

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`f9ce4c1`](https://github.com/ethlete-io/ethdk/commit/f9ce4c183c4470f43a96344f79bd088c6bd277f8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `collectGitEvents$()`, which reads a day's branch switches and commits out of the configured
  repositories.

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`1d9cc7c`](https://github.com/ethlete-io/ethdk/commit/1d9cc7cae054e8ceedbaad044c500655e7198d20) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the store's core half: the event and ledger persistence ports, `applyExclusionRules()` with
  shipped defaults, `planRetention()` clamped to what compaction has covered, and
  `applyLedgerChanges$()`. `TimetrackEventStore` moved from `transport` to `store`.

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`8d0777d`](https://github.com/ethlete-io/ethdk/commit/8d0777d60c25198db8b2ce7d90d18109a962d56c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the Tempo write half: `executeTempoSync$()` applies a `TempoSyncPlan` with per-row results and a
  retryable remainder, plus worklog create/update/delete and a configurable ownership marker that
  survives a lost ledger.

## 0.1.0-next.0

### Minor Changes

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`bc17623`](https://github.com/ethlete-io/ethdk/commit/bc17623d34aaabdf9cb26d89674a71d4ca3f2a41) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `@ethlete/timetrack`: the time-tracking core's data model, host ports, and the `sessionize()`
  and `attribute()` correlation steps that turn observed activity into issue-attributed blocks.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`a4739ec`](https://github.com/ethlete-io/ethdk/commit/a4739ec1eb923c89585d3998c2084cec802a1945) Thanks [@github-actions](https://github.com/apps/github-actions)! - Complete the deterministic pipeline with `mergeBlocks()`, `roundDurations()`, `checkDay()`,
  `describeWork()`, `propose()` and `correlateDay()` — a window of events now becomes rounded,
  described `WorklogProposal`s carrying their evidence chain.

- [`154c5cf`](https://github.com/ethlete-io/ethdk/commit/154c5cf65ebeb9627437fb50197c08d3839646fe) Thanks [@TomTomB](https://github.com/TomTomB)! - Add the Jira provider over `TimetrackTransport` — issue lookup, the cursor-paged JQL search and
  hierarchy discovery — plus the merge-request/issue-view and recurring-pattern rungs of the
  attribution ladder.

- [`cce0cba`](https://github.com/ethlete-io/ethdk/commit/cce0cba53ec1fbb3fb7b312cee5f5891e92f0815) Thanks [@TomTomB](https://github.com/TomTomB)! - Add the Tempo read side: work-attribute discovery, a paged worklog reader, `subtractForeignTime()`
  so a re-sync cannot log an hour twice, and `planTempoSync()` for the create/update/delete preview.
