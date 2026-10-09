# Auto mode runs the model without a press

ADR 0013 lets a model call out "on an explicit press, with a prompt the user read first", and the
roadmap adds that its answer is never above `weak`, never becomes a rule without a click, and never
writes the naming store. Auto mode breaks the first two on purpose: with it on, Timetrack names the
day by itself. Tom decided this on 2026-09-28.

**Turning auto mode on is the consent.** While it is on, a model runs without a press and without a
preview, on each new unnamed band and each open stand-in of the current day. Where the match finds
an existing issue, auto mode applies it as a `local` action, at the confidence the match gives, not
capped at `weak`. Where nothing matches, it drafts a ticket and picks its epic, and the create waits
in the approval queue as an `external` action. A band two rungs disagree about (ADR 0012) is settled
the same way a match is applied, once per pair of answers, and an unsure answer leaves it. An issue
Jira has in its done category is never applied by itself: a match or a dispute choice that names one
leaves the band to the user, and a stand-in's match on one waits in the approval queue, marked done,
whatever the class short of `human-only`. A band or stand-in is asked again when the evidence its answer was built
from changes (a new commit, merge request or session title, not a band that only grew longer), while
that answer is still auto mode's: no create of it approved, no apply of it approved or rejected, and
no row of the band named by hand. The new answer expires what the old one left waiting, and so does a
rule or a match that names the band. With auto mode off, ADR 0013 holds unchanged.

**"Ask auto mode again" is a press.** A band's context menu offers it on an unnamed row, a row auto
mode named, and an open stand-in, but never on a row whose issue the user set by hand: they reset it
first. The press is the consent for that one subject, so it works with auto mode off and on the day on
screen, past days included. It asks even though the evidence did not change, through the same ask:
the same masking, the new answer replaces the stored one, and what the old one left waiting expires.

What stays:

- **Pseudonymisation is unchanged.** Every call masks names as ADR 0013 and 0023 decide. The prompt a
  press would have shown is kept with the answer, so the user can still read what left the machine.
- **The Tempo sync is a human press.** No auto mode action writes to Tempo, and "Approve all" never
  includes `tempo.sync` or `tempo.delete`.
- **A human edit wins.** Auto mode writes a field only through `mayAutoWrite`; a field whose source is
  `human` is never written. A reset in the UI is the only way back to `auto`.
- **The naming store is a human click.** Auto mode never writes a remembered meeting or call name
  (`nameMeeting`, `nameCall`), so a model answer still never becomes a rule by itself. An unnamed call
  it asks about gets the issue as an `auto` field on that one row, never as a remembered `nameCall`.
- **Only the current day.** Auto mode acts on today. A past day changes only on a press, because a
  past day may already be in Tempo and the user reviewed it as it stands. One exception: the worklog
  description of a ticket a standing rule or a background project names waits until its day is over,
  and is then written once per ticket, only while Tempo holds nothing of that day.

The roadmap sentence "the agent endpoint lists stand-ins and writes none" was stale before this: the
endpoint has `jira.create`, `worklog.add`, `standIn.remove`, `standIn.rename`, `standIn.split` and
`tempo.sync`. It becomes: every endpoint write waits in the approval queue, and a locked app answers
no op.

## Consequences

- Every `local` action auto mode takes shows as `auto` on its field and has an undo.
- A drafted parent needs a stored slot with a source, and a stand-in the user reopened needs a way
  back to `auto`. `day.rows` reports the sources, so an agent can tell a human value from an auto one.
- Auto mode spends model calls on its own. The answer is stored against the day with the payload it
  sent, so a band is asked again only when that payload's evidence changes while the answer is still
  auto mode's.
