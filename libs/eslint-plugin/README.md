# @ethlete/eslint-plugin

ESLint plugin with custom rules and shareable flat configs for the Ethlete coding styleguide.

## Installation

```bash
npm install --save-dev @ethlete/eslint-plugin
```

## Usage

```js
// eslint.config.mjs
import ethlete from '@ethlete/eslint-plugin';

export default [...ethlete.configs.recommended];
```

## Rules

| Rule                             | Description                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `ethlete/no-inject-chain`        | Disallows `inject(X).member` chaining — use a `const` instead                                   |
| `ethlete/no-trivial-return-type` | Disallows explicit `void`, `boolean`, `string`, `number` return types that TypeScript can infer |
