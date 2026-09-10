# The branch slug names the epic, not the issue

Neither of Tom's two bracket-challenge branches carries a Jira key, so `parseBranch` names nothing
and three rungs of the ladder miss. The obvious repair is a rule that maps a branch slug to an
issue. That is wrong, and it was measured on real tickets: `spec/20260819_bracket-challenge` in
`fifagg/specs` books to FIFAGG-12623, and `feature/20260819_bracket-challenge` in
`fifagg/fifagg-frontend` books to FIFAGG-12624. The slug is identical. What it identifies is their
shared parent, the epic FIFAGG-12605.

So the ladder reads the slug to find the **epic**, and the epic plus the checkout to find the
**task**. The checkout is what cuts one task from its sibling, which ADR 0001 already makes the
identity of a stream. Tom could not say where the specification work ends and the implementation
work begins, and under this rule he never has to.

The rung reads the slug first and the sibling second. The slug is a string operation with no
lookup, so it works offline and it works the first time. The sibling is what turns a slug into a
key: the epic is the parent of the task another checkout of the same slug already books to. With no
named sibling the app knows the two checkouts belong together and nothing more, and it asks.

## Consequences

- This is also the answer to "which epic" when a ticket has to be drafted. A new ticket is worth
  offering when the epic is known and no child of it belongs to this checkout.
- No slice may rely on a branch naming convention. Tom's own words, on 2026-09-08: "just pure chaos
  style development aka the hardest case for the software". The slug rung is a match between two
  checkouts, never a parse of a house style.
