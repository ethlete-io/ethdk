# Local APIs

`et api` runs the backend an app in your repo talks to, from a checkout on your own machine. It drives that checkout's own compose file - it never edits it.

```bash
yarn et api --help              # the commands, the APIs, and what each one accepts
yarn et api help hub            # what hub accepts, and where its checkout is
yarn et api up hub              # start the containers
yarn et api down hub            # stop them
yarn et api logs hub            # follow the log of the API container
yarn et api logs hub database   # follow the log of another service
yarn et api shell hub           # a shell in the API container
yarn et api install hub         # an entry from that API's own "exec" map
yarn et api up hub --host       # also print the address other devices can use
yarn et api checkout hub        # switch the checkout to its configured branch
yarn et api pull hub            # fetch and fast-forward the checked-out branch
yarn et api pull hub --force    # the same, discarding local commits and tracked changes
yarn et api clone hub           # clone the API into .ethlete/hub
yarn et api clear hub           # remove that clone again
yarn et api clear --all         # remove every managed clone
yarn et api setup hub           # run the API's own setupCommand, which writes its .env
```

`ethlete.apis.js` describes each API and is committed. Where the checkout lives on this machine is optional: set [`apiRepoPaths`](/cli/config) to point at a checkout you already have, or let `et` clone the API's `repoUrl` into a gitignored `.ethlete/<name>`.

## Asking what an API accepts

`yarn et api help <name>` answers for one API: every command it accepts, what each one runs, its url and services, and the state of its checkout.

```
$ yarn et api help platform

Usage: yarn et api <command> platform [--host]

Commands
  up                  Start the containers of the API
  ...
  setup               Run "make setup" in development
  install             composer install
  generate-ts-models  make generate-ts-models

This API
  url                 http://localhost:8000
  services            app, database, mailhog, elasticmq, s3mock, file-server-mock
  env file            development/.env

Checkout
  Missing .env in /repo/.ethlete/platform/development. Run "yarn et api setup platform".
```

`--help` after a known API name prints the same text, so `yarn et api up platform --help` answers for `platform` rather than for the repo.

Every message names the command you can actually type. `et` is rarely on the PATH, so the cli looks for the package script that wraps it - `yarn api` for `"api": "et api"` - and falls back to the way your package manager runs a binary, for example `npx et api`.

A name that matches no API, or a command that matches none of the API's, names the closest one:

```
$ yarn et api clone platforn

Unknown API "platforn". Did you mean "platform"?

APIs: hub, platform
```

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
| `setupCommand` | no       | Command that creates `envFile`, run by `setup` in `composeDir`.                                                       |
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
into /repo/.ethlete/hub? [Y/n]
```

Press enter and the original command continues once the clone finishes. `yarn et api clone hub` does the clone on its own, and `--clone` on any command skips the question - use it in scripts and anywhere without a terminal, where the prompt cannot be answered and the command exits instead.

The clone checks out the branch [`apiRepoBranches`](/cli/config) names, when there is one. `et` warns if `.ethlete/` is not gitignored - add it to your `.gitignore`.

::: tip A checkout you work in beats a managed one
If you commit to the backend, point `apiRepoPaths` at your own checkout. The managed clone is for people who only need the API to run.
:::

## Where the env file comes from

A fresh checkout has no `envFile` yet, and the containers cannot start without it. When it is missing and the API declares a `setupCommand`, `et api` offers to run it in `composeDir`:

```
$ yarn et api up hub

Missing .env in /repo/.ethlete/hub/development.

Run "make setup" in /repo/.ethlete/hub/development? [Y/n]
```

Press enter and the original command continues once setup finishes. `yarn et api setup hub` runs setup on its own, and `--setup` on any command skips the question - use it in scripts and anywhere without a terminal.

The command runs on the host, not in a container, so it can use the checkout's own `make setup`. Its output is kept back and only printed when it fails, so its own advice about the checkout's Makefile does not compete with the CLI. What you see instead is two lines:

```
$ yarn et api setup hub

