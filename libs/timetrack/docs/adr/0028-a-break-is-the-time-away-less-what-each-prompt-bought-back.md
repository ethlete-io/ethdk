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
whatever distance they did it. What is left has to clear `minBreakMs` again, so a wait a prompt nearly
covers is no break at all.

The allowance is measured backwards because that is the side the reading is on: the answer arrived,
the person read it, and the prompt is the instant they finished. A locked break keeps no allowance —
a lock is the user saying they left, and nothing typed afterwards changes where they were before it.

**Two bounds keep the allowance honest.** Allowances that overlap are merged, so two prompts a
moment apart buy back one and not two. And no break gives up more than half of itself, however many
prompts fall in it: the allowance is a guess at the attention around an instant, and when the guesses
cover a whole absence the guess is wrong — the notifier observed nobody there.

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
- **Tempo needs no rule of its own.** A break is a barrier in `mergeBlocks`, so no band is drawn
  across one, and a row books the time its band covers (ADR 0019). Time inside a break is inside no
  band and is therefore proposed to nobody.
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
