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

**Pass:** 676 unit tests and 9 e2e tests pass.

The e2e suite covers the day reconstruction, the unnamed-work card, the create-ticket draft, the sync
preview against time already in Tempo, and the week view reading that time back. It does not cover the
boundary drag or the agent call. Those still need sections 5 and 6.

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

1. Open Settings.
2. Check that Jira, Tempo and GitLab each report a connection.
3. Turn **Suggestions** on.
4. Open **New tickets** and read the two fields for the branch subject and the parent.

**Pass:** the three services report a connection, and the app stores each change without an error
banner.

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

## How to report a failure

Give the section number, what you did, and what you saw. A screenshot of the window helps more than
a description. Console output helps most: open the window inspector, or read the terminal that runs
`yarn timetrack`.
