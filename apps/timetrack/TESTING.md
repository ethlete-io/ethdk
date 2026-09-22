# Testing timetrack

Section 0 is the automated check. Run it first — it is faster, and it catches what it covers.

The numbered sections after it are the manual check. They hold only what no automated layer drives:
your own Jira and Tempo, real git and GitLab, a real agent CLI, and the desktop itself. A person works
through them from the top. Each step has one action and one pass condition. Write down the number of
any step that fails, and what you saw.

## 0. The automated check

```bash
export NX_NO_CLOUD=true
npx nx run-many -t lint build test -p timetrack timetrack-app
npx nx e2e timetrack-e2e
npx nx run timetrack-app:test-rust
```

The e2e run starts the app on port 4211 with `main.e2e.ts`, which swaps the desktop host for
in-memory fakes. There is no Tauri, no network and no keychain in that run. Every answer comes from
`apps/timetrack/src/e2e/world.ts`, so the suite is safe to run at any time and writes nothing.

To look at the fake app yourself, run `npx nx serve timetrack-app --configuration=e2e` and open
`http://localhost:4211`.

**Pass:** 2225 unit tests (`timetrack`; `timetrack-app` has no unit target), 289 e2e tests and 182
`cargo test` tests pass.

### Coverage

The spec files are in `apps/timetrack-e2e/src/`.

