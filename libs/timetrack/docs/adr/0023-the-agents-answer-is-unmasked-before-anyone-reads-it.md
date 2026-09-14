# The agent's answer is unmasked before anyone reads it

ADR 0013 decided what leaves this machine and how: names inside free text are replaced by pseudonyms
derived from the name list by a fixed rule, no map is stored, and the list is the map. It wrote the
outbound half only. Once the app files the answer as a Jira ticket, the return path has to be decided
too, and Tom decided it on 2026-09-14: only the agent sees pseudonyms.

So the masking is one-way for the agent and invisible to everyone else. The app masks the request, the
agent answers with placeholders, the app reverses the rule over the answer, and the form shows real
names. Jira gets real names, because the ticket lands in the client's own instance where a masked name
would be absurd. A report to the project manager already carried real names under ADR 0013, for the
same reason.

Three rules make the reverse safe:

- **A placeholder the request never sent is never replaced.** It stays in the text, visible, exactly as
  `writeTicketWithAgent$` (`ticket/write.ts:166`) already drops an issue key the request never offered.
  The user reads it in the form before anything is filed.
- **The reverse runs on the answer, never on the prompt preview.** The preview shows what leaves the
  machine. That is the promise ADR 0013 makes, and un-masking the preview would break it.
- **The derivation must be one-to-one over the name list.** Two real names that derive one pseudonym
  cannot be restored, so the app checks injectivity when a name is added rather than at send time.

Masked text is never stored. The answer stored against the day is the restored one, because that store
is local.

## Consequences

- **The name list is grown by hand**, with ADR 0013's existing rule prompting: every capitalised word
  the app does not recognise is marked before the send. One seed costs nothing — the Jira project names
  `fetchJiraProjects$` already fetches. Client names are what matter, and they are exactly the project
  names.
- **The address book stays out.** It is the largest privacy surface available here, and no part of this
  needs it.
- **Free text the user writes is masked too.** A stand-in name is a title the user typed and may hold a
  client's name, so it goes out pseudonymised like any other. It is never pruned by retention, because
  it is a setting rather than an event.
- ADR 0013 ends with "no name-masking helper exists anywhere yet". This builds both directions at once:
  the reverse is the same function reading the list the other way.