Running "make setup" in /repo/.ethlete/hub/development.
Created .env.
```

A setup command that exits `0` and still leaves `envFile` missing is reported as a failure, with its output, rather than sending the original command into a loop.

## When a command fails

A failed clone, or a failed `exec` entry that runs a package manager such as `install`, prints what to
check: a token with permission to **download** code rather than only read it, an SSH key the host
accepts, and the token being where the package manager looks for it rather than only in your shell.
A read-only token is the common case, and the server reports it as a bare `403`. [`et auth`](/cli/auth)
writes a token that passes those checks.

Any other failed `exec` entry says nothing about tokens. It suggests running the install entry first,
because a container whose dependencies were never installed fails every other command in it.

## Container commands

| Command | What it runs                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------ |
| `up`    | Checks the ports, creates `network` if set, starts `services` detached, then prints their state. |
| `down`  | Stops and removes the containers.                                                                |
| `logs`  | Follows the log of `execService`, or of a service you name.                                      |
| `shell` | Opens `bash` in `execService`, or in a service you name.                                         |

`logs` and `shell` take a service as a third argument, so `yarn et api logs hub database` follows the database rather than the app. A name that is not in `services` is reported with the list of names that are.

### What `up` prints

The output of the container engine is kept back, and the state of every requested service is read
back and printed instead. `podman-compose` exits `0` even when it failed to build or pull an image,
so the exit code alone cannot be trusted.

```
$ yarn et api up platform

Starting platform: app, database, mailhog, elasticmq, s3mock, file-server-mock.

platform API at http://localhost:8000

  app               Up 2 minutes             8000 -> 80
  database          Up 2 minutes             8001 -> 3306
  mailhog           Up 2 minutes             8002 -> 8025
  elasticmq         Up 2 minutes             9324 -> 9324
  s3mock            Up 2 minutes             9090 -> 9090, 9191 -> 9191
  file-server-mock  Exited (1) 1 second ago  8005 -> 80

file-server-mock is not running.
Run "yarn et api logs platform file-server-mock" to see why.
```

A service that is not running makes `up` exit `1`. For a container that exited, the message names the
`logs` command for that service. For a service with no container at all, the output of the engine is
printed instead, because a failed pull or build is only reported there.

### Ports in use

Before it starts anything, `up` reads the host ports the requested services publish out of
`compose config`, and checks whether something already holds them. A project that already has
containers is left alone, because `up` then reconciles its own.

```
$ yarn et api up hub

Cannot start hub. These ports are already in use:

  8040  ea-hub-app

Stop them with "podman stop ea-hub-app", or re-run with --force to start hub anyway.
```

In a terminal it asks first, and stops those containers for you. A port that no container publishes
cannot be freed for you, so `et api` names the ports and stops. `--force` skips the whole check and
lets the engine report the conflict itself.

### `--host`

`--host` prints the address the API answers on over the local network, and the `localStorage.setItem` line to run on another device when `envKey` is set. It changes no port binding - the compose files already publish on every interface. A host firewall can still block the port.

## Checkout commands

`clone`, `checkout`, `pull` and `setup` act on the checkout rather than the containers, so they work before the API has an env file and need no container engine.

| Command        | What it does                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| `checkout`     | Switches the checkout to the branch [`apiRepoBranches`](/cli/config) names. Reports an error when none is set. |
| `pull`         | Fetches, then fast-forwards the checked-out branch.                                                            |
| `pull --force` | Fetches, then resets the branch to its remote.                                                                 |
| `setup`        | Runs `setupCommand` in `composeDir`. Only an API that declares one accepts it.                                 |
| `clear`        | Removes the managed checkout in `.ethlete/<name>`.                                                             |
| `clear --all`  | The same, for every API at once.                                                                               |

`pull` refuses to run on a checkout with uncommitted changes and tells you to commit, stash, or pass `--force`. If the checked-out branch is not the one `apiRepoBranches` names, it warns and pulls the branch you are on rather than switching for you.

::: warning `--force` discards work
`pull --force` resets to `origin/<branch>`, so local commits and changes to tracked files on that branch are gone. It never runs `git clean`, so untracked and ignored files - a `vendor/` directory, an `.env` - survive.
:::

## Removing a checkout

`clear` removes the managed checkout in `.ethlete/<name>`, so the next `clone` starts from nothing.
It asks first, and the question defaults to no. `--all` clears every API in one go.

It only ever removes a checkout `et` cloned. A path you set in
[`apiRepoPaths`](/cli/config) is your own, so `clear` refuses it and says so.

Three checks run before the question, and each one names the command that clears it:

| Check                   | Why                                                         | How to pass it            |
| ----------------------- | ----------------------------------------------------------- | ------------------------- |
| Containers are running  | Removing the checkout would leave containers with no files. | `et api down <name>`      |
| Uncommitted changes     | Those changes exist nowhere else.                           | Commit them, or `--force` |
| Commits no remote holds | Those commits exist nowhere else.                           | Push them, or `--force`   |

The refusal lists what stands in the way, so a change you do not care about is obvious at a glance:

```
$ yarn et api clear platform

platform still has containers. Run "yarn et api down platform" first.

/repo/.ethlete/platform has uncommitted changes:

  M .gitignore

Commit them, or pass --force to lose them.
```

`--force` skips the two git checks. It never skips the container check, because that one is about
the containers rather than about your work.

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
