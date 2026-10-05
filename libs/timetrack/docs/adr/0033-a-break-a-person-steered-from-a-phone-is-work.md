# A break a person steered from a phone is work

> **Amends [ADR 0028](./0028-a-break-is-the-time-away-less-what-each-prompt-bought-back.md)** for the
> prompts `promptOriginAt` reads as `remote`, and
> **[ADR 0019](./0019-a-row-books-the-time-its-band-covers.md)** for the part of their stretch a row in
> another lane does not book.

On 2026-09-23 the day drew a break from 19:00 to 20:30 with seven prompts in it, and one from 21:45 to
22:30 with three. Tom: "yes that was all phone work". ADR 0028 let those prompts buy back at most half
of each break, because the idle notifier observed nobody at the seat and the allowance was only a guess
at the attention around an instant.

A remote prompt removes the reason for the cap. The notifier's absence is explained: the person was at
another device, and the short input-idle signal of ADR 0028 is what says so.

**Inside a break, a run of remote prompts is attended work.** Each remote prompt claims
`promptAttentionMs` backwards from itself, clipped to the break, and allowances that touch join one
stretch: a stretch runs on while consecutive remote prompts are at most `promptAttentionMs`
(`DEFAULT_PROMPT_ATTENTION_MS`, 15 minutes) apart, and ends at the last prompt before a longer gap.
`remoteWorkWindows` draws them. The half-break cap and the `minBreakMs` floor do not limit it. What is left of the break on either side stays a break if it is at
least `minBreakMs` and is dropped otherwise, so a stretch may split a break in two. Desk and `unknown`
prompts buy back what ADR 0028 lets them, off the parts that are left.

**The day books all of it.** On 2026-09-24 Tom asked for at most an hour of phone time a day, and the
day booked each prompt's allowance up to that hour. On 2026-10-05 he prompted from the phone without a
pause from 08:37 to 10:17, and the hour left 45 minutes of that work out of Tempo. Tom: "this stinks".
A continuous phone session is real work, so the cap is gone. What the cap guarded against was idle
time between prompts far apart, and the gap rule guards that instead: a gap of more than a quarter
hour is not part of any stretch, and stays a break. `bookedRemoteWindows` splits each stretch by the
prompt that bought each part, the earlier prompt keeping an overlap, so the parts cover the stretch
exactly. On the row grid each end snaps to the nearest boundary, so the day books whole increments.

**A lock does not stop it.** A lock says the user left the desk, which is exactly what steering from a
phone needs; it does not say they stopped working. The parts a remote stretch leaves keep the lock.

**A prompt is remote only if the app watched the seat through it.** `promptOriginAt` carries the last
input transition forward, so a prompt sent while the app was closed would inherit the idle stretch it
was closed in. A restarted notifier's first transition is always `input-idle`, so only an idle stretch
that an `input-active` closes was watched from end to end. A prompt in any other stretch reads
`unknown`.

## Consequences

- **The stretch is attended in the rows.** `attendedAt` drops an instant inside an away stretch, and a
  remote prompt is always in one. `streamDay` hands `buildRows` the stretches from
  `remoteWorkWindows`, and `markAttendance` reads them beside `attendedAt`, so a band there raises no
  `unattended-time` and is not hatched.
- **A row in another lane books less than it spans.** The one exception to ADR 0019: `buildRows` puts
  the stretch and its booked parts on the row grid, each end to the nearest boundary as a drawn break
  is. A row's `durationMs` is its span less the remote time inside it that another lane's prompt
  bought — see `unbookedRemoteByRow`. `reviewDay` books the span the same way, so `proposedMs` and a
  sync leave that time out, and the band's label names it. A row the reviewer wrote by hand books its
  whole span.
- **A booked part counts on the prompt's own row, once.** A remote prompt belongs to one agent
  session, so its allowance books only on the rows in the lane of that session's checkout. Every
  other row over the same minutes, a parallel lane included, treats them as unbooked, so the day
  books each minute of a stretch once however many lanes ran. Where the prompt's lane has rows but none
  over its allowance, the allowance stays unbooked. Where the day holds no row in that lane at all,
  it books on exactly one row over it: one that names an issue before one that does not, then the
  lowest lane key, then the earliest start. How ordinary parallel work books is not decided here.
- **A day without the signal does not change.** No input transition reads every prompt `unknown`, and
  `unknown` behaves exactly as ADR 0028 describes. 2026-09-23 itself predates the signal, so it keeps
  its drawn breaks.
- **A stretch trusts each prompt for a quarter hour before it.** Two remote prompts an hour apart draw
  two quarter hours as work, and the 45 minutes between them stay a break. A day steered from the phone
  in prompts further apart than that books less than the person worked; the gap is the price of not
  booking idle time.
- **`lastHostSampleAt` counts an input transition.** The host samples it on its own, so it proves the
  app was running just as a focus change does.
