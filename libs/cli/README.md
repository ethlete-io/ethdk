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

The token is checked against the host first: once for the token itself, and once by downloading one
byte of a project archive. A token that can read the API but not fetch code answers `403` there, and
nothing is written. `--force` writes it anyway.

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
yarn et api setup hub           # run the API's own setupCommand, which writes its .env
```

Every command takes a comma-separated list of names, and acts on each API in turn.

`checkout`, `pull` and `setup` act on the checkout itself, so they work before the API has an `.env`
and need no container engine. `pull` refuses to run on a checkout with uncommitted changes unless you pass
`--force`. `--force` resets the branch to its remote and throws away local commits and tracked
changes; it never touches untracked or ignored files, so a `vendor/` directory or a `.env` survives.

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
