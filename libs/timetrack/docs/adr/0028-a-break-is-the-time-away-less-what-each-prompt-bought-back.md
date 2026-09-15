# A break is the time away, less what each prompt bought back

> **Amends [ADR 0006](./0006-a-day-nothing-observed-is-rebuilt-from-keystrokes.md)** by restoring the
> sentence the bridge broke, and replaces the bridge with an allowance.

ADR 0006 ends with a rule the code then stopped keeping: "from an `idle-start` or a `lock` until real
input, a turn does nothing at all". On 2026-09-10 the bridge was added — an `idle-start` a turn ran
through no longer closed the stretch, and the resume took the whole wait as presence. It was measured
and it was chosen deliberately: 165 m of break became 133 m, and the 81 m lunch survived.

It is still wrong, for a reason that day could not show. An agent that runs for forty minutes makes
those forty minutes presence, whatever the person did. Tom, away from his desk on 2026-09-15 and
steering from a phone: "During the break work is still getting done. We can't just ignore that." The
day drew one unbroken block from 09:58 to 14:12, no break, no unattended time, and would have offered
every minute of it to Tempo.

**An `idle-start` ends the stretch, whatever the agent is doing.** Five minutes with no key, no mouse
and no touch is the machine saying nobody is there, and what the agent did in that time is
`unattendedMs` — the number that already exists to say work ran with nobody at it.

**Each prompt then buys its own attention back off the break**, 15 minutes, running backwards from the
prompt. A prompt is a person who read an answer and typed a reply, and that reading is real work at
whatever distance they did it.

The allowance is measured backwards because that is the side the reading is on: the answer arrived,
the person read it, and the prompt is the instant they finished. A locked break keeps no allowance —
a lock is the user saying they left, and nothing typed afterwards changes where they were before it.

**Three bounds keep the allowance honest.** Allowances that overlap are merged, so two prompts a
moment apart buy back one and not two. No break gives up more than half of itself, however many
prompts fall in it: the allowance is a guess at the attention around an instant, and when the guesses
cover a whole absence the guess is wrong — the notifier observed nobody there. And the allowance never
takes a break below `minBreakMs`. Tom, on 2026-09-15: "as per definition deduction can't be to the
point at which the break is 0m." A break the notifier observed is an absence, and a guess must not
delete it; the day's grain is a quarter hour, so a quarter hour is the least it can report.

**What is bought back shortens the break from its end; it never punches a hole in it.** A perforated
break leaves slivers that `minBreakMs` drops one by one, so a 30-minute break with a prompt at minute
1 and one at minute 29 used to vanish entirely. Tom, on 2026-09-15: "it also feels wrong to say 30m
break but a prompt was made at minute 1 and one at minute 29 so the break gets totally eliminated."

Measured on the real 2026-09-10: 215 m of break with no allowance in 4 breaks, 146 m with it
in 3, against the bridge's 133 m. The allowance lands where the bridge did without claiming a person was at a desk they
had left.

## Consequences

- **This needed the idle notifier to work at all.** Not one idle transition had ever been collected on
  Tom's machine: the app asked for `ext_idle_notifier_v1` version 1, which reports _session_
  idleness and which any idle inhibitor — a call, a video, a download — silences. Version 2's
  `get_input_idle_notification` reports input idleness, which no inhibitor can suppress. Proven on
  2026-09-15 with a 10-second threshold: v1 never fired, v2 fired in 10 seconds. Without that fix
  this ADR changes nothing on this machine, because the signal never arrives.
- **A break stops a band being drawn across a gap, and nothing more.** `barriers` in `mergeBlocks`
  bars a join over a gap; it removes no block that falls inside the break. So a break nothing ran in
  is proposed to nobody, and a break an agent ran through keeps its blocks and stays proposed.
- **The day's work is clipped to presence and to the gaps `breakGaps` returns.** This was the hole
  the rest of this ADR did not close: `stream-day` clipped the agent's spans to presence alone, so
  every block inside a break was deleted before the rows were built. The break then had no row to be
  drawn over, and `breaksBetweenRows` reported the whole row gap instead of the absence the notifier
  measured. Measured on 2026-09-15, on 1h 20m the user steered from a phone: the day booked 90 m and
  drew a 1h 15m break; it now books 165 m and draws the 40 m it measured. The clip reads the gaps
  before the allowance, not the breaks after it, so the minutes a prompt bought back are booked too.
- **A break merged into the work either side no longer raises `unattended-time`.** A group is
  attended if any attended span overlaps it, and a band that now runs through the break overlaps the
  work on both sides. The break drawn over the row is what says nobody was at the seat. This is the
  leniency `attendedAt` already documents, and it is why the row is only as honest as the prompts
  inside it.
- **A break an agent ran through is drawn over the row it runs under.** `breaksBetweenRows` reports a
  break as the gap the rows leave, and such a break leaves none, so it is snapped to the row increment
  and drawn in the break lane instead. Both ends round to the nearest boundary rather than outwards: a
  break is an absence reported back to the person who took it, and rounding it outwards claims more of
  one than the notifier saw. Tom chose this over cutting the break out of the rows, which would have
  changed what the day books. Verified on 2026-09-15: the measured break 14:26-14:43 draws 14:30-14:45.
- **The allowance is one number for every prompt, and it does not know where the prompt came from.**
  A person waiting at their desk and a person steering from a phone buy back the same 15 minutes.
  That is deliberate: nothing in a Claude Code log distinguishes them. Checked on 2026-09-15 —
  `entrypoint` is `cli` for both, `origin` is `{kind:'human'}` for both, and `promptSource` is
  `typed` or `queued`, which a desk also produces.
- **A short input-idle notification would distinguish them**, and is not built. A second
  `get_input_idle_notification` at about a minute reports only that somebody touched the seat, never
  what they touched or typed, so a prompt with local input beside it is a desk prompt and a prompt
  with none is remote. That is the universal signal for a phone, a tablet and any remote control,
  and it costs one more Wayland object.
- **`maxAgentGapMs` no longer decides a break on a machine the notifier works on.** Turns arriving
  every few seconds hold a stretch open indefinitely, which is why 2026-09-15 reported no break
  before this. The idle transition is now the only thing that cuts such a stretch, so a machine whose
  compositor offers no idle notifier still reports a day of one block.
