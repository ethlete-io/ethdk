# Testing timetrack

Sections 1 to 12 are the manual check. A person works through them from the top. Each step has one
action and one pass condition. Write down the number of any step that fails, and what you saw.

Section 0 is the automated check. Run it first — it is faster, and it catches what it covers.

## 0. The automated check

```bash
export NX_NO_CLOUD=true
npx nx run-many -t lint build test -p timetrack timetrack-app
npx nx e2e timetrack-e2e
```

The e2e run starts the app on port 4211 with `main.e2e.ts`, which swaps the desktop host for
in-memory fakes. There is no Tauri, no network and no keychain in that run. Every answer comes from
`apps/timetrack/src/e2e/world.ts`, so the suite is safe to run at any time and writes nothing.

To look at the fake app yourself, run `npx nx serve timetrack-app --configuration=e2e` and open
`http://localhost:4211`.

**Pass:** 931 unit tests and 25 e2e tests pass.

The e2e suite covers the day reconstruction, the unnamed-work card, the create-ticket draft, the row a
reviewer adds by hand, the sync preview against time already in Tempo, the week view reading that time
back, the branch repair and the start-work plan. It does not cover any pointer gesture on the timeline
or the agent call. Those still need sections 5, 6 and 17.

## 1. Start the app

`cargo` is not on the default PATH. Export it first, or the Tauri build stops at once.

```bash
export PATH="$HOME/.rustup/toolchains/stable-x86_64-apple-darwin/bin:$PATH"
export NX_NO_CLOUD=true
yarn timetrack
```

The first run compiles the Rust crate and takes about a minute. A window opens.

**Pass:** the window opens and shows the sidebar with Day, Week, Sync, Sources, Settings and Host.

## 2. Know what writes

Read this before you press anything. Three controls change data outside your machine.

| Control            | Where                 | What it does             |
| ------------------ | --------------------- | ------------------------ |
| **Create in Jira** | Day → Create a ticket | Files a real Jira issue  |
| **Sync**           | Sync                  | Writes worklogs to Tempo |
| **Retry**          | Sync → Last write     | Writes worklogs to Tempo |

Everything else only reads, or writes to the local encrypted store.

**Warning: read the Sync preview before you press Sync.** The preview is the only thing between you
and a write to Tempo.

## 3. Settings

The screen is five tabs, and every explanation sits behind the **i** glyph beside the thing it is
about. Press a few of them.

1. Open Settings. On **Jira**, check that Jira and Tempo report a connection. On **Sources**, check
   GitLab.
2. On **Projects**, open the **Projects** picker and pick the projects you work in.
3. Still on **Jira**, open **File as** and **A parent may be**. Both read your instance's own issue
   types. Open **Branch-subject field**: it lists your own custom fields by name.
4. On **Suggestions**, turn the switch on.

**Pass:**

- The two services report a connection, and the app stores each change without an error banner.
- Every picker fills with real Jira data. None of them is a box you type an identifier into.
- Picking a project is what makes the pickers elsewhere in the app offer anything at all: with an
  empty list they are empty, and the filter above them says so.

## 4. The day view

1. Open Day.
2. Press **Today**.

**Pass:** rows appear. Each row names an issue, a duration and a time range.

If the view shows "This day could not be read", stop and report the message.

## 5. The row boundary drag

1. Find two rows that follow each other.
2. Press the boundary between them and drag it.
3. Release it.

**Pass:** the split lands where you dropped it. The two rows keep the same total as before.

**Also check:** press **Reset to proposal** on one row. The row returns to its first value.

## 6. Ask for suggestions

You need Suggestions on from section 3.

1. Scroll to the **Not yet named** card.
2. Press **Ask**.
3. Wait. The call runs a local agent CLI, so it takes a few seconds.

**Pass:** a suggestion appears against at least one context. It reads as a weak answer, and the app
does not log it on its own.

**Also check:** press **Always log here** on a suggestion you agree with. The app stores it as a
rule. Press **No tickets here** on a context you want ignored.

## 7. Create a ticket

This step is safe up to the last button.

1. On the **Not yet named** card, press **Create a ticket**.
2. Read the drafted **Summary** and **Description**.
3. Check the **Project** field.
4. Look at the parent list.

**Pass:**

- The form opens with **No parent** selected. It never pre-selects a parent.
- The summary reads like the work, not like a file path or a window title.
- The description quotes commit subjects and agent session titles only.
- The parent list fills with issues from the project.

**Do not press "Create in Jira"** unless you accept a real ticket. Press **Close** instead.

Two questions to answer against your instance while the form is open:

1. Which Jira field holds the branch subject?
2. Does your instance let a parent be set through the parent field?

## 8. The week view

1. Open Week.
2. Press **This week**.

