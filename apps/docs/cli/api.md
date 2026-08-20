# Local APIs

`et api` runs the backend an app in your repo talks to, from a checkout on your own machine. It drives that checkout's own compose file - it never edits it.

```bash
yarn et api --help              # the commands, the APIs, and what each one accepts
yarn et api up hub              # start the containers
yarn et api down hub            # stop them
yarn et api logs hub            # follow the log of the API container
yarn et api shell hub           # a shell in the API container
yarn et api install hub         # an entry from that API's own "exec" map
yarn et api up hub --host       # also print the address other devices can use
yarn et api checkout hub        # switch the checkout to its configured branch
yarn et api pull hub            # fetch and fast-forward the checked-out branch
yarn et api pull hub --force    # the same, discarding local commits and tracked changes
yarn et api clone hub           # clone the API into .ethlete/hub
```

`ethlete.apis.js` describes each API and is committed. Where the checkout lives on this machine is optional: set [`apiRepoPaths`](/cli/config) to point at a checkout you already have, or let `et` clone the API's `repoUrl` into a gitignored `.ethlete/<name>`.

## Declaring the APIs

`ethlete.apis.js` at the repo root exports one entry per API. It is a module rather than JSON because `env` is a function.

```js
const { sshKeyPath } = require('@ethlete/cli');

module.exports = {
  hub: {
    composeDir: 'development',
    services: ['app', 'database', 'mailhog', 's3mock'],
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

| Field          | Required | Meaning                                                                                                               |
| -------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `composeDir`   | yes      | Directory inside the checkout that holds the compose file.                                                            |
| `services`     | yes      | Services to start. Leave out anything the app does not need, such as a frontend container or a GPU-bound worker.      |
| `execService`  | yes      | Service that `shell`, `logs` and every `exec` entry run in.                                                           |
| `port`         | yes      | Published host port, not the port inside the container. Used for the printed url.                                     |
| `envFile`      | no       | File that must exist in `composeDir` before the API can start.                                                        |
| `setupCommand` | no       | Command that creates `envFile`. Named in the error when the file is missing.                                          |
| `network`      | no       | External container network created before the first `up`.                                                             |
| `envKey`       | no       | localStorage key the app reads to pick its API. Printed by `--host`.                                                  |
| `examplePath`  | no       | Example path shown in the error that asks for this API's checkout.                                                    |
| `env`          | no       | Extra environment for every compose call. An undefined value is dropped rather than passed as the string `undefined`. |
| `exec`         | no       | Named commands run in `execService`, e.g. `{ install: ['composer', 'install'] }`.                                     |

Each key of `exec` becomes a command of its own, so `yarn et api install hub` runs `composer install` inside the `app` service.

## Where the checkout comes from

`et api` looks in two places, in this order:

1. `apiRepoPaths[<name>]` in [`ethlete.config.local.json`](/cli/config), when you set it. Use this when you already have the API checked out, or when you work in it - the compose files mount the checkout into the container, so your own branch is what runs.
2. `.ethlete/<name>` in the repo root, otherwise. This is the managed checkout `et` clones for you.

When the managed checkout is missing and the API declares a `repoUrl`, `et api` offers to clone it:

```
$ yarn et api up hub

hub has no checkout at /repo/.ethlete/hub.

Clone git@gitlab.example.com:group/fut-hub-backend.git
into /repo/.ethlete/hub? [y/N]
```

Answer `y` and the original command continues once the clone finishes. `yarn et api clone hub` does the clone on its own, and `--clone` on any command skips the question - use it in scripts and anywhere without a terminal, where the prompt cannot be answered and the command exits instead.

The clone checks out the branch [`apiRepoBranches`](/cli/config) names, when there is one. `et` warns if `.ethlete/` is not gitignored - add it to your `.gitignore`.

::: tip A checkout you work in beats a managed one
If you commit to the backend, point `apiRepoPaths` at your own checkout. The managed clone is for people who only need the API to run.
:::

## When a private dependency will not download

A failed clone, or a failed `exec` entry such as `install`, prints what to check: a token with permission to **download** code rather than only read it, an SSH key the host accepts, and the token being where the package manager looks for it rather than only in your shell. A read-only token is the common case, and the server reports it as a bare `403`.

## Container commands

| Command | What it runs                                                                                |
| ------- | ------------------------------------------------------------------------------------------- |
| `up`    | Creates `network` if set, starts `services` detached, then prints the url and `compose ps`. |
| `down`  | Stops and removes the containers.                                                           |
| `logs`  | Follows the log of `execService`.                                                           |
| `shell` | Opens `bash` in `execService`.                                                              |

`up` prints `compose ps` on purpose: `podman-compose` exits `0` even when it failed to build or pull an image, so the state has to be read back rather than inferred from the exit code.

### `--host`

`--host` prints the address the API answers on over the local network, and the `localStorage.setItem` line to run on another device when `envKey` is set. It changes no port binding - the compose files already publish on every interface. A host firewall can still block the port.

## Checkout commands

`clone`, `checkout` and `pull` act on the git checkout rather than the containers, so they work before `setupCommand` has run and need no container engine.

| Command        | What it does                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| `checkout`     | Switches the checkout to the branch [`apiRepoBranches`](/cli/config) names. Reports an error when none is set. |
| `pull`         | Fetches, then fast-forwards the checked-out branch.                                                            |
| `pull --force` | Fetches, then resets the branch to its remote.                                                                 |

`pull` refuses to run on a checkout with uncommitted changes and tells you to commit, stash, or pass `--force`. If the checked-out branch is not the one `apiRepoBranches` names, it warns and pulls the branch you are on rather than switching for you.

::: warning `--force` discards work
`pull --force` resets to `origin/<branch>`, so local commits and changes to tracked files on that branch are gone. It never runs `git clean`, so untracked and ignored files - a `vendor/` directory, an `.env` - survive.
:::

## Container engines

The first tool that answers `<compose> version` is used, in this order:

1. `docker compose`
2. `container compose`
3. `podman-compose`
4. `podman compose`

Podman needs two things that are passed for you, so the API checkout stays untouched. `--podman-run-args=--security-opt label=disable` keeps SELinux from denying the container access to a bind mount that carries the host's own label, which happens whenever a compose file mounts a checkout without `:z`. A generated `registries.conf` pins the unqualified search registry and turns off the short-name prompt, which podman would otherwise need a TTY for.

## Calling it from your own script

`runApiCommand` is exported, for a repo that would rather not use the `et api` discovery convention:

```js
const { runApiCommand } = require('@ethlete/cli');

runApiCommand({
  apis: require('./my-apis'),
  argv: process.argv.slice(2),
  invocation: 'yarn api',
}).then((code) => {
  process.exitCode = code;
});
```

`runApiCommand` is async because it may ask before cloning a missing checkout.

`invocation` only changes the usage line, so the help text names the command your users actually type.
