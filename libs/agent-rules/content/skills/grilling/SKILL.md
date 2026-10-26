---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
kind: skill
scope: both
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

Format a round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.

---

Vendored from [mattpocock/skills](https://github.com/mattpocock/skills) at `3cca18b`, MIT (Copyright (c) 2026 Matt Pocock).

## Local addition: write each question so it reads alone

This section is ours, not upstream.

- **One question, one situation.** Say what the thing is and why the decision matters, in plain
  words, before the choices. The user must understand it without the earlier rounds.
- **No reference chains.** Never lean on other question numbers, ADR numbers, slice numbers or
  plan shorthand ("as Q6 settled", "per ADR 07"). Name the actual thing instead.
- **Remind the user of a concept** when a round starts a new topic: one or two sentences, with a
  concrete example ("a sketch is a draft with several variants of one part, for example three
  headers").
- **Check the facts before you recommend.** A recommendation built on an assumed file format or
  an assumed existing tool is worse than none. Look it up first, and say in the round when a
  look-up proved an earlier recommendation wrong.
- **Close with the shared state.** When the frontier is empty, list every decision in one short
  summary and ask the user to confirm it before you write it anywhere.