**Pass:** seven days appear. Each day that saw work shows a duration.

A day whose time you logged in Tempo by hand needs section 12, not this step.

## 9. Defects already found — do not report these again

Both are fixed. They are kept here so a report of the same symptom can be matched against them.

### 9.1 A day logged in Tempo by hand still read as unfinished — fixed

The week view said a day needed work, although Tempo already held that day's time. `dayReviewGap`
read the local ledger alone, and the ledger records only what **this app** wrote.

The Sync preview now writes down what Tempo holds for the day, per issue. The week view and the
end-of-day reminder reduce every row by that record before they say a day is behind, which is the same
reduction a sync plans. Neither view asks Tempo, so both still work with no token and no network.

The record is only as fresh as the last preview. A day you have never opened Sync on has no record,
and still reads as unsynced. Check it in section 12.

### 9.2 A sync logged the same hour twice — fixed

`planTempoSync` listed foreign worklogs under "Already in Tempo" but never subtracted them, so a day
you logged by hand planned a second copy of every hour.

`planTempoSync` now reduces every syncable proposal by the time Tempo already holds for the same
issue. A row Tempo covers in full writes nothing. An app-owned row that foreign time covers is
deleted, which keeps the day's total right. Foreign worklogs are still never edited or deleted.

Check it in section 10, and read the **Counted against this day** banner.

## 10. The Sync view, read only

The preview reads Jira and Tempo. It writes nothing.

1. Open Sync.
2. Choose a day and read the preview.

**Pass:** the preview lists what it would create, update and delete. The **Already in Tempo**
section lists the time the account already holds.

3. Choose a day whose time you logged in Tempo by hand.

**Pass:** the preview creates nothing for that day. A **Counted against this day** banner names how
much the foreign time covers.

This is the check for the fix in section 9.2. Read the plan before you press Sync.

## 11. Sources and Host

1. Open Sources. Read what each collector sees.
2. Open Host. Read the store and its cursors.

**Pass:** each collector reports a state, and the cursors carry a recent time.

## 12. The week view reads what Tempo already holds

This is the check for the fix in section 9.1. It writes nothing.

1. Pick a day whose time you logged in Tempo by hand, and open it in Day.
2. Open Week.

**Pass:** the day reports that its time is not in Tempo yet.

3. Open Sync and read the preview for that same day.
4. Open Week again.

**Pass:** the day no longer reports time missing from Tempo. Time no issue claimed is still reported,
which is correct — Tempo cannot hold it.

## 13. Repair a branch that names no issue

This is the only section that renames a branch and writes to GitLab. Read it before you start.

**Do not run this against a branch you care about.** Make a throwaway branch first:

```bash
git switch -c feat/throwaway-repair-check
git push -u origin feat/throwaway-repair-check
```

Work on it for a few minutes, so the day observes it. Then:

1. Open the day in Day.
2. On the **Not yet named** card for that branch, press **Create a ticket**.
3. Press **Create in Jira**. This files a real ticket.
4. Read the offer that appears under the form.
5. Press **Show me the steps**.

**Pass:**

- The offer names your branch and the key that was just filed.
- Every step shows the exact command, and an **Undo** line beside it.
- The last step deletes the old branch from the remote, and it is last.
- Nothing has run yet.

6. Press **Run these steps**.

**Pass:** the banner reports the new name, and `git branch` shows it locally.

Two cases worth checking separately:

- **A dirty working tree.** Change a file, then open the repair. It must refuse and offer no button.
- **An open merge request.** Open one from the branch, then repair. The branch must keep its name,
  only the merge request title gains the key, and the reason must say why.

## 14. Start a piece of work

This section files a real ticket, creates a real branch and opens a real merge request. Read it
before you start.

**Do not run this in a repository you care about.** Use a throwaway clone, or be ready to delete
what it creates. The plan names everything it will do before anything runs.

1. Open **Start**.
2. Pick a repository from the list.
3. Type the project key. The parent stories load a moment after you stop typing.
4. Type a summary.

**Pass:**

- The branch reads `feat/<KEY>-<your-summary>`, with `<KEY>` still a placeholder.
- **from** names the remote's copy of the development branch, such as `origin/next`.
- **merges to** names the development branch.
- Every step shows its exact command, and an **Undo** line beside the ones that write something.
- Nothing has run yet.

5. Pick a parent story that already has a feature branch.

**Pass:** the branch is now nested under the parent's full path, and **merges to** is the parent
branch rather than the development branch.

6. Press **Run these steps**.

**Pass:** the banner names the issue that was filed and the branch you are now on. `git branch`
agrees, and the merge request opens in GitLab as a **draft** with the issue linked.

Cases worth checking separately:

