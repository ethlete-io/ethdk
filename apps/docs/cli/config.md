# Local config

`ethlete.config.local.json` at the repo root says where the sibling checkouts this repo works with live on **this** machine. It is gitignored, so every value is per-developer and changes nothing for anyone else.

```json
{
  "sdkSourcePath": "/absolute/path/to/ethlete-sdk",
  "apiRepoPaths": { "hub": "../fut-hub-backend", "*": "../shared-backend" },
  "apiRepoBranches": { "hub": "develop", "*": "main" }
}
```

Add the filename to your `.gitignore`.

| Key               | Read by                                       | Meaning                                                                               |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `sdkSourcePath`   | the `sdk-source` and `sdk-local-build` skills | A local `ethlete-sdk` checkout, for reading its source or building it into this repo. |
| `apiRepoPaths`    | [`et api`](/cli/api), the `api-source` skill  | The checkout of the API an app talks to, keyed by app name.                           |
| `apiRepoBranches` | `et api checkout`, the `api-source` skill     | The branch that represents each API's deployed state, keyed by app name.              |

Both maps match on the exact app name first, then on the explicit `"*"` key. Use `"*"` only when apps intentionally share one checkout. A relative path resolves from the repo root; an absolute path is used as is.

The skills that read this file are shipped by [`@ethlete/agent-rules`](/agent-rules/), so an agent and `et` always resolve a checkout to the same place.

## Moved from `ethlete-agents.config.local.json`

These three keys used to live in `ethlete-agents.config.local.json`. They moved here because `et` reads the same values the skills do, and that file is about agent behaviour.

The old file is still read when `ethlete.config.local.json` is absent, so an existing checkout keeps working. `et api` warns when it falls back, `et doctor` reports where the keys should go, and `ethlete-agents sync` does the same. `disableHooks` and `disableAutoHandoffSave` stay in the agents file - they were never about repo topology.

## `et doctor`

```bash
yarn et doctor
```

`et doctor` reports every problem with this machine's setup at once, rather than making you find them one command at a time.

```
  container engine: podman-compose
  ethlete.apis.js: hub → /home/you/dev/fut-hub-backend/development

No problems found.
```

It checks:

- that `ethlete.config.local.json` is valid JSON and an object, and holds no key nothing reads;
- that `sdkSourcePath` exists and really is an `ethlete-sdk` checkout;
- that every `apiRepoPaths` entry points at a directory that exists;
- that every `apiRepoBranches` value is a non-empty branch name;
- that a container engine is available;
- that every API declared in [`ethlete.apis.js`](/cli/api) resolves to a checkout, with its compose directory and its `envFile` in place.

It exits non-zero when it finds a problem, so CI can run it. In a directory with neither file it says there is nothing to check rather than reporting success.
