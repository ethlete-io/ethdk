# What may leave this machine, and how

`plans/timetrack.md` locks "strictly local, the data never leaves the machine". Two decisions break
it, and they break different halves. Syncing a day between Tom's own paired machines on his own
network is one. Asking `claude -p` or `codex` to draft a ticket is the other, and it is the larger
break, because it sends text to a third party. Both are deliberate. The sentence becomes three:

- **No hosted backend of ours, and no cloud storage.** Unchanged.
- **A machine of the same person, paired by hand, on the same network, is in.**
- **A model call is in, on an explicit press, with a prompt the user read first.**

The call is a local CLI spawned through the allowlisted process runner, never an HTTP client with a
key. That is why no credential belongs in the app: it borrows the session the user already has. The
answer is stored against the day, so the same question never costs twice. This is a change to
existing behaviour, not only new code: `reasoning.enabled` is a setting today, and once it is on the
call runs during day review with no press and no preview.

What goes out is pseudonymised, not redacted. Names inside free text are replaced and the rest of
the text is kept, because a payload stripped to tokens leaves the model nothing to reason about. The
pseudonym is derived from the real name by a fixed rule over the name list, so **no map is stored**
— the name list the user maintains is the map, and the same rule reverses it. A Jira project key
prefix is a project name, so `FIFAGG-12623` goes out with a pseudonymous prefix and a real number:
masking the word "fifagg" in a title while sending that key would defeat the whole exercise.

Two rules make "transparent" real, and they are the reason to prefer this over a stronger scheme
that nobody can audit. The full prompt is shown before it goes. Every capitalised word the app does
not recognise is marked, so a new client can be added to the name list before the first send rather
than after it.

## A spec goes as a header, never as a document

A ticket is written from what the work was for, and a repository that holds written specifications
says that far better than a commit subject does. So a spec may go, under one rule: only its header.
The title, what kind of work it is, its tags, the parent issue it already names, and the section it
opens with. Between 408 and 888 characters over the ten specifications measured.

The body never goes, and the rule is not a length cap. Two reasons, and the second is the stronger
one. A whole document floods the unrecognised-word warning, which makes the one transparency rule
this decision rests on unreadable, and a warning nobody reads guards nothing. And a header is what a
ticket needs: the frame the work sits in. The body is the requirements, which the notes already
narrow to the part that was worked on.

The assignee is in the same file and is never read. A colleague's name has no place in a payload that
leaves the machine, and not reading a field is stronger than masking it: the mask is a list the user
maintains, so a name that is not on the list goes out in full.

The read is `read_spec`, a host command that can only ever return two files, under names the core
fixes, from inside one checkout. A general `read_text_file` would be a larger capability than
everything else this app grants together, and a reader could not audit what a press sends.

## Consequences

- The app meters its own model spend, on its own line, separate from the spend collected from the
  user's editor sessions. An app that reports what a day cost while it hides what it spent is not
  one this product can ship. Today its own calls pass `--no-session-persistence`, so they write no
  session log and the collector never sees them.
- Its own spend is never charged to the band it asked about. Asking about work is overhead, not the
  cost of the work, and charging it would inflate the number the whole cost goal depends on.
- `reason/payload.ts` already addresses contexts by opaque tokens and sends a repository name rather
  than an absolute path. That is half of this. No name-masking helper exists anywhere yet.
- A spec header is masked like every other payload, so a client name in a title or an opening
  section goes out in pseudonyms and its epic key goes out with a pseudonymous prefix.
- A report to the project manager is **not** pseudonymised. It goes to a colleague who knows the
  real client, and masked names would make it useless.