| Section | Flow                               | Layer                     | Covered by                                                                                                                     | Not covered                                                                                                  |
| ------- | ---------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1, 2    | Start the app, know what writes    | Documentation             | —                                                                                                                              | —                                                                                                            |
| 3       | Settings                           | e2e, manual               | `masked-names`, `project-paths`, `glab-instance`, `google-disconnect`, `epic-sibling`, `stand-in-ageing`                       | Connection to your instance, the Projects picker, File as, A parent may be, Branch-subject field, the switch |
| 4       | The day view                       | e2e                       | `day-review`, `day-streams`                                                                                                    | —                                                                                                            |
| 5       | The row boundary                   | e2e, manual               | `lane-packing` (keyboard on the handle), `row-actions` (reset)                                                                 | The pointer drag                                                                                             |
| 6       | Ask for suggestions                | e2e, manual               | `day-review` (fake agent: no answer, Ask again, spend), `agent-candidates`                                                     | The real CLI, Always log here, No tickets here                                                               |
| 7       | Create a ticket                    | e2e, manual               | `day-review`, `new-parent`, `ticket-spec`, `stand-in-match`, `stand-in-auto`                                                   | The Project field, a draft from a real day, your instance's fields                                           |
| 8       | The week view                      | e2e, manual               | `week-review` (the seeded day's line)                                                                                          | Seven days                                                                                                   |
| 9       | Defects already found              | Documentation             | `sync`, `week-review`, `libs/timetrack/src/lib/tempo/diff.spec.ts`                                                             | —                                                                                                            |
| 10      | The sync preview and write         | e2e, manual               | `sync`, `sync-write`, `week-review`                                                                                            | Your own Tempo account                                                                                       |
| 11      | Sources and Host                   | e2e, manual               | `sources`, `host-title-repair`                                                                                                 | Real collectors, the Host cursors                                                                            |
| 12      | Week view reads Tempo              | e2e                       | `week-review`                                                                                                                  | —                                                                                                            |
| 13      | Branch repair                      | e2e, manual               | `branch-repair`                                                                                                                | Real git, step order, a dirty tree, an open merge request                                                    |
| 14      | Start a piece of work              | e2e, manual               | `work-start`                                                                                                                   | Real git and GitLab, a dirty tree, a story with no branch, an unpushed parent                                |
| 15      | Editor heartbeats                  | e2e, manual               | `sources` (the editor row), `day-streams` (a heartbeat names the checkout and directory)                                       | The real extension, port and file, focus, restart, pause, a rule                                             |
| 16      | Work versus private use            | e2e, manual               | `unnamed-focus`, `agent-cursor-privacy` (a seeded private link)                                                                | Not work, the Directories list, the private row, roots, project links, undo                                  |
| 17      | Move, resize, add on the timeline  | e2e, manual               | `row-resize`, `excluded-cut`, `manual-entry`, `row-actions`, `issue-picker`, `lane-packing`, `row-marking`, `meeting-offers`   | The move, a range on empty grid, the day total, a click, a story band                                        |
| 18      | Lock and PAM, tray, widget, idle   | e2e, `cargo test`, manual | `window-lock` (tray text on lock, a lock read that fails stays locked); `lock.rs`, `lock_linux.rs`, `pause.rs`, `placement.rs` | The OS lock signal, the password check, the tray, the widget, the idle notifier, decorations                 |
| —       | Store, pause, migrations, recovery | `cargo test`              | `store.rs`, `db.rs`, `pause.rs`, `recovery.rs`                                                                                 | Retention and compaction                                                                                     |

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

The e2e suite drives the tabs against a fake instance. What stays manual is your own instance.

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

Automated: `day-review.spec.ts` and `day-streams.spec.ts`.

## 5. The row boundary drag

`lane-packing.spec.ts` moves the handle by keyboard, and `row-actions.spec.ts` covers **Reset to the
proposal**. The pointer drag stays manual.

1. Find two rows that follow each other.
2. Press the boundary between them and drag it.
3. Release it.

**Pass:** the split lands where you dropped it. The two rows keep the same total as before.

## 6. Ask for suggestions

`day-review.spec.ts` presses the button against a fake agent. The real CLI and the answers to a
suggestion stay manual. You need Suggestions on from section 3.

1. Open **Debug**, then **Waiting for a name**.
2. Press **Ask for suggestions**.
3. Wait. The call runs a local agent CLI, so it takes a few seconds.

**Pass:** a suggestion appears against at least one context. It reads as a weak answer, and the app
does not log it on its own.

**Also check:** press **Always log here** on a suggestion you agree with. The app stores it as a
rule. Press **No tickets here** on a context you want ignored.

## 7. Create a ticket

`day-review.spec.ts` and `new-parent.spec.ts` cover the empty parent, the drafted summary and
description, the parent list and the write to Jira. Check the rest against a real day. This step is
safe up to the last button.

1. In **Waiting for a name**, press **Create a ticket**.
2. Read the drafted **Summary** and **Description**.
3. Check the **Project** field.

**Pass:**

- The summary reads like the work, not like a file path or a window title.
- The **Project** field names the project the work belongs to.

**Do not press "Create in Jira"** unless you accept a real ticket. Press **Close** instead.

Two questions to answer against your instance while the form is open:

1. Which Jira field holds the branch subject?
2. Does your instance let a parent be set through the parent field?

## 8. The week view

`week-review.spec.ts` reads the seeded day's line.

1. Open Week.
2. Press **This week**.

**Pass:** seven days appear. Each day that saw work shows a duration.

## 9. Defects already found — do not report these again

Both are fixed. They are kept here so a report of the same symptom can be matched against them.

### 9.1 A day logged in Tempo by hand still read as unfinished — fixed

The week view said a day needed work, although Tempo already held that day's time. `dayReviewGap`
read the local ledger alone, and the ledger records only what **this app** wrote.

The Sync preview now writes down what Tempo holds for the day, per issue. The week view and the
end-of-day reminder reduce every row by that record before they say a day is behind, which is the same
reduction a sync plans. Neither view asks Tempo, so both still work with no token and no network.

The record is only as fresh as the last preview. A day you have never opened Sync on has no record,
and still reads as unsynced. `week-review.spec.ts` checks it.

### 9.2 A sync logged the same hour twice — fixed

`planTempoSync` listed foreign worklogs under "Already in Tempo" but never subtracted them, so a day
you logged by hand planned a second copy of every hour.

`planTempoSync` now reduces every syncable proposal by the time Tempo already holds for the same
issue. A row Tempo covers in full writes nothing. An app-owned row that foreign time covers is
deleted, which keeps the day's total right. Foreign worklogs are still never edited or deleted.

`libs/timetrack/src/lib/tempo/diff.spec.ts` checks the subtraction. `sync.spec.ts` and
`week-review.spec.ts` check the preview and the **Counted against this day** banner.

## 10. The Sync view, read only

`sync.spec.ts` and `sync-write.spec.ts` cover the preview, the write, the second run that writes
nothing, and a refused token. What stays manual is your own account. The preview writes nothing.

1. Open Sync.
2. Choose a day whose time you logged in Tempo by hand, and read the preview.

**Pass:** the **Already in Tempo** section lists the time the account holds, and the preview creates
nothing for it.

## 11. Sources and Host

`sources.spec.ts` covers every state the screen can report, against a fake host that watches nothing.
On a real machine:

1. Open Sources. Read what each collector sees.
2. Open Host. Read the store and its cursors.

**Pass:** the collectors this machine has report `collecting`, and the cursors carry a recent time.

## 12. The week view reads what Tempo already holds

Automated: `week-review.spec.ts`.

## 13. Repair a branch that names no issue

`branch-repair.spec.ts` covers the offer, the steps with their undo, and the banner, against a fake
git. This section runs it for real: it renames a branch and writes to GitLab.

**Do not run this against a branch you care about.** Make a throwaway branch first:

```bash
git switch -c feat/throwaway-repair-check
git push -u origin feat/throwaway-repair-check
```

Work on it for a few minutes, so the day observes it. Then:

1. Open the day in Day.
2. In **Waiting for a name**, press **Create a ticket** for that branch.
3. Press **Create in Jira**. This files a real ticket.
4. Press **Show me the steps**.

**Pass:** the last step deletes the old branch from the remote, and it is last.

5. Press **Run these steps**.

**Pass:** `git branch` shows the new name locally.

Two cases worth checking separately:

- **A dirty working tree.** Change a file, then open the repair. It must refuse and offer no button.
- **An open merge request.** Open one from the branch, then repair. The branch must keep its name,
  only the merge request title gains the key, and the reason must say why.

## 14. Start a piece of work

`work-start.spec.ts` covers the plan, the nesting under a story, the refusal of an empty summary and
the banner, against a fake git and GitLab. This section files a real ticket, creates a real branch
and opens a real merge request.

**Do not run this in a repository you care about.** Use a throwaway clone, or be ready to delete
what it creates. The plan names everything it will do before anything runs.

1. Open **Start**.
2. Pick a repository, type the project key and a summary.
3. Press **Run these steps**.

**Pass:** `git branch` agrees with the banner, and the merge request opens in GitLab as a **draft**
with the issue linked.

Cases worth checking separately:

- **A dirty working tree.** Change a file, then reload the view. It must refuse and offer no button.
- **A story with no feature branch.** Pick one. It must refuse and say to start the story first.
- **A parent branch that was never pushed.** It must refuse and say to push the parent first.

## 15. Editor heartbeats

`sources.spec.ts` covers which editors hold the reporter and the install. `day-streams.spec.ts` covers
a heartbeat naming the checkout and the directory. The real extension stays manual. This writes
nothing outside this machine. It needs the VS Code extension installed — see
`apps/timetrack-vscode/README.md`.

1. Start the app, then open Sources and read the **Editor heartbeats** row.

**Pass:** the row says which port it is listening on and names the file a reporter finds it through.
With no extension installed it says no reporter has connected yet.

2. Run `npx nx install timetrack-vscode`, then restart VS Code and open a file in any git checkout.
3. Wait a minute, then read the row again.

**Pass:** the row names `vscode` and the time it last posted, and the stored count is above zero.

4. Open Day and find the stretch you were editing in.

**Pass:** the block names the checkout and the branch.

Cases worth checking separately:

- **Focus.** Move to another application for two minutes with the editor still open. The reporter
  posts nothing for that stretch: the last-posted time in Sources stops moving.
- **A restarted app.** Quit the app and start it again, leaving VS Code running. Within a minute the
  row names `vscode` again — the extension re-reads the file after the refused token.
- **The pause.** Press **Pause collection** in the tray, edit for a few minutes, then resume. Nothing
  is stored for the paused stretch, and Sources reports no refused posts. A pause drops what arrives
  rather than rejecting it.
- **A rule.** Add a title-pattern exclusion rule matching a checkout's name, then edit in it. Nothing
  is stored for that checkout, and the row counts the denial.

## 16. Work versus private use

`unnamed-focus.spec.ts` and `agent-cursor-privacy.spec.ts` seed a private link and check what it
hides. The button and the Directories list are not driven. This writes nothing outside this machine.
It needs a git checkout you do not bill for.

1. Work in that checkout for a few minutes, then open Day.

**Pass:** the checkout appears under **Waiting for a name**, with a **Not work** button beside it.

2. Press **Not work**, then open Settings → **Projects** and read **Directories**.

**Pass:** the list holds the checkout's path, badged `private`, and says `never logged`.

3. Go back to Day and re-read it.

**Pass:** the checkout is gone from **Waiting for a name**. A row below the list names its path and
how long it covered, and says `private — never logged`. The day's unattributed total dropped by that
much.

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

`row-resize.spec.ts` drags both ends. `excluded-cut.spec.ts` draws a range that opens the entry
panel. `manual-entry.spec.ts` adds a row by hand and removes it, and `row-actions.spec.ts` offers the
reset on a proposed row instead. The rest stays manual. This writes to the local store only, and
every edit is reversible.

1. Open Day and find a row on the timeline.
2. Press its middle and drag it to another hour.

**Pass:** the block follows the pointer, snapping to the quarter hour, and lands where you dropped it.
The row's **Logs** duration is unchanged — a move says when the work happened, not how much.

3. Press empty grid and drag a range out.

**Pass:** a dashed range follows the pointer, and releasing it opens **Add an entry** over exactly
that range. The issue is pre-filled from the nearest row.

4. Pick an issue, write a description and press **Add the entry**.

**Pass:** the day's total grows by what the entry logs. Expanding the row says
`you added this row by hand` and reports `observed 0m`.

Cases worth checking separately:

- **A meeting.** With a calendar connected, open the panel on a day that had a meeting the timesheet
  does not hold. The meeting is offered by name, with its own times, one press away.
- **A click, not a drag.** Press empty grid and release without moving. It still drafts a range — the
  panel is where the duration is corrected anyway.
- **A story band.** On a day whose rows carry a Story, a band appears in the strip above the hour axis
  naming the story and how many rows roll up to it. Pressing it opens the first of them.

## 18. The desktop host

`window-lock.spec.ts` covers what the tray says once the window locks, and a lock read that fails
staying locked. `cargo test` covers the lock timing, the pause and the stored window placement. The
desktop itself stays manual.

1. Leave the machine alone. The idle notifier reports idleness at five minutes, and the window locks
   a minute after that.

**Pass:** the window shows the lock. The tray reads `Locked` and names neither the work nor the
hours.

2. Unlock with a wrong password, then with your account password.

**Pass:** the wrong one is refused. The right one shows the day.

3. Lock the session from the desktop, then unlock it.

**Pass:** the window is locked when the session comes back.

4. Close the window, then press **Show Timetrack** in the tray.

**Pass:** the tray keeps reporting the day while the window is hidden. The window comes back at the
size it was closed at.

5. Open the widget.

**Pass:** it sits in the bottom-right corner of the monitor the app is on, where the compositor lets
it, and it shows the same readout as the tray.

6. Open Day for the stretch you were away in step 1.

**Pass:** the break covers the time you were away.

7. Read the window's title bar.

**Pass:** it offers only the controls the window manager honours. On niri there is no minimise.

## How to report a failure

Give the section number, what you did, and what you saw. A screenshot of the window helps more than
a description. Console output helps most: open the window inspector, or read the terminal that runs
`yarn timetrack`.