- **A dirty working tree.** Change a file, then reload the view. It must refuse and offer no button.
- **A story with no feature branch.** Pick one. It must refuse and say to start the story first.
- **A parent branch that was never pushed.** It must refuse and say to push the parent first.

## 15. Editor heartbeats

This writes nothing outside this machine. It needs the VS Code extension built and linked — see
`apps/timetrack-vscode/README.md`.

1. Start the app, then open Sources and read the **Editor heartbeats** row.

**Pass:** the row says which port it is listening on and names the file a reporter finds it through.
With no extension installed it says no reporter has connected yet.

2. Build and link the extension, then restart VS Code and open a file in any git checkout.
3. Wait a minute, then read the row again.

**Pass:** the row names `vscode` and the time it last posted, and the stored count is above zero.

4. Open Day and find the stretch you were editing in.

**Pass:** the block names the checkout and the branch, and its evidence names the directory you were
editing — not the file.

Cases worth checking separately:

- **Focus.** Move to another application for two minutes with the editor still open. The reporter
  posts nothing for that stretch: the last-posted time in Sources stops moving.
- **A restarted app.** Quit the app and start it again, leaving VS Code running. Within a minute the
  row names `vscode` again — the extension re-reads the file after the refused token.
- **The pause.** Pause collection, wait a minute, then resume. Nothing is stored for the paused
  stretch, and Sources reports no refused posts: a pause drops what arrives rather than rejecting it.
- **A rule.** Add a title-pattern exclusion rule matching a checkout's name, then edit in it. Nothing
  is stored for that checkout, and the row counts the denial.

## 16. Work versus private use

This writes nothing outside this machine. It needs a git checkout you do not bill for.

1. Work in that checkout for a few minutes, then open Day.

**Pass:** the checkout appears under **Not yet named**, with a **Not work** button beside it.

2. Press **Not work**, then open Settings → **Projects** and read **Directories**.

**Pass:** the list holds the checkout's path, badged `private`, and says `never logged`.

3. Go back to Day and re-read it.

**Pass:** the checkout is gone from **Not yet named**. A row below the list names its path and how
long it covered, and says `private — never logged`. The day's unattributed total dropped by that much.

Cases worth checking separately:

- **A directory root.** Add a link on the directory your side projects sit in, marked private. Every
  checkout under it goes private at once, and one you link to a project by its own path stays work —
  the longer path wins.
- **A conforming branch.** Check out a branch named like `feat/ABC-1-thing` inside a private
  checkout. It still proposes nothing: a private link is read before the branch grammar.
- **A project link.** Link a checkout to a project key, then press **Create a ticket** on any unnamed
  work in it. The project field is already filled in. The Start view fills it in the same way when you
  pick that repository.
- **Undo.** Remove the link in Settings and re-read the day. The time comes back as unnamed work —
  nothing was deleted, only left out.

## 17. Move, resize and add on the timeline

This writes to the local store only. Everything here is an edit to the day, and every edit is
reversible.

1. Open Day and find a row on the timeline.
2. Press its middle and drag it to another hour.

**Pass:** the block follows the pointer, snapping to the quarter hour, and lands where you dropped it.
The row's **Logs** duration is unchanged — a move says when the work happened, not how much.

3. Press the block's bottom edge and drag it down.

**Pass:** only that end moves, and the duration grows to match the new span.

4. Press empty grid and drag a range out.

**Pass:** a dashed range follows the pointer, and releasing it opens **Add an entry** over exactly
that range. The issue is pre-filled from the nearest row, and it is a picker, not a text box.

5. Type a key the picker does not list, press Enter, write a description and press **Add the entry**.

**Pass:** a row appears with a **by hand** badge, the timeline block reads `· by hand`, and the day's
total grows by what the entry logs. Expanding the row says `you added this row by hand` and reports
`observed 0m` — nothing watched it, and the day does not pretend otherwise.

6. Expand that row and press **Remove this row**.

**Pass:** the row and its block are gone, and the total is back. A row the machine proposed offers
**Reset to proposal** instead: it is still what was observed, so it is rejected rather than removed.

Cases worth checking separately:

- **The header button.** Press **Add an entry** in the header with nothing drawn. The panel opens over
  the hour that just finished.
- **A meeting.** With a calendar connected, open the panel on a day that had a meeting the timesheet
  does not hold. The meeting is offered by name, with its own times, one press away.
- **A click, not a drag.** Press empty grid and release without moving. It still drafts a range — the
  panel is where the duration is corrected anyway.
- **A story band.** On a day whose rows carry a Story, a band appears in the strip above the hour axis
  naming the story and how many rows roll up to it. Pressing it opens the first of them.

## How to report a failure

Give the section number, what you did, and what you saw. A screenshot of the window helps more than
a description. Console output helps most: open the window inspector, or read the terminal that runs
`yarn timetrack`.
