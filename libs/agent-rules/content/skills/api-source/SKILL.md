---
name: api-source
description: How to read the source of the API an app in this repo talks to, from a local backend checkout named in ethlete-agents.config.local.json. Read when a response shape, a status code, an error body, an enum or an auth rule has to be confirmed rather than guessed - and never edit that checkout as part of work in this repo.
kind: skill
scope: consumer
---

# Reading the API source

The client's types describe what the frontend _expects_. When the two disagree, the
server is right, so a question about the contract is answered in the API repository -
not by reading the frontend's own models harder.

Reach for the checkout when:

- a response arrives with a field, a shape or a `null` the frontend types do not allow
- you need the exact status code, error body or validation message for a failure path
- an enum, a permission or a filter parameter has to match the server's list exactly
- a request fails and you cannot tell whether the client or the server is wrong
- you are about to report or fix something in the API itself

Do not read it to design frontend code that the API does not serve yet. An endpoint in
the checkout is not deployed until the API team ships it.

## 1. Resolve the checkout for your app

One repository can hold several apps, each with its own API, so the paths are a map from
app to checkout. They are per machine, so the map lives in the gitignored
`ethlete-agents.config.local.json` at the repo root:

```json
{
  "apiRepoPaths": {
    "hub": "../fut-hub-backend",
    "*": "../shared-backend"
  },
  "apiRepoBranches": {
    "hub": "develop",
    "*": "main"
  }
}
```

Read that file before searching anywhere. The rules:

- **The key is the app** as this repo names it - the workspace project name, which is
  normally also the folder under `apps/`. Match the app you are working in.
- **A relative path resolves from the repo root**, not from the app folder.
- **Require an exact app key.** If several apps intentionally share one API, configure
  the explicit `"*"` fallback. Never treat an unrelated single entry as a fallback.
- **No matching entry - stop and ask.** Do not guess a sibling folder and do not clone
  the repository. Say which app you needed the API for and offer the snippet above; the
  file is gitignored, so adding it changes nothing for anyone else.

Without a checkout, fall back to what the running API tells you: the generated API
description if the project serves one (`/openapi.json`, `/swagger`, `/api/doc`), and the
real response body of the call you are debugging.

## 2. Resolve the relevant files before judging checkout state

Search by the route, field, or error you already know. Record the contract, serializer,
handler, and tests that can answer the question. Then inspect checkout state only for
those paths:

```bash
git -C <apiRepoPath> status -sb
git -C <apiRepoPath> status --short -- <relevant-paths>
git -C <apiRepoPath> diff -- <relevant-paths>
```

Unrelated dirty files are not evidence about these paths. Continue without blocking on
them. If a relevant file is dirty, distinguish the worktree implementation from the
committed or deployed behavior. Ask only when that difference changes the answer or the
user has to choose which behavior matters.

`apiRepoBranches` configures the expected branch per exact app key, with `"*"` as the
only fallback. If no branch is configured, report the current branch as context; do not
invent a blocking “development branch” requirement. A different or ahead branch matters
only when the relevant files differ in that commit range.

Use existing remote refs first. `git fetch` preserves the worktree but is not read-only:
it uses the network and mutates remote refs. Fetch only when freshness is material, and
request any approval the environment requires. Never switch, pull, stash, or reset the
checkout yourself.

## 3. The checkout is not the environment the app calls

Even a clean, current checkout is only the source. The app talks to a deployed
environment, which can lag it:

- Read the app's API base URL from its environment config, and say which environment
  your answer is about.
- When the source and the observed response disagree, **the observed response wins** for
  what the app has to handle today. Report the difference instead of writing client code
  against the newer source.

## 4. Search it, don't read it whole

The stack is whatever the API team chose, so search by the thing you already know - the
path, the field name, the error message - rather than by an expected file layout:

```bash
rg -n "api/v1/matches" <apiRepoPath> --glob '!*test*'   # the route
rg -n "kickoffAt" <apiRepoPath>                         # a field of the payload
rg -n "MATCH_NOT_FOUND" <apiRepoPath>                   # an error code you received
```

Two things to find first, because they answer most questions on their own:

- **The API description** the project generates or checks in (OpenAPI, Swagger, GraphQL
  schema, `.http` files). It is the contract, and it is cheaper to read than the code.
- **The serializer, resource or DTO** for the entity - the field list the client sees,
  which is usually a subset of the database model, and the place where a name is
  rewritten between the two.

The API's own tests describe intended behaviour more directly than the implementation:
they name the status code and the body for each case.

## 5. The checkout is read-only from here

It is a different repository with its own branch, review and release process. Never edit
it while working on a task in this repo, and never change its git state without being
asked. A fetch also needs to meet the freshness and approval conditions above.

When the fix belongs in the API, say so precisely: the endpoint, the field, and the
behaviour it should have. Then handle the API as it is today - a client workaround for a
server bug is a decision for the user, and it needs a comment naming what it waits on.
