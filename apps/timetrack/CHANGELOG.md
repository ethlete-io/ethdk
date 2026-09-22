# timetrack-app

## 0.2.0-next.0

### Minor Changes

- Scheduler: mark the current time with a line across today's column, and open the edit surface beside an appointment instead of under it. The Timetrack day draws the same line.
- Two new agent endpoint ops: `day.rows` answers the rows a day drew with the id each edit names, and
  `day.edits` corrects one. `timetrack rows` and `timetrack edit` reach both.
- Suggestions settings hold a Language. Every ticket, parent, match reason and day proposal is written
  in it, whatever language the evidence is in. Empty keeps the old behaviour of following the evidence.
- One day screen. Today merged into Day: its totals, streams and notes now sit with the timeline, every
  band is a row, and the work waiting for a name is drawn once instead of twice.
- The new-parent form has its own Ask AI, which writes the wider goal the ticket rolls up to. What
  that call would send is shown next to it, with the same mask warning the ticket payload carries.
- Naming a call the calendar never held is remembered, and Settings list every remembered call.
- The timeline is the day screen. A band is named on the scheduler's own edit surface, the row list is
  gone, and what is not a band sits in a closed strip under it.
- A stand-in's ticket form offers a second press, "Ask AI to find a match". It fills the Parent field
  and names the issue that may already be this work, and leaves the words the user wrote alone.
- Ask AI on the create form now writes inside the specification the work sits under, found from the
  commits the day observed. Where the spec names an epic, the Parent field answers with it and says so.
- The app version now advances through a changeset, like a published package, so the build stamp names the release it came from.
- Day timeline: a band answers hover and focus, the cursor says what each zone does, and a marked run
  says how many it holds with a merge beside it - shift-click extends it, escape drops it.
- The create form now puts Project, Summary and Description above the AI block, asks a second press
  before it files, and offers a way back to the day once the ticket exists.
- Work Jira holds no ticket for can now be named in your own words, in one press. A name already given
  is offered beside the issue field and on the band's edit surface, so the next context takes it.
- Filing a ticket from a band now opens a dialog for that placeholder alone, titled with its name,
  instead of a list of every placeholder waiting on a ticket.
- A branch with no issue key now inherits one from a sibling checkout that shares its branch slug,
  picked by elimination from the children of the epic that sibling books under.
- Filing a ticket now reads what Jira permits the account and says so before the press, refuses to file
  a second issue with a summary the project already holds, and drafts the parent a description.
- `unmaskedWords` now returns each word with a `likelyName` flag and puts the name-shaped ones first,
  so a German payload no longer buries the one client name the list is missing.

### Patch Changes

- The issue picker offers what the row's own lane was named with before, in a group above the rest
  of the list.
- A break that crosses a band is now hatched onto the band as well as drawn in its own lane, so the
  part of the work nobody was at the seat for is visible on the row that books it.
- Work an agent did inside a break is booked again. The day clipped those blocks away, so a window
  steered from a phone lost its row and the break grew. The band now runs through it.
- A call ladder rung that names no issue no longer ends the ladder. A picked calendar occurrence says
  which meeting the call was, not which work it books, so the remembered answer below it is read too.
- A call the microphone is still in stays on the day instead of being closed the next time the window reloads.
- A band the reviewer named or hid no longer counts as unattributed time, and both day warnings now say where to look: which lanes hold the unnamed work, and which call the observed work runs under.
- A band two rungs named different work for now shows both. The row still books the higher answer, the
  day warns and names the band, and the band offers the other answer in one press.
- A GitLab instance `glab` holds no login for is now named as such, and Settings offers the instances
  `glab` is logged in to.
- The day now warns when a remembered answer books to a ticket Jira has recorded no change on for a
  quarter, naming the band and how long the ticket has been quiet.
- The ticket form files the type the picked parent implies, rather than one fixed type. Picking a Story
  files a sub-task, which is what Jira accepts there; a line under the field says so before the press.
