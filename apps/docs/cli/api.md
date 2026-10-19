# Local APIs

`et api` runs the backend an app in your repo talks to, from a checkout on your own machine. It drives that checkout's own compose file - it never edits it.

```bash
yarn et api --help              # the commands, the APIs, and what each one accepts
yarn et api help hub            # what hub accepts, and where its checkout is
yarn et api up hub              # start the containers
yarn et api up hub,platform     # the same, for both APIs
yarn et api down hub            # stop them
yarn et api logs hub            # follow the log of the API container
yarn et api logs hub database   # follow the log of another service
yarn et api shell hub           # a shell in the API container
yarn et api exec hub app -- ls  # one command in a service, no TTY
yarn et api install hub         # an entry from that API's own "exec" map
yarn et api up hub --host       # also print the address other devices can use
yarn et api checkout hub        # switch the checkout to its configured branch
yarn et api pull hub            # fetch and fast-forward the checked-out branch
yarn et api pull hub --force    # the same, discarding local commits and tracked changes
yarn et api clone hub           # clone the API into .ethlete/hub
yarn et api clear hub           # remove that clone again
yarn et api clear --all         # remove every managed clone
yarn et api setup hub           # run the API's own setupCommand, which writes its .env
yarn et api seed hub            # list the seeds in .ethlete/seeds/hub/seeds.json
yarn et api seed hub demo,shop  # run two of them, in that order
yarn et api fixtures hub demo   # load the fixtures, then run the demo seed
```

`ethlete.apis.js` describes each API and is committed. Where the checkout lives on this machine is optional: set [`apiRepoPaths`](/cli/config) to point at a checkout you already have, or let `et` clone the API's `repoUrl` into a gitignored `.ethlete/<name>`.

## Naming several APIs

Every command takes a comma-separated list of names, and acts on each API in turn:

```
$ yarn et api up hub,platform
```

An unknown name, and a command one of the named APIs does not accept, stop the call before anything
runs. Each API then prints its own output and asks its own questions - to clone a missing checkout,
or to free a port. `clear` is the one exception: it asks a single question for every API you named.
The exit code is `1` when any of them failed.

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

`ethlete.apis.js` (or `ethlete.apis.cjs`) at the repo root exports one entry per API. It is a module rather than JSON because `env` is a function.

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
    repoUrl: 'git@gitlab.example.com:group/fut-hub-backend.git',
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

