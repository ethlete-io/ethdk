# Lessons from a manual month of booking

Status: recorded on 2026-09-27, not started.

Tom booked September by hand from a draft that agents built out of the Timetrack evidence. Tom
corrected the draft many times. Each correction below is a rule that the app does not know yet.
The rules belong to M2 (attribution) and M6 (the sync).

## Attribution rules

1. **A background ticket loses to project work.** The SDK ticket took about 40 % of all hours in
   the first draft. Tom wants it only for time with no project signal at all. On a day with project
   work, SDK time between 08:00 and 20:00 goes to the nearest project block.
2. **A meeting ticket is never a filler.** Meeting and PM tickets take only real meetings. When a
   day has no project work, its time stays on the background ticket.
3. **An accepted calendar event does not prove attendance.** Tom stopped attending a recurring
   meeting after a project change, but the calendar still showed it as accepted. The app needs a
   way to mark a series as "not attended". Alternatively, the app must see a call.
4. **After 20:00 and at night, only desk input counts.** Remote prompts, laptop commits and
   prompts of unclear origin do not prove work at these hours.
5. **Commits alone are not work.** Agent loops made hundreds of commits at night and at weekends
   while nobody typed. Typed prompts per hour were the best proof of presence.
6. **A weekend is one coarse row.** A weekend day gets one row with a share of its evidence
   (50 % in this draft), not a row for each prompt slot.
7. **A workday keeps its lunch gap.** A day of 6 h or more needs a break of at least 30 min
   between 11:30 and 14:30. The app fills other gaps of up to 2 h with the neighbouring project
   work, except gaps with OOO, travel or private time.
8. **Evidence that cannot split time splits it evenly.** When one piece of work belongs to several
   sibling tickets, split the time evenly and mark the split as an estimate.

## Gaps in the evidence

- **The laptop was missing.** Whole days of work happened on the laptop, and the desk PC showed
  nothing. The prompts on the laptop were the only proof. This is the M7 problem.
- **Short retention loses evidence.** The macOS `pmset` log keeps about a week. After that, the
  display on and off times are gone. A collector must read such logs early.
- **The draft itself was lost.** It lived in `/tmp` and was gone after a reboot. A draft must live
  in the app's store.

## Tooling

- The Jira `issue` op returns no status. The agent used "appears in the search for open issues"
  as a proxy and was wrong about one closed ticket. Add the status and the resolution.
- Tom named most missing tickets from memory. The app needs a fast way to map a stand-in to a key
  and to remember that mapping for the next day.
- Nothing was booked in Tempo for September before this. The manual path took one long session,
  which is the cost M6 removes.