- A background band no longer claims the quarter-hour a running day is still in, so a checkout with seconds of presence cannot book it before the work beside it claims it
- Edit a break on the day screen. A press on a break says you were at the machine, a range drawn
  in the break lane says you were away, and the day's notes take either statement back.
- The day's present total and its engagement ratio follow what you said about the day. The measured
  total stays in the day's notes, so the correction is visible.
- The issue picker offers a lane its own tickets again, and a new `lane.issues` operation reports what
  it reads.
- The issue picker names the rest of its list, so the lane's own tickets end where the group ends.
- Every issue the ticket form files is assigned to the account the Jira token belongs to. This covers
  the ticket and a parent filed from the same form, which both landed as `Unassigned` before.
- A ticket filed from the day review is moved to the status Settings name, under "Then move it to".
- The agent may now choose from the issues the user's recent Tempo history names, not only the ones
  the day itself reached. New `fetchTempoHistory$` answers both out of one read.
- A new `settings.rules` agent op, and an `ethlete-agents timetrack rules` command, read the rules that
  name a day's work out of the encrypted store.
- Names in free text can now be turned into pseudonyms before a prompt is sent, and read back from the answer. A word the app cannot account for is reported so the name list can close it.
- A right click on a band opens its own menu, carrying Hide this row and Split in half, so neither needs the edit surface to be opened first.
- Clears the duplicate focus, presence and call rows earlier reloads appended, and the collector counters now report the rows a drain actually stored.
- Two rows that meet at one instant each take the whole lane again, rather than half of it each.
- A modifier click marks a band, the band menu folds the marked rows into one, and the drag-to-resize handles now answer to the pointer with a cursor and a colour.
- Offer every row action in a band's own context menu, so the reset, the merge and the removal are no
  longer reachable only from the edit surface.
- A band on the day timeline is one solid rectangle again. It no longer cuts holes where the day
  observed nothing, which read as a rendering fault rather than as information.
- The ticket form's model press is now labelled Ask AI, and what it sends goes out in pseudonyms. The wording, the parent and the existing issue come back in real names.
- A linked checkout no rule could name now opens its own stand-in, named from the day's own evidence. Every later day of that checkout lands on the same one.
- New `backgroundProjects` setting: a band of one of those projects keeps only the time no other band
  claims, so the library you sit in all day stops overlapping the work you book.
- The day counts only time a worklog can hold as unattributed, and reports a day as short of its target
  only once the day is over.
- Stop a prompt's allowance taking a break below the shortest break the day reports. A break the idle
  notifier observed is an absence, so the allowance shortens it and never deletes it.
- Draw a break an agent ran through, snapped to the row increment. Such a break leaves no gap between
  rows, so the day screen used to show the work and never the absence under it.
- The packaged app is styled again. The production build inlined the critical CSS and deferred the
  stylesheet with an inline `onload` handler, which the app CSP blocks, so the sheet stayed on
  `media="print"`. The build now links the stylesheet directly.
- A store whose agent session cursor table is missing a column repairs itself instead of failing every
  collection run.
- A meeting inside a background row now cuts that row in two rather than leaving it whole, so the hour
  is booked once. A new warning names two rows that still claim the same minutes.
- An end a drag pinned now stays pinned. Growing a row at one end and then at the other keeps both, instead of handing the first end back to the day's own row.
- A row whose ends a reviewer both fixed now claims the band it was cut from even after the band's id changed, so the day draws that stretch once instead of twice.
- `settings.rules` now reports the call rules and both remembered naming stores. Every field stays
  listed by hand, so the Jira host, the account email and every token stay out of the answer.
- The create-ticket form can now file the parent itself, at one of the instance's own parent levels, for
  work whose epic does not exist yet.
- The ticket form now opens on a stand-in as well as on an unnamed context. The key it files resolves the stand-in, and the result names the parent it filed on the way.
- A store the app cannot open now offers to start fresh instead of the app not starting at all. The old
  file is kept, not deleted.