| Field           | Required | Meaning                                                                                                                                     |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `composeDir`    | yes      | Directory inside the checkout that holds the compose file.                                                                                  |
| `services`      | yes      | Services to start. Leave out anything the app does not need, such as a frontend container or a GPU-bound worker.                            |
| `execService`   | yes      | Service that `shell`, `logs` and every `exec` entry run in.                                                                                 |
| `port`          | yes      | Published host port, not the port inside the container. Used for the printed url.                                                           |
| `envFile`       | no       | File that must exist in `composeDir` before the API can start.                                                                              |
| `setupCommand`  | no       | Command that creates `envFile`, run by `setup` in `composeDir`.                                                                             |
| `network`       | no       | External container network created before the first `up`.                                                                                   |
| `repoUrl`       | no       | Where to clone this API from when the developer has no checkout of their own.                                                               |
| `envKey`        | no       | localStorage key the app reads to pick its API. Printed by `--host`.                                                                        |
| `examplePath`   | no       | Example path shown in the error that asks for this API's checkout.                                                                          |
| `env`           | no       | Extra environment for every compose call. An undefined value is dropped rather than passed as the string `undefined`.                       |
| `exec`          | no       | Named commands run in `execService`, e.g. `{ install: ['composer', 'install'] }`.                                                           |
| `checks`        | no       | Ordered preconditions run by [`doctor`](#checking-the-setup).                                                                               |
| `profiles`      | no       | Named states (`seeds`, `health`, `snapshot`) used by [`ready`](#getting-a-profile-ready), [`snapshot`](#snapshots) and [`status`](#status). |
| `migrationsDir` | no       | Migrations folder relative to the checkout root. Its contents are part of the [fingerprint](#the-fingerprint).                              |

Each key of `exec` becomes a command of its own, so `yarn et api install hub` runs `composer install` inside the `app` service. A key may not reuse a built-in command (`up`, `down`, `logs`, `shell`, `clone`, `clear`, `checkout`, `pull`, `setup`, `exec`, `doctor`, `run`, `ready`, `snapshot`, `status`) or `help`; the file then fails to load with an error that names the entry. A key named `seed` or `fixtures` is allowed, and runs instead of the [seed commands](#seeds).

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

The clone checks out the branch [`apiRepoBranches`](/cli/config) names, when there is one. Before it clones, `et` adds `/.ethlete/<name>/` to `.gitignore` unless git ignores that directory already. Ignore each managed checkout this way rather than `.ethlete/` as a whole: [`.ethlete/seeds/`](#seeds) is meant to be committed.

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

## Seeds

Seeds load extra local data into a running API, from scripts committed to your repo rather than to the API. Each API has a folder of its own, `.ethlete/seeds/<name>/`, with a `seeds.json` beside the scripts it runs:

```json
{
  "fixtures": ["php -d memory_limit=1G bin/console doctrine:fixtures:load --no-interaction --group dev"],
  "seeds": {
    "rewards": {
      "description": "Reward pass art and tile states",
      "run": ["bin/console app:reward:demo:seed", "php $SEED_DIR/reward-seed.php"]
    },
    "wc26": {
      "description": "WC26 finals and broadcast layouts",
      "run": ["php $SEED_DIR/wc26-broadcast-seed.php"],
      "env": { "WC26_TITLE": "rocket-league" }
    }
  }
}
```

| Field                      | Required | Meaning                                                                      |
| -------------------------- | -------- | ---------------------------------------------------------------------------- |
| `fixtures`                 | no       | Shell lines `fixtures` runs before any seed. Without it, `fixtures` refuses. |
| `seeds.<name>`             | no       | One seed. A name holds letters, digits, `-` and `_`.                         |
| `seeds.<name>.run`         | yes      | Shell lines, run in order. The first line that fails stops the seed.         |
| `seeds.<name>.description` | no       | Shown by `yarn et api seed <name>`. The `run` lines are shown without it.    |
| `seeds.<name>.env`         | no       | Variables exported before the `run` lines, as strings.                       |

```
$ yarn et api seed hub

Seeds of the hub API

  rewards  Reward pass art and tile states
  wc26     WC26 finals and broadcast layouts

Run them with "yarn et api seed hub rewards,wc26".
```

`yarn et api seed hub rewards,wc26` runs the named seeds in the order you name them. `yarn et api fixtures hub rewards` runs the `fixtures` lines first, and with no seed named, only those. An unknown seed name, an unknown key or a wrong type in `seeds.json` stops the call before anything runs, and a typo names the closest seed.

Before the first line runs, the whole folder is copied into `execService` at `/tmp/ethlete-seeds/<name>`, as a tar on the stdin of `compose exec -T`, so it works with every [container engine](#container-engines) and has no size limit. `SEED_DIR` points at that copy. Each seed then runs as one `sh -c` with `set -e`, in the container's working directory, which is the API's project root for the usual compose file. The seed's files never touch the API checkout.

`.ethlete/seeds/` is committed, so `.ethlete/` must not be gitignored as a whole. `et` warns when the manifest is ignored, and names the line to use instead:

```gitignore
/.ethlete/hub/
```

An `exec` entry named `seed` or `fixtures` in `ethlete.apis.js` runs instead of these commands, so an API that already declares one keeps it. Delete the entry to switch to the manifest.

## Container commands

| Command  | What it runs                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------ |
| `up`     | Checks the ports, creates `network` if set, starts `services` detached, then prints their state. |
| `down`   | Stops and removes the containers.                                                                |
| `logs`   | Follows the log of `execService`, or of a service you name.                                      |
| `shell`  | Opens `bash` in `execService`, or in a service you name.                                         |
| `exec`   | Runs one command in a service without a TTY. See [Running a command](#running-a-command).        |
| `doctor` | Runs the API's `checks`. See [Checking the setup](#checking-the-setup).                          |
| `run`    | Runs a host command under the API lock. See [Running under the lock](#running-under-the-lock).   |
| `ready`  | Brings a profile's data up to date. See [Getting a profile ready](#getting-a-profile-ready).     |

`logs` and `shell` take a service as a third argument, so `yarn et api logs hub database` follows the database rather than the app. A name that is not in `services` is reported with the list of names that are.

### Running a command

```sh
yarn et api exec hub app -- php artisan about
echo "select 1" | yarn et api exec hub database -- psql -U app
```

`exec <api> <service> -- <command> [<args>...]` is meant for scripts and test helpers. It never allocates a TTY, forwards its stdin to the command, passes the command's stdout and stderr through, and exits with the command's exit code. The CLI itself writes nothing to stdout, so the output is exactly the command's; its own errors go to stderr.

Everything after the first `--` goes to the command unchanged, so `--help` or `-h` there is the command's, not the CLI's. Without a `--` and a command, or without a service from `services`, `exec` exits with 1 and a usage line on stderr. It runs in one API at a time.

### Checking the setup

```js
checks: [
  { name: 'dependencies installed', check: 'test -d vendor', fix: 'composer install' },
  { name: 'database reachable', check: 'pg_isready -h database', service: 'app' },
  { name: 'env file present', check: 'test -f .env', host: true, fix: 'cp .env.example .env' },
],
```

`doctor <api> [--fix]` runs the checks in order and prints one line each: `ok`, `FAIL`, `fixed` or `fix failed`. A failure also prints the last lines of the check's stderr. `check` and `fix` are one shell line each. They run with `sh -c` in `service` (default `execService`) through `compose exec -T`, or on the host in `composeDir` with the API's `env` when `host` is `true`. The containers must already run; if not, `doctor` says so and points at `up`, it never starts them.

Without `--fix` every check runs and the exit code is 1 if any failed. With `--fix`, a failed check that has a `fix` runs it (its output streams through) and is checked again. `doctor --fix` stops at the first failed check without a `fix`, the first fix that fails and the first check that still fails after its fix, because later checks may depend on it. Check names must be unique, and `service` must be one of `services`; a wrong shape in `checks`, `profiles` or `migrationsDir` fails the load with an error that names the field, such as `fifagg.checks[2].fix must be a shell line`.

### Running under the lock

```sh
yarn et api run hub --lock -- yarn playwright test
yarn et api run hub --lock --wait 600 -- yarn e2e
```

Several frontend checkouts and agent sessions can drive the same API containers. `run <api> --lock [--wait <seconds>] -- <command> [<args>...]` lets one of them at a time change the API's data: it takes the lock, runs the command on the host in the repo root with stdio inherited, and exits with the command's exit code (128 plus the signal number when a signal ended it). `SIGINT` and `SIGTERM` are forwarded to the command. When the command ends, the lock is released and the state is marked dirty, so the next `ready` rebuilds it. The containers do not have to run, and the API's checkout must exist.

When another process holds the lock, `run` prints the holder once on stderr and checks again every second. Without `--wait` it waits without end; with `--wait <seconds>` it gives up after that time, prints the holder again and exits with `75`. A lock whose process is dead on this machine is stale: the next `run` takes it over and marks the state dirty, because the dead command may have left the data half-changed.

The command gets the lock's token as `ETHLETE_API_LOCK`, so a command that calls `et api ready` itself does not wait for the lock its own parent holds. Without `--lock`, or without a command after `--`, `run` exits with 1. It locks one API at a time.

The state and the lock live outside the repo, in `${XDG_STATE_HOME:-~/.local/state}/ethlete/api/<compose project>/` as `state.json` (`{ profile, fingerprint, dirty, updatedAt }`) and `lock.json` (`{ pid, hostname, command, cwd, startedAt, token }`). The compose project is the name compose itself gives the API's `composeDir`: `COMPOSE_PROJECT_NAME` from the environment, the API's `env` or `composeDir/.env`, then the compose file's top-level `name:`, then the directory name. Two checkouts whose containers compose sees as one project share one state and one lock. `seed` and `fixtures` mark the state dirty too, whether they succeed or not.

### Getting a profile ready

```js
profiles: {
  e2e: {
    seeds: ['fixtures', 'users', 'warmup'],
    health: { url: 'http://localhost:8040/health', expect: 200 },
    snapshot: { service: 'database', databases: ['app'], save: '…', restore: '…' },
  },
},
```

`ready <api> --profile <profile> [--wait <seconds>]` brings the API into the state the profile describes, as fast as it can. It takes the [API lock](#running-under-the-lock) unless `ETHLETE_API_LOCK` names the held one, runs `up`, then `doctor --fix`, computes the profile's [fingerprint](#the-fingerprint) and decides:

| Stored state                                          | What `ready` does                                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| clean, same profile, same fingerprint                 | Nothing.                                                                                      |
| anything else, and the profile's snapshot file exists | Restores `.ethlete/snapshots/<api>/<profile>-<fingerprint>.sql.gz`.                           |
| anything else, and no snapshot file                   | Runs the profile's `seeds` in order, then saves that snapshot when it has a `snapshot` block. |

Then the state is clean for that profile and fingerprint, and `health.url` is fetched every 2 s until it answers `health.expect` (default `200`), for up to 60 s. Each entry of `seeds` is `fixtures` (the manifest's fixtures list), a seed from `.ethlete/seeds/<api>/seeds.json`, or an `exec` entry of the API, checked in that order. A name that is none of them fails before anything runs. The state is marked dirty before the first seed runs, so an interrupted or failed seed leaves it dirty and the next `ready` seeds again.

Each step prints a heading on stderr; the last line, on stdout, names the profile, the fingerprint and the time taken. The exit code is `0` when the API is ready, the exit code of `up`, a seed or the snapshot command when one fails, `1` for a failed check, a failed health check or an unknown profile, and `75` when `--wait` ran out.

An end-to-end run holds the lock for the whole test run and lets its global setup call `ready` under it:

```sh
yarn et api run hub --lock -- npx playwright test
```

```ts
// global-setup.ts
import { execFileSync } from 'node:child_process';

export default () => {
  execFileSync('yarn', ['et', 'api', 'ready', 'hub', '--profile', 'e2e'], { stdio: 'inherit' });
};
```

### Snapshots

```js
profiles: {
  e2e: {
    seeds: ['users', 'fixtures'],
    snapshot: {
      service: 'database',
      databases: ['app', 'audit'],
      save: 'for db in $DATABASES; do pg_dump -U app "$db"; done',
      restore: 'psql -U app postgres',
    },
  },
},
```

```sh
yarn et api snapshot save hub base --profile e2e
yarn et api snapshot restore hub base --profile e2e --wait 600
```

`snapshot save|restore <api> <name> [--profile <profile>]` dumps and loads the databases of a profile. `--profile` defaults to the only profile that has a `snapshot` block; with none or several it exits 1 and says so. `save` runs `snapshot.save` with `sh -c` in `snapshot.service` through `compose exec -T`, gzips what it writes to stdout and renames the result into place only when the command exits 0, so a failed dump leaves no file. `restore` gunzips the file into the stdin of `snapshot.restore`. Both lines see `$DATABASES`, the names from `databases` separated by spaces. A name takes letters, digits, `.`, `-` and `_`.

The file is `.ethlete/snapshots/<api>/<name>-<fingerprint>.sql.gz`, with the fingerprint of that profile, so a snapshot made for other migrations, seeds or API commit is never picked up by accident. A path that git does not ignore prints a warning on stderr, because dumps hold real data: add `/.ethlete/snapshots/` to `.gitignore`. Restoring a missing file lists the snapshots that exist for the API and exits 1.

`restore` takes the [API lock](#running-under-the-lock) unless `ETHLETE_API_LOCK` names the held one, waiting for `--wait <seconds>` (exit `75` on timeout) or without end. On success the state becomes clean for that profile and fingerprint; a failed restore marks it dirty. `save` only reads and takes no lock. The order `snapshot <api> save|restore <name>` works too.

### The fingerprint

The fingerprint is the first 12 hex characters of a sha256 over: `git rev-parse HEAD` of the API checkout (the literal `no-git` when it is not a git repo), the names and contents of the files under `migrationsDir` (skipped when unset), every file under `.ethlete/seeds/<api>/`, the profile's `seeds` list, the contents of `ethlete.apis.js` or `.cjs`, and the major version of the CLI.

### Status

```sh
yarn et api status hub
```

`status <api> [--profile <profile>]` prints one aligned line each for the profile (the stored one, or `--profile`), the stored fingerprint, the current fingerprint of that profile, `dirty`, the snapshot files that match the current fingerprint, and the lock holder, `free`, or `unreadable (<path>)` for a lock file it cannot parse, which `run`, `ready` and `restore` treat as held. It always exits 0 once the checkout resolves.

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
It asks first, and the question defaults to no. `--all` clears every API at once, and a
comma-separated list clears the ones you name. Either way it is one question for all of them.

It only ever removes a checkout `et` cloned. A path you set in
[`apiRepoPaths`](/cli/config) is your own, so `clear` refuses it and says so.

An API whose containers still exist is taken down as part of the same question:

```
$ yarn et api clear hub,platform

This takes platform down, then removes:

  /repo/.ethlete/hub
  /repo/.ethlete/platform

Take platform down and remove the checkouts? [y/N]
```

Three checks refuse the removal instead, because what they hold exists nowhere else. If git cannot read the checkout at all, that refuses it too:

| Check                   | How to pass it                   |
| ----------------------- | -------------------------------- |
| Uncommitted changes     | Commit them, or `--force`        |
| Commits no remote holds | Push them, or `--force`          |
| Stashed changes         | Apply or drop them, or `--force` |

The refusal lists what stands in the way, so a change you do not care about is obvious at a glance:

```
$ yarn et api clear platform

/repo/.ethlete/platform has uncommitted changes:

  M .gitignore

Commit them, or pass --force to lose them.
```

`--force` skips every git check. It never skips the take-down: a checkout that is gone leaves its
containers with no files.

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
