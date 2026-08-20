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

## `et api`

Runs the API an app in this repo talks to, from a checkout on your own machine.

```bash
yarn et api up hub          # start the containers
yarn et api down hub        # stop them
yarn et api logs hub        # follow the API's log
yarn et api shell hub       # a shell in the API container
yarn et api install hub     # an entry from that API's own "exec" map
yarn et api up hub --host   # also print the address other devices can reach
```

The first container tool that answers is used, in this order: `docker compose`,
`container compose`, `podman-compose`, `podman compose`.

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

The paths differ per machine, so they live in a gitignored `ethlete.config.local.json` at the
repo root. `@ethlete/agent-rules` reads the same file, so its skills and `et` agree on where a
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