- The Tempo history read waits for the settings document, so the recurrence rung and the checkout-wide naming offer are no longer empty for a whole session.
- Ask the compositor for input idleness rather than session idleness. An idle inhibitor, such as a call
  or a video, silenced the old request, so this machine collected no idle transition at all.
- A row drawn on the timeline now stays in the lane it was drawn in, rather than falling into No
  checkout. A meeting taken from the day notes lands in Calls & meetings beside the day's other calls.
- The day's question to the model now goes out in pseudonyms: every name on the new list, and the project prefix of every issue key. The answer is read back into real names.
- The app now meters its own model calls. What a run spent lands under the reserved provider
  `timetrack`, and the day gives it a line of its own: no checkout books it, and it rebuilds no
  presence.
- Settings now holds the name list the anonymiser reads, seeded by a press from the projects you picked. The prompt preview marks every capitalised word the list does not hold, and each one carries a press that adds it.
- Calls and meetings now share one lane on the day timeline, instead of splitting one kind of row over
  two columns.
- Pressing another band while a row's issue picker is open now replaces the edit surface instead of opening a second one, and each save lands on the row its own surface edited.
- Deleting a stand-in the app opened now refuses its checkout, so no replacement appears seconds later, and a record no rule names any more is dropped on load. The settings screen allows a refused checkout again.
- The parent picker no longer offers a sub-task, which Jira accepts as a parent in no hierarchy.
  `JiraIssue` now carries `isSubtask`, read from Jira's own flag on the issue type.
- A band the reviewer merged or split now takes the stand-in covering its checkout, so a day reviewed before the placeholder was opened carries it too and one resolve books every day.
- An issue picker now searches Jira: it reads its own project, typed text reaches the query, and a
  whole issue key is answered by that issue whatever its project or status.
- A masked name that is also one of the pseudonym words no longer takes itself. A client called Mesa used to go out as written, and no warning reported it.
- A band waiting on a ticket now says so in its own edit modal, and one press opens the ticket form on that stand-in. The filed result stays on screen after the resolve.
- A stand-in can now be answered. The day header counts what waits on a ticket and opens a list that resolves one to an issue, undoes that while no day it held reached Tempo, or deletes it.
- A row now books the time its band covers, so a band drawn from 13:15 to 13:45 logs 30 minutes rather
  than a shorter time.
- A row named to a stand-in now reads that record at review time. Resolving the stand-in gives the row the issue key, and deleting it puts the row back to unnamed.
- The two limits that mark a stand-in as overdue are now on the Day tab of the settings, instead of only in the settings file. Both are held in range wherever they are read.
- A stand-in that waited past its age in workdays, or past the time its bands hold, is now marked in the list and counted in the day header. Two settings set both limits.
- The ticket form a stand-in opens now holds the Ask AI press. It sends the name and the description the user gave the work, in pseudonyms, with the number of days it waited and no minutes.
- A band waiting on a ticket now paints in its own colour and reads as provisional on the timeline, rather than as one more guess the reviewer has to settle.
- The day header no longer counts one stand-in twice. Its press opens the panel, which
  marks each overdue record itself, and the panel gained a Close button.
- A stand-in no longer opens for a checkout an issue already answers. It waits for the Tempo history, it leaves a checkout the day still offers an issue for, and it never replaces a rule that names one.
- A stand-in now opens only for a checkout the host discovered. A directory an agent ran in no longer opens a second one for work the checkout already holds, and none opens before the discovery answers.
- The work waiting on a ticket now lives in a Debug accordion instead of the day header. The list
  carries no chrome of its own, so the edit surface can still open it as its own dialog.
- A written ticket now states the work to do in the present tense, in the language of the evidence,
  with a shorter summary. It used to read as a report of what was already done.
- A band an agent worked alone now reads `Nobody was here · ABC-1` and offers that key on its edit
  surface. One press books it, so the reviewer no longer retypes a key the day already worked out.
- The mask warning read only ASCII, so a name with an umlaut was never reported and always sent.
  Word boundaries and the capital test now use Unicode properties.
