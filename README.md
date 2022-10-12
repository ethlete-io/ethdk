<p align="center">
  <img alt="angular-eslint-logo" src="https://www.ethlete.io/assets/images/ethlete-logo.png" width="250" height="55" />
</p>

<h1 align="center">Ethlete Frontend SDKs</h1>

<p align="center">Monorepo for all the Ethlete frontend SDKs</p>

<p align="center">
    <a href="https://actions-badge.atrox.dev/ethlete-io/ethdk/goto?ref=main"><img alt="Build Status" src="https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2Fethlete-io%2Fethdk%2Fbadge%3Fref%3Dmain&style=flat-square" /></a>
    <a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg?style=flat-square" alt="Commitizen friendly" /></a>
</p>

<br>

## Packages

Below is a list of all current Ethlete SDKs.

### @ethlete/core

[![NPM version](https://img.shields.io/npm/v/@ethlete/core?style=flat-square)](https://www.npmjs.com/package/@ethlete/core)
[![NPM version](https://img.shields.io/npm/v/@ethlete/core/next?style=flat-square)](https://www.npmjs.com/package/@ethlete/core)

Core functionalities and utils.

```sh
yarn add @ethlete/core
```

### @ethlete/components

[![NPM version](https://img.shields.io/npm/v/@ethlete/components?style=flat-square)](https://www.npmjs.com/package/@ethlete/components)
[![NPM version](https://img.shields.io/npm/v/@ethlete/components/next?style=flat-square)](https://www.npmjs.com/package/@ethlete/components)

Common themeable and WAI-ARIA compliant components.

You can find the Storybook docs for the main branch here: https://ethlete-sdk.web.app/

```sh
yarn add @ethlete/components
```

### @ethlete/theming

[![NPM version](https://img.shields.io/npm/v/@ethlete/theming?style=flat-square)](https://www.npmjs.com/package/@ethlete/theming)
[![NPM version](https://img.shields.io/npm/v/@ethlete/theming/next?style=flat-square)](https://www.npmjs.com/package/@ethlete/theming)

Utilities to make component theming easier.

```sh
yarn add @ethlete/theming
```

### @ethlete/contentful

[![NPM version](https://img.shields.io/npm/v/@ethlete/contentful?style=flat-square)](https://www.npmjs.com/package/@ethlete/contentful)
[![NPM version](https://img.shields.io/npm/v/@ethlete/contentful/next?style=flat-square)](https://www.npmjs.com/package/@ethlete/contentful)

Helpers for usage with Contentful (e.g. rich text rendering).

```sh
yarn add @ethlete/theming
```

### @ethlete/types

[![NPM version](https://img.shields.io/npm/v/@ethlete/types?style=flat-square)](https://www.npmjs.com/package/@ethlete/types)
[![NPM version](https://img.shields.io/npm/v/@ethlete/types/next?style=flat-square)](https://www.npmjs.com/package/@ethlete/types)

Up to date typescript definitions for the Ethlete REST API as well as other types shared across SDKs.

```sh
yarn add -D @ethlete/types
```

## How to contribute

This mono repository uses:

- [Yarn](https://yarnpkg.com/) as a package manager.
- [Conventional commits](http://commitizen.github.io/cz-cli/) for commit messages.
- [Changesets](https://github.com/changesets/changesets) for version management and automated releases.

### General workflow

Clone the repository:

```sh
git clone https://github.com/ethlete-io/ethdk.git
```

Install dependencies:

```sh
yarn install
```

Create a feat, fix or other branch:

```sh
git checkout -B feat/example
```

Commit your changes via git-cz:

```
yarn commit
```

If the changes made should result in a version bump, create a changeset and commit the generated file.
All SDKs adhere to the [semantic versioning](https://semver.org/) guidelines.

```
yarn change
```

Now all that's left is to create a PR and make sure that all workflows pass.

### Useful scripts

| Script       | Description                              |
| ------------ | ---------------------------------------- |
| `commit`     | Run the commit assistant                 |
| `change`     | Run the changeset assistant              |
| `start`      | Run the sandbox (test) app in serve mode |
| `storybook`  | Run the storybook instance               |
| `storybook`  | Run the storybook instance               |
| `nx:update`  | Run nx update                            |
| `nx:migrate` | Apply migrations created by `nx:update`  |
