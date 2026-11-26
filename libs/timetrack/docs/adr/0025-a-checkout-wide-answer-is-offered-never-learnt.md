# 0025 — A checkout-wide answer is offered, never learnt

## Status

Accepted, 2026-09-14.

## Context

A repository whose branch names carry no issue key is asked about on every branch. Where the whole
checkout means one ticket, answering per branch is the wrong shape, and the usual answer — a donating
rule — hands the time to whatever else was open instead of to the ticket it belongs to.

The user had already made both halves of the answer. They linked the checkout to a Jira project, and
they logged nearly every hour of that project against one task. Nothing read the two together.

Rebuilding past days cannot supply this. A donated block keeps its own context and takes the
beneficiary's issue key, so the record of a donating checkout says where its time went, never where it
should have gone.

## Decision

`repoNamingOffers` reads the project link and the user's own Tempo history, and proposes a
repository-scoped rule where the two agree: three distinct days, sixty percent of the project's logged
time, and four hours in the project at all. The proposal is shown on the day screen with the share and
the hours it rests on, and one click writes the rule.

Nothing is written without that click. The rule is the user's decision, as `AttributionRule` states.

Taking an offer also takes back the donating rules of the branches the day saw, in one settings write.
A branch rule wins over the repository rule the offer writes, so keeping both would write a rule that
is never read.

A checkout any rule already names an issue for is never offered anything. That is a deliberate answer,
and a proposal to overwrite one is not an offer.

## Consequences

The offer reads every checkout the day saw, not only the unnamed ones. A donating checkout leaves
nothing unnamed, so a surface hung off the naming card would never show it.

Turning an offer down lasts the session. A dismissal is not a decision about the work, and writing one
into the settings would leave a standing answer there that the user never gave.

Without a Tempo token there is no history and no offer, which is every machine that has not connected
one.
