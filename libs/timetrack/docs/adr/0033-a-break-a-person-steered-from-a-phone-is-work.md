# A break a person steered from a phone is work

> **Amends [ADR 0028](./0028-a-break-is-the-time-away-less-what-each-prompt-bought-back.md)** for the
> prompts `promptOriginAt` reads as `remote`.

On 2026-09-23 the day drew a break from 19:00 to 20:30 with seven prompts in it, and one from 21:45 to
22:30 with three. Tom: "yes that was all phone work". ADR 0028 let those prompts buy back at most half
of each break, because the idle notifier observed nobody at the seat and the allowance was only a guess
at the attention around an instant.

A remote prompt removes the reason for the cap. The notifier's absence is explained: the person was at
another device, and the short input-idle signal of ADR 0028 is what says so.

**Inside a break, the time from the first remote prompt to the last is attended work.** The allowance
still runs backwards from a prompt, so the stretch is the first remote prompt less
`promptAttentionMs`, to the last remote prompt, clipped to the break. The half-break cap and the
`minBreakMs` floor do not limit it. What is left of the break on either side stays a break if it is at
least `minBreakMs` and is dropped otherwise, so a stretch may split a break in two. Desk and `unknown`
prompts buy back what ADR 0028 lets them, off the parts that are left.

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
  `unattended-time`.
- **A day without the signal does not change.** No input transition reads every prompt `unknown`, and
  `unknown` behaves exactly as ADR 0028 describes. 2026-09-23 itself predates the signal, so it keeps
  its drawn breaks.
- **The stretch trusts the prompts at both of its ends, and nothing between them.** Two remote prompts
  an hour apart make the hour work. That is the rule Tom chose: a person who keeps answering from a
  phone is working the whole time they do it.
- **`lastHostSampleAt` counts an input transition.** The host samples it on its own, so it proves the
  app was running just as a focus change does.
