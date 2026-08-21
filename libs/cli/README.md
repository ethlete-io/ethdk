# @ethlete/cli

Repo tooling - installs the `et` binary.

## Installation

```bash
yarn add --dev @ethlete/cli
```

## `et release`

```bash
yarn et release
```

Turns pending changesets into a tagged, pushed release commit (version → tag → commit → push).

## `et auth`

Writes a GitLab token into composer's `auth.json`, so a private PHP dependency can be downloaded.
The compose file of each API mounts `$HOME/.composer` into its container, so this is the token the
composer inside the container reads.

```bash
yarn et auth glpat-xxxxxxxxxxxxxxxxxxxx                     # the host comes from ethlete.apis.js
yarn et auth gitlab.example.com glpat-xxxxxxxxxxxxxxxxxxxx  # name it when more than one is in use
```

The host may be written as a url. Only its host name is used.

The token is checked against the host first: once for the token itself, and once with the request
`git clone` makes for a private dependency. A token that can read the API but not fetch code answers
`403` there, and nothing is written. A token the file already holds for that host is replaced only
after a question. `--force` skips both.

## `et update`

Moves this repo's `@ethlete/*` dependencies to a newer version and runs the migrations those versions
ship.

```bash
yarn et update --check                    # what would change; exits 1 while an update is pending
yarn et update                            # bump, install, run the codemods, report the rest
yarn et update core                       # only @ethlete/core
yarn et update --tag latest               # leave the prerelease line
yarn et update core --to 5.0.0-next.55    # an exact version for the package you name
yarn et update --continue                 # finish a run that stopped
yarn et update --ai                       # hand every agent-assisted task to an agent
```

The target follows the dist tag the installed version is on, so a repo on a `-next` prerelease stays
on `next`. The working tree must be clean, because the codemods rewrite files; `--force` skips that
check.

The install runs before the migrations are read, because the migrations of a version ship inside that
version. A run that stops leaves `.ethlete/update/pending.json` behind, and `--continue` picks it up -
starting over would skip every migration the stopped run had not reached.

Everything a codemod cannot decide is written to `.ethlete/update`: `tasks.md` for you, `tasks.json`
for an agent, and one file per task holding the instructions the package ships. A task is `manual` (it
needs a decision), `assisted` (written as a prompt for an agent) or `unsupported` (a codemod this repo
has no Nx to run, with the command to run it by hand).

`--ai` hands each assisted task to the command in `updateAgentCommand` in
`ethlete.config.local.json`, one run per task. No agent is detected automatically.

A package declares its migrations in `migrations.json` at its own root, pointed at from `package.json`
with `"ethlete": { "migrations": "./migrations.json" }`. The full format is on the docs site.

## `et api`

Runs the API an app in this repo talks to, from a checkout on your own machine.

```bash
yarn et api --help              # the commands, the APIs and what each one accepts
yarn et api help hub            # what hub accepts, and where its checkout is
yarn et api up hub              # start the containers
yarn et api up hub,platform     # the same, for both APIs
yarn et api down hub            # stop them
yarn et api logs hub            # follow the API's log
yarn et api shell hub           # a shell in the API container
yarn et api install hub         # an entry from that API's own "exec" map
yarn et api up hub --host       # also print the address other devices can reach
yarn et api checkout hub        # switch the checkout to the branch apiRepoBranches names
yarn et api pull hub            # fetch and fast-forward the checked-out branch
yarn et api pull hub --force    # the same, discarding local commits and tracked changes
yarn et api clone hub           # clone the API into .ethlete/hub
yarn et api clear hub           # remove that clone again
yarn et api clear --all         # remove every managed clone
yarn et api setup hub           # run the API's own setupCommand, which writes its .env
```

Every command takes a comma-separated list of names, and acts on each API in turn.

`clone`, `checkout`, `pull`, `setup` and `clear` act on the checkout itself, so they work before the
API has an `.env` and need no container engine. `pull` refuses to run on a checkout with uncommitted
changes unless you pass `--force`. `--force` resets the branch to its remote and throws away local
commits and tracked changes; it never touches untracked or ignored files, so a `vendor/` directory or
a `.env` survives.

`clear` removes a managed checkout in `.ethlete/<name>`, and only that one: a path you set in
`apiRepoPaths` is your own. It asks one question for every API you named, takes their containers down
first, and refuses a checkout that holds uncommitted changes or commits no remote holds. `--force`
skips those two git checks.

Before it starts anything, `up` reads the host ports the requested services publish and checks
whether something already holds them. In a terminal it offers to stop the containers that hold them.
`--force` skips the check and lets the engine report the conflict itself.

The first container tool that answers is used, in this order: `docker compose`,
`container compose`, `podman-compose`, `podman compose`.

## `et doctor`

```bash
yarn et doctor
```

Checks `ethlete.config.local.json`, reports the container engine it would use, and resolves every
API declared in `ethlete.apis.js`. It exits non-zero when it finds a problem, so CI can run it.

### Declaring the APIs

`ethlete.apis.js` at the repo root describes each API's compose setup. It is a module rather
than JSON because `env` is a function:

```js
const { sshKeyPath } = require('@ethlete/cli');

module.exports = {
  hub: {
    composeDir: 'development',
    services: ['app', 'database', 'mailhog'],
    execService: 'app',
    port: 8040,
    envFile: '.env',
    setupCommand: 'make setup',
    network: 'shared-fut',
    envKey: 'hubApiEnv',
    examplePath: '../fut-hub-backend',
    env: () => ({ SSH_PRIVATE_KEY: sshKeyPath() }),
    exec: {
      install: ['composer', 'install'],
      'reset-db': ['make', 'reset-db-with-dev-fixtures'],
    },
  },
};
```

Adding an API is an entry in this map. Nothing else changes.

### Where the checkouts live

Give an API a `repoUrl` and `et api` clones it into a gitignored `.ethlete/<name>` when you have no
checkout of your own, asking first (or use `--clone`). To point at a checkout you already have - which
you want whenever you work in the backend, since compose mounts it into the container - set
`apiRepoPaths` in a gitignored `ethlete.config.local.json` at the repo root. `@ethlete/agent-rules` reads the same file, so its skills and `et` agree on where a
checkout is:

```json
{
  "sdkSourcePath": "/absolute/path/to/ethlete-sdk",
  "apiRepoPaths": { "hub": "../fut-hub-backend", "*": "../shared-backend" },
  "apiRepoBranches": { "hub": "develop", "*": "main" }
}
```

Matching is exact; `"*"` is an explicit shared fallback. A relative path resolves from the repo
root. These keys used to live in `ethlete-agents.config.local.json`, which is still read as a
fallback with a warning. Add `ethlete.config.local.json` to your `.gitignore`.

## Documentation

Full command reference on the docs site:

- [Overview & usage](https://ethlete-sdk-docs.web.app/cli/)
- [Updating the SDK](https://ethlete-sdk-docs.web.app/cli/update)
