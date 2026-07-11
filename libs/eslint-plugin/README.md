# @ethlete/eslint-plugin

ESLint plugin with custom rules and shareable flat configs for the Ethlete coding styleguide.

## Installation

```bash
yarn add --dev @ethlete/eslint-plugin
```

## Usage

```js
// eslint.config.mjs
import ethlete from '@ethlete/eslint-plugin';

export default [...ethlete.configs.recommended];
```

## Documentation

The full rule reference (all rules, grouped, with defaults and auto-fix support) and
config documentation live on the docs site:

- [Overview & usage](https://ethlete-sdk-docs.web.app/eslint/)
- [Rule reference](https://ethlete-sdk-docs.web.app/eslint/rules)
