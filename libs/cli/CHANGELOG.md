# @ethlete/cli

## 2.1.0-next.9

### Minor Changes

- [`f7ce2eb`](https://github.com/ethlete-io/ethdk/commit/f7ce2ebb55501709efce105aec1044bcdde44d9e) `et update` now writes the new range into every `package.json` in the repo, not only the root one, and refuses a dist tag that points at an older version than the repo is on.

## 2.1.0-next.8

### Minor Changes

- [#3075](https://github.com/ethlete-io/ethdk/pull/3075) [`004c32d`](https://github.com/ethlete-io/ethdk/commit/004c32d0ada3d7862947843dd6e8b204876160fe) Thanks [@github-actions](https://github.com/apps/github-actions)! - `doctorCommand` accepts an optional `composeTools` override for the container-engine check.

- [#3075](https://github.com/ethlete-io/ethdk/pull/3075) [`1d38e7e`](https://github.com/ethlete-io/ethdk/commit/1d38e7e0a025769f065d8ca7d506cb75ad89139a) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et update` moves the `@ethlete/*` packages to a newer version, runs the codemods those versions
  declare in their own `migrations.json`, and reports what needs a decision or an agent.

## 2.1.0-next.7

### Patch Changes

- [#3074](https://github.com/ethlete-io/ethdk/pull/3074) [`63a528a`](https://github.com/ethlete-io/ethdk/commit/63a528a0ab1b1e7163e71c1cf5f65415bdda32d9) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et auth` now takes a host written as a url, and asks before it replaces a token `auth.json`
  already holds for that host.

## 2.1.0-next.6

### Minor Changes

- [`a1c489e`](https://github.com/ethlete-io/ethdk/commit/a1c489e0a1da4b479fd6e47743dec4c1bad0152f) Thanks [@TomTomB](https://github.com/TomTomB)! - `et api up` now refuses a port another program holds and prints a per-service state table instead of
  the engine's output. New `et api clear` removes a managed checkout, and offers to take its containers down first.

- [`12dcd51`](https://github.com/ethlete-io/ethdk/commit/12dcd5118ca8d2089cc3e9379efe4e9d0502a0f6) Thanks [@TomTomB](https://github.com/TomTomB)! - Every `et api` command now takes a comma-separated list of names, so `et api up hub,platform` starts
  both APIs.

- [`0e060b2`](https://github.com/ethlete-io/ethdk/commit/0e060b28436e9444726a35a93264a046242e348e) Thanks [@TomTomB](https://github.com/TomTomB)! - `et api help <name>` now answers for one API: the commands it accepts, what each one runs, its url
  and services, and the state of its checkout. `--help` after a known API name prints the same text.

- [`0e060b2`](https://github.com/ethlete-io/ethdk/commit/0e060b28436e9444726a35a93264a046242e348e) Thanks [@TomTomB](https://github.com/TomTomB)! - `et api` now runs an API's `setupCommand` itself: `et api setup <name>` on its own, or as an offer
  when a command finds the `envFile` missing. `--setup` accepts that offer without the question.

- [`c3dd7c3`](https://github.com/ethlete-io/ethdk/commit/c3dd7c3d7e0e2a060e081c7fe820f9774537418b) Thanks [@TomTomB](https://github.com/TomTomB)! - `et auth <token>` writes a GitLab token into composer's `auth.json`, which the API containers mount. It asks the host whether the token can download code before it writes anything.

### Patch Changes

- [`0e060b2`](https://github.com/ethlete-io/ethdk/commit/0e060b28436e9444726a35a93264a046242e348e) Thanks [@TomTomB](https://github.com/TomTomB)! - An unknown API name in `et api` now names the closest match and the APIs there are, in place of the
  whole help text. An unknown command suggests the closest command the same way.

- [`c3dd7c3`](https://github.com/ethlete-io/ethdk/commit/c3dd7c3d7e0e2a060e081c7fe820f9774537418b) Thanks [@TomTomB](https://github.com/TomTomB)! - A failing `et api` exec command no longer always blames a private dependency. That hint is kept for a command that installs dependencies; any other one suggests running the install command first.

- [`0e060b2`](https://github.com/ethlete-io/ethdk/commit/0e060b28436e9444726a35a93264a046242e348e) Thanks [@TomTomB](https://github.com/TomTomB)! - `et api setup` keeps the setup command's own output back and prints one line for the result. The output is only shown when the command fails, so a checkout's advice about its Makefile no longer competes with the CLI.

- [`0e060b2`](https://github.com/ethlete-io/ethdk/commit/0e060b28436e9444726a35a93264a046242e348e) Thanks [@TomTomB](https://github.com/TomTomB)! - Every `et` message now names a command the reader can type, for example `yarn api` or `npx et api`,
  in place of a bare `et`. `et doctor` names the `et api` command that fixes each problem.

## 2.1.0-next.5

### Minor Changes

- [`612d735`](https://github.com/ethlete-io/ethdk/commit/612d73563e1689bbfcf948d26ebe7c59d2420781) Thanks [@TomTomB](https://github.com/TomTomB)! - `et api` now clones a missing API checkout from a `repoUrl` in `ethlete.apis.js`, making
  `apiRepoPaths` optional. `runApiCommand` is async as a result.

- [#3072](https://github.com/ethlete-io/ethdk/pull/3072) [`4bbbb51`](https://github.com/ethlete-io/ethdk/commit/4bbbb5167989a1c3ef2ffeba09fcfd18ba953fba) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `et doctor` to check this machine's config, container engine and API checkouts, `et api
checkout` and `et api pull` (with `--force`) to move an API checkout to the branch it should be on,
  and `et api --help`.

### Patch Changes

- [#3072](https://github.com/ethlete-io/ethdk/pull/3072) [`0fd8ba3`](https://github.com/ethlete-io/ethdk/commit/0fd8ba3dd61cc78409c397c8180f0a675282642f) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et doctor` now says when a directory has neither config file rather than reporting no problems.

## 2.1.0-next.4

### Minor Changes

- [`b6fe4be`](https://github.com/ethlete-io/ethdk/commit/b6fe4beae010aaa2e0e367d636f6759442983395) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `et api` to run an app's backend from a local checkout, declared in `ethlete.apis.js`. The new
  `ethlete.config.local.json` says where the sibling checkouts on this machine live.

## 2.1.0-next.3

### Minor Changes

- [`edea44b`](https://github.com/ethlete-io/ethdk/commit/edea44bf1c494420f02b545202f4b24db9a6395c) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to angular 22

## 2.0.1-next.2

### Patch Changes

- [`b73a127`](https://github.com/ethlete-io/ethdk/commit/b73a127002a06e3aa0c4e7e977b1ad1f3e04e7e6) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump yet again, final one for sure, pinky promise

## 2.0.1-beta.1

### Patch Changes

- [`ddb5d09`](https://github.com/ethlete-io/ethdk/commit/ddb5d09e4bc56e18cc8c228aa78a200441e7a766) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump to beta

## 2.0.1-next.0

### Patch Changes

- [`a690217`](https://github.com/ethlete-io/ethdk/commit/a6902172efd9bd1956a16237e79acbfbd816d946) Thanks [@TomTomB](https://github.com/TomTomB)! - Version bump only

## 2.0.0

### Minor Changes

- [`10802c0`](https://github.com/ethlete-io/ethdk/commit/10802c0ecef8907b2ab27f42680aa5b47db76f7d) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to Angular v20

### Patch Changes

- Updated dependencies [[`10802c0`](https://github.com/ethlete-io/ethdk/commit/10802c0ecef8907b2ab27f42680aa5b47db76f7d)]:
  - @ethlete/dsp@0.3.0

## 1.0.0

### Minor Changes

- [`1dd18fb`](https://github.com/ethlete-io/ethdk/commit/1dd18fb077b9b377384daac8eacae5732d7e7a3a) Thanks [@TomTomB](https://github.com/TomTomB)! - Update angular 19

### Patch Changes

- Updated dependencies [[`1dd18fb`](https://github.com/ethlete-io/ethdk/commit/1dd18fb077b9b377384daac8eacae5732d7e7a3a)]:
  - @ethlete/dsp@0.2.0

## 0.2.2

### Patch Changes

- [`69ee325`](https://github.com/ethlete-io/ethdk/commit/69ee32561bf0df78569a1649053a37edf9741b9c) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump only for updating peer deps

## 0.2.1

### Patch Changes

- [`0328fb76`](https://github.com/ethlete-io/ethdk/commit/0328fb769ca53042835826c1967b8d2f25072d63) Thanks [@TomTomB](https://github.com/TomTomB)! - Dependency sync only

- Updated dependencies [[`0328fb76`](https://github.com/ethlete-io/ethdk/commit/0328fb769ca53042835826c1967b8d2f25072d63)]:
  - @ethlete/dsp@0.1.2

## 0.2.0

### Minor Changes

- [`9605da51`](https://github.com/ethlete-io/ethdk/commit/9605da5186a036ee052668a8c390be8332178398) Thanks [@TomTomB](https://github.com/TomTomB)! - Add release script

## 0.1.1

### Patch Changes

- [`04e0db6`](https://github.com/ethlete-io/ethdk/commit/04e0db6c0007d58705f88605f3f8ed2d0ad05ce3) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to Angular 16

## 0.1.0

### Minor Changes

- [#609](https://github.com/ethlete-io/ethdk/pull/609) [`39eda21`](https://github.com/ethlete-io/ethdk/commit/39eda21929f50b75071ad464c3331d85f3645fa1) Thanks [@nziermann](https://github.com/nziermann)! - Add a dsp function to generate css based on input file
